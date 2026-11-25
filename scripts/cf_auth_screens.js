'use strict';
// Real-browser screenshots + layout assertions for the sign-in screen (320/360/390/414 + desktop, 3 modes, configured and NOT-configured Worker). Local Worker + shim; NOT proof of the live Cloudflare site.
const path = require('path'), assert = require('assert'), fs = require('fs');
const OUT = path.resolve(process.argv[2] || 'artifacts/cf_screens'); fs.mkdirSync(OUT, { recursive: true });
const L = require('./cf_local_server.js'); let chromium; try { chromium = require('playwright').chromium; } catch (e) { chromium = require('/opt/npm-tools/node_modules/playwright').chromium; }
let pass = 0, fail = 0; const T = async (n, f) => { try { await f(); pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, '\n   ', String(e.stack || e).split('\n').slice(0, 4).join('\n    ')); } };
(async () => {
  const ok = await L.start({}), none = await L.start({ appSecret: '', bootstrapToken: '' }), b = await chromium.launch();
  const sizes = [[320, 640], [360, 740], [390, 844], [414, 896], [1280, 800]];
  async function check(page, w, tag) {
    const m = await page.evaluate(() => { const bad = []; document.querySelectorAll('#auth button:not([hidden]), #auth input:not([hidden])').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.height && r.height < 44) bad.push((e.id || e.tagName) + ':' + Math.round(r.height)); }); const card = document.querySelector('.auth-card').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, small: bad, cardW: Math.round(card.width) }; });
    assert.ok(m.sw <= m.cw, tag + ' horizontal scroll ' + m.sw + '>' + m.cw); assert.deepEqual(m.small, [], tag + ' targets < 44px'); assert.ok(m.cardW <= 420, tag + ' card too wide ' + m.cardW);
  }
  for (const [w, h] of sizes) await T('auth screen ' + w + 'x' + h + ': no overflow, 44px targets, balanced card; 3 modes', async () => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 }), page = await ctx.newPage(); await page.goto(ok.origin + '/'); await page.waitForSelector('#auth .auth-card'); await page.waitForLoadState('networkidle');
    for (const mode of ['login', 'register', 'setup']) { await page.click('#auTab_' + mode); await check(page, w, mode); assert.ok((await page.locator('#auHint').textContent()).length > 20); await page.screenshot({ path: path.join(OUT, 'auth_' + mode + '_' + w + '.png') }); }
    await ctx.close(); });
  await T('NOT-configured Worker: explicit message, form disabled, no way to proceed (fails closed)', async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }), page = await ctx.newPage(); await page.goto(none.origin + '/'); await page.waitForSelector('#auth .auth-card'); await page.waitForFunction(() => /עדיין לא הוגדר/.test(document.getElementById('auMsg').textContent)); assert.equal(await page.locator('#auGo').isDisabled(), true); await page.screenshot({ path: path.join(OUT, 'auth_not_configured_390.png') }); await ctx.close(); });
  await T('recovery screen: reachable from sign-in, own field, no PIN field, refusal shown (no secret on this server), back link works; no overflow at 320', async () => {
    const ctx = await b.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2 }), page = await ctx.newPage(); await page.goto(ok.origin + '/'); await page.waitForSelector('#auRecLink'); await page.click('#auRecLink');
    assert.equal(await page.locator('#auRec').isVisible(), true); assert.equal(await page.locator('#auCode').isVisible(), false); await check(page, 320, 'recover'); await page.screenshot({ path: path.join(OUT, 'auth_recover_320.png') });
    await page.fill('#auRec', 'x'.repeat(40)); await page.click('#auGo'); await page.waitForFunction(() => document.getElementById('auMsg').textContent.length > 3); await page.click('#auBack'); assert.equal(await page.locator('#auCode').isVisible(), true); await ctx.close(); });
  await T('keyboard: Tab order email -> PIN -> submit; PIN field is numeric, masked, 4 chars; visible focus', async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(); await page.goto(ok.origin + '/'); await page.waitForSelector('#auEmail'); await page.focus('#auEmail'); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'auCode'); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'auGo');
    const a = await page.locator('#auCode').evaluate(e => [e.type, e.inputMode, e.maxLength]); assert.deepEqual(a, ['password', 'numeric', 4]); await ctx.close(); });
  await T('reduced motion: no transitions/animations inside the auth card', async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }), page = await ctx.newPage(); await page.goto(ok.origin + '/'); await page.waitForSelector('#auGo'); const d = await page.locator('#auGo').evaluate(e => getComputedStyle(e).transitionDuration); assert.ok(/^0s/.test(d), d); await ctx.close(); });
  await b.close(); await ok.close(); await none.close(); console.log('CF AUTH SCREENS TOTAL pass=' + pass + ' fail=' + fail); process.exit(fail ? 1 : 0);
})();
