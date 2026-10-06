import { chromium } from './node_modules/playwright/index.mjs'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:5187/tmp/rich-browser/harness.html')
  await page.evaluate(async () => {
    const React = await import('/node_modules/.vite/deps/react.js')
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { default: Sidebar } = await import('/src/components/Sidebar.jsx')
    const host = document.createElement('div')
    document.body.replaceChildren(host)
    ReactDOM.createRoot(host).render(React.default.createElement(Sidebar, { user: { name: 'Prym', email: 'prym@jhcsc.edu.ph', role: 'super admin' }, active: 'Overview', isOpen: true }))
  })
  for (const height of [900, 650, 450]) {
    await page.setViewportSize({ width: 1390, height })
    await page.locator('.sidebar').hover()
    await page.waitForTimeout(350)
    const result = await page.evaluate(() => ({ bottom: document.querySelector('.sidebar-user').getBoundingClientRect().bottom, helpTop: document.querySelector('.sidebar-help').getBoundingClientRect().top, navBottom: document.querySelector('.main-nav').getBoundingClientRect().bottom }))
    if (result.bottom > height || result.navBottom > result.helpTop) throw Error(JSON.stringify(result))
    console.log(`PASS expanded sidebar at height ${height}`)
  }
} finally { await browser.close() }
