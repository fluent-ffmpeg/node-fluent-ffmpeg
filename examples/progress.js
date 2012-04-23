var fs = require('fs'),
  ffmpeg = require('./lib/fluent-ffmpeg');

// open input stream
var infs = fs.createReadStream(__dirname + '/test/assets/testvideo-43.avi');

infs.on('error', function(err) {
  console.log(err);
});

var proc = new ffmpeg({ source: infs, nolog: true })
  .usingPreset('flashvideo')
  // set the callback for our progress notification
  .onProgress(function(info) {
    console.log('progress ' + info.percent + '%');
  })
  .saveToFile('/path/to/your_target.flv', function(stdout, stderr, err) {
    console.log('done processing input stream');
  });