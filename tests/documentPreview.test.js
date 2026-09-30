import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

function fixture({ authorized = true, native = true } = {}) {
  const exports = []
  const context = vm.createContext({
    DriveApp: { getFileById(id) {
      assert.equal(id, 'registered-file')
      return {
        isTrashed: () => false,
        getMimeType: () => native ? 'application/vnd.google-apps.document' : 'application/pdf',
        getAs(type) { exports.push(type); return { getBytes: () => [1, 2] } },
        getBlob: () => ({ getBytes: () => [1, 2] }),
        getName: () => 'Document', getId: () => id,
      }
    } },
    Utilities: { base64Encode: () => 'AQI=' },
  })
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  context.getDocumentSession = () => authorized
  context.jsonResponse = payload => payload
  context.mainFilesSheet = () => ({ getLastRow: () => 2, getRange: () => ({
    getDisplayValues: () => [['Created', 'known', '', 'Title', 'https://drive.google.com/file/d/registered-file/view']],
    getNote: () => '{}',
  }) })
  return { exports, run: (id = 'known') => context.prepareDocumentPreview({ id, token: 'session' }) }
}

test('preview exports the registered Google Doc as PDF on demand', () => {
  const f = fixture()
  assert.equal(f.exports.length, 0)
  const result = f.run()
  assert.equal(result.success, true)
  assert.equal(result.native, true)
  assert.equal(result.name, 'Document.pdf')
  assert.deepEqual(f.exports, ['application/pdf'])
})

test('preview rejects expired sessions and unknown records before exporting', () => {
  for (const f of [fixture({ authorized: false }), fixture()]) {
    assert.equal(f.run('unknown').success, false)
    assert.equal(f.exports.length, 0)
  }
})

test('uploaded PDFs are reused without conversion', () => {
  const f = fixture({ native: false })
  assert.equal(f.run().native, false)
  assert.equal(f.exports.length, 0)
})

test('prepared PDFs are reused, refreshed after edits, and regenerated if chunks expire', () => {
  const cache = new Map()
  let revision = 1, exports = 0
  const blob = { getBytes: () => [1, 2] }
  const context = vm.createContext({
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), getAll: keys => Object.fromEntries(keys.filter(key => cache.has(key)).map(key => [key, cache.get(key)])), put: (key, value) => cache.set(key, value), putAll: values => Object.entries(values).forEach(([key, value]) => cache.set(key, value)) }) },
    Utilities: { base64Encode: () => 'AQI=', base64Decode: () => [1, 2], newBlob: () => blob },
  })
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  const file = { getMimeType: () => 'application/vnd.google-apps.document', getId: () => 'doc', getLastUpdated: () => new Date(revision), getName: () => 'Document', getAs: () => { exports++; return blob } }
  context.preparedDocumentPdf(file)
  context.preparedDocumentPdf(file)
  assert.equal(exports, 1)
  revision++
  context.preparedDocumentPdf(file)
  assert.equal(exports, 2)
  cache.delete('pdf:doc:2:0')
  context.preparedDocumentPdf(file)
  assert.equal(exports, 3)
})

test('page preview returns saved content without PDF conversion and requires a session', () => {
  const context = vm.createContext({})
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  context.jsonResponse = value => value
  context.getDocumentSession = () => true
  context.workflowDocument = () => ({ metadata: { form: { body: 'Saved text' } }, record: { type: 'Certificate of Travel' } })
  assert.equal(context.documentPage({ id: 'known' }).form.body, 'Saved text')
  context.getDocumentSession = () => false
  context.workflowDocument = () => { throw new Error('Must not read') }
  assert.equal(context.documentPage({ id: 'known' }).success, false)
})
