import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8')

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
