import { test } from 'node:test'
import assert from 'node:assert/strict'
import { previewPageSegments } from '../src/lib/previewPdf.js'

test('preview pagination covers every pixel and preserves text lines at page breaks', () => {
  const pages = previewPageSegments(2400, 1056, [{ top: 1040, bottom: 1065 }, { top: 2080, bottom: 2100 }])
  assert.deepEqual(pages, [{ start: 0, end: 1040 }, { start: 1040, end: 2080 }, { start: 2080, end: 2400 }])
})

test('a short preview fits on one page', () => {
  assert.deepEqual(previewPageSegments(800, 1056), [{ start: 0, end: 800 }])
})

test('overlapping text and oversized images cannot stall pagination', () => {
  const pages = previewPageSegments(3000, 1056, [{ top: 1040, bottom: 1070 }, { top: 1030, bottom: 1050 }, { top: 1200, bottom: 2900 }])
  assert.equal(pages[0].end, 1030)
  assert.equal(pages.at(-1).end, 3000)
  pages.forEach((page, i) => {
    assert.ok(page.end > page.start)
    assert.ok(page.end - page.start <= 1056)
    if (i) assert.equal(page.start, pages[i - 1].end)
  })
})
