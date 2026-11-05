import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const source = fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8')
const link = 'https://mail.google.com/mail/u/0/#all/abc123'
function fixture({ authenticated = true, gmailFails = false } = {}) {
  const actions = []
  const sheet = { getLastRow: () => 2, getRange: () => ({ getDisplayValues: () => [[link]], getRichTextValues: () => [[null]] }), deleteRow: row => actions.push(['deleteRow', row]) }
  const context = vm.createContext({})
  vm.runInContext(source, context)
  context.getDocumentSession = () => authenticated
  context.jsonResponse = value => value
  context.appSpreadsheet = () => ({ getSheetByName: () => sheet })
  context.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
  context.SpreadsheetApp = { flush() {} }
  context.Gmail = { Users: { Messages: { get: () => ({ threadId: 'thread1' }) }, Threads: { trash: (_, id) => { actions.push(['trash', id]); if (gmailFails) throw new Error('Gmail unavailable'); return { id } } } } }
  return { context, actions }
}
test('email deletion trashes the registered Gmail thread before removing the row', () => {
  const { context, actions } = fixture()
  const result = context.deleteRegisteredEmail({ token: 'session', link })
  assert.equal(result.trashed, true)
  assert.equal(result.deletedLink, link)
  assert.deepEqual(actions, [['trash', 'thread1'], ['deleteRow', 2]])
})
test('Gmail failure preserves the email register', () => {
  const { context, actions } = fixture({ gmailFails: true })
  assert.equal(context.deleteRegisteredEmail({ token: 'session', link }).success, false)
  assert.deepEqual(actions, [['trash', 'thread1']])
})
test('email deletion rejects expired sessions and unregistered links', () => {
  const denied = fixture({ authenticated: false })
  assert.equal(denied.context.deleteRegisteredEmail({ link }).success, false)
  assert.deepEqual(denied.actions, [])
  const { context, actions } = fixture()
  assert.equal(context.deleteRegisteredEmail({ link: link.replace('abc123', 'outside') }).success, false)
  assert.deepEqual(actions, [])
})
