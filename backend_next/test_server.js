'use strict';
// MASLUL private-TEST server (SYNTHETIC DATA ONLY). Serves the native app and the authenticated API over REAL TLS.
//   node backend_next/test_server.js            (env: MASLUL_TEST_DIR, PORT, ORIGIN, MASLUL_SEED_ADMIN_NAME/PHONE/PIN for the one-time first admin)
// Local-test secrets (pepper, store key, bootstrap token) are generated into MASLUL_TEST_DIR (git-ignored, 0600). That is NOT a secret store — see docs/PRIVATE_TEST_SERVER.md.
// NOT approved for real data: no verified phone ownership, single-process file store, no independent security review, no owner go-live approval.
const fs = require('fs'), path = require('path'), https = require('https'), crypto = require('crypto'), cp = require('child_process');
const { gateway, toHttp } = require('./gateway'), store = require('./store'), engineHost = require('./engine_host');
const root = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
function secretsIn(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); const f = path.join(dir, 'secrets.json');
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify({ pepper: crypto.randomBytes(24).toString('hex'), storeKey: crypto.randomBytes(32).toString('hex'), bootstrap: crypto.randomBytes(24).toString('hex') }), { mode: 0o600 });
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
function certIn(dir) {
  const c = path.join(dir, 'cert.pem'), k = path.join(dir, 'key.pem');
  if (!fs.existsSync(c) || !fs.existsSync(k)) cp.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', k, '-out', c, '-days', '30', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
  fs.chmodSync(k, 0o600); return { cert: fs.readFileSync(c), key: fs.readFileSync(k) };
}
/** @returns {Promise<{server, port, origin, gw, close()}>} */
async function start(o) {
  o = o || {}; const dir = path.resolve(o.dir || process.env.MASLUL_TEST_DIR || path.join(root, '.test-server')), sec = secretsIn(dir), port = Number(o.port != null ? o.port : (process.env.PORT || 8443));
  const origin = o.origin || process.env.ORIGIN || 'https://localhost:' + port, publicDir = path.resolve(o.publicDir || path.join(root, 'server_public'));
  const st = store.open({ file: path.join(dir, 'state.bin'), key: Buffer.from(sec.storeKey, 'hex') });
  let host = null, gwRef = null;
  const api = {
    isWrite: m => engineHost.WRITE.test(String(m)), call: (id, m, a) => host.call(id, m, a), get dirty() { return host.dirty; },
    afterGrant(adminId, targetUserId, grant) {      // optional one-step team/course assignment chosen at approval time (engine assignments, enforced server-side)
      if (!grant || grant.role === 'admin' || !(grant.courseIds || [])[0] || grant.courseIds[0] === '*') return;
      const t = gwRef.state.users.find(x => x.id === targetUserId); if (!t) return; const em = host.ensure({ userId: t.id, role: t.role === 'viewer' ? 'viewer' : 'commander', name: t.name, courseIds: t.courseIds });
      const sc = grant.scope && grant.scope.type ? grant.scope : { type: 'course', id: grant.courseIds[0] };
      const cur = host.call(adminId, 'assignments.list', { courseId: grant.courseIds[0], opts: {} });   // re-scoping replaces the previous assignment (never silently widens)
      ((cur.ok && (cur.data.rows || cur.data)) || []).filter(a => a && String(a.user_email).toLowerCase() === em && a.active !== false).forEach(a => host.call(adminId, 'assignments.setActive', { id: a.id, active: false, expected_updated_at: a.updated_at, reason: 'שינוי היקף' }));
      host.call(adminId, 'assignments.create', { data: { course_id: grant.courseIds[0], user_email: em, scope_type: sc.type, scope_id: sc.id, reason: 'אישור גישה' } });
    }
  };
  const gw = gateway({ store: st, pepper: sec.pepper, origin, bootstrapToken: sec.bootstrap, trustedProxies: o.trustedProxies || [], api, authOpts: o.authOpts });
  gwRef = gw; gw.state.engine = gw.state.engine || {}; host = engineHost.create({ mem: gw.state.engine });
  const sn = o.seedAdmin || (process.env.MASLUL_SEED_ADMIN_PHONE ? { fullName: process.env.MASLUL_SEED_ADMIN_NAME || 'מנהל בדיקות', phone: process.env.MASLUL_SEED_ADMIN_PHONE, pin: process.env.MASLUL_SEED_ADMIN_PIN } : null);
  if (sn && !gw.state.users.length) { gw.auth.seedAdmin(sec.bootstrap, sn); await st.save(gw.state); }
  const handler = toHttp(gw);
  const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'strict-transport-security': 'max-age=31536000', 'x-frame-options': 'DENY', 'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" };
  const server = https.createServer(certIn(dir), (rq, rs) => {
    const u = String(rq.url || '/').split('?')[0];
    if (/^\/(auth|admin|api|audit|records)(\/|$)/.test(u)) { Object.keys(SEC).forEach(k => rs.setHeader(k, SEC[k])); return handler(rq, rs); }
    if (rq.method !== 'GET' && rq.method !== 'HEAD') { rs.statusCode = 405; return rs.end(); }
    let f = path.join(publicDir, u === '/' ? 'index.html' : decodeURIComponent(u)); if (!f.startsWith(publicDir + path.sep) && f !== publicDir) { rs.statusCode = 404; return rs.end(); }
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.statusCode = 404; return rs.end('not found'); }
    Object.keys(SEC).forEach(k => rs.setHeader(k, SEC[k])); rs.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); rs.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  return { server, store: st, port: server.address().port, origin, gw, dir, bootstrap: sec.bootstrap, close: () => new Promise(r => { server.close(r); if (server.closeAllConnections) server.closeAllConnections(); }) };
}
module.exports = { start };
if (require.main === module) start().then(s => { console.log('MASLUL private TEST server (synthetic data only) → ' + s.origin + '  state: ' + path.join(s.dir, 'state.bin')); }).catch(e => { console.error('FAILED TO START:', e.message); process.exit(1); });
