import { chromium } from './node_modules/playwright/index.mjs'
import { PDFDocument } from 'pdf-lib'
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1200}})
 await page.goto('http://127.0.0.1:5189/tmp/rich-browser/preview-pdf.html?integration&long')
 await page.getByRole('button',{name:'Preview Preview download test',exact:true}).click()
 await page.locator('.html-preview-page').first().waitFor({timeout:60000})
 await page.getByRole('link',{name:'Save as PDF',exact:true}).waitFor()
 await page.locator('.preview-loading').waitFor({state:'hidden'})
 const stable=await page.evaluate(async()=>{
  const canvas=document.querySelector('.html-preview-page')
  await new Promise(resolve=>setTimeout(resolve,5000))
  return canvas.isConnected && canvas===document.querySelector('.html-preview-page')
 })
 if(!stable)throw Error('Preview restarted after rendering')
 const bytes=await page.getByRole('link',{name:'Save as PDF',exact:true}).evaluate(async link=>Array.from(new Uint8Array(await(await fetch(link.href)).arrayBuffer())))
 const pdf=await PDFDocument.load(Uint8Array.from(bytes))
 const count=await page.locator('.html-preview-page-slot').count()
 if(count<2)throw Error('Expected multiple preview pages')
 if(count!==pdf.getPageCount()) throw Error('Preview pagination differs from PDF')
 for(const p of pdf.getPages()){const {width,height}=p.getSize();if(Math.abs(width-595.28)>0.01||Math.abs(height-841.89)>0.01)throw Error('Not A4')}
 await page.setViewportSize({width:390,height:900})
 await page.waitForTimeout(1000)
 await page.locator('.html-preview-page').first().waitFor()
 if(await page.locator('.html-preview-page-slot').count()!==count)throw Error('Resize changed pagination')
 if(!await page.getByRole('button',{name:'Edit',exact:true}).isVisible())throw Error('Edit action unavailable')
 console.log(`PASS: ${count} A4 preview pages match download; mobile resize retains pagination`)
} finally {await browser.close()}
