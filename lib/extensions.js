
exports = module.exports = function Extensions(command) {

  command.prototype.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

  command.prototype.setFfmpegPath = function(path) {
    this.ffmpegPath = path;
  };

  command.prototype.determineFfmpegPath = function() {
    if (this.ffmpegPath) {
      return this.ffmpegPath;
    }
    return 'ffmpeg';
  };

  command.prototype.gcd = function(a, b) {
    if (!a && !b) {
      return 0;
    }
    while (a !== 0) {
      var z = b % a;
      b = a;
      a = z;
    }
    return b;
  };

  command.prototype.toAspectRatio = function(ar) {
    var p = ar.split(':');
    if (p.length !== 2) {
      return undefined;
    } else {
      return {
        x: parseInt(p[0], 10),
        y: parseInt(p[1], 10)
      };
    }
  };

  command.prototype.ffmpegTimemarkToSeconds = function(timemark) {
    var parts = timemark.split(':');
    var secs = 0;

    // add hours
    secs += parseInt(parts[0], 10) * 3600;
    // add minutes
    secs += parseInt(parts[1], 10) * 60;

    // split sec/msec part
    var secParts = parts[2].split('.');

    // add seconds
    secs += parseInt(secParts[0], 10);

    return secs;
  };

  command.prototype.parseVersionString = function(versionstr) {
    if (typeof versionstr != 'string' || versionstr.indexOf('.') == -1) {
      return false;
    }
    var x = versionstr.split('.');
    // parse from string or default to 0 if can't parse
    var maj = parseInt(x[0], 10) || 0;
    var min = parseInt(x[1], 10) || 0;
    var pat = parseInt(x[2], 10) || 0;
    return {
      major: maj,
      minor: min,
      patch: pat
    };
  };

  command.prototype.atLeastVersion = function(actualVersion, minVersion) {
    var minimum = this.parseVersionString(minVersion);
    var running = this.parseVersionString(actualVersion);

    // if we can't even parse the version string (affects git builds for windows),
    // we simply return true and assume a current build
    if (!running)
      return true;

    if (running.major !== minimum.major) {
      return (running.major > minimum.major);
    } else {
      if (running.minor !== minimum.minor) {
        return (running.minor > minimum.minor);
      } else {
        if (running.patch !== minimum.patch) {
          return (running.patch > minimum.patch);
        } else {
          return true;
        }
      }
    }
  };
};
