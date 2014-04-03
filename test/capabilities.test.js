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

      codecs.should.have.key('pcm_s16le');
      codecs.pcm_s16le.should.have.key('type');
      (typeof codecs.pcm_s16le.type).should.equal('string');
      codecs.pcm_s16le.should.have.key('description');
      (typeof codecs.pcm_s16le.description).should.equal('string');
      codecs.pcm_s16le.should.have.key('canEncode');
      (typeof codecs.pcm_s16le.canEncode).should.equal('boolean');
      codecs.pcm_s16le.should.have.key('canDecode');
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

      formats.should.have.key('wav');
      formats.wav.should.have.key('description');
      (typeof formats.wav.description).should.equal('string');
      formats.wav.should.have.key('canMux');
      (typeof formats.wav.canMux).should.equal('boolean');
      formats.wav.should.have.key('canDemux');
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

      filters.should.have.key('anull');
      filters.anull.should.have.key('description');
      (typeof filters.anull.description).should.equal('string');
      filters.anull.should.have.key('input');
      (typeof filters.anull.input).should.equal('string');
      filters.anull.should.have.key('output');
      (typeof filters.anull.output).should.equal('string');
      filters.anull.should.have.key('multipleInputs');
      (typeof filters.anull.multipleInputs).should.equal('boolean');
      filters.anull.should.have.key('multipleOutputs');
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
