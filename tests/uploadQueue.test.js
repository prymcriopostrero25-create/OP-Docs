import { test } from 'node:test'
import assert from 'node:assert/strict'
import { uploadSequentially } from '../src/lib/uploadQueue.js'

test('waits for confirmation before starting the next file', async () => {
  const events = []
  let confirmFirst
  const first = new Promise(resolve => { confirmFirst = resolve })
  const pending = uploadSequentially([{ id: 1 }, { id: 2 }], async item => {
    events.push(`start ${item.id}`)
    if (item.id === 1) await first
    events.push(`saved ${item.id}`)
  })
  assert.deepEqual(events, ['start 1'])
  confirmFirst()
  await pending
  assert.deepEqual(events, ['start 1', 'saved 1', 'start 2', 'saved 2'])
})

test('stops on failure and retries only unfinished files with their original IDs', async () => {
  const items = [{ id: 'saved', status: 'complete' }, { id: 'retry' }, { id: 'queued' }]
  const calls = []
  await assert.rejects(uploadSequentially(items, async item => {
    calls.push(item.id)
    throw new Error('Upload failed')
  }), /Upload failed/)
  assert.deepEqual(calls, ['retry'])
  await uploadSequentially(items, async item => { calls.push(item.id) })
  assert.deepEqual(calls, ['retry', 'retry', 'queued'])
})
