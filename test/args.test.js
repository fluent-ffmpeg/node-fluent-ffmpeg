var Ffmpeg = require('../index'),
  path = require('path'),
  exec = require('child_process').exec;

describe('Command', function() {
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

  describe('usingPreset', function() {
    it('should properly generate the command for the requested preset', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .usingPreset('podcast')
        .getArgs(function(args) {
          args.length.should.equal(42); // on a side note: it's 42 args by coincidence ;)
          done();
        });
    });
    it('should throw an exception when a preset it not found', function() {
      (function() {
        new Ffmpeg({ source: this.testfile, nolog: true })
          .usingPreset('NOTFOUND');
      }).should.throw(/^preset NOTFOUND could not be loaded/);
    });
  });

  describe('withNoVideo', function() {
    it('should apply the skip video argument', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withNoVideo()
        .getArgs(function(args) {
          args.indexOf('-vn').should.above(-1);
          done();
        });
    });
    it('should skip any video transformation options', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withSize('320x?')
        .withNoVideo()
        .withAudioBitrate('256k')
        .getArgs(function(args) {
          args.indexOf('-vn').should.above(-1);
          args.indexOf('-s').should.equal(-1);
          args.indexOf('-ab').should.above(-1);
          done();
        });
    });
  });

  describe('withNoAudio', function() {
    it('should apply the skip audio argument', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withNoAudio()
        .getArgs(function(args) {
          args.indexOf('-an').should.above(-1);
          done();
        });
    });
    it('should skip any audio transformation options', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withAudioChannels(2)
        .withNoAudio()
        .withSize('320x?')
        .getArgs(function(args) {
          args.indexOf('-an').should.above(-1);
          args.indexOf('-ac').should.equal(-1);
          args.indexOf('-s').should.above(-1);
          done();
        });
    });
  });

  describe('withVideoBitrate', function() {
    it('should apply default bitrate argument by default', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withVideoBitrate('256k')
        .getArgs(function(args) {
          args.indexOf('-b').should.above(-1);
          done();
        });
    });
    it('should apply additional bitrate arguments for CONSTANT_BITRATE', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withVideoBitrate('256k', Ffmpeg.CONSTANT_BITRATE)
        .getArgs(function(args) {
          args.indexOf('-b').should.above(-1);
          args.indexOf('-maxrate').should.above(-1);;
          args.indexOf('-minrate').should.above(-1);
          args.indexOf('-bufsize').should.above(-1);
          done();
        });
    });
  });

  describe('withSize', function() {
    it('should calculate the missing size part (height)', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withSize('320x?')
        .getArgs(function(args) {
          args.indexOf('320x240').should.above(-1);
          done();
        });
    });
    it('should calculate the missing size part (width)', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withSize('?x480')
        .getArgs(function(args) {
          args.indexOf('640x480').should.above(-1);
          done();
        });
    });
    it('should calculate the size based on a percentage', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withSize('50%')
        .getArgs(function(args) {
          args.indexOf('512x384').should.above(-1);
          done();
        });
    });
  });

  describe('applyAutopadding', function() {
    it('should apply color if provided', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withAspect('16:9')
        .applyAutopadding(true, 'red')
        .getArgs(function(args, err) {
          if (err) {
            done(err);
          } else {
            args.indexOf('-vf').should.above(-1);
            args.indexOf('pad=1024:768:128:0:red').should.above(-1);
            done();
          }
        });
    });
    it('should calculate the correct size for output video stream', function(done) {
      new Ffmpeg({ source: this.testfilewide, nolog: true })
        .withAspect('4:3')
        .applyAutopadding(true)
        .getArgs(function(args, err) {
          if (err) {
            done(err);
          } else {
            args.indexOf('1280x540').should.above(-1);
            args.indexOf('-vf').should.above(-1);
            args.indexOf('pad=1280:720:0:90:black').should.above(-1);
            done();
          }
        });
    });
    it('should calculate the correct aspect ratio if omitted in favor of size', function(done) {
      new Ffmpeg({ source: this.testfilewide, nolog: true })
        .withSize('640x480')
        .applyAutopadding(true)
        .getArgs(function(args, err) {
          if (err) {
            done(err);
          } else {
            args.indexOf('-vf').should.above(-1);
            args.indexOf('pad=640:480:0:60:black').should.above(-1);
            done();
          }
        });
    });
    it('should calculate size if a fixed width and an aspect ratio is provided', function(done) {
      new Ffmpeg({ source: this.testfilewide, nolog: true })
        .withSize('640x?')
        .withAspect('4:3')
        .applyAutopadding(true)
        .getArgs(function(args, err) {
          if (err) {
            done(err);
          } else {
            args.indexOf('-vf').should.above(-1);
            args.indexOf('pad=640:480:0:60:black').should.above(-1);
            done();
          }
        });
    });

    it('should calculate size if a fixed height and an aspect ratio is provided', function(done) {
      new Ffmpeg({ source: this.testfilewide, nolog: true })
        .withSize('?x480')
        .withAspect('4:3')
        .applyAutopadding(true)
        .getArgs(function(args, err) {
          if (err) {
            done(err);
          } else {
            args.indexOf('-vf').should.above(-1);
            args.indexOf('pad=640:480:0:60:black').should.above(-1);
            done();
          }
        });
    });
  });

  describe('withFps', function() {
    it('should apply the rate argument', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withFps(27.77)
        .getArgs(function(args) {
          args.indexOf('-r').should.above(-1);
          args.indexOf(27.77).should.above(-1);
          done();
        });
    });
  });

  describe('withAspect', function() {
    it('should apply the aspect ratio argument', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withAspect('16:9')
        .getArgs(function(args) {
          args.indexOf('-aspect').should.above(-1);
          args.indexOf('16:9').should.above(-1);
          done();
        });
    });
  });

  describe('withVideCodec', function() {
    it('should apply the video codec argument', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withVideoCodec('divx')
        .getArgs(function(args) {
          args.indexOf('-vcodec').should.above(-1);
          args.indexOf('divx').should.above(-1);
          done();
        });
    });
  });

  describe('withAudioBitrate', function() {
    it('should apply the audio bitrate argument', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withAudioBitrate(256)
        .getArgs(function(args) {
          args.indexOf('-ab').should.above(-1);
          args.indexOf('256k').should.above(-1);
          done();
        });
    });
  });

  describe('withAudioCodec', function() {
    it('should apply the audio codec argument', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withAudioCodec('mp3')
        .getArgs(function(args) {
          args.indexOf('-acodec').should.above(-1);
          args.indexOf('mp3').should.above(-1);
          done();
        });
    });
  });

  describe('withAudioChannels', function() {
    it('should apply the audio channels argument', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withAudioChannels(1)
        .getArgs(function(args) {
          args.indexOf('-ac').should.above(-1);
          args.indexOf(1).should.above(-1);
          done();
        });
    });
  });

  describe('withAudioFrequency', function() {
    it('should apply the audio frequency argument', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withAudioFrequency(22500)
        .getArgs(function(args) {
          args.indexOf('-ar').should.above(-1);
          args.indexOf(22500).should.above(-1);
          done();
        });
    });
  });

  describe('withAudioQuality', function() {
    it('should apply the audio quality argument', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .withAudioQuality(5)
        .getArgs(function(args) {
          args.indexOf('-aq').should.above(-1);
          args.indexOf(5).should.above(-1);
          done();
        });
    });
  });

  describe('setStartTime', function() {
    it('should apply the start time offset argument', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .setStartTime('00:00:10')
        .getArgs(function(args) {
          args.indexOf('-ss').should.above(-1);
          args.indexOf('00:00:10').should.above(-1);
          done();
        });
    });
  });

  describe('setDuration', function() {
    it('should apply the record duration argument', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .setDuration(10)
        .getArgs(function(args) {
          args.indexOf('-t').should.above(-1);
          args.indexOf(10).should.above(-1);
          done();
        });
    });
  });

  describe('addOption(s)', function() {
    it('should apply a single option', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .addOption('-ab', '256k')
        .getArgs(function(args) {
          args.indexOf('-ab').should.above(-1);
          args.indexOf('256k').should.above(-1);
          done();
        });
    });
    it('should apply supplied extra options', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .addOptions(['-flags', '+loop', '-cmp', '+chroma', '-partitions','+parti4x4+partp8x8+partb8x8'])
        .getArgs(function(args) {
          args.indexOf('-flags').should.above(-1);
          args.indexOf('+loop').should.above(-1);
          args.indexOf('-cmp').should.above(-1);
          args.indexOf('+chroma').should.above(-1);
          args.indexOf('-partitions').should.above(-1);
          args.indexOf('+parti4x4+partp8x8+partb8x8').should.above(-1);
          done();
        });
    });
  });

  describe('toFormat', function() {
    it('should apply the target format', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true })
        .toFormat('mp4')
        .getArgs(function(args) {
          args.indexOf('-f').should.above(-1);
          args.indexOf('mp4').should.above(-1);
          done();
        });
    });
  });
});
