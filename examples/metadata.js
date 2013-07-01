var Metalib = require('../index').Metadata;

// make sure you set the correct path to your video file
Metalib('/path/to/your_movie.avi',function(metadata, err) {
  console.log(require('util').inspect(metadata, false, null));
});
