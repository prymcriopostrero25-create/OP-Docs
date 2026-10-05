import assert from 'node:assert/strict'
import { chromium } from './node_modules/playwright/index.mjs'

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } })
  page.setDefaultTimeout(15000)
  const actions = []
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const user = { name: 'Loading Test', email: 'test@jhcsc.edu.ph', role: 'super admin', token: 'test' }
  await page.addInitScript(account => localStorage.setItem('op-dms-user', JSON.stringify(account)), user)
  await page.route('**/apps-script', async route => {
    const request = route.request().postDataJSON()
    actions.push(request.action)
    let result = { success: true }
    if (request.action === 'currentUser') result.user = user
    if (request.action === 'overview') result.summary = { total: 2, types: { 'Special Order': 2 }, statuses: { Draft: 2 }, months: { '2026-10': 2 } }
    if (request.action === 'documents') result.documents = [{ id: 'SO-1', subject: 'Test order', type: 'Special Order', status: 'Draft', date: '2026-10-05' }]
    if (request.action === 'activityLogs') result.activities = []
    await route.fulfill({ json: result })
  })
  await page.goto('http://localhost:5173')
  console.log('Checking overview')
  await page.locator('.overview-metric').first().waitFor()
  assert.equal(actions.filter(action => action === 'overview').length, 1)
  assert.equal(actions.includes('documents'), false)
  assert.equal(actions.includes('activityLogs'), false)
  await page.getByRole('button', { name: 'Create document' }).click()
  console.log('Checking create page')
  await page.getByLabel('Document type', { exact: true }).waitFor()
  assert.equal(actions.includes('documents'), false)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  console.log('Checking documents')
  await page.getByRole('heading', { name: 'All documents', exact: true }).waitFor()
  await page.getByText('Test order', { exact: true }).waitFor()
  assert.equal(actions.filter(action => action === 'documents').length, 1)
  assert.equal(actions.includes('activityLogs'), false)
  await page.locator('.main-nav button').nth(3).click()
  console.log('Checking activity')
  await page.getByText('No activity yet', { exact: true }).waitFor()
  assert.equal(actions.filter(action => action === 'activityLogs').length, 1)
  await page.locator('.main-nav button').nth(1).click()
  await page.getByText('Test order', { exact: true }).waitFor()
  assert.equal(actions.filter(action => action === 'documents').length, 1)
  await page.locator('.main-nav button').nth(0).click()
  await page.locator('.overview-metric').first().waitFor()
  assert.equal(actions.filter(action => action === 'overview').length, 1)
  assert.deepEqual(errors, [])
  console.log('PASS: overview summary only; create page needs no list; documents and activity load on demand; navigation reuses cached data; no browser errors')
} finally {
  await browser.close()
}
