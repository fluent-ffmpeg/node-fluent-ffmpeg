var Metalib = require('../lib/').Metadata;

// make sure you set the correct path to your video file
var metaObject = new Metalib('/path/to/your_movie.avi');
metaObject.get(function(metadata, err) {
  console.log(require('util').inspect(metadata, false, null));
});