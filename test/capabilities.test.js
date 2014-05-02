var Ffmpeg = require('../index'),
  path = require('path'),
  assert = require('assert'),
  testhelper = require('./helpers'),
  async = require('async');

describe('Capabilities', function() {
  describe('ffmpeg capabilities', function() {
    it('should enable querying for available codecs', function(done) {
      new Ffmpeg({ source: '' }).getAvailableCodecs(function(err, codecs) {
        testhelper.logError(err);
        assert.ok(!err);

        (typeof codecs).should.equal('object');
        Object.keys(codecs).length.should.not.equal(0);

        ('pcm_s16le' in codecs).should.equal(true);
        ('type' in codecs.pcm_s16le).should.equal(true);
        (typeof codecs.pcm_s16le.type).should.equal('string');
        ('description' in codecs.pcm_s16le).should.equal(true);
        (typeof codecs.pcm_s16le.description).should.equal('string');
        ('canEncode' in codecs.pcm_s16le).should.equal(true);
        (typeof codecs.pcm_s16le.canEncode).should.equal('boolean');
        ('canDecode' in codecs.pcm_s16le).should.equal(true);
        (typeof codecs.pcm_s16le.canDecode).should.equal('boolean');

        done();
      });
    });

    it('should enable querying for available formats', function(done) {
      new Ffmpeg({ source: '' }).getAvailableFormats(function(err, formats) {
        testhelper.logError(err);
        assert.ok(!err);

        (typeof formats).should.equal('object');
        Object.keys(formats).length.should.not.equal(0);

        ('wav' in formats).should.equal(true);
        ('description' in formats.wav).should.equal(true);
        (typeof formats.wav.description).should.equal('string');
        ('canMux' in formats.wav).should.equal(true);
        (typeof formats.wav.canMux).should.equal('boolean');
        ('canDemux' in formats.wav).should.equal(true);
        (typeof formats.wav.canDemux).should.equal('boolean');

        done();
      });
    });

    it('should enable querying for available filters', function(done) {
      new Ffmpeg({ source: '' }).getAvailableFilters(function(err, filters) {
        testhelper.logError(err);
        assert.ok(!err);

        (typeof filters).should.equal('object');
        Object.keys(filters).length.should.not.equal(0);

        ('anull' in filters).should.equal(true);
        ('description' in filters.anull).should.equal(true);
        (typeof filters.anull.description).should.equal('string');
        ('input' in filters.anull).should.equal(true);
        (typeof filters.anull.input).should.equal('string');
        ('output' in filters.anull).should.equal(true);
        (typeof filters.anull.output).should.equal('string');
        ('multipleInputs' in filters.anull).should.equal(true);
        (typeof filters.anull.multipleInputs).should.equal('boolean');
        ('multipleOutputs' in filters.anull).should.equal(true);
        (typeof filters.anull.multipleOutputs).should.equal('boolean');

        done();
      });
    });

    it('should enable querying capabilities without instanciating a command', function(done) {
      Ffmpeg.getAvailableCodecs(function(err, filters) {
        testhelper.logError(err);
        assert.ok(!err);

        (typeof filters).should.equal('object');
        Object.keys(filters).length.should.not.equal(0);

        done();
      });
    });

    it('should enable checking command arguments for available codecs and formats', function(done) {
      async.waterfall([
        // Check with everything available
        function(cb) {
          new Ffmpeg('/path/to/file.avi')
            .fromFormat('avi')
            .audioCodec('pcm_u16le')
            .videoCodec('png')
            .toFormat('mp4')
            ._checkCapabilities(cb);
        },

        // Invalid input format
        function(cb) {
          new Ffmpeg('/path/to/file.avi')
            .fromFormat('invalid-input-format')
            .audioCodec('pcm_u16le')
            .videoCodec('png')
            .toFormat('mp4')
            ._checkCapabilities(function(err) {
              assert.ok(!!err);
              err.message.should.match(/Input format invalid-input-format is not available/);

              cb();
            });
        },

        // Invalid output format
        function(cb) {
          new Ffmpeg('/path/to/file.avi')
            .fromFormat('avi')
            .audioCodec('pcm_u16le')
            .videoCodec('png')
            .toFormat('invalid-output-format')
            ._checkCapabilities(function(err) {
              assert.ok(!!err);
              err.message.should.match(/Output format invalid-output-format is not available/);

              cb();
            });
        },

        // Invalid audio codec
        function(cb) {
          new Ffmpeg('/path/to/file.avi')
            .fromFormat('avi')
            .audioCodec('invalid-audio-codec')
            .videoCodec('png')
            .toFormat('mp4')
            ._checkCapabilities(function(err) {
              assert.ok(!!err);
              err.message.should.match(/Audio codec invalid-audio-codec is not available/);

              cb();
            });
        },

        // Invalid video codec
        function(cb) {
          new Ffmpeg('/path/to/file.avi')
            .fromFormat('avi')
            .audioCodec('pcm_u16le')
            .videoCodec('invalid-video-codec')
            .toFormat('mp4')
            ._checkCapabilities(function(err) {
              assert.ok(!!err);
              err.message.should.match(/Video codec invalid-video-codec is not available/);

              cb();
            });
        }
      ], function(err) {
        testhelper.logError(err);
        assert.ok(!err);

        done();
      });
    });

    it('should check capabilities before running a command', function(done) {
      new Ffmpeg('/path/to/file.avi')
        .on('error', function(err) {
          err.message.should.match(/Output format invalid-output-format is not available/);
          done();
        })
        .toFormat('invalid-output-format')
        .saveToFile('/tmp/will-not-be-created.mp4');
    });
  });

  describe('ffmpeg path', function() {
    var FFMPEG_PATH;
    var ALT_FFMPEG_PATH;
    var skipAltTest = false;

    // Only test with FFMPEG_PATH when we actually have an alternative path
    if (process.env.ALT_FFMPEG_PATH) {
      ALT_FFMPEG_PATH = process.env.ALT_FFMPEG_PATH;
    } else {
      skipAltTest = true;
    }

    beforeEach(function() {
      // Save environment before each test
      FFMPEG_PATH = process.env.FFMPEG_PATH;
    });

    afterEach(function() {
      // Restore environment before each test
      process.env.FFMPEG_PATH = FFMPEG_PATH;
    });


    it('should look for ffmpeg in the PATH if FFMPEG_PATH is not defined', function(done) {
      var ff = new Ffmpeg();

      delete process.env.FFMPEG_PATH;

      ff._forgetPaths();
      ff._getFfmpegPath(function(err, ffmpeg) {
        testhelper.logError(err);
        assert.ok(!err);

        ffmpeg.should.String;
        ffmpeg.length.should.above(0);

        var paths = process.env.PATH.split(path.delimiter);
        paths.indexOf(path.dirname(ffmpeg)).should.above(-1);
        done();
      });
    });

    (skipAltTest ? it.skip : it)('should use FFMPEG_PATH if defined and valid', function(done) {
      var ff = new Ffmpeg();

      process.env.FFMPEG_PATH = ALT_FFMPEG_PATH;

      ff._forgetPaths();
      ff._getFfmpegPath(function(err, ffmpeg) {
        testhelper.logError(err);
        assert.ok(!err);

        ffmpeg.should.equal(ALT_FFMPEG_PATH);
        done();
      });
    });

    it('should fall back to searching in the PATH if FFMPEG_PATH is invalid', function(done) {
      var ff = new Ffmpeg();

      process.env.FFMPEG_PATH = '/nope/not-here/nothing-to-see-here';

      ff._forgetPaths();
      ff._getFfmpegPath(function(err, ffmpeg) {
        testhelper.logError(err);
        assert.ok(!err);

        ffmpeg.should.String;
        ffmpeg.length.should.above(0);

        var paths = process.env.PATH.split(path.delimiter);
        paths.indexOf(path.dirname(ffmpeg)).should.above(-1);
        done();
      });
    });

    it('should remember ffmpeg path', function(done) {
      var ff = new Ffmpeg();

      delete process.env.FFMPEG_PATH;

      ff._forgetPaths();
      ff._getFfmpegPath(function(err, ffmpeg) {
        testhelper.logError(err);
        assert.ok(!err);

        ffmpeg.should.String;
        ffmpeg.length.should.above(0);

        // Just check that the callback is actually called synchronously
        // (which indicates no which call was made)
        var after = 0;
        ff._getFfmpegPath(function(err, ffmpeg) {
          testhelper.logError(err);
          assert.ok(!err);

          ffmpeg.should.String;
          ffmpeg.length.should.above(0);
          after.should.equal(0);

          done();
        });

        after = 1;
      });
    });
  });

  describe('ffprobe path', function() {
    var FFPROBE_PATH;
    var ALT_FFPROBE_PATH;
    var skipAltTest = false;

    // Only test with FFPROBE_PATH when we actually have an alternative path
    if (process.env.ALT_FFPROBE_PATH) {
      ALT_FFPROBE_PATH = process.env.ALT_FFPROBE_PATH;
    } else {
      skipAltTest = true;
    }

    beforeEach(function() {
      // Save environment before each test
      FFPROBE_PATH = process.env.FFPROBE_PATH;
    });

    afterEach(function() {
      // Restore environment before each test
      process.env.FFPROBE_PATH = FFPROBE_PATH;
    });


    it('should look for ffprobe in the PATH if FFPROBE_PATH is not defined', function(done) {
      var ff = new Ffmpeg();

      delete process.env.FFPROBE_PATH;

      ff._forgetPaths();
      ff._getFfprobePath(function(err, ffprobe) {
        testhelper.logError(err);
        assert.ok(!err);

        ffprobe.should.String;
        ffprobe.length.should.above(0);

        var paths = process.env.PATH.split(path.delimiter);
        paths.indexOf(path.dirname(ffprobe)).should.above(-1);
        done();
      });
    });

    (skipAltTest ? it.skip : it)('should use FFPROBE_PATH if defined and valid', function(done) {
      var ff = new Ffmpeg();

      process.env.FFPROBE_PATH = ALT_FFPROBE_PATH;

      ff._forgetPaths();
      ff._getFfprobePath(function(err, ffprobe) {
        testhelper.logError(err);
        assert.ok(!err);

        ffprobe.should.equal(ALT_FFPROBE_PATH);
        done();
      });
    });

    it('should fall back to searching in the PATH if FFPROBE_PATH is invalid', function(done) {
      var ff = new Ffmpeg();

      process.env.FFPROBE_PATH = '/nope/not-here/nothing-to-see-here';

      ff._forgetPaths();
      ff._getFfprobePath(function(err, ffprobe) {
        testhelper.logError(err);
        assert.ok(!err);

        ffprobe.should.String;
        ffprobe.length.should.above(0);

        var paths = process.env.PATH.split(path.delimiter);
        paths.indexOf(path.dirname(ffprobe)).should.above(-1);
        done();
      });
    });

    it('should remember ffprobe path', function(done) {
      var ff = new Ffmpeg();

      delete process.env.FFPROBE_PATH;

      ff._forgetPaths();
      ff._getFfprobePath(function(err, ffprobe) {
        testhelper.logError(err);
        assert.ok(!err);

        ffprobe.should.String;
        ffprobe.length.should.above(0);

        // Just check that the callback is actually called synchronously
        // (which indicates no which call was made)
        var after = 0;
        ff._getFfprobePath(function(err, ffprobe) {
          testhelper.logError(err);
          assert.ok(!err);

          ffprobe.should.String;
          ffprobe.length.should.above(0);
          after.should.equal(0);

          done();
        });

        after = 1;
      });
    });
  });
});
