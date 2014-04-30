/*jshint node:true*/
'use strict';

var path = require('path');

/*
 *! Miscellaneous methods
 */

module.exports = function(proto) {
  /**
   * Use preset
   *
   * @method FfmpegCommand#preset
   * @param {String|Function} preset preset name (in presets/ folder) or preset function
   */
  proto.usingPreset =
  proto.preset = function(preset) {
    if (typeof preset === 'function') {
      preset(this);
    } else {
      try {
        var modulePath = path.join(this.options.presets, preset);
        var module = require(modulePath);

        if (typeof module.load === 'function') {
          module.load(this);
        } else {
          throw new Error('preset ' + modulePath + ' has no load() function');
        }
      } catch (err) {
        throw new Error('preset ' + modulePath + ' could not be loaded: ' + err.message);
      }
    }

    return this;
  };


  /**
   * Enable experimental codecs
   *
   * @method FfmpegCommand#strict
   * @return FfmpegCommand
   */
  proto.withStrictExperimental =
  proto.strict = function() {
    this._output('-strict', 'experimental');
    return this;
  };


  /**
   * Run flvtool2/flvmeta on output
   *
   * @method FfmpegCommand#flvmeta
   * @return FfmpegCommand
   */
  proto.updateFlvMetadata =
  proto.flvmeta = function() {
    this.options.flvmeta = true;
    return this;
  };
};
