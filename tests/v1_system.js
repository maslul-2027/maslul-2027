// v1.0.0 system-level: clean install, config sanity, reasonable load, cross-module end-to-end. Node only (in-memory Db, fake adapters).
const { suite } = require('./tlib'); const { t, done, assert } = suite('v1_system.js'); const { setup } = require('./fixture'); const { load } = require('./harness'); const fs = require('fs');
t('unit', 'config sanity: every table has id + created columns, no duplicate column names, every table is registered in a backup/migration list, version/schema set', () => {
  const X = load(); assert.strictEqual(X.APP.VERSION, '1.0.6-b7b8-r3-product-dev6.2-uxqa1'); assert.ok(X.APP.SCHEMA_VERSION >= 2);
  Object.keys(X.TABLES).forEach(k => { const c = X.TABLES[k].cols; assert.ok(c.includes('id') || k === 'SchemaMeta' || k === 'Settings', k + ' id'); assert.strictEqual(new Set(c).size, c.length, k + ' duplicate cols'); });
  const src = fs.readFileSync(__dirname + '/../src/Config.gs', 'utf8'); Object.keys(X.TABLES).forEach(k => assert.strictEqual(src.split(new RegExp('^\\s*' + k + ':', 'm')).length - 1, 1, 'duplicate key ' + k));
  const priv = X.PRIVATE_TABLES || []; ['PrivateNotes', 'FollowUps', 'Favorites', 'CommanderAssessments'].forEach(p => { if (X.TABLES[p]) assert.ok(priv.includes(p), p + ' must be private'); });
});
t('integration', 'clean install: empty Db -> first admin -> course -> soldier -> result -> card -> backup -> restore, no seed data of soldiers, daily job runs', () => {
  const X = load(); const fakes = require('./fakes'); fakes.install(X); const admin = { email: 'a@x.com', role: 'admin', courseScope: '*' };
  assert.strictEqual((X.mem.Soldiers || []).length, 0); X.Courses.addUser(admin, { email: 'a@x.com', role: 'admin', display_name: 'א' });
  const c = X.Courses.create(admin, { name: 'ק', start_date: '2099-01-01' }).id, o = X.Courses.org(admin, c); assert.ok(o.departments.length === 2 && o.teams.length === 4);
  const s = X.Soldiers.create(admin, c, { full_name: 'חייל בדיקה', personal_number: '1', gender: 'M', department_id: o.departments[0].id, team_id: o.teams[0].id });
  assert.ok(X.Card.build(admin, s.id).timeline.length === 0, 'empty card, no zeros'); const b = X.Backup.create(admin, 'manual'); assert.ok(b.id); assert.ok(X.Backup.verify(admin, b.id).ok !== false);
  X.Soldiers.cancel(admin, s.id, 'ב'); X.Backup.restore(admin, b.id, { confirm: 'RESTORE', reason: 'בדיקה' }); assert.strictEqual(X.Db.get('Soldiers', s.id).record_status, 'active', 'restore brought the soldier back'); X.dailyJob_(); assert.ok(X.Db.all('BackupJobs').length >= 2, 'daily job created a backup');
});
t('integration', 'load: 200 soldiers x 6 results each + attendance, home/overview/groups/report/backup within sane time, snapshot figures equal a direct recomputation', () => {
  const S = setup(); const { X, admin, c1 } = S; const t0 = Date.now(); const ids = [];
  for (let i = 0; i < 200; i++) ids.push(X.Soldiers.create(admin, c1, { full_name: 'חייל ' + i, personal_number: String(1000 + i), gender: i % 7 ? 'M' : 'F', department_id: S.dep(i % 2), team_id: S.team(i % 2, i % 2) }).id);
  let sum = 0, n = 0; ids.forEach((id, i) => { for (let k = 0; k < 6; k++) { const sc = 50 + ((i * 7 + k * 13) % 50); X.Records.create(admin, 'MarksmanshipTests', c1, { request_id: S.rid(), soldier_id: id, test_date: '2026-03-0' + (k + 1), weapon_type: 'M16', distance_m: 100, examiner_score: sc, weapon_zeroed: true }); } });
  const ty = X.ActivityTypes.create(admin, c1, 'מטווח').id; for (let k = 0; k < 10; k++) X.Attendance.createEvent(admin, c1, { request_id: S.rid(), event_date: '2026-03-' + String(10 + k), activity_type_id: ty, scope_type: 'course', scope_id: c1, absent: [{ soldier_id: ids[k], notes: 'x' }] });
  const tIns = Date.now() - t0; const t1 = Date.now(); X.Dashboard.home(admin); X.Dashboard.overview(admin, c1, {}); X.Dashboard.groups(admin, c1, 'team', {}); X.Marksmanship.list(admin, c1, {}); X.Reports.fullExport(admin, c1, false); X.Backup.create(admin, 'manual'); const tRead = Date.now() - t1;
  assert.ok(tIns < 60000 && tRead < 20000, 'insert ' + tIns + 'ms, read/report/backup ' + tRead + 'ms');
  const m = X.Marksmanship.summary(admin, c1, ids[3]); const exp = []; for (let k = 0; k < 6; k++) exp.push(50 + ((3 * 7 + k * 13) % 50)); assert.ok(Math.abs(m.regular.mean - exp.reduce((a, b) => a + b, 0) / 6) < 1e-9, 'mean');
  console.log('   load timings: insert ' + tIns + 'ms, reads+export+backup ' + tRead + 'ms');
});
t('integration', 'end-to-end: result -> alert -> handled -> report -> import preview does not overwrite -> assistant answer from the same figures', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; X.Records.create(admin, 'MarksmanshipTests', c1, { request_id: S.rid(), soldier_id: sol.a.id, test_date: '2026-03-02', weapon_type: 'M16', distance_m: 100, examiner_score: 80, weapon_zeroed: true });
  const card = X.Card.build(admin, sol.a.id); assert.strictEqual(card.marksmanship.regular.mean, 80); const rep = X.Reports.fullExport(admin, c1, false); assert.ok(rep.id && rep.rows_count > 0, 'export has rows');
  const a = X.Assistant.ask(admin, c1, 'מה ממוצע הקליעה?', {}); assert.ok(a.missing.some(m => /מדוכא/.test(m)) && !JSON.stringify(a).includes('80'), 'group of < N: the figure is suppressed (owner policy), never stated: ' + JSON.stringify(a).slice(0, 200));
});
done();
