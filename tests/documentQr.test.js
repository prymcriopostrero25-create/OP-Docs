import { test } from 'node:test'
import assert from 'node:assert/strict'
import QRCode from 'qrcode'
import { PDFDocument } from 'pdf-lib'
import { stampVerificationQr } from '../src/lib/stampVerificationQr.js'
import { generateDocumentQr } from '../src/lib/documentQrGenerator.js'
import { createCanvas } from '@napi-rs/canvas'
import { qrDecoderFromModule, scanDocumentCanvas, verificationCodeFromQr } from '../src/lib/documentQr.js'

test('QR decoder loads Node and Vite CommonJS module shapes', () => {
  const decoder = () => null
  for (const module of [decoder, { default: decoder }, { default: { default: decoder } }]) {
    assert.equal(qrDecoderFromModule(module), decoder)
  }
  assert.throws(() => qrDecoderFromModule({ default: {} }), /Unable to load the QR scanner/)
})

const code = '12345678-1234-1234-1234-123456789abc12345678-1234-1234-1234-123456789abc'
test('generated QR survives PDF stamping and page-1 rendering into the scanner', async () => {
  const { qr, url } = await generateDocumentQr(code, 'http://localhost:5173/?old=value#/dashboard')
  assert.equal(verificationCodeFromQr(url), code)
  assert.equal(new URL(url).hash, '')
  const source = await PDFDocument.create()
  source.addPage([595.28, 841.89]).drawText('Official document')
  source.addPage([595.28, 841.89]).drawText('Continuation')
  const stamped = await stampVerificationQr(new File([await source.save()], 'test.pdf'), qr)
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = getDocument({ data: new Uint8Array(await stamped.arrayBuffer()), isEvalSupported: false })
  try {
    const pdf = await task.promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    assert.equal(await scanDocumentCanvas(canvas), code)
    assert.equal(pdf.numPages, 2)
  } finally { await task.destroy() }
})
test('PDF QR stamping preserves page count and only changes page 1', async () => {
  const pdf = await PDFDocument.create()
  pdf.addPage([595.28, 841.89]).drawText('First page content')
  pdf.addPage([595.28, 841.89]).drawText('Second page content')
  const input = new File([await pdf.save()], 'document.pdf', { type: 'application/pdf' })
  const qr = await QRCode.toDataURL(`https://portal.example/?verify=${code}`)
  const result = await PDFDocument.load(await (await stampVerificationQr(input, qr)).arrayBuffer())
  assert.equal(result.getPageCount(), 2)
  assert.deepEqual(result.getPage(0).getSize(), { width: 595.28, height: 841.89 })
  assert.equal(result.getPage(1).node.Contents().toString(), pdf.getPage(1).node.Contents().toString())
  assert.notEqual(result.getPage(0).node.Contents().toString(), pdf.getPage(0).node.Contents().toString())
})
test('verification codes accept registry links and reject unrelated QR payloads', () => {
  assert.equal(verificationCodeFromQr(`https://portal.example/?verify=${code}`), code)
  assert.equal(verificationCodeFromQr(code), code)
  assert.equal(verificationCodeFromQr('https://example.com/'), null)
  assert.equal(verificationCodeFromQr('javascript:alert(1)'), null)
  assert.equal(verificationCodeFromQr('https://example.com/?verify=invalid'), null)
})

test('scanner decodes the QR generated for a document', async () => {
  const qr = QRCode.create(`https://portal.example/?verify=${code}`, { errorCorrectionLevel: 'M' })
  const width = (qr.modules.size + 8) * 5
  const data = new Uint8ClampedArray(width * width * 4).fill(255)
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const row = Math.floor(y / 5) - 4, col = Math.floor(x / 5) - 4
    if (row >= 0 && col >= 0 && row < qr.modules.size && col < qr.modules.size && qr.modules.get(row, col)) {
      const offset = (y * width + x) * 4
      data[offset] = data[offset + 1] = data[offset + 2] = 0
    }
  }
  assert.equal(await scanDocumentCanvas({ width, height: width, getContext: () => ({ getImageData: () => ({ data, width, height: width }) }) }), code)
})
