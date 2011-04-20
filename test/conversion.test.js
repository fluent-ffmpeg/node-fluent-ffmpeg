var ffmpeg = require('../lib/fluent-ffmpeg'),
  path = require('path'),
  fs = require('fs'),
  testCase = require('nodeunit').testCase,
  exec = require('child_process').exec;

module.exports = testCase({
  setUp: function(callback) {
    // check for ffmpeg installation
    this.testfile = __dirname + '/assets/testvideo.avi';
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
      .saveToFile(testFile, function(stdout, stderr, err) {
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
        })
      });
  },
  testConvertToStream: function(test) {
    test.expect(4);
    var testFile = __dirname + '/assets/testConvertToStream.flv';
    var outstream = fs.createWriteStream(testFile);
    var args = new ffmpeg(this.testfile)
      .usingPreset('flashvideo')
      .writeToStream(outstream, function(code, stderr) {
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
        })
      });
  },
  testConvertFromStream: function(test) {
    var instream = fs.createReadStream(this.testfile);
    var testFile = __dirname + '/assets/testConvertFromStream.flv';
    test.expect(3);
    var args = new ffmpeg(instream)
      .usingPreset('flashvideo')
      .saveToFile(testFile, function(stderr, stdout, err) {
        path.exists(testFile, function(exist) {
          // check filesize to make sure conversion actually worked
          if (exist) {
            fs.stat(testFile, function(err, stats) {
              test.ok(!err);
              test.ok(stats.size > 0);
              test.ok(stats.isFile());
              // unlink file
              fs.unlinkSync(testFile);
              test.done();
            });
          } else {
            test.done();
          }
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
  }
});