var Ffmpeg = require('../index'),
  assert = require('assert'),
  testhelper = require('./helpers'),
  async = require('async');

describe('Capabilities', function() {
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
