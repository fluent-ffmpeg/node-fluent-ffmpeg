var ffmpeg = require('fluent-ffmpeg');

// make sure you set the correct path to your video file
var proc = ffmpeg('/path/to/your_image.jpg')
  // loop for 5 seconds
  .loop(5)
  // using 25 fps
  .fps(25)
  //audio bitrate 
  .audioBitrate('128k')
  //video bitrate 
  .videoBitrate('8000k', true)
  //resolution
  .size('1920x1080')
  // setup event handlers
  .on('end', function() {
    console.log('file has been converted succesfully');
  })
  .on('error', function(err) {
    console.log('an error happened: ' + err.message);
  })
  // save to file
  .save('/path/to/your_target.m4v');
