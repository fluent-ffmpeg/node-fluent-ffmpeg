var exec = require('child_process').exec;

exports = module.exports = function Metadata(inputfile) {

  this.escapedPath = function(path)  {
    if(/http/.exec(path)) {
      path = path.replace(' ', '%20');
    } else {
      path = '"' + path + '"';
    }
    return path;
  };

  this.inputfile = inputfile;

  this.setFfmpegPath = function(path) {
    this.ffmpegPath = path;
  };

  // for internal use
  this.getMetadata = function(inputfile, callback) {
    this.inputfile = inputfile;
    this._loadDataInternal(callback);
  };

  // for external use
  this.get = function(callback) {
    // import extensions for external call
    require('./extensions').apply(Metadata.prototype);
    this._loadDataInternal(callback);
  };

  this._loadDataInternal = function(callback) {
    var inputfile = this.escapedPath(this.inputfile);
    var self = this;
    exec(this.ffmpegPath + ' -i ' + inputfile, function(err, stdout, stderr) {
      // parse data from stderr

      var none          = []
        , aspect        = /DAR ([0-9\:]+)/.exec(stderr) || none
        , video_bitrate = /bitrate: ([0-9]+) kb\/s/.exec(stderr) || none
        , fps           = /([0-9\.]+) (fps|tb\(r\))/.exec(stderr) || none
        , container     = /Input #0, ([a-zA-Z0-9]+),/.exec(stderr) || none
        , title         = /(INAM|title)\s+:\s(.+)/.exec(stderr) || none
        , artist        = /artist\s+:\s(.+)/.exec(stderr) || none
        , album         = /album\s+:\s(.+)/.exec(stderr) || none
        , track         = /track\s+:\s(.+)/.exec(stderr) || none
        , date          = /date\s+:\s(.+)/.exec(stderr) || none
        , video_stream  = /Stream #([0-9\.]+)([a-z0-9\(\)\[\]]*)[:] Video/.exec(stderr) || none
        , video_codec   = /Video: ([\w]+)/.exec(stderr) || none
        , duration      = /Duration: (([0-9]+):([0-9]{2}):([0-9]{2}).([0-9]+))/.exec(stderr) || none
        , resolution    = /(([0-9]{2,5})x([0-9]{2,5}))/.exec(stderr) || none
        , audio_bitrate = /Audio: [\w, ]+, ([0-9]+) kb\/s/.exec(stderr) || none
        , sample_rate   = /([0-9]+) Hz/i.exec(stderr) || none
        , audio_codec   = /Audio: ([\w]+)/.exec(stderr) || none
        , channels      = /Audio: [\w]+, [0-9]+ Hz, ([a-z0-9:]+)[a-z0-9\/,]*/.exec(stderr) || none
        , audio_stream  = /Stream #([0-9\.]+)([a-z0-9\(\)\[\]]*)[:] Audio/.exec(stderr) || none
        , is_synched    = (/start: 0.000000/.exec(stderr) !== null)
        , rotate        = /rotate[\s]+:[\s]([\d]{2,3})/.exec(stderr) || none
        , getVersion    = /ffmpeg version (?:(\d+)\.)?(?:(\d+)\.)?(\*|\d+)/i.exec(stderr)
        , ffmpegVersion = 0;

      if (getVersion) {
        ffmpegVersion = [
          getVersion[1]>=0 ? getVersion[1] : null,
          getVersion[2]>=0 ? getVersion[2] : null,
          getVersion[3]>=0 ? getVersion[3] : null
          ].filter(function(val) {
            return val !== null;
          }).join('.');
      }

      // build return object
      var ret = {
        ffmpegversion: ffmpegVersion
        , title: title[2] || ''
        , artist: artist[1] || ''
        , album: album[1] || ''
        , track: track[1] || ''
        , date: date[1] || ''
        , durationraw: duration[1] || ''
        , durationsec: duration[1] ? self.ffmpegTimemarkToSeconds(duration[1]) : 0
        , synched: is_synched
        , video: {
          container: container[1] || ''
          , bitrate: (video_bitrate.length > 1) ? parseInt(video_bitrate[1], 10) : 0
          , codec: video_codec[1] || ''
          , resolution: {
            w: resolution.length > 2 ? parseInt(resolution[2], 10) : 0
            , h: resolution.length > 3 ? parseInt(resolution[3], 10) : 0
          }
          , rotate: rotate.length > 1 ? parseInt(rotate[1], 10) : 0
          , fps: fps.length > 1 ? parseFloat(fps[1]) : 0.0
          , stream: video_stream.length > 1 ? parseFloat(video_stream[1]) : 0.0
        }
        , audio: {
          codec: audio_codec[1] || ''
          , bitrate: audio_bitrate.length > 1 ? parseInt(audio_bitrate[1], 10) : 0
          , sample_rate: sample_rate.length > 1 ? parseInt(sample_rate[1], 10) : 0
          , stream: audio_stream.length > 1 ? parseFloat(audio_stream[1]) : 0.0
        }
      };

      if (channels.length > 0) {
        ret.audio.channels = {stereo:2, mono:1}[channels[1]] || 0;
      }

      // save aspect ratio for auto-padding
      if (aspect.length > 0) {
        ret.video.aspectString = aspect[1];
        var n = aspect[1].split(":");
        ret.video.aspect = parseFloat((parseInt(n[0], 10) / parseInt(n[1], 10)).toFixed(2));
      } else {
        if(ret.video.resolution.w !== 0) {
          var f = self.gcd(ret.video.resolution.w, ret.video.resolution.h);
          ret.video.aspectString = ret.video.resolution.w/f + ':' + ret.video.resolution.h/f;
          ret.video.aspect = parseFloat((ret.video.resolution.w / ret.video.resolution.h).toFixed(2));
        } else {
          ret.video.aspect = 0.0;
        }
      }

      callback(ret);
    });
  };
};
