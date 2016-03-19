# Fluent ffmpeg-API for node.js [![Build Status](https://secure.travis-ci.org/fluent-ffmpeg/node-fluent-ffmpeg.svg?branch=master)](http://travis-ci.org/fluent-ffmpeg/node-fluent-ffmpeg)

This library abstracts the complex command-line usage of ffmpeg into a fluent, easy to use node.js module. In order to be able to use this module, make sure you have [ffmpeg](http://www.ffmpeg.org) installed on your system (including all necessary encoding libraries like libmp3lame or libx264).

> #### This is the documentation for fluent-ffmpeg 2.x
>
> A major 2.0 version has been released. This release features lots of API cleanup and a cleaner syntax for most methods.
>
> It has been designed to be mostly compatible with the previous fluent-ffmpeg version, but there are some incompatibilities, mainly because deprecated APIs in 1.x have been removed.  See [the 2.x migration wiki page](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/wiki/Migrating-from-fluent-ffmpeg-1.x) for information on how to migrate.
>
> Please take care to update your package.json files if you want to keep using version 1.x:
> ```js
{
  "dependencies": {
    "fluent-ffmpeg": "~1.7"
  }
}
```
>
> You can still access the code and documentation for fluent-ffmpeg 1.7 [here](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/tree/1.x).

## Installation

Via npm:

```sh
$ npm install fluent-ffmpeg
```

Or as a submodule:
```sh
$ git submodule add git://github.com/schaermu/node-fluent-ffmpeg.git vendor/fluent-ffmpeg
```



## Usage

You will find a lot of usage examples (including a real-time streaming example using [flowplayer](http://www.flowplayer.org) and [express](https://github.com/visionmedia/express)!) in the `examples` folder.


### Prerequisites

#### ffmpeg and ffprobe

fluent-ffmpeg requires ffmpeg >= 0.9 to work.  It may work with previous versions but several features won't be available (and the library is not tested with lower versions anylonger).

If the `FFMPEG_PATH` environment variable is set, fluent-ffmpeg will use it as the full path to the `ffmpeg` executable.  Otherwise, it will attempt to call `ffmpeg` directly (so it should be in your `PATH`).  You must also have ffprobe installed (it comes with ffmpeg in most distributions).  Similarly, fluent-ffmpeg will use the `FFPROBE_PATH` environment variable if it is set, otherwise it will attempt to call it in the `PATH`.

Most features should work when using avconv and avprobe instead of ffmpeg and ffprobe, but they are not officially supported at the moment.

**Windows users**: most probably ffmpeg and ffprobe will _not_ be in your `%PATH`, so you _must_ set `%FFMPEG_PATH` and `%FFPROBE_PATH`.

**Debian/Ubuntu users**: the official repositories have the ffmpeg/ffprobe executable in the `libav-tools` package, and they are actually rebranded avconv/avprobe executables (avconv is a fork of ffmpeg).  They should be mostly compatible, but should you encounter any issue, you may want to use the real ffmpeg instead.  You can either compile it from source or find a pre-built .deb package at https://ffmpeg.org/download.html (For Ubuntu, the `ppa:jon-severinsson/ffmpeg` PPA provides recent builds).

#### flvtool2 or flvmeta

If you intend to encode FLV videos, you must have either flvtool2 or flvmeta installed and in your `PATH` or fluent-ffmpeg won't be able to produce streamable output files.  If you set either the `FLVTOOL2_PATH` or `FLVMETA_PATH`, fluent-ffmpeg will try to use it instead of searching in the `PATH`.

#### Setting binary paths manually

Alternatively, you may set the ffmpeg, ffprobe and flvtool2/flvmeta binary paths manually by using the following API commands:

* **Ffmpeg.setFfmpegPath(path)** Argument `path` is a string with the full path to the ffmpeg binary.
* **Ffmpeg.setFfprobePath(path)** Argument `path` is a string with the full path to the ffprobe binary.
* **Ffmpeg.setFlvtoolPath(path)** Argument `path` is a string with the full path to the flvtool2 or flvmeta binary.


### Creating an FFmpeg command

The fluent-ffmpeg module returns a constructor that you can use to instanciate FFmpeg commands.

```js
var FfmpegCommand = require('fluent-ffmpeg');
var command = new FfmpegCommand();
```

You can also use the constructor without the `new` operator.

```js
var ffmpeg = require('fluent-ffmpeg');
var command = ffmpeg();
```

You may pass an input file name or readable stream, a configuration object, or both to the constructor.

```js
var command = ffmpeg('/path/to/file.avi');
var command = ffmpeg(fs.createReadStream('/path/to/file.avi'));
var command = ffmpeg({ option: "value", ... });
var command = ffmpeg('/path/to/file.avi', { option: "value", ... });
```

The following options are available:
* `source`: input file name or readable stream (ignored if an input file is passed to the constructor)
* `timeout`: ffmpeg timeout in seconds (defaults to no timeout)
* `preset` or `presets`: directory to load module presets from (defaults to the `lib/presets` directory in fluent-ffmpeg tree)
* `niceness` or `priority`: ffmpeg niceness value, between -20 and 20; ignored on Windows platforms (defaults to 0)
* `logger`: logger object with `debug()`, `info()`, `warn()` and `error()` methods (defaults to no logging)
* `stdoutLines`: maximum number of lines from ffmpeg stdout/stderr to keep in memory (defaults to 100, use 0 for unlimited storage)


### Specifying inputs

You can add any number of inputs to an Ffmpeg command.  An input can be:
* a file name (eg. `/path/to/file.avi`);
* an image pattern (eg. `/path/to/frame%03d.png`);
* a readable stream; only one input stream may be used for a command, but you can use both an input stream and one or several file names.

```js
// Note that all fluent-ffmpeg methods are chainable
ffmpeg('/path/to/input1.avi')
  .input('/path/to/input2.avi')
  .input(fs.createReadStream('/path/to/input3.avi'));

// Passing an input to the constructor is the same as calling .input()
ffmpeg()
  .input('/path/to/input1.avi')
  .input('/path/to/input2.avi');

// Most methods have several aliases, here you may use addInput or mergeAdd instead
ffmpeg()
  .addInput('/path/to/frame%02d.png')
  .addInput('/path/to/soundtrack.mp3');

ffmpeg()
  .mergeAdd('/path/to/input1.avi')
  .mergeAdd('/path/to/input2.avi');
```


### Input options

The following methods enable passing input-related options to ffmpeg.  Each of these methods apply on the last input added (including the one passed to the constructor, if any).  You must add an input before calling those, or an error will be thrown.

#### inputFormat(format): specify input format

**Aliases**: `fromFormat()`, `withInputFormat()`.

This is only useful for raw inputs, as ffmpeg can determine the input format automatically.

```js
ffmpeg()
  .input('/dev/video0')
  .inputFormat('mov')
  .input('/path/to/file.avi')
  .inputFormat('avi');
```

Fluent-ffmpeg checks for format availability before actually running the command, and throws an error when a specified input format is not available.

#### inputFPS(fps): specify input framerate

**Aliases**: `withInputFps()`, `withInputFPS()`, `withFpsInput()`, `withFPSInput()`, `inputFps()`, `fpsInput()`, `FPSInput()`.

This is only valid for raw inputs, as ffmpeg can determine the input framerate automatically.

```js
ffmpeg('/dev/video0').inputFPS(29.7);
```

#### native(): read input at native framerate

**Aliases**: `nativeFramerate()`, `withNativeFramerate()`.

```js
ffmpeg('/path/to/file.avi').native();
```

#### seekInput(time): set input start time

**Alias**: `setStartTime()`.

Seeks an input and only start decoding at given time offset.  The `time` argument may be a number (in seconds) or a timestamp string (with format `[[hh:]mm:]ss[.xxx]`).

```js
ffmpeg('/path/to/file.avi').seekInput(134.5);
ffmpeg('/path/to/file.avi').seekInput('2:14.500');
```

#### loop([duration]): loop over input

```js
ffmpeg('/path/to/file.avi').loop();
ffmpeg('/path/to/file.avi').loop(134.5);
ffmpeg('/path/to/file.avi').loop('2:14.500');
```

#### inputOptions(option...): add custom input options

**Aliases**: `inputOption()`, `addInputOption()`, `addInputOptions()`, `withInputOption()`, `withInputOptions()`.

This method allows passing any input-related option to ffmpeg.  You can call it with a single argument to pass a single option, optionnaly with a space-separated parameter:

```js
/* Single option */
ffmpeg('/path/to/file.avi').inputOptions('-someOption');

/* Single option with parameter */
ffmpeg('/dev/video0').inputOptions('-r 24');
```

You may also pass multiple options at once by passing an array to the method:

```js
ffmpeg('/path/to/file.avi').inputOptions([
  '-option1',
  '-option2 param2',
  '-option3',
  '-option4 param4'
]);
```

Finally, you may also directly pass command line tokens as separate arguments to the method:

```js
ffmpeg('/path/to/file.avi').inputOptions(
  '-option1',
  '-option2', 'param2',
  '-option3',
  '-option4', 'param4'
);
```


### Audio options

The following methods change the audio stream(s) in the produced output.

#### noAudio(): disable audio altogether

**Aliases**: `withNoAudio()`.

Disables audio in the output and remove any previously set audio option.

```js
ffmpeg('/path/to/file.avi').noAudio();
```

#### audioCodec(codec): set audio codec

**Aliases**: `withAudioCodec()`.

```js
ffmpeg('/path/to/file.avi').audioCodec('libmp3lame');
```

Fluent-ffmpeg checks for codec availability before actually running the command, and throws an error when a specified audio codec is not available.

#### audioBitrate(bitrate): set audio bitrate

**Aliases**: `withAudioBitrate()`.

Sets the audio bitrate in kbps.  The `bitrate` parameter may be a number or a string with an optional `k` suffix.  This method is used to enforce a constant bitrate; use `audioQuality()` to encode using a variable bitrate.

```js
ffmpeg('/path/to/file.avi').audioBitrate(128);
ffmpeg('/path/to/file.avi').audioBitrate('128');
ffmpeg('/path/to/file.avi').audioBitrate('128k');
```

#### audioChannels(count): set audio channel count

**Aliases**: `withAudioChannels()`.

```js
ffmpeg('/path/to/file.avi').audioChannels(2);
```

#### audioFrequency(freq): set audio frequency

**Aliases**: `withAudioFrequency()`.

The `freq` parameter specifies the audio frequency in Hz.

```js
ffmpeg('/path/to/file.avi').audioFrequency(22050);
```

#### audioQuality(quality): set audio quality

**Aliases**: `withAudioQuality()`.

This method fixes a quality factor for the audio codec (VBR encoding).  The quality scale depends on the actual codec used.

```js
ffmpeg('/path/to/file.avi')
  .audioCodec('libmp3lame')
  .audioQuality(0);
```

#### audioFilters(filter...): add custom audio filters

**Aliases**: `audioFilter()`, `withAudioFilter()`, `withAudioFilters()`.

This method enables adding custom audio filters.  You may add multiple filters at once by passing either several arguments or an array.  See the Ffmpeg documentation for available filters and their syntax.

Each filter pased to this method can be either a filter string (eg. `volume=0.5`) or a filter specification object with the following keys:
* `filter`: filter name
* `options`: optional; either an option string for the filter (eg. `n=-50dB:d=5`), an options array for unnamed options (eg. `['-50dB', 5]`) or an object mapping option names to values (eg. `{ n: '-50dB', d: 5 }`).  When `options` is not specified, the filter will be added without any options.

```js
ffmpeg('/path/to/file.avi')
  .audioFilters('volume=0.5')
  .audioFilters('silencedetect=n=-50dB:d=5');

ffmpeg('/path/to/file.avi')
  .audioFilters('volume=0.5', 'silencedetect=n=-50dB:d=5');

ffmpeg('/path/to/file.avi')
  .audioFilters(['volume=0.5', 'silencedetect=n=-50dB:d=5']);

ffmpeg('/path/to/file.avi')
  .audioFilters([
    {
      filter: 'volume',
      options: '0.5'
    },
    {
      filter: 'silencedetect',
      options: 'n=-50dB:d=5'
    }
  ]);

ffmpeg('/path/to/file.avi')
  .audioFilters(
    {
      filter: 'volume',
      options: ['0.5']
    },
    {
      filter: 'silencedetect',
      options: { n: '-50dB', d: 5 }
    }
  ]);
```


### Video options

The following methods change the video stream(s) in the produced output.

#### noVideo(): disable video altogether

**Aliases**: `withNoVideo()`.

This method disables video output and removes any previously set video option.

```js
ffmpeg('/path/to/file.avi').noVideo();
```

#### videoCodec(codec): set video codec

**Aliases**: `withVideoCodec()`.

```js
ffmpeg('/path/to/file.avi').videoCodec('libx264');
```

Fluent-ffmpeg checks for codec availability before actually running the command, and throws an error when a specified video codec is not available.

#### videoBitrate(bitrate[, constant=false]): set video bitrate

**Aliases**: `withVideoBitrate()`.

Sets the target video bitrate in kbps.  The `bitrate` argument may be a number or a string with an optional `k` suffix.  The `constant` argument specifies whether a constant bitrate should be enforced (defaults to false).

Keep in mind that, depending on the codec used, enforcing a constant bitrate often comes at the cost of quality.  The best way to have a constant video bitrate without losing too much quality is to use 2-pass encoding (see Fffmpeg documentation).

```js
ffmpeg('/path/to/file.avi').videoBitrate(1000);
ffmpeg('/path/to/file.avi').videoBitrate('1000');
ffmpeg('/path/to/file.avi').videoBitrate('1000k');
ffmpeg('/path/to/file.avi').videoBitrate('1000k', true);
```

#### videoFilters(filter...): add custom video filters

**Aliases**: `videoFilter()`, `withVideoFilter()`, `withVideoFilters()`.

This method enables adding custom video filters.  You may add multiple filters at once by passing either several arguments or an array.  See the Ffmpeg documentation for available filters and their syntax.

Each filter pased to this method can be either a filter string (eg. `fade=in:0:30`) or a filter specification object with the following keys:
* `filter`: filter name
* `options`: optional; either an option string for the filter (eg. `in:0:30`), an options array for unnamed options (eg. `['in', 0, 30]`) or an object mapping option names to values (eg. `{ t: 'in', s: 0, n: 30 }`).  When `options` is not specified, the filter will be added without any options.

```js
ffmpeg('/path/to/file.avi')
  .videoFilters('fade=in:0:30')
  .videoFilters('pad=640:480:0:40:violet');

ffmpeg('/path/to/file.avi')
  .videoFilters('fade=in:0:30', 'pad=640:480:0:40:violet');

ffmpeg('/path/to/file.avi')
  .videoFilters(['fade=in:0:30', 'pad=640:480:0:40:violet']);

ffmpeg('/path/to/file.avi')
  .videoFilters([
    {
      filter: 'fade',
      options: 'in:0:30'
    },
    {
      filter: 'pad',
      options: '640:480:0:40:violet'
    }
  ]);

ffmpeg('/path/to/file.avi')
    .videoFilters(
    {
      filter: 'fade',
      options: ['in', 0, 30]
    },
    {
      filter: 'filter2',
      options: { w: 640, h: 480, x: 0, y: 40, color: 'violet' }
    }
  );
```

#### fps(fps): set output framerate

**Aliases**: `withOutputFps()`, `withOutputFPS()`, `withFpsOutput()`, `withFPSOutput()`, `withFps()`, `withFPS()`, `outputFPS()`, `outputFps()`, `fpsOutput()`, `FPSOutput()`, `FPS()`.

```js
ffmpeg('/path/to/file.avi').fps(29.7);
```

#### frames(count): specify frame count

**Aliases**: `takeFrames()`, `withFrames()`.

Set ffmpeg to only encode a certain number of frames.

```js
ffmpeg('/path/to/file.avi').frames(240);
```


### Video frame size options

The following methods enable resizing the output video frame size.  They all work together to generate the appropriate video filters.

#### size(size): set output frame size

**Aliases**: `videoSize()`, `withSize()`.

This method sets the output frame size.  The `size` argument may have one of the following formats:
* `640x480`: set a fixed output frame size.  Unless `autopad()` is called, this may result in the video being stretched or squeezed to fit the requested size.
* `640x?`: set a fixed width and compute height automatically.  If `aspect()` is also called, it is used to compute video height; otherwise it is computed so that the input aspect ratio is preserved.
* `?x480`: set a fixed height and compute width automatically.  If `aspect()` is also called, it is used to compute video width; otherwise it is computed so that the input aspect ratio is preserved.
* `50%`: rescale both width and height to the given percentage.  Aspect ratio is always preserved.

Note that for compatibility with some codecs, computed dimensions are always rounded down to multiples of 2.

```js
ffmpeg('/path/to/file.avi').size('640x480');
ffmpeg('/path/to/file.avi').size('640x?');
ffmpeg('/path/to/file.avi').size('640x?').aspect('4:3');
ffmpeg('/path/to/file.avi').size('50%');
```

#### aspect(aspect): set output frame aspect ratio

**Aliases**: `withAspect()`, `withAspectRatio()`, `setAspect()`, `setAspectRatio()`, `aspectRatio()`.

This method enforces a specific output aspect ratio.  The `aspect` argument may either be a number or a `X:Y` string.

Note that calls to `aspect()` are ignored when `size()` has been called with a fixed width and height or a percentage, and also when `size()` has not been called at all.

```js
ffmpeg('/path/to/file.avi').size('640x?').aspect('4:3');
ffmpeg('/path/to/file.avi').size('640x?').aspect(1.33333);
```

#### autopad([color='black']): enable auto-padding the output video

**Aliases**: `applyAutopadding()`, `applyAutoPadding()`, `applyAutopad()`, `applyAutoPad()`, `withAutopadding()`, `withAutoPadding()`, `withAutopad()`, `withAutoPad()`, `autoPad()`.

This method enables applying auto-padding to the output video.  The `color` parameter specifies which color to use for padding, and must be a color code or name supported by ffmpeg (defaults to 'black').

The behaviour of this method depends on calls made to other video size methods:
* when `size()` has been called with a percentage or has not been called, it is ignored;
* when `size()` has been called with `WxH`, it adds padding so that the input aspect ratio is kept;
* when `size()` has been called with either `Wx?` or `?xH`, padding is only added if `aspect()` was called (otherwise the output dimensions are computed from the input aspect ratio and padding is not needed).

```js
// No size specified, autopad() is ignored
ffmpeg('/path/to/file.avi').autopad();

// Adds padding to keep original aspect ratio.
// - with a 640x400 input, 40 pixels of padding are added on both sides
// - with a 600x480 input, 20 pixels of padding are added on top and bottom
// - with a 320x200 input, video is scaled up to 640x400 and 40px of padding
//   is added on both sides
// - with a 320x240 input, video is scaled up to 640x480 and and no padding
//   is needed
ffmpeg('/path/to/file.avi').size('640x480').autopad();
ffmpeg('/path/to/file.avi').size('640x480').autopad('white');
ffmpeg('/path/to/file.avi').size('640x480').autopad('#35A5FF');

// Size computed from input, autopad() is ignored
ffmpeg('/path/to/file.avi').size('50%').autopad();
ffmpeg('/path/to/file.avi').size('640x?').autopad();
ffmpeg('/path/to/file.avi').size('?x480').autopad();

// Calling .size('640x?').aspect('4:3') is similar to calling .size('640x480')
// - with a 640x400 input, 40 pixels of padding are added on both sides
// - with a 600x480 input, 20 pixels of padding are added on top and bottom
// - with a 320x200 input, video is scaled up to 640x400 and 40px of padding
//   is added on both sides
// - with a 320x240 input, video is scaled up to 640x480 and and no padding
//   is needed
ffmpeg('/path/to/file.avi').size('640x?').aspect('4:3').autopad();
ffmpeg('/path/to/file.avi').size('640x?').aspect('4:3').autopad('white');
ffmpeg('/path/to/file.avi').size('640x?').aspect('4:3').autopad('#35A5FF');

// Calling .size('?x480').aspect('4:3') is similar to calling .size('640x480')
ffmpeg('/path/to/file.avi').size('?x480').aspect('4:3').autopad();
ffmpeg('/path/to/file.avi').size('?x480').aspect('4:3').autopad('white');
ffmpeg('/path/to/file.avi').size('?x480').aspect('4:3').autopad('#35A5FF');
```

For compatibility with previous fluent-ffmpeg versions, this method also accepts an additional boolean first argument, which specifies whether to apply auto-padding.

```js
ffmpeg('/path/to/file.avi').size('640x480').autopad(true);
ffmpeg('/path/to/file.avi').size('640x480').autopad(true, 'pink');
```

#### keepDAR(): force keeping display aspect ratio

**Aliases**: `keepPixelAspect()`, `keepDisplayAspect()`, `keepDisplayAspectRatio()`.

This method is useful when converting an input with non-square pixels to an output format that does not support non-square pixels (eg. most image formats).  It rescales the input so that the display aspect ratio is the same.

```js
ffmpeg('/path/to/file.avi').keepDAR();
```

### Specifying multiple outputs

#### output(target[, options]): add an output to the command

**Aliases**: `addOutput()`.

Adds an output to the command.  The `target` argument may be an output filename or a writable stream (but at most one output stream may be used with a single command).

When `target` is a stream, an additional `options` object may be passed.  If it is present, it will be passed ffmpeg output stream `pipe()` method.

Adding an output switches the "current output" of the command, so that any fluent-ffmpeg method that applies to an output is indeed applied to the last output added.  For backwards compatibility reasons, you may as well call those methods _before_ adding the first output (in which case they will apply to the first output when it is added).  Methods that apply to an output are all non-input-related methods, except for `complexFilter()`, which is global.

Also note that when calling `output()`, you should not use the `save()` or `stream()` (formerly `saveToFile()` and `writeToStream()`) methods, as they already add an output.  Use the `run()` method to start processing.

```js
var stream  = fs.createWriteStream('outputfile.divx');

ffmpeg('/path/to/file.avi')
  .output('outputfile.mp4')
  .output(stream);

ffmpeg('/path/to/file.avi')
  // You may pass a pipe() options object when using a stream
  .output(stream, { end:true });

// Output-related methods apply to the last output added
ffmpeg('/path/to/file.avi')

  .output('outputfile.mp4')
  .audioCodec('libfaac')
  .videoCodec('libx264')
  .size('320x200')

  .output(stream)
  .preset('divx')
  .size('640x480');

// Use the run() method to run commands with multiple outputs
ffmpeg('/path/to/file.avi')
  .output('outputfile.mp4')
  .output(stream)
  .on('end', function() {
    console.log('Finished processing');
  })
  .run();
```


### Output options

#### duration(time): set output duration

**Aliases**: `withDuration()`, `setDuration()`.

Forces ffmpeg to stop transcoding after a specific output duration.  The `time` parameter may be a number (in seconds) or a timestamp string (with format `[[hh:]mm:]ss[.xxx]`).

```js
ffmpeg('/path/to/file.avi').duration(134.5);
ffmpeg('/path/to/file.avi').duration('2:14.500');
```

#### seek(time): seek output

**Aliases**: `seekOutput()`.

Seeks streams before encoding them into the output.  This is different from calling `seekInput()` in that the offset will only apply to one output.  This is also slower, as skipped frames will still be decoded (but dropped).

The `time` argument may be a number (in seconds) or a timestamp string (with format `[[hh:]mm:]ss[.xxx]`).

```js
ffmpeg('/path/to/file.avi')
  .seekInput('1:00')

  .output('from-1m30s.avi')
  .seek(30)

  .output('from-1m40s.avi')
  .seek('0:40');
```

#### format(format): set output format

**Aliases**: `withOutputFormat()`, `toFormat()`, `outputFormat()`.

```js
ffmpeg('/path/to/file.avi').format('flv');
```

#### flvmeta(): update FLV metadata after transcoding

**Aliases**: `updateFlvMetadata()`.

Calling this method makes fluent-ffmpeg run `flvmeta` or `flvtool2` on the output file to add FLV metadata and make files streamable.  It does not work when outputting to a stream, and is only useful when outputting to FLV format.

```js
ffmpeg('/path/to/file.avi').flvmeta().format('flv');
```

#### outputOptions(option...): add custom output options

**Aliases**: `outputOption()`, `addOutputOption()`, `addOutputOptions()`, `withOutputOption()`, `withOutputOptions()`, `addOption()`, `addOptions()`.

This method allows passing any output-related option to ffmpeg.  You can call it with a single argument to pass a single option, optionnaly with a space-separated parameter:

```js
/* Single option */
ffmpeg('/path/to/file.avi').outputOptions('-someOption');

/* Single option with parameter */
ffmpeg('/dev/video0').outputOptions('-r 24');
```

You may also pass multiple options at once by passing an array to the method:

```js
ffmpeg('/path/to/file.avi').outputOptions([
  '-option1',
  '-option2 param2',
  '-option3',
  '-option4 param4'
]);
```

Finally, you may also directly pass command line tokens as separate arguments to the method:

```js
ffmpeg('/path/to/file.avi').outputOptions(
  '-option1',
  '-option2', 'param2',
  '-option3',
  '-option4', 'param4'
);
```


### Miscellaneous options

#### preset(preset): use fluent-ffmpeg preset

**Aliases**: `usingPreset()`.

There are two kinds of presets supported by fluent-ffmpeg.  The first one is preset modules; to use those, pass the preset name as the `preset` argument.  Preset modules are loaded from the directory specified by the `presets` constructor option (defaults to the `lib/presets` fluent-ffmpeg subdirectory).

```js
// Uses <path-to-fluent-ffmpeg>/lib/presets/divx.js
ffmpeg('/path/to/file.avi').preset('divx');

// Uses /my/presets/foo.js
ffmpeg('/path/to/file.avi', { presets: '/my/presets' }).preset('foo');
```

Preset modules must export a `load()` function that takes an FfmpegCommand as an argument.   fluent-ffmpeg comes with the following preset modules preinstalled:

* `divx`
* `flashvideo`
* `podcast`

Here is the code from the included `divx` preset as an example:

```js
exports.load = function(ffmpeg) {
  ffmpeg
    .format('avi')
    .videoBitrate('1024k')
    .videoCodec('mpeg4')
    .size('720x?')
    .audioBitrate('128k')
    .audioChannels(2)
    .audioCodec('libmp3lame')
    .outputOptions(['-vtag DIVX']);
};
```

The second kind of preset is preset functions.  To use those, pass a function which takes an FfmpegCommand as a parameter.

```js
function myPreset(command) {
  command.format('avi').size('720x?');
}

ffmpeg('/path/to/file.avi').preset(myPreset);
```

#### complexFilter(filters[, map]): set complex filtergraph

**Aliases**: `filterGraph()`

The `complexFilter()` method enables setting a complex filtergraph for a command.  It expects a filter specification (or a filter specification array) and an optional output mapping parameter as arguments.

Filter specifications may be either plain ffmpeg filter strings (eg. `split=3[a][b][c]`) or objects with the following keys:
* `filter`: filter name
* `options`: optional; either an option string for the filter (eg. `in:0:30`), an options array for unnamed options (eg. `['in', 0, 30]`) or an object mapping option names to values (eg. `{ t: 'in', s: 0, n: 30 }`).  When `options` is not specified, the filter will be added without any options.
* `inputs`: optional; input stream specifier(s) for the filter.  The value may be either a single stream specifier string or an array of stream specifiers.  Each specifier can be optionally enclosed in square brackets.  When input streams are not specified, ffmpeg will use the first unused streams of the correct type.
* `outputs`: optional; output stream specifier(s) for the filter.  The value may be either a single stream specifier string or an array of stream specifiers.  Each specifier can be optionally enclosed in square brackets.

The output mapping parameter specifies which stream(s) to include in the output from the filtergraph.  It may be either a single stream specifier string or an array of stream specifiers.  Each specifier can be optionally enclosed in square brackets.  When this parameter is not present, ffmpeg will default to saving all unused outputs to the output file.

Note that only one complex filtergraph may be set on a given command.  Calling `complexFilter()` again will override any previously set filtergraph, but you can set as many filters as needed in a single call.

```js
ffmpeg('/path/to/file.avi')
  .complexFilter([
    // Rescale input stream into stream 'rescaled'
    'scale=640:480[rescaled]',

    // Duplicate rescaled stream 3 times into streams a, b, and c
    {
      filter: 'split', options: '3',
      inputs: 'rescaled', outputs: ['a', 'b', 'c']
    },

    // Create stream 'red' by removing green and blue channels from stream 'a'
    {
      filter: 'lutrgb', options: { g: 0, b: 0 },
      inputs: 'a', outputs: 'red'
    },

    // Create stream 'green' by removing red and blue channels from stream 'b'
    {
      filter: 'lutrgb', options: { r: 0, b: 0 },
      inputs: 'b', outputs: 'green'
    },

    // Create stream 'blue' by removing red and green channels from stream 'c'
    {
      filter: 'lutrgb', options: { r: 0, g: 0 },
      inputs: 'c', outputs: 'blue'
    },

    // Pad stream 'red' to 3x width, keeping the video on the left,
    // and name output 'padded'
    {
      filter: 'pad', options: { w: 'iw*3', h: 'ih' },
      inputs: 'red', outputs: 'padded'
    },

    // Overlay 'green' onto 'padded', moving it to the center,
    // and name output 'redgreen'
    {
      filter: 'overlay', options: { x: 'w', y: 0 },
      inputs: ['padded', 'green'], outputs: 'redgreen'
    },

    // Overlay 'blue' onto 'redgreen', moving it to the right
    {
      filter: 'overlay', options: { x: '2*w', y: 0 },
      inputs: ['redgreen', 'blue'], outputs: 'output'
    },
  ], 'output');
```


### Setting event handlers

Before actually running a command, you may want to set event listeners on it to be notified when it's done.  The following events are available:

#### 'start': ffmpeg process started

The `start` event is emitted just after ffmpeg has been spawned.  It is emitted with the full command line used as an argument.

```js
ffmpeg('/path/to/file.avi')
  .on('start', function(commandLine) {
    console.log('Spawned Ffmpeg with command: ' + commandLine);
  });
```

#### 'codecData': input codec data available

The `codecData` event is emitted when ffmpeg outputs codec information about its input streams.  It is emitted with an object argument with the following keys:
* `format`: input format
* `duration`: input duration
* `audio`: audio codec
* `audio_details`: audio encoding details
* `video`: video codec
* `video_details`: video encoding details

```js
ffmpeg('/path/to/file.avi')
  .on('codecData', function(data) {
    console.log('Input is ' + data.audio + ' audio ' +
      'with ' + data.video + ' video');
  });
```

#### 'progress': transcoding progress information

The `progress` event is emitted every time ffmpeg reports progress information.  It is emitted with an object argument with the following keys:
* `frames`: total processed frame count
* `currentFps`: framerate at which FFmpeg is currently processing
* `currentKbps`: throughput at which FFmpeg is currently processing
* `targetSize`: current size of the target file in kilobytes
* `timemark`: the timestamp of the current frame in seconds
* `percent`: an estimation of the progress percentage

Note that `percent` can be (very) inaccurate, as the only progress information fluent-ffmpeg gets from ffmpeg is the total number of frames written (and the corresponding duration).  To estimate percentage, fluent-ffmpeg has to guess what the total output duration will be, and uses the first input added to the command to do so.  In particular:
* percentage is not available when using an input stream
* percentage may be wrong when using multiple inputs with different durations and the first one is not the longest

```js
ffmpeg('/path/to/file.avi')
  .on('progress', function(progress) {
    console.log('Processing: ' + progress.percent + '% done');
  });
```

#### 'stderr': FFmpeg output

The `stderr` event is emitted every time FFmpeg outputs a line to `stderr`.  It is emitted with a string containing the line of stderr (minus trailing new line characters).

```js
ffmpeg('/path/to/file.avi')
  .on('stderr', function(stderrLine) {
    console.log('Stderr output: ' + stderrLine);
  });
```

#### 'error': transcoding error

The `error` event is emitted when an error occurs when running ffmpeg or when preparing its execution.  It is emitted with an error object as an argument.  If the error happened during ffmpeg execution, listeners will also receive two additional arguments containing ffmpegs stdout and stderr.

**Warning**: you should _always_ set a handler for the `error` event, as node's default behaviour when an `error` event without any listeners is emitted is to output the error to the console and _terminate the program_.

```js
ffmpeg('/path/to/file.avi')
  .on('error', function(err, stdout, stderr) {
    console.log('Cannot process video: ' + err.message);
  });
```

#### 'end': processing finished

The `end` event is emitted when processing has finished.  Listeners receive ffmpeg standard output and standard error as arguments, except when generating thumbnails (see below), in which case they receive an array of the generated filenames.

```js
ffmpeg('/path/to/file.avi')
  .on('end', function(stdout, stderr) {
    console.log('Transcoding succeeded !');
  });
```

`stdout` is empty when the command outputs to a stream.  Both `stdout` and `stderr` are limited by the `stdoutLines` option (defaults to 100 lines).


### Starting FFmpeg processing

#### save(filename): save the output to a file

**Aliases**: `saveToFile()`

Starts ffmpeg processing and saves the output to a file.

```js
ffmpeg('/path/to/file.avi')
  .videoCodec('libx264')
  .audioCodec('libmp3lame')
  .size('320x240')
  .on('error', function(err) {
    console.log('An error occurred: ' + err.message);
  })
  .on('end', function() {
    console.log('Processing finished !');
  })
  .save('/path/to/output.mp4');
```

Note: the `save()` method is actually syntactic sugar for calling both `output()` and `run()`.

#### pipe([stream], [options]): pipe the output to a writable stream

**Aliases**: `stream()`, `writeToStream()`.

Starts processing and pipes ffmpeg output to a writable stream.  The `options` argument, if present, is passed to ffmpeg output stream's `pipe()` method (see nodejs documentation).

```js
var outStream = fs.createWriteStream('/path/to/output.mp4');

ffmpeg('/path/to/file.avi')
  .videoCodec('libx264')
  .audioCodec('libmp3lame')
  .size('320x240')
  .on('error', function(err) {
    console.log('An error occurred: ' + err.message);
  })
  .on('end', function() {
    console.log('Processing finished !');
  })
  .pipe(outStream, { end: true });
```

When no `stream` argument is present, the `pipe()` method returns a PassThrough stream, which you can pipe to somewhere else (or just listen to events on).

**Note**: this is only available with node >= 0.10.

```js
var command = ffmpeg('/path/to/file.avi')
  .videoCodec('libx264')
  .audioCodec('libmp3lame')
  .size('320x240')
  .on('error', function(err) {
    console.log('An error occurred: ' + err.message);
  })
  .on('end', function() {
    console.log('Processing finished !');
  });

var ffstream = command.pipe();
ffstream.on('data', function(chunk) {
  console.log('ffmpeg just wrote ' + chunk.length + ' bytes');
});
```

Note: the `stream()` method is actually syntactic sugar for calling both `output()` and `run()`.

#### run(): start processing

**Aliases**: `exec()`, `execute()`.

This method is mainly useful when producing multiple outputs (otherwise the `save()` or `stream()` methods are more straightforward).  It starts processing with the specified outputs.

**Warning**: do not use `run()` when calling other processing methods (eg. `save()`, `pipe()` or `screenshots()`).

```js
ffmpeg('/path/to/file.avi')
  .output('screenshot.png')
  .noAudio()
  .seek('3:00')

  .output('small.avi')
  .audioCodec('copy')
  .size('320x200')

  .output('big.avi')
  .audioCodec('copy')
  .size('640x480')

  .on('error', function(err) {
    console.log('An error occurred: ' + err.message);
  })
  .on('end', function() {
    console.log('Processing finished !');
  })
  .run();
```

#### mergeToFile(filename, tmpdir): concatenate multiple inputs

Use the `input` and `mergeToFile` methods on a command to concatenate multiple inputs to a single output file.  The `mergeToFile` needs a temporary folder as its second argument.

```js
ffmpeg('/path/to/part1.avi')
  .input('/path/to/part2.avi')
  .input('/path/to/part2.avi')
  .on('error', function(err) {
    console.log('An error occurred: ' + err.message);
  })
  .on('end', function() {
    console.log('Merging finished !');
  })
  .mergeToFile('/path/to/merged.avi', '/path/to/tempDir');
```

#### screenshots(options[, dirname]): generate thumbnails

**Aliases**: `thumbnail()`, `thumbnails()`, `screenshot()`, `takeScreenshots()`.

Use the `screenshots` method to extract one or several thumbnails and save them as PNG files.  There are a few caveats with this implementation, though:

* It will not work on input streams.
* Progress information reported by the `progress` event is not accurate.
* It doesn't interract well with filters.  In particular, don't use the `size()` method to resize thumbnails, use the `size` option instead.

The `options` argument is an object with the following keys:

* `folder`: output folder for generated image files.  Defaults to the current folder.
* `filename`: output filename pattern (see below).  Defaults to "tn.png".
* `count`: specifies how many thumbnails to generate.  When using this option, thumbnails are generated at regular intervals in the video (for example, when requesting 3 thumbnails, at 25%, 50% and 75% of the video length).  `count` is ignored when `timemarks` or `timestamps` is specified.
* `timemarks` or `timestamps`: specifies an array of timestamps in the video where thumbnails should be taken.  Each timestamp may be a number (in seconds), a percentage string (eg. "50%") or a timestamp string with format "hh:mm:ss.xxx" (where hours, minutes and milliseconds are both optional).
* `size`: specifies a target size for thumbnails (with the same format as the `.size()` method). **Note:** you should not use the `.size()` method when generating thumbnails.

The `filename` option specifies a filename pattern for generated files.  It may contain the following format tokens:

* '%s': offset in seconds
* '%w': screenshot width
* '%h': screenshot height
* '%r': screenshot resolution (same as '%wx%h')
* '%f': input filename
* '%b': input basename (filename w/o extension)
* '%i': index of screenshot in timemark array (can be zero-padded by using it like `%000i`)

If multiple timemarks are passed and no variable format token ('%s' or '%i') is specified in the filename pattern, `_%i` will be added automatically.

When generating thumbnails, an additional `filenames` event is dispatched with an array of generated filenames as an argument.

```js
ffmpeg('/path/to/video.avi')
  .on('filenames', function(filenames) {
    console.log('Will generate ' + filenames.join(', '))
  })
  .on('end', function() {
    console.log('Screenshots taken');
  })
  .screenshots({
    // Will take screens at 20%, 40%, 60% and 80% of the video
    count: 4,
    folder: '/path/to/output'
  });

ffmpeg('/path/to/video.avi')
  .screenshots({
    timestamps: [30.5, '50%', '01:10.123'],
    filename: 'thumbnail-at-%s-seconds.png',
    folder: '/path/to/output',
    size: '320x240'
  });
```

### Controlling the FFmpeg process

#### kill([signal='SIGKILL']): kill any running ffmpeg process

This method sends `signal` (defaults to 'SIGKILL') to the ffmpeg process.  It only has sense when processing has started.  Sending a signal that terminates the process will result in the `error` event being emitted.

```js
var command = ffmpeg('/path/to/video.avi')
  .videoCodec('libx264')
  .audioCodec('libmp3lame')
  .on('start', function() {
    // Send SIGSTOP to suspend ffmpeg
    command.kill('SIGSTOP');

    doSomething(function() {
      // Send SIGCONT to resume ffmpeg
      command.kill('SIGCONT');
    });
  })
  .save('/path/to/output.mp4');

// Kill ffmpeg after 60 seconds anyway
setTimeout(function() {
  command.on('error', function() {
    console.log('Ffmpeg has been killed');
  });

  command.kill();
}, 60000);
```

#### renice([niceness=0]): change ffmpeg process priority

This method alters the niceness (priority) value of any running ffmpeg process (if any) and any process spawned in the future.  The `niceness` parameter may range from -20 (highest priority) to 20 (lowest priority) and defaults to 0 (which is the default process niceness on most *nix systems).

**Note**: this method is ineffective on Windows platforms.

```js
// Set startup niceness
var command = ffmpeg('/path/to/file.avi')
  .renice(5)
  .save('/path/to/output.mp4');

// Command takes too long, raise its priority
setTimeout(function() {
  command.renice(-5);
}, 60000);
```


### Reading video metadata

You can read metadata from any valid ffmpeg input file with the modules `ffprobe` method.

```js
ffmpeg.ffprobe('/path/to/file.avi', function(err, metadata) {
    console.dir(metadata);
});
```

You may also call the ffprobe method on an FfmpegCommand to probe one of its input.  You may pass a 0-based input number as a first argument to specify which input to read metadata from, otherwise the method will probe the last added input.

```js
ffmpeg('/path/to/file1.avi')
  .input('/path/to/file2.avi')
  .ffprobe(function(err, data) {
    console.log('file2 metadata:');
    console.dir(data);
  });

ffmpeg('/path/to/file1.avi')
  .input('/path/to/file2.avi')
  .ffprobe(0, function(err, data) {
    console.log('file1 metadata:');
    console.dir(data);
  });
```

**Warning:** ffprobe may be called with an input stream, but in this case *it will consume data from the stream*, and this data will no longer be available for ffmpeg.  Using both ffprobe and a transcoding command on the same input stream will most likely fail unless the stream is a live stream.  Only do this if you know what you're doing.

The returned object is the same that is returned by running the following command from your shell (depending on your ffmpeg version you may have to replace `-of` with `-print_format`) :

```sh
$ ffprobe -of json -show_streams -show_format /path/to/file.avi
```

It will contain information about the container (as a `format` key) and an array of streams (as a `stream` key).  The format object and each stream object also contains metadata tags, depending on the format:

```js
{
  "streams": [
    {
      "index": 0,
      "codec_name": "h264",
      "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
      "profile": "Constrained Baseline",
      "codec_type": "video",
      "codec_time_base": "1/48",
      "codec_tag_string": "avc1",
      "codec_tag": "0x31637661",
      "width": 320,
      "height": 180,
      "has_b_frames": 0,
      "sample_aspect_ratio": "1:1",
      "display_aspect_ratio": "16:9",
      "pix_fmt": "yuv420p",
      "level": 13,
      "r_frame_rate": "24/1",
      "avg_frame_rate": "24/1",
      "time_base": "1/24",
      "start_pts": 0,
      "start_time": "0.000000",
      "duration_ts": 14315,
      "duration": "596.458333",
      "bit_rate": "702655",
      "nb_frames": "14315",
      "disposition": {
        "default": 0,
        "dub": 0,
        "original": 0,
        "comment": 0,
        "lyrics": 0,
        "karaoke": 0,
        "forced": 0,
        "hearing_impaired": 0,
        "visual_impaired": 0,
        "clean_effects": 0,
        "attached_pic": 0
      },
      "tags": {
        "creation_time": "1970-01-01 00:00:00",
        "language": "und",
        "handler_name": "\fVideoHandler"
      }
    },
    {
      "index": 1,
      "codec_name": "aac",
      "codec_long_name": "AAC (Advanced Audio Coding)",
      "codec_type": "audio",
      "codec_time_base": "1/48000",
      "codec_tag_string": "mp4a",
      "codec_tag": "0x6134706d",
      "sample_fmt": "fltp",
      "sample_rate": "48000",
      "channels": 2,
      "bits_per_sample": 0,
      "r_frame_rate": "0/0",
      "avg_frame_rate": "0/0",
      "time_base": "1/48000",
      "start_pts": 0,
      "start_time": "0.000000",
      "duration_ts": 28619776,
      "duration": "596.245333",
      "bit_rate": "159997",
      "nb_frames": "27949",
      "disposition": {
        "default": 0,
        "dub": 0,
        "original": 0,
        "comment": 0,
        "lyrics": 0,
        "karaoke": 0,
        "forced": 0,
        "hearing_impaired": 0,
        "visual_impaired": 0,
        "clean_effects": 0,
        "attached_pic": 0
      },
      "tags": {
        "creation_time": "1970-01-01 00:00:00",
        "language": "und",
        "handler_name": "\fSoundHandler"
      }
    }
  ],
  "format": {
    "filename": "http://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    "nb_streams": 2,
    "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
    "format_long_name": "QuickTime / MOV",
    "start_time": "0.000000",
    "duration": "596.459000",
    "size": "64657027",
    "bit_rate": "867211",
    "tags": {
      "major_brand": "isom",
      "minor_version": "512",
      "compatible_brands": "mp41",
      "creation_time": "1970-01-01 00:00:00",
      "title": "Big Buck Bunny",
      "artist": "Blender Foundation",
      "composer": "Blender Foundation",
      "date": "2008",
      "encoder": "Lavf52.14.0"
    }
  }
}
```

### Querying ffmpeg capabilities

fluent-ffmpeg enables you to query your installed ffmpeg version for supported formats, codecs, encoders and filters.

```js

var Ffmpeg = require('fluent-ffmpeg');

Ffmpeg.getAvailableFormats(function(err, formats) {
  console.log('Available formats:');
  console.dir(formats);
});

Ffmpeg.getAvailableCodecs(function(err, codecs) {
  console.log('Available codecs:');
  console.dir(codecs);
});

Ffmpeg.getAvailableEncoders(function(err, encoders) {
  console.log('Available encoders:');
  console.dir(encoders);
});

Ffmpeg.getAvailableFilters(function(err, filters) {
  console.log("Available filters:");
  console.dir(filters);
});

// Those methods can also be called on commands
new Ffmpeg({ source: '/path/to/file.avi' })
  .getAvailableCodecs(...);
```

These methods pass an object to their callback with keys for each available format, codec or filter.

The returned object for formats looks like:

```js
{
  ...
  mp4: {
    description: 'MP4 (MPEG-4 Part 14)',
    canDemux: false,
    canMux: true
  },
  ...
}
```

* `canDemux` indicates whether ffmpeg is able to extract streams from (demux) this format
* `canMux` indicates whether ffmpeg is able to write streams into (mux) this format

The returned object for codecs looks like:

```js
{
  ...
  mp3: {
    type: 'audio',
    description: 'MP3 (MPEG audio layer 3)',
    canDecode: true,
    canEncode: true,
    intraFrameOnly: false,
    isLossy: true,
    isLossless: false
  },
  ...
}
```

* `type` indicates the codec type, either "audio", "video" or "subtitle"
* `canDecode` tells whether ffmpeg is able to decode streams using this codec
* `canEncode` tells whether ffmpeg is able to encode streams using this codec

Depending on your ffmpeg version (or if you use avconv instead) other keys may be present, for example:

* `directRendering` tells if codec can render directly in GPU RAM; useless for transcoding purposes
* `intraFrameOnly` tells if codec can only work with I-frames
* `isLossy` tells if codec can do lossy encoding/decoding
* `isLossless` tells if codec can do lossless encoding/decoding

With some ffmpeg/avcodec versions, the description includes encoder/decoder mentions in the form "Foo codec (decoders: libdecodefoo) (encoders: libencodefoo)".  In this case you will want to use those encoders/decoders instead (the codecs object returned by `getAvailableCodecs` will also include them).

The returned object for encoders looks like:

```js
{
  ...
  libmp3lame: {
    type: 'audio',
    description: 'MP3 (MPEG audio layer 3) (codec mp3)',
    frameMT: false,
    sliceMT: false,
    experimental: false,
    drawHorizBand: false,
    directRendering: false
  },
  ...
}
```

* `type` indicates the encoder type, either "audio", "video" or "subtitle"
* `experimental` indicates whether the encoder is experimental.  When using such a codec, fluent-ffmpeg automatically adds the '-strict experimental' flag.

The returned object for filters looks like:

```js
{
  ...
  scale: {
    description: 'Scale the input video to width:height size and/or convert the image format.',
    input: 'video',
    multipleInputs: false,
    output: 'video',
    multipleOutputs: false
  },
  ...
}
```

* `input` tells the input type this filter operates on, one of "audio", "video" or "none".  When "none", the filter likely generates output from nothing
* `multipleInputs` tells whether the filter can accept multiple inputs
* `output` tells the output type this filter generates, one of "audio", "video" or "none".  When "none", the filter has no output (sink only)
* `multipleInputs` tells whether the filter can generate multiple outputs

### Cloning an FfmpegCommand

You can create clones of an FfmpegCommand instance by calling the `clone()` method.  The clone will be an exact copy of the original at the time it has been called (same inputs, same options, same event handlers, etc.).  This is mainly useful when you want to apply different processing options on the same input.

Setting options, adding inputs or event handlers on a clone will not affect the original command.

```js
// Create a command to convert source.avi to MP4
var command = ffmpeg('/path/to/source.avi')
  .audioCodec('libfaac')
  .videoCodec('libx264')
  .format('mp4');

// Create a clone to save a small resized version
command.clone()
  .size('320x200')
  .save('/path/to/output-small.mp4');

// Create a clone to save a medium resized version
command.clone()
  .size('640x400')
  .save('/path/to/output-medium.mp4');

// Save a converted version with the original size
command.save('/path/to/output-original-size.mp4');
```


## Contributing

Contributions in any form are highly encouraged and welcome! Be it new or improved presets, optimized streaming code or just some cleanup. So start forking!

### Code contributions

If you want to add new features or change the API, please submit an issue first to make sure no one else is already working on the same thing and discuss the implementation and API details with maintainers and users by creating an issue.  When everything is settled down, you can submit a pull request.

When fixing bugs, you can directly submit a pull request.

Make sure to add tests for your features and bugfixes and update the documentation (see below) before submitting your code!

### Documentation contributions

You can directly submit pull requests for documentation changes.  Make sure to regenerate the documentation before submitting (see below).

### Updating the documentation

When contributing API changes (new methods for example), be sure to update the README file and JSDoc comments in the code.  fluent-ffmpeg comes with a plugin that enables two additional JSDoc tags:

* `@aliases`: document method aliases

```js
/**
 * ...
 * @method FfmpegCommand#myMethod
 * @aliases myMethodAlias,myOtherMethodAlias
 */
```

* `@category`: set method category

```js
/**
 * ...
 * @category Audio
 */
```

You can regenerate the JSDoc documentation by running the following command:

```sh
$ make doc
```

To avoid polluting the commit history, make sure to only commit the regenerated JSDoc once and in a specific commit.

### Running tests

To run unit tests, first make sure you installed npm dependencies (run `npm install`).

```sh
$ make test
```

If you want to re-generate the test coverage report (filed under test/coverage.html), run

```sh
$ make test-cov
```

Make sure your ffmpeg installation is up-to-date to prevent strange assertion errors because of missing codecs/bugfixes.

## Main contributors

* [enobrev](http://github.com/enobrev)
* [njoyard](http://github.com/njoyard)
* [sadikzzz](http://github.com/sadikzzz)
* [smremde](http://github.com/smremde)
* [spruce](http://github.com/spruce)
* [tagedieb](http://github.com/tagedieb)
* [tommadema](http://github.com/tommadema)
* [Weltschmerz](http://github.com/Weltschmerz)

## License

(The MIT License)

Copyright (c) 2011 Stefan Schaermeli &lt;schaermu@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
