// B7 + B8 — browser test (Chromium) of src/Index.html against the REAL server code in Node (google.script.run shimmed). NOT Apps Script / HtmlService.
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
res(sA, { pullups: 15, run3km: '13:00' }); res(sB, Object.assign({}, FULL, { pullups: 0 })); res(sC, FULL);   // A partial, B pending review, C full, D no result
let session = 'admin@x.com', rpcLog = [];
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
  const open = async (email, vp, mobile, tab) => { session = email; const ctx = await browser.newContext(mobile ? { viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: vp }); const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(e.message)); await page.goto(url); await page.waitForSelector('#grps button', { state: 'attached' }); await goTab(page, (tab || 'tab_fitgaps').replace(/^tab_/, '')); return page; };
  const noOverflow = async p => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'horizontal overflow');
  const gapsReady = async p => { await p.waitForSelector('#gapOut #gapCounts'); await p.waitForTimeout(100); };
  const names = async p => p.$$eval('#gapOut table tbody tr', trs => trs.map(r => r.textContent));
  try {
    const a = await open('admin@x.com', { width: 1280, height: 900 }); await gapsReady(a);
    await t('B7 admin 1280: all four soldiers listed, counts correct, states told apart (no result / partial / review / complete)', async () => {
      const rows = await names(a); assert.strictEqual(rows.length, 4); const txt = await a.textContent('#gapCounts'); assert.ok(/4/.test(txt));
      const by = n => rows.find(r => r.includes(n)); assert.ok(/אין תוצאה/.test(by('SOLDIERD')), by('SOLDIERD')); assert.ok(/ממתין לבדיקה/.test(by('SOLDIERB')), by('SOLDIERB')); assert.ok(/הושלם/.test(by('SOLDIERC')), by('SOLDIERC'));
      assert.ok(/מקבילים/.test(by('SOLDIERA')) && /Trap Bar/.test(by('SOLDIERA')) && /חסר/.test(by('SOLDIERA')), by('SOLDIERA')); assert.ok(!/undefined|NaN|\bnull\b|no_table|not_entered/.test(await a.textContent('#view'))); });
    await t('B7 note: states that "נפסלה" has no defined rule (not invented)', async () => { assert.ok(/נפסלה/.test(await a.textContent('#gapOut'))); });
    await t('B7 team filter: narrows rows; counts follow it', async () => {
      await a.selectOption('#gapTeam', T0.id); await a.click('#gapRefresh'); await a.waitForFunction(() => document.querySelectorAll('#gapOut table tbody tr').length === 2); const r = await names(a); assert.ok(r.every(x => /SOLDIER[AB]/.test(x))); assert.ok(/2/.test(await a.textContent('#gapCounts'))); });
    await t('B7 component filter: only soldiers missing that component', async () => {
      await a.selectOption('#gapTeam', ''); await a.selectOption('#gapComp', 'run3km'); await a.click('#gapRefresh'); await a.waitForFunction(() => document.querySelectorAll('#gapOut table tbody tr').length === 1); const r = await names(a); assert.ok(/SOLDIERD/.test(r[0]) && !r.some(x => /SOLDIER[ABC]/.test(x)), r.join('|')); });
    await t('B7 is read-only in the UI: no input/save/edit controls inside the result area, and no write call was sent', async () => {
      assert.strictEqual((await a.$$('#gapOut input:not([type=hidden]), #gapOut textarea, #gapOut button')).length, 0); const writes = rpcLog.filter(x => x.m === 'api' && !/\.(read|list|get|me|org|completion|summary|status|typesList|mine|dashboard)/.test(x.a) && /create|save|update|edit|cancel|approve|import/.test(x.a)); assert.deepStrictEqual(writes, []); });
    await t('B7 desktop: no page errors, no overflow', async () => { assert.deepStrictEqual(a.errs, []); await noOverflow(a); });
    const m = await open('admin@x.com', { width: 390, height: 844 }, true); await gapsReady(m);
    await t('B7 mobile 390: no horizontal overflow, filters and refresh reachable by touch (>=40px), table readable', async () => {
      await noOverflow(m); for (const sel of ['#gapTeam', '#gapComp', '#gapRefresh']) { const bb = await (await m.$(sel)).boundingBox(); assert.ok(bb && bb.height >= 40, sel + ' ' + JSON.stringify(bb)); }
      assert.strictEqual((await names(m)).length, 4); assert.deepStrictEqual(m.errs, []); });
    const c = await open('team0@x.com', { width: 1280, height: 900 }); await gapsReady(c);
    await t('B7 team commander: sees ONLY his own team (2 soldiers), team list has only his team, nothing of the other team is in the page', async () => {
      const rows = await names(c); assert.strictEqual(rows.length, 2); const html2 = await c.content(); assert.ok(!/SOLDIERC|SOLDIERD/.test(html2), 'foreign soldier leaked into DOM'); const opts = await c.$$eval('#gapTeam option', os => os.map(o => o.value).filter(Boolean)); assert.deepStrictEqual(opts, [T0.id]); });
    await t('B7 team commander: forging a foreign team filter returns nothing (server-side)', async () => {
      const direct = await c.evaluate(([tid, cid]) => new Promise(res => google.script.run.withSuccessHandler(res).api('fitness.completion', { courseId: cid, opts: { teamId: tid } })), [T1.id, c1]); const d = direct.data || direct.result || direct; assert.strictEqual((d.rows || []).length, 0, JSON.stringify(direct).slice(0, 200)); });
    const cm = await open('team0@x.com', { width: 390, height: 844 }, true); await gapsReady(cm);
    await t('B7 commander mobile 390: no overflow, 2 rows', async () => { await noOverflow(cm); assert.strictEqual((await names(cm)).length, 2); });
    const ca = await open('all@x.com', { width: 1280, height: 900 }); await gapsReady(ca);
    await t('B7 course commander: sees all 4 soldiers and both teams', async () => { assert.strictEqual((await names(ca)).length, 4); const opts = await ca.$$eval('#gapTeam option', os => os.map(o => o.value).filter(Boolean)); assert.ok(opts.includes(T0.id) && opts.includes(T1.id)); });

    // ---------- B8 ----------
    const f = await open('admin@x.com', { width: 1280, height: 900 }, false, 'tab_fitness'); await f.waitForSelector('#f_run3km');
    const fill = async (p, o) => { await p.selectOption('#f_soldier_id', sD.id); const types = await p.$$eval('#f_test_type_id option', os => os.map(x => [x.value, x.textContent])); await p.selectOption('#f_test_type_id', types.find(x => /רגיל/.test(x[1]))[0]); for (const k of ['test_date', 'pullups', 'parallel_bars', 'trap_bar', 'run150x2', 'run3km']) await p.fill('#f_' + k, o[k] === undefined ? '' : String(o[k])); };
    const sendsOf = () => rpcLog.filter(x => x.m === 'api' && x.a === 'records.create').length;
    const save = p => p.click('#view button:has-text("שמירה")');
    for (const bad of ['13', '1300', '13:5', '13:60', '1:2:3', 'aa:bb', '13.00', '-1:00', '13:00 x']) {
      await t('B8 invalid "' + bad + '": inline error next to the field, other fields kept, NOTHING sent to the server', async () => {
        const n0 = sendsOf(), db0 = X.Db.all('FitnessTests').length; await fill(f, { test_date: '2026-11-20', pullups: 14, parallel_bars: 19, trap_bar: 9, run150x2: '00:50', run3km: bad }); await save(f);
        await f.waitForSelector('#err_run3km:not([hidden])'); const msg = await f.textContent('#err_run3km'); assert.ok(/mm:ss|דקות:שניות|שניות/.test(msg) && /[א-ת]/.test(msg), msg);
        assert.strictEqual(await f.getAttribute('#f_run3km', 'aria-invalid'), 'true'); assert.strictEqual(await f.inputValue('#f_run3km'), bad); assert.strictEqual(await f.inputValue('#f_pullups'), '14'); assert.strictEqual(await f.inputValue('#f_trap_bar'), '9'); assert.strictEqual(await f.inputValue('#f_test_date'), '2026-11-20');
        assert.strictEqual(sendsOf(), n0, 'no records.create sent'); assert.strictEqual(X.Db.all('FitnessTests').length, db0); assert.ok(!(await f.$eval('#view', e => e.textContent)).match(/undefined|\bnull\b|NaN/)); }); }
    await t('B8: both time fields invalid -> two inline errors; typing clears the error of that field only', async () => {
      await fill(f, { test_date: '2026-11-20', pullups: 14, run150x2: '5', run3km: '99:99' }); await save(f); await f.waitForSelector('#err_run150x2:not([hidden])'); await f.waitForSelector('#err_run3km:not([hidden])');
      await f.fill('#f_run150x2', '00:50'); await f.dispatchEvent('#f_run150x2', 'input'); assert.ok(await f.$eval('#err_run150x2', e => e.hidden)); assert.ok(!(await f.$eval('#err_run3km', e => e.hidden))); });
    await t('B8: focus moves to the FIRST invalid field (run150x2 before run3km); valid-only form keeps focus order untouched', async () => {
      await fill(f, { test_date: '2026-11-20', pullups: 14, run150x2: '5', run3km: '99:99' }); await save(f); await f.waitForSelector('#err_run150x2:not([hidden])');
      assert.strictEqual(await f.evaluate(() => document.activeElement && document.activeElement.id), 'f_run150x2'); await fill(f, { test_date: '2026-11-20', pullups: 14, run150x2: '00:50', run3km: '99:99' }); await save(f); await f.waitForSelector('#err_run3km:not([hidden])');
      assert.strictEqual(await f.evaluate(() => document.activeElement && document.activeElement.id), 'f_run3km'); assert.ok(await f.$eval('#err_run150x2', e => e.hidden), 'old error cleared after a corrected re-submit'); });
    await t('B8 valid formats are accepted and saved: 13:00, 3:05, 00:50, 59:59 and empty (not entered)', async () => {
      for (const [d, rr, r3] of [['2026-11-21', '00:50', '13:00'], ['2026-11-22', '0:50', '3:05'], ['2026-11-23', '', '59:59'], ['2026-11-24', '00:50', '']]) {
        const n0 = X.Db.all('FitnessTests').length; await fill(f, { test_date: d, pullups: 14, run150x2: rr, run3km: r3 }); await save(f); await f.waitForFunction(() => /נשמר/.test(document.querySelector('#view').textContent)); assert.strictEqual(X.Db.all('FitnessTests').length, n0 + 1, d); assert.ok(await f.$eval('#err_run3km', e => e.hidden)); } });
    await t('B8: server-side validation is kept — a raw API call with a bad time is still refused by the server', async () => {
      const code = await f.evaluate(([sid, tid, cid]) => new Promise(res => google.script.run.withSuccessHandler(res).api('records.create', { courseId: cid, table: 'FitnessTests', data: { request_id: 'x' + Date.now(), soldier_id: sid, test_date: '2026-11-25', test_type_id: tid, run3km: '13:99' } })), [sD.id, reg.id, c1]); assert.ok(/VALIDATION|ok":false|false/.test(JSON.stringify(code)) && !X.Db.all('FitnessTests').some(r => r.test_date && String(r.test_date).includes('2026-11-25')), JSON.stringify(code).slice(0, 200)); });
    await t('B8 desktop: no page errors', async () => { assert.deepStrictEqual(f.errs, []); await noOverflow(f); });
    const fm = await open('admin@x.com', { width: 390, height: 844 }, true, 'tab_fitness'); await fm.waitForSelector('#f_run3km');
    await t('B8 mobile 390: invalid time -> inline error visible, numeric keypad hint, no overflow, nothing sent', async () => {
      const n0 = sendsOf(); await fill(fm, { test_date: '2026-11-26', pullups: 14, run3km: '1300' }); await save(fm); await fm.waitForSelector('#err_run3km:not([hidden])'); assert.strictEqual(await fm.getAttribute('#f_run3km', 'inputmode'), 'numeric'); assert.strictEqual(sendsOf(), n0); await noOverflow(fm);
      const bb = await (await fm.$('#err_run3km')).boundingBox(); assert.ok(bb && bb.width > 0 && bb.height > 0); assert.deepStrictEqual(fm.errs, []); });
  } finally { await browser.close(); server.close(); }
  console.log('\nUI B7B8 TOTAL pass=' + pass + ' fail=' + fail); if (fail) process.exit(1);
})();
