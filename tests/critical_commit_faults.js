// Critical commit regression tests. Node/in-memory synthetic data only.
// Synthetic regression tests for post-commit Audit and recoverable prune states.
const { suite } = require('./tlib');
const { t, done, assert } = suite('critical_commit_faults.js');
const { setup } = require('./fixture');

t('hardening', 'BACKUP_CREATE: audit failure is reported as a warning after a committed backup, never as operation failure', () => {
  const E = setup(); const { X, admin, fake } = E; const original = X.Audit.log;
  X.Audit.log = (ctx, entry) => { if (entry && entry.action === 'BACKUP_CREATE') throw new Error('injected audit outage'); return original(ctx, entry); };
  let result = null, error = ''; try { result = X.Backup.create(admin, 'manual'); } catch (e) { error = e.message; } finally { X.Audit.log = original; }
  const job = X.Db.where('BackupJobs', j => j.kind === 'manual').slice(-1)[0];
  assert.strictEqual(error, '');
  assert.strictEqual(result.status, 'ok'); assert.strictEqual(result.audit_status, 'failed'); assert.strictEqual(result.warning_code, 'AUDIT_WRITE_FAILED');
  assert.ok(job && job.status === 'ok' && job.file_id && fake.files[job.file_id], 'backup remains committed');
  assert.strictEqual(job.note, 'AUDIT_WRITE_FAILED', 'fixed warning persisted without exception details');
});

t('hardening', 'BACKUP_RESTORE: audit failure is reported as a warning after verified restore, never as operation failure', () => {
  const E = setup(); const { X, admin, S } = E; const backup = X.Backup.create(admin, 'manual');
  const before = X.Db.get('Soldiers', S.a.id).full_name;
  X.Db.update('Soldiers', S.a.id, { full_name: 'שינוי אחרי הגיבוי' });
  const original = X.Audit.log;
  X.Audit.log = (ctx, entry) => { if (entry && entry.action === 'BACKUP_RESTORE') throw new Error('injected restore audit outage'); return original(ctx, entry); };
  let result = null, error = ''; try { result = X.Backup.restore(admin, backup.id, { confirm: 'RESTORE', reason: 'בדיקת תקלה' }); } catch (e) { error = e.message; } finally { X.Audit.log = original; }
  const marker = X.Db.where('BackupJobs', j => j.kind === 'restore').slice(-1)[0];
  assert.strictEqual(error, '');
  assert.strictEqual(result.restored, true); assert.strictEqual(result.audit_status, 'failed'); assert.strictEqual(result.warning_code, 'AUDIT_WRITE_FAILED');
  assert.strictEqual(X.Db.get('Soldiers', S.a.id).full_name, before, 'backup data was restored');
  assert.ok(marker && marker.status === 'ok' && /AUDIT_WRITE_FAILED/.test(marker.note), 'restore marker says committed and records audit warning');
});

t('hardening', 'BACKUP_RECOVER: failure to close the original marker after verified recovery is a committed success with an explicit warning', () => {
  const E = setup(); const { X, admin, S } = E;
  const preName = X.Db.get('Soldiers', S.a.id).full_name;
  const pre = X.Backup.create(admin, 'pre_restore');
  X.Db.update('Soldiers', S.a.id, { full_name: 'שינוי לא רצוי' });
  const marker = { id: 'recover-marker-test', kind: 'restore', requested_by: admin.email, started_at: X.Util.nowIso(), finished_at: '', status: 'rollback_failed', file_id: '', note: 'pre_restore=' + pre.id, tables_count: 0, rows_count: 0, checksum: pre.checksum, app_version: X.APP.VERSION };
  X.Db.insert('BackupJobs', marker);
  const update = X.Db.update;
  X.Db.update = (table, id, patch) => { if (table === 'BackupJobs' && id === marker.id && patch.status === 'recovered') throw new Error('injected marker close outage'); return update(table, id, patch); };
  let result = null, error = ''; try { result = X.Backup.recover(admin, marker.id, { confirm: 'RECOVER', reason: 'בדיקת התאוששות' }); } catch (e) { error = e.message; } finally { X.Db.update = update; }
  assert.strictEqual(error, '', 'do not report failure after data recovery committed');
  assert.strictEqual(result.restored, true); assert.strictEqual(result.marker_close_status, 'failed'); assert.strictEqual(result.warning_code, 'RECOVERY_MARKER_CLOSE_FAILED');
  assert.strictEqual(X.Db.get('Soldiers', S.a.id).full_name, preName, 'pre_restore data is restored and verified');
  assert.strictEqual(X.Db.get('BackupJobs', marker.id).status, 'rollback_failed', 'original marker remains open and blocks new restores');
});

t('hardening', 'BACKUP_PRUNE: row update failure leaves a durable pruning marker; next prune reconciles the trashed file', () => {
  const E = setup(); const { X, admin, fake } = E;
  X.Backup.create(admin, 'manual'); X.Backup.create(admin, 'manual');
  const target = X.Db.where('BackupJobs', j => j.status === 'ok' && j.kind === 'manual').sort((a,b) => a.started_at < b.started_at ? 1 : -1)[1];
  assert.ok(target && fake.files[target.file_id]);
  const update = X.Db.update;
  X.Db.update = (table, id, patch) => { if (table === 'BackupJobs' && id === target.id && patch.status === 'expired') throw new Error('injected row update outage'); return update(table, id, patch); };
  let result = null, error = ''; try { result = X.Backup.prune(admin, 1); } catch (e) { error = e.message; } finally { X.Db.update = update; }
  const after = X.Db.get('BackupJobs', target.id);
  assert.strictEqual(error, '');
  assert.strictEqual(after.status, 'pruning'); assert.ok(after.file_id); assert.strictEqual(fake.files[after.file_id].trashed, true);
  assert.strictEqual(result.pending_reconciliation, 1);
  const recovered = X.Backup.prune(admin, 1);
  assert.strictEqual(X.Db.get('BackupJobs', target.id).status, 'expired'); assert.strictEqual(X.Db.get('BackupJobs', target.id).file_id, '');
  assert.strictEqual(recovered.pending_reconciliation, 0, 'reconciliation closes the stale marker');
});


t('hardening', 'BACKUP_PRUNE: unknown Drive state is never treated as expired or available', () => {
  const E = setup(); const { X, admin, fake } = E;
  X.Backup.create(admin, 'manual'); X.Backup.create(admin, 'manual');
  const target = X.Db.where('BackupJobs', j => j.status === 'ok' && j.kind === 'manual').sort((a,b) => a.started_at < b.started_at ? 1 : -1)[1];
  const state = fake.fileState, trash = fake.trashFile;
  fake.fileState = id => id === target.file_id ? 'unknown' : state(id);
  fake.trashFile = id => { if (id === target.file_id) throw new Error('injected Drive uncertainty'); return trash(id); };
  const result = X.Backup.prune(admin, 1);
  fake.fileState = state; fake.trashFile = trash;
  const row = X.Db.get('BackupJobs', target.id);
  assert.strictEqual(row.status, 'pruning');
  assert.ok(row.file_id);
  assert.strictEqual(result.pending_reconciliation, 1);
  assert.strictEqual(result.warning_code, 'PRUNE_RECONCILIATION_REQUIRED');
});

t('hardening', 'BACKUP_PRUNE: failure to persist pruning intent never touches Drive', () => {
  const E = setup(); const { X, admin, fake } = E;
  X.Backup.create(admin, 'manual'); X.Backup.create(admin, 'manual');
  const target = X.Db.where('BackupJobs', j => j.status === 'ok' && j.kind === 'manual').sort((a,b) => a.started_at < b.started_at ? 1 : -1)[1];
  const update = X.Db.update, trash = fake.trashFile; let touched = false;
  X.Db.update = (table, id, patch) => { if (table === 'BackupJobs' && id === target.id && patch.status === 'pruning') throw new Error('injected intent write failure'); return update(table, id, patch); };
  fake.trashFile = id => { if (id === target.file_id) touched = true; return trash(id); };
  assert.throws(() => X.Backup.prune(admin, 1), /injected intent write failure/);
  X.Db.update = update; fake.trashFile = trash;
  assert.strictEqual(touched, false, 'Drive must not be touched before durable pruning intent');
  assert.strictEqual(fake.files[target.file_id].trashed, undefined);
  assert.strictEqual(X.Db.get('BackupJobs', target.id).status, 'ok');
});

done();
