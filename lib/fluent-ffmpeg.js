/*jshint node:true*/
'use strict';

var util = require('util'),
  EventEmitter = require('events').EventEmitter;

/* options object consists of the following keys:
 * - source: either a ReadableStream or the path to a file (required)
 * - timeout: timeout in seconds for all ffmpeg sub-processes (optional, defaults to 30)
 * - priority: default-priority for all ffmpeg sub-processes (optional, defaults to 0)
 * - logger: add a winston logging instance (optional, default is no logging)
 * - nolog: completely disables any logging
 */
function FfmpegCommand(args) {
  EventEmitter.call(this);

  var source = args.source,
      timeout = (typeof args === 'object' && 'timeout' in args) ? args.timeout : 0,
      priority = args.priority || 0,
      logger = args.logger || null,
      nologging = args.nolog || false,
      presetsfolder = args.preset || './presets';

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
    _niceness: priority,
    keepPixelAspect: false,
    inputfile: srcfile,
    inputstream: srcstream,
    presets: presetsfolder,
    timeout: timeout,
    mergeList:[],
    video: {},
    audio: {},
    additional: [],
    inputOptions: [],
    otherInputs: [],
    informInputAudioCodec: null,
    informInputVideoCodec: null,
    logger: logger
  };

  // public chaining methods
  FfmpegCommand.prototype.usingPreset = function(preset) {
    if (typeof preset === 'function') {
      preset(this);
    } else {
      // require preset (since require() works like a singleton, multiple calls generate no overhead)
      try {
        var module = require(this.options.presets + '/' + preset);
        if (typeof module.load === 'function') {
          module.load(this);
        }
        return this;
      } catch (err) {
        throw new Error('preset ' + preset + ' could not be loaded');
      }
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
  FfmpegCommand.prototype.withVideoBitrate = function(vbitrate, constant) {
    if (typeof vbitrate === 'string' && vbitrate.indexOf('k') > 0) {
      vbitrate = vbitrate.replace('k', '');
    }
    if (constant) {
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
  FfmpegCommand.prototype.withStrictExperimental = function() {
    this.options.strictExperimental = true;
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
  FfmpegCommand.prototype.withVideoFilter = function(filter) {
    this.options.video.filters = this.options.video.filters || [];
    this.options.video.filters.push(filter);
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
  FfmpegCommand.prototype.withAudioFilter = function(filter) {
    this.options.audio.filters = this.options.audio.filters || [];
    this.options.audio.filters.push(filter);
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
  FfmpegCommand.prototype.addInputOptions = function(optionsArray) {
    return this.addOptions(optionsArray, true);
  };
  FfmpegCommand.prototype.addOptions = function(optionArray, forInput) {
    var target = forInput ? this.options.inputOptions : this.options.additional;

    if (typeof optionArray.length !== undefined) {
        optionArray.forEach(function(el) {
          if (el.indexOf(' ') > 0) {
            var values = el.split(' ');
            target.push(values[0], values[1]);
          } else {
            target.push(el);
          }
        });
    }
    return this;
  };
  FfmpegCommand.prototype.addInputOption = function(option, value) {
    return this.addOption(option, value, true);
  };
  FfmpegCommand.prototype.addOption = function(option, value, forInput) {
    var target = forInput ? this.options.inputOptions : this.options.additional;
    target.push(option, value);
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

    this.options._niceness = level;

    if (this.ffmpegProc) {
      this._renice(this.ffmpegProc, level);
    }

    return this;
  };
  FfmpegCommand.prototype.onStart = function(callback) {
    this.options.logger.warn('onStart is deprecated, use on(\'start\', callback) instead');
    this.on('start', callback);
    return this;
  };
  FfmpegCommand.prototype.onCodecData = function(callback) {
    this.options.logger.warn('onCodecData is deprecated, use on(\'codecData\', callback) instead');
    this.on('codecData', callback);
    return this;
  };
  FfmpegCommand.prototype.onProgress = function(callback) {
    this.options.logger.warn('onProgress is deprecated, use on(\'progress\', callback) instead');
    this.on('progress', callback);
    return this;
  };
}
util.inherits(FfmpegCommand, EventEmitter);


// add module methods
require('./extensions')(FfmpegCommand);
var metaDataLib = require('./metadata')(FfmpegCommand);
require('./processor')(FfmpegCommand);
require('./arguments')(FfmpegCommand);
require('./capabilities')(FfmpegCommand);
require('./debug')(FfmpegCommand);

// module exports
exports = module.exports = FfmpegCommand;

// export meta data discovery

exports.Metadata = metaDataLib;

exports.CONSTANT_BITRATE = true;
