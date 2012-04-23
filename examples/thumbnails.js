var ffmpeg = require('../lib/fluent-ffmpeg');

var proc = new ffmpeg({ source: '/path/to/your_movie.avi', nolog: true })
  // set the size of your thumbnails
  .withSize('150x100')
  // take 2 screenshots at predefined timemarks
  .takeScreenshots({ count: 2, timemarks: [ '00:00:02.000', '6' ] }, '/path/to/thumbnail/folder', function(err) {
    console.log('screenshots were saved');
  });