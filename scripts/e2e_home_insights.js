// Browser E2E: real backend-aggregated synthetic course insights, no external AI.
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const dir=path.resolve(process.argv[2]||'preview');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((req,res)=>{
  const u=req.url.split('?')[0],p=path.resolve(dir,'.'+(u==='/'?'/index.html':u));
  if(!p.startsWith(dir+path.sep)&&p!==dir){res.statusCode=403;return res.end();}
  if(!fs.existsSync(p)){res.statusCode=404;return res.end();}
  res.setHeader('content-type',MIME[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));
});
(async()=>{
 await new Promise(resolve=>srv.listen(0,resolve));
 const browser=await chromium.launch({headless:true});
 try {
  const base='http://127.0.0.1:'+srv.address().port;
  for(const width of [320,390,414]){
   const page=await browser.newPage({viewport:{width,height:850}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base);
   await page.waitForFunction(()=>document.getElementById('k1')?.textContent==='60',{timeout:30000});
   await page.waitForFunction(()=>{const x=document.getElementById('home-brief');return !!x&&!x.textContent.includes('טוען')},{timeout:30000});
   assert.equal(await page.locator('iframe').count(),0);
   assert.equal(await page.locator('.tab').count(),4);
   assert.ok(await page.locator('#home-insights > .home-insight-card').count()<=3,'Must limit home insight cards');
   assert.ok(await page.locator('#home-insights > .home-insight-card').count()>0,'Group coverage insight should exist in synthetic course');
   const text=await page.locator('#home-insights').innerText();
   assert.ok(text.includes('פערי השלמה')||text.includes('נוכחות'),'Insights must be grounded in engine output');
   assert.ok(!(await page.locator('#home-brief').innerText()).includes('סיכון לחניך'),'No individual risk labels');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No overflow');
   await page.locator('.home-questions button').first().click();
   await page.waitForFunction(()=>{const x=document.getElementById('home-answer');return !!x&&!x.textContent.includes('בודק נתונים')&&!x.textContent.includes('בחרו שאלה')},{timeout:30000});
   assert.ok((await page.locator('#home-answer').innerText()).includes('לא מודל AI גנרטיבי'),'Do not misrepresent rule assistant');
   assert.deepEqual(errors,[],'No JS errors');
   if(width===390){
    if(process.env.E2E_CALLS_OUT)fs.writeFileSync(process.env.E2E_CALLS_OUT,JSON.stringify(await page.evaluate(()=>window.appClient.calls||[])));
    await page.evaluate(()=>{
     const orig=window.appClient.api.bind(window.appClient);
     window.appClient.api=function(method,args){
      if(method==='analytics.insights')return Promise.resolve({ok:true,data:{small_group:true,notice:'קבוצה קטנה — אין תובנות קבוצתיות'}});
      return orig(method,args);
     };
    });
    await page.locator('[data-go=soldiers]').click();await page.locator('[data-go=home]').click();
    await page.waitForFunction(()=>document.getElementById('home-insights')?.textContent.includes('קבוצה קטנה'),{timeout:30000});
    assert.equal(await page.locator('#home-insights .home-insight-card').count(),0,'N<5 must hide all insights');
    await page.evaluate(()=>{
     window.appClient.api=function(method){return method==='analytics.insights'?Promise.resolve({ok:false,code:'NOT_CONNECTED'}):Promise.resolve({ok:true,data:[]});};
    });
    await page.locator('[data-go=soldiers]').click();await page.locator('[data-go=home]').click();
    await page.waitForFunction(()=>document.getElementById('home-insights')?.textContent.includes('אין תובנות זמינות'),{timeout:30000});
    assert.ok(await page.locator('#k1').count()===1,'KPI shell persists when insights fail');
   }
   await page.close();
  }
  console.log('PASS: grounded home insights, scoped explanation, rule assistant, N<5 suppression, error fallback, mobile RTL');
 } finally{await browser.close();srv.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
