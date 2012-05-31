var ffmpeg = require('../lib/');
  Registry = process.env.FLUENTFFMPEG_COV ? require('../lib-cov/registry') : require('../lib/registry');

// reset registry
Registry.instance.reset();

describe('Registry.set', function() {
  it('should set a value in the global registry', function() {
    Registry.instance.set('foo', 'bar');
    Registry.instance.values.length.should.equal(1);
  });
  it('should update a value that was already set', function() {
    Registry.instance.set('foo', 'bar-new');
    Registry.instance.get('foo').should.equal('bar-new');

    // re-set to old value
    Registry.instance.set('foo', 'bar');
  });
});

describe('Registry.get', function() {
  it('should return the value for a certain key from the global registry', function() {
    var val = Registry.instance.get('foo');
    val.should.equal('bar');
  });
  it('should return false when key is not present', function() {
    Registry.instance.get('NOTFOUND').should.be.false;
  });
});