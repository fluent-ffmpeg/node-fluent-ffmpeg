var ffmpeg = require('../index');

// make sure you set the correct path to your video file
var proc = ffmpeg('/path/to/your_movie.avi')
  // set video bitrate
  .videoBitrate(1024)
  // set target codec
  .videoCodec('divx')
  // set aspect ratio
  .aspect('16:9')
  // set size in percent
  .size('50%')
  // set fps
  .fps(24)
  // set audio bitrate
  .audioBitrate('128k')
  // set audio codec
  .audioCodec('libmp3lame')
  // set number of audio channels
  .audioChannels(2)
  // set custom option
  .addOption('-vtag', 'DIVX')
  // set output format to force
  .format('avi')
  // setup event handlers
  .on('end', function() {
    console.log('file has been converted succesfully');
  })
  .on('error', function(err) {
    console.log('an error happened: ' + err.message);
  })
  // save to file
  .save('/path/to/your_target.avi')
  // take screenshots
  .takeScreenshots({ count: 2, timemarks: [ '00:00:02.000', '6' ], size: '150x100' }, '/path/to/thumbnail/folder');
