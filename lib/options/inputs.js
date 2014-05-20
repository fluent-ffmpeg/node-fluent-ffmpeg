/*jshint node:true*/
'use strict';

var utils = require('../utils');

/*
 *! Input-related methods
 */

module.exports = function(proto) {
  /**
   * Add an input to command
   *
   * Also switches "current input", that is the input that will be affected
   * by subsequent input-related methods.
   *
   * Note: only one stream input is supported for now.
   *
   * @method FfmpegCommand#input
   * @category Input
   * @aliases mergeAdd,addInput
   *
   * @param {String|Readable} source input file path or readable stream
   * @return FfmpegCommand
   */
  proto.mergeAdd =
  proto.addInput =
  proto.input = function(source) {
    if (typeof source !== 'string') {
      if (!('readable' in source) || !(source.readable)) {
        throw new Error('Invalid input');
      }

      var hasInputStream = this._inputs.some(function(input) {
        return typeof input.source !== 'string';
      });

      if (hasInputStream) {
        throw new Error('Only one input stream is supported');
      }

      source.pause();
    }

    this._inputs.push(this._currentInput = {
      source: source,
      before: utils.args(),
      after: utils.args(),
    });

    return this;
  };


  /**
   * Specify input format for the last specified input
   *
   * @method FfmpegCommand#inputFormat
   * @category Input
   * @aliases withInputFormat,fromFormat
   *
   * @param {String} format input format
   * @return FfmpegCommand
   */
  proto.withInputFormat =
  proto.inputFormat =
  proto.fromFormat = function(format) {
    if (!this._currentInput) {
      throw new Error('No input specified');
    }

    this._currentInput.before('-f', format);
    return this;
  };


  /**
   * Specify input FPS for the last specified input
   * (only valid for raw video formats)
   *
   * @method FfmpegCommand#inputFps
   * @category Input
   * @aliases withInputFps,withInputFPS,withFpsInput,withFPSInput,inputFPS,inputFps,fpsInput
   *
   * @param {Number} fps input FPS
   * @return FfmpegCommand
   */
  proto.withInputFps =
  proto.withInputFPS =
  proto.withFpsInput =
  proto.withFPSInput =
  proto.inputFPS =
  proto.inputFps =
  proto.fpsInput =
  proto.FPSInput = function(fps) {
    if (!this._currentInput) {
      throw new Error('No input specified');
    }

    this._currentInput.before('-r', fps);
    return this;
  };


  /**
   * Specify input seek time for the last specified input
   *
   * @method FfmpegCommand#seek
   * @category Input
   * @aliases setStartTime,seekTo
   *
   * @param {String|Number} seek seek time in seconds or as a '[hh:[mm:]]ss[.xxx]' string
   * @param {Boolean} [fast=false] use fast (but inexact) seek
   * @return FfmpegCommand
   */
  proto.setStartTime =
  proto.seekTo =
  proto.seek = function(seek, fast) {
    if (!this._currentInput) {
      throw new Error('No input specified');
    }

    if (fast) {
      this._currentInput.before('-ss', seek);
    } else {
      this._currentInput.after('-ss', seek);
    }

    return this;
  };


  /**
   * Specify input fast-seek time for the last specified input
   *
   * @method FfmpegCommand#fastSeek
   * @category Input
   * @aliases fastSeekTo
   *
   * @param {String|Number} seek fast-seek time in seconds or as a '[[hh:]mm:]ss[.xxx]' string
   * @return FfmpegCommand
   */
  proto.fastSeek =
  proto.fastSeekTo = function(seek) {
    return this.seek(seek, true);
  };


  /**
   * Loop over the last specified input
   *
   * @method FfmpegCommand#loop
   * @category Input
   *
   * @param {String|Number} [duration] loop duration in seconds or as a '[[hh:]mm:]ss[.xxx]' string
   * @return FfmpegCommand
   */
  proto.loop = function(duration) {
    if (!this._currentInput) {
      throw new Error('No input specified');
    }

    this._currentInput.before('-loop', '1');

    if (typeof duration !== 'undefined') {
      this.duration(duration);
    }

    return this;
  };
};
