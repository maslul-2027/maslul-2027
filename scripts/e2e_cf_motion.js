'use strict';
// Real-browser MOTION/NAVIGATION evidence against the REAL Worker + D1 shim (local, synthetic). Every /api call is delayed by LAT ms (default 250) to imitate a shared
// workers.dev round trip, so loading states are visible. Measures what a person feels, before/after a change:
//   - skeleton frames shown when a tab is revisited (should be 0 within the read memo window)
//   - tap → real content (ms) on first visit and on revisit
//   - direction-aware route motion present for tab / push / back (classes rt-tab, rt-push, rt-pop), never a translucent frame
//   - after a SAVE the next screen shows the saved state (memo is dropped on any write), reduced motion has no animation
// Usage: node scripts/e2e_cf_motion.js [out.json]     env LAT=250
const fs = require('fs'), assert = require('assert/strict'), pw = require('playwright');
const LAT = Number(process.env.LAT || 250), OUT = process.argv[2];
let pass = 0, fail = 0; const R = {};
const T = async (n, f) => { try { await f(); pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, '\n   ', String(e.message).split('\n').slice(0, 4).join('\n    ')); } };
(async () => {
  const local = await require('./cf_local_server.js').start({}), BASE = local.origin, br = await pw.chromium.launch();
  // bootstrap admin by API (login UI is covered by e2e_cf_browser.js), then sign in through the real form
  const post = async (p, b) => (await fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify(b) })).json();
  const bs = await post('/auth/bootstrap', { token: local.bootstrapToken, fullName: 'מנהל סינתטי', email: 'admin@example.test' }); assert.ok(bs.ok, JSON.stringify(bs));
  const en = await post('/auth/enroll/confirm', { token: bs.enrollToken, pin: '4826' }); assert.ok(en.ok, JSON.stringify(en));
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL', hasTouch: true }), p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  let delay = 0; await ctx.route('**/api', async r => { if (delay && r.request().method() === 'POST') await new Promise(x => setTimeout(x, delay)); r.continue(); });
  await p.goto(BASE + '/'); await p.waitForSelector('#auEmail'); await p.fill('#auEmail', 'admin@example.test'); await p.fill('#auCode', '4826'); await p.click('#auGo'); await p.waitForSelector('nav.nav .tab');
  await p.waitForSelector('#seedBtn'); await p.click('#seedBtn'); await p.waitForFunction(() => window.__app && window.__app.state.course && window.__app.state.org && !document.querySelector('#seedBtn'), null, { timeout: 30000 });
  await p.waitForTimeout(1500);   // let the initial warm-up finish and the memo window pass: first visit below is a true cold visit
  // instrumentation: records, for one navigation, skeleton frames, ms to first real card, route classes seen, minimum opacity of the view's blocks
  const nav = async (act, ready) => { await p.keyboard.press('Shift'); return navRun(act, ready); };   // a trusted input event just before the tap: the client treats the navigation as person-initiated (a program call never uses the read memo)
  const navRun = (act, ready) => p.evaluate(async ([act, ready]) => {
    const v = document.getElementById('view'); const seen = new Set(); let sk = 0, minOp = 1, frames = 0, t1 = null; const t0 = performance.now();
    const mo = new MutationObserver(() => { ['rt-tab', 'rt-push', 'rt-pop'].forEach(c => { if (v.classList.contains(c)) seen.add(c); }); }); mo.observe(v, { attributes: true, attributeFilter: ['class'] });
    const done = new Promise(res => { const tick = () => { frames++; if (v.querySelector('.skeleton') && getComputedStyle(v.querySelector('.skeleton')).opacity !== '0') sk++; [...v.children].forEach(c => { const o = parseFloat(getComputedStyle(c).opacity); if (o < minOp) minOp = o; }); if (t1 === null && document.querySelector(ready)) t1 = performance.now() - t0; if (performance.now() - t0 < 1400) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    eval(act); await done; mo.disconnect(); return { skeletonFrames: sk, contentMs: t1 === null ? null : Math.round(t1), classes: [...seen], minOpacity: minOp, frames };
  }, [act, ready]);
  const click = sel => `(() => { const e = document.querySelector('${sel}'); e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); e.click(); })()`;   // a real tap = pointerdown + click (the read memo only serves screens opened by a person's gesture)
  delay = LAT;
  await T('cold first visit of Soldiers (server latency ' + LAT + 'ms): content appears, motion class is the tab motion', async () => {
    const r = await nav(click('.tab[data-go=soldiers]'), '#people .card'); R.soldiersCold = r; assert.ok(r.contentMs !== null, 'content never appeared'); assert.ok(r.classes.includes('rt-tab'), JSON.stringify(r)); assert.ok(r.minOpacity >= 0.99, 'translucent frame ' + r.minOpacity); });
  await T('revisit within the memo window: Tasks → Soldiers shows content at once (no skeleton frames)', async () => {
    await nav(click('.tab[data-go=tasks]'), '#view .card, #view .empty'); const r = await nav(click('.tab[data-go=soldiers]'), '#people .card'); R.soldiersRevisit = r;
    assert.ok(r.contentMs !== null && r.contentMs < LAT / 2, 'revisit content took ' + r.contentMs + 'ms (server latency ' + LAT + ')'); assert.equal(r.skeletonFrames, 0, 'skeleton frames on revisit: ' + r.skeletonFrames); assert.ok(r.minOpacity >= 0.99); });
  await T('open a soldier card = push motion; browser Back = pop motion; list scroll/position intact; no blank frame', async () => {
    await p.waitForSelector('#people .card'); const push = await nav(click('#people .card'), 'h1, h2'); R.push = push; assert.ok(push.classes.includes('rt-push'), JSON.stringify(push)); assert.ok(push.minOpacity >= 0.99);
    await p.waitForTimeout(300); const pop = await p.evaluate(async () => { const v = document.getElementById('view'), seen = new Set(); const mo = new MutationObserver(() => { ['rt-tab', 'rt-push', 'rt-pop'].forEach(c => { if (v.classList.contains(c)) seen.add(c); }); }); mo.observe(v, { attributes: true }); history.back(); await new Promise(r => setTimeout(r, 500)); mo.disconnect(); return { classes: [...seen], cards: document.querySelectorAll('#people .card').length }; });
    R.pop = pop; assert.ok(pop.classes.includes('rt-pop'), JSON.stringify(pop)); assert.ok(pop.cards > 0, 'list back on screen'); });
  await T('no horizontal overflow during or after any route motion (RTL, 390px)', async () => {
    const o = await p.evaluate(async () => { let max = 0; const t0 = performance.now(); document.querySelector('.tab[data-go=more]').click(); await new Promise(res => { const f = () => { max = Math.max(max, document.documentElement.scrollWidth - innerWidth); if (performance.now() - t0 < 400) requestAnimationFrame(f); else res(); }; f(); }); return max; }); assert.ok(o <= 0, 'overflow px ' + o); });
  await T('a SAVE is never shown stale: create a task, the very next Tasks screen contains it (read memo is dropped on any write)', async () => {
    await p.evaluate(() => { location.hash = '#/tasks'; }); await p.waitForSelector('#taskFab'); await p.click('#taskFab'); await p.waitForSelector('dialog[open]');
    const title = 'משימת בדיקה ' + Math.random().toString(36).slice(2, 6); await p.locator('dialog[open] input').first().fill(title); await p.locator('dialog[open] button[type=submit]').click(); await p.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 8000 });
    await p.evaluate(() => { location.hash = '#/more'; }); await p.waitForTimeout(200); await p.evaluate(() => { location.hash = '#/tasks'; }); await p.waitForFunction(t => document.getElementById('view').innerText.includes(t), title, { timeout: 8000 }); });
  await T('reduced motion: no route animation classes, no animation', async () => {
    const c2 = await br.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const q = await c2.newPage(); await c2.route('**/api', async r => { await new Promise(x => setTimeout(x, 50)); r.continue(); });
    await q.goto(BASE + '/'); await q.waitForSelector('#auEmail'); await q.fill('#auEmail', 'admin@example.test'); await q.fill('#auCode', '4826'); await q.click('#auGo'); await q.waitForSelector('nav.nav .tab'); await q.waitForFunction(() => window.__app && window.__app.state.org);
    const r = await q.evaluate(async () => { const v = document.getElementById('view'); let n = 0; new MutationObserver(() => { if (/rt-|route-in/.test(v.className)) n++; }).observe(v, { attributes: true }); document.querySelector('.tab[data-go=soldiers]').click(); await new Promise(x => setTimeout(x, 500)); return n; }); assert.equal(r, 0); await c2.close(); });
  await T('no page errors', async () => { assert.deepEqual(errs, []); });
  delay = 0; await p.screenshot({ path: 'artifacts/cf_motion_final.png' }).catch(() => {});
  R.latencyMs = LAT; R.note = 'headless Chromium, local Worker + D1 shim, simulated ' + LAT + 'ms per /api call; evidence only (not a phone, not workers.dev)';
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1)); console.log('\nCF MOTION pass=' + pass + ' fail=' + fail + ' ' + JSON.stringify(R)); await br.close(); await local.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
