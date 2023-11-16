# ffmpeg wrapper for Node.js

[![Coverage Status](https://coveralls.io/repos/github/fluent-ffmpeg/node-fluent-ffmpeg/badge.svg?branch=master)](https://coveralls.io/github/fluent-ffmpeg/node-fluent-ffmpeg?branch=master)

fluent-ffmpeg is a zero-dependency wrapper for [ffmpeg][ffmpeg] that aims at simplifying its usage with Node.js.

> **fluent-ffmpeg is looking for new maintainers**
> More details [on the wiki](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/wiki/Looking-for-a-new-maintainer)

## Links

- [Documentation][doc]
- [Issue tracker][issues]

## Prerequisites

Make sure `ffmpeg` is installed. You can set the `FFMPEG_PATH` environment variable if it is not in your `PATH`.

## Installation

```sh
$ npm install fluent-ffmpeg
```

## Usage

Note: this is the documentation for fluent-ffmpeg version 3. The API was completely rewritten. If you want to migrate from fluent-ffmpeg version 2, you will have to completely rewrite your calls.

### Basic usage

```js
import ffmpeg from 'fluent-ffmpeg'

async function convertVideo() {
  try {
    await ffmpeg({
      input: 'path/to/input.avi',
      output: 'path/to/output.mp4'
    }).run()

    console.log('Done')
  } catch (e) {
    console.log('Error:', e)
  }
}
```

[doc]: https://fluent-ffmpeg.github.io
[ffmpeg]: https://www.ffmpeg.org/
[issues]: https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues
