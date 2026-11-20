// v1.0.0 backup / restore — Node only (in-memory Db + FAKE Drive). Sheets replaceAll + Drive file behaviour were NOT run in real Apps Script.
const { suite } = require('./tlib'); const { t, done, assert } = suite('v1_backup.js'); const { setup } = require('./fixture');
const state = X => { const o = {}; Object.keys(X.TABLES).filter(n => !X.Backup.EXCLUDED.includes(n)).forEach(n => o[n] = JSON.stringify(X.Db.all(n))); return o; };
const seed = S => { const { X, admin, c1, S: sol } = S; X.Navigation.typeCreate(admin, c1, 'ניווט'); X.Private.saveNote(admin, c1, { soldier_id: sol.a.id, note_text: 'סודי-גיבוי' }); X.Qualifications.define(admin, c1, { name: 'ק', completion_terms: 'ת' }); X.Settings.set(admin, c1, 'exam.pass_score', 75, '2000-01-01', 'x'); return S; };
t('integration', 'backup: checksum + counts + private data included, file id never in the job view, verify works, corruption detected, commander forbidden', () => {
  const S = seed(setup()); const { X, admin, cC, code, fake } = S; const b = X.Backup.create(admin, 'manual'); assert.strictEqual(b.status, 'ok'); assert.ok(b.rows_count > 20 && b.tables_count === Object.keys(X.TABLES).length); assert.ok(!JSON.stringify(X.Backup.list(admin)).includes('file-'));
  const file = Object.values(fake.files).find(f => f.bucket === 'backups'); assert.ok(Buffer.from(file.b64, 'base64').toString().includes('סודי-גיבוי'), 'private tables are in the backup (file is private to the deploying admin)'); assert.strictEqual(X.Backup.verify(admin, b.id).ok, true);
  file.b64 = Buffer.from(Buffer.from(file.b64, 'base64').toString().replace('סודי-גיבוי', 'סודי-גיבוז'), 'utf8').toString('base64'); assert.strictEqual(code(() => X.Backup.verify(admin, b.id)), 'CORRUPT'); assert.strictEqual(code(() => X.Backup.restore(admin, b.id, { confirm: 'RESTORE', reason: 'x' })), 'CORRUPT');
  ['create', 'list', 'prune'].forEach(f => assert.strictEqual(code(() => X.Backup[f](cC, 'manual')), 'FORBIDDEN', f)); assert.strictEqual(code(() => X.Backup.verify(cC, b.id)), 'FORBIDDEN'); assert.strictEqual(code(() => X.Backup.plan(cC, b.id)), 'FORBIDDEN'); assert.strictEqual(code(() => X.Backup.restore(cC, b.id, { confirm: 'RESTORE', reason: 'x' })), 'FORBIDDEN'); assert.strictEqual(code(() => X.Backup.create(admin, 'weird')), 'VALIDATION'); assert.strictEqual(code(() => X.Backup.verify(admin, 'nope')), 'NOT_FOUND');
});
t('integration', 'point-in-time restore: data tables return EXACTLY to the backup state, audit log + users + backup history are preserved (and grow), pre-restore backup exists and can undo the restore, form links revoked', () => {
  const S = seed(setup()); const { X, admin, c1, S: sol, code } = S; const b = X.Backup.create(admin, 'manual'); const at = state(X);
  X.Soldiers.create(admin, c1, { full_name: 'אחרי הגיבוי', personal_number: '999', gender: 'M', department_id: S.dep(0), team_id: S.team(0, 0) }); X.Soldiers.cancel(admin, sol.b.id, 'אחרי'); X.Settings.set(admin, c1, 'exam.pass_score', 60, '2000-01-02', 'אחרי'); X.Private.saveNote(admin, c1, { soldier_id: sol.a.id, note_text: 'אחרי' }); const link = X.Forms.createLink(admin, c1, sol.a.id); X.Courses.addUser(admin, { email: 'new@x.com', role: 'commander', course_ids: [c1], display_name: 'חדש' });
  const usersAfter = JSON.stringify(X.Db.all('Users')), auditBefore = X.Db.all('AuditLog').length; const plan = X.Backup.plan(admin, b.id); assert.ok(plan.tables.find(t => t.table === 'Soldiers').change === -1 && plan.excluded.includes('Users'));
  assert.strictEqual(code(() => X.Backup.restore(admin, b.id, { reason: 'x' })), 'VALIDATION'); assert.strictEqual(code(() => X.Backup.restore(admin, b.id, { confirm: 'restore', reason: 'x' })), 'VALIDATION'); assert.strictEqual(code(() => X.Backup.restore(admin, b.id, { confirm: 'RESTORE', reason: '' })), 'VALIDATION');
  const r = X.Backup.restore(admin, b.id, { confirm: 'RESTORE', reason: 'חזרה לנקודת זמן' }); assert.ok(r.restored_tables > 20); const now = state(X); Object.keys(at).forEach(n => { if (n !== 'FormTokens') assert.strictEqual(now[n], at[n], 'table ' + n); });
  assert.strictEqual(JSON.stringify(X.Db.all('Users')), usersAfter, 'users untouched'); assert.ok(X.Db.all('AuditLog').length > auditBefore, 'audit grows'); assert.ok(X.Db.where('AuditLog', a => a.action === 'BACKUP_RESTORE').length === 1);
  assert.strictEqual(X.Db.where('BackupJobs', j => j.kind === 'restore').length, 1); assert.strictEqual(code(() => X.Forms.open(link.token)), 'FORBIDDEN', 'links issued after the backup do not survive'); assert.strictEqual(X.Settings.get(c1, 'exam.pass_score'), 75);
  const undo = X.Backup.restore(admin, r.pre_restore_backup, { confirm: 'RESTORE', reason: 'ביטול שחזור' }); assert.ok(undo.restored_tables > 0); assert.strictEqual(X.Db.where('Soldiers', s => s.personal_number === '999').length, 1, 'the pre-restore backup brings back the post-backup work'); assert.strictEqual(X.Settings.get(c1, 'exam.pass_score'), 60);
});
t('hardening', 'restore failure in the middle rolls everything back to the pre-restore state; failed rollback is reported as ROLLBACK_FAILED; backup of a newer schema refused; failed Drive save marks the job failed', () => {
  const S = seed(setup()); const { X, admin, c1, code, fake } = S; const b = X.Backup.create(admin, 'manual'); X.Soldiers.create(admin, c1, { full_name: 'נוסף', personal_number: '888', gender: 'M', department_id: S.dep(0), team_id: S.team(0, 0) }); const mid = state(X);
  const orig = X.Db.replaceAll; let n = 0; X.Db.replaceAll = function (t, rows) { if (++n === 8) throw new Error('boom'); return orig.apply(this, arguments); };
  assert.strictEqual(code(() => X.Backup.restore(admin, b.id, { confirm: 'RESTORE', reason: 'x' })), 'RESTORE_FAILED'); X.Db.replaceAll = orig; const after = state(X); Object.keys(mid).forEach(k => assert.strictEqual(after[k], mid[k], 'rolled back ' + k));
  n = 0; X.Db.replaceAll = function (t, rows) { n++; if (n === 8 || n > 8) throw new Error('boom' + n); return orig.apply(this, arguments); }; assert.strictEqual(code(() => X.Backup.restore(admin, b.id, { confirm: 'RESTORE', reason: 'x' })), 'ROLLBACK_FAILED'); X.Db.replaceAll = orig;
  const mk2 = X.Db.where('BackupJobs', j => j.kind === 'restore' && j.status === 'rollback_failed')[0]; assert.ok(mk2, 'marker left for the operator'); assert.strictEqual(code(() => X.Backup.restore(admin, b.id, { confirm: 'RESTORE', reason: 'x' })), 'RESTORE_IN_PROGRESS', 'blocked until recover'); X.Backup.recover(admin, mk2.id, { confirm: 'RECOVER', reason: 'בדיקה' });
  const file = Object.values(fake.files).find(f => f.bucket === 'backups'); const snap = JSON.parse(Buffer.from(file.b64, 'base64').toString()); snap.schema_version = 99; const json = JSON.stringify(snap), job = X.Db.where('BackupJobs', j => j.kind === 'manual')[0]; file.b64 = Buffer.from(json).toString('base64'); X.Db.update('BackupJobs', job.id, { checksum: X.Util.sha256(json) }); assert.strictEqual(code(() => X.Backup.restore(admin, job.id, { confirm: 'RESTORE', reason: 'x' })), 'VALIDATION');
  const save = fake.saveFile; fake.saveFile = () => { throw new Error('drive down'); }; assert.throws(() => X.Backup.create(admin, 'manual'), /drive down/); fake.saveFile = save; assert.strictEqual(X.Db.where('BackupJobs', j => j.status === 'failed' && j.kind !== 'restore').length, 1); assert.strictEqual(code(() => X.Backup.verify(admin, X.Db.where('BackupJobs', j => j.status === 'failed' && j.kind !== 'restore')[0].id)), 'NOT_FOUND');
});
t('integration', 'retention + daily job: one daily backup per day, newest N kept, pruned file trashed but its row kept (expired), alerts refreshed for non-archived courses only, prune validation', () => {
  const S = seed(setup()); const { X, admin, c1, c2, code, fake } = S; X.Qualifications.define(admin, c1, { name: 'דחוף', completion_terms: 'ת', target_date: '2000-01-01' });
  const d1 = X.Backup.daily(); assert.ok(d1.backup && d1.alerts[c1].created > 0); const d2 = X.Backup.daily(); assert.strictEqual(d2.backup, null, 'once per day'); X.Courses.archive(admin, c2); assert.ok(!(c2 in X.Backup.daily().alerts), 'archived course skipped');
  for (let i = 0; i < 9; i++) X.Backup.create(admin, 'manual'); const files = () => Object.values(fake.files).filter(f => f.bucket === 'backups' && !f.trashed).length; assert.strictEqual(files(), 10); const p = X.Backup.prune(admin, 3); assert.strictEqual(p.expired, 7); assert.strictEqual(files(), 3 + 0, 'pre_restore kinds are never pruned; here none exist'); assert.strictEqual(X.Db.where('BackupJobs', j => j.status === 'expired').length, 7, 'rows kept');
  [0, 366, 1.5, '3', -1].forEach(k => assert.strictEqual(code(() => X.Backup.prune(admin, k)), 'VALIDATION', String(k))); assert.strictEqual(X.Backup.prune(admin).expired, 0);
});

t('hardening', 'backup preflight and restore verification safely handle prototype-like persisted row IDs', () => {
  const S = setup(); const { X } = S;
  const snap = X.Backup.snapshot_();
  const source = snap.tables.Soldiers[0];
  snap.tables.Soldiers = [Object.assign({}, source, { id: '__proto__' })];
  assert.doesNotThrow(() => X.Backup.preflight_(snap, 'prototype-id regression'));
  const live = X.Db.all('Soldiers');
  const special = Object.assign({}, live[0], { id: 'constructor' });
  try {
    X.Db.replaceAll('Soldiers', [special]);
    assert.strictEqual(X.Backup.sameRows_('Soldiers', [special]), true, 'verification index must resolve constructor as an own key');
    const proto = Object.assign({}, special, { id: '__proto__' });
    X.Db.replaceAll('Soldiers', [proto]);
    assert.strictEqual(X.Backup.sameRows_('Soldiers', [proto]), true, 'verification index must resolve __proto__ as an own key');
  } finally { X.Db.replaceAll('Soldiers', live); }
});

done();
