exports.load = function(ffmpeg) {
  ffmpeg
    .toFormat('flv')
    .withVideoBitrate('256k')
    .withSize('640x480')
    .withFps(24)
    .withAudioBitrate('128k')
    .withAudioChannels(2)
    .addOptions([ '-sameq' ]);
  return ffmpeg;
};