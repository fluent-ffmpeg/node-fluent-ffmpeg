/*jshint node:true*/
'use strict';

/*
 *! Custom options methods
 */

module.exports = function(proto) {
  /**
   * Add custom input option(s)
   *
   * When passing a single string or an array, each string containing two
   * words is split (eg. inputOptions('-option value') is supported) for
   * compatibility reasons.  This is not the case when passing more than
   * one argument.
   *
   * @example
   * command.inputOptions('option1');
   *
   * @example
   * command.inputOptions('option1', 'option2');
   *
   * @example
   * command.inputOptions(['option1', 'option2']);
   *
   * @method FfmpegCommand#inputOptions
   * @category Custom options
   * @aliases addInputOption,addInputOptions,withInputOption,withInputOptions,inputOption
   *
   * @param {...String} options option string(s) or string array
   * @return FfmpegCommand
   */
  proto.addInputOption =
  proto.addInputOptions =
  proto.withInputOption =
  proto.withInputOptions =
  proto.inputOption =
  proto.inputOptions = function(options) {
    if (!this._currentInput) {
      throw new Error('No input specified');
    }

    var doSplit = true;

    if (arguments.length > 1) {
      options = [].slice.call(arguments);
      doSplit = false;
    }

    if (!Array.isArray(options)) {
      options = [options];
    }

    this._currentInput.before(options.reduce(function(options, option) {
      var split = option.split(' ');

      if (doSplit && split.length === 2) {
        options.push(split[0], split[1]);
      } else {
        options.push(option);
      }

      return options;
    }, []));
    return this;
  };


  /**
   * Add custom output option(s)
   *
   * @example
   * command.outputOptions('option1');
   *
   * @example
   * command.outputOptions('option1', 'option2');
   *
   * @example
   * command.outputOptions(['option1', 'option2']);
   *
   * @method FfmpegCommand#outputOptions
   * @category Custom options
   * @aliases addOutputOption,addOutputOptions,addOption,addOptions,withOutputOption,withOutputOptions,withOption,withOptions,outputOption
   *
   * @param {...String} options option string(s) or string array
   * @return FfmpegCommand
   */
  proto.addOutputOption =
  proto.addOutputOptions =
  proto.addOption =
  proto.addOptions =
  proto.withOutputOption =
  proto.withOutputOptions =
  proto.withOption =
  proto.withOptions =
  proto.outputOption =
  proto.outputOptions = function(options) {
    var doSplit = true;

    if (arguments.length > 1) {
      options = [].slice.call(arguments);
      doSplit = false;
    }

    if (!Array.isArray(options)) {
      options = [options];
    }

    this._output(options.reduce(function(options, option) {
      var split = option.split(' ');

      if (doSplit && split.length === 2) {
        options.push(split[0], split[1]);
      } else {
        options.push(option);
      }

      return options;
    }, []));
    return this;
  };
};
