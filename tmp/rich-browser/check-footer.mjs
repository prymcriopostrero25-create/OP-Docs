import { chromium } from './node_modules/playwright/index.mjs'
import { PDFDocument } from 'pdf-lib'
import fs from 'node:fs'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
 const page = await browser.newPage({viewport:{width:1440,height:1200}})
 await page.goto('http://127.0.0.1:5188/tmp/rich-browser/preview-pdf.html')
 await page.locator('article time').waitFor()
 for (const long of [false,true]) {
  if(long) await page.evaluate(() => {
   const article=document.querySelector('article'), footer=article.querySelector('footer')
   const block=document.createElement('div')
   for(let i=0;i<70;i++){const p=document.createElement('p');p.textContent=`Paragraph ${i+1}: Long document content must stay above the footer on every page.`; block.appendChild(p)}
   article.insertBefore(block,footer)
  })
  const result=await page.evaluate(async () => {
   let down=false
   const scrolling=setInterval(()=>{window.scrollTo(0,down?0:document.body.scrollHeight);down=!down},50)
   try{return await window.exportPreview()}finally{clearInterval(scrolling)}
  })
  const pdf=await PDFDocument.load(Uint8Array.from(result.bytes))
  if(long && pdf.getPageCount()<2) throw Error('Expected multiple pages')
  const texts=await page.evaluate(async bytes => {
   const pdfjs=await import('/node_modules/pdfjs-dist/build/pdf.mjs'), worker=await import('/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url'); pdfjs.GlobalWorkerOptions.workerSrc=worker.default
   const doc=await pdfjs.getDocument({data:Uint8Array.from(bytes)}).promise, results=[]
   for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i);results.push((await p.getTextContent()).items.map(t=>({text:t.str,y:t.transform[5]})))}
   return results
  },result.bytes)
  texts.forEach((items,i)=>{if(!items.some(t=>t.text===String(i+1)&&t.y<80))throw Error('Page number missing from bottom')})
  fs.writeFileSync(`tmp/rich-browser/footer-${long?'long':'short'}.pdf`,Buffer.from(result.bytes))
  console.log(`PASS ${long?'long':'short'}: ${pdf.getPageCount()} pages, footer numbers at bottom on every page`)
 }
} finally {await browser.close()}

