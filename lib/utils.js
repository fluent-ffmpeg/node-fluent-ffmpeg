/*jshint node:true*/
'use strict';

var exec = require('child_process').exec;
var isWindows = require('os').platform().match(/win(32|64)/);

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
    var argfunc = function() {
      if (arguments.length === 1 && Array.isArray(arguments[0])) {
        list = list.concat(arguments[0]);
      } else {
        list = list.concat([].slice.call(arguments));
      }
    };

    argfunc.clear = function() {
      list = [];
    };

    argfunc.get = function() {
      return list;
    };

    argfunc.find = function(arg, count) {
      var index = list.indexOf(arg);
      if (index !== -1) {
        return list.slice(index + 1, index + 1 + (count || 0));
      }
    };

    argfunc.remove = function(arg, count) {
      var index = list.indexOf(arg);
      if (index !== -1) {
        list.splice(index, (count || 0) + 1);
      }
    };

    return argfunc;
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

    var cmd = 'which ' + name;
    if (isWindows) {
      cmd = 'where ' + name + '.exe';
    }

    exec(cmd, function(err, stdout) {
      if (err) {
        // Treat errors as not found
        callback(null, whichCache[name] = '');
      } else {
        callback(null, whichCache[name] = stdout.replace(/\n$/, ''));
      }
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
    if(timemark.indexOf(':') === -1 && timemark.indexOf('.') >= 0)
      return Number(timemark);

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

    var codecInfoPassed = /Press (\[q\]|ctrl-c) to stop/.test(stderr);
    if (codecInfoPassed) {
      command.emit('codecData', codecObject);
      command._codecDataSent = true;
    }
  },


  /**
   * Extract progress data from ffmpeg stderr and emit 'progress' event if appropriate
   *
   * @param {FfmpegCommand} command event emitter
   * @param {Number} [duration=0] expected output duration in seconds
   */
  extractProgress: function(command, stderr, duration) {
    var lines = stderr.split(/\r\n|\r|\n/g);
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
        currentKbps: parseFloat(progress.bitrate.replace('kbits/s', '')),
        targetSize: parseInt(progress.size, 10),
        timemark: progress.time
      };

      // calculate percent progress using duration
      if (duration && duration > 0) {
        ret.percent = (utils.timemarkToSeconds(ret.timemark) / duration) * 100;
      }

      command.emit('progress', ret);
    }
  }
};
