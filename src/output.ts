import { Writable } from 'node:stream'

import { protocolRegexp, streamRegexp } from './utils/regexp'
import { OutputFilter, formatBitrate, formatFilters } from './utils/formatting'

export type OutputAudioOptions = {
  codec?: string
  bitrate?: string | number
  channels?: number
  frequency?: number
  quality?: number
  filter?: OutputFilter
  filters?: OutputFilter[]
}

export type OutputVideoOptions = {
  codec?: string
  bitrate?: string | number
  constantBitrate?: boolean
  fps?: number
  frames?: number
  filter?: OutputFilter
  filters?: OutputFilter[]
}

type OutputTarget = string | Writable

export type OutputOptions = {
  target: OutputTarget
  seek?: string | number
  duration?: string | number
  format?: string
  map?: string

  audio?: false | OutputAudioOptions
  video?: false | OutputVideoOptions
}

export type OutputDefinition = OutputTarget | OutputOptions

export class FfmpegOutput implements OutputOptions {
  target: OutputTarget
  seek?: string | number
  duration?: string | number
  format?: string
  map?: string

  audio?: false | OutputAudioOptions
  video?: false | OutputVideoOptions

  constructor(options: OutputDefinition) {
    if (typeof options === 'string' || options instanceof Writable) {
      options = { target: options }
    }

    this.target = options.target
    this.seek = options.seek
    this.duration = options.duration
    this.format = options.format
    this.map = options.map

    this.audio = options.audio
    this.video = options.video

    this.validateOptions()
  }

  validateOptions() {
    if (this.audio && this.audio.filter) {
      if (this.audio.filters) {
        throw new Error(`Cannot specify both audio 'filter' and 'filters'`)
      } else {
        this.audio.filters = [this.audio.filter]
        delete this.audio.filter
      }
    }

    if (this.video && this.video.filter) {
      if (this.video.filters) {
        throw new Error(`Cannot specify both video 'filter' and 'filters'`)
      } else {
        this.video.filters = [this.video.filter]
        delete this.video.filter
      }
    }
  }

  get isStream(): boolean {
    return this.target instanceof Writable
  }

  get isLocalFile(): boolean {
    if (this.target instanceof Writable) {
      return false
    } else {
      let protocol = this.target.match(protocolRegexp)
      return !protocol || protocol[1] === 'file'
    }
  }

  #getAudioOptions(): string[] {
    let options: string[] = []

    if (this.audio === false) {
      options.push('-an')
    } else if (this.audio) {
      if (this.audio.codec) {
        options.push('-acodec', this.audio.codec)
      }

      if (this.audio.bitrate) {
        options.push('-b:a', formatBitrate(this.audio.bitrate))
      }

      if (this.audio.channels) {
        options.push('-ac', this.audio.channels.toString())
      }

      if (this.audio.frequency) {
        options.push('-ar', this.audio.frequency.toString())
      }

      if (this.audio.quality) {
        options.push('-aq', this.audio.quality.toString())
      }

      if (this.audio.filters) {
        // todo make formatFilters handle the join
        options.push('-filter:a', formatFilters(this.audio.filters).join(','))
      }
    }

    return options
  }

  #getVideoOptions(): string[] {
    let options: string[] = []

    if (this.video === false) {
      options.push('-vn')
    } else if (this.video) {
      if (this.video.codec) {
        options.push('-vcodec', this.video.codec)
      }

      if (this.video.bitrate) {
        let bitrate = formatBitrate(this.video.bitrate)
        options.push('-b:v', bitrate)

        if (this.video.constantBitrate) {
          options.push(
            '-minrate',
            bitrate,
            '-maxrate',
            bitrate,
            '-bufsize',
            bitrate
          )
        }
      }

      if (this.video.fps) {
        options.push('-r', this.video.fps.toString())
      }

      if (this.video.frames) {
        options.push('-vframes', this.video.frames.toString())
      }

      if (this.video.filters) {
        options.push('-filter:v', formatFilters(this.video.filters).join(','))
      }

      // todo size filters
    }

    return options
  }

  #getOptions(): string[] {
    let options: string[] = []

    if (this.seek) {
      options.push('-ss', this.seek.toString())
    }

    if (this.duration) {
      options.push('-t', this.duration.toString())
    }

    if (this.format) {
      options.push('-f', this.format)
    }

    if (this.map) {
      options.push('-map', this.map.replace(streamRegexp, '[$1]'))
    }

    return options
  }

  #getOutputString(): string {
    if (typeof this.target === 'string') {
      return this.target
    } else {
      return 'pipe:1'
    }
  }

  getFfmpegArguments(): string[] {
    return [
      ...this.#getAudioOptions(),
      ...this.#getVideoOptions(),
      ...this.#getOptions(),
      this.#getOutputString()
    ]
  }
}
