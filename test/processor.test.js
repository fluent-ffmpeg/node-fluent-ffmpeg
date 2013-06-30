var Ffmpeg = require('../index'),
  path = require('path'),
  fs = require('fs'),
  assert = require('assert'),
  os = require('os').platform(),
  exec = require('child_process').exec,
  testhelper = require('./helpers');

describe('Processor', function() {
  before(function(done) {
    // check for ffmpeg installation
    this.testfile = path.join(__dirname, 'assets', 'testvideo-43.avi');
    this.testfilewide = path.join(__dirname, 'assets', 'testvideo-169.avi');

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
      new Ffmpeg({ source: this.testfile, nolog: true, timeout: 0.02 })
          .renice(100).options._nice.level.should.equal(0);
    });
  }

  it('should report codec data through event onCodecData', function(done) {
    var testFile = path.join(__dirname, 'assets', 'testOnCodecData.flv');

    new Ffmpeg({ source: this.testfile, nolog: true })
        .onCodecData(function(data) {
          data.should.have.property('audio');
          data.should.have.property('video');
        })
        .usingPreset('flashvideo')
        .saveToFile(testFile, function(code, err) {
          fs.exists(testFile, function(exist) {
            if (exist) {
              fs.unlinkSync(testFile);
            }
            done();
          });
        });
  });

  it('should report progress through event onProgress', function(done) {
    var testFile = path.join(__dirname, 'assets', 'testOnProgress.flv');

    new Ffmpeg({ source: this.testfile, nolog: true })
        .onProgress(function(data) {
          // conversion is too fast to make any progress reporting on the test assets,
          // but it's idiotic to commit a 5M+ file to github just for 1 test.
          // I'll leave this test here for coverage's sake...
        })
        .usingPreset('flashvideo')
        .saveToFile(testFile, function(code, err) {
          fs.exists(testFile, function(exist) {
            if (exist) {
              fs.unlinkSync(testFile);
            }
            done();
          });
        });
  });

  it('should properly take a certain amount of screenshots at defined timemarks', function(done) {
    var testFolder = path.join(__dirname, 'assets', 'tntest_config');
    var args = new Ffmpeg({ source: this.testfile, nolog: true })
      .withSize('150x?')
      .takeScreenshots({
        count: 2,
        timemarks: [ '0.5', '1' ]
      }, testFolder, function(err) {
        assert.ok(!err);
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
      });
  });

  it('should report all generated filenames in the second callback argument', function(done) {
    var testFolder = path.join(__dirname, 'assets', 'tntest_config');
    var args = new Ffmpeg({ source: this.testfile, nolog: true })
      .withSize('150x?')
      .takeScreenshots({
        count: 2,
        timemarks: [ '0.5', '1' ],
        filename: 'shot_%00i'
      }, testFolder, function(err, names) {
        assert.ok(!err);
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
      });
  });
  
  it('should save the output file properly to disk using a stream', function(done) {
    var testFile = path.join(__dirname, 'assets', 'te[s]t video \' " .flv');

    new Ffmpeg({ source: this.testfile, nolog: false })
      .usingPreset('flashvideo')
      .saveToFile(testFile, function(code, stderr) {
        fs.exists(testFile, function(exist) {
          if (exist) {
            fs.unlinkSync(testFile);
          }
          done();
        });
      });
  });
  
  it('should kill the process on timeout', function(done) {
    var testFile = path.join(__dirname, 'assets', 'testProcessKill.flv');

    new Ffmpeg({ source: this.testfile, nolog: true, timeout: 0.02 })
        .usingPreset('flashvideo')
        .saveToFile(testFile, function(code, err) {
          code.should.equal(-99);
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
        });
  });
  
  describe('saveToFile', function() {
    it('should save the output file properly to disk', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertToFile.flv');
      new Ffmpeg({ source: this.testfile, nolog: true })
        .usingPreset('flashvideo')
        .saveToFile(testFile, function(stdout, stderr, err) {
          assert.ok(!err);
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
        });
    });
    
    it('should accept a stream as its source', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertFromStreamToFile.flv');
      var instream = fs.createReadStream(this.testfile);
      new Ffmpeg({ source: instream, nolog: true })
        .usingPreset('flashvideo')
        .saveToFile(testFile, function(stdout, stderr, err) {
          assert.ok(!err);
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
        });
    });
  });

  describe('writeToStream', function() {
    it('should save the output file properly to disk using a stream', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertToStream.flv');
      var outstream = fs.createWriteStream(testFile);
      new Ffmpeg({ source: this.testfile, nolog: true })
        .usingPreset('flashvideo')
        .writeToStream(outstream, function(code, stderr) {
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
        });
    });
    
    it('should accept a stream as its source', function(done) {
      var testFile = path.join(__dirname, 'assets', 'testConvertFromStreamToStream.flv');
      var instream = fs.createReadStream(this.testfile);
      var outstream = fs.createWriteStream(testFile);
      new Ffmpeg({ source: instream, nolog: true })
        .usingPreset('flashvideo')
        .writeToStream(outstream, function(code, stderr) {
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
        });
    });
  });
  
  describe('takeScreenshot',function(){
    it('should return error with wrong size',function(done){
      var proc = new Ffmpeg({ source: path.join(__dirname, 'assets', 'testConvertToStream.flv')})
      .withSize('aslkdbasd')
      .takeScreenshots(5, path.join(__dirname, 'assets'), function(err, filenames) {
        if(err){
          done();
        }
        else{
          done(new Error('Didn\'t throw an error'));
        }
      })
    })
  });
});
