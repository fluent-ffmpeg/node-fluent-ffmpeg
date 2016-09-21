var fs = require('fs'),
  ffmpeg = require('../index');

// open input stream
var infs = fs.createReadStream(__dirname + '/test/assets/testvideo-43.avi');

infs.on('error', function(err) {
  console.log(err);
});

var proc = ffmpeg(infs)
  .preset('flashvideo')
  // setup event handlers
  .on('progress', function(info) {
    console.log('progress ' + info.percent + '%. Duplicated Frames: '+info.dup+". Dropped Frames: "+info.drop);
  })
  .on('end', function() {
    console.log('done processing input stream');
  })
  .on('error', function(err) {
    console.log('an error happened: ' + err.message);
  })
  .save('/path/to/your_target.flv');