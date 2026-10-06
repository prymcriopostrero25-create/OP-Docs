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

test('Gmail receipt ends loading while the original send response is still pending', async () => {
  const calls = [], form = { id: 'memo', requestId: 'same-request' }
  let finishSend
  const result = await sendWithConfirmation(form, payload => {
    calls.push(payload)
    if (payload.action === 'sendDocument') return new Promise(resolve => { finishSend = resolve })
    return Promise.resolve({ confirmed: true, registryPending: true, document: { id: 'memo', status: 'Out' } })
  }, { pollInterval: 1 })
  assert.equal(result.status, 'Out')
  assert.deepEqual(calls.map(call => call.action), ['sendDocument', 'documentSendStatus'])
  finishSend({ document: result })
})

test('pending receipts keep waiting without starting another send', async () => {
  let sends = 0, checks = 0, finishSend
  const result = await sendWithConfirmation({ id: 'memo' }, payload => {
    if (payload.action === 'sendDocument') { sends++; return new Promise(resolve => { finishSend = resolve }) }
    checks++
    if (checks === 2) finishSend({ document: { id: 'memo', status: 'Out' } })
    return Promise.resolve({ confirmed: false })
  }, { pollInterval: 1 })
  assert.equal(result.status, 'Out')
  assert.equal(sends, 1)
  assert.equal(checks, 2)
})
