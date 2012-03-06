var ffmpeg = require('../lib/fluent-ffmpeg'),
  path = require('path'),
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
  testSimpleArgs: function(test) {
    test.expect(5);
    var proc = new ffmpeg({ source: this.testfile })
      .withVideoBitrate(1024)
      .withVideoCodec('divx')
      .withAudioBitrate('128k')
      .toFormat('avi')
      .getCommand('file', function(cmd, err) {
        test.ok(!err && cmd, 'execution for getCommand failed');
        test.ok(cmd.indexOf('-b 1024k') > -1, 'bitrate does not match');
        test.ok(cmd.indexOf('-ab 128k') > -1, 'audio bitrate does not match');
        test.ok(cmd.indexOf('-f avi') > -1, 'output format does not match');
        test.ok(cmd.indexOf('-vcodec divx') > -1, 'video codec does not match');
        test.done();
      });
  },
  testComplexArgs: function(test) {
    test.expect(10);
    var proc = new ffmpeg({ source: this.testfile })
      .withVideoBitrate(1024)
      .withVideoCodec('divx')
      .withAudioBitrate(256)
      .withAudioChannels(2)
      .addOption('-flags')
      .addOptions([ '+chroma', '+mixed_refs', '-qcomp 0.6' ])
      .toFormat('avi')
      .getCommand('file', function(cmd, err) {
        test.ok(!err && cmd, 'execution for getCommand failed');
        test.ok(cmd.indexOf('-b 1024k') > -1, 'bitrate does not match');
        test.ok(cmd.indexOf('-f avi') > -1, 'output format does not match');
        test.ok(cmd.indexOf('-vcodec divx') > -1, 'video codec does not match');
        test.ok(cmd.indexOf('-ab 256k') > -1, 'audio bitrate does not match');
        test.ok(cmd.indexOf('-ac 2') > -1, 'audio channels do not match');        
        test.ok(cmd.indexOf('-flags') > -1, '-flags parameter missing');
        test.ok(cmd.indexOf('+chroma') > -1, '+chroma parameter missing');
        test.ok(cmd.indexOf('+mixed_refs') > -1, '+mixed_refs parameter missing');
        test.ok(cmd.indexOf('-qcomp 0.6') > -1, '-qcomp does not match');
        test.done();
      });
  },
  testPreset: function(test) {
    test.expect(1);
    var args = new ffmpeg({ source: this.testfile })
      .usingPreset('podcast')
      .getArgs(function(args) {
        test.ok(args.length > 1, 'preset yielded no arguments');
        test.done();
      });  
  },
  testPresetOverride: function(test) {
    test.expect(2);
    var proc = new ffmpeg({ source: this.testfile })
      .usingPreset('podcast')
      .withSize('1024x768')
      .getCommand('file', function(cmd, err) {   
        test.ok(!err && cmd, 'execution for getCommand failed');
        test.ok(cmd.indexOf('-s 1024x768') > -1, 'video frame size does not match');
        test.done();
      });
    
  },
  testSizeCalculationFixed: function(test) {
    test.expect(2);
    var f = new ffmpeg({ source: this.testfile })
      .withSize('?x140')
      .getCommand('file', function(cmd, err) {
        test.ok(!err && cmd, 'execution for getCommand failed');
        test.ok(cmd.indexOf('-s 186x140') > -1, 'video frame size does not match');
        test.done();
      });
  },
  testSizeCalculationPercent: function(test) {
    test.expect(2);
    var f = new ffmpeg({ source: this.testfile })
      .withSize('50%')
      .getCommand('file', function(cmd, err) {
        test.ok(!err && cmd, 'execution for getCommand failed');
        test.ok(cmd.indexOf('-s 512x384') > -1, 'video frame size does not match');
        test.done();
      });
  },
  testSizeCalculationException: function(test) {
    test.expect(2);
    var f = new ffmpeg({ source: this.testfile })
      .withSize('120%')
      .getCommand('file', function(cmd, err) {
        test.ok(cmd == null, 'command was generated, although invalid video size was set');
        test.ok(err, 'no error returned, although invalid video size was set');
        test.done();
      });
  },
  testAutopadding43to169: function(test) {
    test.expect(2);
    var f = new ffmpeg({ source: this.testfile })
      .withAspect('16:9')
      .withSize('960x?')
      .applyAutopadding(true)
      .getCommand('file', function(cmd, err) {
        test.ok(!err && cmd, 'execution for getCommand failed');
        test.ok(cmd.indexOf('-vf pad=960:540') > -1, 'padding filter is missing');
        test.done();
      });
  },
  testAutopadding169to43: function(test) {
    test.expect(2);
    var f = new ffmpeg({ source: this.testfilewide })
      .withAspect('4:3')
      .withSize('640x480')
      .applyAutopadding(true)
      .getCommand('file', function(cmd, err) {
        test.ok(!err && cmd, 'execution for getCommand failed');
        test.ok(cmd.indexOf('-vf pad=640:480') > -1, 'padding filter is missing');
        test.done();
      });
  }
});