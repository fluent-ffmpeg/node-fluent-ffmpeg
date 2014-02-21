var fs       = require('fs'),
    path     = require('path'),
    async    = require('async'),
    os       = require('os').platform(),
    exec     = require('child_process').exec,
    spawn    = require('child_process').spawn,
    Registry = require('./registry'),

exports = module.exports = function Processor(command) {
  command.prototype._codecDataAlreadySent = false;

  command.prototype.saveToFile = function(targetfile, callback) {
    if (callback) {
      this.options.logger.warn('saveToFile callback is deprecated, use \'end\' and \'error\' events instead');

      this.on('error', function(err) { callback(null, null, err); });
      this.on('end', function(stdout, stderr) { callback(stdout, stderr); });
    }

    this.options.outputfile = path.normalize(targetfile);

    var self = this;
    var options = this.options;

    // parse options to command
    this._prepare(function(err) {

      if (err) {
        return self.emit('error', err);
      }

      var args;
      try {
        args = self.buildFfmpegArgs(false);
      } catch(err) {
        return self.emit('error', err);
      }

      self.emit('start', 'ffmpeg ' + args.join(' '));

      // start conversion of file using spawn
      var ffmpegProc = self.ffmpegProc = self._spawnProcess(args);
      if (options.inputstream) {
        // pump input stream to stdin
        options.inputstream.resume();
        options.inputstream.pipe(ffmpegProc.stdin);
      }

      //handle timeout if set
      var processTimer;
      if (options.timeout) {
        processTimer = setTimeout(function() {
          ffmpegProc.removeAllListeners('exit');
          ffmpegProc.kill('SIGKILL');

          var msg = 'process ran into a timeout (' + self.options.timeout + 's)';
          options.logger.warn(msg);
          self.emit('error', new Error(msg));
        }, options.timeout * 1000);
      }

      var stdout = '';
      var stderr = '';
      ffmpegProc.on('exit', function(code) {
        if (processTimer) {
          clearTimeout(processTimer);
        }
        if (code != 0) {
          return self.emit('error', new Error('ffmpeg returned with code: ' + code));
        }
        // check if we have to run flvtool2 to update flash video meta data
        if (self.options._updateFlvMetadata === true) {
          // make sure we didn't try to determine this capability before
          if (!Registry.instance.get('capabilityFlvTool2')) {
            // check if flvtool2 is installed
            exec('which flvtool2', function(whichErr, whichStdOut, whichStdErr) {
              if (whichStdOut !== '') {
                Registry.instance.set('capabilityFlvTool2', true);
                // update metadata in flash video
                exec('flvtool2 -U ' + self.options.outputfile, function(flvtoolErr, flvtoolStdout, flvtoolStderr) {
                  self.emit('end', stdout, stderr);
                });
              } else {
                // flvtool2 is not installed, skip further checks
                Registry.instance.set('capabilityFlvTool2', false);
                self.emit('end', stdout, stderr);
              }
            });
          } else if (!Registry.instance.get('capabilityFlvTool2')) {
            // flvtool2 capability was checked before, execute update
            exec('flvtool2 -U ' + self.options.outputfile, function(flvtoolErr, flvtoolStdout, flvtoolStderr) {
              self.emit('end', stdout, stderr);
            });
          } else {
            // flvtool2 not installed, skip update
            self.emit('end', stdout, stderr);
          }
        } else {
          self.emit('end', stdout, stderr);
        }
      });
      ffmpegProc.stdout.on('data', function (data) {
        stdout += data;
      });

      ffmpegProc.stderr.on('data', function (data) {
        stderr += data;
        if (!self._codecDataAlreadySent && self.listeners('codecData').length) {
          self._checkStdErrForCodec(stderr);
        }
        if (self.listeners('progress').length) {
          self._getProgressFromStdErr(stderr, self.metaData.durationsec);
        }
      });
    });
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

    var getExtension = function(filename) {
        var filename = path.normalize(filename) || '';
        var ext = path.extname(filename).split('.');
        return ext[ext.length - 1];
    };

    // creates intermediate copies of each video.
    var makeIntermediateFile = function(_mergeSource,_callback){
        var fname =  _mergeSource+".temp.mpg";
        var command = [
            self.ffmpegPath,
            [
                '-i', _mergeSource,
                '-qscale:v',1,
                fname
            ]
        ];

        command[1] = self.options.additional.concat(command[1]).join(' ');

        exec(command.join(' '),function(err, stdout, stderr) {
          _callback(err, fname);
        });
    };

    // concat all created intermediate copies
    var concatIntermediates = function(target,intermediatesList,_callback){
        var fname =  path.normalize(target)+".temp.merged.mpg";
        // unescape paths
        for(var i=0; i<intermediatesList.length; i++){
            intermediatesList[i] = unescapePath(intermediatesList[i]);
        }

        var command = [
            self.ffmpegPath,
            [
                '-loglevel','panic', //Generetes too much muxing warnings and fills default buffer of exec. This is to ignore them.
                '-i', 'concat:"'+intermediatesList.join("|")+'"',
                '-c',"copy",
                fname
            ].join(' ')
        ];
        exec(command.join(' '), function(err, stdout, stderr) {
          _callback(err, fname);
        });
    };

    var quantizeConcat = function(concatResult,numFiles,_callback){
        var command = [
            self.ffmpegPath,
            [
                '-i', concatResult,
                '-qscale:v',numFiles,
                targetfile
            ].join(' ')
        ];
        exec(command.join(' '), function(err, stdout, stderr) {
            _callback(err);
        });
    }

    var deleteIntermediateFiles = function(intermediates,callback){
        async.each(intermediates,function(item,cb){
            fs.exists(unescapePath(item),function(exists){
              if(exists){
                fs.unlink(unescapePath(item),cb);
              }
              else{
                cb();
              }

            });

        },callback);
    }

    var unescapePath = function(path){
        var f = path+"";
        if(f.indexOf('"')==0)f = f.substring(1);
        if(f.lastIndexOf('"')== f.length-1)f = f.substring(0, f.length-1);
        return f;
    }

    var makeProgress = function(){
      progress.createdFiles = progress.createdFiles + 1;
      progress.precent = progress.createdFiles/progress.totalFiles*100;
      self.emit('progress', progress);
    }

    if(options.mergeList.length<=0) {
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
                    createdFiles: 0}

    var toDelete = mergeList.map(function(name){return name + ".temp.mpg"});
    toDelete.push(this.options.outputfile + ".temp.merged.mpg");
    deleteIntermediateFiles(toDelete);

    var intermediateFiles = [];

    async.whilst(function(){
        return (mergeList.length != 0);
    },function(callback){
        makeIntermediateFile(mergeList.shift(),function(err, createdIntermediateFile){
            if(err) return callback(err);
            if(!createdIntermediateFile) return callback(new Error("Invalid intermediate file"));
            intermediateFiles.push(createdIntermediateFile);
            makeProgress();
            callback();
        })
    },function(err){
        if(err) return self.emit('error', err);
        concatIntermediates(targetfile,intermediateFiles,function(err, concatResult){
            if(err) return self.emit('error', err);
            if(!concatResult) return self.emit('error', new Error("Invalid concat result file"));
            makeProgress();
            quantizeConcat(concatResult,intermediateFiles.length,function(){
                makeProgress();
                intermediateFiles.push(concatResult); // add concatResult to intermediates list so it can be deleted too.
                deleteIntermediateFiles(intermediateFiles, function(err) {
                  if (err) {
                    self.emit('error', err);
                  } else {
                    self.emit('end');
                  }
                });
            });
        });
    });
  };

  command.prototype.writeToStream = function(stream, pipeOptions, callback) {
    if(typeof pipeOptions == 'function'){
        callback = pipeOptions;
        pipeOptions = {};
    }

    if (callback) {
      this.options.logger.warn('writeToStream callback is deprecated, use \'error\' and \'end\' events instead');
      this.on('error', function(err) { callback(null, err); });
      this.on('end', function() { callback(); });
    }

    if (!this.options._isStreamable) {
      this.options.logger.error('selected output format is not streamable');
      return this.emit('error', new Error('selected output format is not streamable'));
    }

    var self    = this;
    var options = this.options;

    // parse options to command
    this._prepare(function(err) {
      if (err) {
        return self.emit('error', err);
      }

      var args;
      try {
        args = self.buildFfmpegArgs(true);
      } catch(err) {
        return self.emit('error', err);
      }

      // Ensure we emit only one of 'error' and 'end'
      var ended = false;
      function end(err) {
        if (!ended) {
          ended = true;
          if (err) {
            self.emit('error', err);
          } else {
            self.emit('end');
          }
        }
      }

      // write data to stdout
      args.push('pipe:1');

      // start conversion of file using spawn
      var ffmpegProc = self.ffmpegProc = self._spawnProcess(args);

      if (options.inputstream) {
        // pump input stream to stdin
        options.inputstream.resume();
        options.inputstream.pipe(ffmpegProc.stdin);
        options.inputstream.on('error', function(err){
          options.logger.debug("input stream closed, killing ffmpgeg process");
          ffmpegProc.kill();

          end(new Error('Input stream got error ' + err.msg));
        });
      }

      //handle timeout if set
      var processTimer;
      if (options.timeout) {
        processTimer = setTimeout(function() {
          ffmpegProc.removeAllListeners('exit');
          ffmpegProc.kill('SIGKILL');

          var msg = 'process ran into a timeout (' + options.timeout + 's)';
          options.logger.warn(msg);

          end(new Error(msg));
        }, options.timeout * 1000);
      }

      var stderr = '';

      ffmpegProc.stderr.on('data', function(data) {
        stderr += data;
        if (!self._codecDataAlreadySent && self.listeners('codecData').length) {
          self._checkStdErrForCodec(stderr);
        }
        if (self.listeners('progress').length) {
          self._getProgressFromStdErr(stderr, self.metaData.durationsec);
        }
      });

      ffmpegProc.stdout.pipe(stream, pipeOptions);

      ffmpegProc.on('exit', function(code, signal) {
        if (processTimer) {
          clearTimeout(processTimer);
        }

        if (code) {
          end(new Error('ffmpeg exited with code ' + code));
        } else {
          end();
        }
      });

      stream.on("close", function()
      {
        options.logger.debug("Output stream closed, killing ffmpgeg process");
        ffmpegProc.kill();
        end(new Error('Output stream closed'));
      });
    });
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
            var target = self.escapedPath(path.join(folder, fname), true);
            var input = self.escapedPath(self.options.inputfile, true);

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

            var command = [
              self.ffmpegPath,
              args.join(" ")
            ]

            j++;

            // only set niceness if running on a non-windows platform
            if (self.options.hasOwnProperty('_nice.level') && !os.match(/win(32|64)/)) {
              // execute ffmpeg through nice
              command.unshift('nice -n', self.options._nice.level||0);
            }

            exec(command.join(' '), taskcallback);
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
    line  = line.replace(/=\s+/g, '=').trim()
    progressParts = line.split(' ')

    // Split every progress part by "=" to get key and value
    for(var i = 0; i < progressParts.length; i++) {
      var progressSplit = progressParts[i].split("=", 2)
        , key = progressSplit[0]
        , value = progressSplit[1]

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

  command.prototype._spawnProcess = function(args, options) {
    var retProc = spawn(this.ffmpegPath, args, options);
    if (this.options.hasOwnProperty('_nice.level')) {
      this._renice(retProc, this.options._nice.level);
    }
    if (retProc.stderr) {
      retProc.stderr.setEncoding('utf8');
    }
    return retProc;
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

    // add input file (if using fs mode)
    if (this.options.inputfile && !this.options.inputstream && !this.options.inputlive) {
      // add input file fps
      if (this.options.video.fpsInput) {
        args.push('-r', this.options.video.fpsInput);
      }
      if (/^[a-z]+:\/\//.test(this.options.inputfile)) {
        args.push('-i', this.options.inputfile.replace(' ', '%20'));
      } else if (/%\d*d/.test(this.options.inputfile)) { // multi-file format - http://ffmpeg.org/ffmpeg.html#image2-1
        args.push('-i', this.options.inputfile.replace(' ', '\ '));
      } else {
        var fstats = fs.statSync(this.options.inputfile);
        if (fstats.isFile()) {
          // fix for spawn call with path containing spaces and quotes
          args.push('-i', this.options.inputfile.replace(/ /g, "\ ")
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
    		args.push('-i', this.options.inputfile.replace(' ', '%20')+' live=1');
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

    // add additional options
    if (this.options.additional) {
      if (this.options.additional.length > 0) {
        this.options.additional.forEach(function(el) {
          args.push(el);
        });
      }
    }

    if (this.options.video.pad && !this.options.video.skip) {
      // we have padding arguments, push
      if (this.atLeastVersion(this.metaData.ffmpegversion, '0.7')) {
        // padding is not supported ffmpeg < 0.7 (only using legacy commands which were replaced by vfilter calls)
        args.push('-vf');
        args.push('pad=' + this.options.video.pad.w +
          ':' + this.options.video.pad.h +
          ':' + this.options.video.pad.x +
          ':' + this.options.video.pad.y +
          ':' + this.options.video.padcolor);
      } else {
        throw new Error("Your ffmpeg version " + this.metaData.ffmpegversion + " does not support padding");
      }
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
      var target = this.escapedPath(this.options.outputfile, false);
      if (!os.match(/win(32|64)/)) {
        args.push('-y', target.replace(' ', '\\ '));
      } else {
        args.push('-y', target);
      }
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
      // renice the spawned process without waiting for callback
      var self = this;
      var command = [
        'renice -n', niceLevel,
        '-p', process.pid
      ].join(' ');

      exec(command, function(err, stderr, stdout) {
        if (!err) {
          self.options.logger.info('successfully reniced process ' + process.pid + ' to ' + niceLevel + ' niceness!');
        }
      });
    }
  };
};
