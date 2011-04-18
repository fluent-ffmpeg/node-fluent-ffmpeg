var exec = require('child_process').exec;

module.exports = {
  get: function(inputfile, callback) {
    try
    {
      exec('ffmpeg -i ' + inputfile, function(err, stdout, stderr) {
        // parse data from stderr
        var aspect = /(4|3|16):(3|2|9|10)/.exec(stderr);
        var bitrate = /bitrate: ([0-9]+) kb\/s/.exec(stderr);
        var duration = /Duration: (([0-9]+):([0-9]{2}):([0-9]{2}).([0-9]+))/.exec(stderr);
        var resolution = /(([0-9]{2,5})x([0-9]{2,5}))/.exec(stderr)
        
        // build return object
        var ret = {
            aspect: (aspect && aspect.length > 0) ? aspect[0] : '',
            durationraw: (duration && duration.length > 1) ? duration[1] : '',
            bitrate: (bitrate && bitrate.length > 1) ? bitrate[1] : '',
            resolution: {
              w: (resolution && resolution.length > 2) ? resolution[2] : 0,
              h: (resolution && resolution.length > 3) ? resolution[3] : 0
            }
        };
        
        // calculate duration in seconds
        if (duration && duration.length > 1) {
          var parts = duration[1].split(':');
          var secs = 0;
          // add hours
          secs += parseInt(parts[0]) * 3600;
          // add minutes
          secs += parseInt(parts[1]) * 60;
          // add seconds
          secs += parseInt(parts[2]);
          ret.durationsec = secs;
        }
        
        callback(ret);
      });
    } catch (err) {
      callback(null, err);
    }
  }
}
