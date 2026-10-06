import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchAppsScript } from '../src/lib/appsScriptFetch.js'

test('dashboard read recovers from a temporary deployment 404', async () => {
  let calls = 0
  const response = await fetchAppsScript('/apps-script', {}, 'documents', async () => ++calls === 1 ? new Response('', { status: 404 }) : new Response('{"success":true}', { headers: { 'content-type': 'application/json' } }))
  assert.equal(response.status, 200)
  assert.equal(calls, 2)
})

test('mutations are never retried after an ambiguous HTML response', async () => {
  let calls = 0
  await fetchAppsScript('/apps-script', {}, 'createDocument', async () => { calls++; return new Response('<html>', { headers: { 'content-type': 'text/html' } }) })
  assert.equal(calls, 1)
})

test('PDF preparation recovers from temporary 404 and HTML redirect failures', async () => {
  const options = { method: 'POST', body: JSON.stringify({ action: 'prepareDocumentPreview', id: 'memo-145', token: 'session' }) }
  const requests = []
  const response = await fetchAppsScript('/apps-script', options, 'prepareDocumentPreview', async (target, request) => {
    requests.push({ target, request })
    if (requests.length === 1) return new Response('', { status: 404 })
    if (requests.length === 2) return new Response('<html>Temporary redirect failure</html>', { headers: { 'content-type': 'text/html' } })
    return new Response(JSON.stringify({ success: true, name: 'Memo.pdf', data: 'JVBERi0=' }), { headers: { 'content-type': 'application/json' } })
  })
  assert.equal(requests.length, 3)
  assert.ok(requests.every(request => request.target === '/apps-script' && request.request === options))
  assert.equal((await response.json()).name, 'Memo.pdf')
})

test('PDF preparation stops retrying when the deployment remains unavailable', async () => {
  let calls = 0
  await assert.rejects(fetchAppsScript('/apps-script', {}, 'prepareDocumentPreview', async () => {
    calls++
    return new Response('', { status: 404 })
  }), /deployment could not be reached/)
  assert.equal(calls, 3)
})

test('PDF preparation does not retry an application error', async () => {
  let calls = 0
  const response = await fetchAppsScript('/apps-script', {}, 'prepareDocumentPreview', async () => {
    calls++
    return new Response(JSON.stringify({ success: false, message: 'Document is in Trash.' }), { headers: { 'content-type': 'application/json' } })
  })
  assert.equal(calls, 1)
  assert.equal((await response.json()).success, false)
})

test('persistent missing deployment gives an actionable error', async () => {
  await assert.rejects(fetchAppsScript('/apps-script', {}, 'documents', async () => new Response('', { status: 404 })), /deployment could not be reached/)
})

test('safe reads recover from network errors and service overload, while sends are never retried', async () => {
  let calls = 0
  const response = await fetchAppsScript('/apps-script', {}, 'documentPage', async () => {
    if (++calls === 1) throw new TypeError('Failed to fetch')
    if (calls === 2) return new Response('', { status: 503 })
    return new Response('{}')
  })
  assert.equal(response.status, 200)
  assert.equal(calls, 3)
  calls = 0
  await assert.rejects(fetchAppsScript('/apps-script', {}, 'sendDocument', async () => { calls++; throw new TypeError('Failed to fetch') }), /fetch/)
  assert.equal(calls, 1)
})

test('aborting a retry delay immediately stops additional requests', async () => {
  const controller = new AbortController()
  let calls = 0
  const promise = fetchAppsScript('/apps-script', { signal: controller.signal }, 'documents', async () => {
    calls++
    controller.abort()
    return new Response('', { status: 503 })
  })
  await assert.rejects(promise, { name: 'AbortError' })
  assert.equal(calls, 1)
})
