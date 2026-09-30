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
