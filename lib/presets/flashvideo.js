exports.load = function(ffmpeg) {
  ffmpeg
    .toFormat('flv')
    .updateFlvMetadata()
    .withSize('320x?')
    .withVideoBitrate('256k')
    .withFps(24)
    .withAudioBitrate('128k')
    .withAudioCodec('libmp3lame')
    .withAudioFrequency(22050)
    .withAudioChannels(2)
    .addOptions([ '-sameq' ]);
  return ffmpeg;
};