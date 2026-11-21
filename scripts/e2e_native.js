// Browser E2E for the native app (Playwright/Chromium) on synthetic data: navigation, create/edit/cancel/restore soldier, follow-up create, double-click guard, a11y basics, overflow at 320/360/390/414.
const OUT=process.env.E2E_CALLS_OUT;const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');const {chromium}=require('playwright');
const dir=path.resolve(process.argv[2]||'preview');const M={'.html':'text/html;charset=utf-8','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0],f=path.join(dir,u==='/'?'index.html':u);if(!fs.existsSync(f)){r.statusCode=404;return r.end('')}r.setHeader('content-type',M[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f))});
(async()=>{await new Promise(r=>srv.listen(0,r));const base='http://127.0.0.1:'+srv.address().port,b=await chromium.launch(),errs=[];let n=0;const ok=m=>console.log('ok',++n,m);
for(const w of[320,360,390,414]){const c=await b.newContext({viewport:{width:w,height:780}});const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(base+'/');await p.waitForFunction(()=>!/…/.test(document.getElementById('k3')?.textContent||'…'),null,{timeout:12000}).catch(async e=>{
   const diag=await p.evaluate(()=>({home:document.getElementById('view')?.textContent.slice(0,450),k1:document.getElementById('k1')?.textContent,k3:document.getElementById('k3')?.textContent,client:typeof window.appClient,ready:!!window.__app,hash:location.hash}));
   throw new Error('Home load failed at '+w+': '+JSON.stringify(diag)+'; pageerrors='+errs.join(' | ')+'; '+e.message.split('\n')[0]);
 });
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow @'+w);
 for(const g of['soldiers','tasks','more','home']){await p.click('[data-go='+g+']');await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,g+' overflow @'+w);}
 const small=await p.evaluate(()=>[...document.querySelectorAll('button,a,input,select')].filter(e=>e.offsetParent&&(e.getBoundingClientRect().height<44)).map(e=>e.textContent.slice(0,20)));assert.deepEqual(small,[],'targets >=44px @'+w);
 await c.close();}
ok('no overflow & 44px targets at 320/360/390/414');
const c=await b.newContext({viewport:{width:390,height:780}}),p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(base+'/');await p.waitForFunction(()=>document.getElementById('k1')?.textContent==='60');ok('home KPI from engine = 60 soldiers (no constant)');
assert.equal(await p.locator('.tab').count(),4);assert.equal(await p.locator('iframe').count(),0);ok('4 tabs, no iframe');
await p.click('[data-go=soldiers]');await p.waitForSelector('#people .card');assert.equal(await p.locator('#people .card').count(),60);await p.fill('#q','zzzz');assert.equal(await p.locator('#people .card').count(),0);await p.fill('#q','');ok('list 60 + search empty state');
await p.click('.chip:nth-child(2)');assert.ok(await p.locator('#people .card').count()<60);ok('department filter');
await p.click('.chip:nth-child(1)');await p.click('text=+ הוספת חניך');await p.waitForSelector('#fName');await p.click('button[type=submit]');assert.ok(await p.locator('.field.err').count()>=2);ok('validation errors shown');
await p.fill('#fName','בדיקה אוטומטית');await p.fill('#fPn','7770001');await p.dblclick('button[type=submit]');await p.waitForSelector('dl.kv');assert.equal(await p.locator('h2').first().textContent(),'בדיקה אוטומטית');
await p.click('text=→ חזרה לרשימה');await p.waitForSelector('#people .card');await p.fill('#q','בדיקה אוטומטית');assert.equal(await p.locator('#people .card').count(),1,'double-click created exactly one');ok('create + double-click guard = exactly one record');
await p.click('#people .card');await p.waitForSelector('dl.kv');await p.click('text=עריכה');await p.waitForSelector('#fName');await p.fill('#fPakal','פקל-בדיקה');await p.click('button[type=submit]');await p.waitForSelector('.field.err');ok('edit requires reason');
await p.fill('#fReason','תיקון בדיקה');await p.click('button[type=submit]');await p.waitForSelector('dl.kv');assert.ok((await p.textContent('dl.kv')).includes('פקל-בדיקה'));ok('edit persisted via backend');
await p.click('text=ביטול חניך');await p.fill('#reason','בדיקה');await p.click('dialog button[type=submit]');await p.waitForSelector('text=מבוטל');ok('cancel with reason');
await p.click('button:has-text("שחזור")');await p.click('dialog button[type=submit]');await p.waitForSelector('button:has-text("ביטול חניך")');ok('restore');
await p.reload();await p.waitForSelector('dl.kv');await p.click('[data-go=home]');await p.waitForFunction(()=>document.getElementById('k1')?.textContent==='61');ok('state persisted across reload: 61');
await p.click('[data-go=tasks]');await p.click('text=מעקבים אישיים');await p.waitForSelector('#view .card');assert.equal(await p.locator('#view .card').count(),3);await p.click('text=+ מעקב חדש');await p.selectOption('#fuS',{index:1});await p.fill('#fuW','בדיקת מעקב');await p.click('button[type=submit]');await p.waitForSelector('text=בדיקת מעקב');ok('follow-up create');
await p.click('text=בדיקת מעקב');await p.click('dialog button[type=submit]');await p.waitForSelector('text=הושלם');ok('follow-up complete');

assert.deepEqual(errs,[],'page errors: '+errs.join('|'));ok('no page errors');if(OUT)fs.writeFileSync(OUT,JSON.stringify(await p.evaluate(()=>appClient.calls)));await b.close();srv.close();console.log('E2E PASS',n,'checks');})().catch(e=>{console.error('E2E FAIL',e.message.split('\n').slice(0,6).join('\n'));process.exit(1)});
