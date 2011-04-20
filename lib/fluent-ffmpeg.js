var fs = require('fs'),
  path = require('path'),
  async = require('../support/async.min.js'),
  exec = require('child_process').exec,
  spawn = require('child_process').spawn;

function FfmpegProcessor(source) {
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
    inputfile: srcfile,
    inputstream: srcstream,
    video: {},
    audio: {},
    additional: []
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
  FfmpegProcessor.prototype.usingPreset = function(preset) {
    if (presets[preset]) {
      return presets[preset].load(this);
    }
    return this;
  };
  FfmpegProcessor.prototype.withVideoBitrate = function(vbitrate, type) {
    if (typeof vbitrate == 'string' && vbitrate.indexOf('k') > 0) {
      vbitrate = vbitrate.replace('k', '');
    }
    if (type && type == exports.CONSTANT_BITRATE) {
      this.options._useConstantVideoBitrate = true;
    }
    this.options.video.bitrate = parseInt(vbitrate);
    return this;
  };
  FfmpegProcessor.prototype.withSize = function(sizeString) {
    this.options.video.size = sizeString;
    return this;    
  };
  FfmpegProcessor.prototype.withFps = function(fps) {
    this.options.video.fps = fps;
    return this;
  };
  FfmpegProcessor.prototype.withAspect = function(aspectRatio) {
    this.options.video.aspect = aspectRatio;
    return this;
  };
  FfmpegProcessor.prototype.withVideoCodec = function(codec) {
    this.options.video.codec = codec;
    return this;
  };
  FfmpegProcessor.prototype.withAudioBitrate = function(abitrate) {
    if (typeof abitrate == 'string' && abitrate.indexOf('k') > 0) {
      abitrate = abitrate.replace('k', '');
    }
    this.options.audio.bitrate = parseInt(abitrate);
    return this;
  };
  FfmpegProcessor.prototype.withAudioCodec = function(audiocodec){
    this.options.audio.codec = audiocodec;
    return this;
  };
  FfmpegProcessor.prototype.withAudioChannels = function(audiochannels) {
    this.options.audio.channels = audiochannels;
    return this;
  };
  FfmpegProcessor.prototype.withAudioFrequency = function(frequency) {    
    this.options.audio.frequency = frequency;
    return this;
  };
  FfmpegProcessor.prototype.setStartTime = function(timestamp) {
    this.options.starttime = timestamp;
    return this;
  };
  FfmpegProcessor.prototype.setDuration = function(duration) {
    this.options.duration = duration;
    return this;
  };
  FfmpegProcessor.prototype.addOptions = function(optionArray) {
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
  FfmpegProcessor.prototype.addOption = function(option, value) {
    this.options.additional.push(option, value);
    return this;
  };
  FfmpegProcessor.prototype.toFormat = function(format) {
    this.options.format = format;
    
    // some muxers require the output stream to be seekable, disable streaming for those formats
    if (this.options.format == 'mp4') {
      this.options._isStreamable = false;
    }
      
    return this;
  };
  FfmpegProcessor.prototype.updateFlvMetadata = function() {
    this.options._updateFlvMetadata = true;
    return this;
  };
  FfmpegProcessor.prototype.takeScreenshots = function(config, folder, callback) {
    try {
      var timemarks, screenshotcount;
      if (typeof config === 'object') {
        // use json object as config
        if (config.count)
          screenshotcount = config.count;
        if (config.timemarks)
          timemarks = config.timemarks;
      } else {
        // assume screenshot count as parameter
        screenshotcount = config;
        timemarks = null;
      }
      if (!this.options.video.size) {
        throw new Error("set size of thumbnails using 'withSize' method");
      }
      
      var self = this;
      // check target folder      
      if (!path.existsSync(folder)) {
        fs.mkdir(folder, '0755', function(err) {
          if (err !== null || err !== undefined) {
            callback(err);
          } else {
            _screenShotInternal(callback);
          }
        });
      } else {
        _screenShotInternal(callback);
      }
      
      // read metadata from file
      function _screenShotInternal(callback) {
        exports.Metadata.get(self.options.inputfile, function(meta, err) {
          if (meta.durationsec) {
            // get correct dimensions
            self._calculateDimensions(function(err) {
              // get positions for screenshots (using duration of file minus 10% to remove fade-in/fade-out)
              var secondOffset = (meta.durationsec * 0.9) / screenshotcount;
              var donecount = 0;
              var series = [];
              
              var i = 1; 
              
              // use async helper function to generate all screenshots and
              // fire callback just once after work is done
              async.until(
                function() {
                  return i > screenshotcount;
                },
                function(taskcallback) {
                  var offset;
                  if (timemarks !== null) {
                    // get timemark for current iteration
                    offset = timemarks[(i - 1)];
                  } else {                    
                    offset = secondOffset * i;
                  }
                  var target = folder + '/tn_' + offset + 's.jpg';

                  // build screenshot command
                  var tnArgs = [
                    '-i', self.options.inputfile,
                    '-ss', offset,
                    '-vcodec', 'mjpeg',
                    '-vframes', '1',
                    '-an',
                    '-f', 'rawvideo',
                    '-s', self.options.video.size,
                    '-y', target
                  ];
                  
                  i++;
                  exec('ffmpeg ' + tnArgs.join(' '), taskcallback);
                },
                function(err) {
                  callback(err);
                }
              );
            });
          } else {
            throw new Error("meta data contains no duration, aborting screenshot creation")
          }
        });
      }
    } catch (err) {
      callback(err);
    }
  };
  FfmpegProcessor.prototype.saveToFile = function(targetfile, callback) {
    this.options.outputfile = targetfile;
    
    // parse options to command
    try
    {
      var self = this;
      
      this._calculateDimensions(function(err) {        
        if (err) {
          callback(null, null, err);
        } else {
          var args = self._buildFfmpegArgs(false);
        
          // start conversion of file using spawn
          var ffmpegProc = spawn('ffmpeg', args);
          
          if (self.options.inputstream) {
            // pump input stream to stdin
            self.options.inputstream.resume();
            self.options.inputstream.pipe(ffmpegProc.stdin, { end: true });
          }
          
          var stdout = '';
          var stderr = '';
          ffmpegProc.on('exit', function(code) {
            // check if we have to run flvtool2 to update flash video meta data
            if (self.options._updateFlvMetadata === true) {
              // check if flvtool2 is installed
              exec('which flvtool2', function(whichErr, whichStdOut, whichStdErr) {
                if (whichStdOut != '') {
                  // update metadata in flash video
                  exec('flvtool2 -U ' + self.options.outputfile, function(flvtoolErr, flvtoolStdout, flvtoolStderr) {
                    callback(stdout, stderr, null);
                  });
                } else {
                  callback(stdout, stderr, null);
                }
              });
            } else {
              callback(stdout, stderr, null);
            }
          });
          
          ffmpegProc.stdout.on('data', function (data) {
            stdout += data;
          });
          
          ffmpegProc.stderr.on('data', function (data) {            
            stderr += data;
          });
        }
      });      
    } catch(err) {
      callback(null, null, err);
    }
  };
  FfmpegProcessor.prototype.writeToStream = function(stream, callback) {    
    // parse options to command
    try
    {
      if (!this.options._isStreamable)
        throw new Error('selected output format is not streamable');
      
      var self = this;
      this._calculateDimensions(function(err) {
        if (err) {
          callback(null, err);
        } else {          
          var args = self._buildFfmpegArgs(true);
          // write data to stdout
          args.push('pipe:1');
          
          // start conversion of file using spawn
          var ffmpegProc = spawn('ffmpeg', args);
          
          if (self.options.inputstream) {
            // pump input stream to stdin
            self.options.inputstream.resume();
            self.options.inputstream.pipe(ffmpegProc.stdin);
          }
          
          var stderr = '';
          
          ffmpegProc.stderr.on('data', function(data) {
            stderr += data;
          });
          
          ffmpegProc.on('exit', function(code) {
            callback(code, stderr);
          });
          
          // pipe stdout to stream
          ffmpegProc.stdout.pipe(stream);
        }
      });      
    } catch(err) {
      callback(null, err);
    }
  };
  
  FfmpegProcessor.prototype.dumpArgs = function() {
    var args = this._buildFfmpegArgs(true);
    console.log(require('util').inspect(args, false, null));
    return this;
  };
  FfmpegProcessor.prototype.dumpCommand = function(outputmethod) {
    var self = this;
    this._calculateDimensions(function(err) {
      if (err) {
        console.log('dimension error: ' + err);
      } else {        
        var args = self._buildFfmpegArgs(true);
        var cmd = '';
        cmd += 'ffmpeg';
        args.forEach(function(el) {
          cmd += ' ' + el;
        });
        console.log(cmd);
      }
    });
    return this;
  };
  FfmpegProcessor.prototype.getCommand = function(outputmethod, callback) {
    var self = this;
    this._calculateDimensions(function(err) {
      if (err) {
        callback(null, err);
      } else {
        var args = self._buildFfmpegArgs(true);
        var cmd = '';
        cmd += 'ffmpeg';
        args.forEach(function(el) {
          cmd += ' ' + el;
        });
        callback(cmd, null);
      }
    });
    return this;
  }; 
  FfmpegProcessor.prototype.getArgs = function(callback) {
    if (callback) {
      var self = this;
      this._calculateDimensions(function(err) {
        if (err) {
          callback(null, err);
        } else {
          callback(self._buildFfmpegArgs(true), null);
        }
      });
    } else {
      return this._buildFfmpegArgs(true);
    }
  };
  
  // private methods
  FfmpegProcessor.prototype._calculateDimensions = function(callback) {
    // check for allowed sizestring formats and handle them accordingly
    var fixedWidth = /([0-9]+)x\?/.exec(this.options.video.size);
    var fixedHeight = /\?x([0-9]+)/.exec(this.options.video.size);
    var percentRatio = /\b([0-9]{1,2})%/.exec(this.options.video.size);
        
    if (!fixedWidth && !fixedHeight && !percentRatio) {
      // check for invalid size string
      var defaultSizestring = /([0-9]+)x([0-9]+)/.exec(this.options.video.size);
      if (this.options.video.size && !defaultSizestring) {
        callback(new Error('could not parse size string, aborting execution'));
      } else {
        callback(null);
      }      
    } else {
      // load metadata and prepare size calculations
      var self = this;
      exports.Metadata.get(this.options.inputfile, function(data, err) {
        try {
          var w, h;
          if (fixedWidth && fixedWidth.length > 0) {
            // calculate height of output
            if (!data.resolution.w)
              throw new Error('could not determine width of source video, aborting execution');
            
            var ratio = data.resolution.w / parseInt(fixedWidth[1]);
            w = parseInt(fixedWidth[1]);
            h = Math.round(data.resolution.h / ratio);
          } else if (fixedHeight && fixedHeight.length > 0) {
            // calculate width of output
            if (!data.resolution.h)
              throw new Error('could not determine height of source video, aborting execution');
            
            var ratio = data.resolution.h / parseInt(fixedHeight[1]);
            w = Math.round(data.resolution.w / ratio);
            h = parseInt(fixedHeight[1]);
          } else if (percentRatio && percentRatio.length > 0) {
            // calculate both height and width of output
            if (!data.resolution.w || !data.resolution.h)
              throw new Error('could not determine resolution of source video, aborting execution');
              
            var ratio = parseInt(percentRatio[1]) / 100;
            w = Math.round(data.resolution.w * ratio);
            h = Math.round(data.resolution.h * ratio);            
          } else {
            throw new Error('could not determine type of size string, aborting execution');
          }
          
          // for video resizing, width and height have to be a multiple of 2
          if (w % 2 == 1)
            w -= 1;
          if (h % 2 == 1)
            h -= 1;
              
          self.options.video.size = w + 'x' + h;
          callback(null);
        } catch (err) {
          callback(err);
        }
      });
    }  
  };
  FfmpegProcessor.prototype._buildFfmpegArgs = function(overrideOutputCheck) {
    var args = [];
        
    // add input file (if using fs mode)
    if (this.options.inputfile && !this.options.inputstream) {
      try
      {
        var fstats = fs.statSync(this.options.inputfile);
        if (fstats.isFile()) {
          // fix for spawn call with path containing spaces
          args.push('-i', this.options.inputfile.replace(' ', '\ '));
        } else {
          throw new Error('input file is not readable');
        }
      } catch (err) {
        // handle error somehow
        throw err;
      }
    // check for input stream
    } else if (this.options.inputstream) {
      // push args to make ffmpeg read from stdin
      args.push('-i', '-');
    }
    
    // add startoffset and duration
    if (this.options.starttime) {
      args.push('-ss', this.options.starttime);
    }
    if (this.options.duration) {
      args.push('-t', this.options.duration);
    }
        
    // add format
    if (this.options.format) {
      args.push('-f', this.options.format);
    }
    
    // add video options
    if (this.options.video.bitrate) {
      args.push('-b', this.options.video.bitrate + 'k');
      if (this.options._useConstantVideoBitrate) {
        // add parameters to ensure constant bitrate encoding
        args.push('-maxrate', this.options.video.bitrate + 'k');
        args.push('-minrate', this.options.video.bitrate + 'k');
        args.push('-bufsize', '3M');
      }
    } else {
      // use same quality for output as used in input
      args.push('-sameq');
    }
    if (this.options.video.codec) {
      args.push('-vcodec', this.options.video.codec);
    }
    if (this.options.video.fps) {
      args.push('-keyint_min', this.options.video.fps);
    }
    if (this.options.video.aspect) {
      args.push('-aspect', this.options.video.aspect);
    }
    
    // add video options
    if (this.options.audio.bitrate) {
      args.push('-ab', this.options.audio.bitrate + 'k');
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
      
    // add additional options
    if (this.options.additional) {
      if (this.options.additional.length > 0) {
        this.options.additional.forEach(function(el) {
          args.push(el);
        });
      }
    }
    
    // add size and output file
    if (this.options.video.size) {
      args.push('-s', this.options.video.size);
    }
    if (this.options.outputfile) {
      args.push('-y', this.options.outputfile.replace(' ', '\ '));
    } else {
      if (!overrideOutputCheck) {
        throw new Error("no outputfile specified");
      }
    }
    
    return args;
  };
}

// module exports
exports = module.exports = function(source) {
  return new FfmpegProcessor(source);
}

exports.Metadata = require('./metadata.js');
exports.CONSTANT_BITRATE = 1;
exports.VARIABLE_BITRATE = 2;
