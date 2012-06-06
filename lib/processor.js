var fs = require('fs'),
  path = require('path'),
  async = require('../support/async.min.js'),
  exec = require('child_process').exec,
  spawn = require('child_process').spawn,
  Registry = require('./registry'),

exports = module.exports = function Processor(command) {
  // constant for timeout checks
  this.E_PROCESSTIMEOUT = -99;
  this._codecDataAlreadySent = false;

  this.saveToFile = function(targetfile, callback) {

    this.options.outputfile = targetfile;
    var self = this;

    // parse options to command
    this._prepare(function(err, meta) {
      if (err) {
        callback(null, null, err);
      } else {
        var args = self.buildFfmpegArgs(false, meta);

        // kinda hacky, have to make sure the returned object is no array
        if (args.length === undefined) {
          // we got an error object, trigger error callback
          callback (null, null, args);
        } else {
          // start conversion of file using spawn
          var ffmpegProc = self._spawnProcess(args);
          if (self.options.inputstream) {
              // pump input stream to stdin
              self.options.inputstream.resume();
              self.options.inputstream.pipe(ffmpegProc.stdin);
          }

          //handle timeout if set
          var processTimer;
          if (self.options.timeout) {
            processTimer = setTimeout(function() {
              ffmpegProc.removeAllListeners('exit');
              ffmpegProc.kill('SIGKILL');
              self.options.logger.warn('process ran into a timeout (' + self.options.timeout + 's)');
              callback(self.E_PROCESSTIMEOUT, 'timeout');
            }, self.options.timeout * 1000);
          }

          var stdout = '';
          var stderr = '';
          ffmpegProc.on('exit', function(code) {
            if (processTimer) {
              clearTimeout(processTimer);
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
                      callback(stdout, stderr, null);
                    });
                  } else {
                    // flvtool2 is not installed, skip further checks
                    Registry.instance.set('capabilityFlvTool2', false);
                    callback(stdout, stderr, null);
                  }
                });
              } else if (!Registry.instance.get('capabilityFlvTool2')) {
                // flvtool2 capability was checked before, execute update
                exec('flvtool2 -U ' + self.options.outputfile, function(flvtoolErr, flvtoolStdout, flvtoolStderr) {
                  callback(stdout, stderr, null);
                });
              } else {
                // flvtool2 not installed, skip update
                callback(stdout, stderr, null);
              }
            } else {
              callback(stdout, stderr, null);
            }
          });
          ffmpegProc.stdout.on('data', function (data) {
            stdout += data;
          });

          ffmpegProc.stderr.on('data', function (data) {
            stderr += data;
            if (self.options.onCodecData) {
              self._checkStdErrForCodec(stderr);
            }
            if (self.options.onProgress) {
              self._getProgressFromStdErr(stderr, meta.durationsec);
            }
          });
        }
      }
    });
  };

  this.writeToStream = function(stream, callback) {
    if (!this.options._isStreamable) {
      this.options.logger.error('selected output format is not streamable');
      callback(null, new Error('selected output format is not streamable'));
    } else {
      var self = this;
      // parse options to command
      this._prepare(function(err, meta) {
        if (err) {
          callback(null, err);
        } else {
          var args = self.buildFfmpegArgs(true, meta);
          // kinda hacky, have to make sure the returned object is no array
          if (args.length === undefined) {
            callback(null, args);
          } else {
            // write data to stdout
            args.push('pipe:1');

            // start conversion of file using spawn
            var ffmpegProc = self._spawnProcess(args);

            if (self.options.inputstream) {
              // pump input stream to stdin
              self.options.inputstream.resume();
              self.options.inputstream.pipe(ffmpegProc.stdin);
            }

            //handle timeout if set
            var processTimer;
            if (self.options.timeout) {
              processTimer = setTimeout(function() {
                ffmpegProc.removeAllListeners('exit');
                ffmpegProc.kill('SIGKILL');
                self.options.logger.warn('process ran into a timeout (' + self.options.timeout + 's)');
                callback(self.E_PROCESSTIMEOUT, 'timeout');
              }, self.options.timeout * 1000);
            }

            var stderr = '';

            ffmpegProc.stderr.on('data', function(data) {
              stderr += data;
              if (self.options.onCodecData) {
                self._checkStdErrForCodec(stderr);
              }
              if (self.options.onProgress) {
                self._getProgressFromStdErr(stderr, meta.durationsec);
              }
            });

            ffmpegProc.stdout.on('data', function(chunk) {
              stream.write(chunk);
            });

            ffmpegProc.on('exit', function(code, signal) {
              if (processTimer) {
                clearTimeout(processTimer);
              }
              // close file descriptor on outstream
              if(/^[a-z]+:\/\//.exec(self.options.inputfile)) {
                callback(code, stderr);
              } else {
                var cb_ = function() {
                  if (self.options.inputstream) {
                    fs.close(self.options.inputstream.fd, function() {
                      callback(code, stderr);
                    });
                  }
                  else {
                    callback(code, stderr);
                  }
                };
                if (!stream.fd) {
                  if (stream.end) {
                    stream.end();
                  } else {
                    callback(code, "stream will not be closed");
                  }
                  cb_();
                } else {
                  fs.close(stream.fd, cb_);
                }
              }
            });
          }
        }
      });
    }
  };

  this.takeScreenshots = function(config, folder, callback) {
    function _screenShotInternal(callback) {
      // get correct dimensions
      self._prepare(function(err, meta) {
        if (meta.durationsec) {
          // check if all timemarks are inside duration
          if (timemarks !== null) {
            for (var i = 0; i < timemarks.length; i++) {
              if (parseInt(timemarks[i], 10) > (meta.durationsec * 0.9)) {
                // remove timemark from array
                timemarks.splice(i, 1);
              }
            }
            // if there are no more timemarks around, add one at end of the file
            if (timemarks.length === 0) {
              timemarks[0] = (meta.durationsec * 0.9);
            }
          }
          // get positions for screenshots (using duration of file minus 10% to remove fade-in/fade-out)
          var secondOffset = (meta.durationsec * 0.9) / screenshotcount;
          var donecount = 0;
          var series = [];

          // reset iterator
          var j = 1;

          // use async helper function to generate all screenshots and
          // fire callback just once after work is done
          async.until(
            function() {
              return j > screenshotcount;
            },
            function(taskcallback) {
              var offset;
              if (timemarks !== null) {
                // get timemark for current iteration
                offset = timemarks[(j - 1)];
              } else {
                offset = secondOffset * j;
              }
              var target = self.escapedPath(folder + '/tn_' + offset + 's.jpg');
              var input = self.escapedPath(self.options.inputfile);


              // build screenshot command
              var tnArgs = [
                '-ss', offset,
                '-i', input,
                '-vcodec', 'mjpeg',
                '-vframes', '1',
                '-an',
                '-f', 'rawvideo',
                '-s', self.options.video.size,
                '-y', target
              ];

              j++;

              if (self.options._nice.level) {
                // execute ffmpeg through nice
                exec('nice -n ' + self.options._nice.level + ' ' + self.determineFfmpegPath() + ' ' + tnArgs.join(' '), taskcallback);
              } else {
                exec(self.determineFfmpegPath() + ' ' + tnArgs.join(' '), taskcallback);
              }
            },
            function(err) {
              callback(err);
            }
          );
        } else {
          self.options.logger.warn('meta data contains no duration, aborting screenshot creation');
          callback(new Error("meta data contains no duration, aborting screenshot creation"));
        }
      });
    }

    var timemarks, screenshotcount;
    if (typeof config === 'object') {
      // use json object as config
      if (config.count) {
        screenshotcount = config.count;
      }
      if (config.timemarks) {
        timemarks = config.timemarks;
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

    var self = this;

    // WORKAROUND: existsSync will be moved from path to fs with node v0.7
    var check = fs.existsSync;
    if (!check) {
      check = path.existsSync;
    }

    // check target folder
    if (!check(folder)) {
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
  };

  this._getProgressFromStdErr = function(stderrString, totalDurationSec) {
    // get last stderr line
    var lastLine = stderrString.split(/\r\n|\r|\n/g);
    var ll = lastLine[lastLine.length - 2];
    var progress = ll.split(/frame=([0-9\s]+)fps=([0-9\s]+)q=([0-9\.\s]+)(L?)size=([0-9\s]+)kB time=(([0-9]{2}):([0-9]{2}):([0-9]{2}).([0-9]{2})) bitrate=([0-9\.\s]+)kbits/ig);
    if (progress && progress.length > 10) {
      // build progress report object
      var ret = {
        frames: parseInt(progress[1], 10),
        currentFps: parseInt(progress[2], 10),
        currentKbps: parseFloat(progress[10]),
        targetSize: parseInt(progress[5], 10),
        timemark: progress[6]
      };

      // calculate percent progress using duration
      if (totalDurationSec && totalDurationSec > 0) {
        ret.percent = (this.ffmpegTimemarkToSeconds(ret.timemark) / totalDurationSec) * 100;
      }

      this.options.onProgress(ret);
    }
  };

  this._checkStdErrForCodec = function(stderrString) {
    var audio = /Audio\: ([^,]+)/.exec(stderrString);
    var video = /Video\: ([^,]+)/.exec(stderrString);
    var codecObject = { audio: '', video: '' };

    if (audio && audio.length > 1) {
      codecObject.audio = audio[1];
    }
    if (video && video.length > 1) {
      codecObject.video = video[1];
    }

    var codecInfoPassed = /Press \[q\] to stop/.exec(stderrString);
    if (codecInfoPassed) {
      this.options.onCodecData(codecObject);
      this.options.onCodecData = null;
    }
  };

  this._spawnProcess = function(args, options) {
    var retProc = spawn(this.determineFfmpegPath(), args, options);
    if (this.options._nice.level) {
      var niceLvl = (this.options._nice.level > 0 ? '+' + this.options._nice.level : this.options._nice.level);
      // renice the spawned process without waiting for callback
      var self = this;
      exec('renice -n ' + niceLvl + ' -p ' + retProc.pid, function(err, stderr, stdout) {
        self.options.logger.info('successfully reniced process with pid ' + retProc.pid + ' to ' + niceLvl + ' niceness!');
      });
    }
    if (retProc.stderr) {
      retProc.stderr.setEncoding('utf8');
    }
    return retProc;
  };

  this.buildFfmpegArgs = function(overrideOutputCheck, meta) {
    var args = [];

    // add startoffset and duration
    if (this.options.starttime) {
      args.push('-ss', this.options.starttime);
    }

    // add input file (if using fs mode)
    if (this.options.inputfile && !this.options.inputstream) {
      if (/^[a-z]+:\/\//.exec(this.options.inputfile)) {
        args.push('-i', this.options.inputfile.replace(' ', '%20'));
      } else {
        var fstats = fs.statSync(this.options.inputfile);
        if (fstats.isFile()) {
          // fix for spawn call with path containing spaces
          args.push('-i', this.options.inputfile.replace(' ', '\\ '));
        } else {
          this.options.logger.error('input file is not readable');
          throw new Error('input file is not readable');
        }
      }
    // check for input stream
    } else if (this.options.inputstream) {
      // push args to make ffmpeg read from stdin
      args.push('-i', '-');
    }

    if (this.options.duration) {
      args.push('-t', this.options.duration);
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
      if (this.atLeastVersion(meta.ffmpegversion, '0.7')) {
        // padding is not supported ffmpeg < 0.7 (only using legacy commands which were replaced by vfilter calls)
        args.push('-vf');
        args.push('pad=' + this.options.video.pad.w +
          ':' + this.options.video.pad.h +
          ':' + this.options.video.pad.x +
          ':' + this.options.video.pad.y +
          ':' + this.options.video.padcolor);
      } else {
        return new Error("Your ffmpeg version " + meta.ffmpegversion + " does not support padding");
      }
    }

    // add size and output file
    if (this.options.video.size && !this.options.video.skip) {
      args.push('-s', this.options.video.size);
    }


    if (this.options.outputfile) {
      args.push('-y', this.options.outputfile.replace(' ', '\\ '));
    } else {
      if (!overrideOutputCheck) {
        this.options.logger.error('no outputfile specified');
      }
    }
//console.log(args);
    return args;
  };
};
