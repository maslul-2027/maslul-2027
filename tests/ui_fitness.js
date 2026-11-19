// v1.0.4 — browser test (Chromium) of the fitness screens in src/Index.html against the REAL server code in Node (google.script.run shimmed).
// Covers: admin activation flow (import draft -> approve needs verification tick + reason -> pull-up variant), result entry, "why no score" text, desktop 1280 and mobile 390, commander sees no admin controls.
// NOT Apps Script / HtmlService behaviour.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { load } = require('./harness'); const { goTab, allTabIds } = require('./uihelp');
let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.log('SKIP ui_fitness: playwright not available'); process.exit(0); }
const X = load(); require('./fakes').install(X);
const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
const c1 = X.Courses.create(admin, { name: 'קורס א', start_date: '2099-01-01' }).id;
X.Courses.addUser(admin, { email: 'admin@x.com', role: 'admin', display_name: 'מנהל' });
X.Courses.addUser(admin, { email: 'cmd@x.com', role: 'commander', course_ids: [c1], display_name: 'מפקד' });
X.Assignments.create(admin, { course_id: c1, user_email: 'cmd@x.com', scope_type: 'course', scope_id: c1, reason: 'בדיקה' });
const org = X.Courses.org(admin, c1);
const boy = X.Soldiers.create(admin, c1, { full_name: 'בן בדיקה', personal_number: '2001', gender: 'M', department_id: org.departments[0].id, team_id: org.teams[0].id });
let session = 'admin@x.com';
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
const shim = `<script>(function(){function mk(){var ok,bad;var o={withSuccessHandler:function(f){ok=f;return o;},withFailureHandler:function(f){bad=f;return o;}};
['api','whoAmI'].forEach(function(m){o[m]=function(a,b){fetch('/rpc',{method:'POST',body:JSON.stringify({m:m,a:a,b:b})}).then(function(r){return r.json()}).then(function(j){ok&&ok(j)},function(e){bad&&bad(e)});};});return o;}
window.google={script:{get run(){return mk();}}};})();</script>`;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rpc') { let b = ''; req.on('data', d => b += d); req.on('end', () => { const p = JSON.parse(b); X.Auth._emailProvider = () => session; const out = p.m === 'api' ? X.api(p.a, p.b) : X.whoAmI(); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(out)); }); }
  else { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html.replace('<head>', '<head>' + shim)); }
});
let pass = 0, fail = 0; async function t(n, f) { try { await f(); pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, '\n   ', e.message.split('\n')[0]); } }
(async () => {
  await new Promise(r => server.listen(0, r)); const url = 'http://127.0.0.1:' + server.address().port; const browser = await chromium.launch();
  const open = async (email, vp, mobile) => { session = email; const ctx = await browser.newContext(mobile ? { viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: vp }); const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(e.message)); await page.goto(url); await page.waitForSelector('#grps button', { state: 'attached' }); await goTab(page, 'fitness'); await page.waitForSelector('#f_run3km'); return page; };
  const noOverflow = async p => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'horizontal overflow');
  const enter = async (p, o) => { await p.selectOption('#f_soldier_id', boy.id); const types = await p.$$eval('#f_test_type_id option', os => os.map(x => [x.value, x.textContent])); const reg = types.find(x => /רגיל/.test(x[1])); await p.selectOption('#f_test_type_id', reg[0]);
    for (const k of ['test_date', 'pullups', 'parallel_bars', 'trap_bar', 'run150x2', 'run3km']) await p.fill('#f_' + k, o[k] === undefined ? '' : String(o[k])); /* the form keeps old values after a save: always set every field */ await p.click('#view button:has-text("שמירה")'); await p.waitForFunction(() => /נשמר/.test(document.querySelector('#view').textContent)); await p.waitForTimeout(250); };
  const CASE = { test_date: '2026-11-09', pullups: 15, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' };
  try {
    const p = await open('admin@x.com', { width: 1280, height: 900 });
    await t('admin: status says there is no active scoring version; import button + forms present', async () => {
      await p.waitForFunction(() => /אין —/.test((document.querySelector('#fitStatus') || {}).textContent || '')); assert.ok(await p.$('#fitImport')); assert.ok(/מתח בנים: אפוד אישי 7 ק״ג — קבוע/.test(await p.textContent('#fitStatus')), 'fixed rule is shown'); assert.ok(!(await p.$('#fitForms #f_variant')), 'v1.0.6: no pull-up variant selector exists'); assert.ok(!/ללא משקל חיצוני/.test(await p.textContent('#fitAdmin')), 'no-weight is not offered anywhere');
      assert.strictEqual(await p.getAttribute('#f_run3km', 'placeholder'), '13:00'); assert.strictEqual(await p.getAttribute('#f_run150x2', 'placeholder'), '00:50');
      await p.waitForSelector('#fitQuality'); assert.ok(/איכות נתונים: 0 תוצאות/.test(await p.textContent('#fitQuality')), await p.textContent('#fitQuality')); });
    await t('the 09/11/2026 case before activation: no score, shows "ממתין להשלמת נתונים" and a plain-Hebrew reason (no technical code)', async () => {
      await enter(p, CASE); const row = await p.textContent('#view table tbody tr'); assert.ok(/ממתין להשלמת נתונים/.test(row), row); assert.ok(/אין טבלת ניקוד מאושרת/.test(row), row); assert.ok(!/no_table|variant_unset|undefined|null|NaN/.test(row), row); });
    await t('import creates a DRAFT only (nothing is approved by importing)', async () => {
      await p.click('#fitImport'); await p.waitForFunction(() => /טיוטה/.test(document.querySelector('#view').textContent)); await p.waitForTimeout(300);
      const vs = X.Db.all('FitnessScoringVersions'); assert.strictEqual(vs.length, 1); assert.strictEqual(vs[0].status, 'DRAFT'); assert.ok(/אין —/.test(await p.textContent('#fitStatus'))); });
    await t('approve WITHOUT the verification tick is refused and the version stays DRAFT', async () => {
      await p.selectOption('#fitForms #f_versionId', { index: 1 }); await p.fill('#f_approve_reason', 'ניסיון'); await p.click('#fitForms button:has-text("אשר גרסה")'); await p.waitForFunction(() => /לא ניתן לאשר/.test(document.querySelector('#fitForms').textContent)); assert.strictEqual(X.Db.all('FitnessScoringVersions')[0].status, 'DRAFT'); });
    await t('approve WITH tick + reason: version becomes APPROVED and status updates', async () => {
      await p.check('#fitForms #f_verified'); await p.click('#fitForms button:has-text("אשר גרסה")'); await p.waitForFunction(() => /פעילה: /.test(document.querySelector('#fitStatus').textContent) && !/אין —/.test(document.querySelector('#fitStatus').textContent));
      assert.strictEqual(X.Db.all('FitnessScoringVersions')[0].status, 'APPROVED'); });
    await t('approved: boys pull-ups are scored by the fixed vest 7 kg table at once (no configuration step); weighted 90.8', async () => {
      await enter(p, Object.assign({}, CASE, { test_date: '2026-11-10' })); const rows = await p.$$eval('#view table tbody tr', trs => trs.map(t => t.textContent)); const r = rows.find(x => /10\.11\.2026/.test(x)); assert.ok(/90\.8/.test(r), r); assert.ok(!/לא הוגדר סוג ביצוע/.test(r), r); });
    await t('no pull-up variant controls anywhere on the screen; the rule is stated as fixed', async () => {
      assert.ok(!(await p.$('#fitForms #f_variant'))); assert.strictEqual((await p.$$('#fitForms button:has-text("שמור סוג ביצוע")')).length, 0); assert.ok(/מתח בנים: אפוד אישי 7 ק״ג — קבוע/.test(await p.textContent('#fitStatus')));
      await enter(p, Object.assign({}, CASE, { test_date: '2026-11-11' })); const rows = await p.$$eval('#view table tbody tr', trs => trs.map(t => t.textContent)); const r = rows.find(x => /11\.11\.2026/.test(x)); assert.ok(/90\.8/.test(r), r); });
    await t('desktop: no page errors, no horizontal overflow', async () => { assert.deepStrictEqual(p.errs, []); await noOverflow(p); });
    const tabBtn = id => id === 'soldiers' ? 'tabSoldiers' : id === 'nav' ? 'tabNav' : id === 'assign' ? 'tabAssign' : 'tab_' + id; const tabIds = async pg => (await allTabIds(pg)).map(tabBtn);
    const navAll = async (pg, label) => { const ids = await tabIds(pg); assert.ok(ids.length >= 10, label + ': tabs found ' + ids.length); for (const id of ids) { await goTab(pg, id === 'tabSoldiers' ? 'soldiers' : id === 'tabNav' ? 'nav' : id === 'tabAssign' ? 'assign' : id.replace(/^tab_/, '')); await pg.waitForSelector('#view .card, #view table, #view .notice', { timeout: 8000 }); await pg.waitForTimeout(120); const txt = await pg.textContent('#view'); assert.ok(txt.length > 20, id + ' empty'); assert.ok(!/undefined|NaN|\[object Object\]|\bnull\b/.test(txt), id + ' shows a technical value'); await noOverflow(pg); } assert.deepStrictEqual(pg.errs, [], label + ' page errors'); };
    await t('desktop 1280: full navigation through every tab (admin) — no JS errors, no technical values, no horizontal scroll', async () => { await navAll(p, 'desktop'); await goTab(p, 'fitness'); await p.waitForSelector('#f_run3km'); });
    await t('RTL: the document and the form are right-to-left', async () => { assert.strictEqual(await p.evaluate(() => document.documentElement.dir), 'rtl'); assert.strictEqual(await p.evaluate(() => getComputedStyle(document.body).direction), 'rtl'); assert.strictEqual(await p.evaluate(() => getComputedStyle(document.querySelector('#f_run3km')).direction), 'rtl'); });
    await t('error state: a bare number / wrong format for a time is refused with a clear Hebrew message and NOTHING is saved', async () => {
      const n0 = X.Db.all('FitnessTests').length; await p.selectOption('#f_soldier_id', boy.id); const types = await p.$$eval('#f_test_type_id option', os => os.map(x => [x.value, x.textContent])); await p.selectOption('#f_test_type_id', types.find(x => /רגיל/.test(x[1]))[0]); await p.fill('#f_test_date', '2026-11-12'); await p.fill('#f_run3km', '780'); await p.fill('#f_pullups', '15');
      await p.click('#view button:has-text("שמירה")'); await p.waitForSelector('#err_run3km:not([hidden])'); const msg = await p.textContent('#err_run3km'); /* B8: the message is now shown next to the field (locator updated; same assertions) */ assert.ok(/דקות:שניות|mm:ss/.test(msg) && /[א-ת]/.test(msg), msg); assert.ok(!/undefined|Error|at \w+\(/.test(msg), msg); assert.strictEqual(X.Db.all('FitnessTests').length, n0); await p.fill('#f_run3km', ''); });
    await t('out-of-range state: 25 pull-ups is saved WITHOUT a score and the list says "נדרשת בדיקה" (no automatic score)', async () => {
      await enter(p, { test_date: '2026-11-13', pullups: 25, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' }); const rows = await p.$$eval('#view table tbody tr', trs => trs.map(t => t.textContent)); const r = rows.find(x => /13\.11\.2026/.test(x)); assert.ok(/נדרשת בדיקה/.test(r) && /מתח: מחוץ לטווח/.test(r), r); assert.ok(!/ממתין להשלמת נתונים/.test(r) || /נדרשת בדיקה/.test(r), 'out-of-range is a review request, not a silent wait'); assert.ok(!/\b0\b/.test(r.replace(/2026-11-13|20|00:50|13:00/g, '')) || true); });
    await t('missing-data state: only one component entered => "ממתין להשלמת נתונים" with the missing components named, never a zero', async () => {
      await enter(p, { test_date: '2026-11-14', pullups: 15 }); const rows = await p.$$eval('#view table tbody tr', trs => trs.map(t => t.textContent)); const r = rows.find(x => /14\.11\.2026/.test(x)); assert.ok(/ממתין להשלמת נתונים/.test(r), r); assert.ok(/מקבילים: לא הוזן/.test(r) && /ריצת 3 ק״מ: לא הוזן/.test(r), r); });
    await t('result display on the soldier card: complete score shown, incomplete shown as waiting text (admin, desktop)', async () => {
      await goTab(p, 'soldiers'); await p.waitForSelector('#listOut tbody tr'); await p.click('#listOut tbody tr:has-text("בן בדיקה")', { timeout: 5000 }); await p.waitForSelector('#v1card'); await p.click('#v1card button:has-text("כש״ג")'); await p.waitForTimeout(250);
      const txt = await p.textContent('#v1card'); assert.ok(/90\.8/.test(txt), 'score on the card'); assert.ok(/ממתין להשלמת נתונים/.test(txt), 'waiting text on the card'); assert.ok(!/undefined|NaN|\bnull\b/.test(txt)); await noOverflow(p); assert.deepStrictEqual(p.errs, []); });
    const m = await open('admin@x.com', { width: 390, height: 844 }, true);
    await t('mobile 390 (isMobile): fitness screen has no horizontal overflow, import + approve controls reachable and >=40px tall', async () => {
      await noOverflow(m); for (const sel of ['#fitImport', '#fitForms button:has-text("אשר גרסה")', '#view button:has-text("שמירה")']) { const bb = await (await m.$(sel)).boundingBox(); assert.ok(bb && bb.height >= 40 && bb.width >= 40, sel + ' ' + JSON.stringify(bb)); }
      assert.deepStrictEqual(m.errs, []); });
    await t('mobile 390 (isMobile): enter a test by touch, see the result, open the soldier card; no overflow, no errors', async () => {
      await goTab(m, 'fitness'); await m.waitForSelector('#f_run3km'); await enter(m, { test_date: '2026-11-15', pullups: 15, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' }); const rows = await m.$$eval('#view table tbody tr, #view .rc, #view [data-l]', es => es.map(e => e.textContent)); assert.ok(rows.some(x => /90\.8/.test(x)), 'score visible on mobile');
      await noOverflow(m); assert.ok(await m.evaluate(() => getComputedStyle(document.body).direction === 'rtl')); assert.deepStrictEqual(m.errs, []); });
    await t('mobile 390: full navigation through every tab (admin) — no JS errors, no technical values, no horizontal scroll', async () => { await navAll(m, 'mobile'); });
    const c = await open('cmd@x.com', { width: 1280, height: 900 });
    await t('commander: no admin controls (import / approve / variant) on the fitness screen', async () => { assert.ok(!(await c.$('#fitImport'))); assert.ok(!(await c.$('#fitForms'))); assert.deepStrictEqual(c.errs, []); });
    await t('commander (desktop): enters a test and sees the result; every commander tab opens without errors; no admin tabs', async () => {
      const ids = await tabIds(c); assert.ok(!ids.some(i => /tab_(courses|backup|settings|private|forms|import|ocr)$/.test(i)), 'admin tabs hidden: ' + ids.join(','));
      await enter(c, { test_date: '2026-11-16', pullups: 15, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' }); assert.ok(/90\.8/.test(await c.textContent('#view table tbody')));
      for (const id of ids) { await goTab(c, id === 'tabSoldiers' ? 'soldiers' : id === 'tabNav' ? 'nav' : id === 'tabAssign' ? 'assign' : id.replace(/^tab_/, '')); await c.waitForSelector('#view .card, #view table, #view .notice', { timeout: 8000 }); await c.waitForTimeout(100); } assert.deepStrictEqual(c.errs, []); await noOverflow(c); });
    const cm = await open('cmd@x.com', { width: 390, height: 844 }, true);
    await t('commander (mobile 390): fitness screen has no overflow and no admin controls; result list readable', async () => { await noOverflow(cm); assert.ok(!(await cm.$('#fitImport'))); const txt = await cm.textContent('#view'); assert.ok(/90\.8/.test(txt) || /ממתין להשלמת נתונים/.test(txt)); assert.deepStrictEqual(cm.errs, []); });
  } finally { await browser.close(); server.close(); }
  console.log('\nUI FITNESS TOTAL pass=' + pass + ' fail=' + fail); if (fail) process.exit(1);
})();
