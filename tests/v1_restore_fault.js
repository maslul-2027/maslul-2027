// v1.0.1 — Backup.restore FAULT INJECTION against the REAL SheetsStore (Store.gs) running on an in-memory fake of SpreadsheetApp (tests/fakesheets.js).
// Simulation only: Sheets atomicity/format behaviour is assumed, NOT verified in Google Apps Script.
const { suite } = require('./tlib'); const { t, done, assert } = suite('v1_restore_fault.js'); const { load } = require('./harness'); const fakes = require('./fakes');
function env() {
  const X = load({ sheets: true }); X.sheets.PropertiesService.getScriptProperties().setProperty('ADMIN_EMAIL', 'admin@x.com'); X.Auth._emailProvider = () => 'admin@x.com'; X.setupDatabase(); X.Auth._emailProvider = null; const fake = fakes.install(X);
  const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' }, cmd = { email: 'c@x.com', role: 'commander', courseScope: [] };
  const c1 = X.Courses.create(admin, { name: 'קורס', start_date: '2099-01-01' }).id, o = X.Courses.org(admin, c1); X.Courses.addUser(admin, { email: 'c@x.com', role: 'commander', course_ids: [c1], display_name: 'מפקד' }); cmd.courseScope = [c1];
  const mk = (n, pn) => X.Soldiers.create(admin, c1, { full_name: n, personal_number: pn, gender: 'M', department_id: o.departments[0].id, team_id: o.teams[0].id });
  const a = mk('אלף', '101'), b = mk('בית', '102'); X.Records.create(admin, 'MarksmanshipTests', c1, { request_id: 'r1', soldier_id: a.id, test_date: '2026-03-02', weapon_type: 'M16', distance_m: 100, examiner_score: 80, weapon_zeroed: true });
  X.Marches.create(admin, c1, { request_id: 'm1', march_date: '2026-03-05', location: 'מסלול', km_no_stretcher: 10, km_stretcher: 2, scope_type: 'course', scope_id: c1 }); X.Readiness.assess(admin, c1, { request_id: 'rd1', soldier_id: a.id, status: 'fit', start_date: '2026-03-06' }); X.Records.create(admin, 'SoldierEvents', c1, { request_id: 'e1', soldier_id: a.id, event_date: '2026-03-07', event_type: 'achievement', description: 'מצטיין' });
  X.Private.saveNote(admin, c1, { soldier_id: a.id, note_text: 'פרטי' }); X.Private.toggleFavorite(admin, c1, a.id);
  return { X, fake, admin, cmd, c1, mk, a, b, code: fn => { try { fn(); return null; } catch (e) { return e.code || 'JS:' + e.message; } } };
}
const dump = X => { const o = {}; X.Backup.restorable_().forEach(n => { o[n] = JSON.stringify(X.Db.all(n).sort((p, q) => String(p.id) < String(q.id) ? -1 : 1)); }); return o; };
const sameDump = (A, B, msg) => Object.keys(A).forEach(k => assert.strictEqual(B[k], A[k], msg + ' — table ' + k));
const writes = X => X.sheets.ops().filter(o => /^(setValues|setValue|clearContent|insertRowsAfter|setNumberFormat)/.test(o)).length;
// a restore scenario: backup, then change data, so a restore really has work to do (rows to remove AND to overwrite)
const scenario = E => { const { X, admin, c1, a } = E; const bk = X.Backup.create(admin, 'manual'); E.mk('נוסף אחרי הגיבוי', '103'); X.Soldiers.update(admin, a.id, { full_name: 'שונה' }, X.Db.get('Soldiers', a.id).updated_at, 'בדיקה'); X.Private.saveNote(admin, c1, { soldier_id: a.id, note_text: 'אחרי' }); return { bk, mid: dump(X) }; };
const RS = (E, bk) => E.X.Backup.restore(E.admin, bk.id, { confirm: 'RESTORE', reason: 'בדיקה' });

t('integration', 'sanity: a clean restore on the real SheetsStore returns exactly the backed-up rows (all restorable tables), excluded tables untouched, text/formula-like values stay text', () => {
  const E = env(); const { X, admin } = E; X.Soldiers.update(admin, E.a.id, { commander_note: '=HYPERLINK("x")' }, X.Db.get('Soldiers', E.a.id).updated_at, 'בדיקה'); const want = dump(X); const bk = X.Backup.create(admin, 'manual'); E.mk('נוסף', '103'); const audit = X.Db.all('AuditLog').length, users = JSON.stringify(X.Db.all('Users'));
  const r = RS(E, bk); assert.ok(r.restored_tables > 40); sameDump(want, dump(X), 'restored'); assert.strictEqual(X.Db.all('Users').length && JSON.stringify(X.Db.all('Users')), users); assert.ok(X.Db.all('AuditLog').length > audit, 'audit grows, never rolled back');
  assert.strictEqual(X.Db.get('Soldiers', E.a.id).commander_note, '=HYPERLINK("x")', 'formula-like text restored as text'); assert.strictEqual(X.Db.where('BackupJobs', j => j.kind === 'restore')[0].status, 'ok'); });
// fire-once hook helper: counts matching sheet operations; act(n) decides what happens on the n-th match (1-based)
const nth = (match, act) => { let n = 0; return (op, sh, i) => { if (!match(op, sh, i)) return undefined; n++; return act(n, op, sh, i); }; };
const boom = m => { throw new Error('INJECTED ' + m); };
t('hardening', 'FAULT SWEEP: a partial write while restoring ANY table that has rows (each in turn) rolls ALL tables back to the exact pre-restore state, including the failing table', () => {
  const E = env(); const { X } = E; const { bk, mid } = scenario(E); const names = X.Backup.restorable_().filter(n => JSON.parse(mid[n]).length > 0); let swept = 0;
  names.forEach(n => { X.sheets.setHook(nth((op, sh, i) => op === 'setValues' && sh === n && i.r === 2, k => k === 1 ? { partial: 1 } : undefined));
    const c = E.code(() => RS(E, bk)); X.sheets.setHook(null); assert.strictEqual(c, 'RESTORE_FAILED', n); sameDump(mid, dump(X), 'after partial write in ' + n); swept++; });
  assert.ok(swept >= 8, 'swept ' + swept + ' tables: ' + names.join(',')); assert.ok(RS(E, bk).restored_tables > 40, 'restore still works afterwards'); });
t('hardening', 'fault stages on the Soldiers table (partial rows / failure clearing the leftover tail = after the new rows replaced the old / number-format step / silent corruption caught by read-back / failure after ALL tables were written, while revoking form tokens) each leave the system exactly as before', () => {
  const E = env(); const { X } = E; const { bk, mid } = scenario(E);
  const stages = { 'partial write (1 row)': nth((op, sh, i) => op === 'setValues' && sh === 'Soldiers' && i.r === 2, k => k === 1 ? { partial: 1 } : undefined),
    'failure clearing the old tail (after new rows were written)': nth((op, sh) => op === 'clearContent' && sh === 'Soldiers', k => k === 1 ? boom('clear') : undefined),
    'failure of the number-format step': nth((op, sh) => op === 'setNumberFormat' && sh === 'Soldiers', k => k === 1 ? boom('fmt') : undefined),
    'silent corruption of the first cell': nth((op, sh, i) => op === 'setValues' && sh === 'Soldiers' && i.r === 2, k => k === 1 ? { corrupt: true } : undefined) };
  Object.keys(stages).forEach(name => { X.sheets.setHook(stages[name]); const c = E.code(() => RS(E, bk)); X.sheets.setHook(null); assert.strictEqual(c, 'RESTORE_FAILED', name); sameDump(mid, dump(X), name); assert.strictEqual(X.Db.where('BackupJobs', j => j.kind === 'restore').pop().status, 'failed', name); });
  // failure AFTER every table was written (the form-token revocation step): FormTokens needs an open token to exist
  const l = X.Forms.createLink(E.admin, E.c1, E.a.id, 7); const mid2 = dump(X); const bk2 = X.Backup.create(E.admin, 'manual'); const orig = X.Db.update; X.Db.update = (t2, id, p) => { if (t2 === 'FormTokens') boom('revoke'); return orig(t2, id, p); };
  const c = E.code(() => RS(E, bk2)); X.Db.update = orig; assert.strictEqual(c, 'RESTORE_FAILED', 'revoke failure'); sameDump(mid2, dump(X), 'revoke failure'); assert.ok(RS(E, bk).restored_tables > 40, 'real restore afterwards'); });
t('hardening', 'FAULT BETWEEN TABLES: failure at the first table with data after the 20th, and failures DURING the rollback itself — transient (retried) and permanent (ROLLBACK_FAILED naming the tables, marker blocks further restores, recover() brings the data back)', () => {
  const E = env(); const { X, admin } = E; const { bk, mid } = scenario(E); const names = X.Backup.restorable_(); const T = names.slice(19).find(n => JSON.parse(mid[n]).length > 0 && names.indexOf(n) > 19);
  assert.ok(T, 'a table with data exists after the 20th restorable table (so the between-tables fault is really exercised)');
  if (T) { X.sheets.setHook(nth((op, sh, i) => op === 'setValues' && sh === T && i.r === 2, k => k === 1 ? { partial: 1 } : undefined)); const c = E.code(() => RS(E, bk)); X.sheets.setHook(null); assert.strictEqual(c, 'RESTORE_FAILED', 'between tables at ' + T); sameDump(mid, dump(X), 'between tables at ' + T); }
  // (a) transient: write #1 of Soldiers partial, rollback attempt (#2) throws, the retry (#3) works
  X.sheets.setHook(nth((op, sh, i) => op === 'setValues' && sh === 'Soldiers' && i.r === 2, k => k === 1 ? { partial: 1 } : k === 2 ? boom('transient rollback') : undefined)); let c = E.code(() => RS(E, bk)); X.sheets.setHook(null);
  assert.strictEqual(c, 'RESTORE_FAILED', 'transient rollback fault is retried'); sameDump(mid, dump(X), 'transient rollback fault');
  // (b) permanent: every write to Soldiers after the first fails
  X.sheets.setHook(nth((op, sh) => (op === 'setValues' || op === 'clearContent') && sh === 'Soldiers', k => k === 1 ? { partial: 1 } : boom('permanent rollback'))); c = E.code(() => RS(E, bk)); X.sheets.setHook(null);
  assert.strictEqual(c, 'ROLLBACK_FAILED', 'permanent rollback failure is reported, not hidden'); const m = X.Db.where('BackupJobs', j => j.kind === 'restore' && j.status === 'rollback_failed')[0]; assert.ok(m && /ROLLBACK_FAILED: .*Soldiers/.test(m.note), 'marker names the table: ' + (m && m.note));
  assert.ok(X.Db.all('AuditLog').some(a => a.action === 'BACKUP_ROLLBACK_FAILED'), 'audited');
  assert.strictEqual(E.code(() => RS(E, bk)), 'RESTORE_IN_PROGRESS', 'no further restore while the data may be inconsistent');
  const r = X.Backup.recover(admin, m.id, { confirm: 'RECOVER', reason: 'התאוששות' }); assert.ok(r.restored_tables > 40); sameDump(mid, dump(X), 'recover brings back the exact pre-restore state'); assert.strictEqual(X.Db.get('BackupJobs', m.id).status, 'recovered');
  assert.strictEqual(E.code(() => X.Backup.recover(admin, m.id, { confirm: 'RECOVER', reason: 'שוב' })), 'NOT_FOUND', 'recover is not repeatable'); assert.ok(RS(E, bk).restored_tables > 40, 'normal restores work again'); });
t('hardening', 'no parallel restores: a second restore started from INSIDE a running restore is refused (RESTORE_IN_PROGRESS), a leftover "restoring" marker blocks restores until recover, and the first restore still completes consistently', () => {
  const E = env(); const { X, admin } = E; const { bk, mid } = scenario(E); let inner = null, fired = false;
  X.sheets.setHook((op, sh) => { if (op === 'setValues' && sh === 'Soldiers' && !fired) { fired = true; inner = E.code(() => RS(E, bk)); } });
  const want = (() => { return null; })(); const r = RS(E, bk); X.sheets.setHook(null); assert.strictEqual(inner, 'RESTORE_IN_PROGRESS'); assert.ok(r.restored_tables > 40);
  X.Db.insert('BackupJobs', { id: 'stale', kind: 'restore', requested_by: 'x', started_at: X.Util.nowIso(), finished_at: '', status: 'restoring', file_id: '', note: 'pre_restore=none', tables_count: 0, rows_count: 0, checksum: '', app_version: '1' });
  assert.strictEqual(E.code(() => RS(E, bk)), 'RESTORE_IN_PROGRESS'); assert.strictEqual(E.code(() => X.Backup.recover(admin, 'stale', { confirm: 'RECOVER', reason: 'x' })), 'NOT_FOUND', 'marker without a usable pre_restore backup cannot be "recovered" blindly'); });
t('hardening', 'PREFLIGHT: a bad backup (unknown table, unknown column, missing/duplicate id, nested value, missing table in a same-schema backup) or a live sheet that lost a column is refused with PREFLIGHT_FAILED and NOTHING is written (no sheet write, no pre_restore backup, no marker)', () => {
  const E = env(); const { X, admin, fake } = E; const bk = X.Backup.create(admin, 'manual'); const file = Object.values(fake.files).find(f => f.bucket === 'backups'); const orig = JSON.parse(Buffer.from(file.b64, 'base64').toString()), job = X.Db.get('BackupJobs', bk.id);
  const put = mut => { const s = JSON.parse(JSON.stringify(orig)); mut(s); const j = JSON.stringify(s); file.b64 = Buffer.from(j).toString('base64'); X.Db.update('BackupJobs', job.id, { checksum: X.Util.sha256(j) }); };
  const bad = { 'unknown table': s => { s.tables.Nope = []; }, 'unknown column': s => { s.tables.Soldiers[0].hax = 'x'; }, 'missing id': s => { delete s.tables.Soldiers[0].id; }, 'duplicate id': s => { s.tables.Soldiers.push(Object.assign({}, s.tables.Soldiers[0])); }, 'nested value': s => { s.tables.Soldiers[0].full_name = { a: 1 }; }, 'array row': s => { s.tables.Soldiers[0] = []; }, 'table not an array': s => { s.tables.Soldiers = 'x'; }, 'non-finite number': s => { s.tables.Soldiers[0].version = null; s.tables.MarksmanshipTests[0].distance_m = 1e999; }, 'missing table, same schema': s => { delete s.tables.Soldiers; }, 'overlong cell': s => { s.tables.Soldiers[0].full_name = 'x'.repeat(50000); } };
  Object.keys(bad).forEach(k => { put(bad[k]); const w = writes(X), jobs = X.Db.all('BackupJobs').length, before = dump(X); const c = E.code(() => RS(E, bk)); assert.strictEqual(c, 'PREFLIGHT_FAILED', k); assert.strictEqual(writes(X), w, k + ': no sheet write'); assert.strictEqual(X.Db.all('BackupJobs').length, jobs, k + ': no job rows'); sameDump(before, dump(X), k); assert.strictEqual(E.code(() => X.Backup.verify(admin, bk.id)), 'PREFLIGHT_FAILED', k + ' (verify)'); });
  file.b64 = Buffer.from(JSON.stringify(orig)).toString('base64'); X.Db.update('BackupJobs', job.id, { checksum: X.Util.sha256(JSON.stringify(orig)) }); assert.ok(X.Backup.verify(admin, bk.id).ok);
  const sh = X.sheets.state.spreadsheets[X.sheets.PropertiesService.getScriptProperties().getProperty('MAIN_DB') || Object.keys(X.sheets.state.spreadsheets)[0]].getSheetByName('Soldiers'); const h = sh.getRange(1, 3).getValue(); sh.getRange(1, 3).setValue('renamed_col'); const w2 = writes(X);
  assert.strictEqual(E.code(() => RS(E, bk)), 'PREFLIGHT_FAILED', 'live sheet lost a column'); assert.strictEqual(writes(X), w2, 'no write'); sh.getRange(1, 3).setValue(h); });
t('hardening', 'permissions are enforced on the SERVER for every restore-related call (commander and unauthenticated: FORBIDDEN/UNAUTHENTICATED through api(), nothing written)', () => {
  const E = env(); const { X, admin, cmd } = E; const bk = X.Backup.create(admin, 'manual'); const w = writes(X); const before = dump(X);
  ['backup.restore', 'backup.recover', 'backup.plan', 'backup.verify', 'backup.create', 'backup.list', 'backup.prune'].forEach(k => { [cmd.email, '', 'ghost@x.com'].forEach(em => { X.Auth._emailProvider = () => em; const r = X.api(k, { id: bk.id, data: { confirm: 'RESTORE', reason: 'x' } }); assert.strictEqual(r.ok, false, k + ' as ' + em); }); });
  assert.strictEqual(writes(X), w, 'no writes'); sameDump(before, dump(X), 'unchanged'); X.Auth._emailProvider = () => 'admin@x.com'; assert.strictEqual(X.api('backup.restore', { id: bk.id, data: { reason: 'x' } }).ok, false, 'confirmation required'); assert.strictEqual(X.api('backup.restore', { id: bk.id, data: { confirm: 'RESTORE' } }).ok, false, 'reason required'); });
done();
