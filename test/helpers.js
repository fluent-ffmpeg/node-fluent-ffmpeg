exports = module.exports = TestHelpers = {
  getFfmpegCheck: function() {
    var platform = require('os').platform();

    if (!platform.match(/win(32|64)/)) {
      // linux/mac, use which
      return 'which ffmpeg';
    } else {
      // windows, use where (> windows server 2003 / windows 7)
      return 'where /Q ffmpeg';
    }
  }
}