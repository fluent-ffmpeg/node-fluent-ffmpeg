var ffmpeg = require('../index');

// make sure you set the correct path to your video file
var proc = ffmpeg('/path/to/your_movie.avi')
  // use the 'podcast' preset (located in /lib/presets/podcast.js)
  .preset('podcast')
  // in case you want to override the preset's setting, just keep chaining
  .videoBitrate('512k')
  // setup event handlers
  .on('end', function() {
    console.log('file has been converted succesfully');
  })
  .on('error', function(err) {
    console.log('an error happened: ' + err.message);
  })
  // save to file
  .save('/path/to/your_target.m4v');
