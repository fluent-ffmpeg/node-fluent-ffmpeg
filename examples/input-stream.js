var fs = require('fs'),
  ffmpeg = require('./lib/');

// open input stream
var infs = fs.createReadStream(__dirname + '/test/assets/testvideo-43.avi');

infs.on('error', function(err) {
  console.log(err);
});

// create new ffmpeg processor instance using input stream
// instead of file path (can be any ReadableStream)
var proc = new ffmpeg({ source: infs, nolog: true })
  .usingPreset('flashvideo')
  .saveToFile('/path/to/your_target.flv', function(stdout, stderr, err) {
    console.log('done processing input stream');
  });