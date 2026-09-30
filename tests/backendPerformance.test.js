import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8')
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

test('reading login logs requires no sheet writes', () => {
  const f = fixture()
  f.rows.splice(0, 1, ['9/30/2026 8:00 AM', 'Admin logged in'])
  assert.equal(f.context.getUserLogs().logs[0].timestamp, '9/30/2026 8:00 AM')
  assert.equal(f.counts.reads, 1)
})
