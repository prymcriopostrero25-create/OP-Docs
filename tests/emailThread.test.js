import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { Buffer } from 'node:buffer'

const source = fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8')
const link = 'https://mail.google.com/mail/u/0/#all/abc123'

test('forwards preserve threading, recipients, branding and original attachment without duplicate sends', () => {
  const { context } = fixture()
  const stored = new Map()
  let sends = 0, raw = ''
  let remarks = 'Incoming'
  context.SpreadsheetApp = { flush() {} }
  context.appSpreadsheet = () => ({ getSheetByName: () => ({ getLastRow: () => 2, getRange: (row, col) => col === 7 ? { getDisplayValues: () => [[link]], getRichTextValues: () => [[null]] } : { setValue: value => { assert.equal(sends, 1); remarks = value } } }) })
  context.sessionAccount = () => ({ email: 'admin@jhcsc.edu.ph' })
  context.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: key => stored.get(key), setProperty: (key, value) => stored.set(key, value) }) }
  context.Utilities.newBlob = value => ({ getBytes: () => Buffer.from(value), getDataAsString: () => Buffer.from(value).toString() })
  context.Utilities.base64Encode = value => Buffer.from(value).toString('base64')
  context.Utilities.base64EncodeWebSafe = value => Buffer.from(value).toString('base64url')
  context.Utilities.getUuid = () => 'test-boundary'
  context.Utilities.DigestAlgorithm = { SHA_256: 'sha256' }
  context.Utilities.computeDigest = (_, value) => Buffer.from(value)
  context.Gmail.Users.getProfile = () => ({ emailAddress: 'main@jhcsc.edu.ph' })
  const original = 'Subject: Meeting\r\n\r\nOriginal'
  context.Gmail.Users.Messages.get = () => ({ raw: [...Buffer.from(original)] })
  context.Gmail.Users.Messages.send = value => { sends++; assert.equal(value.threadId, 'thread1'); raw = Buffer.from(value.raw, 'base64url').toString(); return { id: 'sent1' } }
  const target = { id: 'message1', payload: { headers: [{ name: 'Subject', value: 'Meeting' }, { name: 'Message-ID', value: '<original@example.com>' }, { name: 'References', value: '<earlier@example.com>' }] } }
  const thread = { id: 'thread1', messages: [target] }
  target.payload.parts = [{ mimeType: 'multipart/mixed', parts: [
    { mimeType: 'text/plain', body: { data: [...Buffer.from('Original invitation text')] } },
    { filename: 'Letter.pdf', mimeType: 'application/pdf', body: { data: [...Buffer.from('%PDF-original')] } },
    { filename: 'Confirmation.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', body: { attachmentId: 'docx1' } },
  ] }]
  context.Gmail.Users.Messages.Attachments = { get: (account, id, attachmentId) => {
    assert.equal(id, 'message1'); assert.equal(attachmentId, 'docx1')
    return { data: [...Buffer.from('original-docx-bytes')] }
  } }
  const request = { link, messageId: 'message1', to: 'one@example.com, two@example.com', subject: 'Changed subject', message: 'Please review.', requestId: 'forward-request-123456' }
  request.bodyRich = { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Please review.', marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }] }] }] }
  assert.equal(context.forwardRegisteredEmail(request, thread).success, true)
  const htmlPart = raw.match(/Content-Type: text\/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/)
  const html = Buffer.from(htmlPart[1].replace(/\s/g, ''), 'base64').toString()
  assert.match(html, /<u><em><strong>Please review\.<\/strong><\/em><\/u>/)
  assert.match(html, /text-align:center/)
  const plainPart = raw.match(/Content-Type: text\/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/)
  const plain = Buffer.from(plainPart[1].replace(/\s/g, ''), 'base64').toString()
  assert.match(plain, /Please review\.[\s\S]*Forwarded message[\s\S]*Subject: Meeting[\s\S]*Original invitation text/)
  assert.match(html, /Forwarded message[\s\S]*Original invitation text/)
  assert.throws(() => context.forwardRegisteredEmail({ ...request, bodyRich: { ...request.bodyRich, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Please review.' }] }] } }, thread), /different content/)
  assert.match(raw, /To: one@example.com, two@example.com\r\n/)
  assert.match(raw, /In-Reply-To: <original@example.com>/)
  assert.match(raw, /References: <earlier@example.com> <original@example.com>/)
  assert.ok(raw.includes('Subject: =?UTF-8?B?' + Buffer.from('Meeting').toString('base64') + '?='))
  assert.match(raw, /Content-ID: <jhcsc-email-logo>/)
  assert.doesNotMatch(raw, /forwarded-email\.eml/)
  assert.match(raw, /filename="Letter.pdf"/)
  assert.match(raw, /filename="Confirmation.docx"/)
  assert.ok(raw.includes(Buffer.from('%PDF-original').toString('base64')))
  assert.ok(raw.includes(Buffer.from('original-docx-bytes').toString('base64')))
  assert.equal(context.forwardRegisteredEmail(request, thread).success, true)
  assert.equal(sends, 1)
  assert.equal(remarks, 'Forwarded')
  assert.throws(() => context.forwardRegisteredEmail({ ...request, messageId: 'outside' }, thread), /Choose a message/)
})

test('forward template reuses remarks branding and escapes custom subject and body', () => {
  const { context } = fixture()
  const html = context.emailRemarksHtml('Incoming', '<Subject>', { message: 'Hello <script>\nSecond line & text' })
  assert.match(html, /cid:jhcsc-email-logo/)
  assert.match(html, /Office of the President/)
  assert.match(html, /FORWARDED EMAIL/)
  assert.match(html, /&lt;Subject&gt;/)
  assert.match(html, /Hello &lt;script&gt;<br>Second line &amp; text/)
  assert.match(html, /original attachments are included as separate files/i)
  assert.doesNotMatch(html, /<script>/)
})

test('forwarded originals preserve bytes from Gmail arrays and encoded strings', () => {
  const { context } = fixture()
  context.Utilities.base64Encode = bytes => Buffer.from(bytes).toString('base64')
  const original = Buffer.from('Subject: Forward test\r\n\r\nHello café 😀')
  for (const raw of [original.toString('base64url'), original.toString('base64'), [...original], [...original].map(byte => byte > 127 ? byte - 256 : byte)]) {
    assert.deepEqual(Buffer.from(context.forwardedEmailBase64(raw), 'base64'), original)
  }
  for (const raw of [null, {}, [], [256], 'a', 'invalid!']) {
    assert.throws(() => context.forwardedEmailBase64(raw))
  }
})

test('opening a conversation marks loaded unread messages as read in Gmail', () => {
  const { context } = fixture()
  const changes = []
  context.Gmail.Users.Messages.batchModify = (body, user) => changes.push({ body: JSON.parse(JSON.stringify(body)), user })
  context.Gmail.Users.Threads.get = () => ({ messages: [
    { id: 'unread', labelIds: ['UNREAD', 'INBOX'], internalDate: '1', payload: {} },
    { id: 'read', labelIds: ['INBOX'], internalDate: '2', payload: {} },
    { id: 'trashed', labelIds: ['UNREAD', 'TRASH'], internalDate: '3', payload: {} },
  ] })
  assert.equal(context.getEmailThread({ action: 'emailThread', link }).success, true)
  assert.deepEqual(changes, [{ body: { ids: ['unread'], removeLabelIds: ['UNREAD'] }, user: 'me' }])
  context.getEmailThread({ action: 'emailThread', link: link + 'invalid' })
  assert.equal(changes.length, 1)
})
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

test('replies use server recipients and threading, deduplicate confirmed sends, and block uncertain retries', () => {
  const { context } = fixture()
  const stored = new Map()
  let sends = 0, sentRaw = ''
  context.sessionAccount = () => ({ email: 'admin@jhcsc.edu.ph' })
  context.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: key => stored.get(key), setProperty: (key, value) => stored.set(key, value) }) }
  context.Utilities.newBlob = value => ({ getBytes: () => Buffer.from(value) })
  context.Utilities.base64Encode = value => Buffer.from(value).toString('base64')
  context.Utilities.base64EncodeWebSafe = value => Buffer.from(value).toString('base64url')
  context.Utilities.getUuid = () => 'test-boundary'
  context.Utilities.DigestAlgorithm = { SHA_256: 'sha256' }
  context.Utilities.computeDigest = (_, value) => Buffer.from(value)
  context.Gmail.Users.getProfile = () => ({ emailAddress: 'main@jhcsc.edu.ph' })
  context.Gmail.Users.Messages.send = value => { sends++; assert.equal(value.threadId, 'thread1'); sentRaw = Buffer.from(value.raw, 'base64url').toString(); return { id: 'sent1' } }
  const target = { id: 'message1', payload: { headers: [{ name: 'From', value: 'Sender <sender@example.com>' }, { name: 'Reply-To', value: 'Office <office@example.com>' }, { name: 'Subject', value: 'Meeting' }, { name: 'Message-ID', value: '<original@example.com>' }] } }
  const thread = { id: 'thread1', messages: [target] }
  const request = { link, messageId: 'message1', message: 'Thank you.', attachments: [{ name: 'report.pdf', mimeType: 'application/pdf', data: Buffer.from('%PDF-example').toString('base64') }], requestId: 'reply-request-123456' }
  assert.equal(context.replyToRegisteredThread(request, thread).success, true)
  assert.match(sentRaw, /multipart\/mixed/)
  assert.match(sentRaw, /filename="report.pdf"/)
  assert.ok(sentRaw.includes(Buffer.from('%PDF-example').toString('base64')))
  assert.match(sentRaw, /To: office@example.com/)
  assert.match(sentRaw, /In-Reply-To: <original@example.com>/)
  assert.equal(context.replyToRegisteredThread(request, thread).success, true)
  assert.equal(sends, 1)
  assert.throws(() => context.replyToRegisteredThread({ ...request, message: 'Changed' }, thread), /different content/)
  assert.throws(() => context.replyToRegisteredThread({ ...request, messageId: 'outside' }, thread), /incoming message/)
  assert.throws(() => context.replyToRegisteredThread({ ...request, message: '' }, thread), /Enter a reply/)
  context.Gmail.Users.Messages.send = () => { sends++; throw new Error('Network interrupted') }
  const uncertain = { ...request, requestId: 'reply-uncertain-123456' }
  assert.throws(() => context.replyToRegisteredThread(uncertain, thread), /Network interrupted/)
  assert.throws(() => context.replyToRegisteredThread(uncertain, thread), /Delivery is uncertain/)
  assert.equal(sends, 2)
})

test('reply formatting preserves styles and escapes message text', () => {
  const { context } = fixture()
  const rich = context.validateRichBody({ type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: '<script>example</script>', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#123456', fontSize: '14pt', fontFamily: 'Arial' } }] }] }] })
  const html = context.replyRichHtml(rich)
  assert.match(html, /text-align:center/)
  assert.match(html, /<strong>&lt;script&gt;example&lt;\/script&gt;<\/strong>/)
  assert.match(html, /color:#123456;font-family:Arial;font-size:14pt/)
  assert.doesNotMatch(html, /<script>/)
})

test('editor RGB colors normalize safely for email formatting', () => {
  const { context } = fixture()
  const document = color => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Forward', marks: [{ type: 'textStyle', attrs: { color } }] }] }] })
  assert.match(context.replyRichHtml(context.validateRichBody(document('rgb(0, 128, 255)'))), /color:#0080ff/)
  assert.match(context.replyRichHtml(context.validateRichBody(document('#abc'))), /color:#aabbcc/)
  for (const color of ['rgb(256, 0, 0)', 'red;display:none', 'url(https://example.com)']) {
    assert.throws(() => context.validateRichBody(document(color)), /Unsupported text color/)
  }
})

test('pasted email text sends with optional styles and unsupported fonts removed', () => {
  const { context } = fixture()
  const source = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pasted message', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { fontFamily: 'Aptos, sans-serif', fontSize: '16px', color: 'inherit' } }] }] }] }
  const html = context.replyRichHtml(context.validateRichBody(source, true))
  assert.match(html, /<strong>Pasted message<\/strong>/)
  assert.doesNotMatch(html, /Aptos|16px|inherit/)
  source.content[0].content[0].marks[1].attrs = { fontFamily: '"Arial", sans-serif', fontSize: '12pt' }
  assert.match(context.replyRichHtml(context.validateRichBody(source, true)), /font-family:Arial;font-size:12pt/)
})

test('reply attachments reject invalid names, encoding, and excessive file counts', () => {
  const { context } = fixture()
  assert.throws(() => context.validateReplyAttachments([{ name: 'bad\r\nheader.pdf', data: '' }]), /filename/)
  assert.throws(() => context.validateReplyAttachments([{ name: 'report.pdf', data: '!!!' }]), /data/)
  assert.throws(() => context.validateReplyAttachments(Array(11).fill({})), /10 attachments/)
  assert.equal(context.validateReplyAttachments([{ name: 'report.pdf', data: 'YQ==', mimeType: 'text/plain\r\nInjected: yes' }])[0].mimeType, 'application/octet-stream')
})

test('conversation resolves attached CID logos without loading external images', () => {
  const { context } = fixture()
  const html = '<img src="cid:jhcsc-email-logo"><img src="https://example.com/tracker.png">'
  context.Utilities.base64DecodeWebSafe = value => Buffer.from(value, 'base64url')
  context.Utilities.base64Encode = value => Buffer.from(value).toString('base64')
  context.Gmail.Users.Messages.Attachments.get = () => ({ data: Buffer.from('logo bytes').toString('base64url') })
  context.Gmail.Users.Threads.get = () => ({ messages: [{ id: 'message1', internalDate: '1', payload: { parts: [
    { mimeType: 'text/html', body: { data: Buffer.from(html).toString('base64url') } },
    { filename: 'jhcsc-logo.png', mimeType: 'image/png', headers: [{ name: 'Content-ID', value: '<jhcsc-email-logo>' }], body: { attachmentId: 'logo', size: 10 } },
  ] } }] })
  const result = context.getEmailThread({ action: 'emailThread', link })
  assert.equal(result.success, true)
  assert.ok(result.messages[0].html.includes('src="data:image/png;base64,' + Buffer.from('logo bytes').toString('base64') + '"'))
  assert.ok(result.messages[0].html.includes('https://example.com/tracker.png'))
})

test('inline image decoding accepts Gmail formats and failures preserve the conversation', () => {
  for (const data of ['-_8', [251, 255], [-5, -1], '!!!', null]) {
    const { context } = fixture()
    const html = '<p>Message remains readable</p><img src="cid:logo">'
    context.Utilities.base64Encode = bytes => Buffer.from(bytes).toString('base64')
    context.Gmail.Users.Messages.Attachments.get = () => {
      if (data === null) throw new Error('Attachment unavailable')
      return { data }
    }
    context.Gmail.Users.Threads.get = () => ({ messages: [{ id: 'message1', internalDate: '1', payload: { parts: [
      { mimeType: 'text/html', body: { data: Buffer.from(html).toString('base64url') } },
      { mimeType: 'image/png', headers: [{ name: 'Content-ID', value: '<logo>' }], body: { attachmentId: 'image', size: 2 } },
    ] } }] })
    const result = context.getEmailThread({ action: 'emailThread', link })
    assert.equal(result.success, true)
    assert.ok(result.messages[0].html.includes('Message remains readable'))
    if (data !== null && data !== '!!!') assert.ok(result.messages[0].html.includes('data:image/png;base64,+/8='))
    else assert.ok(result.messages[0].html.includes('cid:logo'))
  }
})
