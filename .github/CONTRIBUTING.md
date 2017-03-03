# How to contribute

## Reporting issues

Please start by [reading the FAQ][faq] first.  If your question is not answered, here are some guidelines on how to effectively report issues.

### Required information

When reporting issues be sure to include at least:

* Some code that may be used to reproduce the problem
* Which version of fluent-ffmpeg, of ffmpeg and which OS you're using
* If the problem only happens with some input sources, please include a link to a source that may be used to reproduce the problem
* Be sure to include the full error message when there is one
* When an ffmpeg error happens (eg. 'ffmpeg exited with code 1'), you should also include the full output from ffmpeg (stdout and stderr), as it may contain useful information about what whent wrong.  You can do that by looking at the 2nd and 3rd parameters of the `error` event handler on an FfmpegCommand,  for example:

```js
ffmpeg('some/input.mp4')
  .on('error', function(err, stdout, stderr) {
    console.log('An error happened: ' + err.message);
    console.log('ffmpeg standard output:\n' + stdout);
    console.log('ffmpeg standard error:\n' + stderr);
  });
```

### Ffmpeg usage

If your command ends up with an ffmpeg error (eg. 'ffmpeg exited with code X : ...'), be sure to try the command manually from command line.  You can get the ffmpeg command line that is executed for a specific Fluent-ffmpeg command by using the `start` event:

```js
ffmpeg('some/input.mp4')
  .on('start', function(cmdline) {
    console.log('Command line: ' + cmdline);
  })
  ...
```

If it does not work, you most likely have a ffmpeg-related problem that does not fit as a fluent-ffmpeg issue; in that case head to the [ffmpeg documentation](ffmpeg.org/documentation.html) to find out what you did wrong.

If it _does_ work, please double-check how you escaped arguments and options when passing them to fluent-ffmpeg.  For example, when running from command line, you may have to quote arguments to tell your shell that a space is indeed part of a filename or option.  When using fluent-ffmpeg, you don't have to do that, as you're already passing options and arguments separately.  Here's a (dumb) example:

```sh
$ ffmpeg -i video with spaces.avi
Cannot find "video", or unknown option "with", etc...
$ ffmpeg -i "video with spaces.avi"
Works
```

```js
// Works
ffmpeg('video with spaces.avi')...;

// Fails, looks for a file with actual double quotes in its name
ffmpeg('"video with spaces.avi"')...;
```

[faq]: https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/wiki/FAQ
