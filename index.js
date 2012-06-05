module.exports = process.env.FLUENTFFMPEG_COV ? require('./lib-cov/fluent-ffmpeg') : require('./lib/fluent-ffmpeg');
