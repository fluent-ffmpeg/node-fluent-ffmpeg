/*jshint node:true*/
'use strict';

var fs = require('fs');

exports = module.exports = function(FfmpegCommand) {
  function getScalePadFilters(width, height, aspect, color) {
    /*
      let a be the input aspect ratio, A be the requested aspect ratio

      if a > A, padding is done on top and bottom
      if a < A, padding is done on left and right
     */

    return [
      /*
        In both cases, we first have to scale the input to match the requested size.
        When using computed width/height, we truncate them to multiples of 2

          scale=
            w=if(gt(a, A), width, trunc(height*a/2)*2):
            h=if(lt(a, A), height, trunc(width/a/2)*2)
       */

      'scale=\'' +
        'w=if(gt(a,' + aspect + '),' + width + ',trunc(' + height + '*a/2)*2):' +
        'h=if(lt(a,' + aspect + '),' + height + ',trunc(' + width + '/a/2)*2)\'',

      /*
        Then we pad the scaled input to match the target size

          pad=
            w=width:
            h=height:
            x=if(gt(a, A), 0, (width - iw)/2):
            y=if(lt(a, A), 0, (height - ih)/2)

        (here iw and ih refer to the padding input, i.e the scaled output)
       */

      'pad=\'' +
        'w=' + width + ':' +
        'h=' + height + ':' +
        'x=if(gt(a,' + aspect + '),0,(' + width + '-iw)/2):' +
        'y=if(lt(a,' + aspect + '),0,(' + height + '-ih)/2):' +
        'color=' + color + '\''
    ];
  }

  FfmpegCommand.prototype.getSizeFilters = function() {
    var pixelFilters = [];

    if (this.options.keepPixelAspect) {
      // Rescale to keep same display aspect ratio
      pixelFilters = [
        'scale=\'w=if(gt(sar,1),iw*sar,iw):h=if(lt(sar,1),ih/sar,ih)\'',
        'setsar=1'
      ];
    }

    if (!this.options.video.size) {
      // No size requested

      if (this.options.video.aspect) {
        this.options.logger.warn('Ignoring aspect ratio as withSize() was not called');
      }

      if (this.options._applyAutopad) {
        this.options.logger.warn('Ignoring auto padding as withSize() was not called');
      }

      // Keep original size
      return pixelFilters;
    }

    var fixedSize = this.options.video.size.match(/([0-9]+)x([0-9]+)/);
    var fixedWidth = this.options.video.size.match(/([0-9]+)x\?/);
    var fixedHeight = this.options.video.size.match(/\?x([0-9]+)/);
    var percentRatio = this.options.video.size.match(/\b([0-9]{1,3})%/);
    var width, height, aspect;

    if (percentRatio) {
      if (this.options.video.aspect) {
        this.options.logger.warn('Ignoring aspect ratio as withSize() was called with a percent ratio');
      }

      if (this.options._applyAutopad) {
        this.options.logger.warn('Ignoring auto padding as withSize() was called with a percent ratio');
      }

      var ratio = Number(percentRatio[1]) / 100;
      return pixelFilters.concat(['scale=trunc(iw*' + ratio + '/2)*2:trunc(ih*' + ratio + '/2)*2']);
    } else if (fixedSize) {
      // Round target size to multiples of 2
      width = Math.round(Number(fixedSize[1]) / 2) * 2;
      height = Math.round(Number(fixedSize[2]) / 2) * 2;

      aspect = width / height;

      if (this.options.video.aspect) {
        this.options.logger.warn('Ignoring aspect ratio as withSize() was called with a fixed size');
      }

      if (this.options._applyAutopad) {
        return pixelFilters.concat(getScalePadFilters(width, height, aspect, this.options.video.padcolor));
      }

      // No autopad requested, rescale to target size
      return pixelFilters.concat(['scale=' + width + ':' + height]);
    } else if (fixedWidth || fixedHeight) {
      if (this.options.video.aspect) {
        // Specified aspect ratio
        aspect = Number(this.options.video.aspect);
        if (isNaN(aspect)) {
          var match = this.options.video.aspect.match(/^(\d+):(\d+)$/);
          if (match) {
            aspect = Number(match[1]) / Number(match[2]);
          } else {
            throw new Error('Invalid aspect ratio: ' + this.options.video.aspect);
          }
        }

        width = fixedWidth ? fixedWidth[1] : Math.round(Number(fixedHeight[1]) * aspect);
        height = fixedHeight ? fixedHeight[1] : Math.round(Number(fixedWidth[1]) / aspect);

        // Round to multiples of 2
        width = Math.round(width / 2) * 2;
        height = Math.round(height / 2) * 2;

        if (this.options._applyAutopad) {
          return pixelFilters.concat(getScalePadFilters(width, height, aspect, this.options.video.padcolor));
        }

        // No autopad requested, rescale to target size
        return pixelFilters.concat(['scale=' + width + ':' + height]);
      } else {
        // Keep input aspect ratio

        if (this.options._applyAutopad) {
          this.options.logger.warn('Ignoring auto padding as input aspect is kept');
        }

        if (fixedWidth) {
          return pixelFilters.concat(['scale=' + (Math.round(Number(fixedWidth[1]) / 2) * 2) + ':trunc(ow/a/2)*2']);
        } else {
          return pixelFilters.concat(['scale=trunc(oh*a/2)*2:' + (Math.round(Number(fixedHeight[1]) / 2) * 2)]);
        }
      }
    } else {
      throw new Error('Invalid size specified: ' + this.options.video.size);
    }
  };

  FfmpegCommand.prototype.buildFfmpegArgs = function(overrideOutputCheck, callback) {
    var args = [];
    var self = this;

    // add startoffset and duration
    if (this.options.starttime) {
      args.push('-ss', this.options.starttime);
    }

    if (this.options.video.loop) {
      args.push('-loop', 1);
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

    var videoFilters;
    if (!this.options.video.skip) {
      try {
        videoFilters = (this.options.video.filters || []).concat(this.getSizeFilters());
      } catch(e) {
        return callback(e);
      }

      finishArguments();
    } else {
      videoFilters = [];
      finishArguments();
    }

    function finishArguments() {
      if (videoFilters.length) {
        args.push('-filter:v', videoFilters.join(','));
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