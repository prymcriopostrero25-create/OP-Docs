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

test('persistent missing deployment gives an actionable error', async () => {
  await assert.rejects(fetchAppsScript('/apps-script', {}, 'documents', async () => new Response('', { status: 404 })), /deployment could not be reached/)
})
