var Ffmpeg = require('../lib/fluent-ffmpeg'),
  path = require('path'),
  assert = require('assert'),
  exec = require('child_process').exec;

suite('fluent-ffmpeg', function() {
  setup(function(done) {
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

  suite('#getCommand', function() {
    test('should compile simple arguments into command correctly', function(done) {
      var proc = new Ffmpeg({ source: this.testfile, nolog: true })
        .withVideoBitrate(1024)
        .withVideoCodec('divx')
        .withAudioBitrate('128k')
        .toFormat('avi')
        .getCommand('file', function(cmd, err) {
          assert.ok(!err && cmd, 'execution for getCommand failed');
          assert.ok(cmd.indexOf('-b 1024k') > -1, 'bitrate does not match');
          assert.ok(cmd.indexOf('-ab 128k') > -1, 'audio bitrate does not match');
          assert.ok(cmd.indexOf('-f avi') > -1, 'output format does not match');
          assert.ok(cmd.indexOf('-vcodec divx') > -1, 'video codec does not match');
          done();
        });
    });
    test('should compile custom options into command correctly', function(done) {
      var proc = new Ffmpeg({ source: this.testfile, nolog: true })
        .addOption('-flags')
        .addOptions([ '+chroma', '+mixed_refs', '-qcomp 0.6' ])
        .toFormat('avi')
        .getCommand('file', function(cmd, err) {
          assert.ok(!err && cmd, 'execution for getCommand failed');      
          assert.ok(cmd.indexOf('-flags') > -1, '-flags parameter missing');
          assert.ok(cmd.indexOf('+chroma') > -1, '+chroma parameter missing');
          assert.ok(cmd.indexOf('+mixed_refs') > -1, '+mixed_refs parameter missing');
          assert.ok(cmd.indexOf('-qcomp 0.6') > -1, '-qcomp does not match');
          done();
        });
    });
    test('should load options from preset correctly', function(done) {
      var args = new Ffmpeg({ source: this.testfile, nolog: true })
      .usingPreset('podcast')
      .getArgs(function(args) {
        assert.ok(args.length > 1, 'preset yielded no arguments');
        done();
      });
    });
    test('should allow preset arguments to be overridden', function(done) {
      var proc = new Ffmpeg({ source: this.testfile, nolog: true })
        .usingPreset('podcast')
        .withSize('1024x768')
        .getCommand('file', function(cmd, err) {   
          assert.ok(!err && cmd, 'execution for getCommand failed');
          assert.ok(cmd.indexOf('-s 1024x768') > -1, 'video frame size does not match');
          done();
        });
    });
    test('should automatically calculate missing dimension arguments', function(done) {
      var proc = new Ffmpeg({ source: this.testfile, nolog: true })
        .withSize('?x140')
        .getCommand('file', function(cmd, err) {
          assert.ok(!err && cmd, 'execution for getCommand failed');
          assert.ok(cmd.indexOf('-s 186x140') > -1, 'video frame size does not match');
          done();
        });
    });
    test('should automatically calculate dimensions on a percent base', function(done) {
      var proc = new Ffmpeg({ source: this.testfile, nolog: true })
        .withSize('50%')
        .getCommand('file', function(cmd, err) {
          assert.ok(!err && cmd, 'execution for getCommand failed');
          assert.ok(cmd.indexOf('-s 512x384') > -1, 'video frame size does not match');
          done();
        });
    });
    test('should correctly determine padding when auto-padding is active (16:9)', function(done) {
      var proc = new Ffmpeg({ source: this.testfile, nolog: true })
        .withAspect('16:9')
        .withSize('960x?')
        .applyAutopadding(true)
        .getCommand('file', function(cmd, err) {
          if (err && err.message.indexOf('padding') > -1) {
            // padding is not supported, skip test
            done();
          } else {
            assert.ok(!err && cmd, 'execution for getCommand failed');
            assert.ok(cmd.indexOf('-vf pad=960:540') > -1, 'padding filter is missing');
            done();
          }
        });
    });
    test('should correctly determine padding when auto-passing is active (4:3)', function(done) {
      var proc = new Ffmpeg({ source: this.testfilewide, nolog: true })
        .withAspect('4:3')
        .withSize('640x?')
        .applyAutopadding(true)
        .getCommand('file', function(cmd, err) {
          if (err && err.message.indexOf('padding') > -1) {
            // padding is not supported, skip test
            done();
          } else {
            assert.ok(!err && cmd, 'execution for getCommand failed');
            assert.ok(cmd.indexOf('-vf pad=640:480') > -1, 'padding filter is missing');
            done();
          }
        });
    });
  });
});