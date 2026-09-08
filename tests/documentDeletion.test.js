import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

function fixture({ denyDrive = false, failLog = false } = {}) {
  const events = []
  const context = vm.createContext({
    DriveApp: { getFileById(id) {
      assert.equal(id, 'file123')
      return { isTrashed: () => false, setTrashed() { if (denyDrive) throw Error('Denied'); events.push('trash') } }
    } },
    SpreadsheetApp: { flush() {} },
  })
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  context.typeLogSheet = type => ({
    getLastRow: () => 4,
    getRange: () => ({ getDisplayValues: () => [['target'], ['other'], ['target']] }),
    deleteRow(row) { if (failLog) throw Error('Sheet denied'); events.push(`${type}:${row}`) },
  })
  const run = () => context.deleteDocumentFiles({ id: 'target', url: 'https://drive.google.com/file/d/file123/view' }, { deleteRow: row => events.push(`main:${row}`) }, 2)
  return { events, run }
}

test('trashes exact PDF, removes matching category rows bottom up, then main row', () => {
  const f = fixture()
  f.run()
  assert.equal(f.events[0], 'trash')
  assert.equal(f.events.at(-1), 'main:2')
  assert.equal(f.events.length, 12)
  assert.match(f.events[1], /:4$/)
  assert.match(f.events[2], /:2$/)
  assert.ok(!f.events.some(event => event.endsWith(':3')))
})

test('Drive permission failure leaves all sheet rows intact', () => {
  const f = fixture({ denyDrive: true })
  assert.throws(f.run, /Denied/)
  assert.deepEqual(f.events, [])
})

test('category cleanup failure preserves main row and asks for retry', () => {
  const f = fixture({ failLog: true })
  assert.throws(f.run, /Retry Delete/)
  assert.deepEqual(f.events, ['trash'])
})
