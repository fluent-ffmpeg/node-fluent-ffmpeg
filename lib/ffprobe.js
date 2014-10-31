/*jshint node:true, laxcomma:true*/
'use strict';

var spawn = require('child_process').spawn;


function legacyTag(key) { return key.match(/^TAG:/); }
function legacyDisposition(key) { return key.match(/^DISPOSITION:/); }

function parseFfprobeOutput(out) {
  var lines = out.split(/\r\n|\r|\n/);
  var data = {
    streams: []
  };

  function parseBlock() {
    var data = {};

    var line = lines.shift();
    while (line) {
      if (line.match(/^\[\//)) {
        return data;
      }

      var kv = line.match(/^([^=]+)=(.*)$/);
      if (kv) {
        if (!(kv[1].match(/^TAG:/)) && kv[2].match(/^[0-9]+(\.[0-9]+)?$/)) {
          data[kv[1]] = Number(kv[2]);
        } else {
          data[kv[1]] = kv[2];
        }
      }

      line = lines.shift();
    }

    return data;
  }

  var line = lines.shift();
  while (line) {
    if (line === '[STREAM]') {
      var stream = parseBlock();
      data.streams.push(stream);
    } else if (line === '[FORMAT]') {
      data.format = parseBlock();
    }

    line = lines.shift();
  }

  return data;
}



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

    if (input.isStream) {
      return callback(new Error('Cannot run ffprobe on stream input'));
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
          var data = parseFfprobeOutput(stdout);

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

