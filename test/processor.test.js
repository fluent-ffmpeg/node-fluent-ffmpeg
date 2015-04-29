/*jshint node:true*/
/*global describe,it,before,after,beforeEach,afterEach*/
'use strict';

var FfmpegCommand = require('../index'),
  path = require('path'),
  fs = require('fs'),
  assert = require('assert'),
  os = require('os').platform(),
  exec = require('child_process').exec,
  spawn = require('child_process').spawn,
  async = require('async'),
  stream = require('stream'),
  testhelper = require('./helpers');


var testHTTP = 'http://127.0.0.1:8090/test.mpg';
var testRTSP = 'rtsp://127.0.0.1:5540/test-rtp.mpg';
var testRTPOut = 'rtp://127.0.0.1:5540/input.mpg';


/*****************************************************************

              IMPORTANT NOTE ABOUT PROCESSOR TESTS

 To ensure tests run reliably, you should do the following:

 * Any input file you use must be tested for existence before
   running the tests.  Use the 'prerequisite' function below and
   add any new file there.

 * FfmpegCommands should be created using 'this.getCommand(args)'
   in the test definition, not using 'new Ffmpegcommand(args)'.
   This enables ensuring the command is finished before starting
   the next test.

 * Any file your test is expected to create should have their full
   path pushed to the 'this.files' array in the test definition,
   and your test should *not* remove them on completion.  The
   cleanup hook will check all those files for existence and remove
   them.

 * Same thing with directories in the 'this.dirs' array.

 * If you use intervals or timeouts, please ensure they have been
   canceled (for intervals) or called (for timeouts) before
   calling the test 'done()' callback.

 Not abiding by those rules is BAD.  You have been warned :)

 *****************************************************************/


describe('Processor', function() {
  // check prerequisites once before all tests
  before(function prerequisites(done) {
    // check for ffmpeg installation
    this.testfile = path.join(__dirname, 'assets', 'testvideo-43.avi');
    this.testfilewide = path.join(__dirname, 'assets', 'testvideo-169.avi');
    this.testfilebig = path.join(__dirname, 'assets', 'testvideo-5m.mpg');
    this.testfilespecial = path.join(__dirname, 'assets', 'te[s]t_ video \' _ .flv');
    this.testfileaudio1 = path.join(__dirname, 'assets', 'testaudio-one.wav');
    this.testfileaudio2 = path.join(__dirname, 'assets', 'testaudio-two.wav');
    this.testfileaudio3 = path.join(__dirname, 'assets', 'testaudio-three.wav');

    var self = this;

    exec(testhelper.getFfmpegCheck(), function(err) {
      if (!err) {
        // check if all test files exist
        async.each([
            self.testfile,
            self.testfilewide,
            self.testfilebig,
            self.testfilespecial,
            self.testfileaudio1,
            self.testfileaudio2,
            self.testfileaudio3
          ], function(file, cb) {
            fs.exists(file, function(exists) {
              cb(exists ? null : new Error('test video file does not exist, check path (' + file + ')'));
            });
          },
          done
        );
      } else {
        done(new Error('cannot run test without ffmpeg installed, aborting test...'));
      }
    });
  });

  // cleanup helpers before and after all tests
  beforeEach(function setup(done) {
    var processes = this.processes = [];
    var outputs = this.outputs = [];

    // Tests should call this so that created processes are watched
    // for exit and checked during test cleanup
    this.getCommand = function(args) {
      var cmd = new FfmpegCommand(args);
      cmd.on('start', function() {
        processes.push(cmd.ffmpegProc);

        // Remove process when it exits
        cmd.ffmpegProc.on('exit', function() {
          processes.splice(processes.indexOf(cmd.ffmpegProc), 1);
        });
      });

      return cmd;
    };

    // Tests should call this to display stdout/stderr in case of error
    this.saveOutput = function(stdout, stderr) {
      outputs.unshift([stdout, stderr]);
    };

    this.files = [];
    this.dirs = [];

    done();
  });

  afterEach(function cleanup(done) {
    var self = this;

    async.series([
        // Ensure every process has finished
        function(cb) {
          if (self.processes.length) {
            if (self.outputs.length) {
              testhelper.logOutput(self.outputs[0][0], self.outputs[0][1]);
            }

            cb(new Error(self.processes.length + ' processes still running after "' + self.currentTest.title + '"'));
          } else {
            cb();
          }
        },

        // Ensure all created files are removed
        function(cb) {
          async.each(self.files, function(file, cb) {
            fs.exists(file, function(exists) {
              if (exists) {
                fs.unlink(file, cb);
              } else {
                if (self.outputs.length) {
                  testhelper.logOutput(self.outputs[0][0], self.outputs[0][1]);
                }

                cb(new Error('Expected created file ' + file + ' by  "' + self.currentTest.title + '"'));
              }
            });
          }, cb);
        },

        // Ensure all created dirs are removed
        function(cb) {
          async.each(self.dirs, function(dir, cb) {
            fs.exists(dir, function(exists) {
              if (exists) {
                fs.rmdir(dir, cb);
              } else {
                if (self.outputs.length) {
                  testhelper.logOutput(self.outputs[0][0], self.outputs[0][1]);
                }

                cb(new Error('Expected created directory ' + dir + ' by  "' + self.currentTest.title + '"'));
              }
            });
          }, cb);
        }
      ],

      done
    );
  });

  describe('Process controls', function() {
    // Skip all niceness tests on windows
    var skipNiceness = os.match(/win(32|64)/);

    // Skip renice test on OSX + travis (not enough permissions to renice)
    var skipRenice = process.env.TRAVIS && os.match(/darwin/);

    (skipNiceness ? it.skip : it)('should properly limit niceness', function() {
      this.getCommand({ source: this.testfile, logger: testhelper.logger, timeout: 0.02 })
          .renice(100).options.niceness.should.equal(20);
    });

    ((skipNiceness || skipRenice) ? it.skip : it)('should dynamically renice process', function(done) {
      this.timeout(60000);

      var testFile = path.join(__dirname, 'assets', 'testProcessRenice.flv');
      this.files.push(testFile);

      var ffmpegJob = this.getCommand({ source: this.testfilebig, logger: testhelper.logger, timeout: 2 })
          .usingPreset('flashvideo');

      var startCalled = false;
      var reniced = false;

      ffmpegJob
          .on('start', function() {
            startCalled = true;
            setTimeout(function() {
              ffmpegJob.renice(5);

              setTimeout(function() {
                exec('ps -p ' + ffmpegJob.ffmpegProc.pid + ' -o ni=', function(err, stdout) {
                  assert.ok(!err);
                  parseInt(stdout, 10).should.equal(5);
                  reniced = true;
                });
              }, 500);
            }, 500);

            ffmpegJob.ffmpegProc.on('exit', function() {
              reniced.should.equal(true);
              done();
            });
          })
          .on('error', function() {
            reniced.should.equal(true);
            startCalled.should.equal(true);
          })
          .on('end', function() {
            console.log('end was called, expected a timeout');
            assert.ok(false);
            done();
          })
          .saveToFile(testFile);
    });

    it('should kill the process on timeout', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testProcessKillTimeout.flv');
      this.files.push(testFile);

      var command = this.getCommand({ source: this.testfilebig, logger: testhelper.logger, timeout: 0.02});
      var self = this;

      command
          .usingPreset('flashvideo')
          .on('start', function() {
            command.ffmpegProc.on('exit', function() {
              done();
            });
          })
          .on('error', function(err, stdout, stderr) {
            self.saveOutput(stdout, stderr);
            err.message.indexOf('timeout').should.not.equal(-1);
          })
          .on('end', function() {
            console.log('end was called, expected a timeout');
            assert.ok(false);
            done();
          })
          .saveToFile(testFile);
    });

    it('should kill the process with .kill', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testProcessKill.flv');
      this.files.push(testFile);

      var ffmpegJob = this.getCommand({ source: this.testfilebig, logger: testhelper.logger })
          .usingPreset('flashvideo');

      var startCalled = false;
      var errorCalled = false;

      ffmpegJob
          .on('start', function() {
            startCalled = true;
            setTimeout(function() { ffmpegJob.kill(); }, 500);
            ffmpegJob.ffmpegProc.on('exit', function() {
              errorCalled.should.equal(true);
              done();
            });
          })
          .on('error', function(err) {
            err.message.indexOf('ffmpeg was killed with signal SIGKILL').should.not.equal(-1);
            startCalled.should.equal(true);
            errorCalled = true;
          })
          .on('end', function() {
            console.log('end was called, expected an error');
            assert.ok(false);
            done();
          })
          .saveToFile(testFile);
    });

    it('should send the process custom signals with .kill(signal)', function(done) {
      this.timeout(60000);

      var testFile = path.join(__dirname, 'assets', 'testProcessKillCustom.flv');
      this.files.push(testFile);

      var ffmpegJob = this.getCommand({ source: this.testfilebig, logger: testhelper.logger, timeout: 2 })
          .usingPreset('flashvideo');

      var startCalled = true;
      var errorCalled = false;
      ffmpegJob
          .on('start', function() {
            startCalled = true;

            setTimeout(function() { ffmpegJob.kill('SIGSTOP'); }, 500);

            ffmpegJob.ffmpegProc.on('exit', function() {
              errorCalled.should.equal(true);
              done();
            });
          })
          .on('error', function(err) {
            startCalled.should.equal(true);
            err.message.indexOf('timeout').should.not.equal(-1);

            errorCalled = true;
            ffmpegJob.kill('SIGCONT');
          })
          .on('end', function() {
            console.log('end was called, expected a timeout');
            assert.ok(false);
            done();
          })
          .saveToFile(testFile);

    });
  });

  describe('Events', function() {
    it('should report codec data through \'codecData\' event', function(done) {
      this.timeout(60000);

      var testFile = path.join(__dirname, 'assets', 'testOnCodecData.flv');
      this.files.push(testFile);

      this.getCommand({ source: this.testfilebig, logger: testhelper.logger })
        .on('codecData', function(data) {
          data.should.have.property('audio');
          data.should.have.property('video');
        })
        .usingPreset('flashvideo')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          done();
        })
        .saveToFile(testFile);
    });

    it('should report codec data through \'codecData\' event for input streams', function(done) {
      this.timeout(60000);
      var testFile = path.join(__dirname, 'assets', 'testConvertFromStreamToFileCodecData.flv');
      this.files.push(testFile);

      var receivedCodecData = false;
      var instream = fs.createReadStream(this.testfile);
      this.getCommand({ source: instream, logger: testhelper.logger })
        .usingPreset('flashvideo')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('codecData', function(data) {
          receivedCodecData = true;
          data.should.have.property('audio');
          data.should.have.property('video');
        })
        .on('end', function() {
          assert(receivedCodecData);
          done();
        })
        .saveToFile(testFile);
    });

    it('should report progress through \'progress\' event', function(done) {
      this.timeout(60000);

      var testFile = path.join(__dirname, 'assets', 'testOnProgress.flv');
      var gotProgress = false;

      this.files.push(testFile);

      this.getCommand({ source: this.testfilebig, logger: testhelper.logger })
          .on('progress', function() {
            gotProgress = true;
          })
          .usingPreset('flashvideo')
          .on('error', function(err, stdout, stderr) {
            testhelper.logError(err, stdout, stderr);
            assert.ok(!err);
          })
          .on('end', function() {
            gotProgress.should.equal(true);
            done();
          })
          .saveToFile(testFile);
    });

    it('should report start of ffmpeg process through \'start\' event', function(done) {
      this.timeout(60000);

      var testFile = path.join(__dirname, 'assets', 'testStart.flv');
      var startCalled = false;

      this.files.push(testFile);

      this.getCommand({ source: this.testfilebig, logger: testhelper.logger })
          .on('start', function(cmdline) {
            startCalled = true;

            // Only test a subset of command line
            cmdline.indexOf('ffmpeg').should.equal(0);
            cmdline.indexOf('testvideo-5m').should.not.equal(-1);
            cmdline.indexOf('-b:a 96k').should.not.equal(-1);
          })
          .usingPreset('flashvideo')
          .on('error', function(err, stdout, stderr) {
            testhelper.logError(err, stdout, stderr);
            assert.ok(!err);
          })
          .on('end', function() {
            startCalled.should.equal(true);
            done();
          })
          .saveToFile(testFile);
    });
  });

  describe('takeScreenshots', function() {
    function testScreenshots(title, name, config, files) {
      it(title, function(done) {
        var filenamesCalled = false;
        var testFolder = path.join(__dirname, 'assets', 'screenshots_' + name);

        var context = this;
        files.forEach(function(file) {
          context.files.push(path.join(testFolder, file));
        });
        this.dirs.push(testFolder);

        this.getCommand({ source: this.testfile, logger: testhelper.logger })
          .on('error', function(err, stdout, stderr) {
            testhelper.logError(err, stdout, stderr);
            assert.ok(!err);
          })
          .on('filenames', function(filenames) {
            filenamesCalled = true;
            filenames.length.should.equal(files.length);
            filenames.forEach(function(file, index) {
              file.should.equal(files[index]);
            });
          })
          .on('end', function() {
            filenamesCalled.should.equal(true);
            fs.readdir(testFolder, function(err, content) {
              var tnCount = 0;
              content.forEach(function(file) {
                if (file.indexOf('.png') > -1) {
                  tnCount++;
                }
              });
              tnCount.should.equal(files.length);
              files.forEach(function(file) {
                content.indexOf(file).should.not.equal(-1);
              });
              done();
            });
          })
          .takeScreenshots(config, testFolder);
      });
    }

    testScreenshots(
      'should take screenshots from a list of number timemarks',
      'timemarks_num',
      { timemarks: [ 0.5, 1 ] },
      ['tn_1.png', 'tn_2.png']
    );

    testScreenshots(
      'should take screenshots from a list of string timemarks',
      'timemarks_string',
      { timemarks: [ '0.5', '1' ] },
      ['tn_1.png', 'tn_2.png']
    );

    testScreenshots(
      'should take screenshots from a list of string timemarks',
      'timemarks_hms',
      { timemarks: [ '00:00:00.500', '00:01' ] },
      ['tn_1.png', 'tn_2.png']
    );

    testScreenshots(
      'should support "timestamps" instead of "timemarks"',
      'timestamps',
      { timestamps: [ 0.5, 1 ] },
      ['tn_1.png', 'tn_2.png']
    );

    testScreenshots(
      'should replace %i with the screenshot index',
      'filename_i',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%i.png' },
      ['shot_1.png', 'shot_2.png']
    );

    testScreenshots(
      'should replace %000i with the padded screenshot index',
      'filename_0i',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%000i.png' },
      ['shot_0001.png', 'shot_0002.png']
    );

    testScreenshots(
      'should replace %s with the screenshot timestamp',
      'filename_s',
      { timemarks: [ 0.5, '40%', 1 ], filename: 'shot_%s.png' },
      ['shot_0.5.png', 'shot_0.8.png', 'shot_1.png']
    );

    testScreenshots(
      'should replace %f with the input filename',
      'filename_f',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%f_%i.png' },
      ['shot_testvideo-43.avi_1.png', 'shot_testvideo-43.avi_2.png']
    );

    testScreenshots(
      'should replace %b with the input basename',
      'filename_b',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%b_%i.png' },
      ['shot_testvideo-43_1.png', 'shot_testvideo-43_2.png']
    );

    testScreenshots(
      'should replace %r with the output resolution',
      'filename_r',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%r_%i.png' },
      ['shot_1024x768_1.png', 'shot_1024x768_2.png']
    );

    testScreenshots(
      'should replace %w and %h with the output resolution',
      'filename_wh',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%wx%h_%i.png' },
      ['shot_1024x768_1.png', 'shot_1024x768_2.png']
    );

    testScreenshots(
      'should automatically add %i when no variable replacement is present',
      'filename_add_i',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%b.png' },
      ['shot_testvideo-43_1.png', 'shot_testvideo-43_2.png']
    );

    testScreenshots(
      'should automatically compute timestamps from the "count" option',
      'count',
      { count: 3, filename: 'shot_%s.png' },
      ['shot_0.5.png', 'shot_1.png', 'shot_1.5.png']
    );

    testScreenshots(
      'should enable setting screenshot size',
      'size',
      { count: 3, filename: 'shot_%r.png', size: '150x?' },
      ['shot_150x112_1.png', 'shot_150x112_2.png', 'shot_150x112_3.png']
    );

    testScreenshots(
      'a single screenshot should not have a _1 file name suffix',
      'no_suffix',
      { timemarks: [ 0.5 ] },
      ['tn.png']
    );
  });

  describe('saveToFile', function() {
    it('should save the output file properly to disk', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertToFile.flv');
      this.files.push(testFile);

      this.getCommand({ source: this.testfile, logger: testhelper.logger })
        .usingPreset('flashvideo')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          fs.exists(testFile, function(exist) {
            exist.should.equal(true);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);

              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should save an output file with special characters properly to disk', function(done) {
      var testFile = path.join(__dirname, 'assets', 'te[s]t video \' " .flv');
      this.files.push(testFile);

      this.getCommand({ source: this.testfile, logger: testhelper.logger })
        .usingPreset('flashvideo')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          done();
        })
        .saveToFile(testFile);
    });

    it('should save output files with special characters', function(done) {
      var testFile = path.join(__dirname, 'assets', '[test "special \' char*cters \n.flv');
      this.files.push(testFile);

      this.getCommand({ source: this.testfile, logger: testhelper.logger })
        .usingPreset('flashvideo')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          fs.exists(testFile, function(exist) {
            exist.should.equal(true);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should accept a stream as its source', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertFromStreamToFile.flv');
      this.files.push(testFile);

      var instream = fs.createReadStream(this.testfile);
      this.getCommand({ source: instream, logger: testhelper.logger })
        .usingPreset('flashvideo')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          fs.exists(testFile, function(exist) {
            exist.should.equal(true);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .saveToFile(testFile);
    });
  });

  describe('mergeToFile', function() {

    it('should merge multiple files', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testMergeAddOption.wav');
      this.files.push(testFile);

      this.getCommand({source: this.testfileaudio1, logger: testhelper.logger})
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          fs.exists(testFile, function(exist) {
            exist.should.equal(true);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .mergeAdd(this.testfileaudio2)
        .mergeAdd(this.testfileaudio3)
        .mergeToFile(testFile);
    });
  });

  describe('writeToStream', function() {
    it('should save the output file properly to disk using a stream', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertToStream.flv');
      this.files.push(testFile);

      var outstream = fs.createWriteStream(testFile);
      this.getCommand({ source: this.testfile, logger: testhelper.logger })
        .usingPreset('flashvideo')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function(stdout, stderr) {
          fs.exists(testFile, function(exist) {
            if (!exist) {
              console.log(stderr);
            }

            exist.should.equal(true);

            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .writeToStream(outstream, {end:true});
    });

    it('should accept a stream as its source', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertFromStreamToStream.flv');
      this.files.push(testFile);

      var instream = fs.createReadStream(this.testfile);
      var outstream = fs.createWriteStream(testFile);

      this.getCommand({ source: instream, logger: testhelper.logger })
        .usingPreset('flashvideo')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function(stdout,stderr) {
          fs.exists(testFile, function(exist) {
            if (!exist) {
              console.log(stderr);
            }

            exist.should.equal(true);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .writeToStream(outstream);
    });

    (process.version.match(/v0\.8\./) ? it.skip : it)('should return a PassThrough stream when called with no arguments on node >=0.10', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertToStream.flv');
      this.files.push(testFile);

      var outstream = fs.createWriteStream(testFile);
      var command = this.getCommand({ source: this.testfile, logger: testhelper.logger });

      command
        .usingPreset('flashvideo')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function(stdout, stderr) {
          fs.exists(testFile, function(exist) {
            if (!exist) {
              console.log(stderr);
            }

            exist.should.equal(true);

            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        });

      var passthrough = command.writeToStream({end: true});

      passthrough.should.instanceof(stream.PassThrough);
      passthrough.pipe(outstream);
    });

    (process.version.match(/v0\.8\./) ? it : it.skip)('should throw an error when called with no arguments on node 0.8', function() {
      (function() {
        new FfmpegCommand().writeToStream({end: true});
      }).should.throw(/PassThrough stream is not supported on node v0.8/);
    });
  });

  describe('Outputs', function() {
    it('should create multiple outputs', function(done) {
      this.timeout(30000);

      var testFile1 = path.join(__dirname, 'assets', 'testMultipleOutput1.avi');
      this.files.push(testFile1);
      var testFile2 = path.join(__dirname, 'assets', 'testMultipleOutput2.avi');
      this.files.push(testFile2);
      var testFile3 = path.join(__dirname, 'assets', 'testMultipleOutput3.mp4');
      this.files.push(testFile3);

      this.getCommand({ source: this.testfilebig, logger: testhelper.logger })
        .output(testFile1)
        .withAudioCodec('vorbis')
        .withVideoCodec('copy')
        .output(testFile2)
        .withAudioCodec('libmp3lame')
        .withVideoCodec('copy')
        .output(testFile3)
        .withSize('160x120')
        .withAudioCodec('aac')
        .withVideoCodec('libx264')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          async.map(
            [testFile1, testFile2, testFile3],
            function(file, cb) {
              fs.exists(file, function(exist) {
                exist.should.equal(true);

                // check filesize to make sure conversion actually worked
                fs.stat(file, function(err, stats) {
                  assert.ok(!err && stats);
                  stats.size.should.above(0);
                  stats.isFile().should.equal(true);

                  cb(err);
                });
              });
            },
            function(err) {
              testhelper.logError(err);
              assert.ok(!err);
              done();
            }
          );
        })
        .run();
    });
  });

  describe('Inputs', function() {
    it('should take input from a file with special characters', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testSpecialInput.flv');
      this.files.push(testFile);

      this.getCommand({ source: this.testfilespecial, logger: testhelper.logger, timeout: 10 })
        .takeFrames(50)
        .usingPreset('flashvideo')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          fs.exists(testFile, function(exist) {
            exist.should.equal(true);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .saveToFile(testFile);
    });
  });

  describe('Remote I/O', function() {
    this.timeout(60000);

    var ffserver;

    before(function(done) {
      testhelper.logger.debug('spawning ffserver');
      ffserver = spawn(
        'ffserver',
        ['-d','-f', path.join(__dirname, 'assets', 'ffserver.conf')],
        { cwd: path.join(__dirname, 'assets') }
      );

      // Wait for ffserver to be ready
      var isready = false;
      function ready() {
        if (!isready) {
          testhelper.logger.debug('ffserver is ready');
          isready = true;
          done();
        }
      }

      ffserver.stdout.on('data', function(d) {
        if (d.toString().match(/server started/i)) {
          ready();
        }
      });

      ffserver.stderr.on('data', function(d) {
        if (d.toString().match(/server started/i)) {
          ready();
        }
      });

    });

    beforeEach(function(done) {
      setTimeout(done, 5000);
    });

    after(function(done) {
      ffserver.kill();
      setTimeout(done, 1000);
    });

    it('should take input from a RTSP stream', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testRTSPInput.flv');
      this.files.push(testFile);

      this.getCommand({ source: encodeURI(testRTSP), logger: testhelper.logger, timeout: 0 })
        .takeFrames(10)
        .usingPreset('flashvideo')
        .withSize('320x240')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          fs.exists(testFile, function(exist) {
            exist.should.equal(true);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should take input from an URL', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testURLInput.flv');
      this.files.push(testFile);

      this.getCommand({ source: testHTTP, logger: testhelper.logger, timeout: 0 })
        .takeFrames(5)
        .usingPreset('flashvideo')
        .withSize('320x240')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          fs.exists(testFile, function(exist) {
            exist.should.equal(true);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should output to a RTP stream', function(done) {
      this.getCommand({ source: this.testfilebig, logger: testhelper.logger })
        .videoCodec('libx264')
        .audioCodec('copy')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          done();
        })
        .save(testRTPOut);
    });
  });

  describe('Errors', function() {
    it('should report an error when ffmpeg has been killed', function(done) {
      this.timeout(10000);

      var testFile = path.join(__dirname, 'assets', 'testErrorKill.flv');
      this.files.push(testFile);

      var command = this.getCommand({ source: this.testfilebig, logger: testhelper.logger });

      command
        .usingPreset('flashvideo')
        .on('start', function() {
          setTimeout(function() {
            command.kill('SIGKILL');
          }, 1000);
        })
        .on('error', function(err) {
          err.message.should.match(/ffmpeg was killed with signal SIGKILL/);
          done();
        })
        .on('end', function() {
          assert.ok(false);
        })
        .saveToFile(testFile);
    });

    it('should report ffmpeg errors', function(done) {
      this.getCommand({ source: this.testfilebig, logger: testhelper.logger })
        .addOption('-invalidoption')
        .on('error', function(err) {
          err.message.should.match(/Unrecognized option 'invalidoption'/);
          done();
        })
        .saveToFile('/will/not/be/created/anyway');
    });
  });
});
