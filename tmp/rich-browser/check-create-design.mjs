import { chromium } from './node_modules/playwright/index.mjs'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('http://127.0.0.1:5187/tmp/rich-browser/harness.html')
    for (const type of ['Executive Memorandum', 'Special Order', 'Travel Order', 'Certificate of Travel', 'Authority to Travel Abroad']) {
      await page.getByLabel('Document type', { exact: true }).selectOption(type)
      if (['Executive Memorandum', 'Special Order'].includes(type)) await page.locator('.tiptap').waitFor()
      const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }))
      if (size.scroll > size.width) throw Error(`${type} overflow at ${width}`)
      console.log(`PASS ${type} at ${width}px`)
      if (type === 'Executive Memorandum') await page.screenshot({ path: `tmp/rich-browser/create-form-${width}.png`, fullPage: true })
    }
  }
  for (const input of await page.locator('form input[required], form textarea[required]').all()) {
    if (await input.inputValue()) continue
    await input.fill(await input.getAttribute('type') === 'date' ? '2026-10-06' : 'Design verification')
  }
  await page.getByRole('button', { name: 'Create document', exact: true }).click()
  await page.getByRole('dialog', { name: 'Document saved successfully' }).waitFor()
  console.log('PASS save and success dialog')
  if (errors.length) throw Error(errors.join('; '))
} finally { await browser.close() }
