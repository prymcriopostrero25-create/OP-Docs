import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sendWithConfirmation } from '../src/lib/documentSendConfirmation.js'

test('lost send response checks the same request and confirms success without resending', async () => {
  const calls = [], form = { id: 'memo', requestId: 'same-request' }
  const result = await sendWithConfirmation(form, async payload => {
    calls.push(payload)
    if (payload.action === 'sendDocument') throw Error('Apps Script 404')
    return { document: { id: 'memo', status: 'Out' } }
  })
  assert.equal(result.status, 'Out')
  assert.deepEqual(calls.map(call => call.action), ['sendDocument', 'documentSendStatus'])
  assert.ok(calls.every(call => call.requestId === form.requestId))
})

test('unconfirmed delivery is reported as uncertain rather than failed', async () => {
  await assert.rejects(sendWithConfirmation({ id: 'memo' }, async payload => {
    if (payload.action === 'sendDocument') throw Error('Failed to fetch')
    return { confirmed: false }
  }), /may have been sent/)
})

test('validation errors do not trigger a delivery check', async () => {
  let calls = 0
  await assert.rejects(sendWithConfirmation({}, async () => { calls++; throw Error('Approve the document before sending it.') }), /Approve/)
  assert.equal(calls, 1)
})
