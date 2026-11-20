'use strict';
// MASLUL next-backend: request boundary for the PRIVATE TEST server (synthetic only; NOT deployed, NOT approved for real data — see docs/AUTH_TEST_ADAPTER_PLAN.md).
// Identity and scope are derived ONLY from the server-side session (HttpOnly cookie); role/courseIds/unitIds/userId in a request body are ignored.
// Every record is resolved to its course/unit on the server; unresolved scope => deny (fail closed). Export/audit are admin-only; viewers never write.
const crypto = require('crypto');
const { create, AuthError } = require('./pin_auth');
const COOKIE = '__Host-maslul_sid', STATUS = { INVALID: 400, WEAK_PIN: 400, BAD_CREDENTIALS: 401, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, LOCKED: 423, RATE_LIMITED: 429, CSRF: 403, TLS_REQUIRED: 426 };
const csrfOf = (token, pepper) => crypto.createHmac('sha256', pepper).update('csrf|' + token).digest('base64url');
const eq = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); };
function parseCookies(h) { const o = {}; String(h || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }); return o; }
/** Client IP: the socket address, unless it is a trusted proxy — then the right-most X-Forwarded-For hop that is not itself trusted (a client-supplied header from an untrusted peer is ignored). */
function clientIp(req, trusted) {
  const peer = req.remoteAddr || 'n/a'; if (!trusted.includes(peer)) return peer;
  const hops = String(req.headers['x-forwarded-for'] || '').split(',').map(x => x.trim()).filter(Boolean); for (let i = hops.length - 1; i >= 0; i--) if (!trusted.includes(hops[i])) return hops[i]; return peer;
}
function gateway(opts) {
  const net = require('net'); (opts.trustedProxies || []).forEach(a => { if (typeof a !== 'string' || !net.isIP(a) || /^(0\.0\.0\.0|::)$/.test(a)) throw new Error('INVALID_TRUSTED_PROXY: only explicit proxy IP addresses are allowed (no wildcard, CIDR or hostnames)'); });
  const store = opts.store, pepper = String(opts.pepper || ''), origin = opts.origin, trusted = opts.trustedProxies || [], state = store.load();
  if (!origin || !/^https:\/\//.test(origin)) throw new Error('origin (https://...) is required');
  const auth = create(Object.assign({}, opts.authOpts, { pepper, bootstrapToken: opts.bootstrapToken, db: state, audit: state.audit, now: opts.now }));
  const rec = id => state.records.find(r => r.id === id) || null;
  /** Server-side resolver: record id -> {courseId, unitId}; null when it does not exist. The client never states the scope. */
  const resolve = id => { const r = rec(String(id)); return r ? { courseId: r.courseId, unitId: r.unitId || '' } : null; };
  const need = (ctx, action, id) => {      // existence is hidden from out-of-scope callers: unknown and foreign records look the same (NOT_FOUND vs FORBIDDEN is decided after scope)
    const res = resolve(id); if (!res) { if (ctx && ctx.role !== 'admin') throw new AuthError('FORBIDDEN', 'אין הרשאה.'); throw new AuthError('NOT_FOUND', 'הרשומה לא נמצאה.'); }
    if (['export', 'audit'].includes(action)) { if (!ctx) throw new AuthError('UNAUTHENTICATED', 'נדרשת התחברות.'); if (ctx.role !== 'admin') throw new AuthError('FORBIDDEN', 'פעולה למנהל בלבד.'); return res; }
    auth.authorize(ctx, action === 'read' || action === 'evidence_read' ? 'read' : 'write', res); return res;
  };
  let skipSave = false;   // successful READ-only application calls change nothing (the engine's sessions/audit are untouched), so they are not re-sealed to disk
  async function handle(req) {
    return store.serial(async () => {
      let out; skipSave = false;
      try { out = await route(req); } catch (e) {
        if (e instanceof AuthError) out = { status: STATUS[e.code] || 400, body: { ok: false, code: e.code, message: e.message } };
        else out = { status: 500, body: { ok: false, code: 'INTERNAL', message: 'שגיאה פנימית.' } };      // never leak stack/paths
      }
      if (!(skipSave && out.status === 200)) store.saveNow(state);          // rate-limit counters, lockouts, sessions and audit are persisted even for failed requests
      return out;
    });
  }
  async function route(req) {
    const m = String(req.method || 'GET').toUpperCase(), p = String(req.path || '/').split('?')[0], H = {}; Object.keys(req.headers || {}).forEach(k => { H[k.toLowerCase()] = req.headers[k]; }); req = Object.assign({}, req, { headers: H });
    if (req.proto !== 'https' && !(trusted.includes(req.remoteAddr) && H['x-forwarded-proto'] === 'https')) throw new AuthError('TLS_REQUIRED', 'HTTPS בלבד.');
    const ip = clientIp(req, trusted), body = req.body || {}, token = parseCookies(H.cookie)[COOKIE] || '', ctx = auth.authenticate(token);
    if (m !== 'GET') {            // CSRF: exact Origin + per-session double-submit header (login/register are pre-session: Origin check only)
      if (H.origin !== origin) throw new AuthError('CSRF', 'מקור הבקשה לא תקין.');
      if (ctx && !['/auth/login', '/auth/register'].includes(p) && !eq(H['x-csrf-token'], csrfOf(token, pepper))) throw new AuthError('CSRF', 'אסימון CSRF חסר או שגוי.');
    }
    const ok = (b, extra) => Object.assign({ status: 200, body: Object.assign({ ok: true }, b || {}) }, extra || {});
    if (m === 'POST' && p === '/auth/register') return ok(auth.register(body, ip));
    if (m === 'POST' && p === '/auth/login') {
      const s = auth.login(body, ip); return ok({ role: s.role, name: s.name, csrf: csrfOf(s.token, pepper), mustChangePin: s.mustChangePin },
        { headers: { 'set-cookie': COOKIE + '=' + s.token + '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=' + Math.floor(auth.cfg.sessionAbsMs / 1000) } });
    }
    if (m === 'POST' && p === '/auth/logout') { auth.logout(token); return ok({}, { headers: { 'set-cookie': COOKIE + '=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' } }); }
    if (!ctx) throw new AuthError('UNAUTHENTICATED', 'נדרשת התחברות.');
    if (m === 'GET' && p === '/auth/me') return ok({ userId: ctx.userId, role: ctx.role, courseIds: ctx.courseIds, unitIds: ctx.unitIds, csrf: csrfOf(token, pepper) });
    // ----- application API: identity and scope come ONLY from the session; the engine host re-enforces role/course/team scope on every call -----
    if (m === 'POST' && p === '/api') {
      if (!opts.api) throw new AuthError('NOT_FOUND', 'לא נמצא.');
      const method = typeof body.method === 'string' ? body.method : '', args = body.args && typeof body.args === 'object' && !Array.isArray(body.args) ? body.args : {};
      if (!/^[A-Za-z]+(\.[A-Za-z]+)?$/.test(method)) throw new AuthError('INVALID', 'שיטה לא תקינה.');
      const write = opts.api.isWrite(method);
      if (write && ctx.role === 'viewer') auth.authorize(ctx, 'write', { courseId: String(args.courseId || '') });          // logs + FORBIDDEN: viewers never write
      if (ctx.role !== 'admin' && args.courseId !== undefined && !ctx.courseIds.includes(String(args.courseId))) { auth.authorize(ctx, 'read', { courseId: String(args.courseId) }); }   // fail closed on a foreign course before the engine is reached
      const u = state.users.find(x => x.id === ctx.userId);
      const body2 = opts.api.call({ userId: ctx.userId, role: ctx.role === 'user' ? 'commander' : ctx.role, name: u ? u.name : '', courseIds: ctx.courseIds }, method, args);
      skipSave = !opts.api.dirty && !write;   // persist whenever the engine actually changed state, whatever the method is called
      return { status: 200, body: body2 };
    }
    // ----- admin console -----
    if (p.startsWith('/admin/')) {
      if (m === 'GET' && p === '/admin/pending') return ok({ pending: auth.listPending(ctx) });
      if (m === 'GET' && p === '/admin/users') return ok({ users: auth.listUsers(ctx) });
      if (m === 'POST' && p === '/admin/approve') { const r = auth.approve(ctx, String(body.requestId), body.grant); if (opts.api && opts.api.afterGrant) opts.api.afterGrant({ userId: ctx.userId, role: 'admin', name: '' }, r.id, body.grant || {}); return ok(r); }
      if (m === 'POST' && p === '/admin/reject') return ok(auth.reject(ctx, String(body.requestId)));
      if (m === 'POST' && p === '/admin/revoke') return ok(auth.revokeUser(ctx, String(body.targetUserId)));
      if (m === 'POST' && p === '/admin/set-scope') { const r = auth.setScope(ctx, String(body.targetUserId), body.grant || {}); if (opts.api && opts.api.afterGrant) opts.api.afterGrant({ userId: ctx.userId, role: 'admin', name: '' }, String(body.targetUserId), body.grant || {}); return ok(r); }
      if (m === 'POST' && p === '/admin/set-active') return ok(auth.setActive(ctx, String(body.targetUserId), !!body.active));
      throw new AuthError('NOT_FOUND', 'לא נמצא.');
    }
    // ----- synthetic course records (stand-in for the real data API) -----
    let mm;
    if (m === 'POST' && p === '/records') {       // create: the target course comes from the body but is authorised against the session scope before anything is written
      auth.authorize(ctx, 'write', { courseId: String(body.courseId || ''), unitId: String(body.unitId || '') });
      const r = { id: crypto.randomUUID(), courseId: String(body.courseId), unitId: String(body.unitId || ''), data: String(body.data || '').slice(0, 2000), evidence: [], by: ctx.userId };
      state.records.push(r); auth.audit.push({ at: new Date((opts.now || Date.now)()).toISOString(), ev: 'record_create', user: ctx.userId, rec: r.id }); return ok({ id: r.id });
    }
    if ((mm = /^\/records\/([^/]+)(\/export|\/evidence)?$/.exec(p))) {
      const id = mm[1], sub = mm[2] || '';
      if (!sub && m === 'GET') { need(ctx, 'read', id); const r = rec(id); return ok({ record: { id: r.id, courseId: r.courseId, unitId: r.unitId, data: r.data } }); }
      if (!sub && m === 'PUT') { need(ctx, 'write', id); const r = rec(id); r.data = String(body.data || '').slice(0, 2000); auth.audit.push({ at: new Date((opts.now || Date.now)()).toISOString(), ev: 'record_edit', user: ctx.userId, rec: id }); return ok({}); }
      if (sub === '/export' && m === 'GET') { need(ctx, 'export', id); auth.audit.push({ at: new Date((opts.now || Date.now)()).toISOString(), ev: 'record_export', user: ctx.userId, rec: id }); const r = rec(id); return ok({ export: { id: r.id, data: r.data, evidence: r.evidence } }); }
      if (sub === '/evidence' && m === 'GET') { need(ctx, 'evidence_read', id); return ok({ evidence: rec(id).evidence }); }
      if (sub === '/evidence' && m === 'POST') { need(ctx, 'write', id); rec(id).evidence.push({ name: String(body.name || '').slice(0, 120), by: ctx.userId }); return ok({}); }
    }
    if (m === 'GET' && p === '/audit') { if (ctx.role !== 'admin') throw new AuthError('FORBIDDEN', 'פעולה למנהל בלבד.'); return ok({ audit: auth.audit.slice(-200).map(e => Object.assign({}, e)) }); }
    throw new AuthError('NOT_FOUND', 'לא נמצא.');
  }
  return { handle, auth, state, COOKIE };
}
/** Minimal node:http adapter for the private TEST server. FAIL CLOSED: the protocol is taken ONLY from the socket (a real TLS socket = https). There is deliberately NO option to assume/force TLS — options passed here are ignored. HTTPS behind a reverse proxy is accepted solely by the gateway's own check: the TCP peer must be an explicitly configured trustedProxies IP AND send x-forwarded-proto: https. */
function toHttp(gw) {
  return (rq, rs) => { let raw = ''; rq.on('data', c => { raw += c; if (raw.length > 2e6) rq.destroy(); }); rq.on('end', async () => {
    let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch (e) { rs.statusCode = 400; return rs.end('{"ok":false,"code":"INVALID"}'); }
    const r = await gw.handle({ method: rq.method, path: rq.url, headers: rq.headers, body, remoteAddr: rq.socket.remoteAddress, proto: rq.socket && rq.socket.encrypted ? 'https' : 'http' });
    rs.statusCode = r.status; rs.setHeader('content-type', 'application/json; charset=utf-8'); rs.setHeader('cache-control', 'no-store'); rs.setHeader('x-content-type-options', 'nosniff'); Object.keys(r.headers || {}).forEach(k => rs.setHeader(k, r.headers[k])); rs.end(JSON.stringify(r.body)); }); };
}
module.exports = { gateway, toHttp, COOKIE, csrfOf, clientIp };
