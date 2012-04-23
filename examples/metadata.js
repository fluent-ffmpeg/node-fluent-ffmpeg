var ffmpegmeta = require('../lib/fluent-ffmpeg').Metadata;

// make sure you set the correct path to your video file
ffmpegmeta.get('/path/to/your_movie.avi', function(metadata, err) {
  console.log(require('util').inspect(metadata, false, null));
});