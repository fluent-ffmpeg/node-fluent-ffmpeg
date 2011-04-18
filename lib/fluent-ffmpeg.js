var fs = require('fs'),
  path = require('path'),
  exec = require('child_process').exec,
  spawn = require('child_process').spawn;

function FfmpegProcessor(source) {
  // check if argument is a stream
  var srcstream, srcfile;
  if (typeof source === 'object') {
    // streaming mode
    source.pause();
    srcstream = source;
    srcfile = source.path;
  } else {
    // file mode
    srcfile = source;
  }
  
  var options = {
    _isStreamable: true,
    _updateFlvMetadata: false,
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
  FfmpegProcessor.prototype.withVideoBitrate = function(vbitrate) {
    if (typeof vbitrate == 'string' && vbitrate.indexOf('k') > 0) {
      vbitrate = vbitrate.replace('k', '');
    }
    options.video.bitrate = parseInt(vbitrate);
    return this;
  };
  FfmpegProcessor.prototype.withSize = function(sizeString) {
    options.video.size = sizeString;
    return this;    
  };
  FfmpegProcessor.prototype.withFps = function(fps) {
    options.video.fps = fps;
    return this;
  };
  FfmpegProcessor.prototype.withAspect = function(aspectRatio) {
    options.video.aspect = aspectRatio;
    return this;
  };
  FfmpegProcessor.prototype.withVideoCodec = function(codec) {
    options.video.codec = codec;
    return this;
  };
  FfmpegProcessor.prototype.withAudioBitrate = function(abitrate) {
    if (typeof abitrate == 'string' && abitrate.indexOf('k') > 0) {
      abitrate = abitrate.replace('k', '');
    }
    options.audio.bitrate = parseInt(abitrate);
    return this;
  };
  FfmpegProcessor.prototype.withAudioCodec = function(audiocodec){
    options.audio.codec = audiocodec;
    return this;
  };
  FfmpegProcessor.prototype.withAudioChannels = function(audiochannels) {
    options.audio.channels = audiochannels;
    return this;
  };
  FfmpegProcessor.prototype.withAudioFrequency = function(frequency) {    
    options.audio.frequency = frequency;
    return this;
  };
  FfmpegProcessor.prototype.setStartTime = function(timestamp) {
    options.starttime = timestamp;
    return this;
  };
  FfmpegProcessor.prototype.setDuration = function(duration) {
    options.duration = duration;
    return this;
  };
  FfmpegProcessor.prototype.addOptions = function(optionArray) {
    if (typeof optionArray.length != undefined) {
        optionArray.forEach(function(el) {
          if (el.indexOf(' ') > 0) {
            var values = el.split(' ');
            options.additional.push(values[0], values[1]);
          } else {
            options.additional.push(el);            
          }
        });
    }
    return this;
  };
  FfmpegProcessor.prototype.addOption = function(option, value) {
    options.additional.push(option, value);
    return this;
  };
  FfmpegProcessor.prototype.toFormat = function(format) {
    options.format = format;
    
    // some muxers require the output stream to be seekable, disable streaming for those formats
    if (options.format == 'mp4') {
      options._isStreamable = false;
    }
      
    return this;
  };
  FfmpegProcessor.prototype.updateFlvMetadata = function() {
    options._updateFlvMetadata = true;
    return this;
  };
  FfmpegProcessor.prototype.takeScreenshots = function(screenshotcount, folder, callback) {
    try {
      if (!options.video.size) {
        throw new Error("set size of thumbnails using 'withSize' method");
      }
      
      // check target folder      
      if (!path.existsSync(folder)) {
        fs.mkdirSync(folder, '0755');
      }
      
      // read metadata from file
      var self = this;
      exports.Metadata.get(options.inputfile, function(meta, err) {
        if (meta.durationsec) {
          // get correct dimensions
          self._calculateDimensions(function(err) {
            // get positions for screenshots (using duration of file minus 10% to remove fade-in/fade-out)
            var secondOffset = Math.round((meta.durationsec * 0.9) / screenshotcount);
            for (var i = 1; i <= screenshotcount; i++) {
              var offset = secondOffset * i;
              var target = folder + '/tn_' + offset + 's.jpg';
              
              // build screenshot command
              var tnArgs = [
                '-ss', offset,
                '-i', options.inputfile,
                '-vcodec', 'mjpeg',
                '-vframes', '1',
                '-an',
                '-f', 'rawvideo',
                '-s', options.video.size,
                target
              ];
              
              // start thumbnail generation
              var error = '';
              var ffmpegProc = exec('ffmpeg ' + tnArgs.join(' '), function(err, stdout, stderr) {
                if (error !== null) {
                  error += err;
                }
              });
            }
            callback(error);
          });          
        } else {
          throw new Error("meta data contains no duration, aborting screenshot creation")
        }
      });
    } catch (err) {
      callback(err);
    }
  };
  FfmpegProcessor.prototype.saveToFile = function(targetfile, callback) {
    options.outputfile = targetfile;
    
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
          
          if (options.inputstream) {
            // pump input stream to stdin
            options.inputstream.resume();
            options.inputstream.pipe(ffmpegProc.stdin, { end: true });
          }
          
          var stdout = '';
          var stderr = '';
          ffmpegProc.on('exit', function(code) {
            // check if we have to run flvtool2 to update flash video meta data
            if (options._updateFlvMetadata === true) {
              // check if flvtool2 is installed
              exec('which flvtool2', function(whichErr, whichStdOut, whichStdErr) {
                if (whichStdOut != '') {
                  // update metadata in flash video
                  exec('flvtool2 -U ' + options.outputfile, function(flvtoolErr, flvtoolStdout, flvtoolStderr) {
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
      if (!options._isStreamable)
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
          
          if (options.inputstream) {
            // pump input stream to stdin
            options.inputstream.pipe(ffmpegProc.stdin);
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
    var fixedWidth = /([0-9]+)x\?/.exec(options.video.size);
    var fixedHeight = /\?x([0-9]+)/.exec(options.video.size);
    var percentRatio = /\b([0-9]{1,2})%/.exec(options.video.size);
    
    if (!fixedWidth && !fixedHeight && !percentRatio) {
      // check for invalid size string
      var defaultSizestring = /([0-9]+)x([0-9]+)/.exec(options.video.size);
      if (options.video.size && !defaultSizestring) {
        callback(new Error('could not parse size string, aborting execution'));
      } else {
        callback(null);
      }      
    } else {
      // load metadata and prepare size calculations
      exports.Metadata.get(options.inputfile, function(data, err) {
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
              
          options.video.size = w + 'x' + h;
          callback(null);
        } catch (err) {
          callback(err);
        }
      });
    }  
  };
  FfmpegProcessor.prototype._buildFfmpegArgs = function(overrideOutputCheck) {
    // add startoffset and duration
    var args = [];
    if (options.starttime) {
      args.push('-ss', options.starttime);
    }
    if (options.duration) {
      args.push('-t', options.duration);
    }
    
    // add input file (if using fs mode)
    if (options.inputfile && !options.inputstream) {
      try
      {
        var fstats = fs.statSync(options.inputfile);
        if (fstats.isFile()) {
          // fix for spawn call with path containing spaces
          args.push('-i', options.inputfile.replace(' ', '\ '));
        } else {
          throw new Error('input file is not readable');
        }
      } catch (err) {
        // handle error somehow
        throw err;
      }
    // check for input stream
    } else if (options.inputstream) {
      // push args to make ffmpeg read from stdin
      args.push('-i', '-');
    }
        
    // add format
    if (options.format) {
      args.push('-f', options.format);
    }
    
    // add video options
    if (options.video.bitrate) {
      args.push('-b', options.video.bitrate + 'k');
    }
    if (options.video.codec) {
      args.push('-vcodec', options.video.codec);
    }
    if (options.video.fps) {
      args.push('-keyint_min', options.video.fps);
    }
    if (options.video.aspect) {
      args.push('-aspect', options.aspect);
    }
    
    // add video options
    if (options.audio.bitrate) {
      args.push('-ab', options.audio.bitrate + 'k');
    }
    if (options.audio.channels) {
      args.push('-ac', options.audio.channels);
    }
    if (options.audio.codec) {
      args.push('-acodec', options.audio.codec);
    }
    if (options.audio.frequency) {
      args.push('-ar', options.audio.frequency);
    }
      
    // add additional options
    if (options.additional) {
      if (options.additional.length > 0) {
        options.additional.forEach(function(el) {
          args.push(el);
        });
      }
    }
    
    // add size and output file
    if (options.video.size) {
      args.push('-s', options.video.size);
    }
    if (options.outputfile) {
      args.push('-y', options.outputfile.replace(' ', '\ '));
    } else {
      if (!overrideOutputCheck) {
        throw new Error("no outputfile specified");
      }
    }
    
    return args;
  };
}

exports = module.exports = function(source) {
  return new FfmpegProcessor(source);
}

exports.Metadata = require('./metadata.js');
