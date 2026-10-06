import { chromium } from './node_modules/playwright/index.mjs'
import { PDFDocument } from 'pdf-lib'
import fs from 'node:fs'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
 const errors = []
 page.on('pageerror', error => errors.push(error.message))
 await page.goto('http://127.0.0.1:5187/tmp/rich-browser/preview-pdf.html')
 await page.locator('article time').waitFor()
 for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 1200 })
  const result = await page.evaluate(() => window.exportPreview())
  const rendered = await page.evaluate(() => window.renderExport())
  fs.writeFileSync(`tmp/rich-browser/export-rendered-${width}.png`, Buffer.from(rendered.split(',')[1], 'base64'))
  const pdf = await PDFDocument.load(Uint8Array.from(result.bytes))
  if (!pdf.getPageCount() || !result.name.endsWith('.pdf')) throw Error('Invalid PDF')
  fs.writeFileSync(`tmp/rich-browser/preview-${width}.pdf`, Buffer.from(result.bytes))
  await page.locator('article').screenshot({ path: `tmp/rich-browser/preview-${width}.png` })
  console.log(`PASS ${width}px: ${pdf.getPageCount()} pages, ${result.bytes.length} bytes`)
 }
 await page.setViewportSize({ width: 1440, height: 1200 })
 await page.goto('http://127.0.0.1:5187/tmp/rich-browser/preview-pdf.html?integration')
 await page.getByRole('button', { name: 'Preview Preview download test', exact: true }).click()
 await page.getByRole('link', { name: 'Save as PDF', exact: true }).waitFor({ timeout: 30000 })
 const downloadPromise = page.waitForEvent('download')
 await page.getByRole('link', { name: 'Save as PDF', exact: true }).click()
 const download = await downloadPromise
 if (!download.suggestedFilename().includes('Executive Memorandum')) throw Error('Wrong download filename')
 const expectedBytes = await page.getByRole('link', { name: 'Save as PDF', exact: true }).evaluate(async link => Array.from(new Uint8Array(await (await fetch(link.href)).arrayBuffer())))
 await page.getByRole('button', { name: 'Send', exact: true }).click()
 await page.locator('#email-to').fill('test@example.com')
 await page.getByRole('button', { name: 'Send PDF', exact: true }).click()
 await page.getByRole('heading', { name: 'PDF sent successfully' }).waitFor()
 const sentBytes = await page.evaluate(() => Array.from(atob(window.sentPreview.data), char => char.charCodeAt(0)))
 if (JSON.stringify(expectedBytes) !== JSON.stringify(sentBytes)) throw Error('Emailed PDF differs from downloaded PDF')
 console.log('PASS mocked email attachment exactly matches downloaded PDF bytes')
 console.log('PASS preview dialog prepares and downloads its layout without a server PDF export')
 if (errors.length) throw Error(errors.join('; '))
} finally { await browser.close() }

