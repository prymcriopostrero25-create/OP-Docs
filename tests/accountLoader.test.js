import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAccountLoader } from '../src/lib/accountLoader.js'

test('account reads deduplicate, reuse recent results, refresh and isolate sessions', async () => {
  const calls = []
  const loader = createAccountLoader(async token => { calls.push(token); return [{ email: token }] })
  await Promise.all([loader.load('one'), loader.load('one')])
  await loader.load('one')
  assert.equal(calls.length, 1)
  await loader.load('one', true)
  await loader.load('two')
  assert.deepEqual(calls, ['one', 'one', 'two'])
  loader.invalidate('one')
  await loader.load('one')
  assert.equal(calls.length, 4)
})

test('failed account loads can be retried and expired lists are fetched again', async () => {
  let calls = 0
  const loader = createAccountLoader(async () => { if (++calls === 1) throw Error('offline'); return [] }, 0)
  await assert.rejects(loader.load('one'), /offline/)
  await loader.load('one')
  await loader.load('one')
  assert.equal(calls, 3)
})
