var fs = require('fs'),
  ffmpeg = require('../index');

// open input stream
var infs = fs.createReadStream(__dirname + '/test/assets/testvideo-43.avi');

infs.on('error', function(err) {
  console.log(err);
});

// create new ffmpeg processor instance using input stream
// instead of file path (can be any ReadableStream)
var proc = new ffmpeg({ source: infs, nolog: true })
  .usingPreset('flashvideo')
  // setup event handlers
  .on('end', function() {
    console.log('done processing input stream');
  })
  .on('error', function(err) {
    console.log('an error happened: ' + err.message);
  })
  // save to file
  .saveToFile('/path/to/your_target.flv');
