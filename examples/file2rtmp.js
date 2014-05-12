var ffmpeg = require('../index');

// make sure you set the correct path to your video file
// inputNativeFrameRate used to emulate a real input device
var proc = new ffmpeg({source: '//path/to/source/file', nolog: true, inputNativeFrameRate: true})
    // set video bitrate
    .withVideoBitrate(1100)
    // set h264 preset
    .addOption('preset', 'veryfast')
    // set target codec
    .withVideoCodec('libx264')
    // set audio bitrate
    .withAudioBitrate('96k')
    // set audio codec
    .withAudioCodec('libfaac')
    // set number of audio channels
    .withAudioChannels(2)
    // add options to tune latency, might not be supported based on codec/platform
    .addOtion("-tune", "zerolatency")
    // set gop size to 2*framerate
    .withFps(25)
    .addOption("-gop", 50)
    // setup event handlers
    .on('end', function() {
        console.log('file has been streamed succesfully');
    })
    .on('error', function(err) {
        console.log('an error happened: ' + err.message);
    })
    // send to server, use saveToFile function
    .saveToFile('rtmp://path/to/rtmp/server');
