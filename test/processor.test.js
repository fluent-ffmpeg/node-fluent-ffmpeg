var Ffmpeg = require('../index'),
  path = require('path'),
  fs = require('fs'),
  assert = require('assert'),
  os = require('os').platform(),
  exec = require('child_process').exec,
  testhelper = require('./helpers');

var testHTTP = 'http://www.wowza.com/_h264/BigBuckBunny_115k.mov?test with=space';
var testRTSP = 'rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov?test with=spa ce';
var testRTMP = 'rtmp://rtmp.jim.stream.vmmacdn.be/vmma-jim-rtmplive-live/jim';

describe('Processor', function() {
  before(function(done) {
    // check for ffmpeg installation
    this.testfile = path.join(__dirname, 'assets', 'testvideo-43.avi');
    this.testfilewide = path.join(__dirname, 'assets', 'testvideo-169.avi');
    this.testfilebig = path.join(__dirname, 'assets', 'testvideo-5m.mpg');
    this.testfilespecial = path.join(__dirname, 'assets', 'te[s]t\\ video \' " .flv');

    var self = this;
    exec(testhelper.getFfmpegCheck(), function(err, stdout, stderr) {
      if (!err) {
        // check if file exists
        fs.exists(self.testfile, function(exists) {
          if (exists) {
            done();
          } else {
            done(new Error('test video file does not exist, check path (' + self.testfile + ')'));
          }
        });
      } else {
        done(new Error('cannot run test without ffmpeg installed, aborting test...'));
      }
    });
  });

  if (!os.match(/win(32|64)/)) {
    it('should properly limit niceness', function() {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger, timeout: 0.02 })
          .renice(100).options._niceness.should.equal(0);
    });

    it('should dynamically renice process', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testProcessKill.flv');

      var ffmpegJob = new Ffmpeg({ source: this.testfilebig, logger: testhelper.logger, timeout: 2 })
          .usingPreset('flashvideo')

      ffmpegJob
          .on('error', function(err) {
            fs.exists(testFile, function(exist) {
              if (exist) {
                setTimeout(function() {
                  fs.unlink(testFile,function(){
                    done()
                  });
                }, 10);
              }
              else{
                console.log("no File: testProcessKill.flv");
                done();
              }
            });
          })
          .on('end', function() {
            console.log('end was called, expected a timeout');
            assert.ok(false);
            done();
          })
          .saveToFile(testFile);

      setTimeout(function() {
        ffmpegJob.renice(5);

        setTimeout(function() {
          exec("ps h p " + ffmpegJob.ffmpegProc.pid + " -o ni", function(err, stdout, stderr) {
            assert.ok(!err);
            parseInt(stdout).should.equal(5);
          });
        }, 500);
      }, 500);
    });
  }

  it('should report codec data through \'codecData\' event', function(done) {
    var testFile = path.join(__dirname, 'assets', 'testOnCodecData.flv');

    new Ffmpeg({ source: this.testfilebig, logger: testhelper.logger })
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
          fs.exists(testFile, function(exist) {
            if (exist) {
              fs.unlinkSync(testFile);
            }
            done();
          });
        })
        .saveToFile(testFile);
  });

  it('should report progress through \'progress\' event', function(done) {
    this.timeout(15000)

    var testFile = path.join(__dirname, 'assets', 'testOnProgress.flv')
      , gotProgress = false;

    new Ffmpeg({ source: this.testfilebig, logger: testhelper.logger })
        .on('progress', function(data) {
          gotProgress = true;
        })
        .usingPreset('flashvideo')
        .on('error', function(err, stdout, stderr) {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', function() {
          fs.exists(testFile, function(exist) {
            if (exist) {
              fs.unlinkSync(testFile);
            }

            gotProgress.should.be.true;
            done();
          });
        })
        .saveToFile(testFile);
  });

  it('should properly take a certain amount of screenshots at defined timemarks', function(done) {
    var testFolder = path.join(__dirname, 'assets', 'tntest_config');
    var args = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
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
              fs.unlinkSync(testFolder + '/' + file);
            }
          });
          tnCount.should.equal(2);
          // remove folder
          fs.rmdirSync(testFolder);
          done();
        });
      })
      .takeScreenshots({
        count: 2,
        timemarks: [ '0.5', '1' ]
      }, testFolder);
  });

  it('should report all generated filenames as an argument to the \'end\' event', function(done) {
    var testFolder = path.join(__dirname, 'assets', 'tntest_config');
    var args = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
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
              fs.unlinkSync(testFolder + '/' + file);
            }
          });
          tnCount.should.equal(2);
          // remove folder
          fs.rmdirSync(testFolder);
          done();
        });
      })
      .takeScreenshots({
        count: 2,
        timemarks: [ '0.5', '1' ],
        filename: 'shot_%00i'
      }, testFolder);
  });

  it('should save the output file properly to disk using a stream', function(done) {
    var testFile = path.join(__dirname, 'assets', 'te[s]t video \' " .flv');

    new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
      .usingPreset('flashvideo')
      .on('error', function(err, stdout, stderr) {
        testhelper.logError(err, stdout, stderr);
        assert.ok(!err);
      })
      .on('end', function() {
        fs.exists(testFile, function(exist) {
          if (exist) {
            fs.unlinkSync(testFile);
          }
          done();
        });
      })
      .saveToFile(testFile);
  });

  it('should kill the process on timeout', function(done) {
    var testFile = path.join(__dirname, 'assets', 'testProcessKill.flv');

    new Ffmpeg({ source: this.testfilebig, logger: testhelper.logger, timeout: 0.02 })
        .usingPreset('flashvideo')
        .on('error', function(err) {
          err.message.indexOf('timeout').should.not.equal(-1);

          fs.exists(testFile, function(exist) {
            if (exist) {
              setTimeout(function() {
                fs.unlink(testFile,function(){
                  done()
                });
              }, 10);
            }
            else{
              console.log("no File: testProcessKill.flv");
              done();
            }
          });
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

    var ffmpegJob = new Ffmpeg({ source: this.testfilebig, logger: testhelper.logger, timeout: 0 })
        .usingPreset('flashvideo');

    ffmpegJob
        .on('error', function(err) {
          err.message.indexOf('ffmpeg was killed with signal SIGKILL').should.not.equal(-1);

          fs.exists(testFile, function(exist) {
            if (exist) {
              setTimeout(function() {
                fs.unlink(testFile,function(){
                  done()
                });
              }, 10);
            }
            else{
              console.log("no File: testProcessKill.flv");
              done();
            }
          });
        })
        .on('end', function() {
          console.log('end was called, expected an error');
          assert.ok(false);
          done();
        })
        .saveToFile(testFile);

    setTimeout(function() { ffmpegJob.kill(); }, 500);
  });

  it('should send the process custom signals with .kill(signal)', function(done) {
    var testFile = path.join(__dirname, 'assets', 'testProcessKill.flv');

    var ffmpegJob = new Ffmpeg({ source: this.testfilebig, logger: testhelper.logger, timeout: 1 })
        .usingPreset('flashvideo');

    ffmpegJob
        .on('error', function(err) {
          err.message.indexOf('timeout').should.not.equal(-1);

          fs.exists(testFile, function(exist) {
            if (exist) {
              setTimeout(function() {
                fs.unlink(testFile,function(){
                  done()
                });
              }, 10);
            }
            else{
              console.log("no File: testProcessKill.flv");
              done();
            }
          });
        })
        .on('end', function() {
          console.log('end was called, expected a timeout');
          assert.ok(false);
          done();
        })
        .saveToFile(testFile);

    setTimeout(function() { ffmpegJob.kill('SIGSTOP'); }, 20);
  });

  describe('saveToFile', function() {
    it('should save the output file properly to disk', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertToFile.flv');
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
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
              // unlink file
              fs.unlinkSync(testFile);
              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should save output files with special characters', function(done) {
      var testFile = path.join(__dirname, 'assets', '[test "special \' char*cters \n.flv');
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
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
              // unlink file
              fs.unlinkSync(testFile);
              done();
            });
          });
        })
        .saveToFile(testFile);
    })

    it('should accept a stream as its source', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertFromStreamToFile.flv');
      var instream = fs.createReadStream(this.testfile);
      new Ffmpeg({ source: instream, logger: testhelper.logger })
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
              // unlink file
              fs.unlinkSync(testFile);
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
      var srcFile = path.join(__dirname, 'assets', 'testaudio-one.wav');
      var src1File = path.join(__dirname, 'assets', 'testaudio-two.wav');
      var src2File = path.join(__dirname, 'assets', 'testaudio-three.wav');

      new Ffmpeg({source: srcFile, logger: testhelper.logger})
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
              // unlink file
              fs.unlinkSync(testFile);
              done();
            });
          });
        })
        .mergeAdd(src1File)
        .mergeAdd(src2File)
        .mergeToFile(testFile);
    });
  });

  describe('writeToStream', function() {
    it('should save the output file properly to disk using a stream', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertToStream.flv');
      var outstream = fs.createWriteStream(testFile);
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
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
              // unlink file
              fs.unlinkSync(testFile);
              done();
            });
          });
        })
        .writeToStream(outstream, {end:true});
    });

    it('should accept a stream as its source', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertFromStreamToStream.flv');
      var instream = fs.createReadStream(this.testfile);
      var outstream = fs.createWriteStream(testFile);
      new Ffmpeg({ source: instream, logger: testhelper.logger })
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
              // unlink file
              fs.unlinkSync(testFile);
              done();
            });
          });
        })
        .writeToStream(outstream);
    });
  });

  describe('takeScreenshot',function(){
    it('should return error with wrong size',function(done){
      var proc = new Ffmpeg({ source: path.join(__dirname, 'assets', 'testConvertToStream.flv'), logger: testhelper.logger })
      .withSize('aslkdbasd')
      .on('error', function(err) {
        assert.ok(!!err);
        done();
      })
      .on('end', function() {
        console.log('end was emitted, expected error');
        assert.ok(false);
        done();
      })
      .takeScreenshots(5, path.join(__dirname, 'assets'));
    });
  });

  describe('inputs', function() {
    it('should take input from a file with special characters', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertToFile.flv');
      new Ffmpeg({ source: this.testfilespecial, logger: testhelper.logger, timeout: 10 })
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
              // unlink file
              fs.unlinkSync(testFile);
              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should take input from a RTSP stream', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertToFile.flv');
      new Ffmpeg({ source: encodeURI(testRTSP), logger: testhelper.logger, timeout: 0 })
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
              // unlink file
              fs.unlinkSync(testFile);
              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should take input from a RTMP stream', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertToFile.flv');
      new Ffmpeg({ source: encodeURI(testRTMP), logger: testhelper.logger, timeout: 0 })
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
              // unlink file
              fs.unlinkSync(testFile);
              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should take input from an URL', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertToFile.flv');
      new Ffmpeg({ source: testHTTP, logger: testhelper.logger, timeout: 0 })
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
              // unlink file
              fs.unlinkSync(testFile);
              done();
            });
          });
        })
        .saveToFile(testFile);
    });
  });
});
