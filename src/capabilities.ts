import { FfmpegProcess } from './process'
import {
  FfmpegCodecs,
  FfmpegEncoders,
  FfmpegFilters,
  FfmpegFormats
} from './utils/data-types'
import {
  extractCodecs,
  extractEncoders,
  extractFilters,
  extractFormats
} from './utils/parsing'
import { nlRegexp } from './utils/regexp'

export class FfmpegCapabilities {
  #codecs: FfmpegCodecs | null = null
  #formats: FfmpegFormats | null = null
  #filters: FfmpegFilters | null = null
  #encoders: FfmpegEncoders | null = null
  #decoders: FfmpegEncoders | null = null

  private async getLines(arg: string): Promise<string[]> {
    let { stdout } = await new FfmpegProcess({
      args: [arg],
      captureStdout: true
    }).run()

    return stdout.split(nlRegexp) || []
  }

  async codecs() {
    if (!this.#codecs) {
      this.#codecs = extractCodecs(await this.getLines('-codecs'))
    }

    return this.#codecs
  }

  async formats() {
    if (!this.#formats) {
      this.#formats = extractFormats(await this.getLines('-formats'))
    }

    return this.#formats
  }

  async filters() {
    if (!this.#filters) {
      this.#filters = extractFilters(await this.getLines('-filters'))
    }

    return this.#filters
  }

  async encoders() {
    if (!this.#encoders) {
      this.#encoders = extractEncoders(await this.getLines('-encoders'))
    }

    return this.#encoders
  }

  async decoders() {
    if (!this.#decoders) {
      this.#decoders = extractEncoders(await this.getLines('-decoders'))
    }

    return this.#decoders
  }
}
