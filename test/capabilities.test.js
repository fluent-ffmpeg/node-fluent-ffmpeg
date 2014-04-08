var Ffmpeg = require('../index'),
  assert = require('assert'),
  testhelper = require('./helpers');

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
});
