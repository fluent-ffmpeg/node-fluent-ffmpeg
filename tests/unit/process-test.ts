import test from 'ava'
import sinon from 'sinon'

import { FfmpegProcess } from '../../src/process'
import * as parsingModule from '../../src/utils/parsing'

import { stubSpawn } from '../helpers/spawn-stub'

test.serial('FfmpegProcess.run() spawn call', async (t) => {
  let spawnStub = stubSpawn(t, (p) => p.emit('close'))

  await new FfmpegProcess({ args: ['arg1', 'arg2'] }).run()

  t.true(spawnStub.calledOnce)
  t.deepEqual(spawnStub.firstCall.args, [
    'ffmpeg',
    ['arg1', 'arg2'],
    {
      cwd: undefined,
      timeout: undefined,
      windowsHide: true
    }
  ])
})

test.serial('FfmpegProcess.run() spawn call with nice', async (t) => {
  let spawnStub = stubSpawn(t, (p) => p.emit('close'))

  await new FfmpegProcess({ nice: 3, args: ['arg1', 'arg2'] }).run()

  t.true(spawnStub.calledOnce)
  t.deepEqual(spawnStub.firstCall.args, [
    'nice',
    ['-n', '3', 'ffmpeg', 'arg1', 'arg2'],
    {
      cwd: undefined,
      timeout: undefined,
      windowsHide: true
    }
  ])
})

test.serial('FfmpegProcess.run() spawn call with cwd', async (t) => {
  let spawnStub = stubSpawn(t, (p) => p.emit('close'))

  await new FfmpegProcess({ cwd: '/path/to/dir', args: ['arg1', 'arg2'] }).run()

  t.true(spawnStub.calledOnce)
  t.deepEqual(spawnStub.firstCall.args, [
    'ffmpeg',
    ['arg1', 'arg2'],
    {
      cwd: '/path/to/dir',
      timeout: undefined,
      windowsHide: true
    }
  ])
})

test.serial('FfmpegProcess.run() spawn call with timeout', async (t) => {
  let spawnStub = stubSpawn(t, (p) => p.emit('close'))

  await new FfmpegProcess({ timeout: 12345, args: ['arg1', 'arg2'] }).run()

  t.true(spawnStub.calledOnce)
  t.deepEqual(spawnStub.firstCall.args, [
    'ffmpeg',
    ['arg1', 'arg2'],
    {
      cwd: undefined,
      timeout: 12345,
      windowsHide: true
    }
  ])
})

test.serial('FfmpegProcess.run() spawn call with FFMPEG_PATH', async (t) => {
  let spawnStub = stubSpawn(t, (p) => p.emit('close'))

  process.env.FFMPEG_PATH = '/path/to/ffmpeg'

  t.teardown(() => {
    spawnStub.restore()
    delete process.env.FFMPEG_PATH
  })

  await new FfmpegProcess({ cwd: '/path/to/dir', args: ['arg1', 'arg2'] }).run()

  t.true(spawnStub.calledOnce)
  t.deepEqual(spawnStub.firstCall.args, [
    '/path/to/ffmpeg',
    ['arg1', 'arg2'],
    {
      cwd: '/path/to/dir',
      timeout: undefined,
      windowsHide: true
    }
  ])
})

test.serial('FfmpegProcess.run() rejects with spawn error', async (t) => {
  stubSpawn(t, (p) => p.emit('error', new Error('spawn error')))

  let promise = new FfmpegProcess({ args: ['arg1', 'arg2'] }).run()

  await t.throwsAsync(promise, { message: 'spawn error' })
})

test.serial('FfmpegProcess.run() rejects with signal', async (t) => {
  stubSpawn(t, (p) => p.emit('close', null, 9))

  let promise = new FfmpegProcess({ args: ['arg1', 'arg2'] }).run()

  await t.throwsAsync(promise, { message: 'ffmpeg was killed with signal 9' })
})

test.serial('FfmpegProcess.run() rejects with exit code', async (t) => {
  stubSpawn(t, (p) => p.emit('close', 123))

  let extractErrorStub = sinon
    .stub(parsingModule, 'extractErrorMessage')
    .returns('')

  t.teardown(() => {
    extractErrorStub.restore()
  })

  let promise = new FfmpegProcess({ args: ['arg1', 'arg2'] }).run()

  await t.throwsAsync(promise, { message: 'ffmpeg exited with code 123' })
})

test.serial(
  'FfmpegProcess.run() rejects with exit code and error message',
  async (t) => {
    stubSpawn(t, (p) => p.emit('close', 123))

    let extractErrorStub = sinon
      .stub(parsingModule, 'extractErrorMessage')
      .returns('error line 1\nerror line 2')

    t.teardown(() => {
      extractErrorStub.restore()
    })

    let promise = new FfmpegProcess({ args: ['arg1', 'arg2'] }).run()

    await t.throwsAsync(promise, {
      message: 'ffmpeg exited with code 123:\nerror line 1\nerror line 2'
    })
  }
)

test.serial(
  'FfmpegProcess.run(callback) passes resolved result to callback',
  async (t) => {
    stubSpawn(t, (p) => p.emit('close'))

    let callback = sinon.stub()

    let result = await new FfmpegProcess({ args: ['arg1', 'arg2'] }).run(
      callback
    )

    t.true(callback.calledOnce)
    t.is(callback.firstCall.args[0], null)
    t.is(callback.firstCall.args[1], result)
  }
)

test.serial(
  'FfmpegProcess.run(callback) passes rejection reason to callback',
  async (t) => {
    stubSpawn(t, (p) => p.emit('error', new Error('spawn error')))

    let callback = sinon.stub()
    let err

    try {
      await new FfmpegProcess({ args: ['arg1', 'arg2'] }).run(callback)
    } catch (e) {
      err = e
    }

    t.true(callback.calledOnce)
    t.is(callback.firstCall.args[0], err)
    t.is(callback.firstCall.args[1], undefined)
  }
)
