/*jshint node:true*/
'use strict';

var TestHelpers;

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

  logger: {
    debug: function(arg) { if (process.env.FLUENTFFMPEG_COV !== '1') console.log('          [DEBUG] ' + arg); },
    info: function(arg) { if (process.env.FLUENTFFMPEG_COV !== '1') console.log('          [INFO] ' + arg); },
    warn: function(arg) { if (process.env.FLUENTFFMPEG_COV !== '1') console.log('          [WARN] ' + arg); },
    error: function(arg) { if (process.env.FLUENTFFMPEG_COV !== '1') console.log('          [ERROR] ' + arg); }
  },

  logArgError: function(err) {
    if (err) {
      console.log('got error: ' + (err.stack || err));
      if (err.ffmpegOut) {
        console.log('---stdout---');
        console.log(err.ffmpegOut);
      }
      if (err.ffmpegErr) {
        console.log('---stderr---');
        console.log(err.ffmpegErr);
      }
      if (err.spawnErr) {
        console.log('---spawn error---');
        console.log(err.spawnErr.stack || err.spawnErr);
      }
    }
  },

  logError: function(err, stdout, stderr) {
    if (err) {
      console.log('got error: ' + (err.stack || err));
      if (err.ffmpegOut) {
        console.log('---metadata stdout---');
        console.log(err.ffmpegOut);
      }
      if (err.ffmpegErr) {
        console.log('---metadata stderr---');
        console.log(err.ffmpegErr);
      }
      if (err.spawnErr) {
        console.log('---metadata spawn error---');
        console.log(err.spawnErr.stack || err.spawnErr);
      }
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
};
