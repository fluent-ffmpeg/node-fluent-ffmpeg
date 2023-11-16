import {
  FfmpegCodec,
  FfmpegCodecType,
  FfmpegCodecs,
  FfmpegEncoderType,
  FfmpegEncoders,
  FfmpegFilterStreamType,
  FfmpegFilters,
  FfmpegFormats,
  InputCodecInformation,
  InputStreamCodecInformation,
  ProgressInformation
} from './data-types'

import {
  capCodecDecodersRegexp,
  capCodecEncodersRegexp,
  capCodecRegexp,
  capEncoderRegexp,
  capFilterRegexp,
  capFormatRegexp,
  codecAudioRegexp,
  codecDurRegexp,
  codecEndRegexp,
  codecInputRegexp,
  codecOutputRegexp,
  codecVideoRegexp,
  durationRegexp
} from './regexp'

/**
 * Parse a ffmpeg duration
 *
 * @param duration Duration as [[HH:]MM:]ss[.mmm]
 * @returns parsed duration in seconds
 */
export function parseDuration(duration: string): number {
  let match = duration.match(durationRegexp)
  if (!match) {
    throw new Error(`Invalid duration: ${duration}`)
  }

  let totalSeconds = 0

  let [, hours, minutes, seconds, milliseconds] = match

  if (hours !== undefined) {
    totalSeconds += Number(hours) * 3600
  }

  if (minutes !== undefined) {
    totalSeconds += Number(minutes) * 60
  }

  if (seconds !== undefined) {
    totalSeconds += Number(seconds)
  }

  if (milliseconds !== undefined) {
    totalSeconds += Number(milliseconds) / 1000
  }

  return totalSeconds
}

/**
 * Extract an error message from ffmpeg stderr
 *
 * @param stderrLines stderr output from ffmpeg as an array of lines
 * @returns error message
 */
export function extractErrorMessage(stderrLines: string[]): string {
  // Return the last block of lines that don't start with a space or square bracket
  return stderrLines
    .reduce((messages: string[], message: string): string[] => {
      if (message.charAt(0) === ' ' || message.charAt(0) === '[') {
        return []
      } else {
        messages.push(message)
        return messages
      }
    }, [])
    .join('\n')
}

/**
 * Extract progress information from ffmpeg stderr
 *
 * @param stderrLine a line from ffmpeg stderr
 * @returns progress information
 */
export function extractProgress(
  stderrLine: string
): ProgressInformation | undefined {
  let parts = stderrLine.replace(/=\s+/g, '=').trim().split(' ')
  let progress: ProgressInformation = {}

  for (let part of parts) {
    let [key, value] = part.split('=', 2)

    if (value === undefined) {
      // Not a progress line
      return
    }

    if (key === 'frame' || key === 'fps') {
      progress[key] = Number(value)
    } else if (key === 'bitrate') {
      progress.bitrate = Number(value.replace('kbits/s', ''))
    } else if (key === 'size' || key === 'Lsize') {
      progress.size = Number(value.replace('kB', ''))
    } else if (key === 'time') {
      progress.time = value
    } else if (key === 'speed') {
      progress.speed = Number(value.replace('x', ''))
    }
  }

  return progress
}

// TODO better output for multiple inputs / multi-stream inputs !
export class CodecDataExtractor {
  inputs: InputStreamCodecInformation[]
  index: number
  inInput: boolean
  done: boolean
  callback: (data: InputCodecInformation) => any

  constructor(callback: (data: InputCodecInformation) => any) {
    this.inputs = []
    this.index = -1
    this.inInput = false
    this.done = false
    this.callback = callback
  }

  processLine(line: string) {
    let matchFormat = line.match(codecInputRegexp)
    if (matchFormat) {
      this.inInput = true
      this.index++
      this.inputs[this.index] = {
        format: matchFormat[1]
      }

      return
    }

    if (this.inInput) {
      let durationMatch = line.match(codecDurRegexp)
      if (durationMatch) {
        this.inputs[this.index].duration = durationMatch[1]
        return
      }

      let audioMatch = line.match(codecAudioRegexp)
      if (audioMatch) {
        this.inputs[this.index].audio = audioMatch[1].split(', ')[0]
        this.inputs[this.index].audioDetails = audioMatch[1]
        return
      }

      let videoMatch = line.match(codecVideoRegexp)
      if (videoMatch) {
        this.inputs[this.index].video = videoMatch[1].split(', ')[0]
        this.inputs[this.index].videoDetails = videoMatch[1]
        return
      }
    }

    if (codecOutputRegexp.test(line)) {
      this.inInput = false
    }

    if (codecEndRegexp.test(line)) {
      this.done = true
      let { callback } = this

      callback(this.inputs)
    }
  }
}

function parseCodecType(type: string): FfmpegCodecType {
  if (type === 'A') return 'audio'
  if (type === 'V') return 'video'
  if (type === 'S') return 'subtitle'
  if (type === 'D') return 'data'
  return 'attachment'
}

export function extractCodecs(lines: string[]): FfmpegCodecs {
  let codecs: FfmpegCodecs = {}

  for (let line of lines) {
    let match = line.match(capCodecRegexp)
    if (match) {
      let [, decode, encode, type, intra, lossy, lossless, name, description] =
        match

      let codec: FfmpegCodec = {
        description,
        type: parseCodecType(type),
        canEncode: encode === 'E',
        canDecode: decode === 'D',
        intraFrame: intra === 'I',
        lossy: lossy === 'L',
        lossless: lossless === 'S'
      }

      if (decode === 'D') {
        let decoders = description.match(capCodecDecodersRegexp)
        if (decoders) {
          codec.decoders = decoders[1].trim().split(' ')
          codec.description = codec.description
            .replace(capCodecDecodersRegexp, '')
            .trim()
        }
      }

      if (encode === 'E') {
        let encoders = description.match(capCodecEncodersRegexp)
        if (encoders) {
          codec.encoders = encoders[1].trim().split(' ')
          codec.description = codec.description
            .replace(capCodecEncodersRegexp, '')
            .trim()
        }
      }

      codecs[name] = codec
    }
  }

  return codecs
}

export function extractFormats(lines: string[]): FfmpegFormats {
  let formats: FfmpegFormats = {}

  for (let line of lines) {
    let match = line.match(capFormatRegexp)
    if (match) {
      let [, demux, mux, name, description] = match
      formats[name] = {
        description,
        canMux: mux === 'E',
        canDemux: demux === 'D'
      }
    }
  }

  return formats
}

function parseFilterStreams(
  streams: string
): FfmpegFilterStreamType[] | 'dynamic' {
  if (streams === '|') {
    return []
  } else if (streams === 'N') {
    return 'dynamic'
  } else {
    return [...streams].map((s) => (s === 'A' ? 'audio' : 'video'))
  }
}

export function extractFilters(lines: string[]): FfmpegFilters {
  let filters: FfmpegFilters = {}

  for (let line of lines) {
    let match = line.match(capFilterRegexp)
    if (match) {
      let [, timeline, slice, command, name, inputs, outputs, description] =
        match

      filters[name] = {
        description,
        inputs: parseFilterStreams(inputs),
        outputs: parseFilterStreams(outputs)
      }
    }
  }

  return filters
}

function parseEncoderType(type: string): FfmpegEncoderType {
  if (type === 'A') return 'audio'
  if (type === 'V') return 'video'
  return 'subtitle'
}

export function extractEncoders(lines: string[]): FfmpegEncoders {
  let encoders: FfmpegEncoders = {}

  for (let line of lines) {
    let match = line.match(capEncoderRegexp)
    if (match) {
      let [, type, frame, slice, exp, band, direct, name, description] = match

      encoders[name] = {
        description,
        type: parseEncoderType(type),
        frameMultithreading: frame === 'F',
        sliceMultithreading: slice === 'S',
        experimental: exp === 'X',
        drawHorizBand: band === 'B',
        directRendering: direct === 'D'
      }
    }
  }

  return encoders
}
