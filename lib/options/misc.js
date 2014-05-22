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
   * @category Miscellaneous
   * @aliases usingPreset
   *
   * @param {String|Function} preset preset name or preset function
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
   * @category Miscellaneous
   * @aliases withStrictExperimental
   *
   * @return FfmpegCommand
   */
  proto.withStrictExperimental =
  proto.strict = function() {
    this._global('-strict', 'experimental');
    return this;
  };
};
