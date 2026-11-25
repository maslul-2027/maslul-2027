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
  // Real local adapters (private TEST only): generated REPORT files and engine BACKUPS — real bytes, stored encrypted by file_store. Every other bucket (documents) and OCR/Drive stay NOT_CONNECTED until their own PR.
  // A backup = the engine's table snapshot (JSON, encrypted) + a byte-for-byte snapshot of every stored file (file_bundle). Both are taken inside ONE synchronous engine call: no report can be created in between.
  const RANDOM = require('crypto').randomUUID, BK = { files: opts.files || null, bundle: opts.bundle || null };
  if (opts.files) {
    const ef = require('./export_formats'), guard = require('./content_guard'), DOC_QUOTA = 300 * 1024 * 1024, allow = b => { if (b !== 'reports' && b !== 'backups' && b !== 'documents') nc(); };
    X.Adapters._fake = { saveFile(bucket, name, mime, b64) { allow(bucket); const raw = Buffer.from(b64, 'base64');
        if (bucket === 'documents') {      // strict content guard + per-installation quota; the engine already checked size/extension/MIME/magic and scope. Never a user-chosen path: ids are random.
          const ext = (/\.([A-Za-z0-9]{2,5})$/.exec(String(name)) || [])[1]; try { guard.inspect(String(ext || '').toLowerCase(), raw); } catch (e) { throw new X.AppError('VALIDATION', e.message); }
          const used = (mem.Documents || []).reduce((a, d) => a + (Number(d.size_bytes) || 0), 0); if (used + raw.length > DOC_QUOTA) throw new X.AppError('VALIDATION', 'חריגה ממכסת אחסון המסמכים של סביבת הבדיקה.'); }
        const f = opts.files.save(bucket, name, mime, raw);
        if (bucket === 'backups') { if (!opts.bundle) { opts.files.trash(f.id); nc(); } const preRestore = /^backup_pre_restore_/.test(String(name)); let snap; try { snap = opts.bundle.snapshot(f.id, { allowPartial: preRestore }); } catch (e) { opts.files.trash(f.id); throw new X.AppError(e.code === 'TOO_LARGE' ? 'VALIDATION' : 'INTERNAL', e.code === 'CORRUPT_FILE' ? 'הגיבוי נעצר: קובץ שמור אחד או יותר (דוח/מסמך) אינו תקין, ולכן לא נוצר גיבוי חלקי. שחזרו מגיבוי מאומת קודם או פנו למנהל המערכת.' : 'לא ניתן ליצור צילום עקבי של הקבצים: ' + String(e.message).slice(0, 120)); }
          // every file the system state points to must be inside the snapshot — otherwise the "full" backup could not restore it. Only the automatic pre_restore safety net (taken because the live store may be damaged) is exempt; its gaps are listed in the manifest
          const have = new Set(snap.ids || []), refs = [].concat((mem.Documents || []).map(d => d.drive_file_id), (mem.ReportJobs || []).map(j => j.file_id)).filter(Boolean), miss = refs.filter(id => !have.has(String(id)));
          if (miss.length && !preRestore) { try { opts.bundle.remove(f.id); } catch (e2) { /* removed with the blob below */ } opts.files.trash(f.id); throw new X.AppError('INTERNAL', 'הגיבוי נעצר: ' + miss.length + ' קבצים שהמערכת מפנה אליהם חסרים באחסון, ולכן לא נוצר גיבוי חלקי. שחזרו מגיבוי מאומת קודם או פנו למנהל המערכת.'); } }
        return f; },
      readFile(id) { let r; try { r = opts.files.read(id); } catch (e) { throw new X.AppError(e.code === 'INTEGRITY' ? 'INTERNAL' : 'NOT_FOUND', e.code === 'INTEGRITY' ? 'בדיקת שלמות הקובץ נכשלה.' : 'הקובץ לא נמצא.'); } allow(r.meta.bucket); return { name: r.meta.name, mime: r.meta.mime, b64: r.buf.toString('base64') }; },
      trashFile(id) { let r; try { r = opts.files.read(id); } catch (e) { if (e.code === 'NOT_FOUND') return; throw new X.AppError('INTERNAL', 'הקובץ אינו ניתן למחיקה.'); } if (r.meta.bucket !== 'backups') nc(); opts.files.trash(id); if (opts.bundle) opts.bundle.remove(id); },
      fileState(id) { const st = opts.files.state(id); return st === 'exists' ? 'exists' : 'trashed'; },
      pdfFromHtml(html) { return ef.pdfFromHtml(html).toString('base64'); }, xlsxFromModel(model) { return ef.xlsxFromModel(model).toString('base64'); },
      driveReport() { nc(); }, ocrAvailable() { return false; }, ocrExtract() { nc(); } };
  }
  const intentFile = opts.files ? require('path').join(opts.files.dir, '.restore-intent.json') : '', fsx = require('fs');
  // Crash safety: a restore that was cut off between "files staged" and "files moved" is finished (additive, never destructive) or discarded at the next start.
  if (opts.files && opts.bundle && fsx.existsSync(intentFile)) { try { const it = JSON.parse(fsx.readFileSync(intentFile, 'utf8')); if (it && /^[0-9a-f-]{36}$/.test(String(it.stage))) opts.bundle.commit(it.stage); } catch (e) { /* unreadable intent: staging is ignored, live files untouched */ } try { fsx.unlinkSync(intentFile); } catch (e) { /* gone */ } }
  const plans = new Map(), PLAN_TTL = 10 * 60 * 1000, bkJob = id => (mem.BackupJobs || []).find(j => String(j.id) === String(id));
  const fail = (code, message) => ({ ok: false, code, message });
  /** Backup routes need the file bundle to be real too: engine success alone is never reported as a backup/restore success. */
  function backupHook(id, method, args, inner) {
    if (!opts.files || !opts.bundle || id.role !== 'admin') return inner();      // non-admins always reach the engine's own FORBIDDEN
    const A = args || {}, uid = String(id.userId);
    if (method === 'backup.plan' || method === 'backup.verify') {
      const r = inner(); if (!r.ok) return r; const j = bkJob(A.id); const fb = j && j.file_id ? opts.bundle.diff(j.file_id) : { ok: false, problems: ['backup file set missing'] };
      if (method === 'backup.verify' && !fb.ok) return fail('CORRUPT', 'מערך הקבצים של הגיבוי פגום או חסר: ' + (fb.problems[0] || '') + ' — לא ישוחזר.');
      r.data.files = { ok: !!fb.ok, count: fb.count || 0, bytes: fb.bytes || 0, missing: fb.missing || 0, divergent: fb.divergent || 0, present: fb.present || 0, newer_kept: fb.newer || 0, skipped_corrupt: fb.skipped_corrupt || 0, problems: fb.problems || [] };
      if (method === 'backup.plan') plans.set(uid + '|' + String(A.id), Date.now()); return r;
    }
    if (method === 'backup.prune') {
      const keep = A.keep === undefined ? 7 : A.keep; if (!Number.isInteger(keep) || keep < 3 || keep > 365) return fail('VALIDATION', 'מחיקת גיבויים ישנים: יש לשמור לפחות 3 (עד 365).');
      const okJobs = (mem.BackupJobs || []).filter(j => j.status === 'ok' && j.file_id && (j.kind === 'daily' || j.kind === 'manual')).sort((a, b) => a.started_at < b.started_at ? 1 : -1), would = okJobs.slice(keep).length;
      if (A.dry_run === true) return { ok: true, data: { dry_run: true, would_expire: would, kept: Math.min(okJobs.length, keep) } };
      if (A.confirm !== 'PRUNE') return fail('VALIDATION', 'נדרש אישור מפורש (confirm = "PRUNE"). מומלץ להריץ קודם dry_run.');
      return inner();
    }
    if (method === 'backup.restore' || method === 'backup.recover') {
      let srcJob = null;
      if (method === 'backup.restore') { srcJob = bkJob(A.id); const seen = plans.get(uid + '|' + String(A.id)); if (srcJob) plans.delete(uid + '|' + String(A.id)); if (srcJob && (!seen || Date.now() - seen > PLAN_TTL)) return fail('VALIDATION', 'יש להציג את תכנית השחזור (בדיקת ההבדלים) לפני אישור השחזור — ואז לאשר מחדש.'); }
      else { const m = bkJob(A.id), mm = m && /pre_restore=(\S+)/.exec(String(m.note || '')); srcJob = mm ? bkJob(mm[1]) : null; }
      if (!srcJob || !srcJob.file_id) return inner();      // unknown id: the engine answers NOT_FOUND
      const stageId = RANDOM(); let st; try { st = opts.bundle.stage(srcJob.file_id, stageId); } catch (e) { return fail('CORRUPT', 'מערך הקבצים של הגיבוי לא עבר אימות (' + String(e.message).slice(0, 120) + '). לא בוצע שום שינוי.'); }
      fsx.writeFileSync(intentFile, JSON.stringify({ stage: stageId, at: new Date().toISOString() }), { mode: 0o600 });
      let r; try { r = inner(); } catch (e) { opts.bundle.abort(stageId); try { fsx.unlinkSync(intentFile); } catch (x) { /* gone */ } throw e; }
      if (r && r.ok && r.data && r.data.restored) { try { const c = opts.bundle.commit(stageId); r.data.files_restored = { added: st.add, repaired: st.repair, moved: c.moved, quarantined: c.quarantined }; } catch (e) { r.data.warning_code = 'FILES_COMMIT_PENDING'; r.data.warning = 'מצב הנתונים שוחזר; העתקת קבצי הדוחות תושלם בהפעלה הבאה של השרת.'; return r; } }
      else opts.bundle.abort(stageId);
      try { fsx.unlinkSync(intentFile); } catch (e) { /* gone */ } return r;
    }
    return inner();
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
      if (method === 'docs.upload' && args && args.data && typeof args.data.file_name === 'string') args = Object.assign({}, args, { data: Object.assign({}, args.data, { file_name: args.data.file_name.replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '_') }) });   // bidi / zero-width tricks in a file name (engine src is frozen; sanitise at the host)
      try {
        const r = method === 'whoAmI' ? run(X.whoAmI, []) : (/^backup\./.test(String(method)) ? backupHook(id, String(method), args, () => run(X.api, [String(method), clone(args || {})])) : run(X.api, [String(method), clone(args || {})]));
        if (method === 'whoAmI' && r.ok) { r.data.role = id.role; r.data.readOnly = viewer; r.data.displayName = id.name || r.data.displayName; }
        return r;
      } finally { if (viewer) { Object.keys(mem).forEach(k => delete mem[k]); Object.assign(mem, JSON.parse(snap)); } else this.dirty = JSON.stringify(mem) !== snap; email = ''; }   // a viewer can never leave a change behind
    },
    courses() { return (mem.Courses || []).map(c => ({ id: c.id, name: c.name })); },
    X,
  };
}
module.exports = { create };
