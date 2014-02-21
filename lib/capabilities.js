var exec     = require('child_process').exec,
    Registry = require('./registry');

var codecRegexp = /^ ([D ])([E ])([VAS])([S ])([D ])([T ]) ([^ ]+) +(.*)$/;

exports = module.exports = function capabilities(command) {
  command.prototype.getAvailableCodecs = function(callback) {
    var codecs = Registry.instance.get('capabilityCodecs');
    if (!codecs) {
      var command = [this.ffmpegPath, '-codecs'];

      exec(command.join(' '), function(err, stdout, stderr) {
        if (err) {
          return callback(err);
        }

        var lines = stdout.split('------')[1].split('\n');
        var data = {};

        lines.forEach(function(line) {
          var match = line.match(codecRegexp);
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
        });

        Registry.instance.set('capabilityCodecs', data);
        callback(null, data);
      });
    } else {
      callback(null, codecs);
    }
  };
};
	