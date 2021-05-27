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
      throw new Error('Module-loading `preset` not supported');
    }

    return this;
  };
};
