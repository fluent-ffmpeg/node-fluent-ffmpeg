/*jshint node:true*/
/*global describe,it,before*/
'use strict';

var Ffmpeg = require('../index'),
  utils = require('../lib/utils'),
  path = require('path'),
  fs = require('fs'),
  assert = require('assert'),
  exec = require('child_process').exec,
  testhelper = require('./helpers');

Ffmpeg.prototype._test_getArgs = function(callback) {
  var args;

  try {
    args = this._getArguments();
  } catch(e) {
    return callback(null, e);
  }

  callback(args);
};

Ffmpeg.prototype._test_getSizeFilters = function() {
  return utils.makeFilterStrings(this._currentOutput.sizeFilters.get())
    .concat(this._currentOutput.videoFilters.get());
};


describe('Command', function() {
  before(function(done) {
    // check for ffmpeg installation
    this.testfile = path.join(__dirname, 'assets', 'testvideo-43.avi');
    this.testfilewide = path.join(__dirname, 'assets', 'testvideo-169.avi');

    var self = this;
    exec(testhelper.getFfmpegCheck(), function(err) {
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

  describe('Constructor', function() {
    it('should enable calling the constructor without new', function() {
      (Ffmpeg()).should.instanceof(Ffmpeg);
    });
  });

  describe('usingPreset', function() {
    it('should properly generate the command for the requested preset', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .usingPreset('podcast')
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.length.should.equal(42);
          done();
        });
    });

    it('should properly generate the command for the requested preset in custom folder', function(done) {
      new Ffmpeg({ source: this.testfile, nolog: true, preset: path.join(__dirname, 'assets', 'presets') })
        .usingPreset('custompreset')
        ._test_getArgs(function(args) {
          args.length.should.equal(42);

        done();
      });
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
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          presetArg.should.equal(cmd);
          args.join(' ').indexOf('-vcodec libx264').should.not.equal(-1);
          args.join(' ').indexOf('-ar 22050').should.not.equal(-1);

          done();
        });
    });

    it('should throw an exception when a preset is not found', function() {
      var self = this;

      (function() {
        new Ffmpeg({ source: self.testfile, logger: testhelper.logger })
          .usingPreset('NOTFOUND');
      }).should.throw(/NOTFOUND could not be loaded/);
    });

    it('should throw an exception when a preset has no load function', function() {
      (function() {
        new Ffmpeg({ presets: '../../lib' }).usingPreset('utils');
      }).should.throw(/has no load\(\) function/);
    });
  });

  describe('withNoVideo', function() {
    it('should apply the skip video argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withNoVideo()
        ._test_getArgs(function(args, err) {
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
        ._test_getArgs(function(args, err) {
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
        ._test_getArgs(function(args, err) {
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
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-an').should.above(-1);
          args.indexOf('-ac').should.equal(-1);
          args.indexOf('scale=w=320:h=trunc(ow/a/2)*2').should.above(-1);
          done();
        });
    });
  });

  describe('withVideoBitrate', function() {
    it('should apply default bitrate argument by default', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withVideoBitrate('256k')
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-b:v').should.above(-1);
          done();
        });
    });
    it('should apply additional bitrate arguments for constant bitrate', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withVideoBitrate('256k', true)
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-b:v').should.above(-1);
          args.indexOf('-maxrate').should.above(-1);
          args.indexOf('-minrate').should.above(-1);
          args.indexOf('-bufsize').should.above(-1);
          done();
        });
    });
  });

  describe('withMultiFile', function() {
    it('should allow image2 multi-file input format', function(done) {
      new Ffmpeg({ source: 'image-%05d.png', logger: testhelper.logger })
        ._test_getArgs(function(args, err) {
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
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-r').should.above(-1);
          args.indexOf(27.77).should.above(-1);
          done();
        });
    });
  });

  describe('withInputFPS', function() {
    it('should apply the rate argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withInputFPS(27.77)
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-r').should.above(-1).and.below(args.indexOf('-i'));
          args.indexOf(27.77).should.above(-1).and.below(args.indexOf('-i'));
          done();
        });
    });
  });

  describe('native', function() {
    it('should apply the native framerate argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .native()
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-re').should.above(-1).and.below(args.indexOf('-i'));
          done();
        });
    });
  });

  describe('addingAdditionalInput', function() {
    it('should allow for additional inputs', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .addInput('soundtrack.mp3')
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-i').should.above(-1);
          args.indexOf('soundtrack.mp3').should.above(-1);
          done();
        });
    });

    it('should fail to add invalid inputs', function() {
      (function() {
        new Ffmpeg().addInput({});
      }).should.throw(/Invalid input/);
    });

    it('should refuse to add more than 1 input stream', function() {
      var stream1 = fs.createReadStream(this.testfile);
      var stream2 = fs.createReadStream(this.testfilewide);
      var command = new Ffmpeg().addInput(stream1);

      (function() {
        command.addInput(stream2);
      }).should.throw(/Only one input stream is supported/);
    });

    it('should fail on input-related options when no input was added', function() {
      (function() {
        new Ffmpeg().inputFormat('avi');
      }).should.throw(/No input specified/);

      (function() {
        new Ffmpeg().inputFps(24);
      }).should.throw(/No input specified/);

      (function() {
        new Ffmpeg().seekInput(1);
      }).should.throw(/No input specified/);

      (function() {
        new Ffmpeg().loop();
      }).should.throw(/No input specified/);

      (function() {
        new Ffmpeg().inputOptions('-anoption');
      }).should.throw(/No input specified/);
    });
  });

  describe('withVideoCodec', function() {
    it('should apply the video codec argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withVideoCodec('libx264')
        ._test_getArgs(function(args, err) {
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
        .withVideoFilter('multiple=1', 'filters=2')
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-filter:v').should.above(-1);
          args.indexOf('scale=123:456,pad=1230:4560:100:100:yellow,multiple=1,filters=2').should.above(-1);
          done();
        });
    });

    it('should accept filter arrays', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withVideoFilter(['multiple=1', 'filters=2'])
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-filter:v').should.above(-1);
          args.indexOf('multiple=1,filters=2').should.above(-1);
          done();
        });
    });

    it('should enable using filter objects', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withVideoFilter(
          {
            filter: 'option_string',
            options: 'opt1=value1:opt2=value2'
          },
          {
            filter: 'unnamed_options',
            options: ['opt1', 'opt2']
          },
          {
            filter: 'named_options',
            options: {
              opt1: 'value1',
              opt2: 'value2'
            }
          }
        )
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-filter:v').should.above(-1);
          args.indexOf('option_string=opt1=value1:opt2=value2,unnamed_options=opt1:opt2,named_options=opt1=value1:opt2=value2').should.above(-1);
          done();
        });
    });
  });

  describe('withAudioBitrate', function() {
    it('should apply the audio bitrate argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withAudioBitrate(256)
        ._test_getArgs(function(args, err) {
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
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          if(args.indexOf('-loop') != -1 || args.indexOf('-loop_output') != -1){
            done();
          }
          else{
            done(new Error('args should contain loop or loop_output'));
          }
        });
    });
    it('should add the -loop 1 and a time argument (seconds)', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .loop(120)
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          if(args.indexOf('-loop') != -1 || args.indexOf('-loop_output') != -1){
            args.indexOf('-t').should.above(-1);
            args.indexOf('120').should.above(-1);
            done();
          }
          else{
            done(new Error('args should contain loop or loop_output'));
          }

        });
    });
    it('should add the -loop 1 and a time argument (timemark)', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .loop('00:06:46.81')
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          if(args.indexOf('-loop') != -1 || args.indexOf('-loop_output') != -1){
            args.indexOf('-t').should.above(-1);
            args.indexOf('00:06:46.81').should.above(-1);
            done();
          }
          else{
            done(new Error('args should contain loop or loop_output'));
          }
        });
    });
  });

  describe('takeFrames', function() {
    it('should add the -vframes argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .takeFrames(250)
        ._test_getArgs(function(args, err) {
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
        ._test_getArgs(function(args, err) {
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
        .withAudioFilter('multiple=1', 'filters=2')
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-filter:a').should.above(-1);
          args.indexOf('silencedetect=n=-50dB:d=5,volume=0.5,multiple=1,filters=2').should.above(-1);
          done();
        });
    });

    it('should accept filter arrays', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withAudioFilter(['multiple=1', 'filters=2'])
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-filter:a').should.above(-1);
          args.indexOf('multiple=1,filters=2').should.above(-1);
          done();
        });
    });

    it('should enable using filter objects', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withAudioFilter(
          {
            filter: 'option_string',
            options: 'opt1=value1:opt2=value2'
          },
          {
            filter: 'unnamed_options',
            options: ['opt1', 'opt2']
          },
          {
            filter: 'named_options',
            options: {
              opt1: 'value1',
              opt2: 'value2'
            }
          }
        )
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-filter:a').should.above(-1);
          args.indexOf('option_string=opt1=value1:opt2=value2,unnamed_options=opt1:opt2,named_options=opt1=value1:opt2=value2').should.above(-1);
          done();
        });
    });
  });

  describe('withAudioChannels', function() {
    it('should apply the audio channels argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withAudioChannels(1)
        ._test_getArgs(function(args, err) {
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
        ._test_getArgs(function(args, err) {
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
        ._test_getArgs(function(args, err) {
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
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-ss').should.above(-1).and.below(args.indexOf('-i'));
          args.indexOf('00:00:10').should.above(args.indexOf('-ss')).and.below(args.indexOf('-i'));
          done();
        });
    });

    it('should apply start time converted from scientific notation (0)', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .setStartTime(1e-15)
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);
          args.indexOf('-ss').should.equal(args.indexOf('0') - 1);
          done();
        });
    });

    it('should apply start time converted from scientific notation (nonzero)', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .setStartTime(1.234567e-9)
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);
          args.indexOf('-ss').should.equal(args.indexOf('0.0000000012') - 1);
          done();
        });
    });
  });

  describe('setDuration', function() {
    it('should apply the record duration argument', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .setDuration(10)
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-t').should.above(-1);
          args.indexOf('10').should.above(-1);
          done();
        });
    });

    it('should apply duration converted from scientific notation (0)', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .setDuration(1e-15)
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);
          args.indexOf('-t').should.equal(args.indexOf('0') - 1);
          done();
        });
    });

    it('should apply duration converted from scientific notation (nonzero)', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .setDuration(1.234567e-9)
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);
          args.indexOf('-t').should.equal(args.indexOf('0.0000000012') - 1);
          done();
        });
    });
  });

  describe('addOption(s)', function() {
    it('should apply a single option', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .addOption('-ab', '256k')
        ._test_getArgs(function(args, err) {
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
        .addOptions('-single option')
        .addOptions('-multiple', '-options')
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-flags').should.above(-1);
          args.indexOf('+loop').should.above(-1);
          args.indexOf('-cmp').should.above(-1);
          args.indexOf('+chroma').should.above(-1);
          args.indexOf('-partitions').should.above(-1);
          args.indexOf('+parti4x4+partp8x8+partb8x8').should.above(-1);
          args.indexOf('-single').should.above(-1);
          args.indexOf('option').should.above(-1);
          args.indexOf('-multiple').should.above(-1);
          args.indexOf('-options').should.above(-1);
          done();
        });
    });
    it('should apply a single input option', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .addInputOption('-r', '29.97')
        ._test_getArgs(function(args, err) {
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
        .addInputOptions('-single option')
        .addInputOptions('-multiple', '-options')
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          var joined = args.join(' ');
          joined.indexOf('-r 29.97').should.above(-1).and.below(joined.indexOf('-i'));
          joined.indexOf('-f ogg').should.above(-1).and.below(joined.indexOf('-i'));
          joined.indexOf('-single option').should.above(-1).and.below(joined.indexOf('-i'));
          joined.indexOf('-multiple').should.above(-1).and.below(joined.indexOf('-i'));
          joined.indexOf('-options').should.above(-1).and.below(joined.indexOf('-i'));
          done();
        });
    });
  });

  describe('toFormat', function() {
    it('should apply the target format', function(done) {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .toFormat('mp4')
        ._test_getArgs(function(args, err) {
          testhelper.logArgError(err);
          assert.ok(!err);

          args.indexOf('-f').should.above(-1);
          args.indexOf('mp4').should.above(-1);
          done();
        });
    });
  });

  describe('Size calculations', function() {
    it('Should throw an error when an invalid aspect ratio is passed', function() {
      (function() {
        new Ffmpeg().aspect('blah');
      }).should.throw(/Invalid aspect ratio/);
    });

    it('Should add scale and setsar filters when keepPixelAspect was called', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .keepPixelAspect(true)
        ._test_getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=w=\'if(gt(sar,1),iw*sar,iw)\':h=\'if(lt(sar,1),ih/sar,ih)\'');
      filters[1].should.equal('setsar=1');
    });

    it('Should throw an error when an invalid size was requested', function() {
      (function() {
        new Ffmpeg().withSize('aslkdbasd');
      }).should.throw(/^Invalid size specified/);
    });

    it('Should not add scale filters when withSize was not called', function() {
      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        ._test_getSizeFilters().length.should.equal(0);

      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withAspect(4/3)
        ._test_getSizeFilters().length.should.equal(0);

      new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters().length.should.equal(0);
    });

    it('Should add proper scale filter when withSize was called with a percent value', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('42%')
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=trunc(iw*0.42/2)*2:h=trunc(ih*0.42/2)*2');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('42%')
        .withAspect(4/3)
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=trunc(iw*0.42/2)*2:h=trunc(ih*0.42/2)*2');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('42%')
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=trunc(iw*0.42/2)*2:h=trunc(ih*0.42/2)*2');
    });

    it('Should add proper scale filter when withSize was called with a fixed size', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x200')
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=100:h=200');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x200')
        .withAspect(4/3)
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=100:h=200');
    });

    it('Should add proper scale filter when withSize was called with a "?" and no aspect ratio is specified', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x?')
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=100:h=trunc(ow/a/2)*2');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x?')
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=100:h=trunc(ow/a/2)*2');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('?x200')
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=trunc(oh*a/2)*2:h=200');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('?x200')
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=trunc(oh*a/2)*2:h=200');
    });

    it('Should add proper scale filter when withSize was called with a "?" and an aspect ratio is specified', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x?')
        .withAspect(0.5)
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=100:h=200');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('?x100')
        .withAspect(2)
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=200:h=100');
    });

    it('Should add scale and pad filters when withSize was called with a "?", aspect ratio and auto padding are specified', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x?')
        .withAspect(0.5)
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=w=\'if(gt(a,0.5),100,trunc(200*a/2)*2)\':h=\'if(lt(a,0.5),200,trunc(100/a/2)*2)\'');
      filters[1].should.equal('pad=w=100:h=200:x=\'if(gt(a,0.5),0,(100-iw)/2)\':y=\'if(lt(a,0.5),0,(200-ih)/2)\':color=white');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('?x100')
        .withAspect(2)
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=w=\'if(gt(a,2),200,trunc(100*a/2)*2)\':h=\'if(lt(a,2),100,trunc(200/a/2)*2)\'');
      filters[1].should.equal('pad=w=200:h=100:x=\'if(gt(a,2),0,(200-iw)/2)\':y=\'if(lt(a,2),0,(100-ih)/2)\':color=white');
    });

    it('Should add scale and pad filters when withSize was called with a fixed size and auto padding is specified', function() {
      var filters;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x200')
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=w=\'if(gt(a,0.5),100,trunc(200*a/2)*2)\':h=\'if(lt(a,0.5),200,trunc(100/a/2)*2)\'');
      filters[1].should.equal('pad=w=100:h=200:x=\'if(gt(a,0.5),0,(100-iw)/2)\':y=\'if(lt(a,0.5),0,(200-ih)/2)\':color=white');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x200')
        .withAspect(4/3)
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=w=\'if(gt(a,0.5),100,trunc(200*a/2)*2)\':h=\'if(lt(a,0.5),200,trunc(100/a/2)*2)\'');
      filters[1].should.equal('pad=w=100:h=200:x=\'if(gt(a,0.5),0,(100-iw)/2)\':y=\'if(lt(a,0.5),0,(200-ih)/2)\':color=white');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('200x100')
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=w=\'if(gt(a,2),200,trunc(100*a/2)*2)\':h=\'if(lt(a,2),100,trunc(200/a/2)*2)\'');
      filters[1].should.equal('pad=w=200:h=100:x=\'if(gt(a,2),0,(200-iw)/2)\':y=\'if(lt(a,2),0,(100-ih)/2)\':color=white');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('200x100')
        .withAspect(4/3)
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=w=\'if(gt(a,2),200,trunc(100*a/2)*2)\':h=\'if(lt(a,2),100,trunc(200/a/2)*2)\'');
      filters[1].should.equal('pad=w=200:h=100:x=\'if(gt(a,2),0,(200-iw)/2)\':y=\'if(lt(a,2),0,(100-ih)/2)\':color=white');
    });

    it('Should round sizes to multiples of 2', function() {
      var filters;
      var aspect = 102/202;

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('101x201')
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=102:h=202');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('101x201')
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      filters.length.should.equal(2);
      filters[0].should.equal('scale=w=\'if(gt(a,' + aspect + '),102,trunc(202*a/2)*2)\':h=\'if(lt(a,' + aspect + '),202,trunc(102/a/2)*2)\'');
      filters[1].should.equal('pad=w=102:h=202:x=\'if(gt(a,' + aspect + '),0,(102-iw)/2)\':y=\'if(lt(a,' + aspect + '),0,(202-ih)/2)\':color=white');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('101x?')
        .withAspect('1:2')
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=102:h=202');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('?x201')
        .withAspect('1:2')
        ._test_getSizeFilters();
      filters.length.should.equal(1);
      filters[0].should.equal('scale=w=102:h=202');
    });

    it('Should apply autopadding when no boolean argument was passed to applyAutopadding', function() {
      var filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x?')
        .withAspect(0.5)
        .applyAutopadding('white')
        ._test_getSizeFilters();
      filters.length.should.equal(2);
      filters[1].should.equal('pad=w=100:h=200:x=\'if(gt(a,0.5),0,(100-iw)/2)\':y=\'if(lt(a,0.5),0,(200-ih)/2)\':color=white');
    });

    it('Should default to black padding', function() {
      var filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x?')
        .withAspect(0.5)
        .applyAutopadding()
        ._test_getSizeFilters();
      filters.length.should.equal(2);
      filters[1].should.equal('pad=w=100:h=200:x=\'if(gt(a,0.5),0,(100-iw)/2)\':y=\'if(lt(a,0.5),0,(200-ih)/2)\':color=black');

      filters = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .withSize('100x?')
        .withAspect(0.5)
        .applyAutopadding(true)
        ._test_getSizeFilters();
      filters.length.should.equal(2);
      filters[1].should.equal('pad=w=100:h=200:x=\'if(gt(a,0.5),0,(100-iw)/2)\':y=\'if(lt(a,0.5),0,(200-ih)/2)\':color=black');
    });
  });

  describe('complexFilter', function() {
    it('should generate a complex filter from a single filter', function() {
      var filters = new Ffmpeg()
        .complexFilter('filterstring')
        ._getArguments();

      filters.length.should.equal(2);
      filters[0].should.equal('-filter_complex');
      filters[1].should.equal('filterstring');
    });

    it('should generate a complex filter from a filter array', function() {
      var filters = new Ffmpeg()
        .complexFilter(['filter1', 'filter2'])
        ._getArguments();

      filters.length.should.equal(2);
      filters[1].should.equal('filter1;filter2');
    });

    it('should support filter objects', function() {
      var filters = new Ffmpeg()
        .complexFilter([
          'filter1',
          { filter: 'filter2' }
        ])
        ._getArguments();

      filters.length.should.equal(2);
      filters[1].should.equal('filter1;filter2');
    });

    it('should support filter options', function() {
      var filters = new Ffmpeg()
        .complexFilter([
          { filter: 'filter1', options: 'optionstring' },
          { filter: 'filter2', options: ['opt1', 'opt2', 'opt3'] },
          { filter: 'filter3', options: { opt1: 'value1', opt2: 'value2' } }
        ])
        ._getArguments();

      filters.length.should.equal(2);
      filters[1].should.equal('filter1=optionstring;filter2=opt1:opt2:opt3;filter3=opt1=value1:opt2=value2');
    });

    it('should escape filter options with ambiguous characters', function() {
      var filters = new Ffmpeg()
        .complexFilter([
          { filter: 'filter1', options: 'optionstring' },
          { filter: 'filter2', options: ['op,t1', 'op,t2', 'op,t3'] },
          { filter: 'filter3', options: { opt1: 'val,ue1', opt2: 'val,ue2' } }
        ])
        ._getArguments();

      filters.length.should.equal(2);
      filters[1].should.equal('filter1=optionstring;filter2=\'op,t1\':\'op,t2\':\'op,t3\';filter3=opt1=\'val,ue1\':opt2=\'val,ue2\'');
    });

    it('should support filter input streams', function() {
      var filters = new Ffmpeg()
        .complexFilter([
          { filter: 'filter1', inputs: 'input' },
          { filter: 'filter2', inputs: '[input]' },
          { filter: 'filter3', inputs: ['[input1]', 'input2'] }
        ])
        ._getArguments();

      filters.length.should.equal(2);
      filters[1].should.equal('[input]filter1;[input]filter2;[input1][input2]filter3');
    });

    it('should support filter output streams', function() {
      var filters = new Ffmpeg()
        .complexFilter([
          { filter: 'filter1', options: 'opt', outputs: 'output' },
          { filter: 'filter2', options: 'opt', outputs: '[output]' },
          { filter: 'filter3', options: 'opt', outputs: ['[output1]', 'output2'] }
        ])
        ._getArguments();

      filters.length.should.equal(2);
      filters[1].should.equal('filter1=opt[output];filter2=opt[output];filter3=opt[output1][output2]');
    });

    it('should support an additional mapping argument', function() {
      var filters = new Ffmpeg()
        .complexFilter(['filter1', 'filter2'], 'output')
        ._getArguments();

      filters.length.should.equal(4);
      filters[2].should.equal('-map');
      filters[3].should.equal('[output]');

      filters = new Ffmpeg()
        .complexFilter(['filter1', 'filter2'], '[output]')
        ._getArguments();

      filters.length.should.equal(4);
      filters[2].should.equal('-map');
      filters[3].should.equal('[output]');

      filters = new Ffmpeg()
        .complexFilter(['filter1', 'filter2'], ['[output1]', 'output2'])
        ._getArguments();

      filters.length.should.equal(6);
      filters[2].should.equal('-map');
      filters[3].should.equal('[output1]');
      filters[4].should.equal('-map');
      filters[5].should.equal('[output2]');
    });

    it('should override any previously set complex filtergraphs', function() {
      var filters = new Ffmpeg()
        .complexFilter(['filter1a', 'filter1b'], 'output1')
        .complexFilter(['filter2a', 'filter2b'], 'output2')
        ._getArguments();

      filters.length.should.equal(4);
      filters[1].should.equal('filter2a;filter2b');
      filters[2].should.equal('-map');
      filters[3].should.equal('[output2]');
    });
  });

  describe('clone', function() {
    it('should return a new FfmpegCommand instance', function() {
      var command = new Ffmpeg({ source: this.testfile, logger: testhelper.logger });
      var clone = command.clone();

      clone.should.instanceof(Ffmpeg);
      clone.should.not.equal(command);
    });

    it('should duplicate FfmpegCommand options at the time of the call', function(done) {
      var command = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .preset('flashvideo');

      var clone = command.clone();

      command._test_getArgs(function(originalArgs) {
        clone._test_getArgs(function(cloneArgs) {
          cloneArgs.length.should.equal(originalArgs.length);
          originalArgs.forEach(function(arg, index) {
            cloneArgs[index].should.equal(arg);
          });
          done();
        });
      });
    });

    it('should have separate argument lists', function(done) {
      var command = new Ffmpeg({ source: this.testfile, logger: testhelper.logger })
        .preset('flashvideo');

      var clone = command.clone().audioFrequency(22050);

      command._test_getArgs(function(originalArgs) {
        clone._test_getArgs(function(cloneArgs) {
          cloneArgs.length.should.equal(originalArgs.length + 2);
          done();
        });
      });
    });
  });
});
