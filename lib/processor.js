var fs = require('fs'),
  path = require('path'),
  async = require('../support/async.min.js'),
  exec = require('child_process').exec,
  spawn = require('child_process').spawn;

exports = module.exports = function Processor(command) {
  // constant for timeout checks
  this.E_PROCESSTIMEOUT = -99;
  
  this.saveToFile = function(targetfile, callback) {
    
    this.options.outputfile = targetfile;    
    var self = this;
    
    // parse options to command
    this._prepare(function(err, meta) {        
      if (err) {
        callback(null, null, err);
      } else {
        var args = self.buildFfmpegArgs(false);
      
        // start conversion of file using spawn
        var ffmpegProc;        
        if (self.options.inputstream) {
          // pump input stream to stdin
          ffmpegProc = self._spawnProcess(args, { customFds: [self.options.inputstream.fd, -1, -1] });  
        } else {
          ffmpegProc = self._spawnProcess(args);
        }

        //handle timeout if set
        var processTimer;
        if (self.options.timeout) {
          processTimer = setTimeout(function() {
            ffmpegProc.removeAllListeners('exit');
            ffmpegProc.kill('SIGKILL');
            callback(self.E_PROCESSTIMEOUT, 'timeout');
          }, self.options.timeout);
        }
        
        var stdout = '';
        var stderr = '';
        ffmpegProc.on('exit', function(code) {
          if (processTimer) clearTimeout(processTimer);          
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
  };
  
  this.writeToStream = function(stream, callback) {    
    if (!this.options._isStreamable) {
      callback(null, new Error('selected output format is not streamable'));
    } else {      
      var self = this;
      // parse options to command
      this._prepare(function(err, meta) {
        if (err) {
          callback(null, err);
        } else {          
          var args = self.buildFfmpegArgs(true);
          // write data to stdout
          args.push('pipe:1');
          
          // start conversion of file using spawn
          var ffmpegProc;          
          if (self.options.inputstream) {
            // pump input stream to stdin
            self.options.inputstream.resume();
            ffmpegProc = self._spawnProcess(args, { customFds: [self.options.inputstream.fd, stream.fd, -1] });            
          } else {
            ffmpegProc = self._spawnProcess(args, { customFds: [-1, stream.fd, -1] });
          }

          //handle timeout if set
          var processTimer;
          if (self.options.timeout) {
            processTimer = setTimeout(function() {
              ffmpegProc.removeAllListeners('exit');
              ffmpegProc.kill('SIGKILL');
              callback(self.E_PROCESSTIMEOUT, 'timeout');
            }, self.options.timeout);
          }
          
          var stderr = '';
          
          ffmpegProc.stderr.on('data', function(data) {
            stderr += data;
          });
          
          ffmpegProc.on('exit', function(code, signal) {
            if (processTimer) clearTimeout(processTimer);
            // close file descriptor on outstream
            fs.closeSync(stream.fd);
            if (self.options.inputstream)
              fs.closeSync(self.options.inputstream.fd);
            callback(code, stderr);
          });
        }
      });
    }
  };
  
  this.takeScreenshots = function(config, folder, callback) {
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
      callback(new Error("set size of thumbnails using 'withSize' method"));
    }
    
    var self = this;
    // check target folder      
    if (!path.existsSync(folder)) {
      fs.mkdir(folder, '0755', function(err) {
        if (err !== null) {
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
      // get correct dimensions
      self._prepare(function(err, meta) {
        if (meta.durationsec) {
          // check if all timemarks are inside duration
          if (timemarks !== null) {
            for (var i = 0; i < timemarks.length; i++) {
              if (parseInt(timemarks[i]) > (meta.durationsec * 0.9)) {
                // remove timemark from array
                timemarks.splice(i, 1);
              }
            }
            // if there are no more timemarks around, add one at end of the file
            if (timemarks.length == 0) {
              timemarks[0] = (meta.durationsec * 0.9);
            }
          }
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
              
              if (self.options._nice.level) {
                // execute ffmpeg through nice
                exec('nice --adjustment="' + self.options._nice.level + '" ffmpeg ' + tnArgs.join(' '), taskcallback);
              } else {                  
                exec('ffmpeg ' + tnArgs.join(' '), taskcallback);
              }
            },
            function(err) {
              callback(err);
            }
          );
        } else {
          callback(new Error("meta data contains no duration, aborting screenshot creation"));
        }
      });
    }
  };
  
  this._spawnProcess = function(args, options) {
    var retProc = spawn('ffmpeg', args, options);
    if (this.options._nice.level) {
      var niceLvl = (this.options._nice.level > 0 ? '+' + this.options._nice.level : this.options._nice.level);
      // renice the spawned process without waiting for callback
      exec('renice -n ' + niceLvl + ' -p ' + retProc.pid, function(err, stderr, stdout) {
        //console.log('successfully reniced process with pid ' + retProc.pid + ' to ' + niceLvl + ' niceness!');
      });
    }
    return retProc;
  };
  
  this.buildFfmpegArgs = function(overrideOutputCheck) {
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
    if (this.options.video.pad) {
      // we have padding arguments, push
      args.push('-vf');
      args.push('pad=' + this.options.video.pad.w +
        ':' + this.options.video.pad.h +
        ':' + this.options.video.pad.x +
        ':' + this.options.video.pad.y +
        ':' + this.options.video.padcolor);
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
};
