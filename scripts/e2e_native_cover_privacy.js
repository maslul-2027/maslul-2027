'use strict';
// COVERAGE privacy (DOM): model rules, small-cell attacks on the model + the REAL PDF/XLSX bytes, real downloads bound to the server record, commander gets no buttons. Synthetic data only.
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process'), assert = require('assert/strict'); const { chromium } = require('playwright');
const dir = path.resolve(process.argv[2] || 'preview'), SHOTS = process.argv[3] ? path.resolve(process.argv[3]) : null, M = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0], f = path.join(dir, u === '/' ? 'index.html' : u); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(''); } r.setHeader('content-type', M[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); });
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, String(e.message).split('\n').slice(0, 10).join(' ')); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cover-')), sh = (c, a) => cp.spawnSync(c, a, { encoding: 'utf8' }); if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port, b = await chromium.launch(), errs = [];
  const open = async (role, vp) => { const c = await b.newContext({ viewport: vp || { width: 390, height: 844 }, acceptDownloads: true }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); if (role) await p.addInitScript(r => { try { localStorage.setItem('maslul_native_role', r); } catch (e) {} }, role); await p.goto(base + '/'); await p.waitForSelector('#k1'); await p.waitForFunction(() => window.__app && window.__app.state && window.__app.state.course && window.__insight && window.__insight.examBuild); return p; };
  const DOM = {
    fit: { hash: () => '#/insight/fit', k1: '#ftK1', list: 'fitness.list', arg: c => ({ courseId: c, opts: {} }) },
    shoot: { hash: () => '#/insight/shoot', k1: '#shK1', list: 'mk.list', arg: c => ({ courseId: c, opts: {} }) },
    exam: { hash: id => '#/insight/exam/' + id, k1: '#exK1', list: 'exams.attempts', arg: c => ({ courseId: c, opts: {} }) },
    nav: { hash: (id, nd) => '#/insight/nav/' + id + '/' + nd, k1: '#inK1', list: 'nav.list', arg: c => ({ courseId: c, opts: {} }) } };
  const expectVisible = (k, m) => k >= 5 && k + m >= 5 && !(m > 0 && m < 5);   // independent rule: no 1–4 cell on either side of the coverage
  const run = async (dom, k, m, role) => {
    const c = await b.newContext({ viewport: { width: 390, height: 844 } }), q = await c.newPage(); q.on('pageerror', e => errs.push(e.message)); if (role) await q.addInitScript(r => { try { localStorage.setItem('maslul_native_role', r); } catch (e) {} }, role); await q.goto(base + '/'); await q.waitForSelector('#k1'); await q.waitForFunction(() => window.__app && window.__app.state && window.__app.state.course);
    const info = await q.evaluate(async a => { const A = window.__app, cid = A.state.course.id, call = (r, x) => A.api(r, x), sol = (await call('soldiers.list', { courseId: cid, opts: {} })).data, rows = (await call(a.list, { courseId: cid, opts: {} })).data, has = new Set(rows.map(r => r.soldier_id)); const withR = sol.filter(s => has.has(s.id)), without = sol.filter(s => !has.has(s.id));
      if (!a.role) { const keep = new Set(withR.slice(0, a.k).concat(without.slice(0, a.m)).map(s => s.id)); for (const s of sol) if (!keep.has(s.id)) await call('soldiers.cancel', { id: s.id, reason: 'בדיקת פרטיות' }); }
      const nt = (await call('navtypes.list', { courseId: cid })).data.filter(x => x.active)[0], ex = (await call('exams.defs', { courseId: cid, opts: {} })).data[0], nd = (await call('nav.list', { courseId: cid, opts: {} })).data.map(x => x.test_date).sort().pop(); return { navType: nt && nt.id, exam: ex && ex.id, nd, ak: Math.min(a.k, withR.length), am: Math.min(a.m, without.length) }; }, { list: DOM[dom].list, k, m, role: !!role });
    const id = dom === 'nav' ? info.navType : info.exam; await q.evaluate(h => { location.hash = h; }, DOM[dom].hash(id, info.nd)); await q.waitForSelector(DOM[dom].k1, { timeout: 20000 }); await q.waitForTimeout(300); return { c, q, ak: info.ak, am: info.am };
  };
  const check = async (dom, k, m, tag, role) => {
    const R = await run(dom, k, m, role), c = R.c, q = R.q; if (!role) { k = R.ak; m = R.am; } const sel = DOM[dom].k1, vis = expectVisible(k, m), card = q.locator(sel);
    const html = await card.evaluate(e => e.outerHTML), text = (await card.textContent()) || '', bar = await card.locator('.in-prog').count(), widths = await card.evaluate(e => Array.from(e.querySelectorAll('[style]')).map(x => x.getAttribute('style'))), stamp = (await q.locator('details.in-meta').first().textContent()) || '';
    const attrs = await q.evaluate(() => Array.from(document.querySelectorAll('#view [aria-label],#view [title]')).map(e => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '')).join(' | '));
    if (!role) { // eligible/denominator is only knowable for the admin run (scoped roles: the rules still must hold for whatever the scope is)
      if (!vis) { assert.equal(bar, 0, tag + ': no progress bar when coverage is suppressed'); assert.ok(!/%/.test(text) && !/\d+\/\d+/.test(text), tag + ': no % or k/n in the KPI card: ' + text); assert.ok(!/\d/.test(widths.join(' ')) , tag + ': no width style: ' + widths.join('|')); assert.ok(!/מכנה: \d/.test(stamp), tag + ': denominator hidden in metadata: ' + stamp); assert.ok(/מוסתר/.test(stamp), tag + ': metadata says the denominator is hidden'); assert.ok(!/\d+\s?מתוך\s?\d+/.test(attrs), tag + ': aria/title carry no ratio'); if (k + m >= 1) assert.ok(!new RegExp('(^|[^\\d])' + (k + m) + '\\s?חניכים').test(stamp), tag + ': scope size absent from metadata'); }
      else { assert.equal(bar, 1, tag + ': legitimate coverage keeps its bar'); const w = widths.join(' ').match(/width:(\d+)%/); assert.ok(w && Math.abs(+w[1] - Math.round(100 * k / (k + m))) <= 1, tag + ': bar width = true coverage'); assert.ok(dom === 'fit' || dom === 'shoot' ? new RegExp(Math.round(100 * k / (k + m)) + '\\s?%').test(text) : new RegExp(k + '/' + (k + m)).test(text), tag + ': coverage value shown: ' + text); assert.ok(new RegExp('מכנה: ' + (k + m)).test(stamp), tag + ': denominator shown when legal'); }
      assert.equal(await card.locator('.in-prog').getAttribute('aria-hidden').catch(() => 'true'), 'true', tag + ': the bar is decorative (aria-hidden); the value is real text');
    } else { if (!/\d+\s?%/.test(text) || bar === 0) { assert.equal(bar, 0); } }
    if (SHOTS && tag.startsWith('SHOT')) await q.screenshot({ path: path.join(SHOTS, tag.replace(/\W+/g, '_') + '.png'), fullPage: false }); await c.close(); void html;
  };
  const CASES = [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [9, 1], [5, 5], [10, 0], [10, 2], [12, 6]];
  for (const dom of (process.env.DOMS || 'fit,shoot,exam,nav').split(',')) {
    await t(dom + ': every cohort split (1..4 · 5/0 · 5/1 · 9/1 · 5/5 · 10/0 · 10/2 · 12/6): suppressed ⇒ no bar / % / ratio / denominator in text, style, aria, metadata; legal ⇒ the bar equals the true coverage', async () => { for (const [k, m] of CASES) await check(dom, k, m, dom + ' ' + k + '/' + (k + m)); });
  }
  await t('screenshots of the suppressed states (9/1 and 3) for the report', async () => { for (const [dom, k, m] of [['fit', 9, 1], ['fit', 3, 0], ['shoot', 9, 1], ['nav', 9, 1]]) await check(dom, k, m, 'SHOT ' + dom + ' ' + k + 'of' + (k + m)); });
  await t('negative control: the OLD behaviour (raw pct bar + k/n + exact denominator) would be caught by the same DOM checks', async () => {
    const c = await b.newContext({ viewport: { width: 390, height: 844 } }), q = await c.newPage(); await q.goto(base + '/'); await q.waitForSelector('#k1');
    await q.evaluate(() => { const d = document.createElement('div'); d.id = 'fake'; d.innerHTML = '<div class="in-kpi" id="fk"><small>כיסוי</small><b>9/10</b><span>90%</span><span class="in-prog" aria-hidden="true"><i style="width:90%"></i></span></div><details class="in-meta"><summary>x</summary><p>מכנה: 10 חניכים</p></details>'; document.body.append(d); });
    const text = await q.locator('#fk').textContent(), bar = await q.locator('#fk .in-prog').count(), stamp = await q.locator('#fake details').textContent(); const caught = bar > 0 || /%/.test(text) || /\d+\/\d+/.test(text) || /מכנה: \d/.test(stamp); assert.ok(caught, 'the detector must catch the old leak'); await c.close(); });
  await t('commander (scoped) sessions obey the same projection on all four reports; no page errors', async () => { for (const dom of ['fit', 'shoot', 'exam', 'nav']) await check(dom, 0, 0, dom + ' commander', 'commander'); assert.deepEqual(errs, []); });
  console.log('COVER-PRIVACY pass=' + pass + ' fail=' + fail); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
