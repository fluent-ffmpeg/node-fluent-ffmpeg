/*jshint node:true, laxcomma:true*/
'use strict';
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: 'myapp'});
var mod_spawnasync = require('spawn-async');
var worker = mod_spawnasync.createWorker({ 'log': log });


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
	  var ffprobe = worker.aspawn([
	  	path,
	  	'-show_streams',
        '-show_format',
        input.source
      ],function (err, stdout, stderr) {
		  if (err) {
			  callback(err);
		  } else {
        
		  var exitError = null;
		  if (err) {
          	exitError = err;
		  }
		  if (exitError) {
			  if (stderr) {
				  exitError.message += '\n' + stderr;
				  return callback(exitError);
			  }
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
	  });

    });
  };
};
