var request = require('request-promise')
var ffmpeg = require('fluent-ffmpeg');

var oggUrl = 'http://upload.wikimedia.org//wikipedia/commons/9/98/De-M%C3%BCller.ogg';

module.exports = function (req, res, next) {
  res.contentType('audio/aac');

  var input = request(oggUrl);

  var proc = ffmpeg(input)
      .withAudioCodec('aac')
      .toFormat('mp4')

      // setup event handlers
      .on('end', function () { console.log('ffmpeg: file has been converted succesfully'); })
      .on('error', function (err) { next(err); })

      // save to stream
      .addOption('-movflags','frag_keyframe+empty_moov')
      .pipe(res);
};
