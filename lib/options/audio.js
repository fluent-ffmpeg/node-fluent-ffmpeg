/*jshint node:true*/
'use strict';

/*
 *! Audio-related methods
 */

module.exports = function(proto) {
  /**
   * Disable audio in the output
   *
   * @method FfmpegCommand#noAudio
   * @return FfmpegCommand
   */
  proto.withNoAudio =
  proto.noAudio = function() {
    this._audio.clear();
    this._audio('-an');

    return this;
  };


  /**
   * Specify audio codec
   *
   * @method FfmpegCommand#audioCodec
   * @param {String} codec audio codec name
   * @return FfmpegCommand
   */
  proto.withAudioCodec =
  proto.audioCodec = function(codec) {
    this._audio('-acodec', codec);
    return this;
  };


  /**
   * Specify audio bitrate
   *
   * @method FfmpegCommand#audioBitrate
   * @param {String|Number} bitrate audio bitrate in kbps (with an optional 'k' suffix)
   * @return FfmpegCommand
   */
  proto.withAudioBitrate =
  proto.audioBitrate = function(bitrate) {
    this._audio('-b:a', ('' + bitrate).replace(/k?$/, 'k'));
    return this;
  };


  /**
   * Specify audio channel count
   *
   * @method FfmpegCommand#audioChannels
   * @param {Number} channels channel count
   * @return FfmpegCommand
   */
  proto.withAudioChannels =
  proto.audioChannels = function(channels) {
    this._audio('-ac', channels);
    return this;
  };


  /**
   * Specify audio frequency
   *
   * @method FfmpegCommand#audioFrequency
   * @param {Number} freq audio frequency in Hz
   * @return FfmpegCommand
   */
  proto.withAudioFrequency =
  proto.audioFrequency = function(freq) {
    this._audio('-ar', freq);
    return this;
  };


  /**
   * Specify audio quality
   *
   * @method FfmpegCommand#audioQuality
   * @param {Number} quality audio quality factor
   * @return FfmpegCommand
   */
  proto.withAudioQuality =
  proto.audioQuality = function(quality) {
    this._audio('-aq', quality);
    return this;
  };


  /**
   * Specify custom audio filter(s)
   *
   * Can be called both with one or many filters, or a filter array.
   *
   * @example
   * command.audioFilters('filter1');
   *
   * @example
   * command.audioFilters('filter1', 'filter2');
   *
   * @example
   * command.audioFilters(['filter1', 'filter2']);
   *
   * @method FfmpegCommand#audioFilters
   * @param {String|Array} filters... audio filter strings or string array
   * @return FfmpegCommand
   */
  proto.withAudioFilter =
  proto.withAudioFilters =
  proto.audioFilter =
  proto.audioFilters = function(filters) {
    if (arguments.length > 1) {
      filters = [].slice.call(arguments);
    }

    this._audioFilters(filters);
    return this;
  };
};
