var fs = require('fs'),
  path = require('path'),
  async = require('../support/async.min.js'),
  exec = require('child_process').exec,
  spawn = require('child_process').spawn,
  helper = require('./helpers.js'),
  Meta = require('./metadata.js');

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
        var args = self.buildFfmpegArgs(false);

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
          if (self.options.onCodecData) self._checkStdErrForCodec(stderr);
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
              callback(self.E_PROCESSTIMEOUT, 'timeout');
            }, self.options.timeout);
          }

          var stderr = '';

          ffmpegProc.stderr.on('data', function(data) {
            stderr += data;
            if (self.options.onCodecData) self._checkStdErrForCodec(stderr);
          });

          ffmpegProc.stdout.on('data', function(chunk) {
          	stream.write(chunk);
          });

          ffmpegProc.on('exit', function(code, signal) {
            if (processTimer) clearTimeout(processTimer);
            // close file descriptor on outstream
            if(/http/.exec(self.options.inputfile)) {
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
              if ( !stream.fd ) {
                stream.end ? stream.end() : callback(code, "stream will not be closed");
                cb_();
              } else {
                fs.close(stream.fd, cb_);
              }
            }
          });
        }
      });
    }
  };

  this.takeScreenshot = function(config, callback) {
		if (!this.options.video.size) {
      callback(new Error("set size of thumbnails using 'withSize' method"));
    }

		var self = this;

    var input = Meta.escapedPath(this.options.inputfile);
    var output = Meta.escapedPath(config.outputfile);

		// build screenshot command
    var tnArgs = [
      '-ss', config.offset,
      '-i', input,
      '-vcodec', 'mjpeg',
      '-vframes', '1',
      '-an',
      '-f', 'rawvideo',
      '-s', self.options.video.size,
      '-y', output
    ];

		exec(helper.determineFfmpegPath() + ' ' + tnArgs.join(' '), callback);
	}

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
              var target = Meta.escapedPath(folder + '/tn_' + offset + 's.jpg');
              var input = Meta.escapedPath(self.options.inputfile);


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

              i++;

              if (self.options._nice.level) {
                // execute ffmpeg through nice
                exec('nice -n="' + self.options._nice.level + '" ' + helper.determineFfmpegPath() + ' ' + tnArgs.join(' '), taskcallback);
              } else {
                exec(helper.determineFfmpegPath() + ' ' + tnArgs.join(' '), taskcallback);
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
    var retProc = spawn(helper.determineFfmpegPath(), args, options);
    if (this.options._nice.level) {
      var niceLvl = (this.options._nice.level > 0 ? '+' + this.options._nice.level : this.options._nice.level);
      // renice the spawned process without waiting for callback
      exec('renice -n ' + niceLvl + ' -p ' + retProc.pid, function(err, stderr, stdout) {
        //console.log('successfully reniced process with pid ' + retProc.pid + ' to ' + niceLvl + ' niceness!');
      });
    }
    if (retProc.stderr) retProc.stderr.setEncoding('utf8');
    return retProc;
  };

  this.buildFfmpegArgs = function(overrideOutputCheck) {
    var args = [];

    // add startoffset and duration
    if (this.options.starttime) {
      args.push('-ss', this.options.starttime);
    }

    // add input file (if using fs mode)
    if (this.options.inputfile && !this.options.inputstream) {
      try
      {
        if(/http/.exec(this.options.inputfile)) {
          args.push('-i', this.options.inputfile.replace(' ', '%20'));
        } else {
          var fstats = fs.statSync(this.options.inputfile);
          if (fstats.isFile()) {
            // fix for spawn call with path containing spaces
            args.push('-i', this.options.inputfile.replace(' ', '\ '));
          } else {
            throw new Error('input file is not readable');
          }
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
