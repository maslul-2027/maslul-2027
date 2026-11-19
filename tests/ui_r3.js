// R3 — browser test of the general form link + reports shortcut. (setup shared with ui_b7b8)  // ORIGINAL: B7 + B8 — browser test (Chromium) of src/Index.html against the REAL server code in Node (google.script.run shimmed). NOT Apps Script / HtmlService.
// B7: "חסרים בכש״ג" screen (commander isolation, states, filters, counts, read-only, 390 / 1280). B8: local mm:ss validation (inline error, form kept, nothing sent).
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { load } = require('./harness'); const { goTab, allTabIds } = require('./uihelp');
let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.log('SKIP ui_b7b8: playwright not available'); process.exit(0); }
const X = load(); require('./fakes').install(X);
const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
const c1 = X.Courses.create(admin, { name: 'קורס א', start_date: '2099-01-01' }).id;
X.Courses.addUser(admin, { email: 'admin@x.com', role: 'admin', display_name: 'מנהל' });
const mkc = (e, scope, id) => { X.Courses.addUser(admin, { email: e, role: 'commander', course_ids: [c1], display_name: 'מפקד' }); X.Assignments.create(admin, { course_id: c1, user_email: e, scope_type: scope, scope_id: id, reason: 'בדיקה' }); };
const org = X.Courses.org(admin, c1), T0 = org.teams[0], T1 = org.teams.find(t => t.id !== T0.id);
mkc('team0@x.com', 'team', T0.id); mkc('all@x.com', 'course', c1);
const mkS = (n, pn, team, g) => X.Soldiers.create(admin, c1, { full_name: n, personal_number: pn, gender: g || 'M', department_id: team.department_id, team_id: team.id });
const sA = mkS('SOLDIERA', '3001', T0), sB = mkS('SOLDIERB', '3002', T0, 'F'), sC = mkS('SOLDIERC', '3003', T1), sD = mkS('SOLDIERD', '3004', T1);
const v = X.Fitness.importDraft(admin, c1, {}); X.Fitness.approve(admin, v.id, { verified_against_source: true, reason: 'בדיקה' });
const reg = X.Fitness.typesList(admin, c1).find(x => !x.is_opening);
const res = (s, raw) => X.Records.create(admin, 'FitnessTests', c1, Object.assign({ request_id: X.Util.uuid(), soldier_id: s.id, test_date: '2026-11-09', test_type_id: reg.id }, raw)).record;
const FULL = { pullups: 15, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' };
let session = 'admin@x.com', rpcLog = [];
const GOOD = 'https://docs.google.com/forms/d/e/1FAIpQLSdAbCdEfGhIjKlMnOpQrStUvWxYz0123456789/viewform';
X.Forms._urlProvider = () => null;
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
const shim = `<script>(function(){function mk(){var ok,bad;var o={withSuccessHandler:function(f){ok=f;return o;},withFailureHandler:function(f){bad=f;return o;}};
['api','whoAmI'].forEach(function(m){o[m]=function(a,b){fetch('/rpc',{method:'POST',body:JSON.stringify({m:m,a:a,b:b})}).then(function(r){return r.json()}).then(function(j){ok&&ok(j)},function(e){bad&&bad(e)});};});return o;}
window.google={script:{get run(){return mk();}}};})();</script>`;
const server = http.createServer((req, res2) => {
  if (req.method === 'POST' && req.url === '/rpc') { let b = ''; req.on('data', d => b += d); req.on('end', () => { const p = JSON.parse(b); rpcLog.push(p); X.Auth._emailProvider = () => session; const out = p.m === 'api' ? X.api(p.a, p.b) : X.whoAmI(); res2.setHeader('content-type', 'application/json'); res2.end(JSON.stringify(out)); }); }
  else { res2.setHeader('content-type', 'text/html; charset=utf-8'); res2.end(html.replace('<head>', '<head>' + shim)); }
});
let pass = 0, fail = 0; async function t(n, f) { try { await f(); pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, '\n   ', e.message.split('\n')[0]); } }
(async () => {
  await new Promise(r => server.listen(0, r)); const url = 'http://127.0.0.1:' + server.address().port; const browser = await chromium.launch();
  const open = async (email, vp, mobile, perms) => { session = email; const o = mobile ? { viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: vp }; if (perms) o.permissions = ['clipboard-read', 'clipboard-write']; const ctx = await browser.newContext(o); const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(e.message)); await page.goto(url); await page.waitForSelector('#grps button', { state: 'attached' }); await goTab(page, 'soldiers'); await page.waitForSelector('#pfBlock'); await page.waitForTimeout(250); return page; };
  const noOverflow = async p => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'horizontal overflow');
  try {
    X.Forms._urlProvider = () => null;
    const a0 = await open('admin@x.com', { width: 1280, height: 900 });
    await t('not configured: honest Hebrew message, copy button disabled, no open link, nothing invented', async () => {
      const msg = await a0.textContent('#pfMsg'); assert.ok(/לא הוגדר/.test(msg) && /PERSONAL_FORM_URL/.test(msg), msg); assert.ok(await a0.isDisabled('#pfCopy')); assert.ok(!(await a0.isVisible('#pfOpen'))); assert.ok(!/docs\.google|forms\.gle|undefined|null/.test(await a0.textContent('#pfBlock'))); });
    X.Forms._urlProvider = () => 'https://docs.google.com/forms/d/1FAIpQLSdAbCdEfGhIjKlMnOpQrStUv/edit';
    const a1 = await open('admin@x.com', { width: 1280, height: 900 });
    await t('an EDIT link in the configuration is never shown or opened (admin)', async () => { assert.ok(/אינו קישור מילוי תקין/.test(await a1.textContent('#pfMsg'))); assert.ok(await a1.isDisabled('#pfCopy')); const h = await a1.content(); assert.ok(!/\/edit/.test(h.replace(/<script[\s\S]*?<\/script>/g, ''))); });
    X.Forms._urlProvider = () => GOOD;
    const a = await open('admin@x.com', { width: 1280, height: 900 }, false, true);
    await t('admin 1280: copy button copies exactly the fill-in link (clipboard verified)', async () => {
      assert.ok(await a.isEnabled('#pfCopy')); assert.strictEqual((await a.textContent('#pfCopy')).trim(), 'העתקת קישור לטופס פרטים אישיים'); await a.click('#pfCopy'); await a.waitForFunction(() => /הועתק/.test(document.querySelector('#pfMsg').textContent));
      assert.strictEqual(await a.evaluate(() => navigator.clipboard.readText()), GOOD); });
    await t('admin: "open for testing" is a new-tab link with noopener, to the same URL', async () => { assert.ok(await a.isVisible('#pfOpen')); assert.strictEqual(await a.getAttribute('#pfOpen', 'href'), GOOD); assert.strictEqual(await a.getAttribute('#pfOpen', 'target'), '_blank'); assert.ok(/noopener/.test(await a.getAttribute('#pfOpen', 'rel'))); });
    await t('copying / opening changes nothing in the system (no write call is sent; the link is fetched with a read route)', async () => {
      const w = rpcLog.filter(x => x.m === 'api' && /create|save|update|edit|cancel|approve|import|generate/.test(x.a)); assert.deepStrictEqual(w, []); assert.ok(rpcLog.some(x => x.a === 'forms.generalLink')); });
    const f = await open('admin@x.com', { width: 1280, height: 900 });   // no clipboard permission -> fallback: selected, visible field
    await t('clipboard blocked: fallback shows the link selected for manual copy with a clear message', async () => {
      await f.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) }, configurable: true }); document.execCommand = () => false; });
      await f.click('#pfCopy'); await f.waitForSelector('#pfManual', { state: 'visible' }); assert.strictEqual(await f.inputValue('#pfManual'), GOOD); assert.ok(/ידנית/.test(await f.textContent('#pfMsg'))); });
    const m = await open('admin@x.com', { width: 390, height: 844 }, true, true);
    await t('mobile 390: button reachable (>=40px), no overflow, no page errors', async () => { await noOverflow(m); const bb = await (await m.$('#pfCopy')).boundingBox(); assert.ok(bb && bb.height >= 40, JSON.stringify(bb)); assert.deepStrictEqual(m.errs, []); });
    const c = await open('team0@x.com', { width: 1280, height: 900 }, false, true);
    await t('team commander: gets the fill-in link (copy works), no reports shortcut, no admin tabs', async () => {
      assert.ok(await c.isEnabled('#pfCopy')); await c.click('#pfCopy'); await c.waitForFunction(() => /הועתק/.test(document.querySelector('#pfMsg').textContent)); assert.ok(!(await c.$('#toReports'))); assert.ok(!(await c.$('#tab_forms'))); assert.deepStrictEqual(c.errs, []); });
    await t('admin: "הפקת דוחות" shortcut on the soldiers screen opens the reports screen; preview works; xlsx + pdf generation works', async () => {
      session = 'admin@x.com'; await a.click('#toReports'); await a.waitForSelector('#rs_soldiers'); await a.check('#rs_soldiers'); await a.check('#rs_fitness'); await a.click('button:has-text("תצוגה מקדימה")'); await a.waitForFunction(() => /תצוגה מקדימה: /.test(document.querySelector('#tabMsg').textContent)).catch(async e => { console.log('DBG', await a.evaluate(() => Array.from(document.querySelectorAll('#tabMsg')).map(x => x.className + ':' + x.textContent))); throw e; });
      const n0 = X.Db.all('ReportJobs').length; await a.click('button:has-text("הפק Excel")'); await a.waitForFunction(() => /הדוח נוצר/.test(document.querySelector('#tabMsg').textContent)).catch(async e => { console.log('DBG2', await a.evaluate(() => Array.from(document.querySelectorAll('#tabMsg')).map(x => x.className + ':' + x.textContent))); throw e; }); await a.click('button:has-text("הפק PDF")');
      await a.waitForTimeout(400); assert.strictEqual(X.Db.all('ReportJobs').length, n0 + 2); assert.deepStrictEqual(a.errs, []); await noOverflow(a); });
    await t('team commander: reports screen previews only (no generate buttons); preview shows only his team', async () => {
      session = 'team0@x.com'; await goTab(c, 'reports'); await c.waitForSelector('#rs_soldiers'); assert.strictEqual((await c.$$('button:has-text("הפק")')).length, 0); await c.check('#rs_soldiers'); await c.click('button:has-text("תצוגה מקדימה")'); await c.waitForFunction(() => /תצוגה מקדימה: /.test(document.querySelector('#tabMsg').textContent)); assert.ok(!/SOLDIERC|SOLDIERD/.test(await c.content())); });
  } finally { await browser.close(); server.close(); }
  console.log('\nUI R3 TOTAL pass=' + pass + ' fail=' + fail); if (fail) process.exit(1);
})();
