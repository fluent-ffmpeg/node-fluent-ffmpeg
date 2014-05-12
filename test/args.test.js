var Ffmpeg = require('../index'),
  path = require('path'),
  fs = require('fs'),
  assert = require('assert'),
  exec = require('child_process').exec,
  testhelper = require('./helpers');

describe('Command', function() {
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

  describe('usingPreset', function() {
    it('should properly generate the command for the requested preset', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .usingPreset('podcast')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.length.should.equal(44); // on a side note: it's 42 args by coincidence ;)
                                        // on a side note: not anymore, sorry :(
          done();
        });
    });

    it('should properly generate the command for the requested preset in custom folder', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true, preset: path.join(__dirname, 'assets', 'presets') })
        .usingPreset('custompreset')
        .getArgs(function(args) {
          args.length.should.equal(44);

        done();
      })
    });

    it('should allow using functions as presets', function(done) {
      var presetArg;

      function presetFunc(command) {
        presetArg = command;
        command.withVideoCodec('libx264');
        command.withAudioFrequency(22050);
      }

      var cmd = new Ffmpeg({ source: this.testfile, logger: testhelper.logger });

      cmd
        .usingPreset(presetFunc)
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          presetArg.should.equal(cmd);
          args.join(' ').indexOf('-vcodec libx264').should.not.equal(-1);
          args.join(' ').indexOf('-ar 22050').should.not.equal(-1);

          done();
        });
    });

    it('should throw an exception when a preset it not found', function() {
      (function() {
        new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
          .usingPreset('NOTFOUND');
      }).should.throw(/^preset NOTFOUND could not be loaded/);
    });
  });

  describe('withNoVideo', function() {
    it('should apply the skip video argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withNoVideo()
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-vn').should.above(-1);
          done();
        });
    });
    it('should skip any video transformation options', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('320x?')
        .withNoVideo()
        .withAudioBitrate('256k')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-vn').should.above(-1);
          args.indexOf('-s').should.equal(-1);
          args.indexOf('-b:a').should.above(-1);
          done();
        });
    });
  });

  describe('withNoAudio', function() {
    it('should apply the skip audio argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withNoAudio()
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-an').should.above(-1);
          done();
        });
    });
    it('should skip any audio transformation options', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withAudioChannels(2)
        .withNoAudio()
        .withSize('320x?')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-an').should.above(-1);
          args.indexOf('-ac').should.equal(-1);
          args.indexOf('scale=320:trunc(ow/a/2)*2').should.above(-1);
          done();
        });
    });
  });

  describe('withVideoBitrate', function() {
    it('should apply default bitrate argument by default', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withVideoBitrate('256k')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-b:v').should.above(-1);
          done();
        });
    });
    it('should apply additional bitrate arguments for constant bitrate', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withVideoBitrate('256k', true)
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-b:v').should.above(-1);
          args.indexOf('-maxrate').should.above(-1);;
          args.indexOf('-minrate').should.above(-1);
          args.indexOf('-bufsize').should.above(-1);
          done();
        });
    });
  });

  describe('withMultiFile', function() {
    it('should allow image2 multi-file input format', function(done) {
      new Ffmpeg({ source: 'image-%05d.png', logger: testhelper.logger })
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-i').should.above(-1);
          args.indexOf('image-%05d.png').should.above(-1);
          done();
        });
    });
  });

  describe('withFps', function() {
    it('should apply the rate argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withFps(27.77)
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-r').should.above(-1);
          args.indexOf(27.77).should.above(-1);
          done();
        });
    });
  });

  describe('addingAdditionalInput', function() {
    it('should allow for additional inputs', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .addInput('soundtrack.mp3')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-i').should.above(-1);
          args.indexOf('soundtrack.mp3').should.above(-1);
          done();
        });
    });
  });

  describe('withVideoCodec', function() {
    it('should apply the video codec argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withVideoCodec('libx264')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-vcodec').should.above(-1);
          args.indexOf('libx264').should.above(-1);
          done();
        });
    });
  });

  describe('withVideoFilter', function() {
    it('should apply the video filter argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withVideoFilter('scale=123:456')
        .withVideoFilter('pad=1230:4560:100:100:yellow')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-filter:v').should.above(-1);
          args.indexOf('scale=123:456,pad=1230:4560:100:100:yellow').should.above(-1);
          done();
        });
    });
  })

  describe('withAudioBitrate', function() {
    it('should apply the audio bitrate argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withAudioBitrate(256)
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-b:a').should.above(-1);
          args.indexOf('256k').should.above(-1);
          done();
        });
    });
  });

  describe('loop', function() {
    it('should add the -loop 1 argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .loop()
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          if(args.indexOf('-loop') != -1 || args.indexOf('-loop_output') != -1){
            done();
          }
          else{
            done(new Error("args should contain loop or loop_output"))
          }
        });
    });
    it('should add the -loop 1 and a time argument (seconds)', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .loop(120)
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          if(args.indexOf('-loop') != -1 || args.indexOf('-loop_output') != -1){
            args.indexOf('-t').should.above(-1);
            args.indexOf(120).should.above(-1);
            done();
          }
          else{
            done(new Error("args should contain loop or loop_output"))
          }

        });
    });
    it('should add the -loop 1 and a time argument (timemark)', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .loop('00:06:46.81')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          if(args.indexOf('-loop') != -1 || args.indexOf('-loop_output') != -1){
            args.indexOf('-t').should.above(-1);
            args.indexOf('00:06:46.81').should.above(-1);
            done();
          }
          else{
            done(new Error("args should contain loop or loop_output"))
          }
        });
    });
  });

  describe('takeFrames', function() {
    it('should add the -vframes argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .takeFrames(250)
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-vframes').should.above(-1);
          args.indexOf(250).should.above(-1);
          done();
        });
    });
  });

  describe('withAudioCodec', function() {
    it('should apply the audio codec argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withAudioCodec('mp3')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-acodec').should.above(-1);
          args.indexOf('mp3').should.above(-1);
          done();
        });
    });
  });

  describe('withAudioFilter', function() {
    it('should apply the audio filter argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withAudioFilter('silencedetect=n=-50dB:d=5')
        .withAudioFilter('volume=0.5')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-filter:a').should.above(-1);
          args.indexOf('silencedetect=n=-50dB:d=5,volume=0.5').should.above(-1);
          done();
        });
    });
  })

  describe('withAudioChannels', function() {
    it('should apply the audio channels argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withAudioChannels(1)
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-ac').should.above(-1);
          args.indexOf(1).should.above(-1);
          done();
        });
    });
  });

  describe('withAudioFrequency', function() {
    it('should apply the audio frequency argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withAudioFrequency(22500)
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-ar').should.above(-1);
          args.indexOf(22500).should.above(-1);
          done();
        });
    });
  });

  describe('withAudioQuality', function() {
    it('should apply the audio quality argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withAudioQuality(5)
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-aq').should.above(-1);
          args.indexOf(5).should.above(-1);
          done();
        });
    });
  });

  describe('setStartTime', function() {
    it('should apply the start time offset argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .setStartTime('00:00:10')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-ss').should.above(-1);
          args.indexOf('00:00:10').should.above(-1);
          done();
        });
    });
  });

  describe('setDuration', function() {
    it('should apply the record duration argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .setDuration(10)
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-t').should.above(-1);
          args.indexOf(10).should.above(-1);
          done();
        });
    });
  });

  describe('addOption(s)', function() {
    it('should apply a single option', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .addOption('-ab', '256k')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-ab').should.above(-1);
          args.indexOf('256k').should.above(-1);
          done();
        });
    });
    it('should apply supplied extra options', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .addOptions(['-flags', '+loop', '-cmp', '+chroma', '-partitions','+parti4x4+partp8x8+partb8x8'])
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-flags').should.above(-1);
          args.indexOf('+loop').should.above(-1);
          args.indexOf('-cmp').should.above(-1);
          args.indexOf('+chroma').should.above(-1);
          args.indexOf('-partitions').should.above(-1);
          args.indexOf('+parti4x4+partp8x8+partb8x8').should.above(-1);
          done();
        });
    });
    it('should apply a single input option', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .addInputOption('-r', '29.97')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          var joined = args.join(' ');
          joined.indexOf('-r 29.97').should.above(-1).and.below(joined.indexOf('-i '));
          done();
        });
    });
    it('should apply multiple input options', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .addInputOptions(['-r 29.97', '-f ogg'])
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          var joined = args.join(' ');
          joined.indexOf('-r 29.97').should.above(-1).and.below(joined.indexOf('-i'));
          joined.indexOf('-f ogg').should.above(-1).and.below(joined.indexOf('-i'));
          done();
        });
    });
  });

  describe('withInputNativeFrameRate', function() {
    it('should apply -re flag as first argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger, inputNativeFramerate: true })
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-re').should.equal(0);
          done();
        });
    });
  });
  
  describe('toFormat', function() {
    it('should apply the target format', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .toFormat('mp4')
        .getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-f').should.above(-1);
          args.indexOf('mp4').should.above(-1);
          done();
        });
    });
  });

  describe('Size calculations', function() {
    it('Should add scale and setsar filters when keepPixelAspect was called', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .keepPixelAspect(true)
        .getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=\'w=if(gt(sar,1),iw*sar,iw):h=if(lt(sar,1),ih/sar,ih)\'');
      filters[1].should.equal('setsar=1');
    });

    it('Should not add scale filters when withSize was not called', function() {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .getSizeFilters().length.should.equal(0);

      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withAspect(4/3)
        .getSizeFilters().length.should.equal(0);

      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .applyAutopadding(true, 'white')
        .getSizeFilters().length.should.equal(0);
    });

    it('Should add proper scale filter when withSize was called with a percent value', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('42%')
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=trunc(iw*0.42/2)*2:trunc(ih*0.42/2)*2');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('42%')
        .withAspect(4/3)
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=trunc(iw*0.42/2)*2:trunc(ih*0.42/2)*2');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('42%')
        .applyAutopadding(true, 'white')
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=trunc(iw*0.42/2)*2:trunc(ih*0.42/2)*2');
    });

    it('Should add proper scale filter when withSize was called with a fixed size', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x200')
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=100:200');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x200')
        .withAspect(4/3)
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=100:200');
    });

    it('Should add proper scale filter when withSize was called with a "?" and no aspect ratio is specified', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x?')
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=100:trunc(ow/a/2)*2');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x?')
        .applyAutopadding(true, 'white')
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=100:trunc(ow/a/2)*2');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('?x200')
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=trunc(oh*a/2)*2:200');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('?x200')
        .applyAutopadding(true, 'white')
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=trunc(oh*a/2)*2:200');
    });

    it('Should add proper scale filter when withSize was called with a "?" and an aspect ratio is specified', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x?')
        .withAspect(0.5)
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=100:200');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('?x100')
        .withAspect(2)
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=200:100');
    });

    it('Should add scale and pad filters when withSize was called with a "?", aspect ratio and auto padding are specified', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x?')
        .withAspect(0.5)
        .applyAutopadding(true, 'white')
        .getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=\'w=if(gt(a,0.5),100,trunc(200*a/2)*2):h=if(lt(a,0.5),200,trunc(100/a/2)*2)\'');
      filters[1].should.equal('pad=\'w=100:h=200:x=if(gt(a,0.5),0,(100-iw)/2):y=if(lt(a,0.5),0,(200-ih)/2):color=white\'');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('?x100')
        .withAspect(2)
        .applyAutopadding(true, 'white')
        .getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=\'w=if(gt(a,2),200,trunc(100*a/2)*2):h=if(lt(a,2),100,trunc(200/a/2)*2)\'');
      filters[1].should.equal('pad=\'w=200:h=100:x=if(gt(a,2),0,(200-iw)/2):y=if(lt(a,2),0,(100-ih)/2):color=white\'');
    });

    it('Should add scale and pad filters when withSize was called with a fixed size and auto padding is specified', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x200')
        .applyAutopadding(true, 'white')
        .getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=\'w=if(gt(a,0.5),100,trunc(200*a/2)*2):h=if(lt(a,0.5),200,trunc(100/a/2)*2)\'');
      filters[1].should.equal('pad=\'w=100:h=200:x=if(gt(a,0.5),0,(100-iw)/2):y=if(lt(a,0.5),0,(200-ih)/2):color=white\'');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x200')
        .withAspect(4/3)
        .applyAutopadding(true, 'white')
        .getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=\'w=if(gt(a,0.5),100,trunc(200*a/2)*2):h=if(lt(a,0.5),200,trunc(100/a/2)*2)\'');
      filters[1].should.equal('pad=\'w=100:h=200:x=if(gt(a,0.5),0,(100-iw)/2):y=if(lt(a,0.5),0,(200-ih)/2):color=white\'');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('200x100')
        .applyAutopadding(true, 'white')
        .getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=\'w=if(gt(a,2),200,trunc(100*a/2)*2):h=if(lt(a,2),100,trunc(200/a/2)*2)\'');
      filters[1].should.equal('pad=\'w=200:h=100:x=if(gt(a,2),0,(200-iw)/2):y=if(lt(a,2),0,(100-ih)/2):color=white\'');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('200x100')
        .withAspect(4/3)
        .applyAutopadding(true, 'white')
        .getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=\'w=if(gt(a,2),200,trunc(100*a/2)*2):h=if(lt(a,2),100,trunc(200/a/2)*2)\'');
      filters[1].should.equal('pad=\'w=200:h=100:x=if(gt(a,2),0,(200-iw)/2):y=if(lt(a,2),0,(100-ih)/2):color=white\'');
    });

    it('Should round sizes to multiples of 2', function() {
      var filters;
      var aspect = 102/202;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('101x201')
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=102:202');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('101x201')
        .applyAutopadding(true, 'white')
        .getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=\'w=if(gt(a,' + aspect + '),102,trunc(202*a/2)*2):h=if(lt(a,' + aspect + '),202,trunc(102/a/2)*2)\'');
      filters[1].should.equal('pad=\'w=102:h=202:x=if(gt(a,' + aspect + '),0,(102-iw)/2):y=if(lt(a,' + aspect + '),0,(202-ih)/2):color=white\'');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('101x?')
        .withAspect('1:2')
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=102:202');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('?x201')
        .withAspect('1:2')
        .getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=102:202');
    });
  });
});
