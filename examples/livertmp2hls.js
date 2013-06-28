var ffmpeg = require('../index');

// make sure you set the correct path to your video file
var proc = new ffmpeg({ source: 'rtmp://path/to/live/stream', nolog: true, timeout: 432000, inputlive:true })
  // set video bitrate
  .withVideoBitrate(1024)
  // set h264 preset
  .addOption('preset','superfast')
  // set target codec
  .withVideoCodec('libx264')
  // set audio bitrate
  .withAudioBitrate('128k')
  // set audio codec
  .withAudioCodec('libfaac')
  // set number of audio channels
  .withAudioChannels(2)
  // set hls segments time
  .addOption('-hls_time', 10)
  // include all the segments in the list
  .addOption('-hls_list_size',0)
  // save to file
  .saveToFile('/path/to/your_target.m3u8', function(retcode, error){
    console.log('file has been converted succesfully');
  });
