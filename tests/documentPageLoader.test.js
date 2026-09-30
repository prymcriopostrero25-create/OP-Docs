import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadDocumentPage } from '../src/lib/documentPageLoader.js'

test('current deployment loads page directly', async () => {
  const calls = []
  const result = await loadDocumentPage('doc', async request => { calls.push(request); return { form: { body: 'Page' } } })
  assert.equal(result.form.body, 'Page')
  assert.equal(calls.length, 1)
})
test('older deployment reuses saved form for page preview', async () => {
  const calls = []
  const result = await loadDocumentPage('doc', async request => {
    calls.push(request.action)
    if (request.action === 'documentPage') throw new Error('Unsupported action.')
    return { form: { body: 'Page', type: 'Special Order' } }
  })
  assert.equal(result.type, 'Special Order')
  assert.deepEqual(calls, ['documentPage', 'documentDetails'])
})
test('older deployment without form access selects PDF fallback and deployment message', async () => {
  const result = await loadDocumentPage('doc', async request => { throw new Error(request.action === 'documentPage' ? 'Unsupported action.' : 'Admin access is required.') })
  assert.equal(result.form, null)
  assert.equal(result.deploymentRequired, true)
})
test('session and network errors do not trigger compatibility requests', async () => {
  let calls = 0
  await assert.rejects(loadDocumentPage('doc', async () => { calls++; throw new Error('Session expired') }), /Session expired/)
  assert.equal(calls, 1)
})
