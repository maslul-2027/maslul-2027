'use strict';
// MASLUL private-TEST server (SYNTHETIC DATA ONLY). Serves the native app and the authenticated API over REAL TLS.
//   node backend_next/test_server.js            (env: MASLUL_TEST_DIR, PORT, ORIGIN, MASLUL_SEED_ADMIN_NAME/PHONE/PIN for the one-time first admin)
// Local-test secrets (pepper, store key, bootstrap token) are generated into MASLUL_TEST_DIR (git-ignored, 0600). That is NOT a secret store — see docs/PRIVATE_TEST_SERVER.md.
// NOT approved for real data: no verified phone ownership, single-process file store, no independent security review, no owner go-live approval.
const fs = require('fs'), path = require('path'), https = require('https'), crypto = require('crypto'), cp = require('child_process');
const { gateway, toHttp } = require('./gateway'), store = require('./store'), engineHost = require('./engine_host'), routeTable = require('./route_table');
const root = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
function secretsIn(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); const f = path.join(dir, 'secrets.json');
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify({ pepper: crypto.randomBytes(24).toString('hex'), storeKey: crypto.randomBytes(32).toString('hex'), bootstrap: crypto.randomBytes(24).toString('hex') }), { mode: 0o600 });
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
function certIn(dir, o) {
  if (o && o.certFile && o.keyFile) return { cert: fs.readFileSync(o.certFile), key: fs.readFileSync(o.keyFile) };   // real certificate supplied by the operator (e.g. private CA / ACME)
  const c = path.join(dir, 'cert.pem'), k = path.join(dir, 'key.pem');
  if (!fs.existsSync(c) || !fs.existsSync(k)) cp.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', k, '-out', c, '-days', '30', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
  fs.chmodSync(k, 0o600); return { cert: fs.readFileSync(c), key: fs.readFileSync(k) };
}
/** @returns {Promise<{server, port, origin, gw, close()}>} */
async function start(o) {
  o = o || {}; const dir = path.resolve(o.dir || process.env.MASLUL_TEST_DIR || path.join(root, '.test-server')), sec = secretsIn(dir), port = Number(o.port != null ? o.port : (process.env.PORT || 8443));
  const bindHost = o.host || process.env.BIND_HOST || '127.0.0.1';   // default loopback. A non-loopback bind is only for an approved PRIVATE network and REQUIRES ORIGIN (https://<name>) + a certificate the phones trust
  if (bindHost !== '127.0.0.1' && bindHost !== '::1' && bindHost !== 'localhost' && !(o.origin || process.env.ORIGIN)) throw new Error('BIND_HOST outside loopback requires ORIGIN=https://<private-name> (exact origin used for CSRF)');
  const origin = o.origin || process.env.ORIGIN || 'https://localhost:' + port, publicDir = path.resolve(o.publicDir || path.join(root, 'server_public'));
  const st = store.open({ file: path.join(dir, 'state.bin'), key: Buffer.from(sec.storeKey, 'hex') });
  let host = null, gwRef = null;
  const api = {
    classify: m => routeTable.classify(String(m)), call: (id, m, a) => host.call(id, m, a), get dirty() { return host.dirty; },
    /** Mirror a gateway grant into the engine's assignments. Fail closed: anything malformed or refused by the engine returns ok:false (the gateway then rolls the whole approval back). */
    applyGrant(adminId, targetUserId, grant) {
      const bad = m => ({ ok: false, message: m });
      if (!grant || typeof grant !== 'object') return bad('הרשאה לא תקינה.');
      if (grant.role === 'admin') return { ok: true };
      if (grant.role !== 'commander' && grant.role !== 'viewer' && grant.role !== 'user') return bad('תפקיד לא תקין.');
      const cid = (grant.courseIds || [])[0]; if ((grant.courseIds || []).length !== 1 || typeof cid !== 'string' || cid === '*') return bad('נדרש קורס אחד תקין.');
      const courses = host.courses(); if (!courses.some(c => c.id === cid)) return bad('הקורס לא קיים.');
      let sc = { type: 'course', id: cid };
      if (grant.scope !== undefined && grant.scope !== null) {      // a scope that was chosen must be valid — never silently widened to the whole course
        const t = grant.scope && grant.scope.type, id = grant.scope && grant.scope.id; if ((t !== 'team' && t !== 'department') || typeof id !== 'string' || !id) return bad('בחירת הצוות/המחלקה לא תקינה.');
        const org = host.call(adminId, 'courses.org', { courseId: cid }); if (!org.ok) return bad('לא ניתן לאמת את ההיקף.');
        if (!(t === 'team' ? org.data.teams : org.data.departments || []).some(x => x.id === id)) return bad('הצוות/המחלקה אינם שייכים לקורס.');
        sc = { type: t, id };
      }
      const t = gwRef.state.users.find(x => x.id === targetUserId); if (!t) return bad('המשתמש לא נמצא.');
      const em = host.ensure({ userId: t.id, role: t.role === 'viewer' ? 'viewer' : 'commander', name: t.name, courseIds: t.courseIds });
      const cur = host.call(adminId, 'assignments.list', { courseId: cid, opts: {} }); if (!cur.ok) return bad('לא ניתן לקרוא שיוכים קיימים.');
      const rows = (cur.data && cur.data.rows) || cur.data || [];
      for (const a of rows.filter(a => a && String(a.user_email).toLowerCase() === em && a.active !== false)) { const r = host.call(adminId, 'assignments.setActive', { id: a.id, active: false, expected_updated_at: a.updated_at, reason: 'שינוי היקף' }); if (!r.ok) return bad('ביטול השיוך הקודם נכשל.'); }
      const r = host.call(adminId, 'assignments.create', { data: { course_id: cid, user_email: em, scope_type: sc.type, scope_id: sc.id, reason: 'אישור גישה' } }); if (!r.ok) return bad(r.message || 'יצירת השיוך נכשלה.');
      const mine = host.call({ userId: t.id, role: 'commander', name: t.name, courseIds: t.courseIds }, 'assignments.mine', { courseId: cid }); const okScope = mine.ok && (sc.type === 'course' ? mine.data.course_wide === true : (sc.type === 'team' ? mine.data.team_ids : mine.data.department_ids).includes(sc.id) && !mine.data.course_wide);
      return okScope ? { ok: true } : bad('אימות ההיקף שנוצר נכשל.');
    }
  };
  const gw = gateway({ store: st, pepper: sec.pepper, origin, bootstrapToken: sec.bootstrap, trustedProxies: o.trustedProxies || [], api, authOpts: o.authOpts });
  gwRef = gw; gw.state.engine = gw.state.engine || {}; host = engineHost.create({ mem: gw.state.engine });
  const sn = o.seedAdmin || (process.env.MASLUL_SEED_ADMIN_PHONE ? { fullName: process.env.MASLUL_SEED_ADMIN_NAME || 'מנהל בדיקות', phone: process.env.MASLUL_SEED_ADMIN_PHONE, pin: process.env.MASLUL_SEED_ADMIN_PIN } : null);
  if (sn && !gw.state.users.length) { gw.auth.seedAdmin(sec.bootstrap, sn); await st.save(gw.state); }
  const handler = toHttp(gw);
  const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'strict-transport-security': 'max-age=31536000', 'x-frame-options': 'DENY', 'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" };
  const realPublic = fs.realpathSync(publicDir), send = (rs, code, msg) => { rs.statusCode = code; rs.end(msg || ''); };
  const server = https.createServer(certIn(dir, { certFile: o.certFile || process.env.TLS_CERT_FILE, keyFile: o.keyFile || process.env.TLS_KEY_FILE }), (rq, rs) => {
    try {
      const u = String(rq.url || '/').split('?')[0];
      if (/^\/(auth|admin|api|audit|records)(\/|$)/.test(u)) { Object.keys(SEC).forEach(k => rs.setHeader(k, SEC[k])); return handler(rq, rs); }
      if (rq.method !== 'GET' && rq.method !== 'HEAD') return send(rs, 405);
      let dec; try { dec = decodeURIComponent(u); } catch (e) { return send(rs, 400, 'bad request'); }          // malformed %-encoding is a client error, never a crash
      if (dec.includes('\0') || dec.includes('\\')) return send(rs, 400, 'bad request');
      const f = path.join(publicDir, dec === '/' ? 'index.html' : dec); let real; try { real = fs.realpathSync(f); } catch (e) { return send(rs, 404, 'not found'); }
      if ((real !== realPublic && !real.startsWith(realPublic + path.sep)) || !fs.statSync(real).isFile()) return send(rs, 404, 'not found');   // no traversal / symlink escape out of server_public
      Object.keys(SEC).forEach(k => rs.setHeader(k, SEC[k])); rs.setHeader('content-type', MIME[path.extname(real)] || 'application/octet-stream'); rs.end(fs.readFileSync(real));
    } catch (e) { try { send(rs, 500, 'error'); } catch (e2) { /* socket already gone */ } }
  });
  server.on('clientError', (e, sock) => { try { sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (x) { /* ignore */ } });
  await new Promise(r => server.listen(port, bindHost, r));
  return { server, store: st, port: server.address().port, origin, gw, dir, bootstrap: sec.bootstrap, close: () => new Promise(r => { server.close(r); if (server.closeAllConnections) server.closeAllConnections(); }) };
}
module.exports = { start };
if (require.main === module) start().then(s => { console.log('MASLUL private TEST server (synthetic data only) → ' + s.origin + '  state: ' + path.join(s.dir, 'state.bin')); }).catch(e => { console.error('FAILED TO START:', e.message); process.exit(1); });
