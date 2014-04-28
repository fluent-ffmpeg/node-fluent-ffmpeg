/*jshint node:true*/
'use strict';

exports = module.exports = function debug(FfmpegCommand) {
  FfmpegCommand.prototype.getCommand = function(outputmethod, callback) {
    var self = this;
    this._prepare(function(err) {
      if (err) {
        callback(null, err);
      } else {
        self.buildFfmpegArgs(true, function(err, args) {
          if (err) {
            callback(null, err);
          } else {
            var cmd = '';
            cmd += 'ffmpeg';
            args.forEach(function(el) {
              cmd += ' ' + el;
            });
            callback(cmd, null);
          }
        });
      }
    });
    return this;
  };

  FfmpegCommand.prototype.getArgs = function(callback) {
    var self = this;
    this._prepare(function(err) {
      if (err) {
        callback(null, err);
      } else {
        self.buildFfmpegArgs(true, function(err, args) {
          if (err) {
            callback(null, err);
          } else {
            callback(args, null);
          }
        });
      }
    });
  };
};