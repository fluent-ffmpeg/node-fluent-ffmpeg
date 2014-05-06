/*jshint node:true, laxcomma:true*/
'use strict';

var path = require('path');
var spawn = require('child_process').spawn;


function legacyTag(key) { return key.match(/^TAG:/); }
function legacyDisposition(key) { return key.match(/^DISPOSITION:/); }


exports = module.exports = function Metadata(FfmpegCommand) {
  // Run ffprobe on file and return results
  FfmpegCommand.ffprobe = function(filename, callback) {
    var stdout = '';
    var stdoutClosed = false;

    var ffprobe = spawn(FfmpegCommand.prototype.ffprobePath, [
        '-print_format', 'json',
        '-show_streams',
        '-show_format',
        filename
      ]);

    ffprobe.on('error', function(err) {
      callback(err);
    });

    // Ensure we wait for captured streams to end before calling callback
    var exitError = null;
    function handleExit(err) {
      if (err) {
        exitError = err;
      }

      if (processExited && stdoutClosed) {
        if (exitError) {
          return callback(exitError);
        }

        var data;

        try {
          data = JSON.parse(stdout);
        } catch(e) {
          return callback(e);
        }

        // Handle legacy output with "TAG:x" and "DISPOSITION:x" keys
        [data.format].concat(data.streams).forEach(function(target) {
          var legacyTagKeys = Object.keys(target).filter(legacyTag);

          if (legacyTagKeys.length) {
            target.tags = target.tags || {};

            legacyTagKeys.forEach(function(tagKey) {
              target.tags[tagKey.substr(4)] = target[tagKey];
              delete target[tagKey];
            });
          }

          var legacyDispositionKeys = Object.keys(target).filter(legacyDisposition);

          if (legacyDispositionKeys.length) {
            target.disposition = target.disposition || {};

            legacyDispositionKeys.forEach(function(dispositionKey) {
              target.disposition[dispositionKey.substr(12)] = target[dispositionKey];
              delete target[dispositionKey];
            });
          }
        });

        callback(null, data);
      }
    }

    var processExited = false;
    ffprobe.on('exit', function(code, signal) {
      processExited = true;

      if (code) {
        handleExit(new Error('ffprobe exited with code ' + code));
      } else if (signal) {
        handleExit(new Error('ffprobe was killed with signal ' + signal));
      } else {
        handleExit();
      }
    });

    ffprobe.stdout.on('data', function(data) {
      stdout += data;
    });

    ffprobe.stdout.on('close', function() {
      stdoutClosed = true;
      handleExit();
    });
  };

  // Run ffprobe on command input file
  FfmpegCommand.prototype.ffprobe = function(callback) {
    if (!this.options.inputfile) {
      callback(new Error('FfmpegCommand has no input file'));
    } else {
      FfmpegCommand.ffprobe(this.options.inputfile, callback);
    }
  };

  // for internal use
  FfmpegCommand.prototype.getMetadata = function(inputfile, callback) {
    this.inputfile = path.normalize(inputfile);
    this._loadDataInternal(callback);
  };

  // for external use
  FfmpegCommand.prototype.get = function(callback) {
    // import extensions for external call
    this.options.logger.warn('Warning: Metadata.get is deprecated, use require("fluent-ffmpeg").ffprobe instead');
    this._loadDataInternal(callback);
  };

  FfmpegCommand.prototype._loadDataInternal = function(callback) {
    var self = this;

    this._spawnFfmpeg(
      ['-i', this.inputfile],
      { captureStderr: true, captureStdout: true },
      function(err, stdout, stderr) {
        // parse data from stderr
        var none          = []
          , aspect        = /DAR ([0-9\:]+)/.exec(stderr) || none
          , pixel        = /[SP]AR ([0-9\:]+)/.exec(stderr) || none
          , video_bitrate = /bitrate: ([0-9]+) kb\/s/.exec(stderr) || none
          , fps           = /(INAM|fps)\s+:\s(.+)/i.exec(stderr) || none
          , container     = /Input #0, ([a-zA-Z0-9]+),/.exec(stderr) || none
          , title         = /(INAM|title)\s+:\s(.+)/i.exec(stderr) || none
          , artist        = /artist\s+:\s(.+)/i.exec(stderr) || none
          , album         = /album\s+:\s(.+)/i.exec(stderr) || none
          , track         = /track\s+:\s(.+)/i.exec(stderr) || none
          , date          = /date\s+:\s(.+)/i.exec(stderr) || none
          , video_stream  = /Stream #([0-9\.]+)([a-z0-9\(\)\[\]]*)[:] Video/.exec(stderr) || none
          , video_codec   = /Video: ([\w]+)/.exec(stderr) || none
          , duration      = /Duration: (([0-9]+):([0-9]{2}):([0-9]{2}).([0-9]+))/.exec(stderr) || none
          , resolution    = /Video: .+ (([0-9]{2,5})x([0-9]{2,5}))/.exec(stderr) || none
          , audio_bitrate = /Audio:(.)*, ([0-9]+) kb\/s/.exec(stderr) || none
          , sample_rate   = /([0-9]+) Hz/i.exec(stderr) || none
          , audio_codec   = /Audio: ([\w]+)/.exec(stderr) || none
          , channels      = /Audio: [\w]+, [0-9]+ Hz, ([a-z0-9:]+)[a-z0-9\/,]*/.exec(stderr) || none
          , audio_stream  = /Stream #([0-9\.]+)([a-z0-9\(\)\[\]]*)[:] Audio/.exec(stderr) || none
          , is_synched    = (/start: 0.000000/.exec(stderr) !== null)
          , rotate        = /rotate[\s]+:[\s]([\d]{2,3})/.exec(stderr) || none
          , getVersion    = /ffmpeg version (?:(\d+)\.)?(?:(\d+)\.)?(\*|\d+)/i.exec(stderr)
          , major_brand   = /major_brand\s+:\s([^\s]+)/.exec(stderr) || none
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
        var n
          , _ref
          , ret = {
          ffmpegversion: ffmpegVersion
          , title: title[2] || ''
          , artist: artist[1] || ''
          , album: album[1] || ''
          , track: track[1] || ''
          , date: date[1] || ''
          , durationraw: duration[1] || ''
          , durationsec: duration[1] ? self.ffmpegTimemarkToSeconds(duration[1]) : 0
          , synched: is_synched
          , major_brand: major_brand[1]
          , video: {
            container: container[1] || ''
            , bitrate: (video_bitrate.length > 1) ? parseInt(video_bitrate[1], 10) : 0
            , codec: video_codec[1] || ''
            , resolution: {
              w: resolution.length > 2 ? parseInt(resolution[2], 10) : 0
              , h: resolution.length > 3 ? parseInt(resolution[3], 10) : 0
            }
            , resolutionSquare: {}
            , rotate: rotate.length > 1 ? parseInt(rotate[1], 10) : 0
            , fps: fps.length > 1 ? parseFloat(fps[2]) : 0.0
            , stream: video_stream.length > 1 ? parseFloat(video_stream[1]) : 0.0
          }
          , audio: {
            codec: audio_codec[1] || ''
            , bitrate: parseInt((_ref = audio_bitrate[audio_bitrate.length - 1]) !== undefined ? _ref : 0, 10)
            , sample_rate: sample_rate.length > 1 ? parseInt(sample_rate[1], 10) : 0
            , stream: audio_stream.length > 1 ? parseFloat(audio_stream[1]) : 0.0
          },
          ffmpegOut: stdout,
          ffmpegErr: stderr,
          spawnErr: err
        };

        if (channels.length > 0) {
          ret.audio.channels = {stereo:2, mono:1}[channels[1]] || 0;
        }

        // save aspect ratio for auto-padding
        if (aspect.length > 0) {
          ret.video.aspectString = aspect[1];
          n = aspect[1].split(':');
          ret.video.aspect = parseFloat((parseInt(n[0], 10) / parseInt(n[1], 10)));
        } else {
          if(ret.video.resolution.w !== 0) {
            var f = self.gcd(ret.video.resolution.w, ret.video.resolution.h);
            ret.video.aspectString = ret.video.resolution.w/f + ':' + ret.video.resolution.h/f;
            ret.video.aspect = parseFloat((ret.video.resolution.w / ret.video.resolution.h));
          } else {
            ret.video.aspect = 0.0;
          }
        }

        // save pixel ratio for output size calculation
        if (pixel.length > 0) {
          ret.video.pixelString = pixel[1];
          n = pixel[1].split(':');
          ret.video.pixel = parseFloat((parseInt(n[0], 10) / parseInt(n[1], 10)));
        } else {
          if (ret.video.resolution.w !== 0) {
            ret.video.pixelString = '1:1';
            ret.video.pixel = 1;
          } else {
            ret.video.pixel = 0.0;
          }
        }

        // correct video.resolution when pixel aspectratio is not 1
        if (ret.video.pixel !== 1 || ret.video.pixel !== 0) {
          if( ret.video.pixel > 1 ) {
            ret.video.resolutionSquare.w = parseInt(ret.video.resolution.w * ret.video.pixel, 10);
            ret.video.resolutionSquare.h = ret.video.resolution.h;
          } else {
            ret.video.resolutionSquare.w = ret.video.resolution.w;
            ret.video.resolutionSquare.h = parseInt(ret.video.resolution.h / ret.video.pixel, 10);
          }
        }

        callback(ret);
      }
    );
  };

  return  function(filename, callback){
    this.options.logger.warn('Warning: Metadata.get is deprecated, use require("fluent-ffmpeg").ffprobe instead');
    (new FfmpegCommand({})).getMetadata(filename, callback);
  };
};

