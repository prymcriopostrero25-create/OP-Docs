import assert from 'node:assert/strict'
import { chromium } from './node_modules/playwright/index.mjs'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
 const page = await browser.newPage({viewport:{width:1440,height:1100}})
 const errors=[]
 page.on('pageerror', e=>errors.push(e.message))
 const user={name:'Alex',email:'test@jhcsc.edu.ph',role:'super admin',token:'test-session'}
 await page.route('**/apps-script',route=>route.fulfill({json:{success:true,user,summary:{total:120,types:{'Special Order':60,'Travel Order':35,'Executive Memorandum':25},statuses:{'For Review':30,'For Signature':20,Approved:40,Out:30},months:{'2026-10':20,'2026-09':30,'2026-08':14,'2026-07':22,'2026-06':18,'2026-05':16}},documents:[],richBodyVersion:1}}))
 await page.goto('http://localhost:5188/')
 await page.locator('input[type=email]').fill(user.email)
 await page.locator('input[type=password]').fill('test-password')
 await page.locator('button[type=submit]').click()
 await page.locator('.overview-metric').first().waitFor()
 assert.equal(await page.locator('.overview-column').count(),6)
 await page.getByRole('button',{name:'12 months',exact:true}).click()
 assert.equal(await page.locator('.overview-column').count(),12)
 await page.screenshot({path:'tmp/dashboard-desktop.png',fullPage:true})
 await page.getByRole('button',{name:'Special Order',exact:false}).click()
 await page.locator('.document-type-pages button.active').waitFor()
 assert.match(await page.locator('.document-type-pages button.active').innerText(),/Special Order/)
 await page.locator('.main-nav button').filter({hasText:'Overview'}).click()
 await page.locator('.overview-metric').first().waitFor()
 await page.getByRole('button',{name:'Browse documents',exact:false}).click()
 assert.match(await page.locator('.document-type-pages button.active').innerText(),/All documents/)
 await page.locator('.main-nav button').filter({hasText:'Overview'}).click()
 await page.setViewportSize({width:390,height:844})
 await page.getByRole('button',{name:'12 months',exact:true}).click()
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),'No page horizontal overflow')
 await page.screenshot({path:'tmp/dashboard-mobile.png',fullPage:true})
 assert.deepEqual(errors,[])
 console.log('PASS: period controls, category navigation, browse reset, mobile overflow, no browser errors')
} finally { await browser.close() }

