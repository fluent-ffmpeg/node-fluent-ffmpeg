var fs = require('fs'),
  path = require('path'),
  async = require('../support/async.min.js'),
  exec = require('child_process').exec,
  spawn = require('child_process').spawn;

// import custom prototype extensions
require('./extensions');

function FfmpegCommand(source, timeout) { //timeout in milliseconds is optional
  // check if argument is a stream
  var srcstream, srcfile;
  if (typeof source === 'object') {
    if (source.readable) {
      // streaming mode
      source.pause();
      srcstream = source;
      srcfile = source.path;
    } else {
      throw new Error('Source is not a ReadableStream')
    }
  } else {
    // file mode
    srcfile = source;
  }
  
  this.options = {
    _isStreamable: true,
    _updateFlvMetadata: false,
    _useConstantVideoBitrate: false,
    _nice: {},
    inputfile: srcfile,
    inputstream: srcstream,
    timeout: timeout,
    video: {},
    audio: {},
    additional: [],
    informInputAudioCodec: null,
    informInputVideoCodec: null
  };

  var presets = {};
  
  // load presets
  fs.readdirSync(__dirname + '/presets').forEach(function(file) {
    var modname = file.substring(0, file.length - 3);
    var preset = require('./presets/' + modname);
    if (typeof preset.load == 'function') {
      presets[modname] = preset;
    }
  });
  
  // public chaining methods
  FfmpegCommand.prototype.usingPreset = function(preset) {
    if (presets[preset]) {
      return presets[preset].load(this);
    }
    return this;
  };
  FfmpegCommand.prototype.withVideoBitrate = function(vbitrate, type) {
    if (typeof vbitrate == 'string' && vbitrate.indexOf('k') > 0) {
      vbitrate = vbitrate.replace('k', '');
    }
    if (type && type == exports.CONSTANT_BITRATE) {
      this.options._useConstantVideoBitrate = true;
    }
    this.options.video.bitrate = parseInt(vbitrate);
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
  FfmpegCommand.prototype.withAspect = function(aspectRatio) {
    this.options.video.aspect = aspectRatio;
    return this;
  };
  FfmpegCommand.prototype.withVideoCodec = function(codec) {
    this.options.video.codec = codec;
    return this;
  };
  FfmpegCommand.prototype.withAudioBitrate = function(abitrate) {
    if (typeof abitrate == 'string' && abitrate.indexOf('k') > 0) {
      abitrate = abitrate.replace('k', '');
    }
    this.options.audio.bitrate = parseInt(abitrate);
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
  FfmpegCommand.prototype.setStartTime = function(timestamp) {
    this.options.starttime = timestamp;
    return this;
  };
  FfmpegCommand.prototype.setDuration = function(duration) {
    this.options.duration = duration;
    return this;
  };
  FfmpegCommand.prototype.addOptions = function(optionArray) {
    if (typeof optionArray.length != undefined) {
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
  FfmpegCommand.prototype.toFormat = function(format) {
    this.options.format = format;
    
    // some muxers require the output stream to be seekable, disable streaming for those formats
    if (this.options.format == 'mp4') {
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
  		throw new Error('niceness ' + level + ' is not valid, consider a value between -20 and +20 (whereas -20 is the highest priority)');
  	}
  	this.options._nice = { level: level };
  	return this;
  };
  FfmpegCommand.prototype.informInputAudioCodec = function(callback) { //callback(audioCodec)
    this.options.informAudioCb = callback;
    return this;
  };
  FfmpegCommand.prototype.informInputVideoCodec = function(callback) { //callback(videoCodec)
    this.options.informVideoCb = callback;
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
          this.options.video.width = parseInt(defaultSizestring[1]);
          this.options.video.height = parseInt(defaultSizestring[2]);
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
    exports.Metadata.get(this.options.inputfile, function(meta, err) {
      if (calcDimensions || calcPadding) {
        var dimErr, padErr;
        // calculate dimensions
        if (calcDimensions)
          dimErr = self._calculateDimensions(meta);
        
        // calculate padding
        if (calcPadding)
          padErr = self._calculatePadding(meta);
        
        if (dimErr || padErr) {
          callback(new Error('error while preparing: dimension -> ' + dimErr + ' padding -> ' + padErr));
        } else {
          callback(undefined, meta);
        }
      } else {
        callback(undefined, meta);
      }
    });
  };
};

// add module methods
require('./processor').call(FfmpegCommand.prototype);
require('./calculate').call(FfmpegCommand.prototype);
require('./debug').call(FfmpegCommand.prototype);

// module exports
exports = module.exports = function(source, timeout) {
  return new FfmpegCommand(source, timeout);
}

exports.Metadata = require('./metadata.js');
exports.CONSTANT_BITRATE = 1;
exports.VARIABLE_BITRATE = 2;
