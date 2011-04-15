exports.load = function(ffmpeg) {
  ffmpeg
    .toFormat('flv')
    .withVideoBitrate('256k')
    .withFps(24)
    .withAudioBitrate('128k')
    .withAudioFrequency(22050)
    .withAudioChannels(2)
    .addOptions([ '-sameq' ]);
  return ffmpeg;
};