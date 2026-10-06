import { test } from 'node:test'
import assert from 'node:assert/strict'
import { preparedPdfFile } from '../src/lib/pdfFile.js'

test('prepared PDF preserves bytes, MIME type and filename', async () => {
  const file = preparedPdfFile({ data: btoa('%PDF-1.7\n\x00\xff'), name: 'Official.pdf' })
  assert.equal(file.name, 'Official.pdf')
  assert.equal(file.type, 'application/pdf')
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())].slice(-2), [0, 255])
})

test('invalid, non-PDF and oversized preview payloads fail before creating an attachment', () => {
  for (const data of [undefined, '!!!', btoa('<html>'), 'A'.repeat(Math.ceil(25 * 1024 * 1024 / 3) * 4 + 1)]) {
    assert.throws(() => preparedPdfFile({ data }), /PDF/)
  }
})
