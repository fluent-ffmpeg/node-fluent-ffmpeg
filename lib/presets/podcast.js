exports.load = function(ffmpeg) {
  ffmpeg
    .toFormat('m4v')
    .withVideoBitrate('512k')
    .withVideoCodec('libx264')
    .withSize('320x176')
    .withAudioBitrate('128k')
    .withAudioCodec('libfaac')
    .withAudioChannels(1)
    .addOptions(['-flags', '+loop', '-cmp', '+chroma', '-partitions','+parti4x4+partp8x8+partb8x8', '-flags2',
      '+mixed_refs', '-me_method umh', '-subq 5', '-bufsize 2M', '-rc_eq \'blurCplx^(1-qComp)\'',
      '-qcomp 0.6', '-qmin 10', '-qmax 51', '-qdiff 4', '-level 13' ]);
  return ffmpeg;
};
