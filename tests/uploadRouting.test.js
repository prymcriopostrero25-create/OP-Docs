import { test } from 'node:test'
import { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

function fixture({ failWrite = false, failCleanup = false, failLogWrite = false, badLogHeaders = false } = {}) {
  const rows = [['ACTIVITY', 'ID', 'DATE', 'SUBJECT', 'FILE LINKS']]
  const notes = {}
  const logRows = Object.fromEntries(['Executive Memorandum', 'Special Order', 'Travel Order', 'Authority to Travel Abroad', 'Certificate to Travel'].map(name => [name, [[badLogHeaders ? 'WRONG' : 'TIMESTAMP', 'ID', 'YEAR', 'FILE LINKS']]]))
  const created = [], trashed = [], children = new Map()
  function folder(path) {
    return { isTrashed: () => false,
      getFoldersByName: name => { const child = children.get(path + '/' + name); let used = false; return { hasNext: () => !!child && !used, next: () => { used = true; return child } } },
      createFolder: name => { const child = folder(path + '/' + name); children.set(path + '/' + name, child); return child },
      createFile: blob => { created.push({ path, blob }); return { getId: () => 'file-' + created.length, setTrashed: () => trashed.push(path) } },
    }
  }
  const root = folder('OP Systems')
  const sheet = { getLastRow: () => rows.length, getRange: (r, c, n = 1, w = 1) => ({
    getDisplayValues: () => rows.slice(r - 1, r - 1 + n).map(row => row.slice(c - 1, c - 1 + w)),
    setRichTextValues: values => { if (failWrite) throw Error('Sheet write denied'); rows[r - 1] = values[0].map(v => v.text) },
    setNote: value => { notes[r] = value }, getNote: () => notes[r] || '',
    getNotes: () => Array.from({ length: n }, (_, index) => [notes[r + index] || '']),
    clearNote: () => { delete notes[r] },
    clearContent: () => { if (failCleanup) throw Error('Cleanup denied'); rows.splice(r - 1, 1) },
  }) }
  const logs = Object.fromEntries(Object.entries(logRows).map(([name, data]) => [name, {
    getLastRow: () => data.length,
    getRange: (r, c, n = 1, w = 1) => ({
      getDisplayValues: () => data.slice(r - 1, r - 1 + n).map(row => row.slice(c - 1, c - 1 + w)),
      setRichTextValues: values => { if (failLogWrite) throw Error('Category write denied'); data[r - 1] = values[0].map(v => v.text) },
      clearContent: () => { if (failCleanup) throw Error('Cleanup denied'); data.splice(r - 1, 1) },
    }),
  }]))
  const context = {
    console: { error() {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => name === 'MAIN Files' ? sheet : logs[name] }), flush() {}, newRichTextValue: () => {
      const value = {}; return { setText(text) { value.text = text; return this }, setLinkUrl(url) { value.url = url; return this }, build: () => value }
    } },
    Utilities: { base64Decode: s => Array.from(Buffer.from(s, 'base64')), newBlob: (bytes, mime, name) => ({ bytes, mime, name }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: () => null }) },
    DriveApp: { getFolderById: id => { assert.equal(id, '1OVvmtvYjsp4WZz-RY7NkExyNIotO-Vji'); return root } },
  }
  vm.createContext(context)
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  return { context, rows, created, trashed, children, logRows }
}
const request = { name: 'TO104.pdf', type: 'Travel Order', year: '2026', uploadId: '12345678-1234-1234-1234-123456789abc', data: Buffer.from('%PDF-1.7\nfixture').toString('base64') }

test('files by type/year, reloads filing metadata, and deduplicates retries', () => {
  const f = fixture()
  assert.equal(f.context.uploadDocument(request).success, true)
  assert.equal(f.created[0].path, 'OP Systems/Travel Order/2026')
  assert.equal(f.context.getDocuments().documents[0].type, 'Travel Order')
  assert.equal(f.context.getDocuments().documents[0].year, '2026')
  assert.equal(f.context.uploadDocument(request).document.year, '2026')
  assert.equal(f.created.length, 1)
  f.context.uploadDocument({ ...request, uploadId: '22345678-1234-1234-1234-123456789abc' })
  assert.equal(f.children.size, 2)
  f.context.uploadDocument({ ...request, year: '2025', uploadId: '32345678-1234-1234-1234-123456789abc' })
  assert.equal(f.created.at(-1).path, 'OP Systems/Travel Order/2025')
})

test('rejects missing sessions, invalid types, invalid years and non-PDF data before creating folders', () => {
  const f = fixture()
  assert.equal(f.context.doPost({ postData: { contents: JSON.stringify({ ...request, action: 'uploadDocument', token: 'invalid' }) } }).success, false)
  for (const override of [{ type: '../Other' }, { year: '../2026' }, { year: '' }, { data: Buffer.from('invalid').toString('base64') }]) {
    assert.equal(f.context.uploadDocument({ ...request, ...override }).success, false)
  }
  assert.equal(f.children.size, 0)
  assert.equal(f.created.length, 0)
})

test('cleans up a new file on sheet failure; preserves it if cleanup fails', () => {
  const f = fixture({ failWrite: true })
  assert.equal(f.context.uploadDocument(request).success, false)
  assert.equal(f.trashed.length, 1)
  const g = fixture({ failWrite: true, failCleanup: true })
  assert.match(g.context.uploadDocument(request).message, /partial upload/)
  assert.equal(g.trashed.length, 0)
})

test('legacy notes and malformed metadata do not break listing', () => {
  const f = fixture()
  for (const note of ['', 'null', 'unrelated note']) {
    assert.equal(f.context.documentFromRow(['Uploaded', 'id', 'date', 'subject', 'url'], note).type, '')
  }
})


test('logs all five document types to their exact tabs using the requested four columns', () => {
  const f = fixture()
  const types = ['Executive Memorandum', 'Special Order', 'Travel Order', 'Authority to Travel Abroad', 'Certificate of Travel']
  for (const type of types) {
    const id = 'upload-request-' + types.indexOf(type) + '-12345678'
    const result = f.context.uploadDocument({ ...request, type, uploadId: id })
    assert.equal(result.success, true)
    const tab = type === 'Certificate of Travel' ? 'Certificate to Travel' : type
    assert.deepEqual(Array.from(f.logRows[tab][1]), [result.document.date, id, '2026', result.document.url])
    f.context.uploadDocument({ ...request, type, uploadId: id })
    assert.equal(f.logRows[tab].length, 2)
  }
})

test('rejects incorrect log headers before creating a file', () => {
  const f = fixture({ badLogHeaders: true })
  assert.equal(f.context.uploadDocument(request).success, false)
  assert.equal(f.created.length, 0)
})

test('rolls back category row if MAIN Files fails, and file if category logging fails', () => {
  const f = fixture({ failWrite: true })
  assert.equal(f.context.uploadDocument(request).success, false)
  assert.equal(f.logRows['Travel Order'].length, 1)
  assert.equal(f.trashed.length, 1)
  const g = fixture({ failLogWrite: true })
  assert.equal(g.context.uploadDocument(request).success, false)
  assert.equal(g.rows.length, 1)
  assert.equal(g.trashed.length, 1)
})

test('retry repairs a missing category row without re-uploading the file', () => {
  const f = fixture()
  f.context.uploadDocument(request)
  f.logRows['Travel Order'].pop()
  assert.equal(f.context.uploadDocument(request).success, true)
  assert.equal(f.logRows['Travel Order'].length, 2)
  assert.equal(f.created.length, 1)
})

test('new uploads always start For Review, regardless of supplied status', () => {
  const f = fixture()
  assert.equal(f.context.uploadDocument({ ...request, status: 'Approved' }).document.status, 'For Review')
  assert.equal(f.context.getDocuments().documents[0].status, 'For Review')
})

test('status changes require admin authorization and persist without losing filing metadata', () => {
  const f = fixture()
  f.context.uploadDocument(request)
  assert.equal(f.context.updateDocumentStatus({ id: request.uploadId, status: 'Out', token: 'invalid' }).success, false)
  f.context.canChangeDocumentStatus = () => true
  assert.equal(f.context.updateDocumentStatus({ id: request.uploadId, status: 'Filed' }).success, false)
  for (const status of ['Draft', 'For Review', 'For Signature', 'Approved', 'Out']) {
    assert.equal(f.context.updateDocumentStatus({ id: request.uploadId, status }).success, true)
    const record = f.context.getDocuments().documents[0]
    assert.equal(record.status, status)
    assert.equal(record.type, 'Travel Order')
    assert.equal(record.year, '2026')
  }
  assert.equal(f.context.uploadDocument(request).document.status, 'Out')
})

test('Out is final even for an administrator and survives re-upload retries', () => {
  const f = fixture()
  f.context.uploadDocument(request)
  f.context.canChangeDocumentStatus = () => true
  assert.equal(f.context.updateDocumentStatus({ id: request.uploadId, status: 'Out' }).success, true)
  for (const status of ['Draft', 'For Review', 'For Signature', 'Approved', 'Out']) {
    const result = f.context.updateDocumentStatus({ id: request.uploadId, status })
    assert.equal(result.success, false)
    assert.match(result.message, /locked/)
  }
  assert.equal(f.context.getDocuments().documents[0].status, 'Out')
  assert.equal(f.context.uploadDocument(request).document.status, 'Out')
})
