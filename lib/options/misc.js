/*jshint node:true*/
'use strict';

var path = require('path');
var divx = require('../presets/divx');
var flashvideo = require('../presets/flashvideo');
var podcast = require('../presets/podcast');

const presets = { divx, flashvideo, podcast }

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
      var loader = presets[preset];
      if (loader) {
        if (typeof loader.load === 'function') {
          loader.load(this);
        } else {
          throw new Error('preset ' + preset + ' has no load() function');
        }
      } else {
        throw new Error('preset ' + preset + ' could not be loaded');
      }
    }

    return this;
  };
};
