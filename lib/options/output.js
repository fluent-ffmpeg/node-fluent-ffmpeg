/*jshint node:true*/
'use strict';

/*
 *! Output-related methods
 */

module.exports = function(proto) {
  /**
   * Set output duration
   *
   * @method FfmpegCommand#duration
   * @param {String|Number} duration duration in seconds or as a '[[hh:]mm:]ss[.xxx]' string
   * @return FfmpegCommand
   */
  proto.withDuration =
  proto.setDuration =
  proto.duration = function(duration) {
    this._output('-t', duration);
    return this;
  };


  /**
   * Set output format
   *
   * @method FfmpegCommand#format
   * @param {String} format output format name
   * @return FfmpegCommand
   */
  proto.toFormat =
  proto.withOutputFormat =
  proto.outputFormat =
  proto.format = function(format) {
    this._output('-f', format);
    return this;
  };
};
