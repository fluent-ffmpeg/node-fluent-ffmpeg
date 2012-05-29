var metadata = require('../lib/fluent-ffmpeg').Metadata,
  exec = require('child_process').exec,
  path = require('path'),
  testCase = require('nodeunit').testCase;

module.exports = testCase({
  setUp: function (callback) {
    this.testfile = __dirname + '/assets/testvideo-43.avi';
    this.testfilewide = __dirname + '/assets/testvideo-169.avi';
    // check for ffmpeg installation
    var self = this;
    exec('which ffmpeg', function(err, stdout, stderr) {
      if (stdout !== '') {
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
  testGet: function(test) {
    test.expect(2);
    var meta = metadata.get(this.testfile, function(meta, err) {
      test.ok(meta, 'meta data is missing');
      test.ok(!err, 'error was raised');
      test.done();
    });
  },
  testTitle: function(test) {
    test.expect(3);
    var meta = metadata.get(this.testfile, function(meta, err) {
      test.ok(meta, 'meta data is missing');
      test.ok(!err, 'error was raised');
      test.ok(meta.title.toLowerCase() === "test title", "Cannot retrieve title");
      test.done();
    });
  },
  testTitleWhenEmpty: function(test) {
    test.expect(3);
    var meta = metadata.get(this.testfilewide, function(meta, err) {
      test.ok(meta, 'meta data is missing');
      test.ok(!err, 'error was raised');
      test.ok(!meta.title, "Title not empty");
      test.done();
    });
  }
});