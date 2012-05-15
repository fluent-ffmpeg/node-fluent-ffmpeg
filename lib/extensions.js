String.prototype.toAspectRatio = function() {
  var p = this.split(':');
  if (p.length != 2) {
    return undefined;
  } else {
    return {
      x: parseInt(p[0]),
      y: parseInt(p[1])
    };
  }
}

String.prototype.ffmpegTimemarkToSeconds = function() {
  var parts = this.split(':');
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
}

String.prototype.parseVersionString = function() {
  var x = this.split('.');
  // parse from string or default to 0 if can't parse
  var maj = parseInt(x[0]) || 0;
  var min = parseInt(x[1]) || 0;
  var pat = parseInt(x[2]) || 0;
  return {
    major: maj,
    minor: min,
    patch: pat
  }
}

String.prototype.atLeastVersion = function(minVersion) {
    var minimum = minVersion.parseVersionString();
    var running = this.parseVersionString();

    if (running.major != minimum.major)
        return (running.major > minimum.major);
    else {
        if (running.minor != minimum.minor)
            return (running.minor > minimum.minor);
        else {
            if (running.patch != minimum.patch)
                return (running.patch > minimum.patch);
            else
                return true;
        }
    }
};