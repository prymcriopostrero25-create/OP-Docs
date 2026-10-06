import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPdfPreviewCache } from '../src/lib/pdfPreviewCache.js'

test('reopening and concurrent previews reuse preparation for the same revision', async () => {
  let calls = 0
  const load = createPdfPreviewCache(async () => { calls++; return { data: 'PDF' } })
  const first = load('session', 'memo', 'Executive Memorandum', 'rev1')
  assert.equal(load('session', 'memo', 'Executive Memorandum', 'rev1'), first)
  await first
  await load('session', 'memo', 'Executive Memorandum', 'rev1')
  assert.equal(calls, 1)
  await load('session', 'memo', 'Executive Memorandum', 'rev2')
  await load('other-session', 'memo', 'Executive Memorandum', 'rev2')
  assert.equal(calls, 3)
})

test('expired, failed, and revisionless previews are prepared again', async () => {
  let time = 0, calls = 0
  const load = createPdfPreviewCache(async () => { if (++calls === 1) throw Error('temporary'); return {} }, { ttl: 10, now: () => time })
  await assert.rejects(load('s', 'id', 'type', 'rev'), /temporary/)
  await load('s', 'id', 'type', 'rev')
  time = 11
  await load('s', 'id', 'type', 'rev')
  await load('s', 'id', 'type', '')
  await load('s', 'id', 'type', '')
  assert.equal(calls, 5)
})

test('PDF cache bounds the number of retained documents', async () => {
  let calls = 0
  const load = createPdfPreviewCache(async () => { calls++; return {} }, { limit: 2 })
  for (const id of ['a', 'b', 'c', 'a']) await load('s', id, 'type', 'rev')
  assert.equal(calls, 4)
})

test('pending PDF preparation remains shared after its initial TTL elapses', async () => {
  let time = 0, finish, calls = 0
  const load = createPdfPreviewCache(() => { calls++; return new Promise(resolve => { finish = resolve }) }, { ttl: 10, now: () => time })
  const first = load('s', 'id', 'type', 'rev')
  await Promise.resolve()
  time = 100
  assert.equal(load('s', 'id', 'type', 'rev'), first)
  finish({})
  await first
  assert.equal(calls, 1)
})

test('oversized PDF results are not retained and manual invalidation prepares again', async () => {
  let calls = 0
  const load = createPdfPreviewCache(async () => { calls++; return { data: '123456' } }, { maxBytes: 10 })
  await load('s', 'id', 'type', 'rev')
  await load('s', 'id', 'type', 'rev')
  assert.equal(calls, 2)
  const small = createPdfPreviewCache(async () => { calls++; return {} })
  await small('s', 'id', 'type', 'rev')
  small.clear()
  await small('s', 'id', 'type', 'rev')
  assert.equal(calls, 4)
})

test('switching accounts purges PDFs and passes the original session to preparation', async () => {
  const sessions = []
  const load = createPdfPreviewCache(async (_id, _type, session) => { sessions.push(session); return {} })
  await load('a', 'id', 'type', 'rev')
  await load('b', 'id', 'type', 'rev')
  await load('a', 'id', 'type', 'rev')
  assert.deepEqual(sessions, ['a', 'b', 'a'])
})
