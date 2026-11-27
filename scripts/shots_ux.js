'use strict';
// Synthetic-data screenshots of the four tabs + soldier card + reports + one entry flow at NATIVE 390x844 (and 320). usage: node scripts/shots_ux.js <dir> <outdir>
const http = require('http'), fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const dir = path.resolve(process.argv[2] || 'preview'), out = path.resolve(process.argv[3] || 'shots'); fs.mkdirSync(out, { recursive: true }); const M = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0], f = path.join(dir, u === '/' ? 'index.html' : u); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(''); } r.setHeader('content-type', M[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); });
(async () => { await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port, b = await chromium.launch(), errs = [];
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }), p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(base + '/'); await p.waitForSelector('#k1'); await p.waitForTimeout(500);
  const shot = async (name, full) => { await p.waitForTimeout(450); await p.screenshot({ path: path.join(out, name + '.png'), fullPage: !!full }); };
  const go = async h => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(400); };
  await shot('01_home'); await go('#/soldiers'); await shot('02_soldiers'); await go('#/entry'); await shot('03_entry'); await go('#/more'); await shot('04_more');
  await go('#/soldiers'); const first = await p.evaluate(() => { const a = document.querySelector('[data-soldier],.srow,.card[role=button],button.card'); return a ? 1 : 0; }); void first;
  const sid = await p.evaluate(async () => { const r = await window.__app.api('soldiers.list', { courseId: window.__app.state.course.id, opts: {} }); return r.data[0].id; }); await go('#/soldier/' + sid); await shot('05_soldier_card'); await shot('05b_soldier_card_full', true);
  await go('#/insight'); await shot('06_insight_hub'); await go('#/insight/shoot'); await p.waitForSelector('#shK1'); await shot('07_shooting_report'); await shot('07b_shooting_full', true);
  await go('#/insight/course'); await shot('08_course_dashboard', true);
  const q = await b.newContext({ viewport: { width: 320, height: 640 } }), p2 = await q.newPage(); await p2.goto(base + '/'); await p2.waitForSelector('#k1'); await p2.waitForTimeout(500); await p2.screenshot({ path: path.join(out, '09_home_320.png') });
  console.log('shots in', out, 'errors', errs.length); await b.close(); srv.close(); })();
