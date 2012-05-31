var ffmpeg = require('../lib');

// make sure you set the correct path to your video file
var proc = new ffmpeg({ source: '/path/to/your_movie.avi', nolog: true })
  // use the 'podcast' preset (located in /lib/presets/podcast.js)
  .usingPreset('podcast')
  // in case you want to override the preset's setting, just keep chaining
  .withVideoBitrate('512k')
  // save to file
  .saveToFile('/path/to/your_target.m4v', function(retcode, error){
    console.log('file has been converted succesfully');
  });