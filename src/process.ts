import { spawn } from 'node:child_process'

import { isWindows } from './utils/platform'
import {
  extractErrorMessage,
  extractProgress,
  CodecDataExtractor
} from './utils/parsing'
import LineBuffer from './utils/line-buffer'
import { InputCodecInformation, ProgressInformation } from './utils/data-types'
import { Readable, Writable } from 'node:stream'

export type RunResult = {
  stderr: string
  stdout: string
}

export type RunOptions = {
  nice?: number
  cwd?: string
  timeout?: number
  onProgress?: (progress: ProgressInformation) => void
  onCodecData?: (data: InputCodecInformation) => void
  onStderr?: (line: string) => void
}

export type ProcessOptions = RunOptions & {
  args: string[]
  captureStdout?: boolean
  inputStream?: Readable
  outputStream?: Writable
}

export class FfmpegProcess implements ProcessOptions {
  args: string[]
  nice?: number
  cwd?: string
  timeout?: number
  captureStdout?: boolean
  inputStream?: Readable
  outputStream?: Writable
  onProgress?: (progress: ProgressInformation) => void
  onCodecData?: (data: InputCodecInformation) => void
  onStderr?: (line: string) => void

  constructor(options: ProcessOptions) {
    this.args = options.args
    this.nice = options.nice
    this.cwd = options.cwd
    this.timeout = options.timeout
    this.captureStdout = options.captureStdout
    this.inputStream = options.inputStream
    this.outputStream = options.outputStream
    this.onProgress = options.onProgress
    this.onCodecData = options.onCodecData
    this.onStderr = options.onStderr

    this.#validateOptions()
  }

  #validateOptions() {
    if (this.outputStream && this.captureStdout) {
      throw new Error(
        "Cannot use 'captureStdout' when a stream output is present"
      )
    }
  }

  run(callback?: (err: any, result?: any) => any): Promise<RunResult> {
    let cmd = process.env.FFMPEG_PATH || 'ffmpeg'
    let args: string[] = [...this.args]

    let { onProgress, onCodecData, onStderr } = this

    if (this.nice && this.nice !== 0 && !isWindows) {
      args = ['-n', this.nice.toString(), cmd, ...args]
      cmd = 'nice'
    }

    let promise: Promise<RunResult> = new Promise((resolve, reject) => {
      let child = spawn(cmd, args, {
        cwd: this.cwd,
        timeout: this.timeout,
        windowsHide: true
      })

      let stderr = new LineBuffer()
      let stdout = new LineBuffer()

      if (onStderr) {
        stderr.on('line', onStderr)
      }

      if (onProgress) {
        stderr.on('line', (line: string) => {
          let progress = extractProgress(line)
          if (progress) {
            onProgress?.(progress)
          }
        })
      }

      if (onCodecData) {
        let extractor = new CodecDataExtractor(onCodecData)
        stderr.on('line', (line: string) => {
          if (!extractor.done) {
            extractor.processLine(line)
          }
        })
      }

      child.on('error', (err) => reject(err))

      child.on('close', (code, signal) => {
        stderr.close()
        stdout.close()

        if (signal) {
          reject(new Error(`ffmpeg was killed with signal ${signal}`))
        } else if (code) {
          let message = `ffmpeg exited with code ${code}`
          let error = extractErrorMessage(stderr.lines)

          if (error) {
            message = `${message}:\n${error}`
          }

          reject(new Error(message))
        } else {
          resolve({
            stdout: stdout.toString(),
            stderr: stderr.toString()
          })
        }
      })

      if (this.inputStream) {
        this.inputStream.pipe(child.stdin)
        this.inputStream.on('error', (err) => {
          // TODO make a specific error type
          reject(err)

          child.kill()
        })

        // Prevent stdin errors from bubbling up, ffmpeg will crash anyway
        child.stdin.on('error', () => {})
      }

      child.stderr.on('data', (data) => stderr.append(data.toString()))

      if (this.outputStream) {
        child.stdout.pipe(this.outputStream)

        this.outputStream.on('error', (err) => {
          // TODO make a specific error type
          reject(err)

          child.kill()
        })
      } else if (this.captureStdout) {
        child.stdout.on('data', (data) => stdout.append(data.toString()))
      }
    })

    if (callback) {
      promise.then(
        (value) => callback(null, value),
        (reason) => callback(reason)
      )
    }

    return promise
  }
}
