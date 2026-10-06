import assert from 'node:assert/strict'
import { chromium } from './node_modules/playwright/index.mjs'

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
  const page = await browser.newPage()
  const calls = [], errors = []
  const user = { name: 'Dashboard check', email: 'test@jhcsc.edu.ph', role: 'super admin', token: 'test-session' }
  page.on('pageerror', error => errors.push(error.message))
  let finishOverview
  await page.route('**/apps-script', async route => {
    const payload = route.request().postDataJSON()
    calls.push(payload.action)
    if (payload.action === 'overview') await new Promise(resolve => { finishOverview = resolve })
    await route.fulfill({ json: { success: true, user, summary: { total: 3, types: { 'Special Order': 3 }, statuses: { Approved: 3 }, months: { '2026-10': 3 } }, documents: [], richBodyVersion: 1 } })
  })
  await page.goto('http://localhost:5188/')
  await page.locator('input[type="email"]').fill(user.email)
  await page.locator('input[type="password"]').fill('test-password')
  await page.locator('button[type="submit"]').click()
  await page.getByRole('heading', { name: `Welcome, ${user.name}.` }).waitFor()
  await page.locator('.overview-summary-loading').waitFor()
  assert.equal(await page.locator('.loading-modal-overlay').count(), 0)
  assert.equal(calls.filter(action => action === 'currentUser').length, 0)
  await page.getByRole('button', { name: 'Create document', exact: false }).first().click()
  await page.getByLabel('Document type', { exact: true }).waitFor()
  assert.ok(finishOverview, 'Overview request is still pending while the editor opens')
  finishOverview()
  assert.deepEqual(errors, [])
  console.log('PASS: dashboard usable during delayed summary, no redundant account check, editor opens before summary finishes')
} finally { await browser.close() }
