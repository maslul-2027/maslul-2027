'use strict';
// LOCAL-ONLY host for the Cloudflare Worker: node:http on 127.0.0.1 -> the REAL Worker fetch handler, D1 = node:sqlite shim, static app from cloudflare/free-shared-test/public.
// Used by the local browser E2E (scripts/e2e_cf_browser.js) so the UI can be exercised without an account. NEVER listens on a non-loopback address. Synthetic data only.
// Usage: node scripts/cf_local_server.js [--port 8788]
const http = require('http'), fs = require('fs'), path = require('path'), { pathToFileURL } = require('url'), { D1 } = require('../tests/lib/d1_shim.js');
const PUB = path.join(__dirname, '..', 'cloudflare', 'free-shared-test', 'public'), SRC = path.join(__dirname, '..', 'cloudflare', 'free-shared-test', 'src'), MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
async function start(o) {
  o = o || {}; const W = (await import(pathToFileURL(path.join(SRC, 'worker.js')).href)).default, db = new D1(o.db), port = Number(o.port || 0), BOOT = o.bootstrapToken || 'local-bootstrap-token-0123456789';
  const ASSETS = { async fetch(req) { let p = new URL(req.url).pathname; if (p === '/') p = '/index.html'; const f = path.join(PUB, path.normalize(p).replace(/^(\.\.[/\\])+/, '')); if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response('not found', { status: 404 }); return new Response(fs.readFileSync(f), { status: 200, headers: { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' } }); } };
  const env = { DB: db, ASSETS, APP_SECRET: o.appSecret || 'local-app-secret-0123456789abcdef0123456789abcdef', BOOTSTRAP_TOKEN: BOOT, ALLOW_LOCAL_HTTP: '1' };
  const server = http.createServer((rq, rs) => { const ch = []; rq.on('data', c => ch.push(c)); rq.on('end', async () => { try {
    const body = Buffer.concat(ch), url = 'http://127.0.0.1:' + server.address().port + rq.url, r = await W.fetch(new Request(url, { method: rq.method, headers: rq.headers, body: ['GET', 'HEAD'].includes(rq.method) ? undefined : body }), env);
    const h = {}; r.headers.forEach((v, k) => { if (k !== 'set-cookie') h[k] = v; }); const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : []; if (sc.length) h['set-cookie'] = sc; rs.writeHead(r.status, h); rs.end(Buffer.from(await r.arrayBuffer())); } catch (e) { rs.statusCode = 500; rs.end('error'); } }); });
  await new Promise(r => server.listen(port, '127.0.0.1', r)); const origin = 'http://127.0.0.1:' + server.address().port;
  return { server, origin, bootstrapToken: BOOT, db, close: () => new Promise(r => server.close(r)) };
}
module.exports = { start };
if (require.main === module) { const i = process.argv.indexOf('--port'); start({ port: i > 0 ? process.argv[i + 1] : 8788 }).then(s => console.log('MASLUL Cloudflare Worker (LOCAL, D1 shim, synthetic) → ' + s.origin + '   bootstrap token: ' + s.bootstrapToken)); }
