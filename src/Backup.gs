/**
 * Backup & point-in-time restore — v1.0.0. Admin only.
 * A backup = one JSON file (all tables of BOTH spreadsheets, private ones included) + SHA-256 checksum, stored in a PRIVATE Drive folder; the job row never exposes the file id.
 * Daily backup runs from a time-driven trigger (dailyJob_). Retention keeps the newest N files (default 7); a pruned backup's FILE is trashed but its BackupJobs row stays (status 'expired').
 * Restore (explicit confirmation + reason): verifies the checksum, takes an automatic 'pre_restore' backup first, replaces the data tables, and rolls back to the pre-restore state if anything fails.
 * NOT restored (kept as they are): AuditLog, BackupJobs, ReportJobs, Users (so a restore can never lock the admin out or erase the trail), SchemaMeta. All soldier-update form links are revoked after a restore.
 */
const Backup = {
  EXCLUDED: ['AuditLog', 'BackupJobs', 'ReportJobs', 'Users', 'SchemaMeta'],
  KEEP_DEFAULT: 7,
  KINDS: ['manual', 'daily', 'pre_restore', 'pre_migration'],
  DAILY_HANDLER: 'dailyJob_',                       // F-2: private (trailing underscore) => not callable via google.script.run
  DAILY_HANDLERS: ['dailyJob_', 'dailyJob'],         // 'dailyJob' = legacy public name (<= r3-stg1): removed on reinstall

  snapshot_() { const t = {}; Object.keys(TABLES).forEach(function (n) { t[n] = Db.all(n); }); return { app_version: APP.VERSION, schema_version: APP.SCHEMA_VERSION, created_at: Util.nowIso(), tables: t }; },
  canon_(snap) { return JSON.stringify(snap); },

  create(ctx, kind) {
    Policy.require(ctx, 'backup.run', {}); if (Backup.KINDS.indexOf(kind) === -1) throw new AppError('VALIDATION', 'סוג גיבוי לא תקין.');
    return Locks.run(function () {
      const started = Util.nowIso(), snap = Backup.snapshot_(), json = Backup.canon_(snap), sum = Util.sha256(json), counts = Object.keys(snap.tables).reduce(function (a, k) { return a + snap.tables[k].length; }, 0);
      const job = { id: Util.uuid(), kind: kind, requested_by: ctx.email, started_at: started, finished_at: '', status: 'running', file_id: '', note: '', tables_count: Object.keys(snap.tables).length, rows_count: counts, checksum: sum, app_version: APP.VERSION };
      Db.insert('BackupJobs', job);
      try {
        const b64 = Util.b64encode(json), f = Adapters.saveFile('backups', 'backup_' + kind + '_' + started.replace(/[:.]/g, '-') + '.json', 'application/json', b64);
        Db.update('BackupJobs', job.id, { status: 'ok', finished_at: Util.nowIso(), file_id: f.id });
      } catch (e) { Db.update('BackupJobs', job.id, { status: 'failed', finished_at: Util.nowIso(), note: String(e && e.message || e).slice(0, 200) }); throw e; }
      let auditStatus = 'ok';
      try {
        Audit.log(ctx, { action: 'BACKUP_CREATE', table: 'BackupJobs', recordId: job.id, after: { kind: kind, rows: counts, checksum: sum } });
      } catch (auditError) {
        auditStatus = 'failed';
        // The backup file and job are already committed. Never report this as a failed backup.
        // Store a fixed, non-sensitive warning; do not persist exception text.
        try { Db.update('BackupJobs', job.id, { note: 'AUDIT_WRITE_FAILED' }); } catch (noteError) { /* response still reports the committed backup */ }
      }
      const result = Backup.view_(Db.get('BackupJobs', job.id));
      result.audit_status = auditStatus;
      if (auditStatus === 'failed') { result.warning_code = 'AUDIT_WRITE_FAILED'; result.warning = 'הגיבוי נשמר בהצלחה, אך רישום הביקורת נכשל. יש לדווח למנהל המערכת.'; }
      return result;
    });
  },
  view_(j) { return { id: j.id, kind: j.kind, requested_by: j.requested_by, started_at: j.started_at, finished_at: j.finished_at, status: j.status, tables_count: Number(j.tables_count), rows_count: Number(j.rows_count), checksum: j.checksum, app_version: j.app_version, note: j.note }; },
  list(ctx) { Policy.require(ctx, 'backup.run', {}); return Db.all('BackupJobs').map(Backup.view_).sort(function (a, b) { return a.started_at < b.started_at ? 1 : -1; }); },

  load_(ctx, jobId) {
    const j = Db.get('BackupJobs', Util.str(typeof jobId === 'string' ? jobId : '')); if (!j || j.status !== 'ok' || !j.file_id) throw new AppError('NOT_FOUND', 'הגיבוי לא נמצא או אינו זמין.');
    let f; try { f = Adapters.readFile(j.file_id); } catch (e) { throw new AppError('NOT_FOUND', 'קובץ הגיבוי אינו זמין.'); }
    const json = Util.b64decodeStr(f.b64); if (Util.sha256(json) !== j.checksum) throw new AppError('CORRUPT', 'סכום הביקורת של הגיבוי אינו תואם — הגיבוי פגום ולא ישוחזר.');
    let snap; try { snap = JSON.parse(json); } catch (e) { throw new AppError('CORRUPT', 'קובץ הגיבוי פגום.'); }
    if (!snap || typeof snap.tables !== 'object') throw new AppError('CORRUPT', 'קובץ הגיבוי פגום.'); return { job: j, snap: snap };
  },
  verify(ctx, jobId) { Policy.require(ctx, 'backup.run', {}); const b = Backup.load_(ctx, jobId), pf = Backup.preflight_(b.snap, 'גיבוי'); return { ok: true, tables: Object.keys(b.snap.tables).length, rows: pf.rows, preflight: pf, app_version: b.snap.app_version, schema_version: b.snap.schema_version }; },
  plan(ctx, jobId) {
    Policy.require(ctx, 'backup.restore', {}); const b = Backup.load_(ctx, jobId), rows = [];
    Object.keys(TABLES).forEach(function (n) { if (Backup.EXCLUDED.indexOf(n) !== -1) return; const now = Db.all(n).length, then = (b.snap.tables[n] || []).length; rows.push({ table: n, now: now, backup: then, change: then - now }); });
    return { backup: Backup.view_(b.job), tables: rows, excluded: Backup.EXCLUDED, newer_than_app: Number(b.snap.schema_version) > APP.SCHEMA_VERSION };
  },
  /** Names of the tables a restore replaces (everything except EXCLUDED), in a fixed order. */
  restorable_() { return Object.keys(TABLES).filter(function (n) { return Backup.EXCLUDED.indexOf(n) === -1; }); },

  /**
   * v1.0.1 PREFLIGHT — runs before ANY write, on the backup AND on the pre-restore snapshot (so a rollback is known to be possible).
   * Checks: structure (object of tables; no unknown table; every restorable table present unless the backup is of an OLDER schema), every table an array of plain
   * objects, keys within the schema columns, scalar values only, cell-size limit, non-empty unique ids, row cap, and (through Db.prepare) that the LIVE sheet has the
   * sheet + every schema column + every key. Returns {tables, rows}; throws PREFLIGHT_FAILED with a list of problems (max 20) and writes nothing.
   */
  preflight_(snap, label) {
    const bad = [], add = function (m) { if (bad.length < 20) bad.push(m); }; let rows = 0, tables = 0;
    if (!snap || typeof snap !== 'object' || !snap.tables || typeof snap.tables !== 'object' || Array.isArray(snap.tables)) throw new AppError('PREFLIGHT_FAILED', 'מבנה הגיבוי אינו תקין (' + label + ').', ['tables']);
    Object.keys(snap.tables).forEach(function (n) { if (!Object.prototype.hasOwnProperty.call(TABLES, n)) add('טבלה לא מוכרת בגיבוי: ' + n); });
    const older = Number(snap.schema_version) < APP.SCHEMA_VERSION;
    Backup.restorable_().forEach(function (n) {
      const t = snap.tables[n];
      if (t === undefined) { if (!older) add('חסרה טבלה בגיבוי: ' + n); return; }
      if (!Array.isArray(t)) { add(n + ': אינה רשימת שורות'); return; }
      if (t.length > 200000) { add(n + ': יותר מדי שורות'); return; }
      const cols = TABLES[n].cols, hasId = cols.indexOf('id') !== -1, seen = Object.create(null); tables++; rows += t.length;
      t.forEach(function (r, i) {
        if (!r || typeof r !== 'object' || Array.isArray(r)) { add(n + '[' + i + ']: שורה אינה אובייקט'); return; }
        Object.keys(r).forEach(function (k) {
          if (cols.indexOf(k) === -1) add(n + '[' + i + ']: עמודה לא מוכרת ' + k);
          const v = r[k]; const ty = typeof v;
          if (!(v === null || ty === 'string' || ty === 'number' || ty === 'boolean')) add(n + '[' + i + '].' + k + ': ערך שאינו סקלרי');
          else if (ty === 'number' && !Number.isFinite(v)) add(n + '[' + i + '].' + k + ': מספר לא סופי');
          else if (ty === 'string' && v.length > 49000) add(n + '[' + i + '].' + k + ': ערך ארוך מדי לתא');
        });
        if (hasId) { const id = r.id; if (id === undefined || id === null || String(id) === '') add(n + '[' + i + ']: חסר id'); else if (seen[String(id)]) add(n + '[' + i + ']: id כפול ' + id); else seen[String(id)] = 1; }
      });
    });
    if (bad.length) throw new AppError('PREFLIGHT_FAILED', 'בדיקת תקינות הגיבוי נכשלה (' + label + '): ' + bad[0] + (bad.length > 1 ? ' (ועוד ' + (bad.length - 1) + ')' : '') + '. לא בוצע שום שינוי.', bad);
    Backup.restorable_().forEach(function (n) { try { Db.prepare(n, snap.tables[n] || []); } catch (e) { add(n + ': ' + String(e && e.message || e).slice(0, 120)); } });
    if (bad.length) throw new AppError('PREFLIGHT_FAILED', 'מבנה הגיליון החי אינו תואם לגיבוי (' + label + '): ' + bad[0] + '. לא בוצע שום שינוי.', bad);
    return { tables: tables, rows: rows };
  },
  /** Every column of every row, compared as text, order-insensitive by id — used after each table write and after each rollback. */
  sameRows_(table, want) {
    const cols = TABLES[table].cols, have = Db.all(table), key = function (r) { return String(r.id); };
    if (have.length !== want.length) return false;
    // Row IDs are persisted/imported values; a null-prototype index avoids collisions with Object.prototype.
    const idx = Object.create(null); have.forEach(function (r) { idx[key(r)] = r; });
    for (let i = 0; i < want.length; i++) {
      const h = idx[key(want[i])]; if (!h) return false;
      for (let j = 0; j < cols.length; j++) { const a = want[i][cols[j]], b = h[cols[j]]; if (String(a === undefined || a === null ? '' : a) !== String(b === undefined || b === null ? '' : b)) return false; }
    }
    return true;
  },
  inProgress_() { return Db.where('BackupJobs', function (j) { return j.kind === 'restore' && (j.status === 'restoring' || j.status === 'rollback_failed'); })[0] || null; },

  /**
   * v1.0.1 RESTORE. Order: authorise -> lock -> (re-authorise inside the lock) -> refuse if another restore is marked in progress -> load + checksum -> PREFLIGHT backup AND live sheets
   * AND the pre-restore snapshot (nothing written yet) -> pre_restore backup file -> in-progress marker -> per table: mark it TOUCHED *before* replaceAll, write, verify every row ->
   * on ANY failure roll back EVERY touched table (the failing one included) from the in-memory snapshot, each table attempted independently, retried once, then verified.
   * A rollback that cannot be completed/verified is reported explicitly (ROLLBACK_FAILED naming the tables + the pre_restore backup to use) and the marker stays 'rollback_failed'.
   * LIMITS: Sheets offers no transaction. A crash/timeout of the whole script mid-restore leaves the marker 'restoring' (further restores refused) and recover() is required.
   */
  restore(ctx, jobId, p) {
    p = p || {}; Policy.require(ctx, 'backup.restore', {}); if (p.confirm !== 'RESTORE') throw new AppError('VALIDATION', 'נדרש אישור מפורש (confirm = "RESTORE").'); const reason = Mods.reason_(p.reason, true);
    return Locks.run(function () {
      Policy.require(ctx, 'backup.restore', {});
      const live = Backup.inProgress_(); if (live) throw new AppError('RESTORE_IN_PROGRESS', 'שחזור אחר מסומן כרץ/לא הושלם (' + live.id + ') — לא ניתן להתחיל שחזור נוסף. אם הוא נקטע, יש להפעיל recover.');
      const b = Backup.load_(ctx, jobId); if (Number(b.snap.schema_version) > APP.SCHEMA_VERSION) throw new AppError('VALIDATION', 'הגיבוי נוצר בגרסת סכמה חדשה מהמערכת הנוכחית.');
      return Backup.apply_(ctx, b.job, b.snap, reason, 'restore');
    });
  },
  /** Shared engine (restore + recover). Must be called inside the lock. */
  apply_(ctx, srcJob, snap, reason, mode) {
    Backup.preflight_(snap, 'גיבוי'); const before = Backup.snapshot_(); Backup.preflight_(before, 'מצב נוכחי (לצורך rollback)');
    const pre = Backup.create(ctx, 'pre_restore'), names = Backup.restorable_(), started = Util.nowIso(), touched = [];
    const marker = { id: Util.uuid(), kind: 'restore', requested_by: ctx.email, started_at: started, finished_at: '', status: 'restoring', file_id: '', note: 'pre_restore=' + pre.id + ' from=' + srcJob.id + ' mode=' + mode, tables_count: 0, rows_count: 0, checksum: srcJob.checksum, app_version: APP.VERSION };
    Db.insert('BackupJobs', marker);
    let failure = null;
    try {
      names.forEach(function (n) { touched.push(n); const want = snap.tables[n] || []; Db.replaceAll(n, want); if (!Backup.sameRows_(n, want)) throw new Error('verify failed: ' + n); });
      Db.where('FormTokens', function (t) { return !t.used_at; }).forEach(function (t) { Db.update('FormTokens', t.id, { used_at: 'revoked:restore' }); });
    } catch (e) { failure = e; }
    if (!failure) {
      Db.update('BackupJobs', marker.id, { status: 'ok', finished_at: Util.nowIso(), tables_count: names.length, note: marker.note + ' — ' + reason });
      let auditStatus = 'ok';
      try {
        Audit.log(ctx, { action: mode === 'recover' ? 'BACKUP_RECOVER' : 'BACKUP_RESTORE', table: 'BackupJobs', recordId: srcJob.id, after: { restored_tables: names.length, pre_restore_backup: pre.id }, reason: reason });
      } catch (auditError) {
        auditStatus = 'failed';
        // Restore has been verified and committed. Keep marker status=ok; expose the audit gap explicitly.
        try { Db.update('BackupJobs', marker.id, { note: marker.note + ' — ' + reason + ' — AUDIT_WRITE_FAILED' }); } catch (noteError) { /* response still reports committed restore */ }
      }
      const result = { restored: true, restored_tables: names.length, pre_restore_backup: pre.id, from: Backup.view_(srcJob), audit_status: auditStatus };
      if (auditStatus === 'failed') { result.warning_code = 'AUDIT_WRITE_FAILED'; result.warning = 'השחזור הושלם ואומת, אך רישום הביקורת נכשל. אין לבצע שחזור חוזר; יש לדווח למנהל המערכת.'; }
      return result;
    }
    const failed = [];
    touched.forEach(function (n) {
      let ok = false; for (let a = 0; a < 2 && !ok; a++) { try { Db.replaceAll(n, before.tables[n]); ok = Backup.sameRows_(n, before.tables[n]); } catch (e2) { ok = false; } }
      if (!ok) failed.push(n);
    });
    const why = String(failure && failure.message || failure).slice(0, 140);
    try { Db.update('BackupJobs', marker.id, { status: failed.length ? 'rollback_failed' : 'failed', finished_at: Util.nowIso(), note: marker.note + ' — ' + (failed.length ? 'ROLLBACK_FAILED: ' + failed.join(',') + ' — ' : '') + why }); } catch (e3) { /* the marker stays 'restoring': still blocks further restores */ }
    try { Audit.log(ctx, { action: failed.length ? 'BACKUP_ROLLBACK_FAILED' : 'BACKUP_RESTORE_FAILED', table: 'BackupJobs', recordId: srcJob.id, after: { touched: touched.length, failed_tables: failed, pre_restore_backup: pre.id }, reason: reason }); } catch (e4) { /* best effort */ }
    if (failed.length) throw new AppError('ROLLBACK_FAILED', 'השחזור נכשל וההחזרה לא הושלמה בטבלאות: ' + failed.join(', ') + '. הנתונים אינם עקביים — יש להפעיל recover מגיבוי ' + pre.id + ' (או לשחזר ידנית). סיבת הכשל: ' + why, failed);
    throw new AppError('RESTORE_FAILED', 'השחזור נכשל והמצב הקודם הוחזר במלואו ואומת (' + touched.length + ' טבלאות נוגעות). סיבה: ' + why);
  },
  /** Recovery after a restore that was cut off (marker 'restoring' / 'rollback_failed'): re-applies the pre_restore backup recorded on that marker, then closes the marker. */
  recover(ctx, markerId, p) {
    p = p || {}; Policy.require(ctx, 'backup.restore', {}); if (p.confirm !== 'RECOVER') throw new AppError('VALIDATION', 'נדרש אישור מפורש (confirm = "RECOVER").'); const reason = Mods.reason_(p.reason, true);
    return Locks.run(function () {
      Policy.require(ctx, 'backup.restore', {});
      const m = Db.get('BackupJobs', Util.str(typeof markerId === 'string' ? markerId : '')); if (!m || m.kind !== 'restore' || (m.status !== 'restoring' && m.status !== 'rollback_failed')) throw new AppError('NOT_FOUND', 'אין שחזור לא-שלם עם המזהה הזה.');
      const mm = /pre_restore=(\S+)/.exec(String(m.note)); if (!mm) throw new AppError('NOT_FOUND', 'לא נמצא גיבוי pre_restore לשחזור.');
      const other = Db.where('BackupJobs', function (j) { return j.kind === 'restore' && (j.status === 'restoring' || j.status === 'rollback_failed') && j.id !== m.id; })[0]; if (other) throw new AppError('RESTORE_IN_PROGRESS', 'קיים עוד שחזור לא-שלם (' + other.id + ') — יש לטפל בו קודם.');
      const b = Backup.load_(ctx, mm[1]); const r = Backup.apply_(ctx, b.job, b.snap, reason, 'recover');
      // The recovery engine has committed and verified the data. Closing the original marker is a
      // separate metadata write; never turn a completed recovery into an apparent operation failure.
      try { Db.update('BackupJobs', m.id, { status: 'recovered', finished_at: Util.nowIso(), note: String(m.note).slice(0, 300) + ' — recovered by ' + ctx.email }); }
      catch (closeError) {
        r.warning_code = 'RECOVERY_MARKER_CLOSE_FAILED';
        r.warning = (r.warning ? r.warning + ' ' : '') + 'הנתונים הוחזרו ואומתו, אך לא ניתן היה לסגור את סמן ההתאוששות המקורי. אין להפעיל התאוששות חוזרת; יש לפנות למנהל המערכת כדי לסגור את הסמן.';
        r.marker_close_status = 'failed';
      }
      return r;
    });
  },
  prune(ctx, keep) {
    Policy.require(ctx, 'backup.run', {}); const k = keep === undefined ? Backup.KEEP_DEFAULT : keep; if (!Number.isInteger(k) || k < 1 || k > 365) throw new AppError('VALIDATION', 'מספר גיבויים לשמירה: 1–365.');
    return Locks.run(function () {
      Policy.require(ctx, 'backup.run', {});
      let expired = 0, pending = 0, auditStatus = 'ok';
      // Reconcile interrupted prior runs first. Never infer missing from a generic Drive error.
      Db.where('BackupJobs', function (j) { return j.status === 'pruning' && j.file_id; }).forEach(function (j) {
        let state = 'unknown'; try { state = Adapters.fileState(j.file_id); } catch (e) { state = 'unknown'; }
        try {
          if (state === 'exists') { Adapters.trashFile(j.file_id); state = Adapters.fileState(j.file_id); }
          if (state === 'trashed') { Db.update('BackupJobs', j.id, { status: 'expired', file_id: '', note: 'PRUNE_RECONCILED_EXPIRED' }); expired++; }
          else pending++;
        } catch (e2) { pending++; }
      });
      const ok = Db.where('BackupJobs', function (j) { return j.status === 'ok' && j.file_id && (j.kind === 'daily' || j.kind === 'manual'); }).sort(function (a, b) { return a.started_at < b.started_at ? 1 : -1; });
      ok.slice(k).forEach(function (j) {
        // Durable intent first: if this write fails, Drive is untouched.
        Db.update('BackupJobs', j.id, { status: 'pruning', note: 'PRUNE_PENDING' });
        try { Adapters.trashFile(j.file_id); } catch (trashError) {
          let state = 'unknown'; try { state = Adapters.fileState(j.file_id); } catch (e) { state = 'unknown'; }
          if (state === 'exists') { try { Db.update('BackupJobs', j.id, { status: 'ok', note: '' }); } catch (e2) { pending++; } }
          else if (state === 'trashed') { try { Db.update('BackupJobs', j.id, { status: 'expired', file_id: '', note: 'PRUNE_RECONCILED_EXPIRED' }); expired++; } catch (e3) { pending++; } }
          else pending++;
          return;
        }
        // If this write fails, the durable pruning marker lets the next run reconcile.
        try { Db.update('BackupJobs', j.id, { status: 'expired', file_id: '', note: 'נמחק קובץ הגיבוי לפי מדיניות שמירה (' + k + ')' }); expired++; }
        catch (rowError) { pending++; }
      });
      if (expired) { try { Audit.log(ctx, { action: 'BACKUP_PRUNE', table: 'BackupJobs', recordId: '', after: { expired: expired, keep: k, pending: pending } }); } catch (auditError) { auditStatus = 'failed'; } }
      return { expired: expired, kept: Math.min(ok.length, k), pending_reconciliation: pending, audit_status: auditStatus, warning_code: pending || auditStatus === 'failed' ? (auditStatus === 'failed' ? 'AUDIT_WRITE_FAILED' : 'PRUNE_RECONCILIATION_REQUIRED') : '' };
    });
  },
  /** Time-driven (daily): one daily backup per calendar day, refresh alerts for every non-archived course, prune. Runs as the system (admin-equivalent) context. */
  daily() {
    const sys = { email: 'system', role: ROLES.ADMIN, courseScope: '*' }, today = Util.todayIso(), out = { backup: null, alerts: {}, pruned: null };
    const have = Db.where('BackupJobs', function (j) { return j.kind === 'daily' && j.status === 'ok' && String(j.started_at).slice(0, 10) === today; }).length;
    if (!have) out.backup = Backup.create(sys, 'daily');
    Db.where('Courses', function (c) { return c.status !== COURSE_STATUS.ARCHIVED; }).forEach(function (c) { out.alerts[c.id] = Alerts.refresh(sys, c.id, today); });
    out.pruned = Backup.prune(sys); try { out.preflight = Preflight.run(sys).overall; } catch (e) { out.preflight = 'ERROR'; }
    return out;
  }
};
