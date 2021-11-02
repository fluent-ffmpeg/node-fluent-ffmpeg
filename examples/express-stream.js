var express = require('express'),
  ffmpeg = require('../index');

var app = express();

app.use(express.static(__dirname + '/flowplayer'));

app.get('/', function(req, res) {
  res.send('index.html');
});

app.get('/video/:filename', function(req, res) {
  res.contentType('flv');
  // make sure you set the correct path to your video file storage
  var pathToMovie = '/path/to/storage/' + req.params.filename;
  var proc = ffmpeg(pathToMovie)
    // use the 'flashvideo' preset (located in /lib/presets/flashvideo.js)
    .preset('flashvideo')
    // setup event handlers
    .on('end', function() {
      console.log('file has been converted successfully');
    })
    .on('error', function(err) {
      console.log('an error happened: ' + err.message);
    })
    // save to stream
    .pipe(res, {end:true});
});

app.listen(4000);
