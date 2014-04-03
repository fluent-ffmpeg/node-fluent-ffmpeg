var ffmpeg = require('fluent-ffmpeg');

// make sure you set the correct path to your video file
var proc = new ffmpeg({ source: '/path/to/your_image.jpg', nolog: true })
  // loop for 5 seconds
  .loop(5)
  // using 25 fps
  .withFps(25)
  // setup event handlers
  .on('end', function() {
    console.log('file has been converted succesfully');
  })
  .on('error', function(err) {
    console.log('an error happened: ' + err.message);
  })
  // save to file
  .saveToFile('/path/to/your_target.m4v');
