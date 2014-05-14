var FfmpegCommand = require('../index'),
  path = require('path'),
  fs = require('fs'),
  assert = require('assert'),
  os = require('os').platform(),
  exec = require('child_process').exec,
  async = require('async'),
  stream = require('stream'),
  testhelper = require('./helpers');


var testHTTP = 'http://www.wowza.com/_h264/BigBuckBunny_115k.mov?test with=space';
var testRTSP = 'rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov?test with=spa ce';
var testRTMP = 'rtmp://cp67126.edgefcs.net/ondemand/mp4:mediapm/ovp/content/test/video/spacealonehd_sounas_640_300.mp4';


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
    this.testfilespecial = path.join(__dirname, 'assets', 'te[s]t\\ video \' " .flv');
    this.testfileaudio1 = path.join(__dirname, 'assets', 'testaudio-one.wav');
    this.testfileaudio2 = path.join(__dirname, 'assets', 'testaudio-two.wav');
    this.testfileaudio3 = path.join(__dirname, 'assets', 'testaudio-three.wav');

    var self = this;

    exec(testhelper.getFfmpegCheck(), function(err, stdout, stderr) {
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

    // Tests should call this so that created processes are watched
    // for exit and checked during test cleanup
    this.getCommand = function(args) {
      cmd = new FfmpegCommand(args);
      cmd.on('start', function() {
        processes.push(cmd.ffmpegProc);

        // Remove process when it exits
        cmd.ffmpegProc.on('exit', function() {
          processes.splice(processes.indexOf(cmd.ffmpegProc), 1);
        });
      });

      return cmd;
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
          .usingPreset('flashvideo')

      var startCalled = false;
      var reniced = false;

      ffmpegJob
          .on('start', function() {
            startCalled = true;
            setTimeout(function() {
              ffmpegJob.renice(5);

              setTimeout(function() {
                exec('ps -p ' + ffmpegJob.ffmpegProc.pid + ' -o ni=', function(err, stdout, stderr) {
                  assert.ok(!err);
                  parseInt(stdout).should.equal(5);
                  reniced = true;
                });
              }, 500);
            }, 500);

            ffmpegJob.ffmpegProc.on('exit', function() {
              reniced.should.be.true;
              done();
            });
          })
          .on('error', function(err) {
            reniced.should.be.true;
            startCalled.should.be.true;
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

      var command = this.getCommand({ source: this.testfilebig, logger: testhelper.logger, timeout: 0.02 });

      command
          .usingPreset('flashvideo')
          .on('start', function() {
            command.ffmpegProc.on('exit', function() {
              done();
            });
          })
          .on('error', function(err) {
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
              errorCalled.should.be.true;
              done();
            });
          })
          .on('error', function(err) {
            err.message.indexOf('ffmpeg was killed with signal SIGKILL').should.not.equal(-1);
            startCalled.should.be.true;
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
              errorCalled.should.be.true;
              done();
            });
          })
          .on('error', function(err) {
            startCalled.should.be.true;
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

    it('should report progress through \'progress\' event', function(done) {
      this.timeout(60000)

      var testFile = path.join(__dirname, 'assets', 'testOnProgress.flv')
        , gotProgress = false;

      this.files.push(testFile);

      this.getCommand({ source: this.testfilebig, logger: testhelper.logger })
          .on('progress', function(data) {
            gotProgress = true;
          })
          .usingPreset('flashvideo')
          .on('error', function(err, stdout, stderr) {
            testhelper.logError(err, stdout, stderr);
            assert.ok(!err);
          })
          .on('end', function() {
            gotProgress.should.be.true;
            done();
          })
          .saveToFile(testFile);
    });

    it('should report start of ffmpeg process through \'start\' event', function(done) {
      this.timeout(60000)

      var testFile = path.join(__dirname, 'assets', 'testStart.flv')
        , startCalled = false;

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
            startCalled.should.be.true;
            done();
          })
          .saveToFile(testFile);
    });
  });

  describe('takeScreenshots', function() {
    it('should properly take a certain amount of screenshots at defined timemarks', function(done) {
      var testFolder = path.join(__dirname, 'assets', 'screenshots');

      this.files.push(path.join(testFolder, 'tn_0.5s_1.jpg'));
      this.files.push(path.join(testFolder, 'tn_1s_2.jpg'));
      this.dirs.push(testFolder);

      var args = this.getCommand({ source: this.testfile, logger: testhelper.logger })
        .withSize('150x?')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          fs.readdir(testFolder, function(err, files) {
            var tnCount = 0;
            files.forEach(function(file) {
              if (file.indexOf('.jpg') > -1) {
                tnCount++;
              }
            });
            tnCount.should.equal(2);
            done();
          });
        })
        .takeScreenshots({
          count: 2,
          timemarks: [ '0.5', '1' ]
        }, testFolder);
    });

    it('should report all generated filenames as an argument to the \'end\' event', function(done) {
      var testFolder = path.join(__dirname, 'assets', 'screenshots_end');

      this.files.push(path.join(testFolder, 'shot_001.jpg'));
      this.files.push(path.join(testFolder, 'shot_002.jpg'));
      this.dirs.push(testFolder);

      var args = this.getCommand({ source: this.testfile, logger: testhelper.logger })
        .withSize('150x?')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function(names) {
          names.length.should.equal(2);
          names[0].should.equal('shot_001.jpg');
          names[1].should.equal('shot_002.jpg');
          fs.readdir(testFolder, function(err, files) {
            var tnCount = 0;
            files.forEach(function(file) {
              if (file.indexOf('.jpg') > -1) {
                tnCount++;
              }
            });
            tnCount.should.equal(2);
            done();
          });
        })
        .takeScreenshots({
          count: 2,
          timemarks: [ '0.5', '1' ],
          filename: 'shot_%00i'
        }, testFolder);
    });
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
            exist.should.true;
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);

              stats.size.should.above(0);
              stats.isFile().should.true;

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
            exist.should.true;
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.true;

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
            exist.should.true;
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.true;

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

      var srcFile = path.join(__dirname, 'assets', 'testaudio-one.wav');
      var src1File = path.join(__dirname, 'assets', 'testaudio-two.wav');
      var src2File = path.join(__dirname, 'assets', 'testaudio-three.wav');

      this.getCommand({source: this.testfileaudio1, logger: testhelper.logger})
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          fs.exists(testFile, function(exist) {
            exist.should.true;
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.true;

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

            exist.should.true;

            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.true;

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

            exist.should.true;
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.true;

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

            exist.should.true;

            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.true;

              done();
            });
          });
        })

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
            exist.should.true;
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.true;

              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should take input from a RTSP stream', function(done) {
      this.timeout(300000);

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
            exist.should.true;
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.true;

              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should take input from a RTMP stream', function(done) {
      this.timeout(300000);

      var testFile = path.join(__dirname, 'assets', 'testRTMPInput.flv');
      this.files.push(testFile);

      this.getCommand({ source: encodeURI(testRTMP), logger: testhelper.logger, timeout: 0 })
        .takeFrames(10)
        .usingPreset('flashvideo')
        .withSize('320x240')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          fs.exists(testFile, function(exist) {
            exist.should.true;
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.true;

              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should take input from an URL', function(done) {
      this.timeout(300000);

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
            exist.should.true;
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.true;

              done();
            });
          });
        })
        .saveToFile(testFile);
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
