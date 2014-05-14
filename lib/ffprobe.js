/*jshint node:true, laxcomma:true*/
'use strict';

var spawn = require('child_process').spawn;


function legacyTag(key) { return key.match(/^TAG:/); }
function legacyDisposition(key) { return key.match(/^DISPOSITION:/); }


module.exports = function(proto) {
  /**
   * A callback passed to the {@link FfmpegCommand#ffprobe} method.
   *
   * @callback FfmpegCommand~ffprobeCallback
   *
   * @param {Error|null} err error object or null if no error happened
   * @param {Object} ffprobeData ffprobe output data; this object
   *   has the same format as what the following command returns:
   *
   *     `ffprobe -print_format json -show_streams -show_format INPUTFILE`
   * @param {Array} ffprobeData.streams stream information
   * @param {Object} ffprobeData.format format information
   */

  /**
   * Run ffprobe on last specified input
   *
   * @method FfmpegCommand#ffprobe
   * @category Metadata
   *
   * @param {FfmpegCommand~ffprobeCallback} callback callback function
   *
   */
  proto.ffprobe = function(callback) {
    if (!this._currentInput) {
      return callback(new Error('No input specified'));
    }

    if (typeof this._currentInput.source !== 'string') {
      return callback(new Error('Cannot run ffprobe on non-file input'));
    }

    // Find ffprobe
    var self = this;
    this._getFfprobePath(function(err, path) {
      if (err) {
        return callback(err);
      } else if (!path) {
        return callback(new Error('Cannot find ffprobe'));
      }

      var stdout = '';
      var stdoutClosed = false;
      var stderr = '';
      var stderrClosed = false;

      // Spawn ffprobe
      var ffprobe = spawn(path, [
        '-print_format', 'json',
        '-show_streams',
        '-show_format',
        self._currentInput.source
      ]);

      ffprobe.on('error', function(err) {
        callback(err);
      });

      // Ensure we wait for captured streams to end before calling callback
      var exitError = null;
      function handleExit(err) {
        if (err) {
          exitError = err;
        }

        if (processExited && stdoutClosed && stderrClosed) {
          if (exitError) {
            if (stderr) {
              exitError.message += '\n' + stderr;
            }

            return callback(exitError);
          }

          // Process output
          var data;

          try {
            data = JSON.parse(stdout);
          } catch(e) {
            return callback(e);
          }

          // Handle legacy output with "TAG:x" and "DISPOSITION:x" keys
          [data.format].concat(data.streams).forEach(function(target) {
            var legacyTagKeys = Object.keys(target).filter(legacyTag);

            if (legacyTagKeys.length) {
              target.tags = target.tags || {};

              legacyTagKeys.forEach(function(tagKey) {
                target.tags[tagKey.substr(4)] = target[tagKey];
                delete target[tagKey];
              });
            }

            var legacyDispositionKeys = Object.keys(target).filter(legacyDisposition);

            if (legacyDispositionKeys.length) {
              target.disposition = target.disposition || {};

              legacyDispositionKeys.forEach(function(dispositionKey) {
                target.disposition[dispositionKey.substr(12)] = target[dispositionKey];
                delete target[dispositionKey];
              });
            }
          });

          callback(null, data);
        }
      }

      // Handle ffprobe exit
      var processExited = false;
      ffprobe.on('exit', function(code, signal) {
        processExited = true;

        if (code) {
          handleExit(new Error('ffprobe exited with code ' + code));
        } else if (signal) {
          handleExit(new Error('ffprobe was killed with signal ' + signal));
        } else {
          handleExit();
        }
      });

      // Handle stdout/stderr streams
      ffprobe.stdout.on('data', function(data) {
        stdout += data;
      });

      ffprobe.stdout.on('close', function() {
        stdoutClosed = true;
        handleExit();
      });

      ffprobe.stderr.on('data', function(data) {
        stderr += data;
      });

      ffprobe.stderr.on('close', function() {
        stderrClosed = true;
        handleExit();
      });
    });
  };
};

