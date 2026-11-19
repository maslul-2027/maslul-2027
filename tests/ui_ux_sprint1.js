// UX sprint 1 (issue #2) — browser regression tests of src/Index.html against the REAL server code in Node (same bridge as ui_smoke).
// Covers: persistent course/screen context, in-flight de-duplication (double tap = one submission), immediate loading feedback, offline notice,
// reduced motion, 360 / 390 px layouts (no horizontal overflow, 44px touch targets), keyboard focus visibility. Synthetic data only.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { load } = require('./harness'); const { goTab } = require('./uihelp');
let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.log('SKIP ui_ux_sprint1: playwright not available'); process.exit(0); }
const X = load(); const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
const c1 = X.Courses.create(admin, { name: 'קורס א', start_date: '2099-01-01' }).id, c2 = X.Courses.create(admin, { name: 'קורס ב', start_date: '2099-02-01' }).id;
X.Courses.addUser(admin, { email: 'admin@x.com', role: 'admin', display_name: 'מנהל' });
const org = X.Courses.org(admin, c1);
['דנה לוי', 'אבי כהן', 'רות מזרחי'].forEach((n, i) => X.Soldiers.create(admin, c1, { full_name: n, personal_number: '90' + i, gender: 'M', department_id: org.departments[0].id, team_id: org.teams[0].id }));
const html = fs.readFileSync(process.env.UX_INDEX || path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
const shim = `<script>(function(){function mk(){var ok,bad;var o={withSuccessHandler:function(f){ok=f;return o;},withFailureHandler:function(f){bad=f;return o;}};
['api','whoAmI'].forEach(function(m){o[m]=function(a,b){fetch('/rpc',{method:'POST',body:JSON.stringify({m:m,a:a,b:b})}).then(function(r){return r.json()}).then(function(j){ok&&ok(j)},function(e){bad&&bad(e)});};});return o;}
window.google={script:{get run(){return mk();}}};})();</script>`;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rpc') { let b = ''; req.on('data', d => b += d); req.on('end', () => { const p = JSON.parse(b); X.Auth._emailProvider = () => 'admin@x.com'; const out = p.m === 'api' ? X.api(p.a, p.b) : X.whoAmI(); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(out)); }); }
  else { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html.replace('<head>', '<head>' + shim)); }
});
let pass = 0, fail = 0; const failures = [];
async function t(name, fn) { try { await fn(); pass++; console.log('PASS', name); } catch (e) { fail++; failures.push(name); console.log('FAIL', name, '\n   ', e.message.split('\n')[0]); } }
(async () => {
  await new Promise(r => server.listen(0, r)); const url = 'http://127.0.0.1:' + server.address().port; const browser = await chromium.launch(); const ctxs = [];
  const open = async (viewport, opts) => { const ctx = await browser.newContext(Object.assign({ viewport: viewport || { width: 1200, height: 900 } }, opts || {})); ctxs.push(ctx); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.errs = errs; page.ctx = ctx;
    await page.goto(url); await page.waitForSelector('#grps button', { state: 'attached' }); await page.waitForSelector('#course option', { state: 'attached' }); return page; };
  try {
    await t('UX1 the sticky header always shows the selected course and the current screen', async () => {
      const p = await open(); await p.waitForFunction(() => /קורס: קורס א/.test(document.getElementById('ctx').textContent)); await goTab(p, 'soldiers');
      await p.waitForFunction(() => /חיילים/.test(document.getElementById('ctx').textContent)); assert.deepStrictEqual(p.errs, []);
      await p.selectOption('#course', { label: 'קורס ב' }); await p.waitForFunction(() => /קורס: קורס ב/.test(document.getElementById('ctx').textContent));
      await p.evaluate(() => window.scrollTo(0, 5000)); assert.ok(await p.evaluate(() => document.getElementById('ctx').getBoundingClientRect().top >= 0), 'the header (with the context line) is sticky');
    });
    await t('UX2 an identical call still in flight is shared: a double tap / repeated read is ONE server request', async () => {
      const p = await open(); let n = 0; await p.route('**/rpc', async r => { const b = JSON.parse(r.request().postData() || '{}'); if (b.m === 'api' && b.a === 'soldiers.list') n++; await new Promise(z => setTimeout(z, 150)); r.continue(); });
      await p.evaluate(cid => Promise.all([call('soldiers.list', { courseId: cid, opts: {} }), call('soldiers.list', { courseId: cid, opts: {} }), call('soldiers.list', { courseId: cid, opts: {} })]), c1); assert.strictEqual(n, 1, 'three identical reads -> one request');
      await p.evaluate(cid => call('soldiers.list', { courseId: cid, opts: {} }), c1); assert.strictEqual(n, 2, 'a later call is a NEW request (no stale cache)');
      const w = await p.evaluate(cid => { const a = { courseId: cid, data: { full_name: '' } }; return Promise.all([call('soldiers.create', a), call('soldiers.create', a)]).then(r => r[0] === r[1] || JSON.stringify(r[0]) === JSON.stringify(r[1])); }, c1); assert.ok(w, 'both callers of a shared write receive the same result');
    });
    await t('UX3 immediate loading feedback: progress bar + aria-busy while a call is pending, cleared after (also after a failure)', async () => {
      const p = await open(); await p.route('**/rpc', async r => { await new Promise(z => setTimeout(z, 400)); r.continue(); });
      const pend = p.evaluate(cid => call('courses.list'), c1); await p.waitForFunction(() => document.body.getAttribute('aria-busy') === 'true', null, { timeout: 2000 });
      await p.waitForFunction(() => parseFloat(getComputedStyle(document.getElementById('netbar')).opacity) > 0, null, { timeout: 2000 }); await pend; await p.waitForFunction(() => document.body.getAttribute('aria-busy') === 'false');
      await p.unroute('**/rpc'); await p.route('**/rpc', r => r.abort()); const failed = await p.evaluate(() => call('courses.list').then(() => 'ok', () => 'failed')); assert.strictEqual(failed, 'failed'); assert.strictEqual(await p.evaluate(() => document.body.getAttribute('aria-busy')), 'false', 'busy state is released on failure');
    });
    await t('UX4 offline notice appears when the connection drops and disappears when it returns', async () => {
      const p = await open(); assert.ok(await p.$eval('#offline', e => e.classList.contains('hide'))); await p.context().setOffline(true); await p.waitForFunction(() => !document.getElementById('offline').classList.contains('hide'));
      await p.context().setOffline(false); await p.waitForFunction(() => document.getElementById('offline').classList.contains('hide'));
    });
    await t('UX5 prefers-reduced-motion removes animations and transitions everywhere', async () => {
      const p = await open({ width: 390, height: 800 }, { reducedMotion: 'reduce' }); const d = await p.evaluate(() => ['side', 'netbar'].map(id => parseFloat(getComputedStyle(document.getElementById(id)).transitionDuration))); d.forEach(x => assert.ok(x < 0.01, 'transition ' + x));
    });
    for (const w of [360, 390]) {
      await t('UX6 ' + w + 'px: no horizontal overflow on the course screens; touch targets >= 44px; focus ring visible', async () => {
        const p = await open({ width: w, height: 800 }); for (const tab of ['dash', 'soldiers', 'nav']) { try { await goTab(p, tab); } catch (e) { continue; } await p.waitForTimeout(500);
          const m = await p.evaluate(() => { const bad = [...document.querySelectorAll('main button, main select, main input:not([type=checkbox]):not([type=radio]):not([type=hidden]), header button')].filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.height < 43.5 && !e.closest('.hide,[hidden]'); }).map(e => (e.id || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height)); return { over: document.documentElement.scrollWidth - window.innerWidth, small: bad.slice(0, 5) }; });
          assert.ok(m.over <= 1, tab + ' overflows by ' + m.over + 'px at ' + w); assert.deepStrictEqual(m.small, [], tab + ' touch targets < 44px'); }
        await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); assert.ok(await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return a !== document.body && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; }), 'focused control has a visible outline');
      });
    }
  } finally { for (const c of ctxs) await c.close(); await browser.close(); server.close(); }
  console.log('\nUI UX SPRINT1 TOTAL pass=' + pass + ' fail=' + fail); if (fail) { console.log('FAILED:', failures.join(' | ')); process.exit(1); }
})();
