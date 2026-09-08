import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

function fixture(failLog = false) {
  const sessions = new Map([['session:valid', 'person@jhcsc.edu.ph']])
  const logs = []
  const context = vm.createContext({
    CacheService: { getScriptCache: () => ({ get: key => sessions.get(key), remove: key => sessions.delete(key) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  })
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  context.jsonResponse = value => value
  context.appSpreadsheet = () => ({ getSheetByName: () => ({ getLastRow: () => 2, getRange: () => ({ getDisplayValues: () => [['person@jhcsc.edu.ph', 'Test Person']] }) }) })
  context.logUserEvent = (name, action) => { if (failLog) throw Error('Unavailable'); logs.push([name, action]) }
  return { context, sessions, logs }
}

test('logout logs the authenticated name and revokes the session only once', () => {
  const { context, sessions, logs } = fixture()
  const request = { postData: { contents: JSON.stringify({ action: 'logout', token: 'valid', name: 'Forged Name' }) } }
  assert.equal(context.doPost(request).success, true)
  assert.equal(sessions.size, 0)
  assert.deepEqual(logs, [['Test Person', 'logged out']])
  assert.equal(context.doPost(request).success, true)
  assert.equal(logs.length, 1)
})

test('missing and unknown tokens cannot create logout logs', () => {
  const { context, logs } = fixture()
  assert.equal(context.logoutUser('').success, false)
  assert.equal(context.logoutUser('unknown').success, true)
  assert.equal(logs.length, 0)
})

test('logging failure still revokes session and reports failure', () => {
  const { context, sessions } = fixture(true)
  assert.equal(context.logoutUser('valid').success, false)
  assert.equal(sessions.size, 0)
})
