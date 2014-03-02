var fs       = require('fs'),
    path     = require('path'),
    async    = require('async'),
    os       = require('os').platform(),
    exec     = require('child_process').exec,
    spawn    = require('child_process').spawn,
    Registry = require('./registry'),


exports = module.exports = function Processor(command) {
  command.prototype._codecDataAlreadySent = false;

  command.prototype._process = function(target, pipeOptions) {
    var isStream;

    if (typeof target === 'string') {
      isStream = false;
      this.options.outputfile = path.normalize(target);
    } else {
      isStream = true;
      pipeOptions = pipeOptions || {};
    }

    var self = this;
    var options = this.options;

    // Check for flvtool2 presence if needed
    if (options._updateFlvMetadata) {
      if (isStream) {
        //return self.emit('error', new Error('Updating flv metadata is not supported for streams'));
        options.logger.warn('Updating flv metadata is not supported for streams');
        options._updateFlvMetadata = false;
        return doProcess();
      }

      self.hasFlvtool2(function(hasFlvtool2) {
        if (hasFlvtool2) {
          doProcess();
        } else {
          self.emit('error', new Error('Cannot find flvtool2'));
        }
      });
    } else {
      doProcess();
    }

    function doProcess() {
      // Ensure we send 'end' or 'error' only once
      var ended = false;
      function emitEnd(err, stdout, stderr) {
        if (!ended) {
          ended = true;

          if (err) {
            self.emit('error', err, stdout, stderr);
          } else {
            self.emit('end', stdout, stderr);
          }
        }
      }

      // Prepare dimensions, check codecs and formats
      self._prepare(function(err) {
        if (err) {
          return emitEnd(err);
        }

        // Prepare ffmpeg command line
        var args;
        try {
          args = self.buildFfmpegArgs(false);
        } catch(err) {
          return emitEnd(err);
        }

        if (isStream) {
          args.push('pipe:1');
        }

        self.emit('start', 'ffmpeg ' + args.join(' '));

        // Run ffmpeg

        var stdout = null;
        var stderr = '';
        self.ffmpegProc = self._spawnFfmpeg(args, function(err) {
          if (err) {
            emitEnd(err, stdout, stderr);
          } else {
            if (options._updateFlvMetadata) {
              spawn('flvtool2', ['-U', options.outputfile])
                .on('error', function(err) {
                  emitEnd(new Error('Error running flvtool2: ' + err.message));
                })
                .on('exit', function(code, signal) {
                  if (code !== 0 || signal) {
                    emitEnd(
                      new Error('flvtool2 ' +
                        (signal ? 'received signal ' + signal
                                : 'exited with code ' + code))
                    );
                  } else {
                    emitEnd(null, stdout, stderr);
                  }
                });
            } else {
              emitEnd(null, stdout, stderr);
            }
          }
        });

        if (options.inputstream) {
          // Pipe input stream to ffmpeg stdin
          options.inputstream.on('error', function(err) {
            emitEnd(new Error('Input stream error: ' + err.message));
            self.ffmpegProc.kill();
          });
          options.inputstream.resume();
          options.inputstream.pipe(self.ffmpegProc.stdin);
        }

        // Setup timeout if needed
        var processTimer;
        if (options.timeout) {
          processTimer = setTimeout(function() {
            var msg = 'process ran into a timeout (' + self.options.timeout + 's)';
            options.logger.warn(msg);
            
            emitEnd(new Error(msg));
            self.ffmpegProc.kill();
          }, options.timeout * 1000);
        }

        if (isStream) {
          // Pipe ffmpeg stdout to output stream
          self.ffmpegProc.stdout.pipe(target, pipeOptions);

          // Handle output stream events
          target.on('close', function() {
            options.logger.debug('Output stream closed, scheduling kill for ffmpgeg process');

            // Don't kill process yet, to give a chance to ffmpeg to
            // terminate successfully first  This is necessary because
            // under load, the process 'exit' event sometimes happens
            // after the output stream 'close' event.
            setTimeout(function() {
              emitEnd(new Error('Output stream closed'));
              self.ffmpegProc.kill();
            }, 20);
          });

          target.on('error', function(err) {
            options.logger.debug('Output stream error, killing ffmpgeg process');
            emitEnd(new Error('Output stream error: ' + err.message));
            self.ffmpegProc.kill();
          });
        } else {
          // Gather ffmpeg stdout
          stdout = '';
          self.ffmpegProc.stdout.on('data', function (data) {
            stdout += data;
          });
        }

        // Process ffmpeg stderr data
        self.ffmpegProc.stderr.on('data', function (data) {
          stderr += data;
          if (!self._codecDataAlreadySent && self.listeners('codecData').length) {
            self._checkStdErrForCodec(stderr);
          }
          if (self.listeners('progress').length) {
            self._getProgressFromStdErr(stderr, self.metaData.durationsec);
          }
        });
      });
    }
  };

  command.prototype.saveToFile = function(targetfile, callback) {
    if (callback) {
      this.options.logger.warn('saveToFile callback is deprecated, use \'end\' and \'error\' events instead');

      this.on('error', function(err) { callback(null, null, err); });
      this.on('end', function(stdout, stderr) { callback(stdout, stderr); });
    }

    this._process(targetfile);
  };

  command.prototype.writeToStream = function(stream, pipeOptions, callback) {
    if (typeof pipeOptions == 'function'){
        callback = pipeOptions;
        pipeOptions = {};
    }

    if (callback) {
      this.options.logger.warn('writeToStream callback is deprecated, use \'error\' and \'end\' events instead');
      this.on('error', function(err, stdout, stderr) { callback(null, err); });
      this.on('end', function(stdout, stderr) { callback(stdout, stderr); });
    }

    if (!this.options._isStreamable) {
      this.options.logger.error('selected output format is not streamable');
      return this.emit('error', new Error('selected output format is not streamable'));
    }

    this._process(stream, pipeOptions);
  };

  command.prototype.mergeToFile = function(targetfile, callback) {
    if (callback) {
      this.options.logger.warn('mergeToFile callback is deprecated, use \'end\' and \'error\' events instead');

      this.on('error', function(err) { callback(err); });
      this.on('end', function() { callback(); });
    }

    this.options.outputfile = path.normalize(targetfile);
    if(fs.existsSync(this.options.outputfile)){
      return this.emit('error', new Error('Output file already exists, merge aborted'));
    }

    var self = this;
    var options = this.options;

    function getExtension(filename) {
        var ext = path.extname(path.normalize(filename) || '').split('.');
        return ext[ext.length - 1];
    }

    // creates intermediate copies of each video.
    function makeIntermediateFile(_mergeSource,_callback) {
        var fname =  _mergeSource + '.temp.mpg';
        var args = self.options.additional.concat(['-i', _mergeSource, '-qscale:v', 1, fname]);

        self._spawnFfmpeg(args, function(err) {
          _callback(err, fname);
        });
    }

    // concat all created intermediate copies
    function concatIntermediates(target, intermediatesList, _callback) {
        var fname =  path.normalize(target) + '.temp.merged.mpg';

        var args = [
          // avoid too many log messages from ffmpeg
          '-loglevel', 'panic',
          '-i', 'concat:' + intermediatesList.join('|'),
          '-c', 'copy',
          fname
        ];

        self._spawnFfmpeg(args, {captureStdout:true,captureStderr:true}, function(err, stdout, stderr) {
          _callback(err, fname);
        });
    }

    function quantizeConcat(concatResult, numFiles, _callback) {
        var args = [
          '-i', concatResult,
          '-qscale:v',numFiles,
          targetfile
        ];

        self._spawnFfmpeg(args, function(err) {
          _callback(err);
        });
    }

    function deleteIntermediateFiles(intermediates, callback) {
      async.each(intermediates, function(item,cb){
        fs.exists(item,function(exists){
          if(exists){
            fs.unlink(item ,cb);
          }
          else{
            cb();
          }

        });
      }, callback);
    }

    function makeProgress() {
      progress.createdFiles = progress.createdFiles + 1;
      progress.precent = progress.createdFiles / progress.totalFiles * 100;
      self.emit('progress', progress);
    }

    if (options.mergeList.length <= 0) {
      return this.emit('error', new Error('No file added to be merged'));
    }

    var mergeList = options.mergeList;
    mergeList.unshift(options.inputfile);

    var progress = {frames : 0,
                    currentFps: 0,
                    currentKbps: 0,
                    targetSize: 0,
                    timemark: 0,
                    percent: 0,
                    totalFiles: mergeList.length + 2,
                    createdFiles: 0};

    var toDelete = mergeList.map(function(name) { return name + '.temp.mpg'; });
    toDelete.push(this.options.outputfile + '.temp.merged.mpg');
    deleteIntermediateFiles(toDelete);

    var intermediateFiles = [];

    async.whilst(
      function(){
        return (mergeList.length !== 0);
      },
      function (callback){
        makeIntermediateFile(mergeList.shift(), function(err, createdIntermediateFile) {
          if(err) {
            return callback(err);
          }

          if(!createdIntermediateFile) {
            return callback(new Error('Invalid intermediate file'));
          }

          intermediateFiles.push(createdIntermediateFile);
          makeProgress();
          callback();
        });
      },
      function(err) {
        if (err) {
          return self.emit('error', err);
        }

        concatIntermediates(targetfile, intermediateFiles, function(err, concatResult) {
          if(err) {
            return self.emit('error', err);
          }

          if(!concatResult) {
            return self.emit('error', new Error('Invalid concat result file'));
          }

          makeProgress();
          quantizeConcat(concatResult, intermediateFiles.length, function() {
            makeProgress();
            // add concatResult to intermediates list so it can be deleted too.
            intermediateFiles.push(concatResult);
            deleteIntermediateFiles(intermediateFiles, function(err) {
              if (err) {
                self.emit('error', err);
              } else {
                self.emit('end');
              }
            });
          });
        });
      }
    );
  };

  command.prototype.takeScreenshots = function(config, folder, callback) {
    if (callback) {
      this.options.logger.warn('takeScreenshots callback is deprecated, use \'error\' and \'end\' events instead');
      this.on('error', function(err) { callback(err); });
      this.on('end', function(filenames) { callback(null, filenames); });
    }

    function _zeroPad(number, len) {
      len = len-String(number).length+2;
      return new Array(len<0?0:len).join('0')+number;
    }

    function _renderOutputName(j, offset) {
      var result = filename;
      if(/%0*i/.test(result)) {
        var numlen = String(result.match(/%(0*)i/)[1]).length;
        result = result.replace(/%0*i/, _zeroPad(j, numlen));
      }
      result = result.replace('%s', offset);
      result = result.replace('%w', self.options.video.width);
      result = result.replace('%h', self.options.video.height);
      result = result.replace('%r', self.options.video.width+'x'+self.options.video.height);
      result = result.replace('%f', path.basename(self.options.inputfile));
      result = result.replace('%b', path.basename(self.options.inputfile, path.extname(self.options.inputfile)));
      return result;
    }

    function _screenShotInternal(callback) {

      // get correct dimensions
      self._prepare(function(err) {
        if(err) {
          return self.emit('error', err);
        }
        if (!self.metaData.durationsec) {
          var errString = 'meta data contains no duration, aborting screenshot creation';
          self.options.logger.warn(errString);
          return self.emit('error', new Error(errString));
        }

        // check if all timemarks are inside duration
        if (Array.isArray(timemarks)) {
          for (var i = 0; i < timemarks.length; i++) {
            /* convert percentage to seconds */
            if( timemarks[i].indexOf('%') > 0 ) {
              timemarks[i] = (parseInt(timemarks[i], 10) / 100) * self.metaData.durationsec;
            }
            if (parseInt(timemarks[i], 10) > self.metaData.durationsec) {
              // remove timemark from array
              timemarks.splice(i, 1);
              --i;
            }
          }
          // if there are no more timemarks around, add one at end of the file
          if (timemarks.length === 0) {
            timemarks[0] = (self.metaData.durationsec * 0.9);
          }
        }
        // get positions for screenshots (using duration of file minus 10% to remove fade-in/fade-out)
        var secondOffset = (self.metaData.durationsec * 0.9) / screenshotcount;
        var donecount = 0;
        var series = [];

        // reset iterator
        var j = 1;

        var filenames = [];

        // use async helper function to generate all screenshots and
        // fire callback just once after work is done
        async.until(
          function() {
            return j > screenshotcount;
          },
          function(taskcallback) {
            var offset;
            if (Array.isArray(timemarks)) {
              // get timemark for current iteration
              offset = timemarks[(j - 1)];
            } else {
              offset = secondOffset * j;
            }
            var fname = _renderOutputName(j, offset) + (fileextension ? fileextension : '.jpg');
            var target = path.join(folder, fname);
            var input = self.options.inputfile;

            // build screenshot command
            var args = [
              '-ss', Math.floor(offset * 100) / 100,
              '-i', input,
              '-vcodec', 'mjpeg',
              '-vframes', '1',
              '-an',
              '-f', 'rawvideo',
              '-s', self.options.video.size,
            ];
            if (self.options.additional) {
              if (self.options.additional.length > 0) {
                self.options.additional.forEach(function(el) {
                  args.push(el);
                });
              }
            }
            args.push('-y', target);

            j++;

            self._spawnFfmpeg(args, taskcallback);
            filenames.push(fname);
          },
          function(err) {
            if (err) {
              self.emit('error', err);
            } else {
              self.emit('end', filenames);
            }
          }
        );
      });
    }

    var timemarks, screenshotcount, filename, fileextension;
    if (typeof config === 'object') {
      // use json object as config
      if (config.count) {
        screenshotcount = config.count;
      }
      if (config.timemarks) {
        timemarks = config.timemarks;
      }
      if (config.fileextension){
        fileextension = config.fileextension;
      }
    } else {
      // assume screenshot count as parameter
      screenshotcount = config;
      timemarks = null;
    }
    if (!this.options.video.size) {
      this.options.logger.warn("set size of thumbnails using 'withSize' method");
      callback(new Error("set size of thumbnails using 'withSize' method"));
    }

    filename = config.filename || 'tn_%ss';
    if(!/%0*i/.test(filename) && Array.isArray(timemarks) && timemarks.length > 1 ) {
      // if there are multiple timemarks but no %i in filename add one
      // so we won't overwrite the same thumbnail with each timemark
      filename += '_%i';
    }
    folder = folder || '.';

    var self = this;

    // WORKAROUND: exists will be moved from path to fs with node v0.7
    var check = fs.exists;
    if (!check) {
      check = path.exists;
    }

    this.options.requireMetaData = true;

    // check target folder
    check(folder, function(exists) {
      if (!exists) {
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
    });
  };

  command.prototype.kill = function(signal) {
    if (!this.ffmpegProc) {
      this.options.logger.error('no running ffmpeg process, cannot send signal');
    } else {
      this.ffmpegProc.kill(signal || 'SIGKILL');
    }

    return this;
  };

  command.prototype._getProgressFromStdErr = function(stderrString, totalDurationSec) {
    // get last stderr line
    var lastLine = stderrString.split(/\r\n|\r|\n/g);
    var ll = lastLine[lastLine.length - 2];
    var progress;
    if (ll) {
      progress = this._parseProgressLine(ll);
    }
    if (progress) {
      // build progress report object
      var ret = {
        frames: parseInt(progress.frame, 10),
        currentFps: parseInt(progress.fps, 10),
        currentKbps: parseFloat(progress.bitrate.replace("kbits/s", "")),
        targetSize: parseInt(progress.size, 10),
        timemark: progress.time
      };

      // calculate percent progress using duration
      if (totalDurationSec && totalDurationSec > 0) {
        ret.percent = (this.ffmpegTimemarkToSeconds(ret.timemark) / totalDurationSec) * 100;
      }

      this.emit('progress', ret);
    }
  };

  command.prototype._parseProgressLine = function(line) {
    var progress = {};

    // Remove all spaces after = and trim
    line  = line.replace(/=\s+/g, '=').trim();
    var progressParts = line.split(' ');

    // Split every progress part by "=" to get key and value
    for(var i = 0; i < progressParts.length; i++) {
      var progressSplit = progressParts[i].split("=", 2)
        , key = progressSplit[0]
        , value = progressSplit[1];

      // This is not a progress line
      if(typeof value === "undefined")
        return null;

      progress[key] = value
    }

    return progress
  };

  command.prototype._checkStdErrForCodec = function(stderrString) {
    var format= /Input #[0-9]+, ([^ ]+),/.exec(stderrString);
    var dur   = /Duration\: ([^,]+)/.exec(stderrString);
    var audio = /Audio\: (.*)/.exec(stderrString);
    var video = /Video\: (.*)/.exec(stderrString);
    var codecObject = { format: '', audio: '', video: '', duration: '' };

    if (format && format.length > 1) {
      codecObject.format = format[1];
    }

    if (dur && dur.length > 1) {
      codecObject.duration = dur[1];
    }

    if (audio && audio.length > 1) {
      audio = audio[1].split(', ');
      codecObject.audio = audio[0];
      codecObject.audio_details = audio;
    }
    if (video && video.length > 1) {
      video = video[1].split(', ');
      codecObject.video = video[0];
      codecObject.video_details = video;
    }

    var codecInfoPassed = /Press (\[q\]|ctrl-c) to stop/.test(stderrString);
    if (codecInfoPassed) {
      this.emit('codecData', codecObject);
      this._codecDataAlreadySent = true;
    }
  };

  command.prototype._spawnFfmpeg = function(args, options, callback) {
    var command = this.ffmpegPath;

    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    if (this.options._niceness && !os.match(/win(32|64)/)) {
      args.unshift('-n', this.options._niceness, command);
      command = 'nice';
    }

    var stdout = null;
    var stderr = null;
    var process = spawn(command, args, options);
    
    if (process.stderr) {
      process.stderr.setEncoding('utf8');
    }

    process.on('error', function(err) {
      callback(err);
    });

    process.on('exit', function(code, signal) {
      if (code) {
        callback(new Error('ffmpeg exited with code ' + code), stdout, stderr);
      } else if (signal) {
        callback(new Error('ffmpeg was killed with signal ' + signal), stdout, stderr);
      } else {
        callback(null, stdout, stderr);
      }
    });

    if (options.captureStdout) {
      stdout = '';
      process.stdout.on('data', function(data) {
        stdout += data;
      });
    }

    if (options.captureStderr) {
      stderr = '';
      process.stderr.on('data', function(data) {
        stderr += data;
      });
    }

    return process;
  };

  command.prototype.buildFfmpegArgs = function(overrideOutputCheck) {
    var args = [];

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
    if (this.options.inputfile && !this.options.inputstream && !this.options.inputlive) {
      // add input file fps
      if (this.options.video.fpsInput) {
        args.push('-r', this.options.video.fpsInput);
      }
      if (/^[a-z]+:\/\//.test(this.options.inputfile)) {
        args.push('-i', this.options.inputfile.replace(/ /g, '%20'));
      } else if (/%\d*d/.test(this.options.inputfile)) { // multi-file format - http://ffmpeg.org/ffmpeg.html#image2-1
        args.push('-i', this.options.inputfile.replace(/ /g, '\ '));
      } else {
        var fstats = fs.statSync(this.options.inputfile);
        if (fstats.isFile()) {
          // fix for spawn call with path containing spaces and quotes
          args.push('-i', this.options.inputfile.replace(/ /g, '\ ')
            .replace(/'/g, "\'")
            .replace(/"/g, "\""));
        } else {
          this.options.logger.error('input file is not readable');
          throw new Error('input file is not readable');
        }
      }
    // check for input stream
    } else if (this.options.inputstream) {
      // push args to make ffmpeg read from stdin
      args.push('-i', '-');
    } else if (this.options.inputlive){
    	//Check if input URI
    	if(/^[a-z]+:\/\//.test(this.options.inputfile)) {
    		// add input with live flag
    		args.push('-i', this.options.inputfile.replace(/ /g, '%20')+' live=1');
    	}else {
    		this.options.logger.error('live input URI is not valid');
    		throw new Error('live input URI is not valid');
    	}
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
      // we have padding arguments, push
      if (this.atLeastVersion(this.metaData.ffmpegversion, '0.7')) {
        // padding is not supported ffmpeg < 0.7 (only using legacy commands which were replaced by vfilter calls)
        videoFilters.push('pad=' + this.options.video.pad.w +
          ':' + this.options.video.pad.h +
          ':' + this.options.video.pad.x +
          ':' + this.options.video.pad.y +
          ':' + this.options.video.padcolor);
      } else {
        throw new Error("Your ffmpeg version " + this.metaData.ffmpegversion + " does not support padding");
      }
    }

    if (videoFilters.length) {
      args.push('-filter:v', videoFilters.join(','));
    }

    // add size and output file
    if (this.options.video.size && !this.options.video.skip) {
      args.push('-s', this.options.video.size);
    }

    // add output file fps
    if (this.options.video.fpsOutput) {
      args.push('-r', this.options.video.fpsOutput);
    }

    if (this.options.outputfile) {
      args.push('-y', this.options.outputfile);
    } else {
      if (!overrideOutputCheck) {
        this.options.logger.error('no outputfile specified');
      }
    }
    return args;
  };


  command.prototype._renice = function(process, niceness) {
    // only renice if running on a non-windows platform
    if (!os.match(/win(32|64)/)) {
      var niceLevel = niceness || 0;
      if (niceLevel > 0) {
        niceLevel = '+' + niceLevel;
      }

      var self = this;
      var renice = spawn('renice', ['-n', niceLevel, '-p', process.pid]);

      renice.on('error', function(err) {
        self.options.logger.warn('could not renice process ' + process.pid + ': ' + err.message);
      });

      renice.on('exit', function(code, signal) {
        if (code) {
          self.options.logger.warn('could not renice process ' + process.pid + ': renice exited with ' + code);
        } else if (signal) {
          self.options.logger.warn('could not renice process ' + process.pid + ': renice was killed by signal ' + signal);
        } else {
          self.options.logger.info('successfully reniced process ' + process.pid + ' to ' + niceLevel + ' niceness!');
        }
      })
    }
  };
};
