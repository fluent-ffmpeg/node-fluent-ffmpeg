var ffmpeg = require('../index');

// make sure you set the correct path to your video file
var proc = new ffmpeg({ source: '/path/to/your_image.jpg', nolog: true })
  // loop for 5 seconds
  .loop(5)
  // using 25 fps
  .withFps(25)
  // save to file
  .saveToFile('/path/to/your_target.m4v', function(retcode, error){
    console.log('file has been converted succesfully');
  });