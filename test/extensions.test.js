var extlib = process.env.FLUENTFFMPEG_COV ? require('../lib-cov/extensions') : require('../lib/extensions'),
  assert = require('assert');

// kinda nasty...
var ext = new extlib();

describe('Extensions.toAspectRatio', function() {
  it('should convert an aspect ratio string to a proper object', function() {
    var ret = ext.toAspectRatio('16:9');
    ret.x.should.equal(16);
    ret.y.should.equal(9);
  });
  it('should return undefined when an invalid aspect ratio is passed', function() {
    assert(!ext.toAspectRatio('15.929'));
  });
});

describe('Extensions.parseVersionString', function() {
  it('should parse the major/minor/patch version correctly', function() {
    var ret = ext.parseVersionString('4.5.123');
    ret.should.have.property('major').with.valueOf(4);
    ret.should.have.property('minor').with.valueOf(5);
    ret.should.have.property('patch').with.valueOf(123);
  });
});

describe('Extensions.atLeastVersion', function() {
  it('should correctly compare a full version number', function() {
    ext.atLeastVersion('2.3.4532', '2.3.4531').should.be.true;
  });
  it('should correctly compare a version number without patch version', function() {
    ext.atLeastVersion('2.3', '2.2.32').should.be.true;
  });
  it('should correctly compare a major version number', function() {
    ext.atLeastVersion('3', '2.9.912').should.be.true;
  });
  it('should correctly compare an exact version match', function() {
    ext.atLeastVersion('1.2.34', '1.2.34').should.be.true;
  });
});

describe('Extensions.ffmpegTimemarkToSeconds', function() {
  it('should correctly convert a simple timestamp', function() {
    ext.ffmpegTimemarkToSeconds('00:02:00.00').should.be.equal(120);
  });
  it('should correctly convert a complex timestamp', function() {
    ext.ffmpegTimemarkToSeconds('00:08:09.10').should.be.equal(489);
  });
});