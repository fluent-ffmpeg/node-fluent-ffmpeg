/*jshint node:true*/
'use strict';

exports = module.exports = function extensions(FfmpegCommand) {
  FfmpegCommand.prototype.ffmpegTimemarkToSeconds = function(timemark) {
    // In case ffmpeg outputs the timemark as float
    if(timemark.indexOf(':') === -1 && timemark.indexOf('.') >= 0)
      return parseFloat(timemark);

    var parts = timemark.split(':');

    // add seconds
    var secs = parseFloat(parts.pop());

    if (parts.length) {
      // add minutes
      secs += parseInt(parts.pop(), 10) * 60;
    }

    if (parts.length) {
      // add hours
      secs += parseInt(parts.pop(), 10) * 3600;
    }

    return secs;
  };

  FfmpegCommand.prototype.parseVersionString = function(versionstr) {
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

  FfmpegCommand.prototype.atLeastVersion = function(actualVersion, minVersion) {
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
