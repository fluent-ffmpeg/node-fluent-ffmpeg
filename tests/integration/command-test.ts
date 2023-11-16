import test from 'ava'

import { FfmpegCommand } from '../../src/command'
import { FakeReadableStream } from '../helpers/streams'

const rstream = new FakeReadableStream()

test('FfmpegCommand with input string', (t) => {
  let command = new FfmpegCommand({ input: 'path/to/input' })

  t.deepEqual(command.getFfmpegArguments(), ['-i', 'path/to/input'])
})

test('FfmpegCommand with input stream', (t) => {
  let command = new FfmpegCommand({ input: rstream })

  t.deepEqual(command.getFfmpegArguments(), ['-i', 'pipe:0'])
})

test('FfmpegCommand with multiple inputs', (t) => {
  let command = new FfmpegCommand({
    inputs: ['path/to/input1', 'path/to/input2', rstream]
  })

  t.deepEqual(command.getFfmpegArguments(), [
    '-i',
    'path/to/input1',
    '-i',
    'path/to/input2',
    '-i',
    'pipe:0'
  ])
})

test('FfmpegCommand fails with input and inputs', (t) => {
  t.throws(
    () =>
      new FfmpegCommand({
        input: 'path/to/input1',
        inputs: ['/path/to/input2']
      }),
    { message: "Cannot specify both 'input' and 'inputs'" }
  )
})

test('FfmpegCommand fails with multiple input streams', (t) => {
  t.throws(
    () =>
      new FfmpegCommand({
        inputs: [rstream, rstream]
      }),
    { message: 'At most one stream input is supported' }
  )
})
