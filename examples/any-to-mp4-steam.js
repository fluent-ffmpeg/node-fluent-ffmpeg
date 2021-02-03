// The solution based on adding -movflags for mp4 output
// For more movflags details check ffmpeg docs
// https://ffmpeg.org/ffmpeg-formats.html#toc-Options-9

var fs = require('fs');
var path = require('path');
var ffmpeg = require('../index');

var pathToSourceFile = path.resolve(__dirname, '../test/assets/testvideo-169.avi');
var readStream = fs.createReadStream(pathToSourceFile);
var writeStream = fs.createWriteStream('./output.mp4');

ffmpeg(readStream)
  .addOutputOptions('-movflags +frag_keyframe+separate_moof+omit_tfhd_offset+empty_moov')
  .format('mp4')
  .pipe(writeStream);
