/*jshint node:true*/
'use strict';

var fs = require('fs');

exports = module.exports = function(FfmpegCommand) {
  FfmpegCommand.prototype.buildFfmpegArgs = function(overrideOutputCheck, callback) {
    var args = [];
    var self = this;

    // add startoffset and duration
    if (this.options.starttime) {
      args.push('-ss', this.options.starttime);
    }

    if (this.options.video.loop) {
      if (this.atLeastVersion(this.meta().ffmpegversion, '0.9')){
        args.push('-loop', 1);
      }
      else{
        args.push('-loop_output', 1);
      }
    }


    // add input format
    if (this.options.fromFormat) {
      args.push('-f', this.options.fromFormat);
    }

    // add additional input options
    if (this.options.inputOptions) {
      if (this.options.inputOptions.length > 0) {
        this.options.inputOptions.forEach(function(el) {
          args.push(el);
        });
      }
    }

    // add input file (if using fs mode)
    if (this.options.inputfile && !this.options.inputstream) {
      // add input file fps
      if (this.options.video.fpsInput) {
        args.push('-r', this.options.video.fpsInput);
      }
      if (/^[a-z]+:\/\//.test(this.options.inputfile)) {
        args.push('-i', this.options.inputfile);
      } else if (/%\d*d/.test(this.options.inputfile)) { // multi-file format - http://ffmpeg.org/ffmpeg.html#image2-1
        args.push('-i', this.options.inputfile);
      } else {
        var fstats = fs.statSync(this.options.inputfile);
        if (fstats.isFile()) {
          // fix for spawn call with path containing spaces and quotes
          args.push('-i', this.options.inputfile);
        } else {
          this.options.logger.error('input file is not readable');
          return callback(new Error('input file is not readable'));
        }
      }
    // check for input stream
    } else if (this.options.inputstream) {
      // push args to make ffmpeg read from stdin
      args.push('-i', '-');
    }

    if (this.options.otherInputs) {
      if (this.options.otherInputs.length > 0) {
        this.options.otherInputs.forEach(function(el) {
          args.push('-i', el);
        });
      }
    }

    if (this.options.strictExperimental) {
      args.push('-strict', 'experimental');
    }

    if (this.options.duration) {
      args.push('-t', this.options.duration);
    }

    if (this.options.video.framecount) {
      args.push('-vframes', this.options.video.framecount);
    }

    // add format
    if (this.options.format) {
      args.push('-f', this.options.format);
    }

    // add video options
    if (this.options.video.skip) {
      // skip video stream completely (#45)
      args.push('-vn');
    } else {
      if (this.options.video.bitrate) {
        args.push('-b:v', this.options.video.bitrate + 'k');
        if (this.options._useConstantVideoBitrate) {
          // add parameters to ensure constant bitrate encoding
          args.push('-maxrate', this.options.video.bitrate + 'k');
          args.push('-minrate', this.options.video.bitrate + 'k');
          args.push('-bufsize', '3M');
        }
      }
      if (this.options.video.codec) {
        args.push('-vcodec', this.options.video.codec);
      }
      if (this.options.video.fps) {
        args.push('-r', this.options.video.fps);
      }
      if (this.options.video.aspect) {
        args.push('-aspect', this.options.video.aspect);
      }
    }

    // add video options
    if (this.options.audio.skip) {
      // skip audio stream completely (#45)
      args.push('-an');
    } else {
      if (this.options.audio.bitrate) {
        args.push('-b:a', this.options.audio.bitrate + 'k');
      }
      if (this.options.audio.channels) {
        args.push('-ac', this.options.audio.channels);
      }
      if (this.options.audio.codec) {
        args.push('-acodec', this.options.audio.codec);
      }
      if (this.options.audio.frequency) {
        args.push('-ar', this.options.audio.frequency);
      }
      if (this.options.audio.quality || this.options.audio.quality === 0) {
        args.push('-aq', this.options.audio.quality);
      }
    }

    if (this.options.audio.filters) {
      args.push('-filter:a', this.options.audio.filters.join(','));
    }

    // add additional options
    if (this.options.additional) {
      if (this.options.additional.length > 0) {
        this.options.additional.forEach(function(el) {
          args.push(el);
        });
      }
    }

    var videoFilters = this.options.video.filters || [];

    if (this.options.video.pad && !this.options.video.skip) {
      // we have padding arguments, push pad filter if available
      this.getAvailableFilters(function(err, filters) {
        if (err) {
          return callback(new Error('Could not get available filters: %s', err.message));
        }

        if ('pad' in filters) {
          videoFilters.push('pad=' + self.options.video.pad.w +
            ':' + self.options.video.pad.h +
            ':' + self.options.video.pad.x +
            ':' + self.options.video.pad.y +
            ':' + self.options.video.padcolor);

          finishArguments();
        } else {
          callback(new Error('Your ffmpeg version does not support padding ("pad" filter not available)'));
        }
      });
    } else {
      finishArguments();
    }

    function finishArguments() {
      if (videoFilters.length) {
        args.push('-filter:v', videoFilters.join(','));
      }

      // add size and output file
      if (self.options.video.size && !self.options.video.skip) {
        args.push('-s', self.options.video.size);
      }

      // add output file fps
      if (self.options.video.fpsOutput) {
        args.push('-r', self.options.video.fpsOutput);
      }

      if (self.options.outputfile) {
        args.push('-y', self.options.outputfile);
      } else {
        if (!overrideOutputCheck) {
          self.options.logger.error('no outputfile specified');
        }
      }

      callback(null, args);
    }
  };
};