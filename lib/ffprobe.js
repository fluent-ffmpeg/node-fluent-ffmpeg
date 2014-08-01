/*jshint node:true, laxcomma:true*/
'use strict';

var spawn = require('child_process').spawn;


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
   * @param {Number} [index] 0-based index of input to probe (defaults to last input)
   * @param {FfmpegCommand~ffprobeCallback} callback callback function
   *
   */
  proto.ffprobe = function(index, callback) {
    var input;

    if (typeof callback === 'undefined') {
      callback = index;

      if (!this._currentInput) {
        return callback(new Error('No input specified'));
      }

      input = this._currentInput;
    } else {
      input = this._inputs[index];

      if (!input) {
        return callback(new Error('Invalid input index'));
      }
    }

    if (!input.isFile) {
      return callback(new Error('Cannot run ffprobe on non-file input'));
    }

    // Find ffprobe
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
        '-show_streams',
        '-show_format',
        '-of', 'json',
        input.source
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
          var data = JSON.parse(stdout);
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

