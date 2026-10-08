import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

function fixture() {
  let reads = 0
  const cache = new Map()
  const context = vm.createContext({
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put(key, value, ttl) { assert.equal(ttl, 30); cache.set(key, value) }, remove: key => cache.delete(key) }) },
    Utilities: { formatDate: () => '2026-10' },
  })
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  context.appSpreadsheet = () => ({ getSheetByName: () => null })
  context.jsonResponse = value => value
  context.mainFilesSheet = () => ({ getLastRow: () => 2, getRange: () => ({
    getDisplayValues() { reads++; return [['Created', 'TEST', '2026-10-06']] },
    getNotes: () => [[JSON.stringify({ type: 'Special Order', status: 'Approved' })]],
  }) })
  return { context, cache, reads: () => reads }
}

test('overview cache reuses totals, refresh bypasses it, and eviction reads again', () => {
  const f = fixture()
  assert.equal(f.context.getOverview().summary.total, 1)
  assert.equal(f.context.getOverview().summary.total, 1)
  assert.equal(f.reads(), 1)
  f.context.getOverview({ refresh: true })
  assert.equal(f.reads(), 2)
  f.cache.clear()
  f.context.getOverview()
  assert.equal(f.reads(), 3)
})

test('authenticated overview reads use cache, rejected sessions cannot retrieve it, and mutations invalidate it', () => {
  const f = fixture()
  f.context.getDocumentSession = () => true
  f.context.getOverview()
  assert.equal(f.context.doPost({ postData: { contents: JSON.stringify({ action: 'overview', token: 's' }) } }).success, true)
  assert.equal(f.reads(), 1)
  f.context.getDocumentSession = () => false
  assert.equal(f.context.doPost({ postData: { contents: JSON.stringify({ action: 'overview', token: 's' }) } }).success, false)
  f.context.updateDocumentStatus = () => ({ success: true })
  f.context.doPost({ postData: { contents: JSON.stringify({ action: 'updateDocumentStatus' }) } })
  assert.equal(f.cache.has('overview:v1'), false)
})

test('a corrupt or unavailable cache cannot prevent loading totals', () => {
  const f = fixture()
  f.cache.set('overview:v1', 'broken')
  assert.equal(f.context.getOverview().summary.total, 1)
  f.context.CacheService.getScriptCache = () => { throw Error('Unavailable') }
  assert.equal(f.context.getOverview().summary.total, 1)
})

test('opening documents after overview reuses the registry scan in either navigation order', () => {
  for (const first of ['getOverview', 'getDocuments']) {
    const f = fixture()
    f.context[first]()
    assert.equal(f.context.getOverview().summary.total, 1)
    assert.equal(f.context.getDocuments().documents[0].id, 'TEST')
    assert.equal(f.reads(), 1)
    f.context.getDocuments({ refresh: true })
    assert.equal(f.reads(), 2)
    f.context.getOverview({ refresh: true })
    assert.equal(f.reads(), 3)
  }
})

test('overview account data stays out of shared cache and uses the current authenticated account', () => {
  const f = fixture()
  f.context.getDocumentSession = () => true
  f.context.authenticatedAccount = token => ({ token, name: token })
  const post = token => f.context.doPost({ postData: { contents: JSON.stringify({ action: 'overview', includeUser: true, token }) } })
  assert.equal(post('first').user.name, 'first')
  assert.equal(post('second').user.name, 'second')
  assert.equal(f.reads(), 1)
  assert.equal(f.cache.get('overview:v1').includes('first'), false)
})

test('login summary shortcut never scans the registry on cache miss or corruption', () => {
  const f = fixture()
  assert.equal(f.context.cachedOverviewSummary(), undefined)
  assert.equal(f.reads(), 0)
  f.context.getOverview()
  assert.equal(f.context.cachedOverviewSummary().total, 1)
  assert.equal(f.reads(), 1)
  f.cache.set('overview:v1', 'broken')
  assert.equal(f.context.cachedOverviewSummary(), undefined)
  assert.equal(f.reads(), 1)
})
