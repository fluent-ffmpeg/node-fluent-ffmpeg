exports.load = function(ffmpeg) {
  ffmpeg
    .toFormat('flv')
    .updateFlvMetadata()
    .withSize('320x?')
    .withVideoBitrate('512k')
    .withVideoCodec('libx264')
    .withFps(24)
    .withAudioBitrate('96k')
    .withAudioCodec('aac')
    .withStrictExperimental()
    .withAudioFrequency(22050)
    .withAudioChannels(2);
  return ffmpeg;
};
