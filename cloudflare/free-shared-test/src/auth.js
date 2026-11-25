// Identity for the shared TEST: admin approval + one-time enrolment link + personal 4-digit PIN (chosen by the person at enrolment, stored only as a pepper-keyed HMAC). SYNTHETIC PILOT ONLY (owner decision 25.11.2026): NO TOTP / e-mail code; compensating server controls = per-account staged lockout + IP rate limit + single-use admin-approved enrolment link + weak-PIN refusal + audit. NOT acceptable for real data. NO client-supplied role/identity.
// Why not a password hash: Workers Free allows 10 ms CPU per request; every credential here is random and high-entropy (60-bit code, 160-bit TOTP seed, 256-bit tokens),
// so keyed HMAC-SHA-256 is the right primitive and costs microseconds. Brute force is stopped by per-user lockout (5 fails => 15 min, doubling, max 24 h) and per-IP limits.
const WEAK_PIN = d => /^(\d)\1{3}$/.test(d) || '01234567890'.includes(d) || '09876543210'.includes(d) || ['1212','2121','1122','2580','0852','1004','2000','2024','2025','2026','2027'].includes(d);
import { b64u, randToken, sha256Hex, hmacHex, eq, normCode, normEmail } from './util.js';
export const ROLES = ['admin', 'commander', 'user', 'viewer'];
export const CFG = { maxFails: 5, lockMs: 15 * 60e3, lockMaxMs: 24 * 3600e3, ipWindowMs: 10 * 60e3, ipMax: 30, sessionAbsMs: 12 * 3600e3, sessionIdleMs: 3600e3, touchMs: 60e3, enrollTtlMs: 24 * 3600e3, maxPending: 100 };
export class AuthError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }
export const GENERIC = () => new AuthError('BAD_CREDENTIALS', 'פרטי הכניסה שגויים, או שהחשבון אינו פעיל.');
const jparse = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };

export function authFor(env, db, now) {
  const pepper = String(env.APP_SECRET || ''); if (pepper.length < 32) throw new AuthError('MISCONFIGURED', 'APP_SECRET (לפחות 32 תווים) לא הוגדר.');
  const t = () => (now ? now() : Date.now()), emailH = e => hmacHex(pepper, 'email|' + e), accessH = (uid, code) => hmacHex(pepper, 'access|' + uid + '|' + normCode(code)), sessH = tok => sha256Hex('sess|' + tok);
  const A = {
    pepper,
    audit: (ev, o) => db.prepare('INSERT INTO audit (at, ev, data) VALUES (?1, ?2, ?3)').bind(t(), ev, JSON.stringify(o || {})),   // never log codes, secrets or tokens
    async rate(ip, scope, max) {
      const k = scope + '|' + ip, n = t(), r = await db.prepare('INSERT INTO rate (k, n, win) VALUES (?1, 1, ?2) ON CONFLICT (k) DO UPDATE SET n = CASE WHEN win < ?3 THEN 1 ELSE n + 1 END, win = CASE WHEN win < ?3 THEN ?2 ELSE win END RETURNING n').bind(k, n, n - CFG.ipWindowMs).first();
      if (r && r.n > (max || CFG.ipMax)) { await A.audit('rate_limited', { scope }).run(); throw new AuthError('RATE_LIMITED', 'יותר מדי ניסיונות. נסו מאוחר יותר.'); }
    },
    /** First admin: only while the users table is empty AND with the deployment secret BOOTSTRAP_TOKEN. Returns an enrolment token (same path as every other user). */
    async bootstrap(p, ip) {
      await A.rate(ip, 'boot', 10); const bt = String(env.BOOTSTRAP_TOKEN || '');
      if (bt.length < 32 || !eq(String(p.token || ''), bt)) { await A.audit('bootstrap_denied', {}).run(); throw new AuthError('FORBIDDEN', 'לא מורשה.'); }
      const email = normEmail(p.email), name = String(p.fullName || '').trim(); if (!email || name.length < 2 || name.length > 80) throw new AuthError('INVALID', 'שם ואימייל תקינים נדרשים.');
      // RESUME: a first admin that was created but never finished enrolment (no active user yet) gets a FRESH link; nothing is deleted, no second account is created.
      const pend = (await db.prepare("SELECT id FROM users WHERE status = 'invited' AND role = 'admin'").all()).results, act = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'active'").first();
      if (pend.length === 1 && act.n === 0) { const rid = pend[0].id, rtok = randToken(32); await db.batch([db.prepare('UPDATE enroll SET used = 1 WHERE user_id = ?1 AND used = 0').bind(rid), db.prepare('INSERT INTO enroll (h, user_id, exp) VALUES (?1, ?2, ?3)').bind(await sha256Hex('enroll|' + rtok), rid, t() + CFG.enrollTtlMs), A.audit('bootstrap_resume', { user: rid })]); return { enrollToken: rtok, resumed: true }; }
      const id = crypto.randomUUID(), tok = randToken(32), th = await sha256Hex('enroll|' + tok), eh = await emailH(email);
      const res = await db.batch([
        db.prepare("INSERT INTO users (id, email_h, email, name, role, grant_json, status, active, created_at) SELECT ?1, ?2, ?3, ?4, 'admin', ?5, 'invited', 1, ?6 WHERE NOT EXISTS (SELECT 1 FROM users)").bind(id, eh, email, name, JSON.stringify({ role: 'admin', courseIds: ['*'], unitIds: [] }), t()),
        db.prepare('INSERT INTO enroll (h, user_id, exp) SELECT ?1, ?2, ?3 WHERE EXISTS (SELECT 1 FROM users WHERE id = ?2)').bind(th, id, t() + CFG.enrollTtlMs), A.audit('bootstrap_admin', { user: id })]);
      if (!res[0].meta.changes) throw new AuthError('FORBIDDEN', 'לא מורשה.');
      return { enrollToken: tok };
    },
    async register(p, ip) {
      await A.rate(ip, 'reg'); const email = normEmail(p.email), name = String(p.fullName || '').trim(); if (!email || name.length < 2 || name.length > 80) throw new AuthError('INVALID', 'שם ואימייל תקינים נדרשים.');
      const pend = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'pending'").first(); if (pend.n >= CFG.maxPending) throw new AuthError('RATE_LIMITED', 'יותר מדי בקשות ממתינות. פנו למנהל.');
      const eh = await emailH(email);   // same answer whether or not the address exists: no enumeration
      await db.batch([db.prepare("INSERT OR IGNORE INTO users (id, email_h, email, name, role, status, active, created_at) VALUES (?1, ?2, ?3, ?4, 'commander', 'pending', 0, ?5)").bind(crypto.randomUUID(), eh, email, name, t()), A.audit('register', {})]);
      return { status: 'pending' };
    },
    listPending: async ctx => { needAdmin(ctx); return (await db.prepare("SELECT id, name, email, created_at FROM users WHERE status = 'pending' ORDER BY created_at").all()).results.map(r => ({ id: r.id, name: r.name, email: r.email, phone: '', created_at: new Date(r.created_at).toISOString() })); },
    listUsers: async ctx => { needAdmin(ctx); return (await db.prepare("SELECT id, name, email, role, grant_json, status, active, locked_until FROM users WHERE status != 'pending' AND status != 'rejected' ORDER BY created_at").all()).results.map(u => { const g = jparse(u.grant_json, {}); return { id: u.id, name: u.name, email: u.email, phone: u.email, role: u.role, courseIds: g.courseIds || [], unitIds: g.unitIds || [], active: !!u.active && u.status === 'active', status: u.status, locked: u.locked_until > t() }; }); },
    /** Enrolment: the admin hands the link to the person (their own channel). The token is single-use, 24 h, stored only as a hash. */
    async newEnrollToken(userId) { const tok = randToken(32); return { tok, stmts: [db.prepare('UPDATE enroll SET used = 1 WHERE user_id = ?1 AND used = 0').bind(userId), db.prepare('INSERT INTO enroll (h, user_id, exp) VALUES (?1, ?2, ?3)').bind(await sha256Hex('enroll|' + tok), userId, t() + CFG.enrollTtlMs)] }; },
    async enrollStart(p, ip) {
      await A.rate(ip, 'enr', 20); const th = await sha256Hex('enroll|' + String(p.token || '')), e = await db.prepare('SELECT e.user_id, e.exp, e.used, u.name, u.email, u.status FROM enroll e JOIN users u ON u.id = e.user_id WHERE e.h = ?1').bind(th).first();
      if (!e || e.used || e.exp < t() || e.status !== 'invited') throw new AuthError('BAD_TOKEN', 'הקישור אינו תקף (פג תוקף, נוצל או בוטל). בקשו קישור חדש מהמנהל.');
      await A.audit('enroll_start', { user: e.user_id }).run();
      return { name: e.name, email: e.email };
    },
    async enrollConfirm(p, ip) {
      await A.rate(ip, 'enr', 20); const th = await sha256Hex('enroll|' + String(p.token || '')), e = await db.prepare('SELECT user_id, exp, used FROM enroll WHERE h = ?1').bind(th).first();
      if (!e || e.used || e.exp < t()) throw new AuthError('BAD_TOKEN', 'הקישור אינו תקף (פג תוקף או נוצל). בקשו קישור חדש מהמנהל.');
      const pin = String(p.pin == null ? '' : p.pin); if (!/^\d{4}$/.test(pin)) throw new AuthError('INVALID', 'הקוד האישי (PIN) חייב להיות בדיוק 4 ספרות.'); if (WEAK_PIN(pin)) throw new AuthError('INVALID', 'ה-PIN קל מדי לניחוש (ספרות חוזרות או רצף). בחרו אחר.');
      const res = await db.batch([db.prepare("UPDATE users SET access_h = ?2, status = 'active', active = 1, fails = 0, locked_until = 0, lock_count = 0 WHERE id = ?1 AND status = 'invited'").bind(e.user_id, await accessH(e.user_id, pin)),
        db.prepare('UPDATE enroll SET used = 1 WHERE h = ?1').bind(th), db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?1').bind(e.user_id), A.audit('enroll_done', { user: e.user_id })]);
      if (!res[0].meta.changes) throw new AuthError('BAD_TOKEN', 'הקישור אינו תקף.');
      return { ok: true };
    },
    async login(p, ip) {
      await A.rate(ip, 'login'); const email = normEmail(p.email), tt = t(); const eh = await emailH(email || 'x'), u = email ? await db.prepare('SELECT * FROM users WHERE email_h = ?1').bind(eh).first() : null;
      const uid = u ? u.id : '00000000-0000-0000-0000-000000000000', want = u && u.access_h ? u.access_h : await hmacHex(pepper, 'dummy'), got = await accessH(uid, p.pin);   // equal work for unknown accounts: no timing oracle
      if (!u || u.status !== 'active' || !u.active) { await A.audit('login_fail', { reason: 'unknown_or_inactive' }).run(); throw GENERIC(); }
      if (u.locked_until > tt) { await A.audit('login_locked', { user: u.id }).run(); throw new AuthError('LOCKED', 'החשבון ננעל זמנית. נסו מאוחר יותר או פנו למנהל.'); }
      const good = eq(got, want);
      if (!good) {
        let fails = u.fails + 1, lockedUntil = u.locked_until, lc = u.lock_count; if (fails >= CFG.maxFails) { lc++; lockedUntil = tt + Math.min(CFG.lockMs * Math.pow(2, lc - 1), CFG.lockMaxMs); fails = 0; }
        await db.batch([db.prepare('UPDATE users SET fails = ?2, locked_until = ?3, lock_count = ?4 WHERE id = ?1').bind(u.id, fails, lockedUntil, lc), A.audit(lockedUntil !== u.locked_until ? 'lockout' : 'login_fail', { user: u.id })]); throw GENERIC();
      }
      const tok = randToken(32), csrf = randToken(24);
      await db.batch([db.prepare('UPDATE users SET fails = 0, lock_count = 0 WHERE id = ?1').bind(u.id), db.prepare('INSERT INTO sessions (h, user_id, csrf, created, last) VALUES (?1, ?2, ?3, ?4, ?4)').bind(await sessH(tok), u.id, csrf, tt), A.audit('login_ok', { user: u.id })]);
      return { token: tok, csrf, role: u.role, name: u.name };
    },
    /** @returns {userId, role, name, courseIds, unitIds, csrf, sid} or null. Idle/absolute expiry and deactivation are enforced here on every request. */
    async authenticate(token) {
      if (!token || token.length > 80) return null; const h = await sessH(token), tt = t();
      const s = await db.prepare("SELECT s.created, s.last, s.revoked, s.csrf, u.id AS uid, u.name, u.role, u.grant_json, u.active, u.status FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.h = ?1").bind(h).first();
      if (!s || s.revoked || !s.active || s.status !== 'active') return null;
      if (tt - s.created > CFG.sessionAbsMs || tt - s.last > CFG.sessionIdleMs) { await db.prepare('UPDATE sessions SET revoked = 1 WHERE h = ?1').bind(h).run(); return null; }
      if (tt - s.last > CFG.touchMs) await db.prepare('UPDATE sessions SET last = ?2 WHERE h = ?1').bind(h, tt).run();
      const g = jparse(s.grant_json, {}); return { userId: s.uid, name: s.name, role: s.role, courseIds: s.role === 'admin' ? ['*'] : (g.courseIds || []), unitIds: g.unitIds || [], csrf: s.csrf, sid: h };
    },
    async logout(ctx) { if (ctx) await db.batch([db.prepare('UPDATE sessions SET revoked = 1 WHERE h = ?1').bind(ctx.sid), A.audit('logout', { user: ctx.userId })]); },
    revokeUser: async (ctx, userId) => { needAdmin(ctx); await db.batch([db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?1').bind(userId), A.audit('revoke', { by: ctx.userId, user: userId })]); return { ok: true }; },
    async setActive(ctx, userId, active) {
      needAdmin(ctx); if (!active && userId === ctx.userId) throw new AuthError('INVALID', 'אי אפשר להשבית את החשבון שלכם.');
      const r = await db.batch([db.prepare("UPDATE users SET active = ?2 WHERE id = ?1 AND status = 'active'").bind(userId, active ? 1 : 0), db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?1 AND ?2 = 0').bind(userId, active ? 1 : 0), A.audit('set_active', { by: ctx.userId, user: userId, active: !!active })]);
      if (!r[0].meta.changes) throw new AuthError('NOT_FOUND', 'משתמש לא נמצא.'); return { ok: true };
    },
    async audits(ctx) { needAdmin(ctx); return (await db.prepare('SELECT at, ev, data FROM audit ORDER BY id DESC LIMIT 200').all()).results.reverse().map(r => Object.assign({ at: new Date(r.at).toISOString(), ev: r.ev }, jparse(r.data, {}))); },
    /** Server-side authorisation: viewers never write; others only inside their course scope. FAIL CLOSED. */
    authorize(ctx, action, res) {
      if (!ctx) throw new AuthError('UNAUTHENTICATED', 'נדרשת התחברות.'); const write = action === 'write';
      if (write && ctx.role === 'viewer') throw new AuthError('FORBIDDEN', 'חשבון צפייה בלבד.'); if (ctx.role === 'admin') return true;
      if (!res || !res.courseId || !ctx.courseIds.includes(res.courseId)) throw new AuthError('FORBIDDEN', 'אין הרשאה לקורס זה.'); return true;
    },
  };
  return A;
}
export function needAdmin(ctx) { if (!ctx || ctx.role !== 'admin') throw new AuthError('FORBIDDEN', 'פעולה למנהל בלבד.'); }
export { b64u };
