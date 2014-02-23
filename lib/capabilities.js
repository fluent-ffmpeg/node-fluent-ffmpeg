var exec     = require('child_process').exec,
    Registry = require('./registry');

var avCodecRegexp = /^ ([D ])([E ])([VAS])([S ])([D ])([T ]) ([^ ]+) +(.*)$/;
var ffCodecRegexp = /^ ([D\.])([E\.])([VAS])([I\.])([L\.])([S\.]) ([^ ]+) +(.*)$/;
var ffEncodersRegexp = /\(encoders:([^\)]+)\)/;
var ffDecodersRegexp = /\(decoders:([^\)]+)\)/;
var formatRegexp = /^ ([D ])([E ]) ([^ ]+) +(.*)$/;

function copy(src, dest) {
  Object.keys(src).forEach(function(k) {
    dest[k] = src[k];
  });
}

exports = module.exports = function capabilities(command) {
  command.prototype.getAvailableCodecs = function(callback) {
    var codecs = Registry.instance.get('capabilityCodecs');
    if (!codecs) {
      var command = [this.ffmpegPath, '-codecs'];

      exec(command.join(' '), function(err, stdout, stderr) {
        if (err) {
          return callback(err);
        }

        var lines = stdout.split('\n');
        var data = {};

        lines.forEach(function(line) {
          var match = line.match(avCodecRegexp);
          if (match) {
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
          if (match) {
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

  command.prototype.getAvailableFormats = function(callback) {
    var formats = Registry.instance.get('capabilityFormats');
    if (!formats) {
      var command = [this.ffmpegPath, '-formats'];

      exec(command.join(' '), function(err, stdout, stderr) {
        if (err) {
          return callback(err);
        }

        var lines = stdout.split('\n');
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

  command.prototype._checkFormatCapabilities = function(callback) {
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

  command.prototype._checkCodecCapabilities = function(callback) {
    var options = this.options;

    if (options.audio.codec || options.video.codec) {
      this.getAvailableCodecs(function(err, codecs) {
        if (err) {
          callback(new Error('cannot get available codecs: ' + err.message));
        } else {
          if (options.audio.codec) {
            if (!(options.audio.codec in codecs) || codecs[options.audio.codec].type !== 'audio') {
              return callback(new Error('audio codec ' + options.audio.codec + ' not available'));
            }
            if (!codecs[options.audio.codec].canEncode) {
              return callback(new Error('codec ' + options.audio.codec + ' cannot encode audio'));
            }
          }

          if (options.video.codec) {
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

  command.prototype._checkCapabilities = function(callback) {
    var self = this;

    this._checkFormatCapabilities(function(err) {
      if (err) {
        callback(err);
      } else {
        self._checkCodecCapabilities(callback);
      }
    });
  };
};
	