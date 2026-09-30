import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { filterRecords, recordsCsv } from '../src/lib/recordTools.js'

const source = fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8')
function fixture() {
  const properties = new Map(), sent = [], activities = []
  const metadata = { status: 'Approved', type: 'Travel Order' }
  const record = { id: 'TO-1', type: 'Travel Order', status: 'Approved', url: 'https://drive.google.com/file/d/registered/view' }
  const entry = { metadata, record, cell: { setNote(value) { Object.assign(metadata, JSON.parse(value)) } } }
  const blob = { getBytes: () => [1, 2], setName() { return this } }
  const context = vm.createContext({
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (algorithm, value) => createHash(algorithm).update(value).digest(), base64Encode: value => Buffer.from(value).toString('base64') },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: message => sent.push(message) },
    DriveApp: { getFileById: () => ({ isTrashed: () => false, getMimeType: () => 'application/pdf', getBlob: () => blob, getName: () => 'Order.pdf' }) },
    CacheService: { getScriptCache: () => ({ get: key => key.startsWith('issued:') ? '100' : 'admin@jhcsc.edu.ph' }) },
  })
  vm.runInContext(source, context)
  context.jsonResponse = value => value
  context.workflowDocument = () => entry
  context.canChangeDocumentStatus = () => true
  context.syncCreatedDocumentStatus = () => {}
  context.appendActivityEvent = event => activities.push(event)
  return { context, properties, sent, activities, entry }
}
const user = { email: 'admin@jhcsc.edu.ph', name: 'Admin', role: 'admin' }
const request = { id: 'TO-1', token: 'valid', requestId: '11111111-1111-1111-1111-111111111111', to: 'recipient@example.com', cc: 'copy@example.com', subject: 'Travel order', message: 'Please see attached.' }

test('email uses registered PDF, preserves CC, locks OUT, and retries without resending', () => {
  const f = fixture()
  assert.equal(f.context.sendRegisteredDocument(request, user).document.status, 'Out')
  f.context.sendRegisteredDocument(request, user)
  assert.equal(f.sent.length, 1)
  assert.equal(f.sent[0].cc, request.cc)
  assert.equal(f.sent[0].replyTo, user.email)
  assert.equal(f.activities.length, 1)
  assert.equal(f.entry.metadata.status, 'Out')
  assert.throws(() => f.context.sendRegisteredDocument({ ...request, to: 'different@example.com' }, user), /different recipients/)
})
test('sending enforces admin access, approved status, valid recipients, and mail quota', () => {
  const f = fixture()
  f.context.canChangeDocumentStatus = () => false
  assert.throws(() => f.context.sendRegisteredDocument(request, user), /Admin access/)
  f.context.canChangeDocumentStatus = () => true
  f.entry.record.status = 'Draft'
  assert.throws(() => f.context.sendRegisteredDocument(request, user), /Approve/)
  f.entry.record.status = 'Approved'
  assert.throws(() => f.context.sendRegisteredDocument({ ...request, cc: 'bad-address' }, user), /valid email/)
  f.context.MailApp.getRemainingDailyQuota = () => 0
  assert.throws(() => f.context.sendRegisteredDocument(request, user), /quota/)
  assert.equal(f.sent.length, 0)
})
test('uncertain mail result prevents an automatic resend', () => {
  const f = fixture()
  f.context.MailApp.sendEmail = () => { throw new Error('Connection interrupted') }
  assert.throws(() => f.context.sendRegisteredDocument(request, user), /interrupted/)
  f.context.MailApp.sendEmail = () => f.sent.push('unexpected')
  assert.throws(() => f.context.sendRegisteredDocument(request, user), /uncertain result/)
  assert.equal(f.sent.length, 0)
})
test('a retry repairs status after email succeeds but registry synchronization fails', () => {
  const f = fixture()
  f.context.syncCreatedDocumentStatus = () => { throw new Error('Sheet unavailable') }
  assert.throws(() => f.context.sendRegisteredDocument(request, user), /Sheet unavailable/)
  f.context.syncCreatedDocumentStatus = () => {}
  assert.equal(f.context.sendRegisteredDocument(request, user).document.status, 'Out')
  assert.equal(f.sent.length, 1)
})
test('verification exposes only registry facts and rejects missing or deleted entries', () => {
  const f = fixture(), code = 'a'.repeat(72)
  let deleted = false
  f.context.mainFilesSheet = () => ({ getLastRow: () => 2, getRange: () => ({
    getNotes: () => [[JSON.stringify({ verificationCode: code, deleted, type: 'Travel Order', status: 'Approved' })]],
    getDisplayValues: () => [['Created', 'TO-1', '2026-09-28', 'Private subject', 'private-url']],
  }) })
  const result = f.context.verifyRegisteredDocument(code)
  assert.deepEqual(Object.keys(result.document).sort(), ['date', 'id', 'status', 'type'])
  assert.throws(() => f.context.verifyRegisteredDocument('x'), /Invalid/)
  assert.throws(() => f.context.verifyRegisteredDocument('b'.repeat(72)), /No registered/)
  deleted = true
  assert.throws(() => f.context.verifyRegisteredDocument(code), /no longer/)
})
test('account deactivation and password resets invalidate issued sessions', () => {
  const f = fixture()
  assert.equal(Boolean(f.context.sessionRevoked(user.email, 'valid')), false)
  f.properties.set('account:' + user.email, JSON.stringify({ disabled: true }))
  assert.equal(f.context.sessionRevoked(user.email, 'valid'), true)
  f.properties.set('account:' + user.email, JSON.stringify({ revokedBefore: 101 }))
  assert.equal(f.context.sessionRevoked(user.email, 'valid'), true)
})
test('account mutations reject non-super-admin users before writing', () => {
  const f = fixture()
  assert.throws(() => f.context.manageAccount({ action: 'createUser' }, user), /Super admin/)
  assert.equal(f.properties.size, 0)
})
test('super admins cannot delete or demote themselves or remove the last active super admin', () => {
  const f = fixture()
  const rows = [['only@jhcsc.edu.ph', 'Only Admin', 'hash', 'super admin']]
  f.context.appSpreadsheet = () => ({ getSheetByName: () => ({ getLastRow: () => 2, getRange: () => ({ getDisplayValues: () => rows }) }) })
  const self = { email: rows[0][0], name: rows[0][1], role: 'super admin' }
  assert.throws(() => f.context.manageAccount({ action: 'deleteUser', email: self.email }, self), /own account/)
  assert.throws(() => f.context.manageAccount({ action: 'updateUser', email: self.email, role: 'user' }, self), /own account/)
  assert.throws(() => f.context.manageAccount({ action: 'deleteUser', email: self.email }, { ...self, email: 'other@jhcsc.edu.ph' }), /At least one/)
  assert.equal(f.properties.size, 0)
})
test('content editing regenerates the existing template and saves its form and registry title', () => {
  const f = fixture()
  f.entry.record.type = 'Certificate of Travel'
  f.entry.record.status = 'Draft'
  f.entry.metadata.form = { reference: 'CTA-1', templateVersion: 2, date: '2026-09-28' }
  f.entry.metadata.createdDocumentId = 'internal'
  f.entry.sheet = { getRange: () => ({ setRichTextValue(value) { f.title = value } }) }
  f.context.SpreadsheetApp = { newRichTextValue: () => ({ setText(value) { return { build: () => value } } }) }
  f.context.DriveApp.getFileById = () => ({ isTrashed: () => false, getMimeType: () => 'application/vnd.google-apps.document', getId: () => 'native' })
  f.context.DocumentApp = { openById: id => ({ id }) }
  f.context.renderCreatedDocument = (doc, data, type) => { f.rendered = { doc, data, type } }
  f.context.createdDocumentSheet = () => ({})
  f.context.logCreatedDocument = () => {}
  const result = f.context.updateDocumentContent({ ...request, body: 'Updated certificate body' })
  assert.equal(result.success, true)
  assert.equal(f.rendered.doc.id, 'native')
  assert.equal(f.rendered.type, 'Certificate of Travel')
  assert.equal(f.entry.metadata.form.body, 'Updated certificate body')
  assert.equal(f.title, 'Certificate of Travel')
  assert.equal(f.activities[0].activity, 'Document content edited')
})
test('OUT documents reject content edits', () => {
  const f = fixture()
  f.entry.record.status = 'Out'
  assert.throws(() => f.context.updateDocumentContent(request), /locked/)
})
test('record filters combine date bounds, type and search; export escapes spreadsheet formulas', () => {
  const records = [
    { reference: '1', title: '=HYPERLINK("bad")', type: 'Travel Order', updated: '2026-09-28', status: 'Approved' },
    { reference: '2', title: 'Other', type: 'Special Order', updated: '2026-08-01', status: 'Draft' },
  ]
  assert.equal(filterRecords(records, { type: 'Travel Order', start: '2026-09-01', end: '2026-09-30', status: 'Approved' }).length, 1)
  assert.equal(filterRecords(records, { query: 'missing' }).length, 0)
  assert.match(recordsCsv(records), /'=HYPERLINK\(""bad""\)/)
})
