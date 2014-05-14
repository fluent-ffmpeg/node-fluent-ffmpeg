/*jshint node:true*/
'use strict';

var spawn = require('child_process').spawn;
var PassThrough = require('stream').PassThrough;
var path = require('path');
var fs = require('fs');
var async = require('async');
var utils = require('./utils');


/*
 *! Processor methods
 */


/**
 * @param {FfmpegCommand} command
 * @param {String|Writable} target
 * @param {Object} [pipeOptions]
 * @private
 */
function _process(command, target, pipeOptions) {
  var isStream;

  if (typeof target === 'string') {
    isStream = false;
  } else {
    isStream = true;
    pipeOptions = pipeOptions || {};
  }

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

      if (command.options.flvmeta) {
        command.logger.warn('Updating flv metadata is not supported for streams');
        command.options.flvmeta = false;
      }
    } else {
      args.push('-y', target);
    }

    // Get input stream if any
    var inputStream = command._inputs.filter(function(input) {
      return typeof input.source !== 'string';
    })[0];

    // Run ffmpeg
    var stdout = null;
    var stderr = '';
    command._spawnFfmpeg(
      args,

      { niceness: command.options.niceness },

      function processCB(ffmpegProc) {
        command.ffmpegProc = ffmpegProc;
        command.emit('start', 'ffmpeg ' + args.join(' '));

        // Pipe input stream if any
        if (inputStream) {
          inputStream.source.on('error', function(err) {
            emitEnd(new Error('Input stream error: ' + err.message));
            ffmpegProc.kill();
          });

          inputStream.source.resume();
          inputStream.source.pipe(ffmpegProc.stdin);
        }

        // Setup timeout if requested
        var processTimer;
        if (command.options.timeout) {
          processTimer = setTimeout(function() {
            var msg = 'process ran into a timeout (' + command.options.timeout + 's)';

            emitEnd(new Error(msg), stdout, stderr);
            ffmpegProc.kill();
          }, command.options.timeout * 1000);
        }

        if (isStream) {
          // Pipe ffmpeg stdout to output stream
          ffmpegProc.stdout.pipe(target, pipeOptions);

          // Handle output stream events
          target.on('close', function() {
            command.logger.debug('Output stream closed, scheduling kill for ffmpgeg process');

            // Don't kill process yet, to give a chance to ffmpeg to
            // terminate successfully first  This is necessary because
            // under load, the process 'exit' event sometimes happens
            // after the output stream 'close' event.
            setTimeout(function() {
              emitEnd(new Error('Output stream closed'));
              ffmpegProc.kill();
            }, 20);
          });

          target.on('error', function(err) {
            command.logger.debug('Output stream error, killing ffmpgeg process');
            emitEnd(new Error('Output stream error: ' + err.message));
            ffmpegProc.kill();
          });
        } else {
          // Gather ffmpeg stdout
          stdout = '';
          ffmpegProc.stdout.on('data', function (data) {
            stdout += data;
          });
        }

        // Process ffmpeg stderr data
        command._codecDataSent = false;
        ffmpegProc.stderr.on('data', function (data) {
          stderr += data;

          if (!command._codecDataSent && command.listeners('codecData').length) {
            utils.extractCodecData(command, stderr);
          }

          if (command.listeners('progress').length) {
            var duration = 0;

            if (command._ffprobeData && command._ffprobeData.format && command._ffprobeData.format.duration) {
              duration = Number(command._ffprobeData.format.duration);
            }

            utils.extractProgress(command, stderr, duration);
          }
        });
      },

      function endCB(err) {
        delete command.ffmpegProc;

        if (err) {
          if (err.message.match(/ffmpeg exited with code/)) {
            // Add ffmpeg error message
            err.message += ': ' + utils.extractError(stderr);
          }

          emitEnd(err, stdout, stderr);
        } else {
          if (command.options.flvmeta) {
            command._getFlvtoolPath(function(err, flvtool) {
              // No error possible here, _getFlvtoolPath was called by _prepare

              spawn(flvtool, ['-U', target])
                .on('error', function(err) {
                  emitEnd(new Error('Error running ' + flvtool + ': ' + err.message));
                })
                .on('exit', function(code, signal) {
                  if (code !== 0 || signal) {
                    emitEnd(
                      new Error(flvtool + ' ' +
                        (signal ? 'received signal ' + signal
                                : 'exited with code ' + code))
                    );
                  } else {
                    emitEnd(null, stdout, stderr);
                  }
                });
            });
          } else {
            emitEnd(null, stdout, stderr);
          }
        }
      }
    );
  });
}


/**
 * Run ffprobe asynchronously and store data in command
 *
 * @param {FfmpegCommand} command
 * @private
 */
function runFfprobe(command) {
  command.ffprobe(function(err, data) {
    command._ffprobeData = data;
  });
}


module.exports = function(proto) {
  /**
   * Emitted just after ffmpeg has been spawned.
   *
   * @event FfmpegCommand#start
   * @param {String} command ffmpeg command line
   */

  /**
   * Emitted when ffmpeg reports progress information
   *
   * @event FfmpegCommand#progress
   * @param {Object} progress progress object
   * @param {Number} progress.frames number of frames transcoded
   * @param {Number} progress.currentFps current processing speed in frames per second
   * @param {Number} progress.currentKbps current output generation speed in kilobytes per second
   * @param {Number} progress.targetSize current output file size
   * @param {String} progress.timemark current video timemark
   * @param {Number} [progress.percent] processing progress (may not be available depending on input)
   */

  /**
   * Emitted when ffmpeg reports input codec data
   *
   * @event FfmpegCommand#codecData
   * @param {Object} codecData codec data object
   * @param {String} codecData.format input format name
   * @param {String} codecData.audio input audio codec name
   * @param {String} codecData.audio_details input audio codec parameters
   * @param {String} codecData.video input video codec name
   * @param {String} codecData.video_details input video codec parameters
   */

  /**
   * Emitted when an error happens when preparing or running a command
   *
   * @event FfmpegCommand#error
   * @param {Error} error error object
   * @param {String|null} stdout ffmpeg stdout, unless outputting to a stream
   * @param {String|null} stderr ffmpeg stderr
   */

  /**
   * Emitted when a command finishes processing
   *
   * @event FfmpegCommand#end
   * @param {Array|null} [filenames] generated filenames when taking screenshots, null otherwise
   */


  /**
   * Spawn an ffmpeg process
   *
   * The 'options' argument may contain the following keys:
   * - 'niceness': specify process niceness, ignored on Windows (default: 0)
   * - 'captureStdout': capture stdout and pass it to 'endCB' as its 2nd argument (default: false)
   * - 'captureStderr': capture stderr and pass it to 'endCB' as its 3rd argument (default: false)
   *
   * The 'processCB' callback, if present, is called as soon as the process is created and
   * receives a nodejs ChildProcess object.  It may not be called at all if an error happens
   * before spawning the process.
   *
   * The 'endCB' callback is called either when an error occurs or when the ffmpeg process finishes.
   *
   * @method FfmpegCommand#_spawnFfmpeg
   * @param {Array} args ffmpeg command line argument list
   * @param {Object} [options] spawn options (see above)
   * @param {Function} [processCB] callback called with process object when it has been created
   * @param {Function} endCB callback with signature (err, stdout, stderr)
   * @private
   */
  proto._spawnFfmpeg = function(args, options, processCB, endCB) {
    // Enable omitting options
    if (typeof options === 'function') {
      endCB = processCB;
      processCB = options;
      options = {};
    }

    // Enable omitting processCB
    if (typeof endCB === 'undefined') {
      endCB = processCB;
      processCB = function() {};
    }

    // Find ffmpeg
    this._getFfmpegPath(function(err, command) {
      if (err) {
        return endCB(err);
      } else if (!command || command.length === 0) {
        return endCB(new Error('Cannot find ffmpeg'));
      }

      // Apply niceness
      if (options.niceness && options.niceness !== 0 && !utils.isWindows) {
        args.unshift('-n', options.niceness, command);
        command = 'nice';
      }

      var stdout = null;
      var stdoutClosed = false;

      var stderr = null;
      var stderrClosed = false;

      // Spawn process
      var ffmpegProc = spawn(command, args, options);

      if (ffmpegProc.stderr && options.captureStderr) {
        ffmpegProc.stderr.setEncoding('utf8');
      }

      ffmpegProc.on('error', function(err) {
        endCB(err);
      });

      // Ensure we wait for captured streams to end before calling endCB
      var exitError = null;
      function handleExit(err) {
        if (err) {
          exitError = err;
        }

        if (processExited &&
          (stdoutClosed || !options.captureStdout) &&
          (stderrClosed || !options.captureStderr)) {
          endCB(exitError, stdout, stderr);
        }
      }

      // Handle process exit
      var processExited = false;
      ffmpegProc.on('exit', function(code, signal) {
        processExited = true;

        if (signal) {
          handleExit(new Error('ffmpeg was killed with signal ' + signal));
        } else if (code) {
          handleExit(new Error('ffmpeg exited with code ' + code));
        } else {
          handleExit();
        }
      });

      // Capture stdout if specified
      if (options.captureStdout) {
        stdout = '';

        ffmpegProc.stdout.on('data', function(data) {
          stdout += data;
        });

        ffmpegProc.stdout.on('close', function() {
          stdoutClosed = true;
          handleExit();
        });
      }

      // Capture stderr if specified
      if (options.captureStderr) {
        stderr = '';

        ffmpegProc.stderr.on('data', function(data) {
          stderr += data;
        });

        ffmpegProc.stderr.on('close', function() {
          stderrClosed = true;
          handleExit();
        });
      }

      // Call process callback
      processCB(ffmpegProc);
    });
  };


  /**
   * Build the argument list for an ffmpeg command
   *
   * @method FfmpegCommand#_getArguments
   * @return argument list
   * @private
   */
  proto._getArguments = function() {
    var audioFilters = this._audioFilters.get();
    var videoFilters = this._videoFilters.get().concat(this._sizeFilters.get());

    return this._inputs.reduce(function(args, input) {
        var source = (typeof input.source === 'string') ? input.source : '-';

        return args.concat(
          input.before.get(),
          ['-i', source],
          input.after.get()
        );
      }, [])
      .concat(
        this._audio.get(),
        audioFilters.length ? ['-filter:a', audioFilters.join(',')] : [],
        this._video.get(),
        videoFilters.length ? ['-filter:v', videoFilters.join(',')] : [],
        this._output.get()
      );
  };


  /**
   * Prepare execution of an ffmpeg command
   *
   * Checks prerequisites for the execution of the command (codec/format availability, flvtool...),
   * then builds the argument list for ffmpeg and pass them to 'callback'.
   *
   * @method FfmpegCommand#_prepare
   * @param {Function} callback callback with signature (err, args)
   * @param {Boolean} [readMetadata=false] read metadata before processing
   * @private
   */
  proto._prepare = function(callback, readMetadata) {
    var self = this;

    async.waterfall([
      // Check codecs and formats
      function(cb) {
        self._checkCapabilities(cb);
      },

      // Read metadata if required
      function(cb) {
        if (!readMetadata) {
          return cb();
        }

        self.ffprobe(function(err, data) {
          if (!err) {
            self._ffprobeData = data;
          }

          cb();
        });
      },

      // Check for flvtool2/flvmeta if necessary
      function(cb) {
        if (self.options.flvmeta) {
          self._getFlvtoolPath(function(err) {
            cb(err);
          });
        } else {
          cb();
        }
      },

      // Build argument list
      function(cb) {
        var args;
        try {
          args = self._getArguments();
        } catch(e) {
          return cb(e);
        }

        cb(null, args);
      }
    ], callback);

    if (!readMetadata) {
      // Read metadata as soon as 'progress' listeners are added

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


  /**
   * Execute ffmpeg command and save output to a file
   *
   * @method FfmpegCommand#save
   * @category Processing
   * @aliases saveToFile
   *
   * @param {String} output file path
   * @return FfmpegCommand
   */
  proto.saveToFile =
  proto.save = function(output) {
    _process(this, output);
  };


  /**
   * Execute ffmpeg command and save output to a stream
   *
   * If 'stream' is not specified, a PassThrough stream is created and returned.
   * 'options' will be used when piping ffmpeg output to the output stream
   * (@see http://nodejs.org/api/stream.html#stream_readable_pipe_destination_options)
   *
   * @method FfmpegCommand#pipe
   * @category Processing
   * @aliases stream,writeToStream
   *
   * @param {stream.Writable} [stream] output stream
   * @param {Object} [options={}] pipe options
   * @return Output stream
   */
  proto.writeToStream =
  proto.pipe =
  proto.stream = function(stream, options) {
    if (stream && !('writable' in stream)) {
      options = stream;
      stream = undefined;
    }

    if (!stream) {
      if (process.version.match(/v0\.8\./)) {
        throw new Error('PassThrough stream is not supported on node v0.8');
      }

      stream = new PassThrough();
    }

    _process(this, stream, options);
    return stream;
  };


  /**
   * Merge (concatenate) inputs to a single file
   *
   * Warning: soon to be deprecated
   *
   * @method FfmpegCommand#mergeToFile
   * @category Processing
   *
   * @param {String} targetfile output file path
   */
  proto.mergeToFile = function(targetfile) {
    var outputfile = path.normalize(targetfile);
    if(fs.existsSync(outputfile)){
      return this.emit('error', new Error('Output file already exists, merge aborted'));
    }

    var self = this;

    // creates intermediate copies of each video.
    function makeIntermediateFile(_mergeSource,_callback) {
        var fname =  _mergeSource + '.temp.mpg';
        var args = self._output.get().concat(['-i', _mergeSource, '-qscale:v', 1, fname]);

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

    if (this._inputs.length < 2) {
      return this.emit('error', new Error('No file added to be merged'));
    }

    var mergeList = this._inputs.map(function(input) { return input.source; });

    var progress = {frames : 0,
                    currentFps: 0,
                    currentKbps: 0,
                    targetSize: 0,
                    timemark: 0,
                    percent: 0,
                    totalFiles: mergeList.length + 2,
                    createdFiles: 0};

    var toDelete = mergeList.map(function(name) { return name + '.temp.mpg'; });
    toDelete.push(outputfile + '.temp.merged.mpg');
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


  /**
   * Take screenshots
   *
   * The 'config' parameter may either be the number of screenshots to take or an object
   * with the following keys:
   * - 'count': screenshot count
   * - 'timemarks': array of screenshot timestamps in seconds (defaults to taking screenshots at regular intervals)
   * - 'filename': screenshot filename pattern (defaults to 'tn_%ss' or 'tn_%ss_%i' for multiple screenshots)
   *
   * The 'filename' option may contain tokens that will be replaced for each screenshot taken:
   * - '%s': offset in seconds
   * - '%w': screenshot width
   * - '%h': screenshot height
   * - '%r': screenshot resolution (eg. '320x240')
   * - '%f': input filename
   * - '%b': input basename (filename w/o extension)
   * - '%i': index of screenshot in timemark array (can be zero-padded by using it like `%000i`)
   *
   * @method FfmpegCommand#takeScreenshots
   * @category Processing
   *
   * @param {Number|Object} config screenshot count or configuration object (see above)
   * @param {String} [folder='.'] output directory
   */
  proto.takeScreenshots = function(config, folder) {
    var width, height;
    var self = this;

    function _computeSize(size) {
      // Select video stream with biggest resolution
      var vstream = self._ffprobeData.streams.reduce(function(max, stream) {
        if (stream.codec_type !== 'video') return max;
        return max.width * max.height < stream.width * stream.height ? stream : max;
      }, { width: 0, height: 0 });

      var w = vstream.width;
      var h = vstream.height;
      var a = w / h;

      var fixedSize = size.match(/([0-9]+)x([0-9]+)/);
      var fixedWidth = size.match(/([0-9]+)x\?/);
      var fixedHeight = size.match(/\?x([0-9]+)/);
      var percentRatio = size.match(/\b([0-9]{1,3})%/);

      if (fixedSize) {
        width = Number(fixedSize[1]);
        height = Number(fixedSize[2]);
      } else if (fixedWidth) {
        width = Number(fixedWidth[1]);
        height = width / a;
      } else if (fixedHeight) {
        height = Number(fixedHeight[1]);
        width = height * a;
      } else {
        var pc = Number(percentRatio[0]) / 100;
        width = w * pc;
        height = h * pc;
      }
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
      result = result.replace('%w', width);
      result = result.replace('%h', height);
      result = result.replace('%r', width+'x'+height);
      result = result.replace('%f', path.basename(inputfile));
      result = result.replace('%b', path.basename(inputfile, path.extname(inputfile)));
      return result;
    }

    function _screenShotInternal() {
      self._prepare(function(err, args) {
        if(err) {
          return self.emit('error', err);
        }

        _computeSize(self._sizeData.size);

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

    if (!this._sizeData || !this._sizeData.size) {
      throw new Error('Size must be specified');
    }

    var inputfile = this._currentInput.source;

    filename = config.filename || 'tn_%ss';
    if(!/%0*i/.test(filename) && Array.isArray(timemarks) && timemarks.length > 1 ) {
      // if there are multiple timemarks but no %i in filename add one
      // so we won't overwrite the same thumbnail with each timemark
      filename += '_%i';
    }
    folder = folder || '.';

    // check target folder
    fs.exists(folder, function(exists) {
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


  /**
   * Renice current and/or future ffmpeg processes
   *
   * Ignored on Windows platforms.
   *
   * @method FfmpegCommand#renice
   * @category Processing
   *
   * @param {Number} [niceness=0] niceness value between -20 (highest priority) and 20 (lowest priority)
   * @return FfmpegCommand
   */
  proto.renice = function(niceness) {
    if (!utils.isWindows) {
      niceness = niceness || 0;

      if (niceness < -20 || niceness > 20) {
        this.logger.warn('Invalid niceness value: ' + niceness + ', must be between -20 and 20');
      }

      niceness = Math.min(20, Math.max(-20, niceness));
      this.options.niceness = niceness;

      if (this.ffmpegProc) {
        var logger = this.logger;
        var pid = this.ffmpegProc.pid;
        var renice = spawn('renice', [niceness, '-p', pid]);

        renice.on('error', function(err) {
          logger.warn('could not renice process ' + pid + ': ' + err.message);
        });

        renice.on('exit', function(code, signal) {
          if (signal) {
            logger.warn('could not renice process ' + pid + ': renice was killed by signal ' + signal);
          } else if (code) {
            logger.warn('could not renice process ' + pid + ': renice exited with ' + code);
          } else {
            logger.info('successfully reniced process ' + pid + ' to ' + niceness + ' niceness');
          }
        });
      }
    }

    return this;
  };


  /**
   * Kill current ffmpeg process, if any
   *
   * @method FfmpegCommand#kill
   * @category Processing
   *
   * @param {String} [signal=SIGKILL] signal name
   * @return FfmpegCommand
   */
  proto.kill = function(signal) {
    if (!this.ffmpegProc) {
      this.options.logger.warn('No running ffmpeg process, cannot send signal');
    } else {
      this.ffmpegProc.kill(signal || 'SIGKILL');
    }

    return this;
  };
};
