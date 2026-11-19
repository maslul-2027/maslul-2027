// STAGING SMOKE (local, DEMO DATA ONLY) — one fast browser run that exercises: app load, identity states ("login"), ADMIN vs commander permissions, navigation across every screen (desktop + phone), in-app forms and the one-time soldier form page.
// Real Chromium (Playwright) + src/Index.html + src/FormPage.html against the REAL server code running in Node (in-memory Db). google.script.run is shimmed to a local HTTP bridge; the "Google session e-mail" is simply a variable.
// What this is NOT: Apps Script / HtmlService / Google login / Sheets / Drive / permissions of a real deployment. It never contacts Google, never uses clasp, never deploys. All people, e-mails (@x.com), numbers and names below are synthetic.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { load } = require('./harness'); const { goTab, allTabIds } = require('./uihelp');
let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.log('SKIP ui_staging_smoke: playwright not available'); process.exit(0); }

const X = load(); const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
const c1 = X.Courses.create(admin, { name: 'קורס דמה', start_date: '2099-01-01' }).id;
X.Courses.addUser(admin, { email: 'admin@x.com', role: 'admin', display_name: 'מנהל דמה' });
X.Courses.addUser(admin, { email: 'cmd@x.com', role: 'commander', course_ids: [c1], display_name: 'מפקד דמה' });
X.Courses.addUser(admin, { email: 'off@x.com', role: 'commander', course_ids: [c1], display_name: 'לא פעיל דמה' });
X.Db.update('Users', X.Db.where('Users', u => u.email === 'off@x.com')[0].id, { active: false });          // Course Tracker record inactive (a Google account would still authenticate)
const org = X.Courses.org(admin, c1), dep = org.departments[0].id, team = i => org.teams.filter(t => t.department_id === dep)[i].id;
X.Assignments.create(admin, { course_id: c1, user_email: 'cmd@x.com', scope_type: 'team', scope_id: team(0), reason: 'בדיקה' });
const mk = (n, pn, ti) => X.Soldiers.create(admin, c1, { full_name: n, personal_number: pn, gender: 'M', department_id: dep, team_id: team(ti), commander_note: 'SECRET-ADMIN-NOTE' });
const s1 = mk('חייל דמה א', '9001', 0), s2 = mk('חייל דמה ב', '9002', 0), s3 = mk('חייל דמה ג', '9003', 1);
const link = X.Forms.createLink(admin, c1, s1.id, 7);
let session = 'admin@x.com';

const idx = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8'), frm = fs.readFileSync(path.join(__dirname, '..', 'src', 'FormPage.html'), 'utf8');
const shim = `<script>(function(){function mk(){var ok,bad;var o={withSuccessHandler:function(f){ok=f;return o;},withFailureHandler:function(f){bad=f;return o;}};
['api','whoAmI','formOpen','formSubmit'].forEach(function(m){o[m]=function(){var a=Array.prototype.slice.call(arguments);fetch('/rpc',{method:'POST',body:JSON.stringify({m:m,a:a})}).then(function(r){return r.json()}).then(function(j){ok&&ok(j)},function(e){bad&&bad(e)});};});return o;}
window.google={script:{get run(){return mk();}}};})();</script>`;
const rpc = p => { X.Auth._emailProvider = () => session; return p.m === 'api' ? X.api(p.a[0], p.a[1]) : p.m === 'whoAmI' ? X.whoAmI() : X[p.m].apply(null, p.a); };
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rpc') { let b = ''; req.on('data', d => b += d); req.on('end', () => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(rpc(JSON.parse(b)))); }); }
  else { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end((/[?&]form=/.test(req.url) ? frm : idx).replace('<head>', '<head>' + shim)); }
});
let pass = 0, fail = 0; async function t(name, fn) { try { await fn(); pass++; console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '\n   ', String(e.message).split('\n')[0]); } }
const NOHORIZ = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  await new Promise(r => server.listen(0, r)); const base = 'http://127.0.0.1:' + server.address().port; const browser = await chromium.launch();
  const open = async (email, vp, waitApp) => { session = email; const ctx = await browser.newContext({ viewport: vp || { width: 1280, height: 900 } }); const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(e.message));
    await page.goto(base); await page.waitForFunction(() => document.getElementById('who') && document.getElementById('who').textContent.trim().length > 0); if (waitApp !== false) await page.waitForSelector('#grps button', { state: 'attached' }); return page; };
  const callAs = async (page, email, method, args) => { session = email; return page.evaluate(async ([m, a]) => (await fetch('/rpc', { method: 'POST', body: JSON.stringify({ m: 'api', a: [m, a] }) })).json(), [method, args]); };
  try {
    // ---------- 1. load ----------
    const pa = await open('admin@x.com');
    await t('SMOKE load: ADMIN opens the app — header shows name, role and the build version, area buttons and a course are present, no page errors', async () => {
      const who = await pa.textContent('#who'); assert.ok(who.includes('מנהל דמה') && who.includes('מנהל מערכת') && who.includes('v' + X.APP.VERSION), who); assert.ok((await pa.$$('#grps button')).length >= 3);
      assert.ok((await pa.$$('#course option')).length >= 1); assert.deepStrictEqual(pa.errs, []); });
    // ---------- 2. identity ("login") ----------
    for (const [label, email] of [['stranger (not in Users)', 'stranger@x.com'], ['inactive Course Tracker user (Google account would still authenticate)', 'off@x.com'], ['blank identity (no e-mail from the session)', '']]) {
      await t('SMOKE identity: ' + label + ' → refused: no name/role in the header, no soldiers anywhere in the page, no add button; server answers UNAUTHENTICATED/refusal to every call', async () => {
        const p = await open(email, null, false); await p.waitForTimeout(400); const who = await p.textContent('#who'); assert.ok(!who.includes('מנהל') && !who.includes('מפקד'), 'header must not show a role: ' + who);
        const html = await p.content(); assert.ok(!html.includes('חייל דמה') && !html.includes('SECRET-ADMIN-NOTE'), 'no data in the page'); assert.ok(!(await p.$('#addBtn')));
        const who2 = await callAs(p, email, 'whoAmI', {}); const w = await p.evaluate(async () => (await fetch('/rpc', { method: 'POST', body: JSON.stringify({ m: 'whoAmI', a: [] }) })).json()); assert.strictEqual(w.ok, false);
        for (const m of ['courses.list', 'soldiers.list', 'users.list']) { const r = await callAs(p, email, m, { courseId: c1 }); assert.strictEqual(r.ok, false, m + ' must be refused'); } assert.deepStrictEqual(p.errs, []); await p.context().close(); }); }
    // ---------- 3. ADMIN vs commander ----------
    session = 'admin@x.com'; const adminTabs = (await allTabIds(pa)).sort();
    const pc = await open('cmd@x.com'); const cmdTabs = (await allTabIds(pc)).sort(); const adminOnly = adminTabs.filter(x => cmdTabs.indexOf(x) === -1);
    await t('SMOKE permissions (UI): the commander sees a strict subset of the ADMIN screens; every admin-only screen is absent for him; header says commander', async () => {
      assert.ok(cmdTabs.length >= 3 && adminOnly.length >= 3, 'admin ' + adminTabs.length + ' / commander ' + cmdTabs.length); cmdTabs.forEach(x => assert.ok(adminTabs.indexOf(x) !== -1, 'commander tab ' + x + ' must also exist for admin'));
      const who = await pc.textContent('#who'); assert.ok(who.includes('מפקד') && !who.includes('מנהל מערכת'), who); });
    await t('SMOKE permissions (UI data): the team commander sees only his team (2 soldiers), never another team, never the admin note', async () => {
      await goTab(pc, 'soldiers'); await pc.waitForSelector('#listOut tbody tr'); const rows = await pc.$$eval('#listOut tbody tr', trs => trs.map(t => t.textContent)); assert.strictEqual(rows.length, 2); const html = await pc.content(); assert.ok(!html.includes('חייל דמה ג') && !html.includes('SECRET-ADMIN-NOTE')); });
    await t('SMOKE permissions (server): the commander is refused every admin call even when sent directly (users.list, users.add, import.start, backup.create, backup.list)', async () => {
      const cases = [['users.list', {}], ['users.add', { email: 'x@x.com', role: 'admin' }], ['import.start', { courseId: c1, data: {} }], ['backup.create', {}], ['backup.list', {}]]; const before = X.Db.all('Users').length;
      for (const [m, a] of cases) { const r = await callAs(pc, 'cmd@x.com', m, a); assert.strictEqual(r.ok, false, m + ' must be refused for a commander'); assert.strictEqual(r.code, 'FORBIDDEN', m + ' must be refused by the permission check (FORBIDDEN), not fail for another reason: ' + r.code); } assert.strictEqual(X.Db.all('Users').length, before, 'nothing was added'); });
    await t('SMOKE permissions (server data): the commander\'s API answers for his own soldier carry no admin-only fields (commander_note, sociometric_third); a soldier of another team is refused; the admin gets the note', async () => {
      const mine = await callAs(pc, 'cmd@x.com', 'soldiers.list', { courseId: c1 }); assert.ok(mine.ok && mine.data.length >= 2, JSON.stringify(mine).slice(0, 120)); const js = JSON.stringify(mine); assert.ok(!js.includes('SECRET-ADMIN-NOTE') && !/commander_note|sociometric_third/.test(js), 'admin-only fields leaked in list');
      const card = await callAs(pc, 'cmd@x.com', 'soldiers.card', { id: s1.id }); assert.ok(card.ok); assert.ok(!JSON.stringify(card).includes('SECRET-ADMIN-NOTE'), 'note leaked in card');
      const other = await callAs(pc, 'cmd@x.com', 'soldiers.card', { id: s3.id }); assert.strictEqual(other.ok, false, 'other team soldier must be refused'); assert.ok(!JSON.stringify(other).includes('חייל דמה ג'));
      const adm = await callAs(pc, 'admin@x.com', 'soldiers.card', { id: s1.id }); assert.ok(JSON.stringify(adm).includes('SECRET-ADMIN-NOTE'), 'control: admin must see the note (otherwise this test proves nothing)'); });
    // ---------- 4. navigation ----------
    const sweep = async (page, ids, label) => { const seen = []; for (const id of ids) { await goTab(page, id); await page.waitForTimeout(120); const txt = await page.evaluate(() => document.querySelector('main') ? document.querySelector('main').innerText : document.body.innerText);
        assert.ok(!/undefined|\[object Object\]|NaN/.test(txt), label + ' ' + id + ' shows a technical value'); assert.ok(await NOHORIZ(page), label + ' ' + id + ' overflows horizontally'); seen.push(id); } assert.deepStrictEqual(page.errs, [], label + ' page errors'); return seen.length; };
    await t('SMOKE navigation: ADMIN opens EVERY screen on desktop 1280 — no technical values (undefined / [object Object] / NaN), no horizontal scroll, no page errors', async () => { session = 'admin@x.com'; assert.strictEqual(await sweep(pa, adminTabs, 'admin-desktop'), adminTabs.length); });
    await t('SMOKE navigation: the commander opens EVERY screen he has on desktop 1280 — same checks', async () => { session = 'cmd@x.com'; assert.strictEqual(await sweep(pc, cmdTabs, 'cmd-desktop'), cmdTabs.length); });
    const pm = await open('admin@x.com', { width: 390, height: 800 }); const pmc = await open('cmd@x.com', { width: 390, height: 800 });
    await t('SMOKE navigation (phone 390): ADMIN opens every screen — same checks', async () => { session = 'admin@x.com'; assert.strictEqual(await sweep(pm, adminTabs, 'admin-phone'), adminTabs.length); });
    await t('SMOKE navigation (phone 390): the commander opens every screen — same checks', async () => { session = 'cmd@x.com'; assert.strictEqual(await sweep(pmc, cmdTabs, 'cmd-phone'), cmdTabs.length); });
    // ---------- 5. in-app forms ----------
    session = 'admin@x.com'; await goTab(pa, 'soldiers'); await pa.waitForSelector('#addBtn');
    await t('SMOKE form (ADMIN): empty soldier form is refused with a visible message and saves nothing; a valid one saves, opens the card and appears in the list', async () => {
      const n0 = X.Db.all('Soldiers').length; await pa.click('#addBtn'); await pa.click('#fSave'); await pa.waitForFunction(() => document.querySelector('#fMsg') && document.querySelector('#fMsg').textContent.trim().length > 0); assert.strictEqual(X.Db.all('Soldiers').length, n0, 'nothing saved');
      await pa.fill('#fName', 'חייל דמה חדש'); await pa.fill('#fPn', '9100'); await pa.selectOption('#fGender', 'M'); await pa.selectOption('#fDep', dep); await pa.selectOption('#fTeam', team(1)); await pa.click('#fSave');
      await pa.waitForSelector('#cardName'); assert.strictEqual(await pa.textContent('#cardName'), 'חייל דמה חדש'); assert.strictEqual(X.Db.all('Soldiers').length, n0 + 1); await pa.click('#back'); await pa.waitForSelector('#listOut table'); assert.deepStrictEqual(pa.errs, []); });
    await t('SMOKE form (commander): has no add / edit entry points for the registry, and the card of his soldier hides the admin note', async () => {
      session = 'cmd@x.com'; await goTab(pc, 'soldiers'); await pc.waitForSelector('#listOut tbody tr'); assert.ok(!(await pc.$('#addBtn')), 'no add soldier button for a commander on the soldiers screen'); await pc.click('#listOut tbody tr'); await pc.waitForSelector('#cardName'); const txt = await pc.evaluate(() => document.querySelector('main').innerText);
      assert.ok(!txt.includes('SECRET-ADMIN-NOTE')); assert.ok(!(await pc.$('#btnEdit')) && !(await pc.$('#btnCancel'))); assert.deepStrictEqual(pc.errs, []); });
    // ---------- 6. one-time soldier form page ----------
    const pf = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage(); const ferrs = []; pf.on('pageerror', e => ferrs.push(e.message));
    await t('SMOKE form page: a bad token gives one generic message and no fields', async () => { await pf.goto(base + '/?form=short'); await pf.waitForFunction(() => /אינו תקף/.test(document.body.textContent)); assert.ok(!(await pf.$('#f_full_name'))); });
    await t('SMOKE form page: a valid token shows ONLY the whitelisted fields (no personal number / gender / scores), fits the phone, and a submit creates a PENDING request without touching the soldier; the token is single-use', async () => {
      await pf.goto(base + '/?form=' + link.token); await pf.waitForSelector('#f_full_name'); const ids = await pf.$$eval('input', is => is.map(i => i.id)); assert.deepStrictEqual(ids.sort(), ['f_emergency_contact_name', 'f_emergency_contact_phone', 'f_emergency_contact_relation', 'f_enlistment_date', 'f_full_name', 'f_pakal']);   /* dev6.2: + 3 emergency-contact inputs, never prefilled */ assert.ok(await NOHORIZ(pf));
      const before = X.Db.get('Soldiers', s1.id).full_name; await pf.fill('#f_full_name', 'שם דמה חדש'); await pf.click('#send'); await pf.waitForFunction(() => /נשל/.test(document.body.textContent)); assert.strictEqual(X.Db.get('Soldiers', s1.id).full_name, before);
      const rq = X.Db.all('SoldierUpdateRequests'); assert.strictEqual(rq.length, 1); assert.strictEqual(rq[0].status, 'pending'); await pf.goto(base + '/?form=' + link.token); await pf.waitForFunction(() => /אינו תקף/.test(document.body.textContent)); assert.deepStrictEqual(ferrs, []); });
    await t('SMOKE final: no page errors in ANY session (admin, commander, desktop, phone)', async () => { [pa, pc, pm, pmc].forEach(p => assert.deepStrictEqual(p.errs, [])); });
  } finally { await browser.close(); server.close(); }
  console.log('\nUI STAGING SMOKE TOTAL pass=' + pass + ' fail=' + fail); if (fail) process.exit(1);
})();
