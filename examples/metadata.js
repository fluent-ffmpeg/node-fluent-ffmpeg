var ffmpeg = require('../index');

// make sure you set the correct path to your video file
ffmpeg.ffprobe('/path/to/your_movie.avi',function(metadata, err) {
  console.log(require('util').inspect(metadata, false, null));
});
