# Fluent ffmpeg-API for node.js [![Build Status](https://secure.travis-ci.org/fluent-ffmpeg/node-fluent-ffmpeg.svg?branch=2.x)](http://travis-ci.org/fluent-ffmpeg/node-fluent-ffmpeg)

This library abstracts the complex command-line usage of ffmpeg into a fluent, easy to use node.js module. In order to be able to use this module, make sure you have [ffmpeg](http://www.ffmpeg.org) installed on your system (including all necessary encoding libraries like libmp3lame or libx264).

Now including input streaming support (means you can convert **on-the-fly** using an input- and an outputstream)!



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

#### seek(time[, fast=false]): set input start time

**Aliases**: `seekTo()`, `setStartTime()`.

The `time` argument may be a number (in seconds) or a timestamp string (with format `[[hh:]mm:]ss[.xxx]`).

The `fast` argument specifies whether to use fast-seek or slow-seek.  Fast-seeking is faster but will not always seek exactly to the specified time (see Ffmpeg documentation).  You may want to use a combination of both.

```js
ffmpeg('/path/to/file.avi').seek(134.5);
ffmpeg('/path/to/file.avi').seek('2:14.500');

// Fast seek to 2:00, then slow-seek 14.5 more seconds
ffmpeg('/path/to/file.avi').seek('2:00', true).seek(14.5);
```

#### fastSeek(time): set input fast start time

**Aliases**: `fastSeekTo()`.

This is the same as calling `seek(time, true)`.

```js
ffmpeg('/path/to/file.avi').fastSeek('2:00').seek('0:14.500');
```

#### loop([duration]): loop over input

```js
ffmpeg('/path/to/file.avi').loop();
ffmpeg('/path/to/file.avi').loop(134.5);
ffmpeg('/path/to/file.avi').loop('2:14.500');
```

#### inputOptions(option[, option...]): add custom input options

**Aliases**: `inputOption()`, `addInputOption()`, `addInputOptions()`, `withInputOption()`, `withInputOptions()`.

You can pass one option, many options or an option array to this method.

```js
ffmpeg('/dev/video0').inputOptions('-r', '24');
ffmpeg('/dev/video0').inputOptions('-r 24');
ffmpeg('/dev/video0').inputOptions(['-r 24', '-loop 1']);
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

#### audioFilters(filter[, filter...]): add custom audio filters

**Aliases**: `audioFilter()`, `withAudioFilter()`, `withAudioFilters()`.

This method enables adding custom audio filters.  You may add multiple filters at once by passing either several arguments or a string array.  See the Ffmpeg documentation for available filters and their syntax.

```js
ffmpeg('/path/to/file.avi')
  .audioFilters('volume=0.5')
  .audioFilters('silencedetect=n=-50dB:d=5');

ffmpeg('/path/to/file.avi')
  .audioFilters('volume=0.5', 'silencedetect=n=-50dB:d=5');

ffmpeg('/path/to/file.avi')
  .audioFilters(['volume=0.5', 'silencedetect=n=-50dB:d=5']);
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

#### videoFilters(filter[, filter...]): add custom video filters

**Aliases**: `videoFilter()`, `withVideoFilter()`, `withVideoFilters()`.

This method enables adding custom video filters.  You may add multiple filters at once by passing either several arguments or a string array.  See the Ffmpeg documentation for available filters and their syntax.

```js
ffmpeg('/path/to/file.avi')
  .videoFilters('fade=in:0:30')
  .videoFilters('pad=640:480:0:40:violet');

ffmpeg('/path/to/file.avi')
  .videoFilters('fade=in:0:30', 'pad=640:480:0:40:violet');

ffmpeg('/path/to/file.avi')
  .videoFilters(['fade=in:0:30', 'pad=640:480:0:40:violet']);
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


### Output options

#### duration(time): set output duration

**Aliases**: `withDuration()`, `setDuration()`.

Forces ffmpeg to stop transcoding after a specific output duration.  The `time` parameter may be a number (in seconds) or a timestamp string (with format `[[hh:]mm:]ss[.xxx]`).

```js
ffmpeg('/path/to/file.avi').duration(134.5);
ffmpeg('/path/to/file.avi').duration('2:14.500');
```

#### format(format): set output format

**Aliases**: `withOutputFormat()`, `toFormat()`, `outputFormat()`.

```js
ffmpeg('/path/to/file.avi').format('flv');
```

#### outputOptions(option[, option...]): add custom output options

**Aliases**: `outputOption()`, `addOutputOption()`, `addOutputOptions()`, `withOutputOption()`, `withOutputOptions()`, `addOption()`, `addOptions()`.

You can pass one option, many options or an option array to this method.

```js
ffmpeg('/dev/video0').outputOptions('-r', '24');
ffmpeg('/dev/video0').outputOptions('-r 24');
ffmpeg('/dev/video0').outputOptions(['-r 24', '-loop 1']);
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

#### strict(): enable experimental codecs

**Aliases**: `withStrictExperimental()`.

This enables using experimental codecs and features of ffmpeg.

```js
ffmpeg('/path/to/file.avi').strict().videoCodec('aac');
```

#### flvmeta(): update FLV metadata after transcoding

**Aliases**: `updateFlvMetadata()`.

Calling this method makes fluent-ffmpeg run `flvmeta` or `flvtool2` on the output file to add FLV metadata and make files streamable.  It does not work when outputting to a stream, and is only useful when outputting to FLV format.

```js
ffmpeg('/path/to/file.avi').flvmeta().format('flv');
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
* `percent`: an estimation of the progress (only available when the total output duration is known; most notably not available when using an input stream).

```js
ffmpeg('/path/to/file.avi')
  .on('progress', function(progress) {
    console.log('Processing: ' + progress.percent + '% done');
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

The `end` event is emitted when processing has finished.  Listeners receive no arguments, except when generating thumbnails (see below), in which case they receive an array of the generated filenames.

```js
ffmpeg('/path/to/file.avi')
  .on('end', function() {
    console.log('Transcoding succeeded !');
  });
```


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

#### takeScreenshots(options, dirname): generate thumbnails

One pretty neat feature of fluent-ffmpeg is the ability to generate any amount of thumbnails from your movies. The screenshots are taken at automatically determined timemarks using the following formula: `(duration_in_sec * 0.9) / number_of_thumbnails`.

When generating thumbnails, the `end` event is dispatched with an array of generated filenames as an argument.

```js
ffmpeg('/path/to/video.avi')
  .size('320x240')
  .on('error', function(err) {
    console.log('An error occurred: ' + err.message);
  })
  .on('end', function(filenames) {
    console.log('Successfully generated ' + filenames.join(', '));
  })
  .takeScreenshots(5, '/path/to/directory');
```

You can also call `takeScreenshots` with specific timemarks.

```js
ffmpeg('/path/to/video.avi')
  .size('320x240')
  .on('error', function(err) {
    console.log('An error occurred: ' + err.message);
  })
  .on('end', function(filenames) {
    console.log('Successfully generated ' + filenames.join(', '));
  })
  .takeScreenshots({
    count: 2,
    timemarks: [ '0.5', '1' ]
  }, '/path/to/directory');
```

You can set a filename pattern using following format characters:

* `%s` - offset in seconds
* `%w` - screenshot width
* `%h` - screenshot height
* `%r` - screenshot resolution (eg. '320x240')
* `%f` - input filename
* `%b` - input basename (filename w/o extension) 
* `%i` - number of screenshot in timemark array (can be zero-padded by using it like `%000i`)

If multiple timemarks are given and no `%i` format character is found in filename, `_%i` will be added to the end of the given pattern.

```js
ffmpeg('/path/to/video.avi')
  .size('320x240')
  .on('error', function(err) {
    console.log('An error occurred: ' + err.message);
  })
  .on('end', function(filenames) {
    console.log('Successfully generated ' + filenames.join(', '));
  })
  .takeScreenshots({
    count: 2,
    timemarks: [ '0.5', '1' ],
    filename: '%b-thumbnail-%i-%r'
  }, '/path/to/directory');
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

You may also call the ffprobe method on an FfmpegCommand, in which case it will probe its last added input.

```js
ffmpeg('/path/to/file1.avi')
  .input('/path/to/file2.avi')
  .ffprobe(function(err, data) {
    console.log('file2 metadata:');
    console.dir(data);
  });
```

The returned object is the same that is returned by running the following command from your shell:

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

fluent-ffmpeg enables you to query your installed ffmpeg version for supported formats, codecs and filters.

```js

var Ffmpeg = require('fluent-ffmpeg');

Ffmpeg.getAvailableFormats(function(err, formats) {
    console.log("Available formats:");
    console.dir(formats);
});

Ffmpeg.getAvailableCodecs(function(err, codecs) {
    console.log("Available codecs:");
    console.dir(codecs);
});

Ffmpeg.getAvailableFilters(function(err, filters) {
    console.log("Available filters:");
    console.dir(filters);
});

// Those methods can also be called on commands
new Ffmpeg({ source: "/path/to/file.avi "})
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

## Migrating from fluent-ffmpeg 1.x

fluent-ffmpeg 2.0 is mostly compatible with previous versions, as all previous method names have been kept as aliases.  The paragraphs below explain how to get around the few remaining incompatibilities.

### Callbacks and event handling

Passing callback to the `saveToFile()`, `writeToStream()`, `takeScreenshots()` and `mergeToFile()` methods has been deprecated for some time now, and is now unsupported from version 2.0 onwards.  You must use event handlers instead.  

```js
// 1.x code
command
  .saveToFile('/path/to/output.avi', function(err) {
    if (err) {
      console.log('An error occurred: ' + err.message);
    } else {
      console.log('Processing finished');
    }
  });

// 2.x code
command
  .on('error', function(err) {
    console.log('An error occurred: ' + err.message);
  })
  .on('end', function() {
    console.log('Processing finished');
  })
  .saveToFile('/path/to/output.avi');
```

The same goes for the `onProgress` and `onCodecData` methods.

```js
// 1.x code
command
  .onProgress(function(progress) { ... })
  .onCodecData(function(data) { ... });

// 2.x code
command
  .on('progress', function(progress) { ... })
  .on('codecData', function(data) { ... };
```

Note that you should always set a handler for the `error` event.  If an error happens without an `error` handler, nodejs will terminate your program.

See the [events documentation](#setting-event-handlers) above for more information.

### Metadata and Calculate submodules

Both the Metadata and Calculate submodules have been removed, as they were pretty unreliable.

The Calculate submodule has no replacement, as fluent-ffmpeg does not do size calculations anymore (we use ffmpeg filters instead).

The Metadata submodule is replaced by the `ffprobe()` method which is much more reliable.  Have a look at [its documentation](#reading-video-metadata) above for more information.

```js
var ffmpeg = require('fluent-ffmpeg');

ffmpeg('/path/to/file.avi').ffprobe(function(err, data) {
  console.dir(data.streams);
  console.dir(data.format);
});

ffmpeg.ffprobe('/path/to/file.avi', function(err, data) {
  console.dir(data.streams);
  console.dir(data.format);
});
```

## Contributing

Contributions in any form are highly encouraged and welcome! Be it new or improved presets, optimized streaming code or just some cleanup. So start forking!

### Code contributions

If you want to add new features or change the API, please submit an issue first to make sure no one else is already working on the same thing and discuss the implementation and API details with maintainers and users.  When everything is settled down, you can submit a pull request.

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
