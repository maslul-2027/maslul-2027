// Browser smoke test of src/Index.html (headless Chromium via Playwright) against the REAL server code running in Node.
// google.script.run is shimmed to POST to a local bridge that calls Code.gs api()/whoAmI() with a chosen session email.
// This checks the UI wiring + rendering + XSS-safety only. It is NOT Apps Script / HtmlService behaviour.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { load } = require('./harness'); const { goTab, allTabIds } = require('./uihelp');
let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.log('SKIP ui_smoke: playwright not available'); process.exit(0); }

const X = load(); require('./fakes').install(X);
const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
const c1 = X.Courses.create(admin, { name: 'קורס א', start_date: '2099-01-01' }).id;
const cs = X.Courses.create(admin, { name: 'קורס שהתחיל', start_date: '2000-01-01' }).id;
X.Courses.addUser(admin, { email: 'admin@x.com', role: 'admin', display_name: 'מנהל' });
X.Courses.addUser(admin, { email: 'cmd@x.com', role: 'commander', course_ids: [c1], display_name: 'מפקד' });
X.Assignments.create(admin, { course_id: c1, user_email: 'cmd@x.com', scope_type: 'course', scope_id: c1, reason: 'בדיקה' });
const org = X.Courses.org(admin, c1);
const mk = (n, pn, over) => X.Soldiers.create(admin, c1, Object.assign({ full_name: n, personal_number: pn, gender: 'M', department_id: org.departments[0].id, team_id: org.teams[0].id, commander_note: 'SECRET-ADMIN-NOTE' }, over || {}));
mk('דנה לוי', '1001'); const XSS = mk('<img src=x onerror=window.__xss=1>', '1002'); mk('אבי כהן', '1003');
let session = 'admin@x.com';

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
const shim = `<script>(function(){function mk(){var ok,bad;var o={withSuccessHandler:function(f){ok=f;return o;},withFailureHandler:function(f){bad=f;return o;}};
['api','whoAmI'].forEach(function(m){o[m]=function(a,b){fetch('/rpc',{method:'POST',body:JSON.stringify({m:m,a:a,b:b})}).then(function(r){return r.json()}).then(function(j){ok&&ok(j)},function(e){bad&&bad(e)});};});return o;}
window.google={script:{get run(){return mk();}}};})();</script>`;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rpc') {
    let b = ''; req.on('data', d => b += d); req.on('end', () => { const p = JSON.parse(b); X.Auth._emailProvider = () => session;
      const out = p.m === 'api' ? X.api(p.a, p.b) : X.whoAmI(); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(out)); });
  } else { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html.replace('<head>', '<head>' + shim)); }
});
let pass = 0, fail = 0; const failures = [];
async function t(name, fn) { try { await fn(); pass++; console.log('PASS', name); } catch (e) { fail++; failures.push(name); console.log('FAIL', name, '\n   ', e.message.split('\n')[0]); } }

(async () => {
  await new Promise(r => server.listen(0, r)); const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(); const ctxs = [];
  const open = async (email, viewport) => { session = email; const ctx = await browser.newContext({ viewport: viewport || { width: 1200, height: 900 } }); ctxs.push(ctx); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.errs = errs; await page.goto(url); await page.waitForSelector('#grps button', { state: 'attached' }); await goTab(page, 'soldiers'); await page.waitForSelector('#listOut table, #mineMsg:not(.hide)'); return page; };
  const rowsOf = async page => page.$$eval('#listOut tbody tr', trs => trs.map(t => t.textContent));
  const ids = X.Db.all('Soldiers').map(s => s.id); const A = X.Db.all('Soldiers')[0].id;
  X.Private.saveNote(admin, c1, { soldier_id: A, note_text: 'PRIVATE-NOTE-XYZ' });
  X.Records.create(admin, 'MarksmanshipTests', c1, { request_id: 'r1', soldier_id: A, test_date: '2026-03-02', weapon_type: 'M16', distance_m: 100, examiner_score: 80, weapon_zeroed: true });
  X.Records.create(admin, 'SoldierEvents', c1, { request_id: 'r2', soldier_id: A, event_date: '2026-03-07', event_type: 'achievement', description: '<b onmouseover=window.__xss=2>מצטיין</b>' });
  try {
    const SCREENS = ['home', 'compare', 'fitness', 'mk', 'exams', 'attendance', 'readiness', 'events', 'qual', 'alerts', 'reports', 'docs', 'ai'], ADMINS = ['private', 'forms', 'import', 'ocr', 'settings', 'courses', 'backup'];
    const p = await open('admin@x.com');
    await t('ui v1 (admin): every screen opens, renders content, no page errors, no horizontal overflow', async () => {
      for (const s of SCREENS.concat(ADMINS)) { await goTab(p, s); await p.waitForSelector('#view .card'); await p.waitForTimeout(150); const txt = await p.textContent('#view'); assert.ok(txt.length > 30, s + ' empty'); assert.ok(!/undefined|NaN|\[object Object\]/.test(txt), s + ' shows junk: ' + (txt.match(/.{20}(undefined|NaN|\[object Object\]).{10}/) || [''])[0]); const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(ov <= 0, s + ' overflow ' + ov); }
      assert.deepStrictEqual(p.errs, []); });
    await t('ui v1 (admin): marksmanship entry saves via the form and shows in the list; empty required field is refused by the server message', async () => {
      await goTab(p, 'mk'); await p.waitForSelector('#f_soldier_id option:nth-child(2)', { state: 'attached' });
      await p.click('#view button:has-text("שמירה")'); await p.waitForFunction(() => document.querySelector('#view .msg.err') && document.querySelector('#view .msg.err').textContent.length > 0);
      await p.selectOption('#f_soldier_id', A); await p.fill('#f_test_date', '2026-03-09'); await p.fill('#f_weapon_type', 'M16'); await p.fill('#f_distance_m', '100'); await p.fill('#f_examiner_score', '90'); await p.check('#f_weapon_zeroed');
      await p.click('#view button:has-text("שמירה")'); await p.waitForFunction(() => /נשמר/.test(document.querySelector('#view').textContent)); assert.strictEqual(X.Db.all('MarksmanshipTests').length, 2); });
    await t('ui v1 (admin): exam attempt, readiness and event forms write through the real API', async () => {
      const ex = X.Exams.defCreate(admin, c1, { name: 'מבחן ממשק' });
      await goTab(p, 'exams'); await p.waitForSelector('#f_exam_id option:nth-child(1)', { state: 'attached' }); await p.selectOption('#f_soldier_id', A); await p.selectOption('#f_exam_id', ex.id); await p.selectOption('#f_attempt', 'A'); await p.fill('#f_attempt_date', '2026-03-10'); await p.fill('#f_score', '85');
      await p.click('#view button:has-text("שמירת מועד")'); await p.waitForFunction(() => /נשמר/.test(document.querySelector('#view').textContent)); assert.strictEqual(X.Db.all('TheoreticalExamAttempts').length, 1);
      await goTab(p, 'readiness'); await p.waitForSelector('#f_status'); await p.selectOption('#f_soldier_id', A); await p.selectOption('#f_status', 'fit_with_restrictions'); await p.fill('#f_restrictions', 'ללא ריצה'); await p.fill('#f_start_date', '2026-03-11');
      await p.click('#view button:has-text("שמירה")'); await p.waitForFunction(() => /נשמר/.test(document.querySelector('#view').textContent)); assert.strictEqual(X.Db.all('ReadinessRecords').length, 1);
      assert.ok(/אבחנ/.test(await p.textContent('#view')), 'no-medical-diagnosis notice shown'); });
    await t('ui v1 (admin): full soldier card has tabs + timeline; private tab is separate and loads private data only on click', async () => {
      await goTab(p, 'soldiers'); await p.waitForSelector('#listOut tbody tr'); await p.fill('#fq', '1001'); await p.waitForFunction(() => document.querySelectorAll('#listOut tbody tr').length === 1); await p.click('#listOut tbody tr'); await p.waitForSelector('#v1card .tab');
      const labels = await p.$$eval('#v1card .bar button', bs => bs.map(b => b.textContent)); ['ציר זמן', 'כש״ג', 'קליעה', 'מבחנים', 'נוכחות ומסעות', 'הסמכות', 'כשירות', 'אירועים והישגים', 'התראות', 'פרטי למ״פ'].forEach(l => assert.ok(labels.includes(l), l));
      assert.ok(!(await p.textContent('#v1card')).includes('PRIVATE-NOTE-XYZ'), 'private text absent before click'); assert.ok((await p.textContent('#v1card')).includes('קליעה'));
      await p.click('#v1card button[data-k=priv]'); await p.waitForFunction(() => document.querySelector('#v1card').textContent.includes('PRIVATE-NOTE-XYZ'));
      await p.click('#v1card button[data-k=mk]'); assert.ok(!(await p.textContent('#v1card')).includes('PRIVATE-NOTE-XYZ'), 'private text gone when another tab is open'); });
    await t('ui v1: XSS payloads in names / events are shown as text, never executed', async () => {
      await goTab(p, 'events'); await p.waitForSelector('#view table'); await p.waitForTimeout(300); assert.strictEqual(await p.evaluate(() => window.__xss || 0), 0); assert.ok((await p.textContent('#view')).includes('<b onmouseover')); });
    await t('ui v1 (admin): reports preview + backup create/verify through the UI', async () => {
      await goTab(p, 'reports'); await p.check('#rs_mk'.replace('mk', 'soldiers')); await p.click('#view button:has-text("תצוגה מקדימה")'); await p.waitForFunction(() => /תצוגה מקדימה:/.test(document.querySelector('#view').textContent));
      await goTab(p, 'backup'); await p.click('#view button:has-text("גיבוי ידני")'); await p.waitForFunction(() => /הגיבוי נוצר/.test(document.querySelector('#view').textContent)); assert.ok(X.Db.all('BackupJobs').length >= 1);
      await p.click('#pfRun'); await p.waitForSelector('#pfOverall'); const ov = await p.textContent('#pfOverall'); assert.ok(/INCOMPLETE|FAIL|PASS/.test(ov)); assert.ok(/NOT_VERIFIED/.test(await p.textContent('#pfOut')) && /BLOCKED/.test(await p.textContent('#pfOut')), 'unverifiable items are shown as such'); });
    await t('ui v1 (admin): no uncaught page errors across the whole session', async () => assert.deepStrictEqual(p.errs, []));
    const tm = await open('cmd@x.com', { width: 390, height: 800 });
    await t('ui v1 (phone, commander): admin-only tabs and private tab do not exist; allowed screens render without overflow', async () => {
      const tabs = (await allTabIds(tm)).map(i => i === 'soldiers' ? 'tabSoldiers' : i === 'nav' ? 'tabNav' : i === 'assign' ? 'tabAssign' : 'tab_' + i); ADMINS.forEach(a => assert.ok(!tabs.includes('tab_' + a), a)); assert.ok(!tabs.includes('tabAssign'));
      for (const s of SCREENS) { await goTab(tm, s); await tm.waitForSelector('#view .card'); await tm.waitForTimeout(120); const ov = await tm.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(ov <= 0, s + ' overflow ' + ov); assert.ok(!(await tm.textContent('#view')).includes('PRIVATE-NOTE-XYZ'), s); }
      assert.deepStrictEqual(tm.errs, []); });
    await t('ui v1 (commander): card has no private tab and the payload carries no private text; direct private API refused', async () => {
      await goTab(tm, 'soldiers'); await tm.waitForSelector('#listOut'); await tm.waitForFunction(() => document.querySelectorAll('#listOut tbody tr, #listOut .card').length > 0); await tm.click('#listOut tbody tr'); await tm.waitForSelector('#v1card .tab');
      assert.ok(!(await tm.$('#v1card button[data-k=priv]'))); assert.ok(!(await tm.textContent('body')).includes('PRIVATE-NOTE-XYZ')); assert.ok(!(await tm.textContent('body')).includes('SECRET-ADMIN-NOTE'));
      const r = await tm.evaluate(() => fetch('/rpc', { method: 'POST', body: JSON.stringify({ m: 'api', a: 'private.notes', b: { courseId: 'x' } }) }).then(x => x.json())); assert.strictEqual(r.ok, false); });
  } finally { await browser.close(); server.close(); }
  console.log('\nUI V1 TOTAL pass=' + pass + ' fail=' + fail); if (fail) { console.log('FAILED:', failures.join(' | ')); process.exit(1); }
})();
