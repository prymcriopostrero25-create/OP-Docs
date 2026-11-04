import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { Buffer } from 'node:buffer'
const source = fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8')
function fixture() {
  let remark = 'Incoming', sends = 0, fail = false
  const link = 'https://mail.google.com/mail/u/0/#all/abc123'
  const context = vm.createContext({ LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, SpreadsheetApp: { flush() {} }, PropertiesService: { getScriptProperties: () => ({ deleteProperty() {} }) } })
  vm.runInContext(source, context)
  context.getDocumentSession = () => true
  context.jsonResponse = value => value
  context.appSpreadsheet = () => ({ getSheetByName: () => ({ getLastRow: () => 2, getRange: (row, col) => col === 7 ? { getDisplayValues: () => [[link]], getRichTextValues: () => [[null]] } : { getDisplayValue: () => col === 6 ? remark : 'REF-1', setValue: value => { remark = value } } }) })
  context.sendEmailRemarksReply = request => { sends++; if (fail) throw new Error('Gmail failed'); assert.ok(context.emailRemarksMessage(request.remarks, 'REF-1')); return { key: 'pending' } }
  return { context, update: remarks => context.updateEmailRemarks({ link, remarks }), sends: () => sends, remark: () => remark, fail: () => { fail = true } }
}
test('five distinct templates send on changes, same remark and other remarks do not send', () => {
  const f = fixture(), messages = new Set()
  for (const remark of ['Acknowledge', 'Approved', 'For Action', 'Disapproved', 'Invitations']) {
    messages.add(f.context.emailRemarksMessage(remark, 'REF-1'))
    assert.equal(f.update(remark).emailSent, true)
    assert.equal(f.update(remark).emailSent, false)
  }
  assert.equal(messages.size, 5)
  assert.equal(f.sends(), 5)
  assert.equal(f.update('Completed').emailSent, false)
  assert.equal(f.sends(), 5)
})
test('failed email does not save remarks and invalid sessions cannot send', () => {
  const f = fixture()
  f.fail()
  assert.equal(f.update('Approved').success, false)
  assert.equal(f.remark(), 'Incoming')
  f.context.getDocumentSession = () => false
  assert.equal(f.update('Approved').success, false)
  assert.equal(f.sends(), 1)
})

test('branded templates escape reference text and give each status its own heading', () => {
  const { context } = fixture()
  const headings = new Set()
  for (const remark of ['Acknowledge', 'Approved', 'For Action', 'Disapproved', 'Invitations']) {
    const html = context.emailRemarksHtml(remark, '<unsafe & reference>')
    assert.match(html, /Office of the President/)
    assert.match(html, /&lt;unsafe &amp; reference&gt;/)
    assert.doesNotMatch(html, /<unsafe/)
    assert.match(html, /max-width:600px/)
    assert.match(html, /text-align:center/)
    assert.match(html, /src="cid:jhcsc-email-logo"/)
    headings.add(html.match(/<h1[^>]*>(.*?)<\/h1>/)[1])
  }
  assert.equal(headings.size, 5)
  assert.equal(context.emailRemarksHtml('Completed', 'REF-1'), '')
})

test('automatic reply sends both plain text and branded HTML in the existing thread', () => {
  const { context } = fixture()
  const properties = new Map()
  let raw
  context.sessionAccount = () => ({ email: 'admin@jhcsc.edu.ph' })
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) }
  context.Utilities = {
    newBlob: value => ({ getBytes: () => Buffer.from(value) }),
    base64Encode: value => Buffer.from(value).toString('base64'),
    base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'),
    computeDigest: (_, value) => Buffer.from(value), DigestAlgorithm: { SHA_256: 'sha256' }, getUuid: () => 'boundary-12345678',
  }
  context.Gmail = { Users: { getProfile: () => ({ emailAddress: 'main@jhcsc.edu.ph' }), Messages: { send: value => { assert.equal(value.threadId, 'thread1'); raw = Buffer.from(value.raw, 'base64url').toString(); return { id: 'sent1' } } } } }
  const thread = { id: 'thread1', messages: [{ id: 'incoming1', payload: { headers: [{ name: 'From', value: 'sender@example.com' }, { name: 'Message-ID', value: '<incoming@example.com>' }, { name: 'Subject', value: 'Request' }] } }] }
  const plain = context.emailRemarksMessage('Approved', 'REF-1')
  const html = context.emailRemarksHtml('Approved', 'REF-1')
  const result = context.replyToRegisteredThread({ token: 'session', link: 'registered-link', messageId: 'incoming1', requestId: 'request-1234567890', message: plain }, thread, true, html)
  assert.equal(result.success, true)
  assert.match(raw, /multipart\/alternative/)
  assert.match(raw, /multipart\/related/)
  assert.match(raw, /Content-ID: <jhcsc-email-logo>/)
  assert.match(raw, /Content-Disposition: inline; filename="jhcsc-logo.png"/)
  assert.match(raw, /Content-Type: text\/plain/)
  assert.match(raw, /Content-Type: text\/html/)
  assert.match(raw, /In-Reply-To: <incoming@example.com>/)
  const compact = raw.replace(/\r\n/g, '')
  assert.ok(compact.includes(Buffer.from(plain).toString('base64')))
  assert.ok(compact.includes(Buffer.from(html).toString('base64')))
})
