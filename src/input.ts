import { Readable } from 'node:stream'

import { protocolRegexp } from './utils/regexp'

export type InputSource = string | Readable

export type InputOptions = {
  source: InputSource
  format?: string
  fps?: 'native' | number
  seek?: string | number
  loop?: boolean
}

export type InputDefinition = InputOptions | InputSource

export class FfmpegInput implements InputOptions {
  source: InputSource
  format?: string
  fps?: 'native' | number
  seek?: string | number
  loop?: boolean

  constructor(options: InputDefinition) {
    if (typeof options === 'string' || options instanceof Readable) {
      options = { source: options }
    }

    this.source = options.source
    this.format = options.format
    this.fps = options.fps
    this.seek = options.seek
    this.loop = options.loop
  }

  get isStream(): boolean {
    return this.source instanceof Readable
  }

  get isLocalFile(): boolean {
    if (this.source instanceof Readable || this.format === 'lavfi') {
      return false
    } else {
      let protocol = this.source.match(protocolRegexp)
      return !protocol || protocol[1] === 'file'
    }
  }

  #getSourceString(): string {
    if (typeof this.source === 'string') {
      return this.source
    } else {
      return 'pipe:0'
    }
  }

  #getOptions(): string[] {
    let options: string[] = []

    if (this.format) {
      options.push('-f', this.format)
    }

    if (this.fps === 'native') {
      options.push('-re')
    } else if (this.fps) {
      options.push('-r', this.fps.toString())
    }

    if (this.seek) {
      options.push('-ss', this.seek.toString())
    }

    if (this.loop) {
      options.push('-loop', '1')
    }

    return options
  }

  getFfmpegArguments(): string[] {
    return [...this.#getOptions(), '-i', this.#getSourceString()]
  }
}
