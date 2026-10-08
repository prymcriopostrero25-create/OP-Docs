import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sealDocumentPdf, inspectDocumentPdf } from '../src/lib/documentIntegrity.js'

const code = '12345678-1234-1234-1234-123456789abc12345678-1234-1234-1234-123456789abc'
const original = () => new File(['%PDF-1.7\nexample\n%%EOF'], 'document.pdf', { type: 'application/pdf' })

test('issued file checksum round trips and recovers its registry code', async () => {
  const sealed = await sealDocumentPdf(original(), code)
  assert.deepEqual(await inspectDocumentPdf(sealed), { sealed: true, code, name: 'document.pdf' })
})

test('file check rejects changed bytes, changed marker, and appended data', async () => {
  const sealed = await sealDocumentPdf(original(), code)
  const bytes = new Uint8Array(await sealed.arrayBuffer())
  bytes[10] ^= 1
  await assert.rejects(inspectDocumentPdf(new File([bytes], 'changed.pdf')), /has changed/)
  await assert.rejects(inspectDocumentPdf(new File([sealed, 'extra'], 'changed.pdf')), /damaged/)
  const text = await sealed.text()
  await assert.rejects(inspectDocumentPdf(new File([text.replace(code, 'invalid')], 'changed.pdf')), /damaged/)
})

test('legacy files use QR fallback and invalid uploads are rejected', async () => {
  assert.deepEqual(await inspectDocumentPdf(original()), { sealed: false })
  await assert.rejects(inspectDocumentPdf(new File(['text'], 'file.txt')), /Choose a PDF/)
  await assert.rejects(sealDocumentPdf(original(), 'invalid'), /Invalid/)
})
