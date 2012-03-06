var ffmpeg = require('../lib/fluent-ffmpeg'),
  testCase = require('nodeunit').testCase;

// reset registry
Registry.instance.reset();

module.exports = testCase({
	testCanSetValue: function(test) {
    Registry.instance.set('foo', 'bar');
    test.ok(Registry.instance.values.length == 1);
    test.done();
	},
	testCanGetValue: function(test) {
    var val = Registry.instance.get('foo');
    test.ok(val == 'bar');
    test.done();
	},
  testReturnsNullOnKeyNotFound: function(test) {
    test.ok(Registry.instance.get('bar') == null);
    test.done();
  }
});