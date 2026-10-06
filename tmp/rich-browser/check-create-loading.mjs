import assert from 'node:assert/strict'
import { chromium } from './node_modules/playwright/index.mjs'
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
try{
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const user={name:'Layout check',email:'test@jhcsc.edu.ph',role:'super admin',token:'test'};
await page.addInitScript(u=>localStorage.setItem('op-dms-user',JSON.stringify(u)),user);
await page.route('**/apps-script',async route=>{const {action}=route.request().postDataJSON();await route.fulfill({json:{success:true,user,summary:{total:0,types:{},statuses:{},months:{}},documents:[],richBodyVersion:1,action}})});
for(const width of [1440,800,390]){
await page.setViewportSize({width,height:1000});await page.goto('http://localhost:5173');await page.getByRole('button',{name:'Create document',exact:false}).first().click();await page.getByLabel('Document type',{exact:true}).waitFor();
for(const type of ['Executive Memorandum','Special Order','Travel Order','Certificate of Travel','Authority to Travel Abroad']){
await page.getByLabel('Document type',{exact:true}).selectOption(type);if(['Executive Memorandum','Special Order'].includes(type))await page.locator('.tiptap').waitFor();
const layout=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,fields:[...document.querySelectorAll('.create-field input,.create-field select,.create-field textarea')].filter(e=>e.getBoundingClientRect().width>0).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})}));assert.ok(layout.scroll<=layout.width&&layout.fields,JSON.stringify(layout));console.log('PASS Create document',type,width);
}
await page.screenshot({path:`tmp/rich-browser/create-aligned-${width}.png`,fullPage:true});
}
assert.deepEqual(errors,[])
}finally{await browser.close()}
