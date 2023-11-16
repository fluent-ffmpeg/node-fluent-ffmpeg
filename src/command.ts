import { Readable, Writable } from 'node:stream'
import { FfmpegInput, InputDefinition } from './input'
import { FfmpegOutput, OutputDefinition } from './output'
import { FfmpegProcess, RunResult, RunOptions, ProcessOptions } from './process'

export type CommandOptions = {
  input?: InputDefinition
  inputs?: InputDefinition[]
  output?: OutputDefinition
  outputs?: OutputDefinition[]
}

export class FfmpegCommand implements CommandOptions {
  inputs: FfmpegInput[]
  outputs: FfmpegOutput[]

  constructor(options: CommandOptions) {
    if (options.input) {
      if (options.inputs) {
        throw new Error("Cannot specify both 'input' and 'inputs'")
      }

      options.inputs = [options.input]
    }

    if (options.output) {
      if (options.outputs) {
        throw new Error("Cannot specify both 'output' and 'outputs'")
      }

      options.outputs = [options.output]
    }

    this.inputs = (options.inputs || []).map(
      (inputOptions) => new FfmpegInput(inputOptions)
    )

    this.outputs = (options.outputs || []).map(
      (outputOptions) => new FfmpegOutput(outputOptions)
    )

    this.#validateIO()
  }

  #validateIO(): void {
    if (this.inputs.filter((i) => i.isStream).length > 1) {
      throw new Error(`At most one stream input is supported`)
    }

    if (this.outputs.filter((o) => o.isStream).length > 1) {
      throw new Error(`At most one stream output is supported`)
    }
  }

  getFfmpegArguments(): string[] {
    let args: string[] = []

    for (let input of this.inputs) {
      args.push(...input.getFfmpegArguments())
    }

    // TODO complex filters

    if (this.outputs.some((o) => o.isLocalFile)) {
      // Force overwrite outputs
      args.push('-y')
    }

    for (let output of this.outputs) {
      args.push(...output.getFfmpegArguments())
    }

    return args
  }

  run(options: RunOptions): Promise<RunResult> {
    let procOtions: ProcessOptions = {
      args: this.getFfmpegArguments(),
      ...options
    }

    let streamInput = this.inputs.find((i) => i.isStream)
    if (streamInput) {
      procOtions.inputStream = streamInput.source as Readable
    }

    let streamOutput = this.outputs.find((i) => i.isStream)
    if (streamOutput) {
      procOtions.outputStream = streamOutput.target as Writable
    }

    return new FfmpegProcess(procOtions).run()
  }
}
