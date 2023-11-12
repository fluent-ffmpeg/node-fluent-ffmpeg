import test from 'ava'
import sinon from 'sinon'

import { FfmpegCapabilities } from '../../src/capabilities'
import * as processModule from '../../src/process'

const FfmpegProcessStub = sinon.stub(processModule, 'FfmpegProcess')

test.afterEach(() => {
  FfmpegProcessStub.reset()
})

test.serial('FfmpegCapabilities.codecs()', async (t) => {
  FfmpegProcessStub.returns({
    async run() {
      return {
        stdout: [
          'not a codecs line',
          'DEVILS codec1 first codec',
          '.EA.L. codec2 encode only audio lossy',
          'D.S..S codec3 decode only subtitle lossless',
          '.ED... codec4 stuff (encoders: foo bar)',
          'D.T... codec5 things (decoders: foo bar)',
          'not a codecs line either'
        ].join('\n')
      }
    }
  })

  let caps = new FfmpegCapabilities()
  let result = await caps.codecs()

  t.true(
    FfmpegProcessStub.calledOnceWith({ args: ['-codecs'], captureStdout: true })
  )

  let expected = {
    codec1: {
      canDecode: true,
      canEncode: true,
      description: 'first codec',
      intraFrame: true,
      lossless: true,
      lossy: true,
      type: 'video'
    },
    codec2: {
      canDecode: false,
      canEncode: true,
      description: 'encode only audio lossy',
      intraFrame: false,
      lossless: false,
      lossy: true,
      type: 'audio'
    },
    codec3: {
      canDecode: true,
      canEncode: false,
      description: 'decode only subtitle lossless',
      intraFrame: false,
      lossless: true,
      lossy: false,
      type: 'subtitle'
    },
    codec4: {
      canDecode: false,
      canEncode: true,
      encoders: ['foo', 'bar'],
      description: 'stuff',
      intraFrame: false,
      lossless: false,
      lossy: false,
      type: 'data'
    },
    codec5: {
      canDecode: true,
      decoders: ['foo', 'bar'],
      canEncode: false,
      description: 'things',
      intraFrame: false,
      lossless: false,
      lossy: false,
      type: 'attachment'
    }
  }

  t.deepEqual(result, expected)

  result = await caps.codecs()

  t.deepEqual(result, expected)
  t.true(FfmpegProcessStub.calledOnce, 'results are cached')
})

test.serial('FfmpegCapabilities.formats()', async (t) => {
  FfmpegProcessStub.returns({
    async run() {
      return {
        stdout: [
          'not a format line',
          'DE format1 first format',
          ' E format2 second format',
          'D  format3 third format',
          'not a format line either'
        ].join('\n')
      }
    }
  })

  let caps = new FfmpegCapabilities()
  let result = await caps.formats()

  t.true(
    FfmpegProcessStub.calledOnceWith({
      args: ['-formats'],
      captureStdout: true
    })
  )

  let expected = {
    format1: {
      description: 'first format',
      canMux: true,
      canDemux: true
    },
    format2: {
      description: 'second format',
      canMux: true,
      canDemux: false
    },
    format3: {
      description: 'third format',
      canMux: false,
      canDemux: true
    }
  }

  t.deepEqual(result, expected)

  result = await caps.formats()

  t.deepEqual(result, expected)
  t.true(FfmpegProcessStub.calledOnce, 'results are cached')
})
