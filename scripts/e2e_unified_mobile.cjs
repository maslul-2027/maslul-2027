'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
  await page.locator('#course option').first().waitFor({timeout:20000});
  await page.waitForFunction(()=>window.S&&S.courseId&&S.ctx,{timeout:20000});
  assert.equal(await page.locator('iframe').count(),0);
  assert.equal(await page.locator('#mobile-navigation button').count(),4);
  await page.locator('[data-mobile-route="soldiers"]').click();
  await page.locator('#fq').waitFor({timeout:20000});
  assert.equal(await page.evaluate(()=>S.tab),'soldiers');
  await page.locator('[data-mobile-route="attendance"]').click();
  await page.getByText('אירועי נוכחות').first().waitFor({timeout:20000});
  assert.equal(await page.evaluate(()=>S.tab),'attendance');
  await page.locator('[data-mobile-route="dash"]').click();
  await page.waitForFunction(()=>S.tab==='dash',{timeout:10000});
  await page.locator('[data-mobile-route="more"]').click();
  await page.waitForFunction(()=>document.getElementById('menuBtn').getAttribute('aria-expanded')==='true',{timeout:10000});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=2,'Page must not overflow horizontally: '+overflow);
  assert.deepEqual(errors,[],'Page JS errors: '+errors.join(', '));
  console.log('PASS: browser course init, 4-tab mobile nav, roster, attendance, dashboard, accessible drawer, no iframe, no overflow');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
