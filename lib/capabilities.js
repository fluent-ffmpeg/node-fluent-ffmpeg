/*jshint node:true*/
'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var utils = require('./utils');

/*
 *! Capability helpers
 */

var avCodecRegexp = /^\s*([D ])([E ])([VAS])([S ])([D ])([T ]) ([^ ]+) +(.*)$/;
var ffCodecRegexp = /^\s*([D\.])([E\.])([VAS])([I\.])([L\.])([S\.]) ([^ ]+) +(.*)$/;
var ffEncodersRegexp = /\(encoders:([^\)]+)\)/;
var ffDecodersRegexp = /\(decoders:([^\)]+)\)/;
var formatRegexp = /^\s*([D ])([E ]) ([^ ]+) +(.*)$/;
var lineBreakRegexp = /\r\n|\r|\n/;
var filterRegexp = /^(?: [T\.][S\.][C\.] )?([^ ]+) +(AA?|VV?|\|)->(AA?|VV?|\|) +(.*)$/;

var cache = {};

function copy(src, dest) {
  Object.keys(src).forEach(function(k) {
    dest[k] = src[k];
  });
}

module.exports = function(proto) {
  /**
   * Check for ffmpeg availability
   *
   * If the FFMPEG_PATH environment variable is set, try to use it.
   * If it is unset or incorrect, try to find ffmpeg in the PATH instead.
   *
   * @method FfmpegCommand#_getFfmpegPath
   * @param {Function} callback callback with signature (err, path)
   * @private
   */
  proto._getFfmpegPath = function(callback) {
    if ('ffmpegPath' in cache) {
      return callback(null, cache.ffmpegPath);
    }

    async.waterfall([
      // Try FFMPEG_PATH
      function(cb) {
        if (process.env.FFMPEG_PATH) {
          fs.exists(process.env.FFMPEG_PATH, function(exists) {
            if (exists) {
              cb(null, process.env.FFMPEG_PATH);
            } else {
              cb();
            }
          });
        } else {
          cb();
        }
      },

      // Search in the PATH
      function(ffmpeg, cb) {
        if (ffmpeg) {
          return cb(null, ffmpeg);
        }

        utils.which('ffmpeg', function(err, ffmpeg) {
          cb(err, ffmpeg);
        });
      }
    ], function(err, ffmpeg) {
      if (err) {
        callback(err);
      } else {
        callback(null, cache.ffmpegPath = (ffmpeg || ''));
      }
    });
  };


  /**
   * Check for ffprobe availability
   *
   * If the FFPROBE_PATH environment variable is set, try to use it.
   * If it is unset or incorrect, try to find ffprobe in the PATH instead.
   * If this still fails, try to find ffprobe in the same directory as ffmpeg.
   *
   * @method FfmpegCommand#_getFfprobePath
   * @param {Function} callback callback with signature (err, path)
   * @private
   */
  proto._getFfprobePath = function(callback) {
    if ('ffprobePath' in cache) {
      return callback(null, cache.ffprobePath);
    }

    var self = this;
    async.waterfall([
      // Try FFPROBE_PATH
      function(cb) {
        if (process.env.FFPROBE_PATH) {
          fs.exists(process.env.FFPROBE_PATH, function(exists) {
            cb(null, exists ? process.env.FFPROBE_PATH : null);
          });
        } else {
          cb();
        }
      },

      // Search in the PATH
      function(ffprobe, cb) {
        if (ffprobe) {
          return cb(null, ffprobe);
        }

        utils.which('ffprobe', function(err, ffprobe) {
          cb(err, ffprobe);
        });
      },

      // Search in the same directory as ffmpeg
      function(ffprobe, cb) {
        if (ffprobe) {
          return cb(null, ffprobe);
        }

        self._getFfmpegPath(function(err, ffmpeg) {
          if (err) {
            cb(err);
          } else if (ffmpeg.length) {
            var name = utils.isWindows ? 'ffprobe.exe' : 'ffprobe';
            var ffprobe = path.join(path.dirname(ffmpeg), name);
            fs.exists(ffprobe, function(exists) {
              cb(null, exists ? ffprobe : null);
            });
          } else {
            cb();
          }
        });
      }
    ], function(err, ffprobe) {
      if (err) {
        callback(err);
      } else {
        callback(null, cache.ffprobePath = (ffprobe || ''));
      }
    });
  };


  /**
   * Check for flvtool2/flvmeta availability
   *
   * If the FLVTOOL2_PATH or FLVMETA_PATH environment variable are set, try to use them.
   * If both are either unset or incorrect, try to find flvtool2 or flvmeta in the PATH instead.
   *
   * @method FfmpegCommand#_getFlvtoolPath
   * @param {Function} callback callback with signature (err, path)
   * @private
   */
  proto._getFlvtoolPath = function(callback) {
    if ('flvtoolPath' in cache) {
      return callback(null, cache.flvtoolPath);
    }

    async.waterfall([
      // Try FLVMETA_PATH
      function(cb) {
        if (process.env.FLVMETA_PATH) {
          fs.exists(process.env.FLVMETA_PATH, function(exists) {
            cb(null, exists ? process.env.FLVMETA_PATH : null);
          });
        } else {
          cb();
        }
      },

      // Try FLVTOOL2_PATH
      function(flvtool, cb) {
        if (process.env.FLVTOOL2_PATH) {
          fs.exists(process.env.FLVTOOL2_PATH, function(exists) {
            cb(null, exists ? process.env.FLVTOOL2_PATH : null);
          });
        } else {
          cb();
        }
      },

      // Search for flvmeta in the PATH
      function(flvtool, cb) {
        if (flvtool) {
          return cb(null, flvtool);
        }

        utils.which('flvmeta', function(err, flvmeta) {
          cb(err, flvmeta);
        });
      },

      // Search for flvtool2 in the PATH
      function(flvtool, cb) {
        if (flvtool) {
          return cb(null, flvtool);
        }

        utils.which('flvtool2', function(err, flvtool2) {
          cb(err, flvtool2);
        });
      },
    ], function(err, flvtool) {
      if (err) {
        callback(err);
      } else {
        callback(null, cache.flvtoolPath = (flvtool || ''));
      }
    });
  };


  /**
   * Query ffmpeg for available filters
   *
   * Calls 'callback' with a filters object as its second argument. This
   * object has keys for every available filter, and values are object
   * with filter data:
   * - 'description': filter description
   * - 'input': input type ('audio', 'video' or 'none')
   * - 'multipleInputs': bool, whether the filter supports multiple inputs
   * - 'output': output type ('audio', 'video' or 'none')
   * - 'multipleOutputs': bool, whether the filter supports multiple outputs
   *
   * @method FfmpegCommand#availableFilters
   * @param {Function} callback callback with signature (err, filters)
   */
  proto.availableFilters =
  proto.getAvailableFilters = function(callback) {
    if ('filters' in cache) {
      return callback(null, cache.filters);
    }

    this._spawnFfmpeg(['-filters'], { captureStdout: true }, function (err, stdout) {
      if (err) {
        return callback(err);
      }

      var lines = stdout.split('\n');
      var data = {};
      var types = { A: 'audio', V: 'video', '|': 'none' };

      lines.forEach(function(line) {
        var match = line.match(filterRegexp);
        if (match) {
          data[match[1]] = {
            description: match[4],
            input: types[match[2].charAt(0)],
            multipleInputs: match[2].length > 1,
            output: types[match[3].charAt(0)],
            multipleOutputs: match[3].length > 1
          };
        }
      });

      callback(null, cache.filters = data);
    });
  };


  /**
   * Query ffmpeg for available codecs
   *
   * Calls 'callback' with a codecs object as its second argument. This
   * object has keys for every available codec, and values are object
   * with codec data:
   * - 'description': codec description
   * - 'canEncode': bool, whether the codec can encode streams
   * - 'canDecode': bool, whether the codec can decode streams
   *
   * Depending on the ffmpeg version, more keys can be available.
   *
   * @method FfmpegCommand#availableCodecs
   * @param {Function} callback callback with signature (err, codecs)
   */
  proto.availableCodecs =
  proto.getAvailableCodecs = function(callback) {
    if ('codecs' in cache) {
      return callback(null, cache.codecs);
    }

    this._spawnFfmpeg(['-codecs'], { captureStdout: true }, function(err, stdout) {
      if (err) {
        return callback(err);
      }

      var lines = stdout.split(lineBreakRegexp);
      var data = {};

      lines.forEach(function(line) {
        var match = line.match(avCodecRegexp);
        if (match && match[7] !== '=') {
          data[match[7]] = {
            type: { 'V': 'video', 'A': 'audio', 'S': 'subtitle' }[match[3]],
            description: match[8],
            canDecode: match[1] === 'D',
            canEncode: match[2] === 'E',
            drawHorizBand: match[4] === 'S',
            directRendering: match[5] === 'D',
            weirdFrameTruncation: match[6] === 'T'
          };
        }

        match = line.match(ffCodecRegexp);
        if (match && match[7] !== '=') {
          var codecData = data[match[7]] = {
            type: { 'V': 'video', 'A': 'audio', 'S': 'subtitle' }[match[3]],
            description: match[8],
            canDecode: match[1] === 'D',
            canEncode: match[2] === 'E',
            intraFrameOnly: match[4] === 'I',
            isLossy: match[5] === 'L',
            isLossless: match[6] === 'S'
          };

          var encoders = codecData.description.match(ffEncodersRegexp);
          encoders = encoders ? encoders[1].trim().split(' ') : [];

          var decoders = codecData.description.match(ffDecodersRegexp);
          decoders = decoders ? decoders[1].trim().split(' ') : [];

          if (encoders.length || decoders.length) {
            var coderData = {};
            copy(codecData, coderData);
            delete coderData.canEncode;
            delete coderData.canDecode;

            encoders.forEach(function(name) {
              data[name] = {};
              copy(coderData, data[name]);
              data[name].canEncode = true;
            });

            decoders.forEach(function(name) {
              if (name in data) {
                data[name].canDecode = true;
              } else {
                data[name] = {};
                copy(coderData, data[name]);
                data[name].canDecode = true;
              }
            });
          }
        }
      });

      callback(null, cache.codecs = data);
    });
  };


  /**
   * Query ffmpeg for available formats
   *
   * Calls 'callback' with a formats object as its second argument. This
   * object has keys for every available format, and values are object
   * with format data:
   * - 'description': format description
   * - 'canMux': bool, whether the format can mux streams into an output file
   * - 'canDemux': bool, whether the format can demux streams from an input file
   *
   * @method FfmpegCommand#availableFormats
   * @param {Function} callback callback with signature (err, formats)
   */
  proto.availableFormats =
  proto.getAvailableFormats = function(callback) {
    if ('formats' in cache) {
      return callback(null, cache.formats);
    }

    // Run ffmpeg -formats
    this._spawnFfmpeg(['-formats'], { captureStdout: true }, function (err, stdout) {
      if (err) {
        return callback(err);
      }

      // Parse output
      var lines = stdout.split(lineBreakRegexp);
      var data = {};

      lines.forEach(function(line) {
        var match = line.match(formatRegexp);
        if (match) {
          data[match[3]] = {
            description: match[4],
            canDemux: match[1] === 'D',
            canMux: match[2] === 'E'
          };
        }
      });

      callback(null, cache.formats = data);
    });
  };
};
