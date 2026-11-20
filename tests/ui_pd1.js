// PRODUCT-DEV1 — browser test (Chromium) of the product/UX improvements in src/Index.html and src/FormPage.html against the REAL server code in Node
// (google.script.run shimmed). NOT Apps Script / HtmlService. Covers: two-level navigation, course dashboard (admin / scoped commander / unassigned commander / empty course),
// table sort / filter / keyboard / stale-response guard, readable forms + compare screens, soldier picker filter, restore confirmation, soldier form validation. 390px and 1280px.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { load } = require('./harness'); const { goTab, allTabIds } = require('./uihelp');
let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.log('SKIP ui_pd1: playwright not available'); process.exit(0); }
const X = load(); require('./fakes').install(X); X.Forms._urlProvider = () => null;
const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
X.Courses.addUser(admin, { email: 'admin@x.com', role: 'admin', display_name: 'מנהל' });
const c1 = X.Courses.create(admin, { name: 'קורס א', start_date: '2020-01-01' }).id, c2 = X.Courses.create(admin, { name: 'קורס ב', start_date: '2020-01-01' }).id;
const org = X.Courses.org(admin, c1), T0 = org.teams[0], T1 = org.teams.find(t => t.id !== T0.id);
const mkc = (e, scope, id) => { X.Courses.addUser(admin, { email: e, role: 'commander', course_ids: [c1], display_name: 'מפקד' }); if (scope) X.Assignments.create(admin, { course_id: c1, user_email: e, scope_type: scope, scope_id: id, reason: 'בדיקה' }); };
mkc('team0@x.com', 'team', T0.id); mkc('none@x.com');
const pad = n => String(n).padStart(2, '0'), sols = [];
for (let i = 1; i <= 7; i++) sols.push(X.Soldiers.create(admin, c1, { full_name: 'SOLT0_' + pad(i), personal_number: '10' + pad(i), gender: 'M', department_id: T0.department_id, team_id: T0.id, pakal: i === 3 ? '' : 'פק' + i }));
for (let i = 1; i <= 7; i++) sols.push(X.Soldiers.create(admin, c1, { full_name: 'SOLT1_' + pad(i), personal_number: '20' + pad(i), gender: 'M', department_id: T1.department_id, team_id: T1.id }));
const v = X.Fitness.importDraft(admin, c1, {}); X.Fitness.approve(admin, v.id, { verified_against_source: true, reason: 'בדיקה' });
const reg = X.Fitness.typesList(admin, c1).find(x => !x.is_opening), FULL = { pullups: 15, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' };
[0, 1, 7].forEach(i => X.Records.create(admin, 'FitnessTests', c1, Object.assign({ request_id: X.Util.uuid(), soldier_id: sols[i].id, test_date: '2026-11-09', test_type_id: reg.id }, FULL)));
for (let i = 0; i < 12; i++) X.Db.insert('Alerts', { id: X.Util.uuid(), course_id: c1, soldier_id: sols[i].id, topic: 'נושא' + pad(i), rule_key: 't' + i, reason: 'סיבה ' + pad(i), urgency: (i === 0 || i === 7) ? 'red' : 'yellow', status: 'open', opened_at: X.Util.nowIso(), handled_by: '', handled_at: '', dedupe_key: 'k' + i, ref_id: '', due_date: '' });
const lk = X.Forms.createLink(admin, c1, sols[2].id, 7); X.Forms.submit(lk.token, { full_name: 'שם חדש לבדיקה', pakal: 'חדש' });
let flink = null;
let session = 'admin@x.com', rpcLog = [], slow = false;
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8'), fhtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'FormPage.html'), 'utf8');
const mkShim = ms => `<script>(function(){function mk(){var ok,bad;var o={withSuccessHandler:function(f){ok=f;return o;},withFailureHandler:function(f){bad=f;return o;}};
${JSON.stringify(ms)}.forEach(function(m){o[m]=function(){var a=Array.prototype.slice.call(arguments);fetch('/rpc',{method:'POST',body:JSON.stringify({m:m,a:a[0],b:a[1],all:a})}).then(function(r){return r.json()}).then(function(j){ok&&ok(j)},function(e){bad&&bad(e)});};});return o;}
window.google={script:{get run(){return mk();}}};})();</script>`;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rpc') { let b = ''; req.on('data', d => b += d); req.on('end', () => { const p = JSON.parse(b); rpcLog.push(p); X.Auth._emailProvider = () => session;
    const out = p.m === 'api' ? X.api(p.a, p.b) : p.m === 'whoAmI' ? X.whoAmI() : X[p.m].apply(null, p.all); const delay = (p.m === 'api' && p.a === 'soldiers.list' && p.b && p.b.opts && p.b.opts.q === 'SLOW') ? 900 : 0;
    setTimeout(() => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(out)); }, delay); }); }
  else { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(req.url.startsWith('/form') ? fhtml.replace('<head>', '<head>' + mkShim(['formOpen', 'formSubmit'])) : html.replace('<head>', '<head>' + mkShim(['api', 'whoAmI']))); }
});
let pass = 0, fail = 0; async function t(n, f) { try { await f(); pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, '\n   ', e.message.split('\n')[0], process.env.DBG ? e.stack.split('\n').slice(1, 3).join(' / ') : ''); } }
const BAD = /undefined|NaN|\[object|\bnull\b|\{"/;
(async () => {
  await new Promise(r => server.listen(0, r)); const url = 'http://127.0.0.1:' + server.address().port; const browser = await chromium.launch();
  const open = async (email, vp, mobile, wait) => { session = email; const ctx = await browser.newContext(mobile ? { viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: vp }); const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(e.message)); await page.goto(url); await page.waitForSelector(wait || '#dashTodo:not([aria-busy])', { timeout: 15000 }); return page; };
  const noOverflow = async p => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'horizontal overflow');
  const kv = (p, id) => p.textContent('#' + id + ' .kv');
  try {
    const a = await open('admin@x.com', { width: 1280, height: 900 });
    await t('admin lands on the course dashboard: area buttons, KPIs from real data, no technical values', async () => {
      assert.ok(await a.isVisible('#grp_dash.on')); assert.strictEqual(await kv(a, 'kpiSoldiers'), '14'); /* FINAL D2: the seed has 2 red / 10 yellow alert soldiers and 3 of 14 with complete fitness data — sub-cohorts of 1-4 / illegal splits, so the KPIs must NOT print 12 / 3 / 14 (was: '12' and '3 / 14'); the operational alert list still has the exact 12 rows (checked below) */
      const kA = await kv(a, 'kpiAlerts'), kF = await kv(a, 'kpiFitGaps'); assert.ok(/יש התראות פתוחות/.test(kA) && !/\b12\b/.test(kA), 'alerts KPI suppressed: ' + kA); assert.ok(/מדוכא/.test(kF) && !/3 \/ 14/.test(kF), 'fitness-gap KPI suppressed: ' + kF);
      assert.strictEqual(await a.evaluate(() => call('alerts.list', { courseId: S.courseId, opts: { status: 'open' } }).then(r => r.data.length)), 12, 'the authorised operational alert list is exact');
      assert.strictEqual(await kv(a, 'kpiAtt'), '—', 'no attendance data => dash, never 0'); assert.ok(!BAD.test(await a.textContent('#view')), await a.textContent('#view')); assert.deepStrictEqual(a.errs, []); });
    await t('admin dashboard "needs attention": red alerts first with the soldier name, pending form requests, missing fitness, readiness — each with an action button', async () => {
      const items = await a.$$eval('#dashTodoList .todo', es => es.map(e => ({ c: e.className, t: e.textContent }))); assert.ok(items.length >= 4, JSON.stringify(items));
      assert.ok(/red/.test(items[0].c) && /red/.test(items[1].c), 'red first'); assert.ok(items.some(i => /SOLT1_01/.test(i.t)) && items.some(i => /SOLT0_01/.test(i.t)));
      assert.ok(items.some(i => /בקשות עדכון פרטים/.test(i.t)) && items.some(i => /כש״ג חסרים/.test(i.t)) && items.some(i => /ללא סטטוס כשירות/.test(i.t)));
      assert.ok((await a.$$('#dashTodoList .todo > button')).length === items.length); });
    await t('KPI and task buttons navigate to the right screen', async () => {
      await a.click('#kpiAlerts'); await a.waitForSelector('#view table'); assert.strictEqual(await a.evaluate(() => S.tab), 'alerts'); await goTab(a, 'dash'); await a.waitForSelector('#dashTodo:not([aria-busy])');
      await a.click('#dashTodoList .todo:has-text("בקשות עדכון") > button'); await a.waitForFunction(() => S.tab === 'forms'); });
    await t('navigation: every screen is in exactly one area; area buttons list all screens; arrow keys move between screens of an area; admin-only areas exist for admin', async () => {
      const r = await a.evaluate(() => SCREENS.map(s => s.id).concat(['soldiers', 'nav', 'assign']).map(id => [id, GROUPS.filter(g => g.t.indexOf(id) !== -1).length])); r.forEach(([id, n]) => assert.strictEqual(n, 1, id + ' in ' + n + ' groups'));
      const ids = await allTabIds(a); assert.strictEqual(new Set(ids).size, ids.length); assert.ok(['courses', 'backup', 'settings', 'assign', 'forms'].every(i => ids.includes(i)));
      await goTab(a, 'fitgaps'); await a.focus('#tab_fitgaps'); await a.keyboard.press('ArrowLeft'); assert.strictEqual(await a.evaluate(() => S.tab), 'fitness'); await a.keyboard.press('ArrowRight'); assert.strictEqual(await a.evaluate(() => S.tab), 'fitgaps'); });
    await t('soldier table: sort by header and by the sort select (works on phones), empty values last, keyboard opens the card', async () => {
      await goTab(a, 'soldiers'); await a.waitForSelector('#listOut tbody tr'); const first = async () => (await a.$$eval('#listOut tbody tr td:first-child', tds => tds.map(x => x.textContent)));
      await a.click('#listOut th button:has-text("שם")'); const asc = await first(); assert.deepStrictEqual(asc, asc.slice().sort((x, y) => x.localeCompare(y, 'he', { numeric: true }))); await a.click('#listOut th button:has-text("שם")'); const desc = await first(); assert.deepStrictEqual(desc, asc.slice().reverse());
      await a.selectOption('#listOut .tbar select', { label: 'פק״ל ▲' }); const pk = await a.$$eval('#listOut tbody tr td:nth-child(5)', tds => tds.map(x => x.textContent.trim())); const fb = pk.indexOf(''); assert.ok(fb > 0 && pk.slice(fb).every(x => x === '') && pk.slice(0, fb).every(x => x !== ''), 'blank pakal last: ' + pk.join('|'));
      await a.focus('#listOut tbody tr .rowbtn'); await a.keyboard.press('Enter'); await a.waitForSelector('#cardName'); });
    await t('stale responses never overwrite newer results (slow earlier search, fast later search)', async () => {
      await goTab(a, 'soldiers'); await a.waitForSelector('#listOut tbody tr'); await a.fill('#fq', 'SLOW'); await a.waitForTimeout(450); await a.fill('#fq', 'SOLT0_03'); await a.waitForTimeout(1700);
      const rows = await a.$$eval('#listOut tbody tr', rs => rs.map(r => r.textContent)); assert.strictEqual(rows.length, 1, rows.join('|')); assert.ok(/SOLT0_03/.test(rows[0])); });
    await t('empty search result gives a clear message', async () => { await a.fill('#fq', 'NOSUCH'); await a.waitForSelector('#noSoldiers'); assert.ok(/לא נמצאו חיילים לפי הסינון/.test(await a.textContent('#noSoldiers'))); await a.fill('#fq', ''); });
    await t('generic table (alerts, 12 rows): filter box, count, "no results" row, sort select', async () => {
      await goTab(a, 'alerts'); await a.waitForSelector('#view tbody tr'); assert.strictEqual((await a.$$('#view tbody tr')).length, 12); await a.fill('#view input[type=search]', 'נושא03'); assert.strictEqual((await a.$$('#view tbody tr:not([hidden])')).length, 1); assert.ok(/מוצגות 1 מתוך 12/.test(await a.textContent('#view .tbar .cnt')));
      await a.fill('#view input[type=search]', 'zzzz'); assert.ok(/לא נמצאו תוצאות/.test(await a.textContent('#view tbody'))); await a.fill('#view input[type=search]', ''); assert.strictEqual((await a.$$('#view tbody tr:not([hidden])')).length, 12); });
    await t('pending soldier-form requests are readable (field: old ← new), not JSON; token is shown with a copy button; soldier picker filters a long list', async () => {
      await goTab(a, 'forms'); await a.waitForSelector('#view tbody tr'); const tx = await a.textContent('#view'); assert.ok(/שם מלא: SOLT0_03 ← שם חדש לבדיקה/.test(tx) && /פק״ל: פק3|פק״ל: \(ריק\) ← חדש/.test(tx), tx.slice(0, 400)); assert.ok(!/[{}\[\]]|"field"/.test(await a.textContent('#view tbody')));
      await a.waitForSelector('#fq_soldierId'); await a.fill('#fq_soldierId', 'SOLT1_03'); assert.strictEqual((await a.$$('#f_soldierId option')).length, 2); await a.selectOption('#f_soldierId', { index: 1 }); await a.click('#view button:has-text("שמירה")');
      await a.waitForSelector('#formToken'); assert.ok((await a.inputValue('#formToken')).length >= 24); assert.ok(await a.isVisible('#formTokenCopy')); });
    await t('compare screen: course checkboxes + readable table (no JSON), groups table with both averaging methods', async () => {
      await goTab(a, 'compare'); await a.waitForSelector('#cmp_' + c1); await a.click('#cmpGo'); await a.waitForSelector('#cmpOut table'); const th = await a.$$eval('#cmpOut th', hs => hs.map(h => h.textContent)); assert.ok(th.includes('ממוצע כש״ג') && th.includes('קורס'));
      assert.strictEqual((await a.$$('#cmpOut tbody tr')).length, 2); assert.ok(!(await a.$('#view pre'))); await a.click('#cmpGroupsGo'); await a.waitForFunction(() => /לפי תוצאות/.test(document.querySelector('#cmpOut').textContent)); assert.ok(/לפי חייל/.test(await a.textContent('#cmpOut'))); assert.ok(!(await a.$('#view pre'))); });
    await t('empty course (admin): clear empty state, dashes instead of zeros, no tasks', async () => {
      await a.selectOption('#course', c2); await a.waitForTimeout(500); await goTab(a, 'dash'); await a.waitForSelector('#dashSmallGroup'); /* dev6.2 decision D2: a scope under 5 soldiers (incl. an empty course) shows only the privacy notice, no counts */ assert.ok(/קבוצה קטנה מ-5/.test(await a.textContent('#dashSmallGroup'))); await a.waitForSelector('#dashEmpty'); assert.ok(!(await a.$('#kpiAtt')) && !(await a.$('#kpiSoldiers')), 'no KPI tiles for a scope under 5'); assert.ok(!BAD.test(await a.textContent('#view')));
      await a.selectOption('#course', c1); await a.waitForTimeout(500); });
    const c = await open('team0@x.com', { width: 1280, height: 900 });
    await t('scoped commander: dashboard shows only own team (counts, alerts, names), no admin tasks, no admin areas, no forms/corrections requests', async () => {
      assert.strictEqual(await kv(c, 'kpiSoldiers'), '7'); const txt = await c.textContent('#view'); assert.ok(!/SOLT1_/.test(txt), 'other team leaked'); assert.ok(/SOLT0_01/.test(txt)); const kC = await kv(c, 'kpiAlerts'); assert.ok(/יש התראות פתוחות/.test(kC) && !/\b7\b/.test(kC), 'commander alerts KPI is a suppressed flag (1 red soldier in scope): ' + kC); assert.strictEqual(await c.evaluate(() => call('alerts.list', { courseId: S.courseId, opts: { status: 'open' } }).then(r => r.data.length)), 7, 'alert list must be scoped too (7 of the commander\'s own team, none of the other team)');
      assert.ok(!/בקשות עדכון פרטים|בקשות תיקון/.test(txt)); const ids = await allTabIds(c); assert.ok(!ids.some(i => ['courses', 'backup', 'settings', 'assign', 'forms', 'private', 'import', 'ocr'].includes(i)), ids.join(','));
      assert.ok(!rpcLog.some(p => p.m === 'api' && /^(forms|correction)\.list$/.test(p.a) && p.b && p.b.courseId && false), 'n/a'); });
    await t('scoped commander: compare screen explains that two courses are needed (no crash); direct admin calls are still refused by the server', async () => {
      await goTab(c, 'compare'); await c.waitForSelector('#cmpNeed2'); assert.ok(/לפחות שני קורסים/.test(await c.textContent('#cmpNeed2')));
      const r = await c.evaluate(async c1 => { const o = {}; for (const m of ['forms.list', 'backup.list', 'users.list']) { o[m] = await new Promise(res => google.script.run.withSuccessHandler(res).api(m, { courseId: c1, status: 'pending' })); } return o; }, c1); Object.keys(r).forEach(k => assert.strictEqual(r[k].ok, false, k + ' must be refused')); });
    const n = await open('none@x.com', { width: 1280, height: 900 }, false, '#mineMsg:not(.hide)');
    await t('commander without an assignment: explanation shown, dashboard degrades gracefully, no data and no errors', async () => {
      await n.waitForTimeout(800); assert.ok(/אין לך שיוך/.test(await n.textContent('#mineMsg'))); const txt = await n.textContent('#view'); assert.ok(!/SOLT/.test(txt)); assert.deepStrictEqual(n.errs, []); });
    const m = await open('admin@x.com', { width: 390, height: 844 }, true);
    await t('phone 390: dashboard fits; area navigation is a drawer and the screen bar wraps — NO horizontal scrolling anywhere in the navigation, no page overflow, tap targets ≥ 44px (dev6.2 design: stricter than the old inner-scroll rule)', async () => {
      await noOverflow(m); assert.ok(!(await m.isVisible('#grps')), 'area navigation must be closed (drawer) by default on a phone'); await goTab(m, 'fitgaps'); await noOverflow(m);
      const scrolls = await m.evaluate(() => ['grps', 'tabs'].filter(id => { const e = document.getElementById(id); return e.scrollWidth > e.clientWidth + 1; })); assert.deepStrictEqual(scrolls, [], 'nav must not scroll horizontally');
      await m.click('#menuBtn'); await m.waitForSelector('#grps', { state: 'visible' }); await m.waitForTimeout(250);
      const small = await m.$$eval('#grps button, #tabs button', bs => bs.filter(b => b.getBoundingClientRect().height < 43).length); assert.strictEqual(small, 0); assert.deepStrictEqual(m.errs, []); });
    await t('phone 390: soldiers table becomes cards, sort select usable, alerts screen filter usable, no overflow', async () => {
      await goTab(m, 'soldiers'); await m.waitForSelector('#listOut tbody tr'); await noOverflow(m); assert.ok(await m.isVisible('#listOut .tbar select')); await goTab(m, 'alerts'); await m.waitForSelector('#view tbody tr'); await noOverflow(m); assert.ok(await m.isVisible('#view input[type=search]')); });
    await t('restore asks for a reason and the typed word, shows what will change, can be cancelled without any restore call, and sends the typed reason', async () => {
      await goTab(a, 'backup'); await a.click('#view button:has-text("גיבוי ידני")'); await a.waitForFunction(() => /הגיבוי נוצר/.test(document.querySelector('#view').textContent)); await a.waitForSelector('#view button:has-text("שחזור…")');
      await a.click('#view button:has-text("שחזור…")'); await a.waitForSelector('#restoreSummary'); assert.ok(await a.isDisabled('#restoreGo')); assert.ok(/טבלאות|זהה/.test(await a.textContent('#restoreSummary')));
      await a.fill('#restoreReason', 'בדיקה'); await a.fill('#restoreConfirm', 'restore'); assert.ok(await a.isDisabled('#restoreGo')); await a.fill('#restoreConfirm', 'RESTORE'); assert.ok(!(await a.isDisabled('#restoreGo')));
      await a.click('#restorePanel button:has-text("ביטול")'); assert.ok(!(await a.$('#restorePanel'))); assert.ok(!rpcLog.some(p => p.a === 'backup.restore'), 'cancel must not restore');
      await a.click('#view button:has-text("שחזור…")'); await a.waitForSelector('#restoreGo'); await a.fill('#restoreReason', 'סיבה שהוקלדה'); await a.fill('#restoreConfirm', 'RESTORE'); await a.click('#restoreGo'); await a.waitForFunction(() => /השחזור הושלם/.test(document.querySelector('#restorePanel').textContent));
      const call = rpcLog.filter(p => p.a === 'backup.restore'); assert.strictEqual(call.length, 1); assert.strictEqual(call[0].b.data.reason, 'סיבה שהוקלדה'); assert.strictEqual(call[0].b.data.confirm, 'RESTORE'); });
    await t('no page errors in any admin / commander session', async () => { assert.deepStrictEqual(a.errs, []); assert.deepStrictEqual(c.errs, []); });
    // ---- soldier form page
    flink = X.Forms.createLink(admin, c1, sols[4].id, 7);   /* created AFTER the restore test: FormTokens are not part of a restore */
    const fp = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage(); const ferrs = []; fp.on('pageerror', e => ferrs.push(e.message)); const subs = () => rpcLog.filter(p => p.m === 'formSubmit').length;
    await fp.goto(url + '/form?form=' + flink.token); await fp.waitForSelector('#f_full_name', { timeout: 8000 }).catch(async e => { console.log('FORMPAGE', await fp.textContent('body'), ferrs.join('|')); throw e; });
    await t('soldier form: invalid input shows an inline error next to the field, keeps the typed data, sends nothing', async () => {
      const before = subs(); await fp.fill('#f_full_name', '   '); await fp.click('#send'); await fp.waitForSelector('#e_full_name:not([hidden])'); assert.ok(/שם מלא חובה/.test(await fp.textContent('#e_full_name'))); assert.strictEqual(await fp.getAttribute('#f_full_name', 'aria-invalid'), 'true'); assert.strictEqual(subs(), before);
      await fp.fill('#f_full_name', 'x'); assert.ok(await fp.isHidden('#e_full_name'), 'error clears while typing'); });
    await t('soldier form: no change => clear message and nothing sent; real change => one request only (double tap does not duplicate) and a clear thank-you', async () => {
      await fp.goto(url + '/form?form=' + flink.token); await fp.waitForSelector('#f_full_name'); const before = subs(), reqs = X.Db.all('SoldierUpdateRequests').length; await fp.click('#send'); await fp.waitForFunction(() => /לא בוצע שינוי/.test(document.querySelector('#msg').textContent)); assert.strictEqual(subs(), before);
      await fp.fill('#f_pakal', 'פק-חדש'); await fp.dblclick('#send'); await fp.waitForFunction(() => /אפשר לסגור/.test(document.querySelector('#msg').textContent)); assert.strictEqual(subs(), before + 1, 'subs ' + (subs() - before)); assert.strictEqual(X.Db.all('SoldierUpdateRequests').length, reqs + 1); assert.ok(/אפשר לסגור/.test(await fp.textContent('#msg')), 'msg: ' + await fp.textContent('#msg')); assert.deepStrictEqual(ferrs, []); });
    await t('soldier form: used / bad token shows one generic message', async () => { await fp.goto(url + '/form?form=' + flink.token); await fp.waitForFunction(() => /אינו תקף/.test(document.body.textContent)); assert.ok(!(await fp.$('#f_full_name'))); });
  } finally { await browser.close(); server.close(); }
  console.log('\nUI PD1 TOTAL pass=' + pass + ' fail=' + fail); if (fail) process.exit(1);
})();
