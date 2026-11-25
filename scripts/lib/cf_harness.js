'use strict';
// Shared helper for the Cloudflare Free-plan scripts: boots the REAL Worker in-process on the SQLite D1 shim, bootstraps an admin, loads the synthetic course. SYNTHETIC ONLY, no network.
const path = require('path'), { pathToFileURL } = require('url'), SRC = path.join(__dirname, '..', '..', 'cloudflare', 'free-shared-test', 'src'), imp = f => import(pathToFileURL(path.join(SRC, f)).href);
const A32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; const unb32 = s => { let bits = 0, v = 0; const o = []; for (const ch of s) { v = (v << 5) | A32.indexOf(ch); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(o); };
async function boot() {
  const { D1 } = require('../../tests/lib/d1_shim.js'), t0 = performance.now(), W = await imp('worker.js'), H = await imp('host.js'), U = await imp('util.js'); const startupMs = performance.now() - t0;
  const db = new D1(), BOOT = 'bench-bootstrap-token-0123456789', env = { DB: db, APP_SECRET: 'bench-app-secret-0123456789abcdef0123456789', BOOTSTRAP_TOKEN: BOOT }, O = 'https://t.example.workers.dev'; let clock = Date.now(), ipn = 0;
  function client() {
    const jar = {}, ip = '10.2.0.' + (++ipn % 250 + 1);
    const f = async (m, p, b) => { const h = { origin: O, 'cf-connecting-ip': ip }; if (b !== undefined) h['content-type'] = 'application/json'; if (jar.c) h.cookie = jar.c; if (jar.csrf && m !== 'GET') h['x-csrf-token'] = jar.csrf;
      db.resetInvocation(); const cpu0 = process.cpuUsage(), shim0 = db.cpuUs, w0 = performance.now(); const r = await W.handle(new Request(O + p, { method: m, headers: h, body: b !== undefined && m !== 'GET' ? JSON.stringify(b) : undefined }), env, () => clock);
      const text = await r.text(), cpu = process.cpuUsage(cpu0), shim = db.cpuUs - shim0, inv = db.resetInvocation(); let j = {}; try { j = JSON.parse(text); } catch (e) { j = {}; } const sc = r.headers.get('set-cookie'); if (sc) jar.c = sc.split(';')[0]; if (j.csrf) jar.csrf = j.csrf;
      f.last = { status: r.status, workerCpuMs: Math.max(0, (cpu.user + cpu.system - shim) / 1000), wallMs: performance.now() - w0, statements: inv.statements, rowsRead: inv.rowsRead, rowsWritten: inv.rowsWritten, bytes: text.length }; return Object.assign({ _status: r.status }, j); };
    f.api = (method, args) => f('POST', '/api', { method, args: args || {} }); f.jar = jar; return f;
  }
  let step = Math.floor(clock / 30000) - 1; const code = secret => U.hotp(secret, ++step);
  const admin = client(); const b = await admin('POST', '/auth/bootstrap', { token: BOOT, fullName: 'מנהל סינתטי', email: 'admin@example.test' }), s = await admin('POST', '/auth/enroll/start', { token: b.enrollToken }), sec = unb32(s.totpSecret);
  await admin('POST', '/auth/enroll/confirm', { token: b.enrollToken, pin: '4826', code: await U.hotp(sec, Math.floor(clock / 30000)) }); const l = await admin('POST', '/auth/login', { email: 'admin@example.test', pin: '4826', code: await code(sec) }); if (!l.ok) throw new Error('admin login failed ' + JSON.stringify(l));
  const seed = await admin('POST', '/admin/seed-synthetic', {}); if (!seed.ok) throw new Error('seed failed ' + JSON.stringify(seed));
  return { W, H, U, db, env, client, admin, startupMs, clock: () => clock, advance: ms => { clock += ms; }, code, unb32 };
}
module.exports = { boot, imp, SRC };
