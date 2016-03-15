/*jshint node:true*/
'use strict';

var exec = require('child_process').exec;
var isWindows = require('os').platform().match(/win(32|64)/);
var which = require('which');

var nlRegexp = /\r\n|\r|\n/g;
var streamRegexp = /^\[?(.*?)\]?$/;
var filterEscapeRegexp = /[,]/;
var whichCache = {};

/**
 * Parse progress line from ffmpeg stderr
 *
 * @param {String} line progress line
 * @return progress object
 * @private
 */
function parseProgressLine(line) {
  var progress = {};

  // Remove all spaces after = and trim
  line  = line.replace(/=\s+/g, '=').trim();
  var progressParts = line.split(' ');

  // Split every progress part by "=" to get key and value
  for(var i = 0; i < progressParts.length; i++) {
    var progressSplit = progressParts[i].split('=', 2);
    var key = progressSplit[0];
    var value = progressSplit[1];

    // This is not a progress line
    if(typeof value === 'undefined')
      return null;

    progress[key] = value;
  }

  return progress;
}


var utils = module.exports = {
  isWindows: isWindows,
  streamRegexp: streamRegexp,


  /**
   * Copy an object keys into another one
   *
   * @param {Object} source source object
   * @param {Object} dest destination object
   * @private
   */
  copy: function(source, dest) {
    Object.keys(source).forEach(function(key) {
      dest[key] = source[key];
    });
  },


  /**
   * Create an argument list
   *
   * Returns a function that adds new arguments to the list.
   * It also has the following methods:
   * - clear() empties the argument list
   * - get() returns the argument list
   * - find(arg, count) finds 'arg' in the list and return the following 'count' items, or undefined if not found
   * - remove(arg, count) remove 'arg' in the list as well as the following 'count' items
   *
   * @private
   */
  args: function() {
    var list = [];

    // Append argument(s) to the list
    var argfunc = function() {
      if (arguments.length === 1 && Array.isArray(arguments[0])) {
        list = list.concat(arguments[0]);
      } else {
        list = list.concat([].slice.call(arguments));
      }
    };

    // Clear argument list
    argfunc.clear = function() {
      list = [];
    };

    // Return argument list
    argfunc.get = function() {
      return list;
    };

    // Find argument 'arg' in list, and if found, return an array of the 'count' items that follow it
    argfunc.find = function(arg, count) {
      var index = list.indexOf(arg);
      if (index !== -1) {
        return list.slice(index + 1, index + 1 + (count || 0));
      }
    };

    // Find argument 'arg' in list, and if found, remove it as well as the 'count' items that follow it
    argfunc.remove = function(arg, count) {
      var index = list.indexOf(arg);
      if (index !== -1) {
        list.splice(index, (count || 0) + 1);
      }
    };

    // Clone argument list
    argfunc.clone = function() {
      var cloned = utils.args();
      cloned(list);
      return cloned;
    };

    return argfunc;
  },


  /**
   * Generate filter strings
   *
   * @param {String[]|Object[]} filters filter specifications. When using objects,
   *   each must have the following properties:
   * @param {String} filters.filter filter name
   * @param {String|Array} [filters.inputs] (array of) input stream specifier(s) for the filter,
   *   defaults to ffmpeg automatically choosing the first unused matching streams
   * @param {String|Array} [filters.outputs] (array of) output stream specifier(s) for the filter,
   *   defaults to ffmpeg automatically assigning the output to the output file
   * @param {Object|String|Array} [filters.options] filter options, can be omitted to not set any options
   * @return String[]
   * @private
   */
  makeFilterStrings: function(filters) {
    return filters.map(function(filterSpec) {
      if (typeof filterSpec === 'string') {
        return filterSpec;
      }

      var filterString = '';

      // Filter string format is:
      // [input1][input2]...filter[output1][output2]...
      // The 'filter' part can optionaly have arguments:
      //   filter=arg1:arg2:arg3
      //   filter=arg1=v1:arg2=v2:arg3=v3

      // Add inputs
      if (Array.isArray(filterSpec.inputs)) {
        filterString += filterSpec.inputs.map(function(streamSpec) {
          return streamSpec.replace(streamRegexp, '[$1]');
        }).join('');
      } else if (typeof filterSpec.inputs === 'string') {
        filterString += filterSpec.inputs.replace(streamRegexp, '[$1]');
      }

      // Add filter
      filterString += filterSpec.filter;

      // Add options
      if (filterSpec.options) {
        if (typeof filterSpec.options === 'string' || typeof filterSpec.options === 'number') {
          // Option string
          filterString += '=' + filterSpec.options;
        } else if (Array.isArray(filterSpec.options)) {
          // Option array (unnamed options)
          filterString += '=' + filterSpec.options.map(function(option) {
            if (typeof option === 'string' && option.match(filterEscapeRegexp)) {
              return '\'' + option + '\'';
            } else {
              return option;
            }
          }).join(':');
        } else if (Object.keys(filterSpec.options).length) {
          // Option object (named options)
          filterString += '=' + Object.keys(filterSpec.options).map(function(option) {
            var value = filterSpec.options[option];

            if (typeof value === 'string' && value.match(filterEscapeRegexp)) {
              value = '\'' + value + '\'';
            }

            return option + '=' + value;
          }).join(':');
        }
      }

      // Add outputs
      if (Array.isArray(filterSpec.outputs)) {
        filterString += filterSpec.outputs.map(function(streamSpec) {
          return streamSpec.replace(streamRegexp, '[$1]');
        }).join('');
      } else if (typeof filterSpec.outputs === 'string') {
        filterString += filterSpec.outputs.replace(streamRegexp, '[$1]');
      }

      return filterString;
    });
  },


  /**
   * Search for an executable
   *
   * Uses 'which' or 'where' depending on platform
   *
   * @param {String} name executable name
   * @param {Function} callback callback with signature (err, path)
   * @private
   */
  which: function(name, callback) {
    if (name in whichCache) {
      return callback(null, whichCache[name]);
    }

    which(name, function(err, result){
      if (err) {
        // Treat errors as not found
        return callback(null, whichCache[name] = '');
      }
      callback(null, whichCache[name] = result);
    });
  },


  /**
   * Convert a [[hh:]mm:]ss[.xxx] timemark into seconds
   *
   * @param {String} timemark timemark string
   * @return Number
   * @private
   */
  timemarkToSeconds: function(timemark) {
    if (typeof timemark === 'number') {
      return timemark;
    }

    if (timemark.indexOf(':') === -1 && timemark.indexOf('.') >= 0) {
      return Number(timemark);
    }

    var parts = timemark.split(':');

    // add seconds
    var secs = Number(parts.pop());

    if (parts.length) {
      // add minutes
      secs += Number(parts.pop()) * 60;
    }

    if (parts.length) {
      // add hours
      secs += Number(parts.pop()) * 3600;
    }

    return secs;
  },


  /**
   * Extract codec data from ffmpeg stderr and emit 'codecData' event if appropriate
   *
   * @param {FfmpegCommand} command event emitter
   * @param {String} stderr ffmpeg stderr output
   * @private
   */
  extractCodecData: function(command, stderr) {
    var format= /Input #[0-9]+, ([^ ]+),/.exec(stderr);
    var dur   = /Duration\: ([^,]+)/.exec(stderr);
    var audio = /Audio\: (.*)/.exec(stderr);
    var video = /Video\: (.*)/.exec(stderr);
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

    var streamInputs = command._inputs.filter(function(input) {
      return input.isStream;
    });

    var codecInfoPassed = false;
    if (streamInputs.length === 0) {
      codecInfoPassed = /Press (\[q\]|ctrl-c) to stop/.test(stderr);
    } else {
      codecInfoPassed = /[\r\n]+Output #/.test(stderr);
    }

    if (codecInfoPassed) {
      command.emit('codecData', codecObject);
      command._codecDataSent = true;
    }
  },


  /**
   * Extract progress data from ffmpeg stderr and emit 'progress' event if appropriate
   *
   * @param {FfmpegCommand} command event emitter
   * @param {String} stderr ffmpeg stderr data
   * @param {Number} [duration=0] expected output duration in seconds
   * @private
   */
  extractProgress: function(command, stderr, duration) {
    var lines = stderr.split(nlRegexp);
    var lastline = lines[lines.length - 2];
    var progress;

    if (lastline) {
      progress = parseProgressLine(lastline);
    }

    if (progress) {
      // build progress report object
      var ret = {
        frames: parseInt(progress.frame, 10),
        currentFps: parseInt(progress.fps, 10),
        currentKbps: progress.bitrate ? parseFloat(progress.bitrate.replace('kbits/s', '')) : 0,
        targetSize: parseInt(progress.size, 10),
        timemark: progress.time
      };

      // calculate percent progress using duration
      if (duration && duration > 0) {
        ret.percent = (utils.timemarkToSeconds(ret.timemark) / duration) * 100;
      }

      command.emit('progress', ret);
    }
  },


  /**
   * Extract error message(s) from ffmpeg stderr
   *
   * @param {String} stderr ffmpeg stderr data
   * @return {String}
   * @private
   */
  extractError: function(stderr) {
    // Only return the last stderr lines that don't start with a space or a square bracket
    return stderr.split(nlRegexp).reduce(function(messages, message) {
      if (message.charAt(0) === ' ' || message.charAt(0) === '[') {
        return [];
      } else {
        messages.push(message);
        return messages;
      }
    }, []).join('\n');
  }
};
