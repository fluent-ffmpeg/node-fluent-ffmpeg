import test from 'ava'

import { FfmpegInput } from '../../src/input'
import { FakeReadableStream } from '../helpers/streams'

const stream = new FakeReadableStream()

test('FfmpegInput from InputOptions with source only', (t) => {
  let input = new FfmpegInput({
    source: 'path/to/file.mp4'
  })

  t.deepEqual(
    input.getFfmpegArguments(),
    ['-i', 'path/to/file.mp4'],
    'source only'
  )
})

test('FfmpegInput from InputOptions with native FPS', (t) => {
  let input = new FfmpegInput({
    source: 'source',
    fps: 'native'
  })

  t.deepEqual(input.getFfmpegArguments(), ['-re', '-i', 'source'], 'native fps')
})

test('FfmpegInput from InputOptions with numeric FPS', (t) => {
  let input = new FfmpegInput({
    source: 'source',
    fps: 123
  })

  t.deepEqual(
    input.getFfmpegArguments(),
    ['-r', '123', '-i', 'source'],
    'numeric fps'
  )
})

test('FfmpegInput from InputOptions with stream source', (t) => {
  let input = new FfmpegInput({
    source: stream,
    format: 'markdown'
  })

  t.deepEqual(input.getFfmpegArguments(), ['-f', 'markdown', '-i', 'pipe:0'])
})

test('FfmpegInput from InputOptions with all options', (t) => {
  let input = new FfmpegInput({
    source: 'path/to/file.mp4',
    format: 'some-format',
    fps: 123,
    seek: 456,
    loop: true
  })

  t.deepEqual(
    input.getFfmpegArguments(),
    [
      '-f',
      'some-format',
      '-r',
      '123',
      '-ss',
      '456',
      '-loop',
      '1',
      '-i',
      'path/to/file.mp4'
    ],
    'complete test'
  )
})

test('FfmpegInput from source path', (t) => {
  let input = new FfmpegInput('path/to/file.mp4')

  t.deepEqual(input.getFfmpegArguments(), ['-i', 'path/to/file.mp4'])
})

test('FfmpegInput type getters with path', (t) => {
  let input = new FfmpegInput('path/to/file.mp4')

  t.true(input.isLocalFile)
  t.false(input.isStream)
})

test('FfmpegInput type getters with path in InputOptions', (t) => {
  let input = new FfmpegInput({ source: 'path/to/file.mp4' })

  t.true(input.isLocalFile)
  t.false(input.isStream)
})

test('FfmpegInput type getters with file URL', (t) => {
  let input = new FfmpegInput('file:///path/to/file.mp4')

  t.true(input.isLocalFile)
  t.false(input.isStream)
})

test('FfmpegInput type getters with file URL in InputOptions', (t) => {
  let input = new FfmpegInput({ source: 'file:///path/to/file.mp4' })

  t.true(input.isLocalFile)
  t.false(input.isStream)
})

test('FfmpegInput type getters with URL', (t) => {
  let input = new FfmpegInput('https://example.com/file.mp4')

  t.false(input.isLocalFile)
  t.false(input.isStream)
})

test('FfmpegInput type getters with URL in InputOptions', (t) => {
  let input = new FfmpegInput({ source: 'https://example.com/file.mp4' })

  t.false(input.isLocalFile)
  t.false(input.isStream)
})

test('FfmpegInput type getters with stream', (t) => {
  let input = new FfmpegInput(stream)

  t.false(input.isLocalFile)
  t.true(input.isStream)
})

test('FfmpegInput type getters with stream in InputOptions', (t) => {
  let input = new FfmpegInput({ source: stream })

  t.false(input.isLocalFile)
  t.true(input.isStream)
})
