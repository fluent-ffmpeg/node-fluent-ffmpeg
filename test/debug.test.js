var Ffmpeg = require('../index'),
  path = require('path'),
  exec = require('child_process').exec;

describe('Debug', function() {
  before(function(done) {
    // check for ffmpeg installation
    this.testfile = __dirname + '/assets/testvideo-43.avi';
    this.testfilewide = __dirname + '/assets/testvideo-169.avi';

    var self = this;
    exec('which ffmpeg', function(err, stdout, stderr) {
      if (stdout !== '') {
        // check if file exists
        path.exists(self.testfile, function(exists) {
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

  describe('getArgs', function() {
    it('should properly return arguments in callback', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .usingPreset('podcast')
        .getArgs(function(args) {
          args.length.should.equal(42);
          done();
        });
    });
  });

  describe('getCommand', function() {
    it('should properly compile options into an ffmpeg command line call', function(done) {
      var self = this;
      new Ffmpeg({ source: this.testfile, nolog: true })
        .usingPreset('divx')
        .getCommand('file', function(cmd) {
          cmd.length.should.above(1);
          cmd.indexOf(self.testfile).should.above(-1);
          done();
        });
    });
  });
});
