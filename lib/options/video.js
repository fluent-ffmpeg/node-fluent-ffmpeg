/*jshint node:true*/
'use strict';

/*
 *! Video-related methods
 */

module.exports = function(proto) {
  /**
   * Disable video in the output
   *
   * @method FfmpegCommand#noVideo
   * @return FfmpegCommand
   */
  proto.withNoVideo =
  proto.noVideo = function() {
    this._video.clear();
    this._video('-vn');

    return this;
  };


  /**
   * Specify video codec
   *
   * @method FfmpegCommand#videoCodec
   * @param {String} codec video codec name
   * @return FfmpegCommand
   */
  proto.withVideoCodec =
  proto.videoCodec = function(codec) {
    this._video('-vcodec', codec);
    return this;
  };


  /**
   * Specify video bitrate
   *
   * @method FfmpegCommand#videoBitrate
   * @param {String|Number} bitrate video bitrate in kbps (with an optional 'k' suffix)
   * @param {Boolean} [constant=false] enforce constant bitrate
   * @return FfmpegCommand
   */
  proto.withVideoBitrate =
  proto.videoBitrate = function(bitrate, constant) {
    bitrate = ('' + bitrate).replace(/k?$/, 'k');

    this._video('-b:v', bitrate);
    if (constant) {
      this._video(
        '-maxrate', bitrate,
        '-minrate', bitrate,
        '-bufsize', '3M'
      );
    }

    return this;
  };


  /**
   * Specify custom video filter(s)
   *
   * Can be called both with one or many filters, or a filter array.
   *
   * @example
   * command.videoFilters('filter1');
   *
   * @example
   * command.videoFilters('filter1', 'filter2');
   *
   * @example
   * command.videoFilters(['filter1', 'filter2']);
   *
   * @method FfmpegCommand#videoFilters
   * @param {String|Array} filters... video filter strings or string array
   * @return FfmpegCommand
   */
  proto.withVideoFilter =
  proto.withVideoFilters =
  proto.videoFilter =
  proto.videoFilters = function(filters) {
    if (arguments.length > 1) {
      filters = [].slice.call(arguments);
    }

    if (Array.isArray(filters)) {
      this._videoFilters.apply(null, filters);
    } else {
      this._videoFilters(filters);
    }

    return this;
  };


  /**
   * Specify output FPS
   *
   * @method FfmpegCommand#fps
   * @param {Number} fps output FPS
   * @return FfmpegCommand
   */
  proto.withOutputFps =
  proto.withOutputFPS =
  proto.withFpsOutput =
  proto.withFPSOutput =
  proto.withFps =
  proto.withFPS =
  proto.outputFPS =
  proto.outputFps =
  proto.fpsOutput =
  proto.FPSOutput =
  proto.fps =
  proto.FPS = function(fps) {
    this._video('-r', fps);
    return this;
  };


  /**
   * Only transcode a certain number of frames
   *
   * @method FfmpegCommand#frames
   * @param {Number} frames frame count
   * @return FfmpegCommand
   */
  proto.takeFrames =
  proto.withFrames =
  proto.frames = function(frames) {
    this._video('-vframes', frames);
    return this;
  };
};
