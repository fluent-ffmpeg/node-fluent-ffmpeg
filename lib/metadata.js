var exec = require('child_process').exec;

var meta = module.exports = {
  escapedPath: function(path)  {
    if(/http/.exec(path)) {
        path = path.replace(' ', '%20');
    } else {
        path = '"' + path + '"';
    }
    return path;
  },
  get: function(inputfile, callback) {
    try
    {
      inputfile = meta.escapedPath(inputfile);
      exec(process.env.FFMPEG_PATH || 'ffmpeg' + ' -i ' + inputfile, function(err, stdout, stderr) {
        // parse data from stderr
        var aspect = /DAR ([0-9\:]+)/.exec(stderr);
        var video_bitrate = /bitrate: ([0-9]+) kb\/s/.exec(stderr);
        var fps = /([0-9\.]+) (fps|tb\(r\))/.exec(stderr);
        var container = /Input #0, ([a-zA-Z0-9]+),/.exec(stderr);
        var title = /title *: ([^\n]+)/.exec(stderr);
        var video_stream = /Stream #([0-9\.]+)([a-z0-9\(\)\[\]]*)[:] Video/.exec(stderr);
        var video_codec = /Video: ([\w]+)/.exec(stderr);
        var duration = /Duration: (([0-9]+):([0-9]{2}):([0-9]{2}).([0-9]+))/.exec(stderr);
        var resolution = /(([0-9]{2,5})x([0-9]{2,5}))/.exec(stderr)
        var audio_bitrate = /Audio: [\w, ]+, ([0-9]+) kb\/s/.exec(stderr);
        var sample_rate = /([0-9]+) Hz/i.exec(stderr);
        var audio_codec = /Audio: ([\w]+)/.exec(stderr);
        var channels = /Audio: [\w]+, [0-9]+ Hz, ([a-z0-9:]+)[a-z0-9\/,]*/.exec(stderr);
        var audio_stream = /Stream #([0-9\.]+)([a-z0-9\(\)\[\]]*)[:] Audio/.exec(stderr);
        var is_synched = (/start: 0.000000/.exec(stderr) != null);

        // build return object
        var ret = {
          durationraw: (duration && duration.length > 1) ? duration[1] : '',
          title: (title && title.length > 1) ? title[1] : null,
          synched: is_synched,
          video: {
            container: (container && container.length > 0) ? container[1] : '',
            bitrate: (video_bitrate && video_bitrate.length > 1) ? parseInt(video_bitrate[1]) : 0,
            codec: (video_codec && video_codec.length > 1) ? video_codec[1] : '',
            resolution: {
              w: (resolution && resolution.length > 2) ? parseInt(resolution[2]) : 0,
              h: (resolution && resolution.length > 3) ? parseInt(resolution[3]) : 0
            },
            fps: (fps && fps.length > 1) ? parseFloat(fps[1]) : 0.0,
            stream: (video_stream && video_stream.length > 1) ? parseFloat(video_stream[1]) : 0.0
          },
          audio: {
            codec: (audio_codec && audio_codec.length > 1) ? audio_codec[1] : '',
            bitrate: (audio_bitrate && audio_bitrate.length > 1) ? parseInt(audio_bitrate[1]) : 0,
            sample_rate: (sample_rate && sample_rate.length > 1) ? parseInt(sample_rate[1]) : 0,
            stream: (audio_stream && audio_stream.length > 1) ? parseFloat(audio_stream[1]) : 0.0
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

        if (channels && channels.length > 1) {
          if (channels[1] == "stereo") ret.audio.channels = 2;
          else if (channels[1] == "mono") ret.audio.channels = 1;
          else ret.audio.channels = 0;
        }

        if (aspect && aspect.length > 0) {
          var n = aspect[1].split(":");
          ret.video.aspect =  parseFloat((parseInt(n[0]) / parseInt(n[1])).toFixed(2));
        } else {
          if(ret.video.resolution.w != 0) {
            ret.video.aspect =  parseFloat((ret.video.resolution.w / ret.video.resolution.h).toFixed(2));
          } else {
            ret.video.aspect = 0.0;
          }
        }

        callback(ret);
      });
    } catch (err) {
      callback(null, err);
    }
  }
}
