import { FfmpegCapabilities } from './capabilities'
import { type CommandOptions, FfmpegCommand } from './command'
import { FfmpegInput, type InputDefinition } from './input'
import { FfmpegOutput, type OutputDefinition } from './output'
import { FfmpegProcess, type ProcessOptions, type RunResult } from './process'
import {
  type ProgressInformation,
  type InputCodecInformation,
  type InputStreamCodecInformation
} from './utils/data-types'

export {
  InputCodecInformation,
  InputStreamCodecInformation,
  CommandOptions,
  FfmpegCapabilities,
  FfmpegCommand,
  FfmpegInput,
  FfmpegOutput,
  FfmpegProcess,
  InputDefinition,
  OutputDefinition,
  ProcessOptions,
  ProgressInformation,
  RunResult
}

function ffmpeg(options: CommandOptions) {
  return new FfmpegCommand(options)
}

export default ffmpeg
