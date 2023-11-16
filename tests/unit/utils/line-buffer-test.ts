import test from 'ava'

import LineBuffer from '../../../src/utils/line-buffer'

test('LineBuffer line accumulation', async (t) => {
  t.plan(2)

  let batches = ['line one\nline ', 't', 'wo\n', 'line three\n', 'line four']
  let expected = ['line one', 'line two', 'line three', 'line four']

  let result = await new Promise((resolve) => {
    let buf = new LineBuffer()
    let received: string[] = []

    buf.on('line', (line) => {
      received.push(line)
      if (received.length === expected.length) resolve(received)
    })

    for (let batch of batches) {
      buf.append(batch)
    }

    buf.close()

    t.is(buf.toString(), expected.join('\n'))
  })

  t.deepEqual(result, expected)
})

test('LineBuffer throws errors when closed', (t) => {
  let buf = new LineBuffer()
  buf.close()

  t.throws(() => buf.append('foo'), { message: 'LineBuffer is closed' })
  t.throws(() => buf.close(), { message: 'LineBuffer is closed' })
})
