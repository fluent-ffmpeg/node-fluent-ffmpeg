exports.load = function(ffmpeg) {
  ffmpeg
    .toFormat('avi')
    .withVideoBitrate('1024k')
    .withVideoCodec('mpeg4')
    .withSize('720x?')
    .withAudioBitrate('128k')
    .withAudioChannels(2)
    .withAudioCodec('libmp3lame')
    .addOptions([ '-vtag DIVX' ]);
  return ffmpeg;
};