import test from 'ava'
import sinon from 'sinon'

import { FfmpegOutput } from '../../src/output'
import * as formattingModule from '../../src/utils/formatting'
import { FakeWritableStream } from '../helpers/streams'

const stream = new FakeWritableStream()

test('FfmpegOutput from OutputOptions', (t) => {
  let output = new FfmpegOutput({
    target: 'path/to/file.mp4'
  })

  t.deepEqual(output.getFfmpegArguments(), ['path/to/file.mp4'], 'output only')

  output = new FfmpegOutput({
    target: 'output',
    map: 'stream'
  })

  t.deepEqual(
    output.getFfmpegArguments(),
    ['-map', '[stream]', 'output'],
    'map without brackets'
  )

  output = new FfmpegOutput({
    target: 'output',
    map: '[stream]'
  })

  t.deepEqual(
    output.getFfmpegArguments(),
    ['-map', '[stream]', 'output'],
    'map with brackets'
  )

  output = new FfmpegOutput({
    target: stream,
    format: 'mp4'
  })

  t.deepEqual(
    output.getFfmpegArguments(),
    ['-f', 'mp4', 'pipe:1'],
    'stream output'
  )

  output = new FfmpegOutput({
    target: 'path/to/file.mp4',
    format: 'some-format',
    duration: 123,
    seek: 456
  })

  t.deepEqual(
    output.getFfmpegArguments(),
    ['-ss', '456', '-t', '123', '-f', 'some-format', 'path/to/file.mp4'],
    'complete test'
  )
})

test('FfmpegOutput audio options', (t) => {
  let output = new FfmpegOutput({
    target: 'path/to/output',
    audio: false
  })

  t.deepEqual(
    output.getFfmpegArguments(),
    ['-an', 'path/to/output'],
    'no audio'
  )

  output = new FfmpegOutput({
    target: 'path/to/output',
    audio: {
      codec: 'mp3',
      bitrate: '128k',
      channels: 2,
      frequency: 44100,
      quality: 8
    }
  })

  t.deepEqual(
    output.getFfmpegArguments(),
    [
      '-acodec',
      'mp3',
      '-b:a',
      '128k',
      '-ac',
      '2',
      '-ar',
      '44100',
      '-aq',
      '8',
      'path/to/output'
    ],
    'complete test'
  )
})

test.serial('FfmpegOutput audio filters', (t) => {
  let filterStub = sinon
    .stub(formattingModule, 'formatFilters')
    .returns(['filter-output-1', 'filter-output-2'])

  t.teardown(() => filterStub.restore())

  let output = new FfmpegOutput({
    target: 'path/to/output',
    audio: {
      filter: 'single-filter'
    }
  })

  t.deepEqual(
    output.getFfmpegArguments(),
    ['-filter:a', 'filter-output-1,filter-output-2', 'path/to/output'],
    'formatFilter output insertion'
  )

  t.true(
    filterStub.calledOnceWith(['single-filter']),
    'formatFilter call with single filter'
  )

  filterStub.resetHistory()

  output = new FfmpegOutput({
    target: 'path/to/output',
    audio: {
      filters: ['filter-1', 'filter-2']
    }
  })

  t.deepEqual(
    output.getFfmpegArguments(),
    ['-filter:a', 'filter-output-1,filter-output-2', 'path/to/output'],
    'formatFilter output insertion'
  )

  t.true(
    filterStub.calledOnceWith(['filter-1', 'filter-2']),
    'formatFilter call with multiple filters'
  )

  t.throws(
    () =>
      new FfmpegOutput({
        target: 'path/to/output',
        audio: {
          filter: 'foo',
          filters: ['bar']
        }
      }),
    { message: "Cannot specify both audio 'filter' and 'filters'" }
  )
})

test('FfmpegOutput video options', (t) => {
  let output = new FfmpegOutput({
    target: 'path/to/output',
    video: false
  })

  t.deepEqual(
    output.getFfmpegArguments(),
    ['-vn', 'path/to/output'],
    'no video'
  )

  output = new FfmpegOutput({
    target: 'path/to/output',
    video: {
      bitrate: '1M',
      constantBitrate: true
    }
  })

  t.deepEqual(
    output.getFfmpegArguments(),
    [
      '-b:v',
      '1M',
      '-minrate',
      '1M',
      '-maxrate',
      '1M',
      '-bufsize',
      '1M',
      'path/to/output'
    ],
    'constant bitrate'
  )

  output = new FfmpegOutput({
    target: 'path/to/output',
    video: {
      codec: 'h264',
      bitrate: '1024k',
      fps: 25,
      frames: 3100
    }
  })

  t.deepEqual(
    output.getFfmpegArguments(),
    [
      '-vcodec',
      'h264',
      '-b:v',
      '1024k',
      '-r',
      '25',
      '-vframes',
      '3100',
      'path/to/output'
    ],
    'complete test'
  )
})

test.serial('FfmpegOutput video filters', (t) => {
  let filterStub = sinon
    .stub(formattingModule, 'formatFilters')
    .returns(['filter-output-1', 'filter-output-2'])

  t.teardown(() => filterStub.restore())

  let output = new FfmpegOutput({
    target: 'path/to/output',
    video: {
      filter: 'single-filter'
    }
  })

  t.deepEqual(
    output.getFfmpegArguments(),
    ['-filter:v', 'filter-output-1,filter-output-2', 'path/to/output'],
    'formatFilter output insertion'
  )

  t.true(
    filterStub.calledOnceWith(['single-filter']),
    'formatFilter call with single filter'
  )

  filterStub.resetHistory()

  output = new FfmpegOutput({
    target: 'path/to/output',
    video: {
      filters: ['filter-1', 'filter-2']
    }
  })

  t.deepEqual(
    output.getFfmpegArguments(),
    ['-filter:v', 'filter-output-1,filter-output-2', 'path/to/output'],
    'formatFilter output insertion'
  )

  t.true(
    filterStub.calledOnceWith(['filter-1', 'filter-2']),
    'formatFilter call with multiple filters'
  )

  t.throws(
    () =>
      new FfmpegOutput({
        target: 'path/to/output',
        video: {
          filter: 'foo',
          filters: ['bar']
        }
      }),
    { message: "Cannot specify both video 'filter' and 'filters'" }
  )
})

test('FfmpegOutput from output', (t) => {
  let output = new FfmpegOutput('path/to/file.mp4')

  t.deepEqual(output.getFfmpegArguments(), ['path/to/file.mp4'])
})

test('FfmpegOutput type getters', (t) => {
  let output = new FfmpegOutput('path/to/file.mp4')

  t.true(output.isLocalFile)
  t.false(output.isStream)

  output = new FfmpegOutput({ target: 'path/to/file.mp4' })

  t.true(output.isLocalFile)
  t.false(output.isStream)

  output = new FfmpegOutput('file:///path/to/file.mp4')

  t.true(output.isLocalFile)
  t.false(output.isStream)

  output = new FfmpegOutput({ target: 'file:///path/to/file.mp4' })

  t.true(output.isLocalFile)
  t.false(output.isStream)

  output = new FfmpegOutput('https://example.com/file.mp4')

  t.false(output.isLocalFile)
  t.false(output.isStream)

  output = new FfmpegOutput({ target: 'https://example.com/file.mp4' })

  t.false(output.isLocalFile)
  t.false(output.isStream)

  output = new FfmpegOutput(stream)

  t.false(output.isLocalFile)
  t.true(output.isStream)

  output = new FfmpegOutput({ target: stream })

  t.false(output.isLocalFile)
  t.true(output.isStream)
})
