/*jshint node:true, laxcomma:true*/
'use strict';

var fs       = require('fs'),
    path     = require('path'),
    async    = require('async'),
    os       = require('os').platform(),
    spawn    = require('child_process').spawn;


exports = module.exports = function processor(FfmpegCommand) {
  FfmpegCommand.prototype._codecDataAlreadySent = false;

  // Run ffprobe asynchronously and store data in command
  function runFfprobe(command) {
    command.ffprobe(function(err, data) {
      command._ffprobeData = data;
    });
  }

  // Do pre-processing checks and prepare command arguments
  // Calls callback(error, arguments)
  FfmpegCommand.prototype._prepare = function(callback, requiresMetadata) {
    var self = this;

    async.waterfall(
      [
        // Check codec and format capabilities
        function(cb) {
          self._checkCapabilities(cb);
        },

        // Read metadata if required
        function(cb) {
          if (requiresMetadata) {
            self.ffprobe(function(err, data) {
              if (err) {
                return cb(err);
              }

              self._ffprobeData = data;
              cb();
            });
          } else {
            cb();
          }
        },

        // Build argument list
        function(cb) {
          self.buildFfmpegArgs(false, cb);
        }
      ],

      callback
    );

    if (!requiresMetadata) {
      // Read metadata for progress events if needed.
      // if requiresMetadata=true, we are already reading metadata.

      if (this.listeners('progress').length > 0) {
        // Read metadata in parallel
        runFfprobe(this);
      } else {
        // Read metadata as soon as the first 'progress' listener is added
        this.once('newListener', function(event) {
          if (event === 'progress') {
            runFfprobe(this);
          }
        });
      }
    }
  };


  // Process command
  function process(command, target, pipeOptions) {
    var isStream;

    if (typeof target === 'string') {
      isStream = false;
      command.options.outputfile = path.normalize(target);
    } else {
      isStream = true;
      pipeOptions = pipeOptions || {};
    }

    var options = command.options;
    var flvInjector = false;

    // Check for flvtool2 presence if needed
    if (options._updateFlvMetadata) {
      if (isStream) {
        //return command.emit('error', new Error('Updating flv metadata is not supported for streams'));
        options.logger.warn('Updating flv metadata is not supported for streams');
        options._updateFlvMetadata = false;
        return doProcess();
      }

      command.hasFlvInjector(function(_flvInjector) {
        if (_flvInjector) {
          flvInjector = _flvInjector;
          doProcess();
        } else {
          command.emit('error', new Error('Cannot find flvtool2 or flvmeta'));
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
            command.emit('error', err, stdout, stderr);
          } else {
            command.emit('end', stdout, stderr);
          }
        }
      }

      command._prepare(function(err, args) {
        if (err) {
          return emitEnd(err);
        }

        if (isStream) {
          args.push('pipe:1');
        }

        // Run ffmpeg

        var stdout = null;
        var stderr = '';
        command.ffmpegProc = command._spawnFfmpeg(args, function(err) {
          if (err) {
            emitEnd(err, stdout, stderr);
          } else {
            if (options._updateFlvMetadata) {
              spawn(flvInjector, ['-U', options.outputfile])
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

        command.emit('start', 'ffmpeg ' + args.join(' '));

        if (options.inputstream) {
          // Pipe input stream to ffmpeg stdin
          options.inputstream.on('error', function(err) {
            emitEnd(new Error('Input stream error: ' + err.message));
            command.ffmpegProc.kill();
          });
          options.inputstream.resume();
          options.inputstream.pipe(command.ffmpegProc.stdin);
        }

        // Setup timeout if needed
        var processTimer;
        if (options.timeout) {
          processTimer = setTimeout(function() {
            var msg = 'process ran into a timeout (' + command.options.timeout + 's)';

            emitEnd(new Error(msg), stdout, stderr);
            command.ffmpegProc.kill();
          }, options.timeout * 1000);
        }

        if (isStream) {
          // Pipe ffmpeg stdout to output stream
          command.ffmpegProc.stdout.pipe(target, pipeOptions);

          // Handle output stream events
          target.on('close', function() {
            options.logger.debug('Output stream closed, scheduling kill for ffmpgeg process');

            // Don't kill process yet, to give a chance to ffmpeg to
            // terminate successfully first  This is necessary because
            // under load, the process 'exit' event sometimes happens
            // after the output stream 'close' event.
            setTimeout(function() {
              emitEnd(new Error('Output stream closed'));
              command.ffmpegProc.kill();
            }, 20);
          });

          target.on('error', function(err) {
            options.logger.debug('Output stream error, killing ffmpgeg process');
            emitEnd(new Error('Output stream error: ' + err.message));
            command.ffmpegProc.kill();
          });
        } else {
          // Gather ffmpeg stdout
          stdout = '';
          command.ffmpegProc.stdout.on('data', function (data) {
            stdout += data;
          });
        }

        // Process ffmpeg stderr data
        command.ffmpegProc.stderr.on('data', function (data) {
          stderr += data;

          if (!command._codecDataAlreadySent && command.listeners('codecData').length) {
            command._checkStdErrForCodec(stderr);
          }

          if (command.listeners('progress').length) {
            var duration = 0;

            if (command._ffprobeData && command._ffprobeData.format && command._ffprobeData.format.duration) {
              duration = Number(command._ffprobeData.format.duration);
            }

            command._getProgressFromStdErr(stderr, duration);
          }
        });
      });
    }
  }

  FfmpegCommand.prototype.saveToFile = function(targetfile, callback) {
    if (callback) {
      this.options.logger.warn('saveToFile callback is deprecated, use \'end\' and \'error\' events instead');

      this.on('error', function(err) { callback(null, null, err); });
      this.on('end', function(stdout, stderr) { callback(stdout, stderr); });
    }

    process(this, targetfile);
    return this;
  };

  FfmpegCommand.prototype.writeToStream = function(stream, pipeOptions, callback) {
    if (typeof pipeOptions == 'function'){
        callback = pipeOptions;
        pipeOptions = {};
    }

    if (callback) {
      this.options.logger.warn('writeToStream callback is deprecated, use \'error\' and \'end\' events instead');
      this.on('error', function(err) { callback(null, err); });
      this.on('end', function(stdout, stderr) { callback(stdout, stderr); });
    }

    if (!this.options._isStreamable) {
      return this.emit('error', new Error('selected output format is not streamable'));
    }

    process(this, stream, pipeOptions);
    return this;
  };

  FfmpegCommand.prototype.mergeToFile = function(targetfile, callback) {
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

        self._spawnFfmpeg(args, {captureStdout:true,captureStderr:true}, function(err) {
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
      progress.percent = progress.createdFiles / progress.totalFiles * 100;
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

  FfmpegCommand.prototype.takeScreenshots = function(config, folder, callback) {
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

    function _screenShotInternal() {
      self._prepare(function(err, args) {
        if(err) {
          return self.emit('error', err);
        }

        var duration = 0;
        if (self._ffprobeData && self._ffprobeData.format && self._ffprobeData.format.duration) {
          duration = Number(self._ffprobeData.format.duration);
        }

        if (!duration) {
          var errString = 'meta data contains no duration, aborting screenshot creation';
          return self.emit('error', new Error(errString));
        }

        // check if all timemarks are inside duration
        if (Array.isArray(timemarks)) {
          for (var i = 0; i < timemarks.length; i++) {
            /* convert percentage to seconds */
            if( timemarks[i].indexOf('%') > 0 ) {
              timemarks[i] = (parseInt(timemarks[i], 10) / 100) * duration;
            }
            if (parseInt(timemarks[i], 10) > duration) {
              // remove timemark from array
              timemarks.splice(i, 1);
              --i;
            }
          }
          // if there are no more timemarks around, add one at end of the file
          if (timemarks.length === 0) {
            timemarks[0] = (duration * 0.9);
          }
        }
        // get positions for screenshots (using duration of file minus 10% to remove fade-in/fade-out)
        var secondOffset = (duration * 0.9) / screenshotcount;

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

            // build screenshot command
            var allArgs = [
                '-ss', Math.floor(offset * 100) / 100
              ]
              .concat(args)
              .concat([
                '-vframes', '1',
                '-an',
                '-vcodec', 'mjpeg',
                '-f', 'rawvideo',
                '-y', target
              ]);

            j++;

            self._spawnFfmpeg(allArgs, taskcallback);
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
      }, true);
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
      self.emit('error', new Error('set size of thumbnails using \'withSize\' method'));
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

    // check target folder
    check(folder, function(exists) {
      if (!exists) {
        fs.mkdir(folder, '0755', function(err) {
          if (err !== null) {
            self.emit('error', err);
          } else {
            _screenShotInternal();
          }
        });
      } else {
        _screenShotInternal();
      }
    });
  };

  FfmpegCommand.prototype.kill = function(signal) {
    if (!this.ffmpegProc) {
      this.options.logger.error('no running ffmpeg process, cannot send signal');
    } else {
      this.ffmpegProc.kill(signal || 'SIGKILL');
    }

    return this;
  };

  FfmpegCommand.prototype._getProgressFromStdErr = function(stderrString, totalDurationSec) {
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
        currentKbps: parseFloat(progress.bitrate.replace('kbits/s', '')),
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

  FfmpegCommand.prototype._parseProgressLine = function(line) {
    var progress = {};

    // Remove all spaces after = and trim
    line  = line.replace(/=\s+/g, '=').trim();
    var progressParts = line.split(' ');

    // Split every progress part by "=" to get key and value
    for(var i = 0; i < progressParts.length; i++) {
      var progressSplit = progressParts[i].split('=', 2)
        , key = progressSplit[0]
        , value = progressSplit[1];

      // This is not a progress line
      if(typeof value === 'undefined')
        return null;

      progress[key] = value;
    }

    return progress;
  };

  FfmpegCommand.prototype._checkStdErrForCodec = function(stderrString) {
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

  FfmpegCommand.prototype._spawnFfmpeg = function(args, options, callback) {
    var command = this.ffmpegPath;
    var self = this;

    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    if (this.options._niceness && !os.match(/win(32|64)/)) {
      args.unshift('-n', this.options._niceness, command);
      command = 'nice';
    }

    var stdout = null;
    var stdoutClosed = false;

    var stderr = null;
    var stderrClosed = false;

    var process = spawn(command, args, options);

    if (process.stderr) {
      process.stderr.setEncoding('utf8');
    }

    process.on('error', function(err) {
      callback(err);
    });

    // Ensure we wait for captured streams to end before calling callback
    var exitError = null;
    function handleExit(err) {
      if (err) {
        exitError = err;
      }

      if (processExited &&
        (stdoutClosed || !options.captureStdout) &&
        (stderrClosed || !options.captureStderr)) {
        callback(exitError, stdout, stderr);
      }
    }

    var processExited = false;
    process.on('exit', function(code, signal) {
      processExited = true;

      if (code) {
        handleExit(new Error('ffmpeg exited with code ' + code));
      } else if (signal) {
        handleExit(new Error('ffmpeg was killed with signal ' + signal));
      } else {
        handleExit();
      }
    });

    if (options.captureStdout) {
      stdout = '';

      process.stdout.on('data', function(data) {
        stdout += data;
      });

      process.stdout.on('close', function() {
        stdoutClosed = true;
        handleExit();
      });
    }

    if (options.captureStderr) {
      stderr = '';

      process.stderr.on('data', function(data) {
        stderr += data;
      });

      process.stderr.on('close', function() {
        stderrClosed = true;
        handleExit();
      });
    }

    return process;
  };

  FfmpegCommand.prototype._renice = function(process, niceness) {
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
      });
    }
  };
};
