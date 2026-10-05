import assert from 'node:assert/strict'
import { chromium } from './node_modules/playwright/index.mjs'

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } })
  page.setDefaultTimeout(15000)
  const errors = [], documents = []
  page.on('pageerror', error => errors.push(error.message))
  const user = { name: 'Success Test', email: 'test@jhcsc.edu.ph', role: 'super admin', token: 'test' }
  await page.addInitScript(account => localStorage.setItem('op-dms-user', JSON.stringify(account)), user)
  await page.route('**/apps-script', async route => {
    const request = route.request().postDataJSON()
    const result = { success: true }
    if (request.action === 'currentUser') result.user = user
    if (request.action === 'overview') result.summary = { total: documents.length, types: {}, statuses: {}, months: {} }
    if (request.action === 'documents') result.documents = documents
    if (request.action === 'editorCapabilities') result.richBodyVersion = 1
    if (request.action === 'createDocument') {
      result.document = { id: `${request.type} No. 001`, type: request.type, subject: 'Success test', status: 'Draft', date: '2026-10-05', url: 'https://drive.google.com/file/d/test/view' }
      documents.push(result.document)
    }
    await route.fulfill({ json: result })
  })
  await page.goto('http://localhost:5173')
  for (const [type, label] of [['Special Order', 'Special Order'], ['Executive Memorandum', 'Executive Memorandum'], ['Travel Order', 'Travel Order'], ['Certificate of Travel', 'Travel Certificate'], ['Authority to Travel Abroad', 'Travel Authority']]) {
    await page.getByRole('button', { name: 'Create document', exact: false }).click()
    await page.getByLabel('Document type', { exact: true }).selectOption(type)
    for (const input of await page.locator('form input[required], form textarea[required]').all()) {
      if (await input.inputValue()) continue
      await input.fill(await input.getAttribute('type') === 'date' ? '2026-10-05' : 'Success test')
    }
    if (['Special Order', 'Executive Memorandum'].includes(type)) await page.locator('.tiptap').fill('Success test body')
    await page.getByRole('button', { name: 'Create document', exact: true }).click()
    const popup = page.getByRole('dialog', { name: 'Document saved successfully' })
    await popup.waitFor()
    await popup.getByRole('button', { name: `Go to ${label} table`, exact: true }).click()
    await page.getByRole('heading', { name: label, exact: true }).waitFor()
    assert.equal(await page.locator('.document-type-pages button.active').innerText().then(text => text.includes(label)), true)
    assert.equal(await page.getByRole('dialog').count(), 0)
    console.log(`PASS: ${label} success popup opens its table`)
    await page.locator('.main-nav button').nth(0).click()
    await page.locator('.overview-metric').first().waitFor()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
