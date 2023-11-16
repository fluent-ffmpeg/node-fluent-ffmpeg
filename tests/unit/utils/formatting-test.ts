import test from 'ava'

import { formatBitrate, formatFilters } from '../../../src/utils/formatting'

test('formatBitrate', (t) => {
  t.is(formatBitrate(128), '128k', 'formats small numbers as kbps')
  t.is(formatBitrate(128000), '128000', 'formats big numbers as bps')
  t.is(formatBitrate('foobar'), 'foobar', 'keeps strings')
})

test('formatFilters', (t) => {
  t.deepEqual(
    formatFilters([
      'filtername',
      { filter: 'filtername' },
      {
        filter: 'filtername',
        options: 'option'
      },
      {
        filter: 'filtername',
        options: ['option1', 'option2', 'needs,escaping']
      },
      {
        filter: 'filtername',
        options: { key1: 'value1', key2: 'value2', key3: 'needs,escaping' }
      },
      {
        filter: 'filtername',
        input: 'input1'
      },
      {
        filter: 'filtername',
        inputs: ['input1', 'input2']
      },
      {
        filter: 'filtername',
        output: 'output1'
      },
      {
        filter: 'filtername',
        outputs: ['output1', 'output2']
      },
      {
        filter: 'filtername',
        inputs: ['input1', 'input2'],
        outputs: ['output1', 'output2'],
        options: { key1: 'value1', key2: 'value2' }
      }
    ]),
    [
      'filtername',
      'filtername',
      'filtername=option',
      "filtername=option1:option2:'needs,escaping'",
      "filtername=key1=value1:key2=value2:key3='needs,escaping'",
      '[input1]filtername',
      '[input1][input2]filtername',
      'filtername[output1]',
      'filtername[output1][output2]',
      '[input1][input2]filtername=key1=value1:key2=value2[output1][output2]'
    ]
  )
})
