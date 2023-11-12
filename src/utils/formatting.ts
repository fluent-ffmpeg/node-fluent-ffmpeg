import { filterNeedsEscapeRegexp, streamRegexp } from './regexp'

export function formatBitrate(bitrate: number | string): string {
  if (typeof bitrate === 'number') {
    if (bitrate < 1024) {
      // Assume the user means kbps
      return `${bitrate}k`
    } else {
      return `${bitrate}`
    }
  } else {
    return bitrate
  }
}

interface OutputFilterSpec {
  filter: string
  options?: string | string[] | { [key: string]: string }
  input?: string
  inputs?: string[]
  output?: string
  outputs?: string[]
}

export type OutputFilter = string | OutputFilterSpec

// TODO format filtergraph with multi-level escaping
// see http://ffmpeg.org/ffmpeg-filters.html#Notes-on-filtergraph-escaping

export function formatFilters(specs: OutputFilter[]): string[] {
  /* Filter syntax:

      filter := inputs? filterspec outputs?
      
      inputs := input inputs?
      input := '[' input-name ']'

      outputs := output outputs?
      output := '[' output-name ']'

      filterspec := filter-name ('=' filterargs)?
      filterargs := filterarg (':' filterargs)?
      filterarg := arg-value | (arg-name '=' arg-value)
   */

  return specs.map((spec) => {
    if (typeof spec === 'string') {
      return spec
    }

    if (spec.input) {
      spec.inputs = [spec.input]
    }

    let inputs = (spec.inputs || [])
      .map((stream) => stream.replace(streamRegexp, '[$1]'))
      .join('')

    let options = ''

    if (spec.options) {
      if (typeof spec.options === 'string') {
        options = `=${spec.options}`
      } else if (Array.isArray(spec.options)) {
        let optionStrings = spec.options.map((option) => {
          if (option.match(filterNeedsEscapeRegexp)) {
            return `'${option}'`
          } else {
            return option
          }
        })

        options = `=${optionStrings.join(':')}`
      } else {
        let optionStrings = Object.entries(spec.options).map(([key, value]) => {
          if (value.match(filterNeedsEscapeRegexp)) {
            value = `'${value}'`
          }

          return `${key}=${value}`
        })

        options = `=${optionStrings.join(':')}`
      }
    }

    let filter = `${spec.filter}${options}`

    if (spec.output) {
      spec.outputs = [spec.output]
    }

    let outputs = (spec.outputs || [])
      .map((stream) => stream.replace(streamRegexp, '[$1]'))
      .join('')

    return `${inputs}${filter}${outputs}`
  })
}
