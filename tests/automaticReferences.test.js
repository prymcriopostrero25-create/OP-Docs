import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

function fixture() {
  const properties = new Map()
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
    CacheService: { getScriptCache: () => ({ get: () => 'admin@example.com' }) },
    Utilities: { formatDate: () => '2026-09-29' },
  })
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  context.appSpreadsheet = () => ({ getSpreadsheetTimeZone: () => 'Asia/Manila' })
  context.typeLogSheet = type => ({ getLastRow: () => type === 'Executive Memorandum' ? 3 : 1, getRange: () => ({ getDisplayValues: () => [['Executive Memorandum No. 203, s. 2026', '2026'], ['Executive Memorandum No. 900, s. 2025', '2025']] }) })
  return context
}

test('automatic references continue existing annual numbers and retain retry reservations', () => {
  const ctx = fixture()
  const request = { type: 'Executive Memorandum', token: 'valid', requestId: 'request-1' }
  const data = { date: '2026-09-29', year: '2026' }
  const first = ctx.reserveDocumentReference(request, data, false)
  assert.equal(first.reference, 'Executive Memorandum No. 204, s. 2026')
  assert.equal(ctx.reserveDocumentReference(request, data, false).reference, first.reference)
  assert.equal(ctx.reserveDocumentReference({ ...request, requestId: 'request-2' }, data, false).reference, 'Executive Memorandum No. 205, s. 2026')
  assert.throws(() => ctx.reserveDocumentReference(request, { ...data, year: '2027' }, false), /original document year/)
})

test('automatic sequences are separate by type and year, including automatic dates', () => {
  const ctx = fixture()
  assert.equal(ctx.reserveDocumentReference({ type: 'Travel Order', requestId: 'travel' }, {}, true).reference, 'Travel Order No. 001, s. 2026')
  assert.equal(ctx.reserveDocumentReference({ type: 'Special Order', requestId: 'special' }, { date: '2027-01-01', year: '2027' }, false).reference, 'Special Order No. 001, s. 2027')
  assert.throws(() => ctx.reserveDocumentReference({ type: 'Special Order', requestId: 'travel' }, {}, true), /does not match/)
})
