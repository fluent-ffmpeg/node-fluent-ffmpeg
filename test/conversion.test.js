var ffmpeg = require('../lib/fluent-ffmpeg'),
  path = require('path'),
  fs = require('fs'),
  testCase = require('nodeunit').testCase,
  exec = require('child_process').exec;

module.exports = testCase({
  setUp: function(callback) {
    // check for ffmpeg installation
    this.testfile = __dirname + '/assets/testvideo-43.avi';
    this.testfilewide = __dirname + '/assets/testvideo-169.avi';
    var self = this;
    exec('which ffmpeg', function(err, stdout, stderr) {
      if (stdout != '') {
        // check if file exists
        path.exists(self.testfile, function(exists) {
          if (exists) {
            callback();
          } else {
            callback(new Error('test video file does not exist, check path (' + self.testfile + ')'));
          }
        });
      } else {
        callback(new Error('cannot run test without ffmpeg installed, aborting test...'));
      }
    });
  },
  testConvertToFile: function(test) {
    test.expect(5);
    var testFile = __dirname + '/assets/testConvertToFile.flv';
    var args = new ffmpeg(this.testfile)
      .usingPreset('flashvideo')
      .renice(19)
      .saveToFile(testFile, function(stdout, stderr, err) {
        test.ok(!err);
        path.exists(testFile, function(exist) {
          test.ok(exist);
          // check filesize to make sure conversion actually worked
          fs.stat(testFile, function(err, stats) {
            test.ok(!err && stats);
            test.ok(stats.size > 0);
            test.ok(stats.isFile());
            // unlink file
            fs.unlinkSync(testFile);
            test.done();
          });
        })
      });
  },
  testConvertToStream: function(test) {
    test.expect(4);
    var testFile = __dirname + '/assets/testConvertToStream.flv';
    var outstream = fs.createWriteStream(testFile);
    var args = new ffmpeg(this.testfile)
      .usingPreset('flashvideo')
      .renice(19)
      .writeToStream(outstream, function(code, stderr) {
        path.exists(testFile, function(exist) {
          test.ok(exist);
          // check filesize to make sure conversion actually worked
          fs.stat(testFile, function(err, stats) {
            test.ok(!err);
            test.ok(stats.size > 0);
            test.ok(stats.isFile());            
            // unlink file after waiting half a second (delayed writedown when using customFds)
            fs.unlinkSync(testFile);
            test.done();
          });
        })
      });
  },
  testConvertFromStream: function(test) {
    var instream = fs.createReadStream(this.testfile);
    var testFile = __dirname + '/assets/testConvertFromStream.flv';
    test.expect(4);
    var args = new ffmpeg(instream)
      .usingPreset('flashvideo')
      .renice(19)
      .saveToFile(testFile, function(stderr, stdout, err) {
        path.exists(testFile, function(exist) {
          // check filesize to make sure conversion actually worked
          test.ok(exist);
          fs.stat(testFile, function(err, stats) {
            test.ok(!err);
            test.ok(stats.size > 0);
            test.ok(stats.isFile());
            // unlink file
            fs.unlinkSync(testFile);
            test.done();
          });
        })
      });
  },
  testTakeScreenshots: function(test) {
    test.expect(2);
    var testFolder = __dirname + '/assets/tntest';
    var self = this;
    fs.mkdir(testFolder, '0755', function(err) {
      var args = new ffmpeg(self.testfile)
        .withSize('150x?')
      	.renice(19)
        .takeScreenshots(2, testFolder, function(err) {
          test.ok(err == null);
          fs.readdir(testFolder, function(err, files) {
            var tnCount = 0;
            files.forEach(function(file) {
              if (file.indexOf('.jpg') > -1) {
                tnCount++;
                fs.unlinkSync(testFolder + '/' + file);
              }
            });
            test.ok(tnCount === 2);
            // remove folder
            fs.rmdirSync(testFolder);
            test.done();
          });
        });
    });
  },
  testTakeScreenshotsConfig: function(test) {
    test.expect(2);
    var testFolder = __dirname + '/assets/tntest_config';
    var self = this;
    fs.mkdir(testFolder, '0755', function(err) {
      var args = new ffmpeg(self.testfile)
        .withSize('150x?')
      	.renice(19)
        .takeScreenshots({
          count: 2,
          timemarks: [ '0.5', '1' ]
        }, testFolder, function(err) {
          test.ok(err == null);
          fs.readdir(testFolder, function(err, files) {
            var tnCount = 0;
            files.forEach(function(file) {
              if (file.indexOf('.jpg') > -1) {
                tnCount++;
                fs.unlinkSync(testFolder + '/' + file);
              }
            });
            test.ok(tnCount === 2);
            // remove folder
            fs.rmdirSync(testFolder);
            test.done();
          });
        });
    });
  },
  testConvertAspectWithAutopaddingTo43: function(test) {
    var testFile = __dirname + '/assets/testConvertAspectTo43.avi';

    var args = new ffmpeg(this.testfilewide)
      .withAspect('4:3')
      .withSize('640x480')
      .applyAutopadding(true, 'black')
      .renice(19)
      .saveToFile(testFile, function(stdout, stderr, err) {
        if (err && err.message.indexOf('padding') > -1) {
          // padding is not supported, skip test
          test.done();
        } else {
          test.expect(5);
          test.ok(!err);
          path.exists(testFile, function(exist) {
            test.ok(exist);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              test.ok(!err);
              test.ok(stats.size > 0);
              test.ok(stats.isFile());
              // unlink file
              fs.unlinkSync(testFile);
              test.done();
            });
          });
        }
      });
  },
  testConvertAspectWithAutopaddingTo169: function(test) {
    var testFile = __dirname + '/assets/testConvertAspectTo169.avi';
    var args = new ffmpeg(this.testfile)
      .withAspect('16:9')
      .withSize('720x?')
      .applyAutopadding(true, 'black')
      .renice(19)
      .saveToFile(testFile, function(stdout, stderr, err) {
        if (err && err.message.indexOf('padding') > -1) {
          // padding is not supported, skip test
          test.done();
        } else {
          test.expect(5);
          test.ok(!err);
          path.exists(testFile, function(exist) {
            test.ok(exist);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, function(err, stats) {
              test.ok(!err);
              test.ok(stats.size > 0);
              test.ok(stats.isFile());
              // unlink file
              fs.unlinkSync(testFile);
              test.done();
            });
          });
        }
      });
  },
  testCodecDataNotification: function(test) {
    test.expect(5);
    var testFile = __dirname + '/assets/testConvertToFile.flv';
    var f = new ffmpeg(this.testfile)
      .onCodecData(function(codecinfo) {
        test.ok(codecinfo.video.indexOf('mpeg4') > -1);
      })
      .usingPreset('flashvideo')
      .saveToFile(testFile, function(stdout, stderr, err) {
        test.ok(!err);
        path.exists(testFile, function(exist) {
          test.ok(exist);
          // check filesize to make sure conversion actually worked
          fs.stat(testFile, function(err, stats) {
            test.ok(!err);
            test.ok(stats.size > 0);
            // unlink file
            fs.unlinkSync(testFile);
            test.done();
          });
        })
      });
  }
});