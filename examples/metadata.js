var ffmpegmeta = require('../lib/fluent-ffmpeg').Metadata;

// make sure you set the correct path to your video file
ffmpegmeta.get('/var/www/v_vxxxxxxxxxxxxxxx_d_000000.mov', function(metadata) {
  console.log(require('util').inspect(metadata, false, null));
});