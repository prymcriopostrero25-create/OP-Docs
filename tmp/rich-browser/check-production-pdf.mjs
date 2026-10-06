import assert from 'node:assert/strict'
import { chromium } from './node_modules/playwright/index.mjs'
import { PDFDocument } from 'pdf-lib'

const pdf = await PDFDocument.create()
for (let index = 1; index <= 30; index++) pdf.addPage([595, 842]).drawText(`Production preview page ${index}`, { x: 50, y: 750 })
const bytes = [...await pdf.save()]
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/pdf-test', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }))
  await page.goto('http://localhost:5188/pdf-test')
  await page.evaluate(async bytes => {
    const { default: refresh } = await import('/@react-refresh')
    refresh.injectIntoGlobalHook(window)
    window.$RefreshReg$ = () => {}
    window.$RefreshSig$ = () => type => type
    window.__vite_plugin_react_preamble_installed__ = true
    const React = await import('/node_modules/.vite/deps/react.js')
    const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { default: DocumentPages } = await import('/src/components/DocumentPages.jsx')
    const frame = document.createElement('div')
    frame.className = 'preview-frame-wrap'
    frame.style.cssText = 'height:600px;width:800px;overflow:auto'
    const host = document.createElement('div')
    frame.appendChild(host)
    document.body.appendChild(frame)
    const style = document.createElement('style')
    style.textContent = '.document-preview-pages{display:flex;flex-direction:column;align-items:center;gap:28px;padding:40px 20px}.document-preview-page{flex-shrink:0}canvas{display:block;max-width:100%;height:auto}'
    document.head.appendChild(style)
    window.pdfRoot = ReactDOM.default.createRoot(host)
    window.pdfRoot.render(React.default.createElement(DocumentPages, {
      file: new File([new Uint8Array(bytes)], 'test.pdf', { type: 'application/pdf' }),
      onReady: () => { window.pdfReady = true }, onError: error => { window.pdfError = error.message },
    }))
  }, bytes)
  await page.waitForFunction(() => window.pdfReady || window.pdfError)
  assert.equal(await page.evaluate(() => window.pdfError), undefined)
  assert.equal(await page.locator('.document-preview-page').count(), 30)
  assert.ok(await page.locator('canvas').count() <= 5)
  await page.evaluate(() => { const frame = document.querySelector('.preview-frame-wrap'); frame.scrollTop = frame.scrollHeight })
  await page.locator('canvas[aria-label="Document page 30 of 30"]').waitFor()
  assert.ok(await page.locator('canvas').count() <= 5)
  assert.equal(await page.locator('canvas[aria-label="Document page 1 of 30"]').count(), 0)
  await page.evaluate(() => { document.querySelector('.preview-frame-wrap').scrollTop = 0 })
  await page.locator('canvas[aria-label="Document page 1 of 30"]').waitFor()
  await page.evaluate(() => window.pdfRoot.unmount())
  assert.equal(await page.locator('canvas').count(), 0)
  const calls = []
  await page.route('**/apps-script', async route => {
    const body = route.request().postDataJSON()
    calls.push(body)
    if (body.action === 'prepareEmailAttachment') {
      await new Promise(resolve => setTimeout(resolve, 500))
      await route.fulfill({ json: { success: true, name: 'Official.pdf', revision: '100' } })
    } else if (body.action === 'sendDocument') {
      await route.abort('failed') // Simulate a lost response after server-side delivery.
    } else if (body.action === 'documentSendStatus') {
      await route.fulfill({ json: { success: true, document: { id: 'TEST-1', status: 'Out' } } })
    } else throw Error(`Unexpected action: ${body.action}`)
  })
  await page.evaluate(async () => {
    const React = await import('/node_modules/.vite/deps/react.js')
    const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { default: SendDocument } = await import('/src/components/SendDocument.jsx')
    const host = document.createElement('div')
    document.body.replaceChildren(host)
    window.pdfRoot = ReactDOM.default.createRoot(host)
    window.pdfRoot.render(React.default.createElement(SendDocument, {
      record: { reference: 'TEST-1', title: 'Official document' },
      onClose: () => {}, onSent: record => { window.sentRecord = record },
    }))
  })
  const send = page.getByRole('button', { name: 'Send PDF', exact: true })
  await send.waitFor()
  assert.equal(await send.isDisabled(), true)
  await page.getByText('PDF ready to send', { exact: true }).waitFor()
  await page.getByLabel('To', { exact: false }).first().fill('recipient@example.com')
  await send.click()
  await page.getByRole('heading', { name: 'PDF sent successfully' }).waitFor()
  assert.deepEqual(calls.map(call => call.action), ['prepareEmailAttachment', 'sendDocument', 'documentSendStatus'])
  assert.equal(calls[1].attachmentRevision, '100')
  assert.equal(calls[1].requestId, calls[2].requestId)
  assert.equal(await page.evaluate(() => window.sentRecord.status), 'Out')
  await page.evaluate(() => window.pdfRoot.unmount())
  assert.deepEqual(errors, [])
  console.log('PASS: first page, 30-page lazy rendering, bounded canvases, scroll back, worker cleanup, attachment readiness, uncertain send recovery without resending')
} finally { await browser.close() }
