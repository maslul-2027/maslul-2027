// Design parity evidence: screenshots of the ORIGINAL PR #10 shell (golden master, commit a2f70692) and the NEW native app at 320/360/390/414 px.
// Usage: node scripts/native_screenshots.js <golden.html> <native-dir> <out-dir>
const http = require('http'), fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const [golden, dir0, out] = process.argv.slice(2); const dir = path.resolve(dir0); fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; if (u === '/__golden.html') { r.setHeader('content-type', MIME['.html']); return r.end(fs.readFileSync(golden)); } const f = path.join(dir, u === '/' ? 'index.html' : u); if (!f.startsWith(path.resolve(dir)) || !fs.existsSync(f)) { r.statusCode = 404; return r.end('x'); } r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); });
(async () => { await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port, b = await chromium.launch();
  for (const w of [320, 360, 390, 414]) { const ctx = await b.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 });
    let p = await ctx.newPage(); await p.goto(base + '/__golden.html'); await p.screenshot({ path: path.join(out, `original-${w}-home.png`) }); await p.click('[data-go=soldiers]'); await p.screenshot({ path: path.join(out, `original-${w}-soldiers.png`) });
    p = await ctx.newPage(); await p.goto(base + '/'); await p.waitForSelector('#k1:not(:empty)'); await p.waitForFunction(() => !/…/.test(document.getElementById('k3').textContent)); await p.screenshot({ path: path.join(out, `native-${w}-home.png`) });
    await p.click('[data-go=soldiers]'); await p.waitForSelector('#people .card'); await p.screenshot({ path: path.join(out, `native-${w}-soldiers.png`) });
    await p.click('#people .card'); await p.waitForSelector('dl.kv'); await p.screenshot({ path: path.join(out, `native-${w}-card.png`) });
    await p.click('[data-go=tasks]'); await p.waitForSelector('.seg'); await p.screenshot({ path: path.join(out, `native-${w}-tasks.png`) });
    await p.click('[data-go=more]'); await p.waitForSelector('#refresh-app'); await p.screenshot({ path: path.join(out, `native-${w}-more.png`) }); await ctx.close(); }
  await b.close(); srv.close(); console.log('screenshots →', out); })();
