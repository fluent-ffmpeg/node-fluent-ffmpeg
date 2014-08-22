var ffmpeg = require('../index');

// make sure you set the correct path to your video file
var proc = ffmpeg('rtmp://path/to/live/stream', { timeout: 432000 })
  // set video bitrate
  .videoBitrate(1024)
  // set h264 preset
  .addOption('preset','superfast')
  // set target codec
  .videoCodec('libx264')
  // set audio bitrate
  .audioBitrate('128k')
  // set audio codec
  .audioCodec('libfaac')
  // set number of audio channels
  .audioChannels(2)
  // set hls segments time
  .addOption('-hls_time', 10)
  // include all the segments in the list
  .addOption('-hls_list_size',0)
  // setup event handlers
  .on('end', function() {
    console.log('file has been converted succesfully');
  })
  .on('error', function(err) {
    console.log('an error happened: ' + err.message);
  })
  // save to file
  .save('/path/to/your_target.m3u8');
