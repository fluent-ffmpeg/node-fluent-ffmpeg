var fs = require('fs');
var assert = require('assert');
var Metalib = require('../index').Metadata;

function noErr (metadata, err) { assert.ifError(err); };

fs.readdir('assets', function (err, files) {
  assert.ifError(err);
  files.forEach(function (file, i, files) {
    for (var i = 0; i < 100; ++i) new Metalib(file, noErr);
  });
});

