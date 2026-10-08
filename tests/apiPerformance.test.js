import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createAccountLoader } from '../src/lib/accountLoader.js'
import { createPdfPreviewCache } from '../src/lib/pdfPreviewCache.js'

function fixture() {
  const calls = []
  const timeouts = []
  let token = 'first'
  const context = vm.createContext({
    createAccountLoader,
    createPdfPreviewCache,
    loadDocumentPage: async () => { calls.push({ action: 'loadedPage' }); return { form: { body: 'saved' } } },
    AbortSignal: { timeout(ms) { timeouts.push(ms); return AbortSignal.timeout(ms) } }, Date,
    window: { localStorage: { getItem: () => JSON.stringify({ token }) } },
    fetchAppsScript: async (_, options) => {
      const payload = JSON.parse(options.body)
      calls.push(payload)
      return { ok: true, result: { success: true, documents: [], richBodyVersion: 1, document: { id: payload.requestId, url: 'url' } } }
    },
    readAppsScriptResponse: async response => response.result,
  })
  const source = fs.readFileSync(new URL('../src/lib/appsScriptApi.js', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/import\.meta\.env\.VITE_APPS_SCRIPT_URL/g, "'https://example.test/exec'")
    .replace(/import\.meta\.env\.DEV/g, 'false')
    .replace(/export /g, '')
  vm.runInContext(source, context)
  context.documentPage = vm.runInContext('documentPage', context)
  return { context, calls, timeouts, setToken(value) { token = value } }
}

test('registry requests allow slow spreadsheet reads while send confirmation stays short', async () => {
  const f = fixture()
  await f.context.fetchDocuments()
  await f.context.documentRequest({ action: 'overview' })
  await f.context.fetchActivityLogs()
  await f.context.documentRequest({ action: 'currentUser' })
  await f.context.documentRequest({ action: 'documentSendStatus' })
  assert.deepEqual(f.timeouts, [90000, 90000, 90000, 30000, 10000])
})

test('overlapping reads share a request, later refreshes and other sessions fetch again', async () => {
  const f = fixture()
  await Promise.all([f.context.fetchDocuments(), f.context.fetchDocuments()])
  assert.equal(f.calls.length, 1)
  await f.context.fetchDocuments()
  assert.equal(f.calls.length, 2)
  const first = f.context.fetchDocuments()
  f.setToken('second')
  await Promise.all([first, f.context.fetchDocuments()])
  assert.equal(f.calls.length, 4)
  assert.equal(f.calls.at(-1).token, 'second')
})

test('formatted saves reuse editor capabilities while every mutation remains separate', async () => {
  const f = fixture()
  await f.context.createDocument({ bodyRich: {}, requestId: 'one' })
  await Promise.all([
    f.context.createDocument({ bodyRich: {}, requestId: 'two' }),
    f.context.createDocument({ bodyRich: {}, requestId: 'three' }),
  ])
  assert.equal(f.calls.filter(call => call.action === 'editorCapabilities').length, 1)
  assert.equal(f.calls.filter(call => call.action === 'createDocument').length, 3)
  f.setToken('second')
  await f.context.createDocument({ bodyRich: {}, requestId: 'four' })
  assert.equal(f.calls.filter(call => call.action === 'editorCapabilities').length, 2)
})

test('preview forms reuse revisions, isolate sessions, and refresh after status saves', async () => {
  const f = fixture()
  await f.context.documentPage('doc', 'Special Order', 'revision1')
  await f.context.documentPage('doc', 'Special Order', 'revision1')
  assert.equal(f.calls.length, 1)
  await f.context.documentPage('doc', 'Special Order', 'revision2')
  assert.equal(f.calls.length, 2)
  await f.context.documentPage('doc', 'Special Order', 'revision2', true)
  assert.equal(f.calls.length, 3)
  await f.context.documentRequest({ action: 'updateDocumentStatus', id: 'doc', status: 'For Review' })
  await f.context.documentPage('doc', 'Special Order', 'revision2')
  assert.equal(f.calls.length, 5)
  f.setToken('second')
  await f.context.documentPage('doc', 'Special Order', 'revision2')
  assert.equal(f.calls.length, 6)
})
