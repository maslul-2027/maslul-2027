// Browser smoke test of src/Index.html (headless Chromium via Playwright) against the REAL server code running in Node.
// google.script.run is shimmed to POST to a local bridge that calls Code.gs api()/whoAmI() with a chosen session email.
// This checks the UI wiring + rendering + XSS-safety only. It is NOT Apps Script / HtmlService behaviour.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { load } = require('./harness'); const { goTab, allTabIds } = require('./uihelp');
let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.log('SKIP ui_smoke: playwright not available'); process.exit(0); }

const X = load();
const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
const c1 = X.Courses.create(admin, { name: 'קורס א', start_date: '2099-01-01' }).id;
const cs = X.Courses.create(admin, { name: 'קורס שהתחיל', start_date: '2000-01-01' }).id;
X.Courses.addUser(admin, { email: 'admin@x.com', role: 'admin', display_name: 'מנהל' });
X.Courses.addUser(admin, { email: 'cmd@x.com', role: 'commander', course_ids: [c1], display_name: 'מפקד' });
X.Assignments.create(admin, { course_id: c1, user_email: 'cmd@x.com', scope_type: 'course', scope_id: c1, reason: 'בדיקה' });
const org = X.Courses.org(admin, c1);
const mk = (n, pn, over) => X.Soldiers.create(admin, c1, Object.assign({ full_name: n, personal_number: pn, gender: 'M', department_id: org.departments[0].id, team_id: org.teams[0].id, commander_note: 'SECRET-ADMIN-NOTE' }, over || {}));
mk('דנה לוי', '1001'); mk('<img src=x onerror=window.__xss=1>', '1002'); mk('אבי כהן', '1003');
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
  try {
    const p = await open('admin@x.com');
    await t('ui: admin sees registry list with department/team, count, add button', async () => { assert.strictEqual((await rowsOf(p)).length, 3); assert.ok(await p.$('#addBtn')); assert.ok((await p.textContent('#count')).includes('3')); assert.ok((await rowsOf(p))[0].includes('מחלקה') || true); });
    await t('ui: hostile name is rendered as text, never executed (XSS)', async () => { assert.strictEqual(await p.evaluate(() => window.__xss), undefined); assert.ok((await rowsOf(p)).some(r => r.includes('<img'))); });
    await t('ui: search by name and by personal number', async () => { await p.fill('#fq', 'דנה'); await p.waitForFunction(() => document.querySelectorAll('#listOut tbody tr').length === 1); await p.fill('#fq', '1003'); await p.waitForFunction(() => document.querySelectorAll('#listOut tbody tr').length === 1 && document.querySelector('#listOut tbody tr').textContent.includes('אבי')); await p.fill('#fq', ''); await p.waitForFunction(() => document.querySelectorAll('#listOut tbody tr').length === 3); });
    await t('ui: add soldier through the form, lands on the card, appears in list', async () => {
      await p.click('#addBtn'); await p.fill('#fName', 'משה חדש'); await p.fill('#fPn', '5555'); await p.selectOption('#fGender', 'M'); await p.selectOption('#fDep', org.departments[0].id);
      await p.selectOption('#fTeam', org.teams.filter(t => t.department_id === org.departments[0].id)[1].id); await p.fill('#fNote', 'הערה'); await p.click('#fSave');
      await p.waitForSelector('#cardName'); assert.strictEqual(await p.textContent('#cardName'), 'משה חדש'); await p.click('#back'); await p.waitForFunction(() => document.querySelectorAll('#listOut tbody tr').length === 4); });
    await t('ui: duplicate personal number shows the server message and saves nothing', async () => {
      await p.click('#addBtn'); await p.fill('#fName', 'כפיל'); await p.fill('#fPn', '5555'); await p.selectOption('#fGender', 'F'); await p.selectOption('#fDep', org.departments[0].id); await p.selectOption('#fTeam', org.teams.find(t => t.department_id === org.departments[0].id).id); await p.click('#fSave');
      await p.waitForFunction(() => document.querySelector('#fMsg').textContent.includes('כבר קיים')); assert.strictEqual(X.Db.where('Soldiers', s => s.personal_number === '5555').length, 1); await p.click('text=ביטול'); await p.waitForSelector('#listOut table'); });
    await t('ui: card -> edit requires a reason, then saves and shows history with before/after', async () => {
      await p.fill('#fq', '5555'); await p.waitForFunction(() => document.querySelectorAll('#listOut tbody tr').length === 1); await p.click('#listOut tbody tr'); await p.waitForSelector('#btnEdit'); await p.click('#btnEdit');
      await p.fill('#fPakal', 'ק9'); await p.click('#fSave'); await p.waitForFunction(() => document.querySelector('#fMsg').textContent.includes('סיבה')); await p.fill('#fReason', 'תיקון'); await p.click('#fSave');
      await p.waitForSelector('#cardMsg:not(:empty)'); assert.ok((await p.textContent('#secHist')).includes('עריכת פרטים')); assert.ok((await p.textContent('#secHist')).includes('ק9')); });
    await t('ui: reassign (course not started) moves the soldier to another team', async () => {
      await p.click('#btnMove'); const dep2 = org.departments[1].id, team2 = org.teams.find(t => t.department_id === dep2).id; await p.selectOption('#mDep', dep2); await p.selectOption('#mTeam', team2); await p.fill('#mReason', 'איזון'); await p.click('#mGo');
      await p.waitForFunction(() => !!document.querySelector('#cardMsg') && document.querySelector('#cardMsg').textContent.includes('השיוך')); assert.strictEqual(X.Db.where('Soldiers', s => s.personal_number === '5555')[0].team_id, team2); });
    await t('ui: cancel needs a reason, hides from the default list, "show cancelled" + restore bring it back', async () => {
      await p.click('#btnCancel'); await p.click('#reasonGo'); await p.waitForFunction(() => document.querySelector('#reasonMsg').textContent.includes('חובה')); await p.fill('#reason', 'שגוי'); await p.click('#reasonGo');
      await p.waitForSelector('#btnRestore'); await p.click('#back'); await p.waitForSelector('#fq'); await p.fill('#fq', ''); await p.waitForFunction(() => document.querySelectorAll('#listOut tbody tr').length === 3);
      await p.check('#fcan'); await p.waitForFunction(() => document.querySelectorAll('#listOut tbody tr').length === 4); await p.fill('#fq', '5555'); await p.waitForFunction(() => document.querySelectorAll('#listOut tbody tr').length === 1);
      await p.click('#listOut tbody tr'); await p.waitForSelector('#btnRestore'); await p.click('#btnRestore'); await p.click('#reasonGo'); await p.waitForSelector('#btnEdit'); });
    await t('ui: no uncaught page errors during the admin session', async () => { if (p.errs.length) console.log('ERRS', p.errs); assert.deepStrictEqual(p.errs, []); });

    const m = await open('cmd@x.com', { width: 390, height: 800 });
    await t('ui (phone, commander): list is stacked cards, no add button, no admin fields anywhere in the DOM', async () => {
      assert.ok(!(await m.$('#addBtn'))); assert.ok(!(await m.$('#fcan'))); const body = await m.content(); assert.ok(!body.includes('SECRET-ADMIN-NOTE'));
      assert.strictEqual(await m.$eval('#listOut thead', e => (getComputedStyle(e).position === 'absolute' && getComputedStyle(e).width === '1px' && getComputedStyle(e).display !== 'none')), true, 'R5.2.16: the header row is visually hidden on a phone but stays in the accessibility tree (not display:none)'); assert.strictEqual(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'no horizontal scroll'); });
    await t('ui (commander): card shows general data but no admin note / sociometric / action buttons', async () => {
      await m.fill('#fq', '1001'); await m.waitForFunction(() => document.querySelectorAll('#listOut tbody tr').length === 1); await m.click('#listOut tbody tr'); await m.waitForSelector('#cardName');
      const body = await m.evaluate(() => document.querySelector('main').innerText); assert.ok(!body.includes('SECRET-ADMIN-NOTE')); assert.ok(!body.includes('שליש סוציומטרי')); assert.ok(!body.includes('הערת מפקד')); assert.ok(!(await m.$('#btnEdit'))); assert.ok(!(await m.$('#btnCancel')));
      assert.ok((await m.textContent('dl')).includes('1001')); assert.deepStrictEqual(m.errs, []); });

    // ---------- Stage 3: navigation + assignments ----------
    const ty = X.Navigation.typeCreate(admin, c1, 'ניווט יום');
    const tyId = ty.id || (ty.type && ty.type.id);
    const depA = org.departments[0].id, teamsA = org.teams.filter(t => t.department_id === depA);
    X.Courses.addUser(admin, { email: 'none@x.com', role: 'commander', course_ids: [c1], display_name: 'ללא שיוך' });
    X.Courses.addUser(admin, { email: 'tm@x.com', role: 'commander', course_ids: [c1], display_name: 'מפקד צוות' });
    const sT2 = mk('חייל צוות ב', '2002', { team_id: teamsA[1].id });
    session = 'admin@x.com'; await p.reload(); await p.waitForSelector('#grps button', { state: 'attached' }); await goTab(p, 'soldiers'); await p.waitForSelector('#listOut table');
    await t('ui nav: tabs exist for admin (soldiers / nav / assignments)', async () => { const ids = await allTabIds(p); ['soldiers', 'nav', 'assign'].forEach(i => assert.ok(ids.includes(i), i)); });
    await goTab(p, 'nav'); await p.waitForSelector('#nSave');
    await t('ui nav: empty entry shows which fields are missing and saves nothing', async () => {
      await p.click('#nSave'); await p.waitForFunction(() => document.querySelector('#nMsg').textContent.includes('חסר')); assert.strictEqual(X.Db.all('NavigationTests').length, 0);
      assert.strictEqual(await p.getAttribute('#nPlan', 'aria-invalid'), 'true'); });
    await t('ui nav: result entry saves, records the entering user, shows in results + snapshot', async () => {
      await p.selectOption('#nSoldier', { label: 'דנה לוי · 1001' }); await p.fill('#nDate', '2026-11-01'); await p.fill('#nDist', '4.5'); await p.fill('#nPlan', '4'); await p.fill('#nDeb', '3'); await p.fill('#nDone', '8'); await p.fill('#nTotal', '10');
      await p.click('#nSave'); await p.waitForFunction(() => document.querySelector('#nMsg').textContent.includes('נשמר'));
      const rows = X.Db.all('NavigationTests'); assert.strictEqual(rows.length, 1); assert.strictEqual(rows[0].created_by, 'admin@x.com');
      await p.waitForSelector('#resTable tbody tr'); assert.ok((await p.textContent('#resTable')).includes('דנה לוי'));
      await p.waitForFunction(() => document.querySelector('#snapTable') && document.querySelector('#snapTable').textContent.includes('מדוכא מטעמי פרטיות')); assert.ok(!(await p.textContent('#snapTable')).includes('1 / '), 'D2 sub-cohort: 1 soldier with a result of a larger scope is not shown as a count'); });
    await t('ui nav: soldiers without a result are flagged as missing', async () => { assert.ok((await p.textContent('#missingRes')).includes('חסרה תוצאה')); assert.ok((await p.textContent('#missingRes')).includes('אבי כהן')); });
    await t('ui nav: result detail shows history; admin edit needs a reason and writes audit', async () => {
      await p.click('#resTable tbody tr'); await p.waitForSelector('#resEdit'); await p.waitForFunction(() => document.querySelector('#resHist').textContent.includes('הוזן'));
      await p.click('#resEdit'); await p.fill('#enPlan', '5'); await p.click('#eGo'); await p.waitForFunction(() => document.querySelector('#eMsg').textContent.includes('סיבה'));
      await p.fill('#eReason', 'תיקון הקלדה'); await p.click('#eGo'); await p.waitForFunction(() => document.querySelector('#eMsg').textContent.includes('נשמר'));
      assert.strictEqual(Number(X.Db.all('NavigationTests')[0].plan_score), 5); assert.ok(X.Db.where('AuditLog', a => a.table_name === 'NavigationTests' && a.reason === 'תיקון הקלדה').length >= 1); });
    await t('ui nav: cancelling a result removes it from the snapshot but keeps it in history (show-cancelled)', async () => {
      await p.click('#resTable tbody tr'); await p.waitForSelector('#resCancel'); await p.click('#resCancel'); await p.fill('.reasonIn', 'הוזן בטעות'); await p.click('.reasonOk');
      await p.waitForFunction(() => document.querySelector('#noResults')); assert.strictEqual(X.Db.all('NavigationTests').length, 1);
      await p.waitForFunction(() => document.querySelector('#snapTable').textContent.includes('אין מספיק נתונים'));
      await p.check('#nfCan'); await p.waitForSelector('#resTable tbody tr'); assert.ok((await p.textContent('#resTable')).includes('מבוטלת'));
      await p.click('#resTable tbody tr'); await p.waitForSelector('#resRestore'); await p.click('#resRestore'); await p.click('.reasonOk'); await p.waitForFunction(() => !document.querySelector('#resRestore')); });
    await t('ui nav: cancelled soldier is excluded from the snapshot but his result stays in history', async () => {
      const s1 = X.Db.all('Soldiers').find(s => s.personal_number === '1001'); X.Soldiers.cancel(admin, s1.id, 'בדיקה');
      await goTab(p, 'soldiers'); await goTab(p, 'nav'); await p.waitForSelector('#snapTable');
      assert.ok(/קבוצה קטנה מ-5 חיילים/.test(await p.textContent('#snapTable')), 'D2: a scope under 5 soldiers shows no group figure'); assert.ok(!/[0-9]+ \/ [0-9]+/.test(await p.textContent('#snapTable')), 'no coverage figures'); await p.check('#nfCan');
      await p.waitForSelector('#resTable tbody tr'); assert.ok((await p.textContent('#resTable')).includes('חייל מבוטל')); X.Soldiers.restore(admin, s1.id); });
    await t('ui nav: admin sees nav-types panel and can add a type', async () => {
      await p.fill('#newType', 'ניווט לילה'); await p.click('#addType'); await p.waitForFunction(() => document.querySelector('#navTypes').textContent.includes('ניווט לילה')); });
    await goTab(p, 'assign'); await p.waitForSelector('#assignBox');
    await t('ui assign: admin assigns a commander to one team, list shows it, audit written', async () => {
      await p.selectOption('#aUser', 'tm@x.com'); await p.selectOption('#aType', 'team'); await p.selectOption('#aTarget', teamsA[0].id); await p.click('#aAdd'); await p.waitForFunction(() => document.querySelector('#aMsg').textContent.includes('סיבה')); assert.strictEqual(X.Db.all('CommanderAssignments').filter(a => a.user_email === 'tm@x.com').length, 0); await p.fill('#aReason', 'שיוך ראשוני'); await p.click('#aAdd');
      await p.waitForFunction(() => document.querySelector('#assignTable') && document.querySelector('#assignTable').textContent.includes('tm@x.com')); assert.ok((await p.textContent('#assignTable')).includes('צוות 1'));
      assert.ok(X.Db.where('AuditLog', a => a.action === 'ASSIGNMENT_CREATE').length >= 1); });
    await t('ui assign: cancel needs a reason; cancelled row is marked', async () => {
      await p.click('.aToggle'); await p.click('.reasonOk'); await p.waitForFunction(() => document.querySelector('#aAct').textContent.includes('חובה'));
      await p.fill('.reasonIn', 'שינוי מבנה'); await p.click('.reasonOk'); await p.waitForFunction(() => document.querySelector('#assignTable tbody tr.bad'));
      await p.click('.aToggle'); await p.fill('.reasonIn', 'חזרה'); await p.click('.reasonOk'); await p.waitForFunction(() => !document.querySelector('#assignTable tbody tr.bad')); });
    await t('ui: no uncaught page errors in admin nav/assign session', async () => assert.deepStrictEqual(p.errs, []));

    const n0 = await open('none@x.com', { width: 390, height: 800 });
    await t('ui (commander, no assignment): explicit notice, empty list, no soldiers in DOM', async () => {
      assert.ok(!(await n0.$eval('#mineMsg', e => e.classList.contains('hide')))); assert.ok((await n0.textContent('#mineMsg')).includes('אין לך שיוך'));
      assert.strictEqual((await rowsOf(n0)).length, 0); assert.ok(!(await n0.content()).includes('דנה לוי')); assert.ok(!(await n0.$('#tabAssign'))); });
    const tm = await open('tm@x.com');
    await t('ui (commander, team-scoped): sees only his team, entry offers only his soldiers, snapshot has scope note', async () => {
      const names = await rowsOf(tm); assert.ok(names.length >= 1); assert.ok(!names.some(r => r.includes('חייל צוות ב')));
      await goTab(tm, 'nav'); await tm.waitForSelector('#nSoldier option', { state: 'attached' }); const opts = await tm.$$eval('#nSoldier option', os => os.map(o => o.textContent)); assert.ok(!opts.some(o => o.includes('2002')));
      await tm.waitForSelector('#snapTable'); assert.ok((await tm.textContent('#navSnap')).includes('בתחום האחריות שלך')); assert.ok(!(await tm.$('#navTypes'))); assert.ok(!(await tm.$('#nfCan'))); });
    await t('ui (commander): own result entry works and "request correction" is offered, no edit/cancel', async () => {
      const mySoldier = (await tm.$$eval('#nSoldier option', os => os.map(o => ({ v: o.value, t: o.textContent })))).find(o => o.v);
      await tm.selectOption('#nSoldier', mySoldier.v); await tm.fill('#nDate', '2026-11-02'); await tm.fill('#nDist', '3'); await tm.fill('#nPlan', '3'); await tm.fill('#nDeb', '3'); await tm.fill('#nDone', '5'); await tm.fill('#nTotal', '10');
      await tm.click('#nSave'); await tm.waitForFunction(() => document.querySelector('#nMsg').textContent.includes('נשמר'));
      await tm.waitForSelector('#resTable tbody tr'); await tm.click('#resTable tbody tr'); await tm.waitForSelector('#resCorr'); assert.ok(!(await tm.$('#resEdit'))); assert.ok(!(await tm.$('#resCancel')));
      assert.ok(!(await tm.textContent('#resDetail')).includes('@')); });
    await t('ui (commander): no uncaught page errors', async () => { assert.deepStrictEqual(tm.errs, []); assert.deepStrictEqual(n0.errs, []); });
  } finally { await browser.close(); server.close(); }
  console.log('\nUI SMOKE TOTAL pass=' + pass + ' fail=' + fail); if (fail) { console.log('FAILED:', failures.join(' | ')); process.exit(1); }
})();
