# Fluent ffmpeg-API for node.js [![Build Status](https://secure.travis-ci.org/schaermu/node-fluent-ffmpeg.png)](http://travis-ci.org/schaermu/node-fluent-ffmpeg)

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

## Tests
To run unit tests, first make sure you installed npm dependencies (run `npm install`).

```sh
$ make test
```

If you want to re-generate the test coverage report (filed under test/coverage.html), run

```sh
$ make test-cov
```

Make sure your ffmpeg installation is up-to-date to prevent strange assertion errors because of missing codecs/bugfixes.

## Usage

You will find a lot of usage examples (including a real-time streaming example using [flowplayer](http://www.flowplayer.org) and [express](https://github.com/visionmedia/express)!) in the `examples` folder.

### Creating an FFmpeg command

The fluent-ffmpeg module returns a constructor that you can use to instanciate FFmpeg commands.  You have to supply a configuration object containing at least the input source.

```js
var FFmpeg = require('fluent-ffmpeg');
var command = FFmpeg({ source: '/path/to/file.avi' });
```

The input file can also be an image or an image pattern.

```js
var imageCommand = FFmpeg({ source: '/path/to/file.png' });

// Will use file000.png, file001.png, etc.
var patternCommand = FFmpeg({ source: '/path/to/file%03d.png' });
```

You can also pass a Readable stream instead of a source path.

```js
var inStream = fs.createReadStream('/path/to/file.avi');
var command = new FFmpeg({ source: inStream });
```

Additional options can be supplied when creating a command.

```js
var command = new FFmpeg({
        // Source filename or input stream
        source: '/path/to/file.avi',

        // Custom presets folder
        preset: './presets',

        // Processing timeout in seconds, defaults to no timeout
        // You can disable the timeout by passing 0.
        timeout: 30,

        // Priority (niceness) for spawned FFmpeg processes.
        // Defaults to 0; not supported on Windows platforms
        priority: -5,

        // Custom Winston logger instance, defaults to not
        // logging anything.
        logger: new winston.Logger(...),

        // Disable logging, even if logger is specified
        nolog: false
    });
```

### Supplying FFmpeg options

FFmpeg commands have several methods to pass options to FFmpeg.  All these methods return the command object, so that calls can be chained.  Here are all the available methods:

```js

new FFmpeg({ source: '/path/to/video.avi' })
    
    /** Stream selection **/

    // Skip video streams in output
    .withNoVideo()

    // Skip audio streams in output
    .withNoAudio()

    // Add an input file
    .addInput('/path/to/audiotrack.mp3')


    /** Video codec and bitrate **/

    // Specify video codec
    .withVideoCodec('libx624')

    // Specify video bitrate in kbps (the 'k' is optional)
    .withVideoBitrate('650k')

    // Specify a constant video bitrate
    .withVideoBitrate('650k', true)


    /** Video size **/

    // Specify a fixed output size
    .withSize('320x240')

    // Specify a proportional resize of the input
    .withSize('50%')

    // Force one dimension and automatically determine the other
    .withSize('320x?')
    .withSize('?x240')

    // Auto-pad video, defaulting to black padding
    .applyAutopadding(true)
    .applyAutopadding(true, 'white')

    // Set aspect ratio
    .withAspectRatio(1.33)

    // Keep aspect ratio
    .keepPixelAspect(true)


    /** Video timing **/

    // Specify input FPS (only valid for raw video formats)
    .withFpsInput(24)

    // Set output FPS
    .withFps(24)
    .withFpsOutput(24)

    // Loop indefinitely, only relevant when outputting to a stream
    .loop()

    // Loop for a certain duration in seconds
    .loop(120)

    // Skip to specific timestamp
    .setStartTime(120)
    .setStartTime('2:00')

    // Only transcode a certain duration
    .setDuration(120)
    .setDuration('2:00')

    // Only transcode a certain number of frames
    .takeFrames(250)


    /** Audio codec and bitrate **/

    // Specify audio codec
    .withAudioCodec('libmp3lame')

    // Specify audio bitrate in kbps (the 'k' is optional)
    .withAudioBitrate('128k')

    // Specify the number of audio channels
    .withAudioChannels(2)

    // Specify the audio sample frequency
    .withAudioFrequency(48000)

    // Specify the audio quality factor
    .withAudioQuality(5)


    /** Format options **/

    // Specify input format
    .fromFormat('avi')

    // Set output format
    .toFormat('webm')

    /** Custom filters **/

    // Add custom audio filters
    .withAudioFilter('equalizer=f=1000:width_type=h:width=200:g=-10')
    .withAudioFilter('pan=1:c0=0.9*c0+0.1*c1')

    // Add custom video filters
    .withVideoFilter('size=iw*1.5:ih/2')
    .withVideoFilter('drawtext=\'fontfile=FreeSans.ttf:text=Hello\'')

    /** Miscellaneous options **/

    // Use strict experimental flag (needed for some codecs)
    .withStrictExperimental()

    // Add custom input option (will be added before the input
    // on ffmpeg command line)
    .addInputOption('-f', 'avi')

    // Add several input options at once
    .addInputOptions(['-f avi', '-ss 2:30'])

    // Add custom option
    .addOption('-crf', '23')

    // Add several options at once
    .addOptions(['-crf 23', '--preset ultrafast']);
```

### Setting event handlers

You can set events listeners on a command.

```js

var command = new FFmpeg({ source: '/path/to/video.avi' })

    .on('start', function(commandLine) {
        // The 'start' event is emitted just after the FFmpeg
        // process is spawned.

        console.log('Spawned FFmpeg with command: ' + commandLine);
    })

    .on('codecData', function(data) {
        // The 'codecData' event is emitted when FFmpeg first
        // reports input codec information. 'data' contains
        // the following information:
        // - 'format': input format
        // - 'duration': input duration
        // - 'audio': audio codec
        // - 'audio_details': audio encoding details
        // - 'video': video codec
        // - 'video_details': video encoding details
        console.log('Input is ' + data.audio + ' audio with ' + data.video + ' video');
    })

    .on('progress', function(progress) {
        // The 'progress' event is emitted every time FFmpeg
        // reports progress information. 'progress' contains
        // the following information:
        // - 'frames': the total processed frame count
        // - 'currentFps': the framerate at which FFmpeg is
        //   currently processing
        // - 'currentKbps': the throughput at which FFmpeg is
        //   currently processing
        // - 'targetSize': the current size of the target file
        //   in kilobytes
        // - 'timemark': the timestamp of the current frame
        //   in seconds
        // - 'percent': an estimation of the progress

        console.log('Processing: ' + progress.percent + '% done');
    })

    .on('error', function(err) {
        // The 'error' event is emitted when an error occurs,
        // either when preparing the FFmpeg process or while
        // it is running

        console.log('Cannot process video: ' + err.message);
    })

    .on('end', function() {
        // The 'end' event is emitted when FFmpeg finishes
        // processing.

        console.log('Processing finished successfully');
    });
```

Note that you should always set a listener for the `error` event.  If you have not set any listener and an error happens, your nodejs process will end.

### Starting FFmpeg processing

#### Saving output to a file

Use the `saveToFile` method on a command to start processing and save the output to a file.

```js
new FFmpeg({ source: })
    .withVideoCodec('libx264')
    .withAudioCodec('libmp3lame')
    .withSize('320x240')
    .on('error', function(err) {
        console.log('An error occurred: ' + err.message);
    })
    .on('end', function() {
        console.log('Processing finished !');
    })
    .saveToFile('/path/to/output.mp4');
```

#### Piping output to a writable stream

Use the `writeToStream` method on a command to start processing and pipe the output to a writable stream.  You can supply pipe options as a second argument to `writeToStream`.

```js
var outStream = fs.createWriteStream('/path/to/output.mp4');

new FFmpeg({ source: '/path/to/video.avi' })
    .withVideoCodec('libx264')
    .withAudioCodec('libmp3lame')
    .withSize('320x240')
    .on('error', function(err) {
        console.log('An error occurred: ' + err.message);
    })
    .on('end', function() {
        console.log('Processing finished !');
    })
    .writeToStream(outStream, { end: true });
```

### Using presets

#### Preset functions

You can define a preset as a function that takes an `FfmpegCommand` as an argument and calls method on it, and then pass it to `usingPreset`. You may pass an optional `Object` as second argument to allow customization of your presets.

```js
function myPreset(command, opt_options) {
    opt_options = opt_options || {};

    command
        .withAudioCodec('libmp3lame')
        .withVideoCodec('libx264')
        .withSize(opt_options.size || '320x240');
}

new Ffmpeg({ source: '/path/to/video.avi' })
    .usingPreset(myPreset)
    .saveToFile('/path/to/converted.mp4');
```

#### Preset modules

Preset modules are located in fluent-ffmpeg `lib/presets` directory.  To use a preset, call the `usingPreset` method on a command.

```js
new FFmpeg({ source: '/path/to/video.avi' })
    .usingPreset('flashvideo')
    .saveToFile('/path/to/converted.flv');
```

Preset modules should export a `load` method, which will receive the command object to alter.

```js
exports.load = function(command) {
    command
        .withAudioCodec('libmp3lame')
        .withVideoCodec('libx264')
        .withSize('320x240');
};
```

fluent-ffmpeg comes with the following preset modules preinstalled:
* `divx`
* `flashvideo`
* `podcast`

### Merging inputs

Use the `mergeAdd` and `mergeToFile` methods on a command to concatenate multiple inputs to a single output file.  The `mergeToFile` needs a temporary folder as its second argument.

```js
new FFmpeg({ source: '/path/to/part1.avi' })
    .mergeAdd('/path/to/part2.avi')
    .mergeAdd('/path/to/part2.avi')
    .on('error', function(err) {
        console.log('An error occurred: ' + err.message);
    })
    .on('end', function() {
        console.log('Merging finished !');
    })
    .mergeToFile('/path/to/merged.avi', '/path/to/tempDir');
```

### Generating thumbnails

One pretty neat feature of fluent-ffmpeg is the ability to generate any amount of thumbnails from your movies. The screenshots are taken at automatically determined timemarks using the following formula: `(duration_in_sec * 0.9) / number_of_thumbnails`.

When generating thumbnails, the `end` event is dispatched with an array of generated filenames as an argument.

```js
new FFmpeg({ source: '/path/to/video.avi' })
    .withSize('320x240')
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
new FFmpeg({ source: '/path/to/video.avi' })
    .withSize('320x240')
    .on('error', function(err) {
        console.log('An error occurred: ' + err.message);
    })
    .on('end', function(filenames) {
        console.log('Successfully generated ' + filenames.join(', '));
    })
    .takeScreenshots(
        {
            count: 2,
            timemarks: [ '0.5', '1' ]
        },
        '/path/to/directory'
    );
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
new FFmpeg({ source: '/path/to/video.avi' })
    .withSize('320x240')
    .on('error', function(err) {
        console.log('An error occurred: ' + err.message);
    })
    .on('end', function(filenames) {
        console.log('Successfully generated ' + filenames.join(', '));
    })
    .takeScreenshots(
        {
            count: 2,
            timemarks: [ '0.5', '1' ],
            filename: '%b-thumbnail-%i-%r'
        },
        '/path/to/directory'
    );
```

### Controlling the FFmpeg process

You can control the spawned FFmpeg process with the `kill` and `renice` methods.  `kill` only works after having spawned an FFmpeg process, but `renice` can be used at any time.

```js
var command = new FFmpeg({ source: '/path/to/video.avi' })
    .withVideoCodec('libx264')
    .withAudioCodec('libmp3lame')

    // Set initial niceness
    .renice(5)

    .saveToFile('/path/to/output.mp4');

// Change process niceness (not supported on Windows platforms)
command.renice(-5);

// Send custom signals
command.kill('SIGSTOP');
setTimeout(function() {
    command.kill('SIGCONT');
}, 1000);

// `kill` defaults to SIGKILL (will make command emit an 'error' event)
setTimeout(function() {
    command.kill();
}, 2000);
```

### Reading video metadata

Using a separate object, you can access various metadata of your video file.

```js
var Metadata = require('fluent-ffmpeg').Metadata;

new Metadata(
    '/path/to/your_movie.avi',
    function(metadata, err) {
        console.log(require('util').inspect(metadata, false, null));
    }
);
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

## Contributors

* [enobrev](http://github.com/enobrev)
* [njoyard](http://github.com/njoyard)
* [sadikzzz](http://github.com/sadikzzz)
* [smremde](http://github.com/smremde)
* [spruce](http://github.com/spruce)
* [tagedieb](http://github.com/tagedieb)
* [tommadema](http://github.com/tommadema)
* [Weltschmerz](http://github.com/Weltschmerz)

## Contributing

Contributions in any form are highly encouraged and welcome! Be it new or improved presets, optimized streaming code or just some cleanup. So start forking!

## License

(The MIT License)

Copyright (c) 2011 Stefan Schaermeli &lt;schaermu@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
