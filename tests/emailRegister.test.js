import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8')
function mockLabels(context) {
  context.Gmail.Users.Labels = { list: () => ({ labels: [{ id: 'op-label', name: 'JHCSC_OPDOCS' }] }) }
  context.Gmail.Users.Messages.batchModify = () => {}
  context.SpreadsheetApp = { flush() {} }
}

test('automatic sync drains multiple batches from the fixed start date across later runs', () => {
  const rows = []
  let runDate = '2026-10-12'
  const labeled = new Set()
  const messages = Array.from({ length: 61 }, (_, index) => ({ id: String(index), internalDate: String(Date.parse('2026-10-12T09:00:00+08:00')), payload: { headers: [] } }))
  const context = vm.createContext({
    Utilities: { formatDate: () => runDate },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ deleteProperty() {} }) },
    Gmail: { Users: { Messages: {
      list: (_, options) => {
        assert.equal(options.pageToken, undefined)
        assert.ok(options.q.includes('-label:JHCSC_OPDOCS'))
        assert.ok(options.q.endsWith('after:' + (Date.parse('2026-10-12T00:00:00+08:00') / 1000 - 1)))
        return { messages: messages.filter(message => !labeled.has(message.id)).slice(0, options.maxResults), nextPageToken: 'must-not-use' }
      },
      get: (_, id) => messages.find(message => message.id === id),
    } } },
  })
  vm.runInContext(source, context)
  mockLabels(context)
  context.Gmail.Users.Messages.batchModify = value => value.ids.forEach(id => labeled.add(id))
  context.setupEmailSheet = () => ({
    getLastRow: () => rows.length + 1,
    getRange: (row, column, count = 1) => ({
      getValues: () => rows.slice(row - 2, row - 2 + count).map(value => [value[column - 1]]),
      setValues: values => rows.push(...values), setNumberFormat() {}, setNote() {},
    }),
  })
  for (const expected of [25, 50, 61, 61]) {
    context.syncEmailSheet()
    assert.equal(rows.length, expected)
    assert.equal(labeled.size, expected)
    runDate = '2026-10-13'
  }
  assert.equal(new Set(rows.map(row => row[6])).size, 61)
})

test('automatic setup replaces the old schedule and keeps unrelated triggers', () => {
  const trigger = handler => ({ getHandlerFunction: () => handler })
  let triggers = [trigger('syncEmailSheet'), trigger('unrelated')]
  let synced = 0
  const context = vm.createContext({
    Gmail: { Users: { getProfile: () => ({}) } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      newTrigger: handler => ({ timeBased: () => ({ everyMinutes: minutes => {
        assert.equal(minutes, 5)
        return { create: () => triggers.push(trigger(handler)) }
      } }) }),
      deleteTrigger: old => { triggers = triggers.filter(item => item !== old) },
    },
  })
  vm.runInContext(source, context)
  context.setupEmailSheet = () => ({})
  context.syncEmailSheet = () => { synced++ }
  context.enableAutomaticEmailSync()
  context.enableAutomaticEmailSync()
  assert.deepEqual(triggers.map(item => item.getHandlerFunction()).sort(), ['syncEmailSheet', 'unrelated'])
  assert.equal(synced, 2)
})
test('thread replies save the first eligible message and exclude earlier mail', () => {
  const rows = []
  const message = (id, threadId, subject, minute) => ({ id, threadId, internalDate: String(Date.parse(`2026-10-12T09:${minute}:00+08:00`)), payload: { headers: [{ name: 'Subject', value: subject }] } })
  const first = message('first', 'thread', 'Invitation', '00')
  const reply = message('reply', 'thread', 'Re: Invitation', '10')
  const other = message('other', 'separate', 'Invitation', '20')
  const yesterday = { ...first, id: 'yesterday', internalDate: String(Date.parse('2026-10-11T09:00:00+08:00')) }
  const context = vm.createContext({
    Utilities: { formatDate: () => '2026-10-12' },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty() {}, setProperty() {}, deleteProperty() {} }) },
    Gmail: { Users: {
      Messages: { list: () => ({ messages: [yesterday, reply, first, other] }), get: (_, id) => [yesterday, first, reply, other].find(item => item.id === id) },
      Threads: { get: (_, id) => ({ messages: id === 'thread' ? [yesterday, reply, first] : [other] }) },
    } },
  })
  vm.runInContext(source, context)
  context.setupEmailSheet = () => ({ getLastRow: () => rows.length + 1, getRange: () => ({ getValues: () => rows.map(row => [row[6]]), setValues: values => rows.push(...values), setNumberFormat() {}, setNote() {} }) })
  mockLabels(context)
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
        setNumberFormat() {}, setNote() {},
      }
    },
  }
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { released = true } }) },
    Utilities: { formatDate: () => '2026-10-12' },
    PropertiesService: { getScriptProperties: () => ({ getProperty() {}, deleteProperty() {}, setProperty() {} }) },
    Gmail: { Users: { Messages: {
      list: () => ({ messages: [{ id: 'old' }, { id: 'new' }] }),
      get: () => ({ internalDate: String(Date.parse('2026-10-12T09:00:00+08:00')), payload: { headers: [{ name: 'From', value: 'Sender <sender@example.com>' }, { name: 'Subject', value: '=IMPORTXML()' }] } }),
    } } },
  })
  vm.runInContext(source, context)
  context.setupEmailSheet = () => sheet
  mockLabels(context)
  context.syncEmailSheet()
  context.syncEmailSheet()
  assert.equal(rows.length, 2)
  assert.equal(rows[0][1], 'REF-1')
  assert.equal(rows[0][5], 'Keep remarks')
  assert.equal(rows[1][2].getTime(), Date.parse('2026-10-12T09:00:00+08:00'))
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

test('quota failure saves completed messages and retries the remaining unlabeled mail', () => {
  const rows = []
  const props = new Map([['EMAIL_REGISTER_PAGE_TOKEN', 'current'], ['EMAIL_REGISTER_SCAN_DATE', '2026-10-12']])
  let limited = true
  let released = 0
  const context = vm.createContext({
    Utilities: { formatDate: () => '2026-10-12' },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { released++ } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key), setProperty: (key, value) => props.set(key, value), deleteProperty: key => props.delete(key) }) },
    Gmail: { Users: { Messages: {
      list: (_, options) => { assert.equal(options.maxResults, 25); assert.equal(options.pageToken, undefined); assert.ok(options.q.includes('-label:JHCSC_OPDOCS')); assert.ok(options.q.endsWith('after:' + (Date.parse('2026-10-12T00:00:00+08:00') / 1000 - 1))); return { messages: [{ id: 'one' }, { id: 'two' }] } },
      get: (_, id) => { if (id === 'two' && limited) throw new Error('Quota exceeded'); return { internalDate: String(Date.parse('2026-10-12T09:00:00+08:00')), payload: { headers: [] } } },
    } } },
  })
  vm.runInContext(source, context)
  context.setupEmailSheet = () => ({
    getLastRow: () => rows.length + 1,
    getRange: () => ({ getValues: () => rows.map(row => [row[6]]), setValues: values => rows.push(...values), setNumberFormat() {}, setNote() {} }),
  })
  mockLabels(context)
  assert.throws(() => context.syncEmailSheet(), /Quota exceeded/)
  assert.equal(rows.length, 1)
  assert.equal(props.has('EMAIL_REGISTER_PAGE_TOKEN'), false)
  limited = false
  context.syncEmailSheet()
  assert.equal(rows.length, 2)
  assert.equal(props.has('EMAIL_REGISTER_PAGE_TOKEN'), false)
  assert.equal(released, 2)
})

test('labels are created and applied after saving, and failed labeling retries without duplicate rows', () => {
  const rows = []
  let labelExists = false
  let failLabel = true
  let flushed = false
  const context = vm.createContext({
    Utilities: { formatDate: () => '2026-10-12' },
    SpreadsheetApp: { flush() { flushed = true } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty() {}, setProperty() {}, deleteProperty() {} }) },
    Gmail: { Users: {
      Labels: {
        list: () => ({ labels: labelExists ? [{ id: 'op', name: 'JHCSC_OPDOCS' }] : [] }),
        create: value => { assert.equal(value.name, 'JHCSC_OPDOCS'); labelExists = true; return { id: 'op' } },
      },
      Messages: {
        list: () => ({ messages: [{ id: 'email' }] }),
        get: () => ({ internalDate: String(Date.parse('2026-10-12T09:00:00+08:00')), payload: { headers: [] } }),
        batchModify: value => {
          assert.equal(rows.length, 1)
          assert.equal(flushed, true)
          assert.deepEqual(Array.from(value.ids), ['email'])
          assert.deepEqual(Array.from(value.addLabelIds), ['op'])
          if (failLabel) throw new Error('Label quota')
        },
      },
    } },
  })
  vm.runInContext(source, context)
  context.setupEmailSheet = () => ({ getLastRow: () => rows.length + 1, getRange: () => ({ getValues: () => rows.map(row => [row[6]]), setValues: values => rows.push(...values), setNumberFormat() {}, setNote() {} }) })
  assert.throws(() => context.syncEmailSheet(), /Label quota/)
  failLabel = false
  context.syncEmailSheet()
  assert.equal(rows.length, 1)
})

test('new replies update the existing conversation across days without changing its reference or remarks', () => {
  const rows = [['timestamp', 'REF-original', 'yesterday', 'Original sender', 'Invitation', 'For Action', 'https://mail.google.com/mail/u/0/#all/original']]
  const notes = new Map()
  const message = (id, date, sender) => ({ id, threadId: 'thread-id', internalDate: String(Date.parse(date)), payload: { headers: [{ name: 'From', value: sender }, { name: 'Subject', value: 'Invitation' }] } })
  const original = message('original', '2026-10-11T09:00:00+08:00', 'First')
  const reply = message('reply', '2026-10-12T09:00:00+08:00', 'Latest')
  const context = vm.createContext({
    Utilities: { formatDate: () => '2026-10-12' },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty() {}, setProperty() {}, deleteProperty() {} }) },
    Gmail: { Users: {
      Messages: { list: () => ({ messages: [{ id: 'reply', threadId: 'thread-id' }] }), get: () => reply },
      Threads: { get: () => ({ messages: [reply, original] }) },
    } },
  })
  vm.runInContext(source, context)
  context.setupEmailSheet = () => ({
    getLastRow: () => rows.length + 1,
    getRange: (row, column, count = 1) => ({
      getValues: () => rows.slice(row - 2, row - 2 + count).map(value => [value[column - 1]]),
      getNotes: () => rows.slice(row - 2, row - 2 + count).map((_, index) => [notes.get(row + index) || '']),
      setNote: note => notes.set(row, note), setNumberFormat() {},
      setValues: values => rows.push(...values),
    }),
  })
  mockLabels(context)
  context.syncEmailSheet()
  context.syncEmailSheet()
  assert.equal(rows.length, 1)
  assert.equal(rows[0][1], 'REF-original')
  assert.equal(rows[0][5], 'For Action')
  const metadata = JSON.parse(notes.get(2))
  assert.equal(metadata.threadId, 'thread-id')
  assert.equal(metadata.latestMessageId, 'reply')
  assert.equal(metadata.replyCount, 1)
  assert.equal(metadata.latestSender, 'Latest')
})
