import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8')
test('thread replies save the earliest matching subject once, while separate threads remain distinct', () => {
  const rows = []
  const message = (id, threadId, subject, minute) => ({ id, threadId, internalDate: String(Date.parse(`2026-10-12T09:${minute}:00+08:00`)), payload: { headers: [{ name: 'Subject', value: subject }] } })
  const first = message('first', 'thread', 'Invitation', '00')
  const reply = message('reply', 'thread', 'Re: Invitation', '10')
  const other = message('other', 'separate', 'Invitation', '20')
  const context = vm.createContext({
    Utilities: { formatDate: () => '2026-10-12' },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty() {}, setProperty() {}, deleteProperty() {} }) },
    Gmail: { Users: {
      Messages: { list: () => ({ messages: [reply, first, other] }), get: (_, id) => [first, reply, other].find(item => item.id === id) },
      Threads: { get: (_, id) => ({ messages: id === 'thread' ? [reply, first] : [other] }) },
    } },
  })
  vm.runInContext(source, context)
  context.setupEmailSheet = () => ({ getLastRow: () => rows.length + 1, getRange: () => ({ getValues: () => rows.map(row => [row[6]]), setValues: values => rows.push(...values), setNumberFormat() {} }) })
  context.syncEmailSheet()
  context.syncEmailSheet()
  assert.equal(rows.length, 2)
  assert.ok(rows[0][6].endsWith('/first'))
  assert.ok(rows[1][6].endsWith('/other'))
})

test('email import preserves manual fields, skips existing messages and escapes subjects', () => {
  const rows = [['old timestamp', 'REF-1', 'date', 'sender', 'subject', 'Keep remarks', 'https://mail.google.com/mail/u/0/#all/old']]
  let released = false
  const sheet = {
    getLastRow: () => rows.length + 1,
    getRange(row, column, count) {
      return {
        getValues: () => rows.slice(row - 2, row - 2 + count).map(value => [value[column - 1]]),
        setValues: values => rows.push(...values),
        setNumberFormat() {},
      }
    },
  }
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { released = true } }) },
    Utilities: { formatDate: () => '2026-10-12' },
    PropertiesService: { getScriptProperties: () => ({ getProperty() {}, deleteProperty() {}, setProperty() {} }) },
    Gmail: { Users: { Messages: {
      list: () => ({ messages: [{ id: 'old' }, { id: 'new' }] }),
      get: () => ({ internalDate: '1700000000000', payload: { headers: [{ name: 'From', value: 'Sender <sender@example.com>' }, { name: 'Subject', value: '=IMPORTXML()' }] } }),
    } } },
  })
  vm.runInContext(source, context)
  context.setupEmailSheet = () => sheet
  context.syncEmailSheet()
  context.syncEmailSheet()
  assert.equal(rows.length, 2)
  assert.equal(rows[0][1], 'REF-1')
  assert.equal(rows[0][5], 'Keep remarks')
  assert.equal(rows[1][2].getTime(), 1700000000000)
  assert.equal(rows[1][3], 'Sender <sender@example.com>')
  assert.equal(rows[1][4], "'=IMPORTXML()")
  assert.match(rows[1][1], /^JHCSC-20261012-\d{6}$/)
  assert.equal(rows[1][5], 'Incoming')
  assert.equal(released, true)
})

test('email register requires a session and reads displayed rows and rich links', () => {
  const context = vm.createContext({})
  vm.runInContext(source, context)
  context.jsonResponse = value => value
  context.getDocumentSession = () => null
  assert.equal(context.getEmailRegister({ token: '' }).success, false)
  context.getDocumentSession = () => ({ email: 'user@example.com' })
  const values = [
    ['Oct 12', 'REF-1', 'Oct 11', 'Sender', 'Subject', 'Remark', 'Email'],
    ['Oct 13', 'REF-2', 'Oct 12', 'Other', 'Second', '', 'javascript:alert(1)'],
  ]
  context.appSpreadsheet = () => ({ getSheetByName: () => ({
    getLastRow: () => 3,
    getRange: () => ({
      getDisplayValues: () => values,
      getRichTextValues: () => [[{ getLinkUrl: () => 'https://mail.google.com/mail/u/0/#all/123', getRuns: () => [] }], [null]].map(row => [null, null, null, null, null, null, row[0]]),
    }),
  }) })
  const result = context.getEmailRegister({ token: 'valid' })
  assert.equal(result.emails[0].reference, 'REF-2')
  assert.equal(result.emails[0].link, '')
  assert.equal(result.emails[1].link, 'https://mail.google.com/mail/u/0/#all/123')
  assert.equal(result.emails[1].remarks, 'Remark')
})

test('quota failure saves completed messages and retains the current page for retry', () => {
  const rows = []
  const props = new Map([['EMAIL_REGISTER_PAGE_TOKEN', 'current'], ['EMAIL_REGISTER_SCAN_DATE', '2026-10-12']])
  let limited = true
  let released = 0
  const context = vm.createContext({
    Utilities: { formatDate: () => '2026-10-12' },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { released++ } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key), setProperty: (key, value) => props.set(key, value), deleteProperty: key => props.delete(key) }) },
    Gmail: { Users: { Messages: {
      list: (_, options) => { assert.equal(options.maxResults, 25); assert.equal(options.pageToken, 'current'); assert.ok(options.q.endsWith('after:' + Date.parse('2026-10-12T00:00:00+08:00') / 1000)); return { messages: [{ id: 'one' }, { id: 'two' }] } },
      get: (_, id) => { if (id === 'two' && limited) throw new Error('Quota exceeded'); return { internalDate: '1700000000000', payload: { headers: [] } } },
    } } },
  })
  vm.runInContext(source, context)
  context.setupEmailSheet = () => ({
    getLastRow: () => rows.length + 1,
    getRange: () => ({ getValues: () => rows.map(row => [row[6]]), setValues: values => rows.push(...values), setNumberFormat() {} }),
  })
  assert.throws(() => context.syncEmailSheet(), /Quota exceeded/)
  assert.equal(rows.length, 1)
  assert.equal(props.get('EMAIL_REGISTER_PAGE_TOKEN'), 'current')
  limited = false
  context.syncEmailSheet()
  assert.equal(rows.length, 2)
  assert.equal(props.has('EMAIL_REGISTER_PAGE_TOKEN'), false)
  assert.equal(released, 2)
})
