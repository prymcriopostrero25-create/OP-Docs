import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lockBodyScroll } from '../src/lib/scrollLock.js'

test('preview and loader restore scrolling regardless of their cleanup order', () => {
  globalThis.document = { body: { style: { overflow: '' } } }
  try {
    for (const order of [[0, 1], [1, 0]]) {
      const unlock = [lockBodyScroll(), lockBodyScroll()]
      unlock[order[0]]()
      assert.equal(document.body.style.overflow, 'hidden')
      unlock[order[1]]()
      assert.equal(document.body.style.overflow, '')
      unlock[order[0]]()
      assert.equal(document.body.style.overflow, '')
    }
    document.body.style.overflow = 'auto'
    const unlock = lockBodyScroll()
    unlock()
    assert.equal(document.body.style.overflow, 'auto')
  } finally { delete globalThis.document }
})
