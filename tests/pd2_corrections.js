// product-dev2: correction requests keep a SNAPSHOT of the previous values taken when the request is made; the list returns it (null for old requests) + soldier of the record. Node only (in-memory simulation, NOT Google).
const { suite } = require('./tlib'); const { t, done, assert } = suite('pd2_corrections.js'); const { load } = require('./harness');
function setup() {
  const X = load(); const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
  const c1 = X.Courses.create(admin, { name: 'קורס א', start_date: '2026-01-01' }).id, c2 = X.Courses.create(admin, { name: 'קורס ב', start_date: '2026-02-01' }).id;
  const org = X.Courses.org(admin, c1), dep = org.departments[0].id, team = org.teams.find(x => x.department_id === dep).id;
  const mk = (course, pn, name, tm) => { const id = X.Util.uuid(); X.Db.insert('Soldiers', { id, course_id: course, personal_number: pn, full_name: name, gender: 'M', department_id: dep, team_id: tm || team, active: true, record_status: 'active' }); return id; };
  const s1 = mk(c1, '1001', 'דנה כהן'), nt = X.Util.uuid(); X.Db.insert('NavigationTypes', { id: nt, course_id: c1, name: 'יום', active: true });
  ['cmd1@x.com', 'cmd2@x.com'].forEach(e => { X.Courses.addUser(admin, { email: e, role: 'commander', course_ids: [c1], display_name: e }); X.Assignments.create(admin, { course_id: c1, user_email: e, scope_type: 'course', scope_id: c1, reason: 'בדיקה' }); });
  const cmd1 = { email: 'cmd1@x.com', role: 'commander', courseScope: [c1] }, cmd2 = { email: 'cmd2@x.com', role: 'commander', courseScope: [c1] };
  const payload = o => Object.assign({ request_id: X.Util.uuid(), soldier_id: s1, test_date: '2026-03-01', navigation_type_id: nt, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3, notes: '' }, o || {});
  const code = fn => { try { fn(); return null; } catch (e) { return e.code || 'JS:' + e.message; } };
  return { X, admin, cmd1, cmd2, c1, c2, s1, nt, payload, code, org };
}
t('integration', 'the request stores the previous values of exactly the changed fields; list returns them parsed + soldier name; empty previous value is kept as empty', () => {
  const { X, admin, cmd1, c1, s1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  const req = X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5, notes: 'הערה חדשה', distance_km: 4 }, 'הוקלד בטעות');
  assert.deepStrictEqual(JSON.parse(req.before_json), { plan_score: 4, notes: '', distance_km: 3 });
  const row = X.Records.listCorrections(admin, c1, 'pending')[0];
  assert.deepStrictEqual(row.before, { plan_score: 4, notes: '', distance_km: 3 }); assert.strictEqual(row.has_snapshot, true); assert.strictEqual(row.soldier_name, 'דנה כהן'); assert.strictEqual(row.soldier_id, s1);
  assert.deepStrictEqual(JSON.parse(row.changes_json), { plan_score: 5, notes: 'הערה חדשה', distance_km: 4 }); assert.strictEqual(row.reason, 'הוקלד בטעות'); assert.strictEqual(row.requested_by, 'cmd1@x.com'); assert.ok(row.requested_at);
});
t('integration', 'the snapshot does NOT change when the record is edited / corrected after the request was made', () => {
  const { X, admin, cmd1, c1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5 }, 'סיבה'); const before = X.Records.listCorrections(admin, c1, 'pending')[0].before;
  X.Records.adminEdit(admin, 'NavigationTests', id, { plan_score: 2, notes: 'אחרי' }, 'עריכת מנהל'); const after = X.Records.listCorrections(admin, c1, 'pending')[0];
  assert.deepStrictEqual(after.before, before); assert.strictEqual(after.before.plan_score, 4, 'still the value at request time (4), not the later 2');
});
t('integration', 'old requests (no before_json, as in data from before this version) list with before=null / has_snapshot=false — never undefined — and can still be approved', () => {
  const { X, admin, cmd1, c1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  const rid = X.Util.uuid(); X.Db.insert('CorrectionRequests', { id: rid, course_id: c1, table_name: 'NavigationTests', record_id: id, changes_json: JSON.stringify({ plan_score: 5 }), reason: 'ישן', requested_by: 'cmd1@x.com', requested_at: '2026-03-02T10:00:00Z', status: 'pending' });
  const row = X.Records.listCorrections(admin, c1, 'pending')[0]; assert.strictEqual(row.before, null); assert.strictEqual(row.has_snapshot, false); assert.ok('before' in row);
  X.Records.reviewCorrection(admin, rid, 'approve', 'ok'); assert.strictEqual(X.Records.list(admin, 'NavigationTests', c1)[0].plan_score, 5);
  const bad = X.Util.uuid(); X.Db.insert('CorrectionRequests', { id: bad, course_id: c1, table_name: 'NavigationTests', record_id: id, changes_json: '{}', before_json: 'not json', reason: 'x', requested_by: 'cmd1@x.com', requested_at: 'z', status: 'pending' });
  const r2 = X.Records.listCorrections(admin, c1, 'pending').find(x => x.id === bad); assert.strictEqual(r2.before, null); assert.strictEqual(r2.has_snapshot, false, 'corrupt snapshot is treated as missing');
});
t('hardening', 'commander sees only own requests of visible records; another commander, a commander of another scope and an out-of-course call see nothing / are refused; cancelled record hides the request', () => {
  const { X, admin, cmd1, cmd2, c1, c2, code, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5 }, 'סודי');
  assert.strictEqual(X.Records.listCorrections(cmd1, c1, 'pending').length, 1); assert.strictEqual(X.Records.listCorrections(cmd1, c1, 'pending')[0].before.plan_score, 4);
  assert.strictEqual(X.Records.listCorrections(cmd2, c1, 'pending').length, 0, 'another commander sees none');
  assert.ok(code(() => X.Records.listCorrections(cmd1, c2, 'pending')), 'course outside the commander scope refused');
  X.Records.cancel(admin, 'NavigationTests', id, 'בוטל'); assert.strictEqual(X.Records.listCorrections(cmd1, c1, 'pending').length, 0, 'cancelled record => request hidden from the commander');
  assert.strictEqual(X.Records.listCorrections(admin, c1, 'pending').length, 1, 'admin still sees it');
});
t('hardening', 'commander whose assignment does not cover the soldier does not get soldier name / snapshot; server API route still refuses the admin-only review', () => {
  const { X, admin, cmd1, c1, org, payload, code } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id; const req = X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5 }, 'x');
  X.Assignments.list && 0; const other = org.teams.find(x => x.id !== X.Db.get('Soldiers', X.Db.get('NavigationTests', id).soldier_id).team_id);
  const e = 'cmd3@x.com'; X.Courses.addUser(admin, { email: e, role: 'commander', course_ids: [c1], display_name: e }); X.Assignments.create(admin, { course_id: c1, user_email: e, scope_type: 'team', scope_id: other.id, reason: 'צוות אחר' });
  const cmd3 = { email: e, role: 'commander', courseScope: [c1] }; assert.strictEqual(X.Records.listCorrections(cmd3, c1, 'pending').length, 0);
  assert.strictEqual(code(() => X.Records.reviewCorrection(cmd1, req.id, 'approve')), 'FORBIDDEN');
});
t('integration', 'approve applies the requested value; reject leaves the record; the stored snapshot stays on the (now closed) request; no private fields are added to the list rows', () => {
  const { X, admin, cmd1, c1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id; const req = X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5 }, 'סיבה');
  X.Records.reviewCorrection(admin, req.id, 'reject', 'לא'); assert.strictEqual(X.Records.list(admin, 'NavigationTests', c1)[0].plan_score, 4);
  const closed = X.Records.listCorrections(admin, c1, 'rejected')[0]; assert.strictEqual(closed.before.plan_score, 4);
  const keys = Object.keys(closed).sort(); ['personal_number', 'phone', 'id_number', 'private'].forEach(k => assert.ok(!keys.includes(k), 'no ' + k));
  assert.ok(!/personal_number|phone/.test(JSON.stringify(closed)), 'no private data in correction rows');
});
t('integration', 'migration path (Sheets): an existing CorrectionRequests sheet without before_json gets the column appended; old rows are untouched and readable', () => {
  const { load: L } = require('./harness'), fakes = require('./fakes'); const X = L({ sheets: true }); X.sheets.PropertiesService.getScriptProperties().setProperty('ADMIN_EMAIL', 'admin@x.com'); X.Auth._emailProvider = () => 'admin@x.com'; X.setupDatabase(); X.Auth._emailProvider = null;
  const ss = X.SheetsStore.ss_('main'), sh = ss.getSheetByName('CorrectionRequests'); const old = X.TABLES.CorrectionRequests.cols.filter(c => c !== 'before_json'); ss.deleteSheet(sh); const ns = ss.insertSheet('CorrectionRequests');
  ns.getRange(1, 1, 1, old.length).setValues([old]); const row = old.map(c => ({ id: 'r1', course_id: 'c', table_name: 'NavigationTests', record_id: 'x', changes_json: '{"plan_score":5}', reason: 'ישן', status: 'pending', requested_by: 'a@x.com' }[c] || '')); ns.getRange(2, 1, 1, old.length).setValues([row]);
  const r = X.Db.ensureTable('CorrectionRequests'); assert.deepStrictEqual(r.addedCols, ['before_json'] ); const all = X.Db.all('CorrectionRequests'); assert.strictEqual(all.length, 1); assert.strictEqual(all[0].reason, 'ישן'); assert.ok(!all[0].before_json);
  const again = X.Db.ensureTable('CorrectionRequests'); assert.ok(!again.addedCols || !again.addedCols.length, 'idempotent');
});
done();
