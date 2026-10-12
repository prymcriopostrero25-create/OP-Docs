import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { Buffer } from 'node:buffer'

const source = fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8')
const link = 'https://mail.google.com/mail/u/0/#all/abc123'
test('attachment reads are bound to a registered thread and its message part', () => {
  const { context } = fixture()
  let downloads = 0
  context.Utilities.base64Encode = bytes => Buffer.from(bytes).toString('base64')
  context.Gmail.Users.Messages.Attachments.get = (_, messageId, attachmentId) => {
    downloads++
    assert.equal(messageId, 'message1')
    assert.equal(attachmentId, 'attachment1')
    return { data: [...Buffer.from('%PDF-example')] }
  }
  context.Gmail.Users.Threads.get = () => ({ messages: [{ id: 'message1', payload: { parts: [{ partId: '1', filename: 'report.pdf', mimeType: 'application/pdf', body: { attachmentId: 'attachment1', size: 12 } }] } }] })
  const request = { action: 'emailAttachment', link, messageId: 'message1', partId: '1' }
  assert.equal(context.getEmailThread({ ...request, messageId: 'outside-thread' }).success, false)
  assert.equal(context.getEmailThread({ ...request, partId: 'other' }).success, false)
  assert.equal(downloads, 0)
  const result = context.getEmailThread(request)
  assert.equal(result.success, true)
  assert.equal(result.name, 'report.pdf')
  assert.equal(Buffer.from(result.data, 'base64').toString(), '%PDF-example')
})
function fixture() {
  let reads = 0
  const context = vm.createContext({
    Gmail: { Users: {
      Messages: { get: () => { reads++; return { threadId: 'thread1' } }, Attachments: { get: () => ({ data: Buffer.from('Large text body').toString('base64url') }) } },
      Threads: { get: () => ({ messages: [] }) },
    } },
    Utilities: { base64Decode: value => {
      assert.equal(value.length % 4, 0, 'Apps Script needs padded base64')
      assert.match(value, /^[A-Za-z0-9+/]*={0,2}$/)
      return Buffer.from(value, 'base64')
    }, newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }) },
  })
  vm.runInContext(source, context)
  context.getDocumentSession = () => true
  context.jsonResponse = value => value
  context.appSpreadsheet = () => ({ getSheetByName: () => ({ getLastRow: () => 2, getRange: () => ({ getDisplayValues: () => [[link]], getRichTextValues: () => [[null]] }) }) })
  return { context, reads: () => reads }
}
test('conversation requires authentication and a saved register link before Gmail access', () => {
  const { context, reads } = fixture()
  context.getDocumentSession = () => false
  assert.equal(context.getEmailThread({ link }).success, false)
  context.getDocumentSession = () => true
  assert.equal(context.getEmailThread({ link: link + 'other', threadId: 'arbitrary' }).success, false)
  assert.equal(reads(), 0)
})

test('Gmail bodies accept missing padding, URL-safe characters and line wrapping', () => {
  const { context } = fixture()
  for (const text of ['a', 'ab', 'abc', 'Hello café', '😀?']) {
    const encoded = Buffer.from(text).toString('base64url')
    assert.equal(context.decodeGmailBody(encoded), text)
    assert.equal(context.decodeGmailBody(encoded.slice(0, 2) + '\r\n' + encoded.slice(2)), text)
    assert.equal(context.decodeGmailBody(Buffer.from(text).toString('base64')), text)
  }
})

test('advanced Gmail byte arrays are decoded directly, including signed UTF-8 bytes', () => {
  const { context } = fixture()
  context.Utilities.base64Decode = () => { throw new Error('Byte arrays must not be base64-decoded twice') }
  const text = '<p>Hello café 😀</p>'
  const bytes = [...Buffer.from(text)]
  assert.equal(context.decodeGmailBody(bytes), text)
  assert.equal(context.decodeGmailBody(bytes.map(value => value > 127 ? value - 256 : value)), text)
  context.Gmail.Users.Threads.get = () => ({ messages: [{ id: 'received', internalDate: '1000', payload: { mimeType: 'text/html', body: { data: bytes } } }] })
  const result = context.getEmailThread({ link })
  assert.equal(result.success, true)
  assert.equal(result.messages[0].html, text)
})

test('attachment-backed text accepts advanced-service byte arrays', () => {
  const { context } = fixture()
  context.Gmail.Users.Messages.Attachments.get = () => ({ data: [...Buffer.from('Full message body')] })
  context.Gmail.Users.Threads.get = () => ({ messages: [{ id: 'received', internalDate: '1000', payload: { mimeType: 'text/plain', body: { attachmentId: 'body' } } }] })
  const result = context.getEmailThread({ link })
  assert.equal(result.success, true)
  assert.equal(result.messages[0].text, 'Full message body')
})
test('conversation resolves the registered message, decodes multipart bodies, and sorts replies', () => {
  const { context } = fixture()
  const part = (mimeType, text) => ({ mimeType, body: { data: Buffer.from(text).toString('base64url') } })
  context.Gmail.Users.Messages.get = (_, id, options) => {
    assert.equal(id, 'abc123')
    assert.equal(options.format, 'minimal')
    return { threadId: 'saved-thread' }
  }
  context.Gmail.Users.Threads.get = (_, id, options) => {
    assert.equal(id, 'saved-thread')
    assert.equal(options.format, 'full')
    return { messages: [
      { id: 'reply', internalDate: '2000', payload: { mimeType: 'text/plain', body: { attachmentId: 'body1' } } },
      { id: 'sent', internalDate: '3000', labelIds: ['SENT'], payload: part('text/plain', 'Our response') },
      { id: 'original', internalDate: '1000', payload: { headers: [{ name: 'From', value: 'Sender <sender@example.com>' }], parts: [part('text/plain', 'Hello café'), part('text/html', '<b>Hello café</b>'), { filename: 'report.pdf', body: { size: 400 } }] } },
      { id: 'draft', internalDate: '4000', labelIds: ['DRAFT'], payload: part('text/plain', 'Unsent') },
    ] }
  }
  const result = context.getEmailThread({ link, threadId: 'untrusted' })
  assert.equal(result.success, true)
  assert.deepEqual(Array.from(result.messages, message => message.id), ['original', 'reply', 'sent'])
  assert.equal(result.latestMessageId, 'reply')
  assert.equal(result.messages[0].html, '<b>Hello café</b>')
  assert.equal(result.messages[0].text, 'Hello café')
  assert.equal(result.messages[0].attachments[0].name, 'report.pdf')
  assert.equal(result.messages[1].text, 'Large text body')
})
