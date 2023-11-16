import EventEmitter from 'node:events'

import { nlRegexp } from './regexp'

export default class LineBuffer extends EventEmitter {
  lines: string[]
  #closed: boolean
  #partialLine: string

  constructor() {
    super()

    this.lines = []
    this.#closed = false
    this.#partialLine = ''
  }

  append(data: string): void {
    if (this.#closed) {
      throw new Error('LineBuffer is closed')
    }

    if (data.length) {
      let appendLines = data.split(nlRegexp)

      if (appendLines.length === 1) {
        let [appendLine] = appendLines
        this.#partialLine = `${this.#partialLine}${appendLine}`
      } else {
        if (this.#partialLine) {
          let appendLine = `${this.#partialLine}${appendLines.shift()}`
          this.emit('line', appendLine)
          this.lines.push(appendLine)
        }

        this.#partialLine = appendLines.pop() as string
        for (let appendLine of appendLines) {
          this.emit('line', appendLine)
          this.lines.push(appendLine)
        }
      }
    }
  }

  close(): void {
    if (this.#closed) {
      throw new Error('LineBuffer is closed')
    }

    if (this.#partialLine) {
      this.emit('line', this.#partialLine)
      this.lines.push(this.#partialLine)
    }

    this.#closed = true
  }

  toString(): string {
    return this.lines.join('\n')
  }
}
