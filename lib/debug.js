exports = module.exports = function Debug(command) {
  command.prototype.getCommand = function(outputmethod, callback) {
    var self = this;
    this._prepare(function(err, meta) {
      if (err) {
        callback(null, err);
      } else {
        var args = self.buildFfmpegArgs(true, meta);
        // kinda hacky, have to make sure the returned object is no array
        if (args.length === undefined) {
          callback(null, args);
        } else {
          var cmd = '';
          cmd += 'ffmpeg';
          args.forEach(function(el) {
            cmd += ' ' + el;
          });
          callback(cmd, null);
        }
      }
    });
    return this;
  };

  command.prototype.getArgs = function(callback) {
    if (callback) {
      var self = this;
      this._prepare(function(err, meta) {
        if (err) {
          callback(null, err);
        } else {
          var args = self.buildFfmpegArgs(true, meta);
          // kinda hacky, have to make sure the returned object is no array
          if (args.length === undefined) {
            callback(null, args);
          } else {
            callback(args, null);
          }
        }
      });
    } else {
      return this.buildFfmpegArgs(true, null);
    }
  };
};