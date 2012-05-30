var ffmpeg = require('../lib/')
  assert = require('assert');

describe('extensions.toAspectRatio', function() {
  it('should convert an aspect ratio string to a proper object', function() {
    var ret = '16:9'.toAspectRatio();
    ret.x.should.equal(16);
    ret.y.should.equal(9);
  });
  it('should return undefined when an invalid aspect ratio is passed', function() {
    assert(!'15.929'.toAspectRatio());
  });
});

describe('Extensions.parseVersionString', function() {
  it('should parse the major/minor/patch version correctly', function() {
    var ret = '4.5.123'.parseVersionString();
    ret.should.have.property('major').with.valueOf(4);
    ret.should.have.property('minor').with.valueOf(5);
    ret.should.have.property('patch').with.valueOf(123);
  });
});

describe('Extensions.atLeastVersion', function() {
  it('should correctly compare a full version number', function() {
    '2.3.4532'.atLeastVersion('2.3.4531').should.be.true;
  });
  it('should correctly compare a version number without patch version', function() {
    '2.3'.atLeastVersion('2.2.32').should.be.true;
  });
  it('should correctly compare a major version number', function() {
    '3'.atLeastVersion('2.9.912').should.be.true;
  });
  it('should correctly compare an exact version match', function() {
    '1.2.34'.atLeastVersion('1.2.34').should.be.true;
  });
});

describe('Extensions.ffmpegTimemarkToSeconds', function() {
  it('should correctly convert a simple timestamp', function() {
    '00:02:00.00'.ffmpegTimemarkToSeconds().should.be.equal(120);
  });
  it('should correctly convert a complex timestamp', function() {
    '00:08:09.10'.ffmpegTimemarkToSeconds().should.be.equal(489);
  });
});