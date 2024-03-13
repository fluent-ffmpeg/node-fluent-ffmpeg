import path from "path";
import { EventEmitter } from "events";
import url from "url";

import utils from "./utils.js";
import inputs from "./options/inputs.js";
import audio from "./options/audio.js";
import video from "./options/video.js";
import videosize from "./options/videosize.js";
import output from "./options/output.js";
import custom from "./options/custom.js";
import misc from "./options/misc.js";
import processor from "./processor.js";
import capabilities from "./capabilities.js";
import ffprobe from "./ffprobe.js";
import recipes from "./recipes.js";

const DIRNAME = path.dirname(url.fileURLToPath(import.meta.url));

const ARGLISTS = [
  "_global",
  "_audio",
  "_audioFilters",
  "_video",
  "_videoFilters",
  "_sizeFilters",
  "_complexFilters",
];

class FfmpegCommand extends EventEmitter {
  constructor(input, options) {
    super();

    if (typeof input === "object" && !("readable" in input)) {
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
      this.input(options.source);
    }

    // Add target-less output for backwards compatibility
    this._outputs = [];
    this.output();

    // Create argument lists
    var self = this;
    ["_global", "_complexFilters"].forEach(function (prop) {
      self[prop] = utils.args();
    });

    // Set default option values
    options.stdoutLines = "stdoutLines" in options ? options.stdoutLines : 100;
    options.presets =
      options.presets || options.preset || path.join(DIRNAME, "presets");
    options.niceness = options.niceness || options.priority || 0;

    // Save options
    this.options = options;

    // Setup logger
    this.logger = options.logger || {
      debug: function () {},
      info: function () {},
      warn: function () {},
      error: function () {},
    };
  }

  clone() {
    var clone = new FfmpegCommand();
    var self = this;

    // Clone options and logger
    clone.options = this.options;
    clone.logger = this.logger;

    // Clone inputs
    clone._inputs = this._inputs.map(function (input) {
      return {
        source: input.source,
        options: input.options.clone(),
      };
    });

    // Create first output
    if ("target" in this._outputs[0]) {
      // We have outputs set, don't clone them and create first output
      clone._outputs = [];
      clone.output();
    } else {
      // No outputs set, clone first output options
      clone._outputs = [
        (clone._currentOutput = {
          flags: {},
        }),
      ];

      [
        "audio",
        "audioFilters",
        "video",
        "videoFilters",
        "sizeFilters",
        "options",
      ].forEach(function (key) {
        clone._currentOutput[key] = self._currentOutput[key].clone();
      });

      if (this._currentOutput.sizeData) {
        clone._currentOutput.sizeData = {};
        utils.copy(this._currentOutput.sizeData, clone._currentOutput.sizeData);
      }

      utils.copy(this._currentOutput.flags, clone._currentOutput.flags);
    }

    // Clone argument lists
    ["_global", "_complexFilters"].forEach(function (prop) {
      clone[prop] = self[prop].clone();
    });

    return clone;
  }
}

// Utilize the imported modules to extend FfmpegCommand.prototype
inputs(FfmpegCommand.prototype);
audio(FfmpegCommand.prototype);
video(FfmpegCommand.prototype);
videosize(FfmpegCommand.prototype);
output(FfmpegCommand.prototype);
custom(FfmpegCommand.prototype);
misc(FfmpegCommand.prototype);
processor(FfmpegCommand.prototype);
capabilities(FfmpegCommand.prototype);
ffprobe(FfmpegCommand.prototype);
recipes(FfmpegCommand.prototype);

// Static methods
FfmpegCommand.setFfmpegPath = function (path) {
  new FfmpegCommand().setFfmpegPath(path);
};

FfmpegCommand.setFfprobePath = function (path) {
  new FfmpegCommand().setFfprobePath(path);
};

FfmpegCommand.setFlvtoolPath = function (path) {
  new FfmpegCommand().setFlvtoolPath(path);
};

FfmpegCommand.getAvailableFilters = function (callback) {
  new FfmpegCommand().availableFilters(callback);
};

FfmpegCommand.getAvailableCodecs = function (callback) {
  new FfmpegCommand().availableCodecs(callback);
};

FfmpegCommand.getAvailableFormats = function (callback) {
  new FfmpegCommand().availableFormats(callback);
};

FfmpegCommand.getAvailableEncoders = function (callback) {
  new FfmpegCommand().availableEncoders(callback);
};

FfmpegCommand.ffprobe = function (file) {
  var instance = new FfmpegCommand(file);
  instance.ffprobe.apply(instance, Array.prototype.slice.call(arguments, 1));
};

// Export the FfmpegCommand class
export default FfmpegCommand;
