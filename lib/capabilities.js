/*jshint node:true*/
'use strict';

var exec = require('child_process').exec,
  Registry = require('./registry');

var avCodecRegexp = /^\s*([D ])([E ])([VAS])([S ])([D ])([T ]) ([^ ]+) +(.*)$/;
var ffCodecRegexp = /^\s*([D\.])([E\.])([VAS])([I\.])([L\.])([S\.]) ([^ ]+) +(.*)$/;
var ffEncodersRegexp = /\(encoders:([^\)]+)\)/;
var ffDecodersRegexp = /\(decoders:([^\)]+)\)/;
var formatRegexp = /^\s*([D ])([E ]) ([^ ]+) +(.*)$/;
var lineBreakRegexp = /\r\n|\r|\n/;
var filterRegexp = /^(?: [T\.][S\.][C\.] )?([^ ]+) +(AA?|VV?|\|)->(AA?|VV?|\|) +(.*)$/;

function copy(src, dest) {
  Object.keys(src).forEach(function(k) {
    dest[k] = src[k];
  });
}

exports = module.exports = function capabilities(FfmpegCommand) {
  FfmpegCommand.prototype.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  FfmpegCommand.prototype.ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';

  FfmpegCommand.prototype.setFfmpegPath = function(path) {
    this.ffmpegPath = path;
  };

  FfmpegCommand.prototype.setFfprobePath = function(path) {
    this.ffprobePath = path;
  };

  FfmpegCommand.prototype.determineFfmpegPath = function() {
    if (this.ffmpegPath) {
      return this.ffmpegPath;
    }
    return 'ffmpeg';
  };

  FfmpegCommand.getAvailableFilters =
  FfmpegCommand.prototype.getAvailableFilters = function(callback) {
    var self = this instanceof FfmpegCommand ? this : new FfmpegCommand({source:''});

    var filters = Registry.instance.get('capabilityFilters');
    if (!filters) {
      self._spawnFfmpeg(['-filters'], { captureStdout: true }, function (err, stdout) {
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

        Registry.instance.set('capabilityFilters', data);
        callback(null, data);
      });
    } else {
      callback(null, filters);
    }
  };

  FfmpegCommand.getAvailableCodecs =
  FfmpegCommand.prototype.getAvailableCodecs = function(callback) {
    var self = this instanceof FfmpegCommand ? this : new FfmpegCommand({source:''});

    var codecs = Registry.instance.get('capabilityCodecs');
    if (!codecs) {
      self._spawnFfmpeg(['-codecs'], { captureStdout: true }, function(err, stdout) {
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

        Registry.instance.set('capabilityCodecs', data);
        callback(null, data);
      });
    } else {
      callback(null, codecs);
    }
  };

  FfmpegCommand.getAvailableFormats =
  FfmpegCommand.prototype.getAvailableFormats = function(callback) {
    var self = this instanceof FfmpegCommand ? this : new FfmpegCommand({source:''});

    var formats = Registry.instance.get('capabilityFormats');
    if (!formats) {
      self._spawnFfmpeg(['-formats'], { captureStdout: true }, function (err, stdout) {
        if (err) {
          return callback(err);
        }

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

        Registry.instance.set('capabilityFormats', data);
        callback(null, data);
      });
    } else {
      callback(null, formats);
    }
  };

  FfmpegCommand.prototype._checkFormatCapabilities = function(callback) {
    var options = this.options;

    if (options.format || options.fromFormat) {
      this.getAvailableFormats(function(err, formats) {
        if (err) {
          callback(new Error('cannot get available formats: ' + err.message));
        } else {
          if (options.format) {
            if (!(options.format in formats)) {
              return callback(new Error('format ' + options.format + ' not available'));
            }
            if (!formats[options.format].canMux) {
              return callback(new Error('cannot mux output using format ' + options.format));
            }
          }

          if (options.fromFormat) {
            if (!(options.fromFormat in formats)) {
              return callback(new Error('format ' + options.fromFormat + ' not available'));
            }
            if (!formats[options.fromFormat].canDemux) {
              return callback(new Error('cannot demux input using format ' + options.fromFormat));
            }
          }

          callback();
        }
      });
    } else {
      callback();
    }
  };

  FfmpegCommand.prototype._checkCodecCapabilities = function(callback) {
    var options = this.options;
    var hasAudioCodec = options.audio.codec && options.audio.codec !== 'copy';
    var hasVideoCodec = options.video.codec && options.video.codec !== 'copy';

    if (hasAudioCodec || hasVideoCodec) {
      this.getAvailableCodecs(function(err, codecs) {
        if (err) {
          callback(new Error('cannot get available codecs: ' + err.message));
        } else {
          if (hasAudioCodec) {
            if (!(options.audio.codec in codecs) || codecs[options.audio.codec].type !== 'audio') {
              return callback(new Error('audio codec ' + options.audio.codec + ' not available'));
            }
            if (!codecs[options.audio.codec].canEncode) {
              return callback(new Error('codec ' + options.audio.codec + ' cannot encode audio'));
            }
          }

          if (hasVideoCodec) {
            if (!(options.video.codec in codecs) || codecs[options.video.codec].type !== 'video') {
              return callback(new Error('video codec ' + options.video.codec + ' not available'));
            }
            if (!codecs[options.video.codec].canEncode) {
              return callback(new Error('codec ' + options.video.codec + ' cannot encode video'));
            }
          }

          callback();
        }
      });
    } else {
      callback();
    }
  };

  FfmpegCommand.prototype._checkCapabilities = function(callback) {
    var self = this;

    this._checkFormatCapabilities(function(err) {
      if (err) {
        callback(err);
      } else {
        self._checkCodecCapabilities(callback);
      }
    });
  };

  FfmpegCommand.prototype.hasFlvtool2 = function(callback) {
    var hasFlvtool2 = Registry.instance.get('hasFlvtool2');
    if (!hasFlvtool2) {
      exec('which flvtool2', function(err, stdout) {
        if (stdout !== '') {
          hasFlvtool2 = 'yes';
        } else {
          hasFlvtool2 = 'no';
        }

        Registry.instance.set('hasFlvtool2', hasFlvtool2);
        callback(hasFlvtool2 === 'yes');
      });
    } else {
      callback(hasFlvtool2 === 'yes');
    }
  };

  FfmpegCommand.prototype.hasFlvmeta = function(callback) {
    var hasFlvmeta = Registry.instance.get('hasFlvmeta');
    if (!hasFlvmeta) {
      exec('which flvmeta', function(err, stdout) {
        if (stdout !== '') {
          hasFlvmeta = 'yes';
        } else {
          hasFlvmeta = 'no';
        }

        Registry.instance.set('hasFlvmeta', hasFlvmeta);
        callback(hasFlvmeta === 'yes');
      });
    } else {
      callback(hasFlvmeta === 'yes');
    }
  };

  FfmpegCommand.prototype.hasFlvInjector = function(callback) {
    var hasFlvInjector = Registry.instance.get('hasFlvInjector');
    if (!hasFlvInjector) {
      var self = this;
      this.hasFlvmeta(function(hasFlvmeta) {
        if (hasFlvmeta) {
          hasFlvInjector = 'flvmeta';
          Registry.instance.set('hasFlvInjector', hasFlvInjector);
          callback('flvmeta');
        } else {
          self.hasFlvtool2(function(hasFlvtool2) {
            if (hasFlvtool2) {
              hasFlvInjector = 'flvtool2';
            } else {
              hasFlvInjector = 'none';
            }

            Registry.instance.set('hasFlvInjector', hasFlvInjector);
            callback(hasFlvInjector === 'none' ? false : hasFlvInjector);
          });
        }
      });
    } else {
      callback(hasFlvInjector === 'none' ? false : hasFlvInjector);
    }
  };
};