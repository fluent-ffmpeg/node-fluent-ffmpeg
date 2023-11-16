import { type ExecutionContext } from 'ava'

import sinon from 'sinon'

import childProcessModule, { ChildProcess } from 'node:child_process'
import EventEmitter from 'node:events'

type FakeProcessBehaviour = (proc: FakeProcess) => void

class FakeProcess extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()

  constructor(behaviour?: FakeProcessBehaviour) {
    super()

    if (behaviour) {
      setTimeout(() => behaviour(this), 0)
    }
  }
}

export function stubSpawn(
  t: ExecutionContext<unknown>,
  behaviour?: FakeProcessBehaviour
) {
  let spawnStub = sinon
    .stub(childProcessModule, 'spawn')
    .returns(new FakeProcess(behaviour) as ChildProcess)

  t.teardown(() => spawnStub.restore())

  return spawnStub
}
