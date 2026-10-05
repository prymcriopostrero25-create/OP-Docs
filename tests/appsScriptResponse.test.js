import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readAppsScriptResponse } from '../src/lib/appsScriptResponse.js'

test('Apps Script response reader preserves JSON responses', async () => {
  assert.deepEqual(await readAppsScriptResponse(new Response('{"success":true,"documents":[]}')), { success: true, documents: [] })
})

test('Apps Script HTML responses explain deployment configuration instead of a JSON syntax error', async () => {
  await assert.rejects(readAppsScriptResponse(new Response('<!DOCTYPE html><html>Sign in</html>')), /webpage instead of data/)
  await assert.rejects(readAppsScriptResponse(new Response('invalid')), /invalid response/)
})
