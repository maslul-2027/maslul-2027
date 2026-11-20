'use strict';
// MASLUL next-backend: internal registration -> admin approval -> PIN login -> scoped sessions -> read-only viewer (issue #6).
// Framework-agnostic and storage-injected (default: in-memory) so it can sit behind any API layer. NOT wired into the live Apps Script TEST.
// Synthetic/test use only. A 4-digit PIN is weak by itself: the controls below (scrypt, lockout, rate limits, no enumeration, expiry, revocation, audit)
// reduce risk but a SECURITY REVIEW is required before any real personnel data (see docs/PIN_AUTH_THREAT_MODEL.md).
const crypto = require('crypto');
const ROLES = ['admin', 'commander', 'user', 'viewer'];
const CFG = { maxFails: 5, lockMs: 15 * 60e3, lockMaxMs: 24 * 3600e3, ipWindowMs: 10 * 60e3, ipMax: 30, sessionAbsMs: 12 * 3600e3, sessionIdleMs: 60 * 60e3, resetTtlMs: 15 * 60e3, resetMaxTries: 3 };
class AuthError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const normPhone = p => { const d = String(p || '').replace(/[^\d]/g, '').replace(/^972/, '0'); return /^0\d{8,9}$/.test(d) ? d : null; };
const weakPin = p => /^(\d)\1{3}$/.test(p) || '0123456789'.includes(p) || '9876543210'.includes(p) || ['1212', '2580', '1004', '2000', '1122'].includes(p);
function create(opts) {
  opts = opts || {}; const pepper = String(opts.pepper || ''); if (pepper.length < 16) throw new Error('pepper (>=16 chars, from a secret store) is required');
  const db = opts.db || { users: [], requests: [], sessions: [], ipHits: {}, resets: [] }, audit = opts.audit || [], now = opts.now || (() => Date.now()), cfg = Object.assign({}, CFG, opts.cfg || {});
  const log = (ev, o) => audit.push(Object.assign({ at: new Date(now()).toISOString(), ev }, o || {}));   // never log PINs, hashes or tokens
  const hashPin = (pin, salt) => crypto.scryptSync(String(pin) + pepper, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
  const needAdmin = ctx => { if (!ctx || ctx.role !== 'admin') throw new AuthError('FORBIDDEN', 'פעולה למנהל בלבד.'); };
  const rate = ip => { const t = now(), h = (db.ipHits[ip] = (db.ipHits[ip] || []).filter(x => t - x < cfg.ipWindowMs)); if (h.length >= cfg.ipMax) { log('rate_limited', { ip }); throw new AuthError('RATE_LIMITED', 'יותר מדי ניסיונות. נסו מאוחר יותר.'); } h.push(t); };
  const GENERIC = () => new AuthError('BAD_CREDENTIALS', 'מספר טלפון או PIN שגויים, או שהחשבון עדיין לא אושר.');
  const A = {
    register(p, ip) {
      rate(ip || 'n/a'); const name = String(p && p.fullName || '').trim(), phone = normPhone(p && p.phone), pin = String(p && p.pin || '');
      if (name.length < 2 || name.length > 80) throw new AuthError('INVALID', 'שם מלא נדרש.'); if (!phone) throw new AuthError('INVALID', 'מספר טלפון לא תקין.');
      if (!/^\d{4}$/.test(pin) || weakPin(pin)) throw new AuthError('WEAK_PIN', 'PIN חייב להיות 4 ספרות ולא פשוט מדי (לא 0000/1234 וכד׳).');
      if (db.users.some(u => u.phone === phone) || db.requests.some(r => r.phone === phone && r.status === 'pending')) { log('register_dup', {}); return { ok: true, status: 'pending' }; }   // same answer: no enumeration
      const salt = crypto.randomBytes(16); db.requests.push({ id: crypto.randomUUID(), name, phone, salt: salt.toString('hex'), pin_hash: hashPin(pin, salt), status: 'pending', created_at: now() }); log('register', {}); return { ok: true, status: 'pending' };
    },
    /** One-time first-admin bootstrap: only while there are NO users and only with the deployment-secret bootstrap token (never committed). */
    seedAdmin(token, p) {
      const bt = String(opts.bootstrapToken || ''); if (bt.length < 16 || !eq(String(token || ''), bt) || db.users.length) throw new AuthError('FORBIDDEN', 'לא מורשה.');
      const phone = normPhone(p && p.phone), pin = String(p && p.pin || ''); if (!phone || !/^\d{4}$/.test(pin) || weakPin(pin)) throw new AuthError('INVALID', 'נתונים לא תקינים.');
      const salt = crypto.randomBytes(16), u = { id: crypto.randomUUID(), name: String(p.fullName || 'admin'), phone, salt: salt.toString('hex'), pin_hash: hashPin(pin, salt), role: 'admin', courseIds: ['*'], unitIds: [], active: true, fails: 0, lockedUntil: 0, lockCount: 0, must_change: false };
      db.users.push(u); log('seed_admin', { user: u.id }); return { id: u.id };
    },
    listPending(ctx) { needAdmin(ctx); return db.requests.filter(r => r.status === 'pending').map(r => ({ id: r.id, name: r.name, phone: r.phone, created_at: r.created_at })); },
    approve(ctx, requestId, grant) {
      needAdmin(ctx); const r = db.requests.find(x => x.id === requestId && x.status === 'pending'); if (!r) throw new AuthError('NOT_FOUND', 'בקשה לא נמצאה.');
      if (!grant || !ROLES.includes(grant.role)) throw new AuthError('INVALID', 'תפקיד לא תקין.'); if (grant.role !== 'admin' && !(grant.courseIds || []).length) throw new AuthError('INVALID', 'יש לשייך קורס.');
      const u = { id: crypto.randomUUID(), name: r.name, phone: r.phone, salt: r.salt, pin_hash: r.pin_hash, role: grant.role, courseIds: grant.role === 'admin' ? ['*'] : grant.courseIds.slice(), unitIds: (grant.unitIds || []).slice(), active: true, fails: 0, lockedUntil: 0, lockCount: 0, approved_by: ctx.userId, must_change: false };
      db.users.push(u); r.status = 'approved'; log('approve', { by: ctx.userId, user: u.id, role: u.role }); return { id: u.id, role: u.role };
    },
    reject(ctx, requestId) { needAdmin(ctx); const r = db.requests.find(x => x.id === requestId && x.status === 'pending'); if (!r) throw new AuthError('NOT_FOUND', 'בקשה לא נמצאה.'); r.status = 'rejected'; log('reject', { by: ctx.userId }); return { ok: true }; },
    login(p, ip) {
      rate(ip || 'n/a'); const phone = normPhone(p && p.phone), pin = String(p && p.pin || ''), u = phone && db.users.find(x => x.phone === phone), t = now();
      const dummy = Buffer.alloc(16); if (!u || !u.active) { hashPin(pin, dummy); log('login_fail', { reason: 'unknown_or_inactive' }); throw GENERIC(); }   // equal work => no timing oracle
      if (u.lockedUntil > t) { log('login_locked', { user: u.id }); throw new AuthError('LOCKED', 'החשבון ננעל זמנית. נסו מאוחר יותר או פנו למנהל.'); }
      if (!eq(hashPin(pin, Buffer.from(u.salt, 'hex')), u.pin_hash)) { u.fails++; if (u.fails >= cfg.maxFails) { u.lockCount++; u.lockedUntil = t + Math.min(cfg.lockMs * Math.pow(2, u.lockCount - 1), cfg.lockMaxMs); u.fails = 0; log('lockout', { user: u.id, count: u.lockCount }); } log('login_fail', { user: u.id }); throw GENERIC(); }
      u.fails = 0; u.lockCount = 0; const token = crypto.randomBytes(32).toString('base64url'); db.sessions.push({ h: sha(token), userId: u.id, created: t, last: t, revoked: false }); log('login_ok', { user: u.id }); return { token, role: u.role, name: u.name, mustChangePin: !!u.must_change };
    },
    authenticate(token) {
      if (!token) return null; const h = sha(token), s = db.sessions.find(x => eq(x.h, h)), t = now(); if (!s || s.revoked) return null;
      if (t - s.created > cfg.sessionAbsMs || t - s.last > cfg.sessionIdleMs) { s.revoked = true; return null; }
      const u = db.users.find(x => x.id === s.userId); if (!u || !u.active) return null; s.last = t; return { userId: u.id, role: u.role, courseIds: u.courseIds.slice(), unitIds: u.unitIds.slice() };
    },
    logout(token) { const s = db.sessions.find(x => eq(x.h, sha(token))); if (s) { s.revoked = true; log('logout', { user: s.userId }); } return { ok: true }; },
    revokeUser(ctx, userId) { needAdmin(ctx); db.sessions.filter(s => s.userId === userId).forEach(s => { s.revoked = true; }); log('revoke', { by: ctx.userId, user: userId }); return { ok: true }; },
    setActive(ctx, userId, active) { needAdmin(ctx); const u = db.users.find(x => x.id === userId); if (!u) throw new AuthError('NOT_FOUND', 'משתמש לא נמצא.'); u.active = !!active; if (!active) A.revokeUser(ctx, userId); log('set_active', { by: ctx.userId, user: userId, active: !!active }); return { ok: true }; },
    setScope(ctx, userId, grant) { needAdmin(ctx); const u = db.users.find(x => x.id === userId); if (!u || !ROLES.includes(grant.role)) throw new AuthError('INVALID', 'בקשה לא תקינה.'); u.role = grant.role; u.courseIds = grant.role === 'admin' ? ['*'] : (grant.courseIds || []).slice(); u.unitIds = (grant.unitIds || []).slice(); A.revokeUser(ctx, userId); log('set_scope', { by: ctx.userId, user: userId, role: u.role }); return { ok: true }; },
    issueResetCode(ctx, userId) { needAdmin(ctx); const u = db.users.find(x => x.id === userId); if (!u) throw new AuthError('NOT_FOUND', 'משתמש לא נמצא.'); const code = String(crypto.randomInt(0, 1e8)).padStart(8, '0'); db.resets = db.resets.filter(r => r.userId !== userId); db.resets.push({ userId, h: sha(code + pepper), exp: now() + cfg.resetTtlMs, tries: 0 }); A.revokeUser(ctx, userId); log('reset_issued', { by: ctx.userId, user: userId }); return { code, expiresInMs: cfg.resetTtlMs }; },
    resetPin(p, ip) {
      rate(ip || 'n/a'); const phone = normPhone(p && p.phone), u = phone && db.users.find(x => x.phone === phone), r = u && db.resets.find(x => x.userId === u.id), t = now(), np = String(p && p.newPin || '');
      if (!r || r.exp < t || r.tries >= cfg.resetMaxTries) throw GENERIC(); if (!eq(sha(String(p.code || '') + pepper), r.h)) { r.tries++; log('reset_fail', { user: u.id }); throw GENERIC(); }
      if (!/^\d{4}$/.test(np) || weakPin(np)) throw new AuthError('WEAK_PIN', 'PIN חלש מדי.'); const salt = crypto.randomBytes(16); u.salt = salt.toString('hex'); u.pin_hash = hashPin(np, salt); u.fails = 0; u.lockedUntil = 0; u.lockCount = 0; db.resets = db.resets.filter(x => x !== r); log('reset_ok', { user: u.id }); return { ok: true };
    },
    /** Server-side authorization for every operation: viewers can never write; others only inside their course/unit scope. */
    authorize(ctx, action, res) {
      if (!ctx) throw new AuthError('UNAUTHENTICATED', 'נדרשת התחברות.'); const write = action === 'write';
      if (write && ctx.role === 'viewer') { log('deny_viewer_write', { user: ctx.userId }); throw new AuthError('FORBIDDEN', 'חשבון צפייה בלבד.'); }
      if (ctx.role === 'admin') return true;
      // FAIL CLOSED: a non-admin request whose course (or, for unit-scoped users, unit) cannot be established is refused — never "no scope given => allowed".
      if (!res || !res.courseId || !ctx.courseIds.includes(res.courseId)) { log('deny_scope', { user: ctx.userId }); throw new AuthError('FORBIDDEN', 'אין הרשאה לקורס זה.'); }
      if (ctx.unitIds.length && (!res.unitId || !ctx.unitIds.includes(res.unitId))) { log('deny_scope', { user: ctx.userId }); throw new AuthError('FORBIDDEN', 'אין הרשאה ליחידה זו.'); }
      if (write && ctx.role === 'user' && res && res.privileged) throw new AuthError('FORBIDDEN', 'פעולה למפקד/מנהל.'); return true;
    },
    db, audit, cfg,
  };
  return A;
}
module.exports = { create, AuthError, CFG, ROLES, normPhone, weakPin };
