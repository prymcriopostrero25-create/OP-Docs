import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8')

test('typed memo lookup transfers only the matching note from a large form tab', () => {
  const context = vm.createContext({})
  vm.runInContext(source, context)
  const reads = []
  const sheet = { getLastRow: () => 10001, getRange(row, column, count) {
    if (column === 2) return { createTextFinder: () => ({
      matchEntireCell() { return this }, matchCase() { return this }, useRegularExpression() { return this }, findNext: () => ({ getRow: () => 9000 }),
    }) }
    reads.push([row, column, count])
    return { getDisplayValues: () => [['internal']], getNotes: () => [[JSON.stringify({ registry: ['Created', 'memo', 'date', 'subject', 'url'], type: 'Executive Memorandum' })]] }
  } }
  context.appSpreadsheet = () => ({ getSheetByName: () => sheet })
  const entries = context.createdRegistryEntries('Executive Memorandum', 'memo')
  assert.equal(entries[0].row, 9000)
  assert.deepEqual(reads, [[9000, 1, 1]])
})

test('document list cache skips repeat sheet scans, refreshes, and invalidates after mutations', () => {
  const cache = new Map()
  const context = vm.createContext({ CacheService: { getScriptCache: () => ({
    get: key => cache.get(key), put: (key, value) => cache.set(key, value), remove: key => cache.delete(key),
  }) } })
  vm.runInContext(source, context)
  let reads = 0
  context.registeredDocuments = () => { reads++; return [{ id: 'doc', status: 'Draft' }] }
  context.jsonResponse = value => value
  context.getDocuments()
  context.getDocuments()
  assert.equal(reads, 1)
  context.getDocuments({ refresh: true })
  assert.equal(reads, 2)
  context.updateDocumentStatus = () => ({ success: true })
  context.doPost({ postData: { contents: JSON.stringify({ action: 'updateDocumentStatus', status: 'For Review' }) } })
  context.getDocuments()
  assert.equal(reads, 3)
  cache.set('documents:v1', 'invalid json')
  assert.equal(context.getDocuments().success, true)
  assert.equal(reads, 4)
})

test('separate authenticated users see shared registry changes and expired sessions are rejected', () => {
  const cache = new Map()
  const context = vm.createContext({ CacheService: { getScriptCache: () => ({
    get: key => cache.get(key), put: (key, value) => cache.set(key, value), remove: key => cache.delete(key),
  }) } })
  vm.runInContext(source, context)
  context.jsonResponse = value => value
  context.getDocumentSession = token => ['user-a', 'user-b'].includes(token)
  let status = 'Draft'
  let reads = 0
  context.registeredDocuments = () => { reads++; return [{ id: 'shared-doc', status }] }
  context.updateDocumentStatus = () => { status = 'For Review'; return { success: true } }
  const post = payload => context.doPost({ postData: { contents: JSON.stringify(payload) } })
  assert.equal(post({ action: 'documents', token: 'user-a' }).documents[0].status, 'Draft')
  assert.equal(post({ action: 'documents', token: 'user-b' }).documents[0].status, 'Draft')
  assert.equal(reads, 1)
  post({ action: 'updateDocumentStatus', token: 'user-a', id: 'shared-doc', status: 'For Review' })
  assert.equal(post({ action: 'documents', token: 'user-b' }).documents[0].status, 'For Review')
  assert.equal(reads, 2)
  assert.equal(post({ action: 'documents', token: 'expired' }).success, false)
  assert.equal(reads, 2)
})

test('unsigned status changes reuse the created row and never open Drive or Docs', () => {
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { flush() {} },
    DriveApp: { getFileById() { throw Error('Unsigned transition must not open Drive') } },
  })
  vm.runInContext(source, context)
  context.canChangeDocumentStatus = () => true
  context.jsonResponse = value => value
  let writes = 0
  context.workflowDocument = (id, targeted, type) => {
    assert.equal(type, 'Special Order')
    return { created: true, row: 100, sheet: { getRange(row, col) { assert.equal(row, 100); assert.equal(col, 11); return { setValue() { writes++ } } } },
      cell: { setNote() {} }, metadata: { form: {}, type }, record: { id, type, status: 'Draft', url: 'https://drive.google.com/file/d/known/view' } }
  }
  context.syncCreatedDocumentStatus = () => { throw Error('Must reuse existing row') }
  context.appendActivityEvent = () => {}
  assert.equal(context.updateDocumentStatus({ id: 'doc', type: 'Special Order', status: 'For Review' }).success, true)
  assert.equal(writes, 1)
})

test('typed previews read only their corresponding form sheet and skip MAIN Files', () => {
  for (const [type, name] of Object.entries({ 'Executive Memorandum': 'EX_Memo', 'Travel Order': 'Trav_Ord', 'Special Order': 'Spe_Ord', 'Authority to Travel Abroad': 'Auth_Travel', 'Certificate of Travel': 'Cert_Travel' })) {
    const context = vm.createContext({})
    vm.runInContext(source, context)
    const accessed = []
    context.getDocumentSession = () => true
    context.jsonResponse = value => value
    context.mainFilesSheet = () => { throw new Error('MAIN Files must not be read') }
    context.documentFromRow = () => ({ id: 'known', type, status: 'Draft' })
    context.appSpreadsheet = () => ({ getSheetByName(sheetName) {
      accessed.push(sheetName)
      assert.equal(sheetName, name)
      return { getLastRow: () => 2, getRange: () => ({
        getDisplayValues: () => [['reference']],
        getNotes: () => [[JSON.stringify({ registry: ['known'], form: { body: 'Preview content' } })]],
      }) }
    } })
    const result = context.documentPage({ id: 'known', type, token: 'valid' })
    assert.equal(result.success, true)
    assert.equal(result.form.body, 'Preview content')
    assert.deepEqual(accessed, [name])
    assert.equal(context.documentPage({ id: 'unknown', type, token: 'valid' }).success, false)
  }
})

test('status updates transfer one registry row even with 10,000 documents', () => {
  let reads = 0, noteReads = 0, released = false, saved
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { released = true } }) },
    SpreadsheetApp: { flush() {} },
  })
  vm.runInContext(source, context)
  context.canChangeDocumentStatus = () => true
  context.jsonResponse = value => value
  context.syncCreatedDocumentStatus = () => {}
  context.appendActivityEvent = () => {}
  context.mainFilesSheet = () => ({ getLastRow: () => 10001, getRange(row, column, count, width) {
    if (count === 10000) return { createTextFinder: () => ({
      matchEntireCell() { return this }, matchCase() { return this }, useRegularExpression() { return this },
      findNext: () => ({ getRow: () => 8000 }),
    }) }
    assert.equal(row, 8000)
    if (width === 5) return { getDisplayValues() { reads++; return [['Created', 'known', '2026-10-01', 'Title', 'url']] } }
    return { getNote() { noteReads++; return JSON.stringify({ status: 'Draft', type: 'Travel Order' }) }, setNote(value) { saved = JSON.parse(value) } }
  } })
  const result = context.updateDocumentStatus({ id: 'known', status: 'Approved' })
  assert.equal(result.document.status, 'Approved')
  assert.equal(reads, 1)
  assert.equal(noteReads, 1)
  assert.ok(saved.approvedAt)
  assert.equal(released, true)
})

test('new rich body source is written once while recovered sources are updated', () => {
  const context = vm.createContext({})
  vm.runInContext(source, context)
  let creates = 0, writes = 0, recovered = false
  const file = { getId: () => 'source', setContent() { writes++ } }
  const folder = { getFilesByName: () => ({ hasNext: () => recovered, next: () => file }), createFile() { creates++; return file } }
  const document = { getId: () => 'doc', getParents: () => ({ hasNext: () => true, next: () => folder }) }
  const data = { bodyRich: { type: 'doc', content: [] } }
  assert.equal(context.storeRichBodyForm(data, document).bodyRichFileId, 'source')
  assert.equal(creates, 1)
  assert.equal(writes, 0)
  recovered = true
  context.storeRichBodyForm(data, document)
  assert.equal(creates, 1)
  assert.equal(writes, 1)
})
function fixture() {
  const counts = { reads: 0, settings: 0, bulk: 0 }
  const rows = [['admin@jhcsc.edu.ph', 'Admin', 'private', 'super admin']]
  const settings = {}
  const sheet = { getLastRow: () => rows.length + 1, getRange: () => ({ getDisplayValues() { counts.reads++; return rows } }) }
  const context = vm.createContext({
    CacheService: { getScriptCache: () => ({ get: key => key.startsWith('issued:') ? '100' : 'admin@jhcsc.edu.ph' }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty(key) { counts.settings++; return settings[key] },
      getProperties() { counts.bulk++; return settings },
    }) },
  })
  vm.runInContext(source, context)
  context.appSpreadsheet = () => ({ getSheetByName: () => sheet })
  context.jsonResponse = value => value
  context.workflowDocument = () => ({ metadata: { form: { templateVersion: 2 } } })
  const post = action => context.doPost({ postData: { contents: JSON.stringify({ action, token: 'valid', id: 'doc' }) } })
  return { context, counts, rows, settings, post }
}

test('workflow authentication and admin authorization share one read, but roles refresh next request', () => {
  const f = fixture()
  assert.equal(f.post('documentDetails').success, true)
  assert.equal(f.counts.reads, 1)
  assert.equal(f.counts.settings, 1)
  f.rows[0][3] = 'user'
  assert.match(f.post('documentDetails').message, /Admin access/)
  assert.equal(f.counts.reads, 2)
  f.settings['account:admin@jhcsc.edu.ph'] = JSON.stringify({ disabled: true })
  assert.match(f.post('currentUser').message, /expired/)
})

test('failed requests clear authorization and subsequent requests recheck revocation', () => {
  const f = fixture()
  f.context.workflowDocument = () => { throw new Error('Unavailable') }
  assert.equal(f.post('documentDetails').success, false)
  f.settings['account:admin@jhcsc.edu.ph'] = JSON.stringify({ revokedBefore: 101 })
  assert.equal(f.context.getDocumentSession('valid'), false)
  assert.equal(f.post('currentUser').success, false)
})

test('user list batches settings and does not expose passwords', () => {
  const f = fixture()
  f.rows.push(['user@jhcsc.edu.ph', 'User', 'secret', 'user'])
  f.settings['account:user@jhcsc.edu.ph'] = JSON.stringify({ disabled: true })
  const result = f.context.getUsers()
  assert.equal(result.users[0].status, 'Active')
  assert.equal(result.users[1].status, 'Inactive')
  assert.equal(f.counts.bulk, 1)
  assert.equal(f.counts.settings, 0)
  assert.equal(JSON.stringify(result).includes('secret'), false)
})

test('account listing reuses authorization credentials only within the same request', () => {
  const f = fixture()
  assert.equal(f.post('users').success, true)
  assert.equal(f.counts.reads, 1)
  f.rows[0][3] = 'user'
  assert.equal(f.post('users').success, false)
  assert.equal(f.counts.reads, 2)
})

test('reading login logs requires no sheet writes', () => {
  const f = fixture()
  f.rows.splice(0, 1, ['9/30/2026 8:00 AM', 'Admin logged in'])
  assert.equal(f.context.getUserLogs().logs[0].timestamp, '9/30/2026 8:00 AM')
  assert.equal(f.counts.reads, 1)
})

test('overview returns counts without document details, activity history or Drive reads', () => {
  const f = fixture()
  f.context.createdRegistryEntries = () => []
  const rows = [
    ['Created', 'EM-1', '2026-10-01'],
    ['Uploaded', 'SO-2', '2026-09-01'],
    ['Created', 'deleted', '2026-10-01'],
    ['Uploaded', '1cb7ca84-b1d8-420a-a4ce-84dc89f79281', '2026-10-01'],
  ]
  const notes = [
    { type: 'Executive Memorandum', status: 'Approved', updated: '2026-09-30T16:30:00Z', form: { body: 'Private body' } },
    { type: 'Special Order', status: 'Draft' },
    { deleted: true },
    {},
  ].map(value => [JSON.stringify(value)])
  const reads = []
  f.context.mainFilesSheet = () => ({ getLastRow: () => rows.length + 1, getRange(row, column, count, width) {
    reads.push([row, column, count, width])
    return { getDisplayValues: () => rows, getNotes: () => notes }
  } })
  f.context.Utilities = { formatDate: date => new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 7) }
  f.context.getActivityLogs = () => { throw Error('Overview must not read activity history') }
  assert.equal(f.post('overview').success, true)
  const result = f.context.getOverview()
  assert.equal(result.summary.total, 2)
  assert.equal(result.summary.types['Executive Memorandum'], 1)
  assert.equal(result.summary.statuses.Approved, 1)
  assert.equal(result.summary.months['2026-10'], 1)
  assert.equal(result.summary.months['2026-09'], 1)
  assert.equal(JSON.stringify(result).includes('Private body'), false)
  assert.deepEqual(reads.slice(0, 2), [[2, 1, 4, 3], [2, 2, 4, 1]])
  f.context.getDocumentSession = () => false
  assert.equal(f.post('overview').success, false)
})
