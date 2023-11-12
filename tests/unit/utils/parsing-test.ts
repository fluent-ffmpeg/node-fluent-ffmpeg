import test from 'ava'

import {
  CodecDataExtractor,
  extractErrorMessage,
  extractProgress
} from '../../../src/utils/parsing'
import { InputCodecInformation } from '../../../src/utils/data-types'

test('extractErrorMessage', (t) => {
  let lines = [
    '[ square bracket',
    '  spaces',
    'matching line 1',
    'matching line 2',
    '[ square bracket',
    'matching line 3',
    'matching line 4'
  ]

  t.is(extractErrorMessage(lines), 'matching line 3\nmatching line 4')
})

test('extractProgress', (t) => {
  t.is(extractProgress('not a real progress line'), undefined)

  t.deepEqual(
    extractProgress(
      'frame=    12 fps=   34 bitrate=   56kbits/s Lsize=     78kB time=00:11:22.33 speed=90.1x  '
    ),
    {
      frame: 12,
      fps: 34,
      bitrate: 56,
      size: 78,
      time: '00:11:22.33',
      speed: 90.1
    }
  )
})

test('CodecDataExtractor', async (t) => {
  let result: InputCodecInformation = await new Promise((resolve) => {
    let extractor = new CodecDataExtractor(resolve)

    let lines = [
      '[mpegts @ 0x557a964d3f80] DTS 6603 < 12609 out of order',
      "Input #0, mpegts, from 'path/to/input':",
      '  Duration: 00:01:06.40, start: 0.040000, bitrate: 584 kb/s',
      '  Program 1',
      '  Stream #0:0[0x3e9]: Audio: mp2 ([3][0][0][0] / 0x0003), 44100 Hz, stereo, fltp, 64 kb/s',
      '  Stream #0:1[0x3ea]: Video: h264 (Main) ([27][0][0][0] / 0x001B), yuv420p(progressive), 352x240 [SAR 1:1 DAR 22:15], 14.99 fps, 29.97 tbr, 90k tbn',
      'Stream mapping:',
      '  Stream #0:1 -> #0:0 (h264 (native) -> h264 (libx264))',
      '  Stream #0:0 -> #0:1 (mp2 (native) -> aac (native))',
      "Output #0, mp4, to 'path/to/output':",
      'Press [q] to stop, [?] for help'
    ]

    for (let line of lines) {
      extractor.processLine(line)
    }
  })

  t.deepEqual(result, [
    {
      audio: 'mp2 ([3][0][0][0] / 0x0003)',
      audioDetails:
        'mp2 ([3][0][0][0] / 0x0003), 44100 Hz, stereo, fltp, 64 kb/s',
      duration: '00:01:06.40',
      format: 'mpegts',
      video: 'h264 (Main) ([27][0][0][0] / 0x001B)',
      videoDetails:
        'h264 (Main) ([27][0][0][0] / 0x001B), yuv420p(progressive), 352x240 [SAR 1:1 DAR 22:15], 14.99 fps, 29.97 tbr, 90k tbn'
    }
  ])
})
