/*jshint node:true*/
'use strict';

var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var utils = require('./utils');


/**
 * Create an ffmpeg command
 *
 * Can be called with or without the 'new' operator, and the 'input' parameter
 * may be specified as 'options.source' instead (or passed later with the
 * addInput method).
 *
 * Available options:
 * - 'logger': logger object with 'error', 'warning', 'info' and 'debug' methods (default to no logging)
 * - 'niceness': ffmpeg process niceness, ignored on Windows (defaults to 0)
 * - 'presets' or 'preset': directory to load presets from (defaults to fluent-ffmpegs 'presets' subdirectory)
 * - 'timeout': ffmpeg processing timeout in seconds (defaults to no timeout)
 *
 * @constructor
 * @param {String|ReadableStream} [input] input file path or readable stream
 * @param {Object} [options] command options
 */
function FfmpegCommand(input, options) {
  // Make 'new' optional
  if (!(this instanceof FfmpegCommand)) {
    return new FfmpegCommand(input, options);
  }

  EventEmitter.call(this);

  if (typeof input === 'object' && !('readable' in input)) {
    // Options object passed directly
    options = input;
  } else {
    // Input passed first
    options = options || {};
    options.source = input;
  }

  // Add input if present
  this._inputs = [];
  if (options.source) {
    this.addInput(options.source);
  }

  // Create argument lists
  this._audio = utils.args();
  this._audioFilters = utils.args();
  this._video = utils.args();
  this._videoFilters = utils.args();
  this._sizeFilters = utils.args();
  this._output = utils.args();

  // Set default option values
  options.presets = options.presets || options.preset || path.join(__dirname, 'presets');

  // Save options
  this.options = options;

  // Setup logger
  this.logger = options.logger || {
    debug: function() {},
    info: function() {},
    warn: function() {},
    error: function() {}
  };
}
util.inherits(FfmpegCommand, EventEmitter);
module.exports = FfmpegCommand;


/* Add methods from options submodules */

require('./options/inputs')(FfmpegCommand.prototype);
require('./options/audio')(FfmpegCommand.prototype);
require('./options/video')(FfmpegCommand.prototype);
require('./options/videosize')(FfmpegCommand.prototype);
require('./options/output')(FfmpegCommand.prototype);
require('./options/custom')(FfmpegCommand.prototype);
require('./options/misc')(FfmpegCommand.prototype);


/* Add processor methods */

require('./processor')(FfmpegCommand.prototype);


/* Add capabilities methods */

require('./capabilities')(FfmpegCommand.prototype);

FfmpegCommand.availableFilters =
FfmpegCommand.getAvailableFilters = function(callback) {
  (new FfmpegCommand()).availableFilters(callback);
};

FfmpegCommand.availableCodecs =
FfmpegCommand.getAvailableCodecs = function(callback) {
  (new FfmpegCommand()).availableCodecs(callback);
};

FfmpegCommand.availableFormats =
FfmpegCommand.getAvailableFormats = function(callback) {
  (new FfmpegCommand()).availableFormats(callback);
};


/* Add ffprobe methods */

require('./ffprobe')(FfmpegCommand.prototype);

FfmpegCommand.ffprobe = function(file, callback) {
  (new FfmpegCommand(file)).ffprobe(callback);
};

