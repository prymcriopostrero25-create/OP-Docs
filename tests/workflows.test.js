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
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (algorithm, value) => createHash(algorithm).update(value).digest(), base64Encode: value => Buffer.from(value).toString('base64'), base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'), newBlob: value => ({ getBytes: () => Buffer.from(value, 'utf8') }), getUuid: () => 'mime-boundary' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Gmail: { Users: { getProfile: () => ({ emailAddress: 'owner@jhcsc.edu.ph' }), Messages: { send: (message, mailbox) => { assert.equal(mailbox, 'me'); sent.push(message); return { id: 'gmail-sent-1' } } } } },
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

test('email attachment preparation warms the revision cache without sending or changing status', () => {
  const f = fixture(), cache = new Map()
  let exports = 0, revision = 1
  f.context.CacheService = { getScriptCache: () => ({
    get: key => cache.get(key), getAll: keys => Object.fromEntries(keys.map(key => [key, cache.get(key)])),
    put: (key, value) => cache.set(key, value), putAll: values => Object.entries(values).forEach(([key, value]) => cache.set(key, value)),
  }) }
  f.context.Utilities.base64Decode = value => Buffer.from(value, 'base64')
  f.context.DriveApp.getFileById = id => {
    assert.equal(id, 'registered')
    return { isTrashed: () => false, getMimeType: () => 'application/vnd.google-apps.document',
      getId: () => id, getLastUpdated: () => new Date(revision), getName: () => 'Order',
      getAs: () => { exports++; return { getBytes: () => [1, 2] } },
    }
  }
  assert.equal(f.context.prepareEmailAttachment(request).name, 'Order.pdf')
  assert.equal(exports, 1)
  assert.equal(f.sent.length, 0)
  assert.equal(f.entry.metadata.status, 'Approved')
  f.context.sendRegisteredDocument(request, user)
  assert.equal(exports, 1)
  revision++
  assert.equal(f.context.prepareEmailAttachment(request).success, true)
  assert.equal(exports, 2)
})

test('email attachment preparation rejects unauthorized and unapproved documents', () => {
  const f = fixture()
  f.context.canChangeDocumentStatus = () => false
  assert.match(f.context.prepareEmailAttachment(request).message, /Admin access/)
  f.context.canChangeDocumentStatus = () => true
  f.entry.record.status = 'Draft'
  assert.match(f.context.prepareEmailAttachment(request).message, /Approve/)
  assert.equal(f.sent.length, 0)
})

test('a changed Drive revision cannot send the PDF prepared for an earlier revision', () => {
  const f = fixture()
  f.context.DriveApp.getFileById = () => ({ isTrashed: () => false, getLastUpdated: () => new Date(200) })
  assert.throws(() => f.context.sendRegisteredDocument({ ...request, attachmentRevision: '100' }, user), /changed after/)
  assert.equal(f.sent.length, 0)
  assert.equal(f.entry.metadata.status, 'Approved')
})

test('send status confirms the persisted Gmail receipt without waiting on spreadsheet lock', () => {
  const f = fixture()
  f.context.sendRegisteredDocument(request, user)
  const key = 'sent:' + request.requestId
  const receipt = JSON.parse(f.properties.get(key))
  delete receipt.registryComplete
  f.properties.set(key, JSON.stringify(receipt))
  f.context.LockService = { getScriptLock: () => ({ tryLock: () => false, waitLock() { throw Error('Must not wait') }, releaseLock() { throw Error('Must not release unowned lock') } }) }
  f.context.workflowDocument = () => { throw Error('Must not read the spreadsheet') }
  const result = f.context.documentSendStatus(request, user)
  assert.equal(result.confirmed, true)
  assert.equal(result.document.status, 'Out')
  assert.equal(result.registryPending, true)
  assert.equal(f.sent.length, 1)
  assert.throws(() => f.context.documentSendStatus({ ...request, to: 'different@example.com' }, user), /does not match/)
})

test('email uses registered PDF, preserves CC, locks OUT, and retries without resending', () => {
  const f = fixture()
  assert.equal(f.context.sendRegisteredDocument(request, user).document.status, 'Out')
  f.context.sendRegisteredDocument(request, user)
  assert.equal(f.sent.length, 1)
  const mime = Buffer.from(f.sent[0].raw, 'base64url').toString('utf8')
  assert.ok(mime.includes('Cc: ' + request.cc))
  assert.ok(mime.includes('Reply-To: ' + user.email))
  assert.ok(mime.includes('<owner@jhcsc.edu.ph>'))
  const from = mime.match(/From: ([\s\S]*?) <owner@/)[1]
  assert.equal([...from.matchAll(/=\?UTF-8\?B\?([^?]*)\?=/g)].map(match => Buffer.from(match[1], 'base64').toString('utf8')).join(''), 'J.H. Cerilles State College Office of the President')
  assert.ok(mime.includes('Content-Type: application/pdf'))
  assert.ok(mime.includes('filename*=UTF-8\'\'Order.pdf'))
  assert.ok(mime.includes(Buffer.from([1, 2]).toString('base64')))
  assert.ok(mime.includes(Buffer.from(request.message).toString('base64')))
  assert.equal(JSON.parse(f.properties.get('sent:' + request.requestId)).gmailMessageId, 'gmail-sent-1')
  assert.equal(f.activities.length, 1)
  assert.equal(f.entry.metadata.status, 'Out')
  assert.throws(() => f.context.sendRegisteredDocument({ ...request, to: 'different@example.com' }, user), /different recipients/)
})
test('sending enforces admin access, approved status, valid recipients, and Gmail access', () => {
  const f = fixture()
  f.context.canChangeDocumentStatus = () => false
  assert.throws(() => f.context.sendRegisteredDocument(request, user), /Admin access/)
  f.context.canChangeDocumentStatus = () => true
  f.entry.record.status = 'Draft'
  assert.throws(() => f.context.sendRegisteredDocument(request, user), /Approve/)
  f.entry.record.status = 'Approved'
  assert.throws(() => f.context.sendRegisteredDocument({ ...request, cc: 'bad-address' }, user), /valid email/)
  f.context.Gmail.Users.getProfile = () => { throw new Error('Gmail authorization required') }
  assert.throws(() => f.context.sendRegisteredDocument(request, user), /authorization/)
  assert.equal(f.sent.length, 0)
  assert.equal(f.properties.size, 0)
})
test('uncertain mail result prevents an automatic resend', () => {
  const f = fixture()
  f.context.Gmail.Users.Messages.send = () => { throw new Error('Connection interrupted') }
  assert.throws(() => f.context.sendRegisteredDocument(request, user), /interrupted/)
  f.context.Gmail.Users.Messages.send = () => f.sent.push('unexpected')
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

test('Gmail MIME preserves Unicode and prevents injected email headers', () => {
  const f = fixture()
  const subject = 'Official résumé — ' + '旅行'.repeat(60) + '\r\nBcc: hidden@example.com'
  const raw = f.context.gmailPdfMessage(user, 'owner@jhcsc.edu.ph', [request.to], [], subject, 'Good day, José.', { getBytes: () => [1, 2] }, 'Résumé "旅行"')
  const mime = Buffer.from(raw, 'base64url').toString('utf8')
  assert.ok(!mime.includes('\r\nBcc:'))
  assert.ok(!mime.includes('\r\nCc:'))
  assert.ok(mime.includes('filename*=UTF-8\'\'R%C3%A9sum%C3%A9%20%22%E6%97%85%E8%A1%8C%22.pdf'))
  const encodedSubject = mime.match(/Subject: ([\s\S]*?)\r\nMIME-Version:/)[1]
  const decoded = [...encodedSubject.matchAll(/=\?UTF-8\?B\?([^?]*)\?=/g)].map(match => {
    assert.ok(match[0].length <= 75)
    return Buffer.from(match[1], 'base64').toString('utf8')
  }).join('')
  assert.equal(decoded, subject.replace(/[\r\n]/g, ' '))
  assert.ok(mime.includes(Buffer.from('Good day, José.').toString('base64')))
  assert.throws(() => f.context.gmailPdfMessage(user, 'owner@jhcsc.edu.ph', ['ok@example.com\r\nBcc: bad@example.com'], [], 'Subject', 'Body', { getBytes: () => [1] }, 'Doc'), /Invalid/)
})

test('Gmail must confirm a message ID before the document becomes OUT', () => {
  const f = fixture()
  f.context.Gmail.Users.Messages.send = () => ({})
  assert.throws(() => f.context.sendRegisteredDocument(request, user), /did not confirm/)
  assert.equal(f.entry.metadata.status, 'Approved')
  assert.equal(f.activities.length, 0)
  assert.equal(JSON.parse(f.properties.get('sent:' + request.requestId)).state, 'pending')
  assert.throws(() => f.context.sendRegisteredDocument(request, user), /uncertain result/)
})

test('send status recovers a successful Gmail send without sending again', () => {
  const f = fixture()
  assert.equal(f.context.documentSendStatus(request, user).confirmed, false)
  f.context.sendRegisteredDocument(request, user)
  assert.equal(f.context.documentSendStatus(request, user).document.status, 'Out')
  assert.equal(f.sent.length, 1)
  assert.equal(f.activities.length, 1)
  assert.throws(() => f.context.documentSendStatus(request, { ...user, email: 'other@example.com' }), /does not match/)
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
  f.context.Utilities.base64Decode = value => value
  const result = f.context.updateDocumentContent({ ...request, logo: 'logo', body: 'Updated certificate body' })
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
