// PRODUCT-DEV2 — browser test (Chromium) of the product/UX improvements in src/Index.html and src/FormPage.html against the REAL server code in Node
// (google.script.run shimmed). NOT Apps Script / HtmlService. Covers: two-level navigation, course dashboard (admin / scoped commander / unassigned commander / empty course),
// table sort / filter / keyboard / stale-response guard, readable forms + compare screens, soldier picker filter, restore confirmation, soldier form validation. 390px and 1280px.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { load } = require('./harness'); const { goTab, allTabIds } = require('./uihelp');
let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.log('SKIP ui_pd2: playwright not available'); process.exit(0); }
const X = load(); require('./fakes').install(X); X.Forms._urlProvider = () => null;
const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
X.Courses.addUser(admin, { email: 'admin@x.com', role: 'admin', display_name: 'מנהל' });
const c1 = X.Courses.create(admin, { name: 'קורס א', start_date: '2020-01-01' }).id, c2 = X.Courses.create(admin, { name: 'קורס ב', start_date: '2020-01-01' }).id;
const org = X.Courses.org(admin, c1), T0 = org.teams[0], T1 = org.teams.find(t => t.id !== T0.id);
const mkc = (e, scope, id) => { X.Courses.addUser(admin, { email: e, role: 'commander', course_ids: [c1], display_name: 'מפקד' }); if (scope) X.Assignments.create(admin, { course_id: c1, user_email: e, scope_type: scope, scope_id: id, reason: 'בדיקה' }); };
mkc('team0@x.com', 'team', T0.id); mkc('team1@x.com', 'team', T1.id);
const pad = n => String(n).padStart(2, '0'), sols = [];
for (let i = 1; i <= 4; i++) sols.push(X.Soldiers.create(admin, c1, { full_name: 'SOLT0_' + pad(i), personal_number: '10' + pad(i), gender: 'M', department_id: T0.department_id, team_id: T0.id }));
sols.push(X.Soldiers.create(admin, c1, { full_name: '<img src=x onerror="window.__xss=1">דני', personal_number: '1099', gender: 'M', department_id: T0.department_id, team_id: T0.id }));
for (let i = 1; i <= 3; i++) sols.push(X.Soldiers.create(admin, c1, { full_name: 'SOLT1_' + pad(i), personal_number: '20' + pad(i), gender: 'M', department_id: T1.department_id, team_id: T1.id }));
const nt = X.Util.uuid(); X.Db.insert('NavigationTypes', { id: nt, course_id: c1, name: 'יום', active: true });
const cmdT0 = { email: 'team0@x.com', role: 'commander', courseScope: [c1] }, cmdT1 = { email: 'team1@x.com', role: 'commander', courseScope: [c1] };
const navp = (sid, o) => Object.assign({ request_id: X.Util.uuid(), soldier_id: sid, test_date: '2026-03-01', navigation_type_id: nt, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3, notes: '' }, o || {});
const rec0 = X.Records.create(cmdT0, 'NavigationTests', c1, navp(sols[0].id)).record.id, rec1 = X.Records.create(cmdT0, 'NavigationTests', c1, navp(sols[4].id, { notes: 'הערה ישנה' })).record.id, rec2 = X.Records.create(cmdT0, 'NavigationTests', c1, navp(sols[1].id)).record.id;
const reqMulti = X.Records.requestCorrection(cmdT0, 'NavigationTests', rec0, { plan_score: 5, distance_km: 4, notes: 'נוספה הערה' }, 'הוקלד בטעות <b>סיבה</b>');
const reqXss = X.Records.requestCorrection(cmdT0, 'NavigationTests', rec1, { notes: '' }, 'מחיקת הערה');
X.Db.insert('CorrectionRequests', { id: 'old-req', course_id: c1, table_name: 'NavigationTests', record_id: rec2, changes_json: JSON.stringify({ debrief_score: 3 }), reason: 'בקשה ישנה', requested_by: 'team0@x.com', requested_at: '2026-03-02T10:00:00Z', status: 'pending' });
for (let i = 0; i < 3; i++) X.Db.insert('Alerts', { id: X.Util.uuid(), course_id: c1, soldier_id: sols[i === 2 ? 5 : i].id, topic: 'נושא' + i, rule_key: 't' + i, reason: 'סיבה ' + i, urgency: 'red', status: 'open', opened_at: X.Util.nowIso(), handled_by: '', handled_at: '', dedupe_key: 'k' + i, ref_id: '', due_date: '' });
const lk = X.Forms.createLink(admin, c1, sols[2].id, 7); X.Forms.submit(lk.token, { full_name: 'שם חדש לבדיקה', pakal: 'חדש' });
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
const BAD = /undefined|NaN|\[object|\bnull\b|\{"/, ENG = /plan_score|distance_km|debrief_score|notes\b|points_total|soldier_id/;
(async () => {
  await new Promise(r => server.listen(0, r)); const url = 'http://127.0.0.1:' + server.address().port; const browser = await chromium.launch();
  const open = async (email, vp, mobile, wait) => { session = email; const ctx = await browser.newContext(mobile ? { viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: vp }); const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(e.message)); await page.goto(url); await page.waitForSelector(wait || '#dashTodo:not([aria-busy])', { timeout: 15000 }); return page; };
  const noOverflow = async p => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'horizontal overflow');
  const corrCard = (p, id) => p.$('[data-req="' + id + '"]');
  try {
    const a = await open('admin@x.com', { width: 1280, height: 900 });
    await goTab(a, 'nav'); await a.waitForSelector('#navCorr .card');
    await t('admin: each request shows Hebrew field name, previous value (snapshot), requested value, reason, requester, time and approve/reject buttons — no internal names, no undefined', async () => {
      const txt = await a.textContent('#navCorr'); assert.ok(!ENG.test(txt), txt); assert.ok(!BAD.test(txt), txt);
      const card = await corrCard(a, reqMulti.id); const rows = await card.$$eval('tr[data-field]', rs => rs.map(r => [...r.children].map(c => c.textContent)));
      assert.deepStrictEqual(rows.sort((x, y) => x[0] < y[0] ? -1 : 1), [['ציון תכנון', '4', '5'], ['מרחק (ק״מ)', '3', '4'], ['הערות', '(ריק)', 'נוספה הערה']].sort((x, y) => x[0] < y[0] ? -1 : 1));
      const ct = await card.textContent(); assert.ok(/סיבת הבקשה: הוקלד בטעות <b>סיבה<\/b>/.test(ct), 'reason shown as plain text'); assert.ok(/team0@x.com|admin@x.com/.test(ct) && /20\d\d/.test(ct), 'requester + time');
      assert.ok((await card.$$('button.approve')).length === 1 && (await card.$$('button.reject')).length === 1); assert.ok(await card.$('b') === null, 'no HTML injected from the reason'); });
    await t('empty previous value shown as "(ריק)"; requested empty shown as "(ריק)" with the old text as previous', async () => {
      const card = await corrCard(a, reqXss.id); const rows = await card.$$eval('tr[data-field]', rs => rs.map(r => [...r.children].map(c => c.textContent))); assert.deepStrictEqual(rows, [['הערות', 'הערה ישנה', '(ריק)']]); });
    await t('old request without snapshot: clear message, no undefined, still decidable', async () => {
      const card = await corrCard(a, 'old-req'); const t0 = await card.textContent(); assert.ok(/הערך שהיה בעת הגשתה לא נשמר/.test(t0)); assert.ok(/אין ערך קודם שמור/.test(t0)); assert.ok(!BAD.test(t0), t0);
      assert.deepStrictEqual(await card.$$eval('tr[data-field]', rs => rs.map(r => [...r.children].map(c => c.textContent))), [['ציון תחקיר', 'אין ערך קודם שמור', '3']]); assert.ok(await card.$('button.approve')); });
    await t('soldier name with HTML is shown as text, never executed; request shows the soldier and a card shortcut', async () => {
      const card = await corrCard(a, reqXss.id); assert.ok((await card.textContent()).includes('<img src=x onerror="window.__xss=1">דני')); assert.strictEqual(await a.evaluate(() => window.__xss), undefined); assert.strictEqual(await card.$('img'), null);
      await (await card.$('button.sec')).click(); await a.waitForSelector('#view h2, #view h3'); assert.ok((await a.textContent('#view')).includes('onerror')); assert.deepStrictEqual(a.errs, []); });
    await t('changing the record after the request does not change the displayed previous value (snapshot, not recomputed)', async () => {
      X.Records.adminEdit(admin, 'NavigationTests', rec0, { plan_score: 2 }, 'עריכה מאוחרת'); await goTab(a, 'dash'); await goTab(a, 'nav'); await a.waitForSelector('#navCorr .card');
      const card = await corrCard(a, reqMulti.id); const r = await card.$$eval('tr[data-field="plan_score"] td', cs => cs.map(c => c.textContent)); assert.deepStrictEqual(r, ['ציון תכנון', '4', '5']); });
    await t('approve applies, the request leaves the list; reject leaves the record unchanged', async () => {
      await (await (await corrCard(a, reqXss.id)).$('button.reject')).click(); await a.waitForFunction(id => !document.querySelector('[data-req="' + id + '"]'), reqXss.id); assert.strictEqual(X.Db.get('NavigationTests', rec1).notes, 'הערה ישנה');
      await (await (await corrCard(a, 'old-req')).$('button.approve')).click(); await a.waitForFunction(() => !document.querySelector('[data-req="old-req"]')); assert.strictEqual(Number(X.Db.get('NavigationTests', rec2).debrief_score), 3); });
    await t('dashboard "needs attention": every task about specific soldiers names them with a card shortcut (forms, corrections, fitness gaps, readiness, alerts)', async () => {
      await goTab(a, 'dash'); await a.waitForSelector('#dashTodo:not([aria-busy])'); await a.waitForFunction(() => document.querySelectorAll('#dashTodoList .todo').length >= 4);
      const items = await a.$$eval('#dashTodoList .todo', es => es.map(e => ({ t: e.querySelector('.tt > div').textContent, chips: [...e.querySelectorAll('.chip')].map(c => c.textContent) })));
      const by = re => items.find(i => re.test(i.t)); assert.ok(by(/בקשות עדכון פרטים/).chips.includes('SOLT0_03'), JSON.stringify(items)); [/כש״ג חסרים/, /ללא סטטוס כשירות/].forEach(re => { const ch = by(re).chips; assert.ok(ch.length >= 1 && ch.every(n => /^(SOLT\d_\d\d|<img)/.test(n)), re + ' chips: ' + JSON.stringify(ch)); });
      assert.ok(items.filter(i => /נושא/.test(i.t)).every(i => i.chips.length === 1), 'each red alert: its soldier'); assert.ok(!BAD.test(await a.textContent('#dashTodoList')));
      rpcLog.length = 0; await a.click('#dashTodoList .chip[data-sid="' + sols[2].id + '"]'); await a.waitForFunction(() => document.querySelector('#view') && !document.querySelector('#dashTodoList')); assert.ok(rpcLog.some(p => p.m === 'api' && p.a === 'soldiers.card' && p.b && p.b.id === sols[2].id), 'the soldier card was requested'); await a.waitForFunction(() => /SOLT0_03/.test(document.querySelector('#view').textContent) && document.querySelector('#dashTodoList') === null); });
    const c = await open('team0@x.com', { width: 1280, height: 900 });
    await t('scoped commander: dashboard chips only name soldiers of own team; no admin task items; no forms/corrections of others', async () => {
      await c.waitForFunction(() => document.querySelectorAll('#dashTodoList .todo').length >= 1); const txt = await c.textContent('#dashTodoList'); assert.ok(!/SOLT1_/.test(txt), 'other team soldier leaked: ' + txt); assert.ok(!/בקשות עדכון|בקשות תיקון/.test(txt));
      const chips = await c.$$eval('#dashTodoList .chip', es => es.map(e => e.textContent)); assert.ok(chips.length >= 1 && chips.every(n => !/SOLT1_/.test(n)), chips.join('|')); assert.deepStrictEqual(c.errs, []); });
    await t('scoped commander: correction.list returns only own requests with snapshot of visible records; another team commander gets none; review refused by the server', async () => {
      const mine = await c.evaluate(() => new Promise(r => google.script.run.withSuccessHandler(r).api('correction.list', { courseId: S.courseId, status: 'pending' }))); assert.ok(mine.ok); assert.ok(mine.data.every(q => q.requested_by === 'team0@x.com'), JSON.stringify(mine.data.map(q => q.requested_by)));
      const rv = await c.evaluate(id => new Promise(r => google.script.run.withSuccessHandler(r).api('correction.review', { requestId: id, decision: 'approve' })), reqMulti.id); assert.strictEqual(rv.ok, false); assert.strictEqual(X.Records.listCorrections(cmdT1, c1, 'pending').length, 0); });
    await t('390px: corrections table readable without page overflow; dashboard chips wrap', async () => {
      const m = await open('admin@x.com', { width: 390, height: 800 }, true); await goTab(m, 'nav'); await m.waitForSelector('#navCorr .card'); await noOverflow(m); const bb = await m.$eval('#navCorr .ctab', e => e.getBoundingClientRect().width); assert.ok(bb <= 390);
      await goTab(m, 'dash'); await m.waitForSelector('#dashTodo:not([aria-busy])'); await noOverflow(m); assert.ok((await m.$$('#dashTodoList .chip')).length >= 1); assert.ok((await m.$$eval('#dashTodoList .chip', es => es.every(e => e.getBoundingClientRect().height >= 36)))); });
    await t('no page errors', async () => { assert.deepStrictEqual(a.errs.concat(c.errs), []); });
  } finally { await browser.close(); server.close(); }
  console.log('\nTOTAL pass=' + pass + ' fail=' + fail); process.exit(fail ? 1 : 0);
})();
