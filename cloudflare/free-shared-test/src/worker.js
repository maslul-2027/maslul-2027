// MASLUL shared TEST — Cloudflare Worker (Free plan). SYNTHETIC DATA ONLY. Identity and scope come ONLY from the server-side session (HttpOnly cookie);
// role / courseIds / userId in a request body are ignored. The REAL engine (176 routes) re-enforces role/course/team scope and MIN_GROUP on every call.
import { authFor, AuthError, ROLES, needAdmin, CFG } from './auth.js';
import { ensureSchema } from './schema.js';
import { transaction, callEngine, courseList, engineEmail, seedHints, ensureUser, hintFor } from './host.js';
import { classify } from './route_table.generated.js';
import { SEED_CHUNKS, SEED_TABLES } from './seed.generated.js';
import { upsertSql } from './store.js';
import { ROUTE_TABLES } from './route_tables.generated.js';
import { warmup } from './warm.js';
import { eq, sha256Hex } from './util.js';
seedHints(ROUTE_TABLES);
warmup();   // compile the hot engine paths during start-up, not inside the first user request (see warm.js)
const COOKIE = '__Host-maslul_sid';
const FILE_ROUTES = new Set(['backup.create', 'backup.restore', 'backup.recover', 'reports.fullExport']);
// Heavy READ-ONLY analytics are the only routes that approach the 10 ms Free-plan CPU limit. Their result is cached per caller (user + role + course + args + UTC day) and is valid only while NO table it read has changed
// (per-table version vector) and for at most 5 minutes — so a cache hit can never show data older than the last write, and one user's result is never served to another.
const CACHEABLE = /^(dash\.(home|overview|groups|compareCourses|strengthsGaps)|analytics\.insights|[a-z]+\.summary|alerts\.counts|reports\.preview|soldiers\.card)$/, CACHE_TTL = 5 * 60e3, CACHE_MAX = 200e3;
const STATUS = { INVALID: 400, BAD_TOKEN: 400, BAD_CODE: 400, BAD_CREDENTIALS: 401, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, LOCKED: 423, RATE_LIMITED: 429, CSRF: 403, TLS_REQUIRED: 426, POLICY_BLOCKED: 403, GRANT_FAILED: 409, BUSY: 409, CONFLICT: 409, MISCONFIGURED: 503, TOO_LARGE: 413, NOT_CONNECTED: 501 };
const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'strict-transport-security': 'max-age=31536000', 'x-frame-options': 'DENY', 'cache-control': 'no-store', 'cross-origin-resource-policy': 'same-origin',
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" };
const json = (status, body, extra) => new Response(JSON.stringify(body), { status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, SEC, extra || {}) });
const cookieOf = (h, name) => { for (const p of String(h || '').split(';')) { const i = p.indexOf('='); if (i > 0 && p.slice(0, i).trim() === name) return p.slice(i + 1).trim(); } return ''; };
const sess = (tok, maxAge) => COOKIE + '=' + tok + '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=' + maxAge;
const identOf = ctx => ({ userId: ctx.userId, role: ctx.role === 'user' ? 'commander' : ctx.role, name: ctx.name, courseIds: ctx.courseIds });

/** Mirror a gateway grant into the engine's assignments (same rules as backend_next/test_server.js applyGrant). Synchronous on the request's tables; throws GRANT_FAILED on ANY problem so the whole approval rolls back. */
function applyGrantSync(adminIdent, adminEm, target, targetEm, grant) {
  const bad = m => { throw new AuthError('GRANT_FAILED', m); };
  if (!grant || typeof grant !== 'object') bad('הרשאה לא תקינה.'); if (grant.role === 'admin') return;
  if (!['commander', 'viewer', 'user'].includes(grant.role)) bad('תפקיד לא תקין.');
  const cid = (grant.courseIds || [])[0]; if ((grant.courseIds || []).length !== 1 || typeof cid !== 'string' || cid === '*') bad('נדרש קורס אחד תקין.');
  if (!courseList().some(c => c.id === cid)) bad('הקורס לא קיים.');
  let sc = { type: 'course', id: cid };
  if (grant.scope !== undefined && grant.scope !== null) {
    const t = grant.scope && grant.scope.type, id = grant.scope && grant.scope.id; if ((t !== 'team' && t !== 'department') || typeof id !== 'string' || !id) bad('בחירת הצוות/המחלקה לא תקינה.');
    const org = callEngine(adminIdent, adminEm, 'courses.org', { courseId: cid }); if (!org.ok) bad('לא ניתן לאמת את ההיקף.');
    if (!(t === 'team' ? org.data.teams : org.data.departments || []).some(x => x.id === id)) bad('הצוות/המחלקה אינם שייכים לקורס.'); sc = { type: t, id };
  }
  ensureUser({ userId: target.id, role: grant.role === 'viewer' ? 'viewer' : 'commander', name: target.name, courseIds: [cid] }, targetEm);   // the engine assigns only REGISTERED commanders
  const cur = callEngine(adminIdent, adminEm, 'assignments.list', { courseId: cid, opts: {} }); if (!cur.ok) bad('לא ניתן לקרוא שיוכים קיימים.');
  const rows = (cur.data && cur.data.rows) || cur.data || [];
  for (const a of rows.filter(a => a && String(a.user_email).toLowerCase() === targetEm && a.active !== false)) { const r = callEngine(adminIdent, adminEm, 'assignments.setActive', { id: a.id, active: false, expected_updated_at: a.updated_at, reason: 'שינוי היקף' }); if (!r.ok) bad('ביטול השיוך הקודם נכשל.'); }
  const r = callEngine(adminIdent, adminEm, 'assignments.create', { data: { course_id: cid, user_email: targetEm, scope_type: sc.type, scope_id: sc.id, reason: 'אישור גישה' } }); if (!r.ok) bad(r.message || 'יצירת השיוך נכשלה.');
  const tIdent = { userId: target.id, role: grant.role === 'viewer' ? 'viewer' : 'commander', name: target.name, courseIds: [cid] };
  const mine = callEngine(tIdent, targetEm, 'assignments.mine', { courseId: cid });
  if (!(mine.ok && (sc.type === 'course' ? mine.data.course_wide === true : (sc.type === 'team' ? mine.data.team_ids : mine.data.department_ids).includes(sc.id) && !mine.data.course_wide))) bad('אימות ההיקף שנוצר נכשל.');
}
const cleanGrant = g => { if (!g || typeof g !== 'object' || !ROLES.includes(g.role)) throw new AuthError('INVALID', 'תפקיד לא תקין.'); if (g.role !== 'admin' && !(Array.isArray(g.courseIds) && g.courseIds.length)) throw new AuthError('INVALID', 'יש לשייך קורס.');
  return { role: g.role, courseIds: g.role === 'admin' ? ['*'] : g.courseIds.map(String), unitIds: (g.unitIds || []).map(String), scope: g.scope || null }; };

async function route(request, env, now) {
  const url = new URL(request.url), m = request.method.toUpperCase(), p = url.pathname, db = env.DB;
  if (!db) throw new AuthError('MISCONFIGURED', 'מסד הנתונים (D1) לא מחובר.');
  const local = env.ALLOW_LOCAL_HTTP === '1' && /^(localhost|127\.0\.0\.1)$/.test(url.hostname);
  if (url.protocol !== 'https:' && !local) throw new AuthError('TLS_REQUIRED', 'HTTPS בלבד.');
  await ensureSchema(db);
  // Staged first deploy: GET /auth/status must answer BEFORE the Worker secrets exist (authFor throws MISCONFIGURED without them). It says whether the Worker is READY; it never opens anything.
  if (request.method === 'GET' && url.pathname === '/auth/status') {
    const n = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'active' AND role = 'admin'").first(), needsSetup = n.n === 0, pep = String(env.APP_SECRET || '').length >= 32, boot = String(env.BOOTSTRAP_TOKEN || '').length >= 32, configured = pep && (!needsSetup || boot);
    return json(200, { ok: true, needsSetup, configured, recoveryEnabled: String(env.ADMIN_RECOVERY_TOKEN || '').length >= 32, missing: configured ? [] : [].concat(pep ? [] : ['APP_SECRET'], needsSetup && !boot ? ['BOOTSTRAP_TOKEN'] : []) });
  }
  const auth = authFor(env, db, now), ip = request.headers.get('cf-connecting-ip') || 'local';
  const len = Number(request.headers.get('content-length') || 0); let body = {};
  if (m !== 'GET' && m !== 'HEAD') {
    if (len > 1.2e6) throw new AuthError('TOO_LARGE', 'הבקשה גדולה מדי.');
    const raw = await request.text(); if (raw.length > 1.2e6) throw new AuthError('TOO_LARGE', 'הבקשה גדולה מדי.');
    try { body = raw ? JSON.parse(raw) : {}; } catch (e) { throw new AuthError('INVALID', 'JSON לא תקין.'); } if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AuthError('INVALID', 'גוף הבקשה לא תקין.');
    if (request.headers.get('origin') !== url.origin) throw new AuthError('CSRF', 'מקור הבקשה לא תקין.');   // exact Origin on every state-changing request
  }
  const ok = (b, extra) => json(200, Object.assign({ ok: true }, b || {}), extra);
  if (m === 'POST' && p === '/auth/bootstrap') return ok(await auth.bootstrap(body, ip));
  if (m === 'POST' && p === '/auth/recover') return ok(await auth.recover(body, ip));
  if (m === 'POST' && p === '/auth/register') return ok(await auth.register(body, ip));
  if (m === 'POST' && p === '/auth/enroll/start') return ok(await auth.enrollStart(body, ip));
  if (m === 'POST' && p === '/auth/enroll/confirm') return ok(await auth.enrollConfirm(body, ip));
  if (m === 'POST' && p === '/auth/login') { const s = await auth.login(body, ip); return ok({ role: s.role, name: s.name, csrf: s.csrf }, { 'set-cookie': sess(s.token, Math.floor(CFG.sessionAbsMs / 1000)) }); }
  const token = cookieOf(request.headers.get('cookie'), COOKIE), ctx = await auth.authenticate(token);
  if (m === 'POST' && p === '/auth/logout') { if (ctx && !eq(request.headers.get('x-csrf-token'), ctx.csrf)) throw new AuthError('CSRF', 'אסימון CSRF חסר או שגוי.'); await auth.logout(ctx); return ok({}, { 'set-cookie': sess('', 0) }); }
  if (!ctx) throw new AuthError('UNAUTHENTICATED', 'נדרשת התחברות.');
  if (m !== 'GET' && !eq(request.headers.get('x-csrf-token'), ctx.csrf)) throw new AuthError('CSRF', 'אסימון CSRF חסר או שגוי.');
  if (m === 'GET' && p === '/auth/me') return ok({ userId: ctx.userId, role: ctx.role, name: ctx.name, courseIds: ctx.courseIds, unitIds: ctx.unitIds, csrf: ctx.csrf });
  // ----- application API: the REAL engine behind the session identity -----
  if (m === 'POST' && p === '/api') {
    const method = typeof body.method === 'string' ? body.method : '', args = body.args && typeof body.args === 'object' && !Array.isArray(body.args) ? body.args : {};
    if (!/^[A-Za-z]+(\.[A-Za-z]+)?$/.test(method)) throw new AuthError('INVALID', 'שיטה לא תקינה.');
    const kind = classify(method), write = kind === 'write';
    if (kind === 'blocked') { await auth.audit('api_policy_blocked', { user: ctx.userId, method }).run(); throw new AuthError('POLICY_BLOCKED', 'הפעולה חסומה לפי מדיניות הבעלים (תצוגה קבוצתית בלבד / ללא הרצת מיגרציה).'); }
    if (kind !== 'read' && kind !== 'write') { await auth.audit('api_unknown_route', { user: ctx.userId, method }).run(); throw new AuthError('FORBIDDEN', 'פעולה לא מוכרת.'); }
    if (write && ctx.role === 'viewer') auth.authorize(ctx, 'write', { courseId: String(args.courseId || '') });
    if (ctx.role !== 'admin' && args.courseId !== undefined && !ctx.courseIds.includes(String(args.courseId))) auth.authorize(ctx, 'read', { courseId: String(args.courseId) });
    if (FILE_ROUTES.has(method)) { if (ctx.role !== 'admin') throw new AuthError('FORBIDDEN', 'פעולה למנהל בלבד.'); return json(501, { ok: false, code: 'NOT_CONNECTED', message: 'גיבוי/שחזור וייצוא מלא דורשים אחסון קבצים שאינו מחובר בסביבת הבדיקה החינמית.' }); }   // would snapshot every table only to fail: refuse before spending CPU
    const em = await engineEmail(ctx.userId), tn = now ? now() : Date.now(); let ckey = '', cvers = '', ctabs = [];
    if (kind === 'read' && CACHEABLE.test(method) && hintFor(method).length) {
      ctabs = Array.from(new Set(hintFor(method).concat(['Users', 'Courses', 'CommanderAssignments']))).sort(); ckey = await sha256Hex(['v1', method, JSON.stringify(args), ctx.userId, ctx.role, ctx.courseIds.join(','), new Date(tn).toISOString().slice(0, 10)].join('|'));
      const [mv, hit] = await db.batch([db.prepare('SELECT tbl, ver FROM meta WHERE tbl IN (' + ctabs.map(() => '?').join(',') + ')').bind(...ctabs), db.prepare('SELECT vers, body FROM cache WHERE k = ?1 AND exp > ?2').bind(ckey, tn)]);
      const vm = {}; mv.results.forEach(x => { vm[x.tbl] = x.ver; }); cvers = ctabs.map(t => t + ':' + (vm[t] || 0)).join('|');
      if (hit.results[0] && hit.results[0].vers === cvers) return new Response(hit.results[0].body, { status: 200, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'x-maslul-cache': 'hit' }, SEC) });
    }
    // Durable double-submit protection: a WRITE carrying a client idempotency key (idem_) runs at most once per (user, route, key) for 5 minutes; a retry gets the ORIGINAL result.
    // Kept in D1 (not in the engine's per-isolate memory cache: a table-discovery pass or another isolate would otherwise replay a cached result WITHOUT writing).
    let eargs = args, ikey = '';
    if (Object.prototype.hasOwnProperty.call(args, 'idem_')) {
      eargs = Object.assign({}, args); const k = eargs.idem_; delete eargs.idem_;
      if (write && typeof k === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(k)) {
        ikey = await sha256Hex(['idem1', ctx.userId, method, k].join('|')); const hit = await db.prepare('SELECT body FROM cache WHERE k = ?1 AND exp > ?2').bind(ikey, tn).first();
        if (hit) return new Response(hit.body, { status: 200, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'x-maslul-idem': 'replay' }, SEC) });
      }
    }
    const r = await transaction(db, method, [], () => ({ out: callEngine(identOf(ctx), em, method, eargs) }), { readOnly: ctx.role === 'viewer' });
    if (ikey && r.out && r.out.ok) { const ib = JSON.stringify(r.out); if (ib.length < 90000) await db.prepare('INSERT INTO cache (k, vers, body, exp) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (k) DO UPDATE SET vers = excluded.vers, body = excluded.body, exp = excluded.exp').bind(ikey, 'idem', ib, tn + 300000).run(); }
    if (ckey && !r.wrote && r.out && r.out.ok && r.tables.every(t => ctabs.includes(t))) { const body = JSON.stringify(r.out); if (body.length < CACHE_MAX) await db.batch([db.prepare('DELETE FROM cache WHERE exp < ?1').bind(tn), db.prepare('INSERT INTO cache (k, vers, body, exp) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (k) DO UPDATE SET vers = excluded.vers, body = excluded.body, exp = excluded.exp').bind(ckey, cvers, body, tn + CACHE_TTL)]); }
    return json(200, r.out);
  }
  if (m === 'GET' && /^\/api\/download\/(report|document)\/[A-Za-z0-9-]{3,64}$/.test(p)) {   // generated reports / stored documents need PDF + file storage: NOT_CONNECTED on the free plan (never a fake file)
    return json(501, { ok: false, code: 'NOT_CONNECTED', message: 'הורדת קבצים (דוחות PDF/XLSX ומסמכים) אינה מחוברת בסביבת הבדיקה החינמית.' });
  }
  // ----- admin console -----
  if (p.startsWith('/admin/')) {
    needAdmin(ctx); const admIdent = identOf(ctx), admEm = await engineEmail(ctx.userId);
    if (m === 'GET' && p === '/admin/pending') return ok({ pending: await auth.listPending(ctx) });
    if (m === 'GET' && p === '/admin/users') return ok({ users: await auth.listUsers(ctx) });
    if (m === 'POST' && (p === '/admin/approve' || p === '/admin/set-scope')) {
      const isApprove = p === '/admin/approve', id = String(isApprove ? body.requestId : body.targetUserId), grant = cleanGrant(body.grant);
      const u = await db.prepare('SELECT id, name, status FROM users WHERE id = ?1').bind(id).first();
      if (!u || (isApprove ? u.status !== 'pending' : u.status !== 'active' && u.status !== 'invited')) throw new AuthError('NOT_FOUND', isApprove ? 'בקשה לא נמצאה.' : 'משתמש לא נמצא.');
      const tem = await engineEmail(id), enr = isApprove ? await auth.newEnrollToken(id) : null, tIdent = { id, name: u.name };
      await transaction(db, 'admin.grant', ['Courses', 'CommanderAssignments', 'Departments', 'Teams'], () => {
        applyGrantSync(admIdent, admEm, tIdent, tem, grant);
        return { out: true, extra: d => isApprove ? [d.prepare("SELECT CASE WHEN (SELECT status FROM users WHERE id = ?1) = 'pending' THEN 1 ELSE abs(-9223372036854775808) END").bind(id),
          d.prepare("UPDATE users SET status = 'invited', active = 1, role = ?2, grant_json = ?3, approved_by = ?4 WHERE id = ?1 AND status = 'pending'").bind(id, grant.role, JSON.stringify(grant), ctx.userId), ...enr.stmts, auth.audit('approve', { by: ctx.userId, user: id, role: grant.role })]
          : [d.prepare('UPDATE users SET role = ?2, grant_json = ?3 WHERE id = ?1').bind(id, grant.role, JSON.stringify(grant)), d.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?1').bind(id), auth.audit('set_scope', { by: ctx.userId, user: id, role: grant.role })] };
      });
      return ok(isApprove ? { id, role: grant.role, enrollToken: enr.tok } : { ok: true });
    }
    if (m === 'POST' && p === '/admin/reset') {   // lost phone / forgotten code: new single-use enrolment link, old credentials and sessions void
      const id = String(body.targetUserId), u = await db.prepare("SELECT id FROM users WHERE id = ?1 AND status IN ('active','invited')").bind(id).first(); if (!u) throw new AuthError('NOT_FOUND', 'משתמש לא נמצא.');
      const enr = await auth.newEnrollToken(id); await db.batch([db.prepare("UPDATE users SET status = 'invited', totp_box = NULL, access_h = NULL, totp_last = 0, fails = 0, locked_until = 0, lock_count = 0 WHERE id = ?1").bind(id), db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?1').bind(id), ...enr.stmts, auth.audit('reset', { by: ctx.userId, user: id })]); return ok({ enrollToken: enr.tok });
    }
    if (m === 'POST' && p === '/admin/reject') { const r = await db.batch([db.prepare("UPDATE users SET status = 'rejected' WHERE id = ?1 AND status = 'pending'").bind(String(body.requestId)), auth.audit('reject', { by: ctx.userId })]); if (!r[0].meta.changes) throw new AuthError('NOT_FOUND', 'בקשה לא נמצאה.'); return ok({}); }
    if (m === 'POST' && p === '/admin/revoke') return ok(await auth.revokeUser(ctx, String(body.targetUserId)));
    if (m === 'POST' && p === '/admin/set-active') return ok(await auth.setActive(ctx, String(body.targetUserId), !!body.active));
    if (m === 'POST' && p === '/admin/seed-synthetic') {   // loads the pre-built SYNTHETIC course once; refused when course data already exists
      const st = SEED_CHUNKS.map(c => db.prepare(upsertSql).bind(c)); const names = JSON.stringify(SEED_TABLES);
      try { await db.batch([db.prepare("SELECT CASE WHEN EXISTS (SELECT 1 FROM rows WHERE tbl = 'Courses') THEN abs(-9223372036854775808) ELSE 1 END").bind(), ...st, db.prepare('INSERT INTO meta (tbl, ver) SELECT value, 1 FROM json_each(?1) WHERE true ON CONFLICT (tbl) DO UPDATE SET ver = ver + 1').bind(names), auth.audit('seed_synthetic', { by: ctx.userId })]); } catch (e) { if (/integer overflow/i.test(String(e && e.message))) throw new AuthError('CONFLICT', 'נתוני הקורס כבר קיימים — הטעינה נדחתה.'); throw e; }
      return ok({ tables: SEED_TABLES.length });
    }
    throw new AuthError('NOT_FOUND', 'לא נמצא.');
  }
  if (m === 'GET' && p === '/audit') return ok({ audit: await auth.audits(ctx) });
  throw new AuthError('NOT_FOUND', 'לא נמצא.');
}

export async function handle(request, env, now) {
  try { return await route(request, env, now); } catch (e) {
    if (e instanceof AuthError) return json(STATUS[e.code] || 400, { ok: false, code: e.code, message: e.message });
    if (e && e.code === 'BUSY') return json(409, { ok: false, code: 'BUSY', message: 'המערכת עסוקה — נסו שוב.' });
    if (e && /daily row (read|write) limit|exceeded D1/i.test(String(e.message))) return json(503, { ok: false, code: 'QUOTA', message: 'מכסת היום של המסלול החינמי הסתיימה; הבקשות יחזרו לעבוד מחר (00:00 UTC). לא בוצע חיוב.' });
    try { console.error('maslul-internal', String(e && e.stack || e).slice(0, 300)); } catch (x) { /* logging must never throw */ }   // operator log only; the client gets a generic message
    return json(500, { ok: false, code: 'INTERNAL', message: 'שגיאה פנימית.' });     // never leak stack/paths
  }
}
export default { async fetch(request, env) {
  const u = new URL(request.url);
  if (/^\/(api|auth|admin|audit)(\/|$)/.test(u.pathname)) return handle(request, env);
  if (env.ASSETS) { const r = await env.ASSETS.fetch(request); const h = new Headers(r.headers); Object.keys(SEC).forEach(k => { if (k !== 'cache-control') h.set(k, SEC[k]); }); h.set('cache-control', 'no-cache'); return new Response(r.body, { status: r.status, headers: h }); }
  return json(404, { ok: false, code: 'NOT_FOUND' });
} };
