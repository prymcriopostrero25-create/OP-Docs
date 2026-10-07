import { chromium } from './node_modules/playwright/index.mjs'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
 const page = await browser.newPage()
 await page.route('https://fonts.googleapis.com/**', route => route.abort())
 await page.goto('http://127.0.0.1:5187/tmp/rich-browser/preview-pdf.html')
 await page.locator('article').waitFor()
 console.log(await page.evaluate(async () => {
  const React = await import('/node_modules/.vite/deps/react.js')
  const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js')
  const { default: DocumentPage } = await import('/src/components/DocumentPage.jsx')
  const host = document.createElement('div'); document.body.replaceChildren(host)
  ReactDOM.createRoot(host).render(React.default.createElement(DocumentPage, { form: { type: 'Certificate of Travel', recipientName: 'April Ross Talip', place: 'South Korea', body: 'Travel certificate test', status: 'Draft' } }))
  await new Promise(resolve => setTimeout(resolve, 300))
  const paper = document.querySelector('article')
  const toSvg = window.debugSvg
  const svg = await toSvg(paper)
  const xml = new DOMParser().parseFromString(decodeURIComponent(svg.split(',')[1]), 'image/svg+xml')
  const { previewPdfFile } = await import('/src/lib/previewPdf.js')
  try { const pdf = await previewPdfFile(paper); return { size: pdf.size } }
  catch (e) { return { error: String(e), type: e.constructor.name, message: e.message, xmlError: xml.querySelector('parsererror')?.textContent } }
 }))
} finally { await browser.close() }



