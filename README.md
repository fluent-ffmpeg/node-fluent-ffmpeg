# Fluent ffmpeg-API for node.js [![Build Status](https://secure.travis-ci.org/schaermu/node-fluent-ffmpeg.png)](http://travis-ci.org/schaermu/node-fluent-ffmpeg)
This library abstracts the complex command-line usage of ffmpeg into a fluent, easy to use node.js module. In order to be able to use this module, make sure you have [ffmpeg](http://www.ffmpeg.org) installed on your system (including all necessary encoding libraries like libmp3lame or libx264).

Now including input streaming support (means you can convert **on-the-fly** using an input- and an outputstream)!

### Sorry for the long period of inactivity, i had to settle some private stuff! Now back in full effect :)

## Installation
Via npm:
`$ npm install fluent-ffmpeg`

Or as a submodule:
`$ git submodule add git://github.com/schaermu/node-fluent-ffmpeg.git vendor/fluent-ffmpeg`
## Tests
To run unit tests, make sure have mocha installed on your system (registered as devDependency in npm config).

`$ make test`

For constant checking your test install grunt globally (`npm uninstall -g grunt && npm install -g grunt-cli && npm install grunt`)

If you want to re-generate the test coverage report (filed under test/coverage.html), run

`$ make test-cov`

Make sure your ffmpeg installation is up-to-date to prevent strange assertion errors because of missing codecs/bugfixes.
## Usage
You find a lot of usage examples (including a real-time streaming example using [flowplayer](http://www.flowplayer.org) and [express](https://github.com/visionmedia/express)!) in the `examples` folder.
## Basics
fluent-ffmpeg is always initialized using the returned class of your initial (and only) require call. You have to supply an config object to the constructor containing at least the input source (either a ReadableStream or a filepath).

    var ffmpeg = require('fluent-ffmpeg');

    var proc = new ffmpeg({
      // input source, required
      source: '/path/to/your_movie.avi',
      // timout of the spawned ffmpeg sub-processes in seconds (optional, defaults to 30)
      timeout: 30,
      // default priority for all ffmpeg sub-processes (optional, defaults to 0 which is no priorization)
      priority: 0,
      // set a custom [winston](https://github.com/flatiron/winston) logging instance (optional, default null which will cause fluent-ffmpeg to spawn a winston console logger)
      logger: null,
      // completely disable logging (optional, defaults to false)
      nolog: false
    });

### Auto-calculation of video dimensions
Since ffmpeg does not support dynamic sizing of your movies, fluent-ffmpeg can do this job for you (using it's internal metadata-discovery). The following size formats are allowed to be passed to `withSize`:

  * `320x?` - Fixed width, calculate height
  * `?x240` - Fixed height, calculate width
  * `50%` - percental resizing
  * `320x240` - fixed size (plain ffmpeg way)

### Auto-padding when converting aspect ratio
Using fluent-ffmpeg, you can auto-pad any video output when converting the aspect ratio. When converting from 4:3 to 16:9, padding is added to the left/right, when converting from 16:9 to 4:3, padding is added to top/bottom.

    var ffmpeg = require('fluent-ffmpeg');

    var proc = new ffmpeg({ source: '/path/to/your_movie.avi' })
      .withAspect('4:3')
      .withSize('640x480')
      .applyAutopadding(true, 'white')
      .saveToFile('/path/to/your_target.avi', function(stdout, stderr) {
        console.log('file has been converted succesfully');
      });
This command will auto-pad your 4:3 output video stream using a white background-color (default is black).

### Simple conversion using preset
This example loads up a predefined preset in the preset folder (currently, fluent-ffmpeg ships with presets for DIVX, Flashvideo and Podcast conversions)

    var ffmpeg = require('fluent-ffmpeg');

    var proc = new ffmpeg({ source: '/path/to/your_movie.avi' })
      .usingPreset('podcast')
      .saveToFile('/path/to/your_target.m4v', function(stdout, stderr) {
        console.log('file has been converted succesfully');
      });
### Conversion using chainable API
Using the chainable API, you are able to perform any operation using FFMPEG. the most common options are implemented using methods, for more advanced usages you can still use the `addOption(s)` method group.

    var ffmpeg = require('fluent-ffmpeg');
    
    var proc = new ffmpeg({ source: '/path/to/your_movie.avi' })
      .withVideoBitrate(1024)
      .withVideoCodec('divx')
      .withAspect('16:9')
      .withFps(24)
      .withAudioBitrate('128k')
      .withAudioCodec('libmp3lame')
      .withAudioChannels(2)
      .addOption('-vtag', 'DIVX')
      .toFormat('avi')
      .saveToFile('/path/to/your_target.avi', function(stdout, stderr) {
        console.log('file has been converted succesfully');
      });
### Creating thumbnails from a video file
One pretty neat feature is the ability of fluent-ffmpeg to generate any amount of thumbnails from your movies. The screenshots are taken at automatically determined timemarks using the following formula: `(duration_in_sec * 0.9) / number_of_thumbnails`.

    var ffmpeg = require('fluent-ffmpeg');
    
    var proc = new ffmpeg({ source: '/path/to/your_movie.avi' })
      .withSize('150x100')
      .takeScreenshots(5, '/path/to/thumbnail/folder', function(err, filenames) {
        if(err){
          throw err;
        }
        console.log(filenames);
        console.log('screenshots were saved');
      });

For more control, you can also set the timemarks for taking screenshots yourself. Timemarks are percent `50%` or otherwise seconds.

    var ffmpeg = require('fluent-ffmpeg');
    
    var proc = new ffmpeg({ source: '/path/to/your_movie.avi' })
      .withSize('150x100')
      .takeScreenshots({
          count: 2,
          timemarks: [ '0.5', '1' ]
        }, '/path/to/thumbnail/folder', function(err, filenames) {
          console.log(filenames);
          console.log('screenshots were saved');
      });
      
You can set the screenshots filename dynamically using following format characters:

* `%s` - offset in seconds
* `%w` - screenshot width
* `%h` - screenshot height
* `%r` - screenshot resolution ( widthxheight )
* `%f` - input filename
* `%b` - input basename ( filename w/o extension ) 
* `%i` - number of screenshot in timemark array ( can be zeropadded by using it like `%000i` )  

If multiple timemarks are given and no `%i` format character is found in filename `_%i` will be added to the end of the given filename.

    var ffmpeg = require('fluent-ffmpeg');

    var proc = new ffmpeg({ source: '/path/to/your_movie.avi' })
      .withSize('150x100')
      .takeScreenshots({
          count: 2,
          timemarks: [ '50%', '75%' ],
          filename: '%b_screenshot_%w_%i'
        }, '/path/to/thumbnail/folder', function(err, filenames) {
          console.log(filenames);
          console.log('screenshots were saved');
      });

### Reading video metadata
Using a seperate object, you are able to access various metadata of your video file.

    var Metalib = require('fluent-ffmpeg').Metadata;

    // make sure you set the correct path to your video file
    var metaObject = new Metalib('/path/to/your_movie.avi');
    metaObject.get(function(metadata, err) {
      console.log(require('util').inspect(metadata, false, null));
    });

### Reading Codec information while processing
Using the notification callback onCodecData, you can get informations about the input file's codecs being processed:

    var ffmpeg = require('fluent-ffmpeg');

    var proc = new ffmpeg({ source: '/path/to/your_movie.avi' })
      .withAspect('4:3')
      .withSize('640x480')
      .onCodecData(function(codecinfo) {
        console.log(codecinfo);
      })
      .saveToFile('/path/to/your_target.avi', function(stdout, stderr) {
        console.log('file has been converted succesfully');
      });

### Getting progress notification
You can set the call back onProgress if you want to be notified on every progress update (triggered as fast as it's written out by FFMPEG).

    var proc = new ffmpeg({ source: '/path/to/your_movie.avi' })
      .withAspect('4:3')
      .withSize('640x480')
      .onProgress(function(progress) {
        console.log(progress);
      })
      .saveToFile('/path/to/your_target.avi', function(stdout, stderr) {
        console.log('file has been converted succesfully');
      });

The progress object consists of 6 properties:

  * `frames` - the total processed frame count
  * `currentFps` - the framerate at which FFMPEG is currently processing the file
  * `currentKbps` - the throughput at which FFMPEG is currently processing the file
  * `targetSize` - the current size of the target file
  * `timemark` - the timestamp of the frame being processed right now
  * `percent` - an estimation on the progress (metadata is used, durationsec * fps)

### Additional Inputs
In case you need to add, for instance, and audio track

    var ffmpeg = require('fluent-ffmpeg');

    var proc = new ffmpeg({ source: 'images/frame%05d.png' })
      .addInput('soundtrack.mp3')
      .saveToFile('/path/to/your_target.avi', function(stdout, stderr) {
        console.log('file has been created with soundtrack succesfully');
      });

### Concatenating Inputs
To append a video to the end of another

    var ffmpeg = require('fluent-ffmpeg');
    var proc = new ffmpeg({source: "title.mp4"})
        .mergeAdd("source.mp4")
        .mergeToFile("out.mp4", "myTempFolder/", function(){
            console.log('files has been merged succesfully');
         });

### Creating a custom preset
To create a custom preset, you have to create a new file inside the `lib/presets` folder. The filename is used as the preset's name ([presetname].js). In order to make the preset work, you have to export a `load` function using the CommonJS module specifications:

    exports.load = function(ffmpeg) {
      // your custom preset code
    }

The `ffmpeg` parameter is a full fluent-ffmpeg object, you can use all the chaining-goodness from here on. For a good example for the possibilities using presets, check out `lib/presets/podcast.js`.


### Setting custom child process niceness
You can adjust the scheduling priority of the child process used by ffmpeg, using renice (http://manpages.ubuntu.com/manpages/intrepid/man1/renice.1.html):

    var ffmpeg = require('fluent-ffmpeg');
    
    var proc = new ffmpeg({ source: './source.mp3', priority: 10 })
      .withAudioCodec('libvorbis')
      .toFormat('ogg')
      .saveToFile('./target.ogg', function(stdout, stderr) {
        console.log('file has been converted succesfully');
      });

Which will use a niceness of 10 (thus it has a lower scheduling priority than the node process and other processes, which default to a niceness of 0).

### Setting an optional processing timeout
If you want to know for sure that the ffmpeg child process will not run for longer than a certain amount of time, you can optionally pass the key 'timeout' into the constructor of the ffmpeg command object. An example of a process that will return an error string of 'timeout' if ffmpeg did not finish within 10 minutes:

    var ffmpeg = require('fluent-ffmpeg');
    
    var proc = new ffmpeg({ source: './source.mp3', timeout: 10 * 60 })
      .withAudioCodec('libvorbis')
      .toFormat('ogg')
      .saveToFile('./target.ogg', function(stdout, stderr) {
        if (retcode == ffmpeg.E_PROCESSTIMEOUT) {
          console.log('ffmpeg terminated because of timeout');
        }
      });

## Contributors
* [enobrev](http://github.com/enobrev)
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
