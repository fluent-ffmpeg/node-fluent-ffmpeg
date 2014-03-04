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
  },

  logError: function(err, stdout, stderr) {
    if (err) {
      console.log('got error: ' + (err.stack || err));
      if (stdout) {
        console.log('---stdout---');
        console.log(stdout);
      }
      if (stderr) {
        console.log('---stderr---');
        console.log(stderr);
      }
    }
  }
}