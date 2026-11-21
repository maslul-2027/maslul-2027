'use strict';
// MASLUL private-TEST engine host: runs the REAL server code (src/*.gs, same harness order as the browser preview) inside the Node process behind the authenticated gateway.
// SYNTHETIC DATA ONLY. Google services are NOT connected (calls return NOT_CONNECTED, never fake success). Identity comes ONLY from the gateway session:
// the host maps a session user to an engine user (email u<hash>@test.maslul.invalid) whose role/course scope mirror the gateway grant, so the engine's own
// server-side authorization (role, course scope, team assignments, N>=5 suppression, audit) applies to every call. The client never states who it is.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const GOOGLE = ['DriveApp', 'SpreadsheetApp', 'UrlFetchApp', 'ScriptApp', 'HtmlService', 'MailApp', 'GmailApp'];
function loadSource() {
  const hs = fs.readFileSync(path.join(root, 'tests', 'harness.js'), 'utf8'), order = JSON.parse(/const order = (\[[^\]]*\]);/.exec(hs)[1].replace(/'/g, '"'));
  const srcs = order.filter(f => fs.existsSync(path.join(root, 'src', f + '.gs'))).map(f => fs.readFileSync(path.join(root, 'src', f + '.gs'), 'utf8'));
  const names = Array.from(new Set(srcs.flatMap(s => Array.from(s.matchAll(/^(?:const|class) ([A-Za-z_][A-Za-z0-9_]*)/gm)).map(m => m[1])))).concat(['api', 'whoAmI']);
  return srcs.join('\n;\n') + '\n;return {' + names.join(',') + '};';
}
const clone = o => JSON.parse(JSON.stringify(o));
/** @param opts.mem the persistent engine object (lives inside the encrypted gateway state; mutated in place) */
function create(opts) {
  const mem = opts.mem; let lastErr = '', email = '', seeding = true;
  const nc = () => { throw new X.AppError('NOT_CONNECTED', 'טרם חובר: פעולה זו דורשת שירות חיצוני (Drive/PDF/OCR) שלא אושר לסביבת הבדיקה.'); };
  const gs = new Proxy({}, { get: () => nc }), cacheMem = {};
  const CacheService = { getScriptCache: () => ({ get: k => (k in cacheMem && cacheMem[k].e > Date.now() ? cacheMem[k].v : null), put: (k, v, t) => { cacheMem[k] = { v, e: Date.now() + (t || 60) * 1000 }; } }) };
  const PropertiesService = { getScriptProperties: () => ({ getProperty: () => null, setProperty: nc, setProperties: nc, deleteProperty: nc }) };
  const scon = { log() {}, warn() {}, info() {}, error(m) { lastErr = String(m); } };
  const X = new Function('console', 'CacheService', 'PropertiesService', GOOGLE.join(','), loadSource())(scon, CacheService, PropertiesService, gs, gs, gs, gs, gs, gs, gs);
  // Real local adapters (private TEST only): generated REPORT files — real PDF/XLSX bytes, stored encrypted by file_store. Every other bucket (documents, backups) and OCR/Drive stay NOT_CONNECTED until their own PR.
  if (opts.files) {
    const ef = require('./export_formats'), only = b => { if (b !== 'reports') nc(); };
    X.Adapters._fake = { saveFile(bucket, name, mime, b64) { only(bucket); return opts.files.save(bucket, name, mime, Buffer.from(b64, 'base64')); },
      readFile(id) { let r; try { r = opts.files.read(id); } catch (e) { throw new X.AppError(e.code === 'INTEGRITY' ? 'INTERNAL' : 'NOT_FOUND', e.code === 'INTEGRITY' ? 'בדיקת שלמות הקובץ נכשלה.' : 'הקובץ לא נמצא.'); } only(r.meta.bucket); return { name: r.meta.name, mime: r.meta.mime, b64: r.buf.toString('base64') }; },
      trashFile() { nc(); }, fileState(id) { return opts.files.state(id); },
      pdfFromHtml(html) { return ef.pdfFromHtml(html).toString('base64'); }, xlsxFromModel(model) { return ef.xlsxFromModel(model).toString('base64'); },
      driveReport() { nc(); }, ocrAvailable() { return false; }, ocrExtract() { nc(); } };
  }
  let tick = 0; const base = Date.now(); X.Util._clock = () => new Date(Math.max(Date.now(), base) + (++tick));
  X.Db.use({ readAll: t => (mem[t] = mem[t] || []).map(clone), insert: (t, o) => { (mem[t] = mem[t] || []).push(clone(o)); return o; },
    updateById: (t, id, p) => { const r = (mem[t] || []).find(x => String(x.id) === String(id)); if (!r) throw new X.AppError('NOT_FOUND', 'x'); Object.assign(r, clone(p)); },
    replaceAll: (t, rows) => { mem[t] = rows.map(clone); }, prepare: () => true, ensureTable: () => ({}) });
  X.Auth._emailProvider = () => (seeding ? 'demo-admin@x.com' : email);
  // never reuse an id after a restart
  let mx = 0; Object.keys(mem).forEach(t => (mem[t] || []).forEach(r => { const m = r && typeof r.id === 'string' && /^id-(\d+)$/.exec(r.id); if (m && +m[1] > mx) mx = +m[1]; })); if (mx > (X.Util._counter || 0)) X.Util._counter = mx;
  if (!(mem.Users && mem.Users.length)) { require('../scripts/lib/synthetic_seed.js')(X, mem, require('../scripts/lib/synthetic_seed.js').NAMES, () => {}); }
  seeding = false;
  const adminCtx = { email: 'demo-admin@x.com', role: 'admin', courseScope: '*' };
  const emailOf = userId => 'u' + crypto.createHash('sha256').update('maslul|' + userId).digest('hex').slice(0, 12) + '@test.maslul.invalid';
  /** Mirror the gateway grant into the engine Users table (the gateway is the authority; the engine enforces on every call). */
  function sync(id) {
    const em = emailOf(id.userId), role = id.role === 'admin' ? 'admin' : 'commander', scope = role === 'admin' ? '' : (id.courseIds || []).filter(c => c !== '*').join(',');
    const row = (mem.Users || []).find(u => String(u.email).toLowerCase() === em), t = new Date().toISOString();
    if (!row) { (mem.Users = mem.Users || []).push({ id: X.Util.uuid(), email: em, display_name: id.name || 'משתמש', role, course_scope: scope, active: true, created_at: t, created_by: 'gateway' }); }
    else if (row.role !== role || row.course_scope !== scope || row.active !== true || (id.name && row.display_name !== id.name)) { Object.assign(row, { role, course_scope: scope, active: true, display_name: id.name || row.display_name, updated_at: t, updated_by: 'gateway' }); }
    return em;
  }
  function run(fn, args) {
    let r; lastErr = '';
    try { r = fn.apply(null, args); } catch (e) { r = { ok: false, code: 'INTERNAL', message: String(e && e.message || e) }; }
    if (r && r.ok === false && r.code === 'INTERNAL' && /(Utilities|DriveApp|SpreadsheetApp|UrlFetchApp|ScriptApp|HtmlService|MailApp|GmailApp) is not defined|NOT_CONNECTED/.test(lastErr)) r = { ok: false, code: 'NOT_CONNECTED', message: 'טרם חובר: פעולה זו דורשת שירות חיצוני (Drive/PDF/OCR) שלא אושר לסביבת הבדיקה.' };
    return clone(r);
  }
  return {
    emailOf, ensure: sync,
    /** identity = {userId, role: admin|commander|viewer, name, courseIds} from the gateway session. */
    call(id, method, args) {
      email = sync(id); const viewer = id.role === 'viewer', snap = JSON.stringify(mem); this.dirty = false;
      try {
        const r = method === 'whoAmI' ? run(X.whoAmI, []) : run(X.api, [String(method), clone(args || {})]);
        if (method === 'whoAmI' && r.ok) { r.data.role = id.role; r.data.readOnly = viewer; r.data.displayName = id.name || r.data.displayName; }
        return r;
      } finally { if (viewer) { Object.keys(mem).forEach(k => delete mem[k]); Object.assign(mem, JSON.parse(snap)); } else this.dirty = JSON.stringify(mem) !== snap; email = ''; }   // a viewer can never leave a change behind
    },
    courses() { return (mem.Courses || []).map(c => ({ id: c.id, name: c.name })); },
    X,
  };
}
module.exports = { create };
