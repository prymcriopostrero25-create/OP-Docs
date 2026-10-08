import assert from 'node:assert/strict'
import { chromium } from './node_modules/playwright/index.mjs'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const user={name:'Startup test',email:'test@jhcsc.edu.ph',role:'super admin',token:'test-session'}
const summary={total:3,types:{'Special Order':3},statuses:{Approved:3},months:{'2026-10':3}}
try {
 for (const mode of ['restored','cold-login','warm-login']) {
  const page=await browser.newPage()
  const calls=[], errors=[], requests=[]
  page.on('pageerror', e=>errors.push(e.message))
  page.on('request', r=>requests.push(r.url()))
  if(mode==='restored') await page.addInitScript(user=>localStorage.setItem('op-dms-user',JSON.stringify(user)),user)
  let finishOverview
  await page.route('**/apps-script',async route=>{
   const {action}=route.request().postDataJSON()
   calls.push(action)
   if(action==='overview') await new Promise(resolve=>{finishOverview=resolve})
   await route.fulfill({json:{success:true,user,...(action==='overview'||mode==='warm-login'?{summary}:{}),documents:[]}})
  })
  await page.goto('http://localhost:5188/')
  if(mode!=='restored') {
   await page.locator('input[type=email]').fill(user.email)
   await page.locator('input[type=password]').fill('test-password')
   await page.locator('button[type=submit]').click()
  }
  await page.getByRole('heading',{name:'Welcome, Startup test.'}).waitFor()
  if(mode!=='warm-login') {
   await page.locator('.overview-summary-loading').waitFor()
   await page.getByRole('button',{name:'Browse documents',exact:false}).click()
   await page.getByRole('heading',{name:'Browse documents',exact:true}).waitFor()
   assert.ok(finishOverview,'Navigation works while overview is pending')
   finishOverview()
   await page.locator('.main-nav button').filter({hasText:'Overview'}).click()
  }
  await page.locator('.overview-metric').first().waitFor()
  assert.equal(calls.filter(a=>a==='overview').length, mode==='warm-login'?0:1)
  assert.equal(calls.filter(a=>a==='currentUser').length,0)
  assert.equal(requests.some(url=>url.includes('/src/pages/VerifyScanner')),false)
  await page.getByRole('button',{name:'Refresh overview',exact:true}).click()
  await page.locator('.overview-summary-loading').waitFor()
  finishOverview()
  await page.locator('.overview-summary-loading').waitFor({state:'hidden'})
  assert.deepEqual(errors,[])
  console.log(`PASS ${mode}: shared startup, nonblocking navigation, refresh, verification deferred`)
  await page.close()
 }
} finally { await browser.close() }
