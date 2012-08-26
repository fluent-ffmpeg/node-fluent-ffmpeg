
exports = module.exports = function Calculate(command) {
  this._aspectIsEqual = function(ar1, ar2) {
    var p1 = this.toAspectRatio(ar1);
    var p2 = this.toAspectRatio(ar2);
    if (p1 === undefined || p2 === undefined) {
      return false;
    } else {
      return (p1.x === p2.x && p1.y === p2.y);
    }
  };

  this._calculatePadding = function(data) {
    if (data.video.aspect) {
      var newaspect, padAmount;
      // check if the aspect ratio has changed
      if (this.options.video.aspect && !this.options.video.size) {
        newaspect = this.options.video.aspect;
      } else if (!this.options.video.aspect) {
        // check aspect ratio change by calculating new aspect ratio from size (using greatest common divider, GCD)
        var ratio = this.gcd(this.options.video.width, this.options.video.height);
        newaspect = this.options.video.width / ratio + ':' + this.options.video.height / ratio;
      } else {
        // we have both aspect ratio and size set, all calculations are fine
        newaspect = this.options.video.aspect;
      }

      // if there are still no sizes for our output video, assume input size
      if (!this.options.video.width && !this.options.video.height) {
        this.options.video.width = data.video.resolution.w;
        this.options.video.height = data.video.resolution.h;
      }

      if (!this._aspectIsEqual(data.video.aspectString, newaspect)) {
        var ardata = this.toAspectRatio(newaspect);

        if (newaspect === '16:9') {
          // assume conversion from 4:3 to 16:9, pad output video stream left- / right-sided
          var newWidth = parseInt(this.options.video.width / (4 / 3), 10);
          newWidth += (newWidth % 2);
          var wdiff = this.options.video.width - newWidth;
          padAmount = parseInt(wdiff / 2, 10);
          padAmount += (padAmount % 2);

          // set pad filter options
          this.options.video.pad = {
            x: padAmount,
            y: 0,
            w: this.options.video.width,
            h: this.options.video.height
          };
          this.options.video.size = newWidth + 'x' + this.options.video.height;
        } else if (newaspect === '4:3') {
          // assume conversion from 16:9 to 4:3, add padding to top and bottom
          var newHeight = parseInt(this.options.video.height / (4 / 3), 10);
          newHeight -= (newHeight % 2);
          var hdiff = this.options.video.height - newHeight;
          padAmount = parseInt(hdiff / 2, 10);
          padAmount += (padAmount % 2);

          // set pad filter options
          this.options.video.pad = {
            x: 0,
            y: padAmount,
            w: this.options.video.width,
            h: this.options.video.height
          };
          this.options.video.size = this.options.video.pad.w + 'x' + newHeight;
        }
      }
    } else {
      // aspect ratio could not be read from source file
      return;
    }
  };

  this._calculateDimensions = function(data) {
    // load metadata and prepare size calculations
    var fixedWidth = /([0-9]+)x\?/.exec(this.options.video.size);
    var fixedHeight = /\?x([0-9]+)/.exec(this.options.video.size);
    var percentRatio = /\b([0-9]{1,2})%/.exec(this.options.video.size);

    var resolution = this.options.keepPixelAspect ? data.video.resolution : data.video.resolutionSquare;
    var w, h;

    if (!resolution) {
      return new Error('could not determine video resolution, check your ffmpeg setup');
    }

    var ratio, ardata;
    if (fixedWidth && fixedWidth.length > 0) {
      // calculate height of output
      if (!resolution.w) {
        return new Error('could not determine width of source video, aborting execution');
      }

      ratio = resolution.w / parseInt(fixedWidth[1], 10);
      // if we have an aspect ratio target set, calculate new size using AR
      if (this.options.video.aspect !== undefined) {
        ardata = this.toAspectRatio(this.options.video.aspect);
        if (ardata) {
          w = parseInt(fixedWidth[1], 10);
          h = Math.round((w / ardata.x) * ardata.y);
        } else {
          // aspect ratio could not be parsed, return error
          return new Error('could not parse aspect ratio set using withAspect(), aborting execution');
        }
      } else {
        w = parseInt(fixedWidth[1], 10);
        h = Math.round(resolution.h / ratio);
      }
    } else if (fixedHeight && fixedHeight.length > 0) {
      // calculate width of output
      if (!resolution.h) {
        return new Error('could not determine height of source video, aborting execution');
      }

      ratio = resolution.h / parseInt(fixedHeight[1], 10);

      // if we have an aspect ratio target set, calculate new size using AR
      if (this.options.video.aspect !== undefined) {
        ardata = this.toAspectRatio(this.options.video.aspect);
        if (ardata) {
          h = parseInt(fixedHeight[1], 10);
          w = Math.round((h / ardata.y) * ardata.x);
        } else {
          // aspect ratio could not be parsed, return error
          return new Error('could not parse aspect ratio set using withAspect(), aborting execution');
        }
      } else {
        w = Math.round(resolution.w / ratio);
        h = parseInt(fixedHeight[1], 10);
      }
    } else if (percentRatio && percentRatio.length > 0) {
      // calculate both height and width of output
      if (!resolution.w || !resolution.h) {
        return new Error('could not determine resolution of source video, aborting execution');
      }

      ratio = parseInt(percentRatio[1], 10) / 100;
      w = Math.round(resolution.w * ratio);
      h = Math.round(resolution.h * ratio);
    } else {
      return new Error('could not determine type of size string, aborting execution');
    }

    // for video resizing, width and height have to be a multiple of 2
    if (w % 2 === 1) {
      w -= 1;
    }
    if (h % 2 === 1) {
      h -= 1;
    }

    this.options.video.size = w + 'x' + h;

    this.options.video.width = w;
    this.options.video.height = h;

  };
  exports.calculateDimensions = this._calculateDimensions;
};
