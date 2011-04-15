var fs = require('fs'),
  path = require('path'),
  exec = require('child_process').exec,
  spawn = require('child_process').spawn;

function FfmpegProcessor(srcfile) {
  var options = {
    _isStreamable: true,
    inputfile: srcfile,
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
      exports.Metadata.get(options.inputfile, function(meta, err) {
        if (meta.durationsec) {
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
        } else {
          throw new Error("meta data contains no duration, aborting screenshot creation")
        }
      });
    } catch (err) {
      throw err;
    }
  };
  FfmpegProcessor.prototype.saveToFile = function(targetfile, callback) {
    options.outputfile = targetfile;
    
    // parse options to command
    try
    {
      var args = this._buildFfmpegArgs(false);
      
      // start conversion of file using spawn
      var ffmpegProc = spawn('ffmpeg', args);
      
      var stdout = '';
      var stderr = '';
            
      ffmpegProc.on('exit', function(code) {
        callback(stdout, stderr, null);
      });
      
      ffmpegProc.stdout.on('data', function (data) {
        stdout += data;
      });
      
      ffmpegProc.stderr.on('data', function (data) {
        stderr += data;
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
        
      var args = this._buildFfmpegArgs(true);
      // write data to stdout
      args.push('pipe:1');
      
      // start conversion of file using spawn
      var ffmpegProc = spawn('ffmpeg', args);
      var stderr = '';
      
      ffmpegProc.stderr.on('data', function(data) {
        stderr += data;
      });
      
      ffmpegProc.on('exit', function(code) {
        callback(code, stderr);
      });
      
      // pipe stdout to stream
      ffmpegProc.stdout.pipe(stream);
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
    var args = this._buildFfmpegArgs(true);
    var cmd = '';
    cmd += 'ffmpeg';
    args.forEach(function(el) {
      cmd += ' ' + el;
    });
    if (outputmethod == 'stream') {
      cmd += ' pipe:';
    } else {
      cmd += ' -y /path/to/outputfile.avi';
    }
    console.log(cmd);
    return this;
  }; 
  FfmpegProcessor.prototype.getArgs = function() {
    return this._buildFfmpegArgs(true);
  };
  
  // private methods
  FfmpegProcessor.prototype._buildFfmpegArgs = function(overrideOutputCheck) {
    // add startoffset and duration
    var args = [];
    if (options.starttime) {
      args.push('-ss', options.starttime);
    }
    if (options.duration) {
      args.push('-t', options.duration);
    }
    
    // add input file
    if (options.inputfile) {
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

exports = module.exports = function(srcfile) {
  return new FfmpegProcessor(srcfile);
}

exports.Metadata = {
  get: function(inputfile, callback) {
    try
    {
      exec('ffmpeg -i ' + inputfile, function(err, stdout, stderr) {
        // parse data from stderr
        var aspect = /(4|3|16):(3|2|9|10)/.exec(stderr);
        var bitrate = /bitrate: ([0-9]+) kb\/s/.exec(stderr);
        var duration = /Duration: (([0-9]+):([0-9]{2}):([0-9]{2}).([0-9]+))/.exec(stderr);
        var resolution = /(([0-9]{2,5})x([0-9]{2,5}))/.exec(stderr)
        
        // build return object
        var ret = {
            aspect: (aspect && aspect.length > 0) ? aspect[0] : '',
            durationraw: (duration && duration.length > 1) ? duration[1] : '',
            bitrate: (bitrate && bitrate.length > 1) ? bitrate[1] : '',
            resolution: {
              w: (resolution && resolution.length > 2) ? resolution[2] : 0,
              h: (resolution && resolution.length > 3) ? resolution[3] : 0
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
        
        callback(ret);
      });
    } catch (err) {
      callback(null, err);
    }
  }
}