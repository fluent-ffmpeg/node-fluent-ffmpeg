
exports = module.exports = function Debug(command) {
  this.dumpArgs = function() {
    var args = this.buildFfmpegArgs(true);
    console.log(require('util').inspect(args, false, null));
    return this;
  };
  
  this.dumpCommand = function(outputmethod) {
    var self = this;
    this._prepare(function(err, meta) {
      if (err) {
        console.log('dimension error: ' + err);
      } else {
        var args = self.buildFfmpegArgs(true, meta);
        // kinda hacky, have to make sure the returned object is no array
        if (args.length === undefined) {
          console.log(args);
        } else {
          var cmd = '';
          cmd += 'ffmpeg';
          args.forEach(function(el) {
            cmd += ' ' + el;
          });
          console.log(cmd);
        }
      }
    });
    return this;
  };
  
  this.getCommand = function(outputmethod, callback) {
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
  
  this.getArgs = function(callback) {
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