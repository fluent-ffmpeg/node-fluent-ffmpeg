var path = require('path'),
  async = require('async'),
  exec = require('child_process').exec,
  spawn = require('child_process').spawn;

/* options object consists of the following keys:
 * - source: either a ReadableStream or the path to a file (required)
 * - timeout: timeout in seconds for all ffmpeg sub-processes (optional, defaults to 30)
 * - priority: default-priority for all ffmpeg sub-processes (optional, defaults to 0)
 * - logger: add a winston logging instance (optional, default is no logging)
 * - nolog: completely disables any logging
 */
function FfmpegCommand(args) {
  var source = args.source,
      timeout = args.timeout != null ? args.timeout : 30,
      priority = args.priority || 0,
      logger = args.logger || null,
      nologging = args.nolog || false,
      inputlive = args.inputlive || false;

  if (!logger || nologging) {
    // create fake object to route log calls
    logger = {
      debug: function() {},
      info: function() {},
      warn: function() {},
      error: function() {}
    };
  }

  // make sure execution is not killed on error
  logger.exitOnError = false;

  // check if argument is a stream
  var srcstream, srcfile;
  if (typeof source === 'object') {
    if (source.readable) {
      // streaming mode
      source.pause();
      srcstream = source;
      srcfile = source.path;
    } else {
      logger.error('Source is not a ReadableStream instance');
      throw new Error('Source is not a ReadableStream instance');
    }
  } else {
    // file mode
    srcfile = source;
  }

  this.options = {
    _isStreamable: true,
    _updateFlvMetadata: false,
    _useConstantVideoBitrate: false,
    _nice: { level: priority },
    keepPixelAspect: false,
    inputfile: srcfile,
    inputstream: srcstream,
    inputlive: inputlive,
    timeout: timeout,
    mergeList:[],
    video: {},
    audio: {},
    additional: [],
    otherInputs: [],
    informInputAudioCodec: null,
    informInputVideoCodec: null,
    logger: logger
  };

  // public chaining methods
  FfmpegCommand.prototype.usingPreset = function(preset) {
    // require preset (since require() works like a singleton, multiple calls generate no overhead)
    try {
      var module = require('./presets/' + preset);
      if (typeof module.load === 'function') {
        module.load(this);
      }
      return this;
    } catch (err) {
      throw new Error('preset ' + preset + ' could not be loaded');
    }
    return this;
  };
  FfmpegCommand.prototype.withNoVideo = function() {
    this.options.video.skip = true;
    return this;
  };
  FfmpegCommand.prototype.withNoAudio = function() {
    this.options.audio.skip = true;
    return this;
  };
  FfmpegCommand.prototype.withVideoBitrate = function(vbitrate, type) {
    if (typeof vbitrate === 'string' && vbitrate.indexOf('k') > 0) {
      vbitrate = vbitrate.replace('k', '');
    }
    if (type && type === exports.CONSTANT_BITRATE) {
      this.options._useConstantVideoBitrate = true;
    }
    this.options.video.bitrate = parseInt(vbitrate, 10);
    return this;
  };
  FfmpegCommand.prototype.withSize = function(sizeString) {
    this.options.video.size = sizeString;
    return this;
  };
  FfmpegCommand.prototype.applyAutopadding = function(autopad, color) {
    this.options._applyAutopad = autopad;
    if (!color) {
      this.options.video.padcolor = 'black';
    } else {
      this.options.video.padcolor = color;
    }
    return this;
  };
  FfmpegCommand.prototype.withFps = function(fps) {
    this.options.video.fps = fps;
    return this;
  };
  FfmpegCommand.prototype.withFpsInput = function(fps) {
    this.options.video.fpsInput = fps;
    return this;
  };
  FfmpegCommand.prototype.withFpsOutput = function(fps) {
    this.options.video.fpsOutput = fps;
    return this;
  };
  FfmpegCommand.prototype.withAspect = function(aspectRatio) {
    this.options.video.aspect = aspectRatio;
    return this;
  };
  FfmpegCommand.prototype.keepPixelAspect = function(bool) {
    this.options.keepPixelAspect = bool ? true : false;
    return this;
  };
  FfmpegCommand.prototype.withVideoCodec = function(codec) {
    this.options.video.codec = codec;
    return this;
  };
  FfmpegCommand.prototype.loop = function(duration) {
    this.options.video.loop = true;
    if (duration) {
      this.options.duration = duration;
    }
    return this;
  };
  FfmpegCommand.prototype.takeFrames = function(frameCount) {
    this.options.video.framecount = frameCount;
    return this;
  };
  FfmpegCommand.prototype.withAudioBitrate = function(abitrate) {
    if (typeof abitrate === 'string' && abitrate.indexOf('k') > 0) {
      abitrate = abitrate.replace('k', '');
    }
    this.options.audio.bitrate = parseInt(abitrate, 10);
    return this;
  };
  FfmpegCommand.prototype.withAudioCodec = function(audiocodec){
    this.options.audio.codec = audiocodec;
    return this;
  };
  FfmpegCommand.prototype.withAudioChannels = function(audiochannels) {
    this.options.audio.channels = audiochannels;
    return this;
  };
  FfmpegCommand.prototype.withAudioFrequency = function(frequency) {
    this.options.audio.frequency = frequency;
    return this;
  };
  FfmpegCommand.prototype.withAudioQuality = function(quality) {
    this.options.audio.quality = parseInt(quality, 10);
    return this;
  };
  FfmpegCommand.prototype.setStartTime = function(timestamp) {
    this.options.starttime = timestamp;
    return this;
  };
  FfmpegCommand.prototype.setDuration = function(duration) {
    this.options.duration = duration;
    return this;
  };
  FfmpegCommand.prototype.addInput = function(inputFile) {
    this.options.otherInputs.push(inputFile);
    return this;
  };
  FfmpegCommand.prototype.addOptions = function(optionArray) {
    if (typeof optionArray.length !== undefined) {
        var self = this;
        optionArray.forEach(function(el) {
          if (el.indexOf(' ') > 0) {
            var values = el.split(' ');
            self.options.additional.push(values[0], values[1]);
          } else {
            self.options.additional.push(el);
          }
        });
    }
    return this;
  };
  FfmpegCommand.prototype.addOption = function(option, value) {
    this.options.additional.push(option, value);
    return this;
  };
  FfmpegCommand.prototype.mergeAdd = function(path){
    this.options.mergeList.push(path);
    return this;
  };

  FfmpegCommand.prototype.fromFormat = function(format) {
    this.options.fromFormat = format;
    return this;
  };

  FfmpegCommand.prototype.toFormat = function(format) {
    this.options.format = format;

    // some muxers require the output stream to be seekable, disable streaming for those formats
    if (this.options.format === 'mp4') {
      this.options._isStreamable = false;
    }
    return this;
  };
  FfmpegCommand.prototype.updateFlvMetadata = function() {
    this.options._updateFlvMetadata = true;
    return this;
  };
  FfmpegCommand.prototype.renice = function(level) {
    if (!level) {
      // use 0 as default nice level (os default)
      level = 0;
    }

    // make sure niceness is within allowed boundaries
    if (level > 20 || level < -20) {
      this.options.logger.warn('niceness ' + level + ' is not valid, consider a value between -20 and +20 (whereas -20 is the highest priority)');
      level = 0;
    }
    this.options._nice.level = level;
    return this;
  };
  FfmpegCommand.prototype.onCodecData = function(callback) {
    this.options.onCodecData = callback;
    return this;
  };
  FfmpegCommand.prototype.onProgress = function(callback) {
    this.options.onProgress = callback;
    return this;
  };

  // private methods
  FfmpegCommand.prototype._prepare = function(callback) {
    var calcDimensions = false, calcPadding = false;

    // check for allowed sizestring formats and handle them accordingly
    var fixedWidth = /([0-9]+)x\?/.exec(this.options.video.size);
    var fixedHeight = /\?x([0-9]+)/.exec(this.options.video.size);
    var percentRatio = /\b([0-9]{1,2})%/.exec(this.options.video.size);

    if (!fixedWidth && !fixedHeight && !percentRatio) {
      // check for invalid size string
      var defaultSizestring = /([0-9]+)x([0-9]+)/.exec(this.options.video.size);
      if (this.options.video.size && !defaultSizestring) {
        callback(new Error('could not parse size string, aborting execution'));
        return;
      } else {
        // get width and height as integers (used for padding calculation)
        if (defaultSizestring) {
          this.options.video.width = parseInt(defaultSizestring[1], 10);
          this.options.video.height = parseInt(defaultSizestring[2], 10);
        }
        calcDimensions = false;
      }
    } else {
      calcDimensions = true;
    }

    // check if we have to check aspect ratio for changes and auto-pad the output
    if (this.options._applyAutopad) {
      calcPadding = true;
    }

    var self = this;

    if (calcDimensions || calcPadding || this.requiresMetaData()) {
      this.getMetadata(this.options.inputfile, function(meta, err) {
        self.metaData = meta;
        var dimErr, padErr;
        // calculate dimensions
        if (calcDimensions) {
          dimErr = self._calculateDimensions(meta);
        }

        // calculate padding
        if (calcPadding) {
          padErr = self._calculatePadding(meta);
        }

        if (dimErr || padErr) {
          callback(new Error('error while preparing: dimension -> ' + dimErr + ' padding -> ' + padErr));
        } else {
          callback(undefined);
        }
      });
    } else {
      callback(undefined);
    }
  };
}

// add module methods
require('./extensions')(FfmpegCommand);
var metaDataLib = require('./metadata')(FfmpegCommand);
require('./processor')(FfmpegCommand);
require('./calculate')(FfmpegCommand);
require('./debug')(FfmpegCommand);
// module exports
exports = module.exports = function(args) {
  return new FfmpegCommand(args);
};

// export meta data discovery

exports.Metadata = metaDataLib;
exports.Calculate = require('./calculate');

exports.CONSTANT_BITRATE = 1;
exports.VARIABLE_BITRATE = 2;
