
exports = module.exports = function Extensions() {

  this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

  this.setFfmpegPath = function(path) {
    this.ffmpegPath = path;
  };

  this.determineFfmpegPath = function() {
    if (process.env.FFMPEG_PATH) {
      return process.env.FFMPEG_PATH;
    }
    return 'ffmpeg';
  };

  this.toAspectRatio = function(ar) {
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

  this.ffmpegTimemarkToSeconds = function(timemark) {
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

  this.parseVersionString = function(versionstr) {
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

  this.atLeastVersion = function(actualVersion, minVersion) {
    var minimum = this.parseVersionString(minVersion);
    var running = this.parseVersionString(actualVersion);

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
