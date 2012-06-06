var ffmpeg = require('../index');

// make sure you set the correct path to your video file
var proc = new ffmpeg({ source: '/path/to/your_movie.avi', nolog: true })
  // set video bitrate
  .withVideoBitrate(1024)
  // set target codec
  .withVideoCodec('divx')
  // set aspect ratio
  .withAspect('16:9')
  // set size in percent
  .withSize('50%')
  // set fps
  .withFps(24)
  // set audio bitrate
  .withAudioBitrate('128k')
  // set audio codec
  .withAudioCodec('libmp3lame')
  // set number of audio channels
  .withAudioChannels(2)
  // set custom option
  .addOption('-vtag', 'DIVX')
  // set output format to force
  .toFormat('avi')
  // save to file
  .saveToFile('/path/to/your_target.avi', function(retcode, error){
    console.log('file has been converted succesfully');
  });
