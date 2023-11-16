import { Readable, Writable } from 'node:stream'

export class FakeReadableStream extends Readable {
  _read() {}
}

export class FakeWritableStream extends Writable {
  _write() {}
}
