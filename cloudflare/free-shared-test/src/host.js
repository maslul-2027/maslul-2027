// Engine host for Workers: the REAL business rules (src/*.gs compiled into engine.generated.js) behind the gateway's identity. Same contract as backend_next/engine_host.js,
// but storage is the D1-backed table set of the current request (see store.js). Google services are NOT connected (calls answer NOT_CONNECTED, never fake success).
import { loadEngine } from './engine.generated.js';
import { loadTables, diff, commit } from './store.js';
const clone = o => JSON.parse(JSON.stringify(o));
/** Rows are flat sheet-style records (scalars), so a shallow copy is a faithful, ~10x cheaper stand-in for the JSON round trip; anything nested is still deep-copied. Cloning dominated the CPU of dashboard routes. */
const rowClone = r => { const o = {}; for (const k in r) { const v = r[k]; if (v === undefined || typeof v === 'function') continue; o[k] = v !== null && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; } return o; };
const NC_MSG = 'טרם חובר: פעולה זו דורשת שירות חיצוני (Drive/PDF/OCR/אחסון קבצים) שאינו חלק מסביבת הבדיקה החינמית.';
const APPEND_ONLY = new Set(['AuditLog']);
let X = null, cur = null, lastErr = '', email = '', lastTick = 0;
function nc() { throw new X.AppError('NOT_CONNECTED', NC_MSG); }
function engine() {
  if (X) return X;
  const gs = new Proxy({}, { get: () => nc }), cacheMem = {};
  const CacheService = { getScriptCache: () => ({ get: k => (k in cacheMem && cacheMem[k].e > Date.now() ? cacheMem[k].v : null), put: (k, v, t) => { cacheMem[k] = { v, e: Date.now() + (t || 60) * 1000 }; } }) };
  const PropertiesService = { getScriptProperties: () => ({ getProperty: () => null, setProperty: nc, setProperties: nc, deleteProperty: nc }) };
  const scon = { log() {}, warn() {}, info() {}, error(m) { lastErr = String(m); } };
  X = loadEngine(scon, CacheService, PropertiesService, gs, gs, gs, gs, gs, gs, gs);
  X.Util._clock = () => { lastTick = Math.max(Date.now(), lastTick + 1); return new Date(lastTick); };
  // The engine's Node fallbacks are TEST-ONLY (counter ids collide across isolates; Math.random tokens). On Workers use the platform CSPRNG.
  X.Util.uuid = () => crypto.randomUUID();
  X.Util.randomToken = () => { const b = crypto.getRandomValues(new Uint8Array(24)); return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); };
  const known = t => typeof t === 'string' && Object.prototype.hasOwnProperty.call(X.TABLES, t);   // only registered tables exist; an invented name behaves like an empty table and can never be persisted
  const miss = t => { if (cur && known(t)) cur.missing.add(t); }, touch = (t, id) => { const d = cur.dirty[t] || (cur.dirty[t] = { all: false, ids: new Set() }); if (id == null) d.all = true; else d.ids.add(String(id)); };
  X.Db.use({
    readAll: t => { if (!known(t)) return []; if (!cur || !cur.mem[t]) { miss(t); return []; } return cur.mem[t].map(rowClone); },
    insert: (t, o) => { if (!known(t)) throw new X.AppError('INTERNAL', 'unknown table'); if (cur && !cur.mem[t] && APPEND_ONLY.has(t)) { (cur.appends[t] = cur.appends[t] || []).push(clone(o)); return o; }   // append-only log: no need to read the whole (ever-growing) table just to add a row
      if (!cur || !cur.mem[t]) { miss(t); return o; } cur.mem[t].push(rowClone(o)); touch(t, o && o.id); return o; },
    updateById: (t, id, p) => { if (!known(t)) throw new X.AppError('NOT_FOUND', 'x'); if (!cur || !cur.mem[t]) { miss(t); return; } const r = cur.mem[t].find(x => String(x.id) === String(id)); if (!r) throw new X.AppError('NOT_FOUND', 'x'); Object.assign(r, rowClone(p)); touch(t, r.id); },
    replaceAll: (t, rows) => { if (!known(t)) throw new X.AppError('INTERNAL', 'unknown table'); if (!cur || !cur.mem[t]) { miss(t); return; } cur.mem[t] = rows.map(rowClone); touch(t, null); },
    prepare: () => true, ensureTable: () => ({}),
  });
  X.Auth._emailProvider = () => email;
  return X;
}
export const emailOf = async userId => { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('maslul|' + userId)); return 'u' + Array.from(new Uint8Array(h), x => x.toString(16).padStart(2, '0')).join('').slice(0, 12) + '@test.maslul.invalid'; };
const emailCache = new Map();
export async function engineEmail(userId) { if (!emailCache.has(userId)) emailCache.set(userId, await emailOf(userId)); return emailCache.get(userId); }
/** Mirror the gateway user into the engine Users table (the gateway is the authority; the engine re-enforces on every call). Operates on cur.mem. */
function syncUser(id, em) {
  const x = engine(), role = id.role === 'admin' ? 'admin' : 'commander', scope = role === 'admin' ? '' : (id.courseIds || []).filter(c => c !== '*').join(','), users = cur.mem.Users, t = new Date().toISOString();
  if (!users) { cur.missing.add('Users'); return; }
  const row = users.find(u => String(u.email).toLowerCase() === em);
  if (!row) users.push({ id: x.Util.uuid(), email: em, display_name: id.name || 'משתמש', role, course_scope: scope, active: true, created_at: t, created_by: 'gateway' });
  else if (row.role !== role || row.course_scope !== scope || row.active !== true || (id.name && row.display_name !== id.name)) Object.assign(row, { role, course_scope: scope, active: true, display_name: id.name || row.display_name, updated_at: t, updated_by: 'gateway' });
}
export function ensureUser(id, em) { engine(); syncUser(id, em); }
const run = (fn, args) => {
  let r; lastErr = '';
  try { r = fn.apply(null, args); } catch (e) { r = { ok: false, code: 'INTERNAL', message: String(e && e.message || e) }; }
  if (r && r.ok === false && r.code === 'INTERNAL' && /(Utilities|DriveApp|SpreadsheetApp|UrlFetchApp|ScriptApp|HtmlService|MailApp|GmailApp) is not defined|NOT_CONNECTED/.test(lastErr)) r = { ok: false, code: 'NOT_CONNECTED', message: NC_MSG };
  return r;   // plain JSON-able data; the Response serialises it (the engine's rows were already copies)
};
/** Synchronous engine call on the current request's tables. identity = {userId, role: admin|commander|viewer, name, courseIds}. */
export function callEngine(id, em, method, args) {
  const x = engine(); email = em; syncUser(id, em);
  try {
    const r = method === 'whoAmI' ? run(x.whoAmI, []) : run(x.api, [String(method), clone(args || {})]);
    if (method === 'whoAmI' && r.ok) { r.data.role = id.role; r.data.readOnly = id.role === 'viewer'; r.data.displayName = id.name || r.data.displayName; }
    return r;
  } finally { email = ''; }
}
export const allTableNames = () => Object.keys(engine().TABLES);
/** run fn with `mem` as the current table set (used by the start-up warm-up; nothing is persisted) */
export function withMem(mem, fn) { engine(); cur = { mem, missing: new Set(), appends: {}, dirty: {} }; try { return fn(); } finally { cur = null; } }
export const courseList = () => { if (!cur.mem.Courses) { cur.missing.add('Courses'); return []; } return cur.mem.Courses.map(c => ({ id: c.id, name: c.name })); };
const HINT = new Map();   // method -> table names learned in this isolate (the committed route_tables.generated.js seeds it)
export function seedHints(map) { Object.keys(map || {}).forEach(m => HINT.set(m, new Set(map[m]))); }
export const hintFor = m => Array.from(HINT.get(m) || []);
/**
 * Run `fn(mem)` (synchronous, may call callEngine) inside ONE D1 transaction with optimistic retry.
 *  - tables are discovered on demand (unloaded table access => the attempt is discarded and re-run with it loaded) and remembered per method;
 *  - readOnly: nothing is ever written (viewer / pure reads that must not persist);
 *  - fn may return { out, extra: db => [statements] } — extra statements commit in the same transaction (users, sessions, audit).
 */
export async function transaction(db, key, base, fn, opt) {
  opt = opt || {}; const tables = new Set(['Users'].concat(base || [], hintFor(key)));
  for (let attempt = 0; attempt < 4; attempt++) {
    let loaded, res, passes = 0;
    for (;;) {
      loaded = await loadTables(db, tables); cur = { mem: loaded.mem, missing: new Set(), appends: {}, dirty: {} };
      try { res = fn(cur.mem); } finally { /* cur reset below */ }
      const miss = Array.from(cur.missing), appends = cur.appends; loaded.dirty = cur.dirty; cur = null; loaded.appends = appends;
      if (!miss.length) break; if (++passes > 6) throw new Error('table discovery did not converge'); miss.forEach(t => tables.add(t));
    }
    HINT.set(key, new Set(tables));
    const out = res && Object.prototype.hasOwnProperty.call(res, 'out') ? res.out : res, extra = res && res.extra ? res.extra(db) : [];
    const changes = opt.readOnly ? [] : diff(loaded, loaded.mem, loaded.dirty).concat(Object.keys(loaded.appends || {}).map(t => ({ t, up: loaded.appends[t].map(r => JSON.stringify(r)), del: [] })));
    if (!changes.length && !extra.length) return { out, wrote: false, tables: Array.from(tables) };
    if (await commit(db, loaded, changes, extra)) return { out, wrote: changes.length > 0 || extra.length > 0, tables: Array.from(tables), changes: changes.map(c => c.t) };
  }
  const e = new Error('CONFLICT'); e.code = 'BUSY'; throw e;
}
