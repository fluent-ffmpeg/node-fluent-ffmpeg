import test from 'ava'

import { FfmpegProcess } from '../../src/process'
import {
  InputCodecInformation,
  ProgressInformation
} from '../../src/utils/data-types'

import { stubSpawn } from '../helpers/spawn-stub'
import { delay } from '../helpers/async'

test.serial('FfmpegProcess.run() resolves with stderr', async (t) => {
  stubSpawn(t, async (p) => {
    p.stderr.emit('data', 'err line 1\nerr line 2\nerr li')
    p.stdout.emit('data', 'out line 1\nout line 2\nout li')
    await delay()
    p.stderr.emit('data', 'ne 3\nerr line 4')
    p.stdout.emit('data', 'ne 3\nout line 4')
    await delay()
    p.emit('close')
  })

  let { stderr, stdout } = await new FfmpegProcess({ args: [] }).run()

  t.is(stdout, '', 'stdout is not captured')
  t.is(
    stderr,
    'err line 1\nerr line 2\nerr line 3\nerr line 4',
    'stderr lines assembled'
  )
})

test.serial(
  'FfmpegProcess.run() passes stderr lines to onStderr',
  async (t) => {
    stubSpawn(t, async (p) => {
      p.stderr.emit('data', 'err line 1\nerr line 2\nerr li')
      await delay()
      p.stderr.emit('data', 'ne 3\nerr line 4')
      await delay()
      p.emit('close')
    })

    let lines: string[] = []

    await new FfmpegProcess({
      args: [],
      onStderr: (line) => lines.push(line)
    }).run()

    t.deepEqual(lines, ['err line 1', 'err line 2', 'err line 3', 'err line 4'])
  }
)

test.serial('FfmpegProcess.run() reports progress to onProgress', async (t) => {
  stubSpawn(t, async (p) => {
    let lines = [
      'not a progress line',
      'frame= 12 fps= 34 bitrate= 56kbits/s time=00:11:22.33 speed=90x',
      'not a progress line',
      'frame= 13 fps= 34 bitrate= 196kbits/s Lsize= 118kB time=00:33:22.11 speed=9.4x',
      'not a progress line'
    ]

    for (let line of lines) {
      p.stderr.emit('data', `${line}\n`)
      delay()
    }

    p.emit('close')
  })

  let progress: ProgressInformation[] = []

  await new FfmpegProcess({
    args: [],
    onProgress: (p) => progress.push(p)
  }).run()

  t.deepEqual(progress, [
    {
      frame: 12,
      fps: 34,
      bitrate: 56,
      time: '00:11:22.33',
      speed: 90
    },
    {
      frame: 13,
      fps: 34,
      bitrate: 196,
      size: 118,
      time: '00:33:22.11',
      speed: 9.4
    }
  ])
})

test.serial(
  'FfmpegProcess.run() reports codec data to onCodecData',
  async (t) => {
    stubSpawn(t, async (p) => {
      let lines = [
        '[mpegts @ 0x557a964d3f80] DTS 6603 < 12609 out of order',
        "Input #0, mpegts, from 'path/to/input':",
        '  Duration: 00:01:06.40, start: 0.040000, bitrate: 584 kb/s',
        '  Program 1',
        '  Stream #0:0[0x3e9]: Audio: mp2, 44100 Hz, stereo, fltp, 64 kb/s',
        '  Stream #0:1[0x3ea]: Video: h264, yuv420p(progressive), 352x240 [SAR 1:1 DAR 22:15], 14.99 fps, 29.97 tbr, 90k tbn',
        'Stream mapping:',
        '  Stream #0:1 -> #0:0 (h264 (native) -> h264 (libx264))',
        '  Stream #0:0 -> #0:1 (mp2 (native) -> aac (native))',
        "Output #0, mp4, to 'path/to/output':",
        'Press [q] to stop, [?] for help'
      ]

      for (let line of lines) {
        p.stderr.emit('data', `${line}\n`)
        delay()
      }

      p.emit('close')
    })

    let codecData: InputCodecInformation | null = null

    await new FfmpegProcess({
      args: [],
      onCodecData: (c) => (codecData = c)
    }).run()

    t.deepEqual(codecData, [
      {
        audio: 'mp2',
        audioDetails: 'mp2, 44100 Hz, stereo, fltp, 64 kb/s',
        duration: '00:01:06.40',
        format: 'mpegts',
        video: 'h264',
        videoDetails:
          'h264, yuv420p(progressive), 352x240 [SAR 1:1 DAR 22:15], 14.99 fps, 29.97 tbr, 90k tbn'
      }
    ])
  }
)

test.serial(
  'FfmpegProcess.run() resolves with stdout when captureStdout=true',
  async (t) => {
    stubSpawn(t, async (p) => {
      p.stderr.emit('data', 'err line 1\nerr line 2\nerr li')
      p.stdout.emit('data', 'out line 1\nout line 2\nout li')
      await delay()
      p.stderr.emit('data', 'ne 3\nerr line 4')
      p.stdout.emit('data', 'ne 3\nout line 4')
      await delay()
      p.emit('close')
    })

    let { stderr, stdout } = await new FfmpegProcess({
      args: [],
      captureStdout: true
    }).run()

    t.is(
      stdout,
      'out line 1\nout line 2\nout line 3\nout line 4',
      'stdout lines assembled'
    )
    t.is(
      stderr,
      'err line 1\nerr line 2\nerr line 3\nerr line 4',
      'stderr lines assembled'
    )
  }
)
