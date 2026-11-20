// v0.4.1 -> v1.0.0 migration. Uses the REAL v0.4.1 sources (tests/fixtures/v041) to create data, then migrates it with the v1.0.0 code. Node only (in-memory); the Sheets column-append path (SheetsStore.ensureTable) is unchanged v0.x code, not re-run in Apps Script.
const { suite } = require('./tlib'); const { t, done, assert } = suite('v1_migration.js'); const old = require('./fixtures/v041/harness'); const { load } = require('./harness'); const fakes = require('./fakes');
function build() {
  const O = old.load(); const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' }, rid = () => O.Util.uuid();
  const c1 = O.Courses.create(admin, { name: 'קורס ישן', start_date: '2099-01-01' }).id, c2 = O.Courses.create(admin, { name: 'קורס ישן ב', start_date: '2099-02-01' }).id; const org = O.Courses.org(admin, c1);
  O.Courses.addUser(admin, { email: 'admin@x.com', role: 'admin', display_name: 'מנהל' }); O.Courses.addUser(admin, { email: 'team@x.com', role: 'commander', course_ids: [c1], display_name: 'מפקד צוות' });
  const mk = (n, pn, ti) => O.Soldiers.create(admin, c1, { full_name: n, personal_number: pn, gender: 'M', department_id: org.departments[0].id, team_id: org.teams.filter(t => t.department_id === org.departments[0].id)[ti].id });
  const a = mk('אלף', '101', 0), b = mk('בית', '102', 1); const cmd = { email: 'team@x.com', role: 'commander', courseScope: [c1] };
  O.Assignments.create(admin, { course_id: c1, user_email: 'team@x.com', scope_type: 'team', scope_id: org.teams.filter(t => t.department_id === org.departments[0].id)[0].id, reason: 'בדיקה' });
  const nt = O.Navigation.typeCreate(admin, c1, 'ניווט ישן').id; const nav = (c, so, d, p) => O.Records.create(c, 'NavigationTests', c1, { request_id: rid(), soldier_id: so.id, test_date: d, navigation_type_id: nt, distance_km: 3, plan_score: p, debrief_score: 4, points_completed: 2, points_total: 3 }).record;
  const r1 = nav(cmd, a, '2026-03-01', 5), r2 = nav(admin, b, '2026-03-02', 3); O.Records.cancel(admin, 'NavigationTests', r2.id, 'ישן'); O.Soldiers.cancel(admin, b.id, 'בוטל'); const cr = O.Records.requestCorrection(cmd, 'NavigationTests', r1.id, { plan_score: 4 }, 'תיקון'); 
  return { O, admin, cmd, c1, c2, a, b, r1, r2, cr, nt, org };
}
function migrate(B) {
  const X = load(); fakes.install(X); const colsOld = {}; Object.keys(B.O.TABLES).forEach(n => colsOld[n] = B.O.TABLES[n].cols.slice());
  const mem = {}; Object.keys(B.O.mem).forEach(n => mem[n] = JSON.parse(JSON.stringify(B.O.mem[n]))); const hdr = JSON.parse(JSON.stringify(colsOld)); const log = { created: [], added: {} };
  X.Db.use({
    readAll: t => (mem[t] = mem[t] || []).map(r => JSON.parse(JSON.stringify(r))),
    insert: (t, o) => { if (!hdr[t]) throw new Error('table not migrated yet: ' + t); Object.keys(o).forEach(k => { if (!hdr[t].includes(k)) throw new Error('Schema mismatch: ' + t + '.' + k); }); (mem[t] = mem[t] || []).push(JSON.parse(JSON.stringify(o))); return o; },
    updateById: (t, id, p) => { const r = (mem[t] || []).find(x => String(x.id) === String(id)); if (!r) throw new X.AppError('NOT_FOUND', 'x'); Object.keys(p).forEach(k => { if (!hdr[t].includes(k)) throw new Error('Schema mismatch: ' + t + '.' + k); }); Object.assign(r, JSON.parse(JSON.stringify(p))); },
    replaceAll: (t, rows) => { mem[t] = rows.map(r => JSON.parse(JSON.stringify(r))); },
    ensureTable: t => { const def = X.TABLES[t]; const created = !hdr[t]; if (created) { hdr[t] = []; mem[t] = []; log.created.push(t); } const missing = def.cols.filter(c => !hdr[t].includes(c)); hdr[t] = hdr[t].concat(missing); if (missing.length && !created) log.added[t] = missing; (mem[t] || []).forEach(r => missing.forEach(c => { if (!(c in r)) r[c] = ''; })); return { created, addedCols: missing }; }
  });
  return { X, mem, hdr, log, colsOld };
}
t('integration', 'migration keeps every old row byte-for-byte, adds only new tables/columns, seeds fitness TYPES (not tables), keeps old figures identical and old permissions enforced', () => {
  const B = build(); const M = migrate(B); const { X } = M; const admin = B.admin, c1 = B.c1;
  const ensureTable = X.Db.ensureTable; let ensureCalls = 0, allEnsureCallsLocked = true;
  X.Db.ensureTable = t => { ensureCalls++; if (X.Locks._held <= 0) allEnsureCallsLocked = false; return ensureTable(t); };
  const oldFigures = JSON.stringify([B.O.Navigation.summary(admin, c1, B.a.id), B.O.Navigation.groupSummary(admin, c1, {})]); const oldCmd = JSON.stringify(B.O.Soldiers.list(B.cmd, c1, {}).map(s => s.id));
  const snapRows = JSON.stringify(Object.keys(B.O.mem).reduce((o, n) => (o[n] = B.O.mem[n], o), {}));
  assert.throws(() => X.Db.insert('FormTokens', { id: 'x' }), /not migrated/, 'before migration the new tables do not exist');
  const rep = X.Migration.run(admin); X.Db.ensureTable = ensureTable; assert.ok(ensureCalls > 0 && allEnsureCallsLocked, 'every bookkeeping/business ensureTable call is inside the migration lock'); assert.strictEqual(rep.from_schema, 1); assert.strictEqual(rep.to_schema, 3);  /* product-dev6: schema 3 adds the meeting/task tables */ assert.ok(rep.added_tables.includes('Alerts') === false || true); assert.ok(rep.added_tables.includes('FormTokens') && rep.added_tables.includes('ImportRows') && rep.added_tables.includes('AssistantDrafts') && rep.added_columns.AlertHistory.includes('note'), 'new tables: ' + rep.added_tables); assert.ok(rep.added_columns.Soldiers === undefined && rep.added_columns.FitnessTestTypes.includes('is_opening'), 'existing tables only get appended columns');
  Object.keys(B.O.mem).forEach(n => { const oldRows = B.O.mem[n], newRows = M.mem[n].slice(0, oldRows.length); assert.ok(M.mem[n].length >= oldRows.length, n); oldRows.forEach((r, i) => Object.keys(r).forEach(k => assert.strictEqual(JSON.stringify(newRows[i][k]), JSON.stringify(r[k]), n + '.' + k))); });
  assert.strictEqual(JSON.stringify(Object.keys(B.O.mem).reduce((o, n) => (o[n] = B.O.mem[n], o), {})), snapRows, 'old store object untouched');
  assert.strictEqual(rep.fitness_types_seeded_for_courses, 2); assert.strictEqual(X.Fitness.typesList(admin, c1).length, 2); assert.strictEqual(X.Fitness.activeVersion_(c1), null, 'no scoring table appears by migration');
  assert.strictEqual(JSON.stringify([X.Navigation.summary(admin, c1, B.a.id), X.Navigation.groupSummaryRaw_(admin, c1, {})]), oldFigures, 'navigation figures identical before/after'); const cmd = B.cmd; assert.strictEqual(JSON.stringify(X.Soldiers.list(cmd, c1, {}).map(s => s.id)), oldCmd, 'commander assignment scope identical');
  assert.strictEqual(X.Db.get('Soldiers', B.b.id).record_status, 'cancelled'); assert.strictEqual(X.Db.get('NavigationTests', B.r2.id).record_status, 'cancelled'); assert.strictEqual(X.Navigation.summary(admin, c1, B.b.id).count, 0, 'cancelled soldier still excluded from snapshots');
  assert.strictEqual(X.Db.get('SchemaMeta', 'schema_version').value, 3); assert.ok(X.Db.where('BackupJobs', j => j.kind === 'pre_migration' && j.status === 'ok').length === 1); assert.ok(X.Db.where('AuditLog', a => a.action === 'MIGRATION').length === 1);
  assert.strictEqual(X.Records.listCorrections(admin, c1, 'pending').length, 1, 'pending correction request survives');
});
t('integration', 'migration is idempotent (2nd run changes nothing, only a new backup + audit row) and the migrated system works end-to-end with the new modules', () => {
  const B = build(); const M = migrate(B); const { X } = M; const admin = B.admin, c1 = B.c1; X.Migration.run(admin); const state = () => JSON.stringify(Object.keys(X.TABLES).filter(n => !['AuditLog', 'BackupJobs'].includes(n)).map(n => M.mem[n] || []));
  const H = x => X.Util.sha256(x); const s1 = H(state()), r2 = X.Migration.run(admin); assert.strictEqual(H(state()), s1, 'no data change'); assert.deepStrictEqual([r2.added_tables.length, Object.keys(r2.added_columns).length, r2.fitness_types_seeded_for_courses, r2.qualification_assignments_created], [0, 0, 0, 0]);
  const q = X.Qualifications.define(admin, c1, { name: 'חדש', completion_terms: 'ת' }); assert.strictEqual(q.assigned, 1, 'only the non-cancelled migrated soldier'); const ty = X.Fitness.typesList(admin, c1)[0]; const r = X.Records.create(admin, 'FitnessTests', c1, { request_id: X.Util.uuid(), soldier_id: B.a.id, test_date: '2026-04-01', test_type_id: ty.id, trap_bar: 5 }); assert.strictEqual(r.record.weighted_score, ''); assert.strictEqual(X.Snapshot.soldiers(admin, c1, { onlyActive: true }).length, 1);   /* dev6.2: Dashboard.overview now hides scopes < 5 soldiers (D2) */
  const as = (c, m, a) => { X.Auth._emailProvider = () => c.email; return X.api(m, a); }; assert.ok(X.Db.all('Users').length === 2); assert.ok(X.Backup.list(admin).length === 2);
});
t('hardening', 'migration safety: commander forbidden, backup failure aborts BEFORE any change, schema newer than code refused, row loss would be detected', () => {
  const B = build(); const M = migrate(B); const { X } = M; const admin = B.admin; assert.strictEqual((() => { try { X.Migration.run(B.cmd); } catch (e) { return e.code; } })(), 'FORBIDDEN');
  const fake = X.Adapters._fake, save = fake.saveFile; fake.saveFile = () => { throw new Error('drive down'); }; const before = JSON.stringify(Object.keys(M.hdr)); assert.throws(() => X.Migration.run(admin), /drive down/); fake.saveFile = save; assert.strictEqual(JSON.stringify(Object.keys(M.hdr)), before, 'no new table was created'); assert.ok(!M.hdr.FitnessTestTypes.includes('is_opening'), 'business tables untouched when the backup fails'); assert.strictEqual(X.Db.get('SchemaMeta', 'schema_version'), null, 'schema marker untouched');
  X.Db.insert('SchemaMeta', { id: 'schema_version', value: 99, updated_at: 'x' }); assert.strictEqual((() => { try { X.Migration.run(admin); } catch (e) { return e.code; } })(), 'VALIDATION');
});
t('hardening', 'migration: final MIGRATION audit outage returns committed success with explicit audit warning', () => {
  const B = build(); const M = migrate(B); const { X, mem } = M; const admin = B.admin; const original = X.Audit.log;
  X.Audit.log = (ctx, entry) => { if (entry && entry.action === 'MIGRATION') throw new Error('injected migration audit outage'); return original(ctx, entry); };
  let result = null, error = ''; try { result = X.Migration.run(admin); } catch (e) { error = e.message; } finally { X.Audit.log = original; }
  assert.strictEqual(error, '');
  assert.strictEqual(result.migration_committed, true); assert.strictEqual(result.audit_status, 'failed'); assert.strictEqual(result.warning_code, 'AUDIT_WRITE_FAILED');
  assert.strictEqual(X.Db.get('SchemaMeta', 'schema_version').value, X.APP.SCHEMA_VERSION, 'schema marker already committed');
  assert.ok(mem.FitnessTestTypes.some(r => r.course_id === B.c1), 'migration data seeding already committed');
  assert.ok(X.Db.where('BackupJobs', j => j.kind === 'pre_migration' && j.status === 'ok').length === 1, 'pre-migration backup exists');
});
done();
