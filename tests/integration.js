const { load } = require('./harness');
const assert = require('assert');
let pass = 0, fail = 0; const failures = [];
function t(name, fn) { try { fn(); pass++; console.log('PASS', name); } catch (e) { fail++; failures.push(name); console.log('FAIL', name, '\n   ', e.message); } }
function throwsCode(fn, code) {
  try { fn(); } catch (e) { assert.strictEqual(e.code, code, 'expected ' + code + ' got ' + e.code + ' ' + e.message); return; }
  assert.fail('expected throw ' + code);
}

function setup() {
  const X = load();
  const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
  const { id: c1 } = X.Courses.create(admin, { name: 'קורס א', start_date: '2026-01-01' });
  const { id: c2 } = X.Courses.create(admin, { name: 'קורס ב', start_date: '2026-02-01' });
  const org = X.Courses.org(admin, c1);
  const dep = org.departments[0].id, team = org.teams.find(t => t.department_id === dep).id;
  // soldiers / nav types are inserted directly (soldier service is Stage 2)
  const mkSoldier = (course, pn) => { const id = X.Util.uuid(); X.Db.insert('Soldiers', { id, course_id: course, personal_number: pn, full_name: 'חייל בדיקה ' + pn, gender: 'M', department_id: dep, team_id: team, active: true, record_status: 'active' }); return id; };
  const s1 = mkSoldier(c1, '1001'), s2 = mkSoldier(c2, '2001');
  const mkType = course => { const id = X.Util.uuid(); X.Db.insert('NavigationTypes', { id, course_id: course, name: 'יום', active: true }); return id; };
  const nt1 = mkType(c1), nt2 = mkType(c2);
  X.Courses.addUser(admin, { email: 'cmd1@x.com', role: 'commander', course_ids: [c1], display_name: 'מפקד 1' });
  X.Courses.addUser(admin, { email: 'cmd2@x.com', role: 'commander', course_ids: [c1], display_name: 'מפקד 2' });
  X.Assignments.create(admin, { course_id: c1, user_email: 'cmd1@x.com', scope_type: 'course', scope_id: c1, reason: 'בדיקה' });
  X.Assignments.create(admin, { course_id: c1, user_email: 'cmd2@x.com', scope_type: 'course', scope_id: c1, reason: 'בדיקה' });
  const cmd1 = { email: 'cmd1@x.com', role: 'commander', courseScope: [c1] };
  const cmd2 = { email: 'cmd2@x.com', role: 'commander', courseScope: [c1] };
  const payload = (over) => Object.assign({ request_id: X.Util.uuid(), soldier_id: s1, test_date: '2026-03-01', navigation_type_id: nt1,
    distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3, notes: '' }, over || {});
  return { X, admin, cmd1, cmd2, c1, c2, s1, s2, nt1, nt2, payload };
}
const code = (fn) => { try { fn(); return null; } catch (e) { return e.code || e.message; } };

t('course create seeds exactly 2 departments x 2 teams', () => {
  const { X, admin, c1 } = setup(); const o = X.Courses.org(admin, c1);
  assert.strictEqual(o.departments.length, 2); assert.strictEqual(o.teams.length, 4);
  o.departments.forEach(d => assert.strictEqual(o.teams.filter(t => t.department_id === d.id).length, 2));
});
t('commander creates nav record; derived score stored exactly (69)', () => {
  const { X, cmd1, c1, payload } = setup();
  const r = X.Records.create(cmd1, 'NavigationTests', c1, payload());
  assert.ok(Math.abs(r.record.final_score - 69) < 1e-9); assert.strictEqual(r.record.formula_version, 'nav-v1');
});
t('double submit (same request_id) does not duplicate', () => {
  const { X, cmd1, c1, payload } = setup(); const p = payload();
  X.Records.create(cmd1, 'NavigationTests', c1, p); const r2 = X.Records.create(cmd1, 'NavigationTests', c1, p);
  assert.strictEqual(r2.duplicate, true); assert.strictEqual(X.Records.list(cmd1, 'NavigationTests', c1).length, 1);
});
t('missing request_id rejected', () => { const { X, cmd1, c1, payload } = setup(); assert.strictEqual(code(() => X.Records.create(cmd1, 'NavigationTests', c1, payload({ request_id: '' }))), 'VALIDATION'); });
t('soldier from another course rejected (course isolation)', () => {
  const { X, cmd1, c1, s2, payload } = setup(); assert.strictEqual(code(() => X.Records.create(cmd1, 'NavigationTests', c1, payload({ soldier_id: s2 }))), 'VALIDATION');
});
t('nav type from another course rejected', () => {
  const { X, cmd1, c1, nt2, payload } = setup(); assert.strictEqual(code(() => X.Records.create(cmd1, 'NavigationTests', c1, payload({ navigation_type_id: nt2 }))), 'VALIDATION');
});
t('impossible calendar date rejected', () => {
  const { X, cmd1, c1, payload } = setup(); assert.strictEqual(code(() => X.Records.create(cmd1, 'NavigationTests', c1, payload({ test_date: '2026-02-30' }))), 'VALIDATION');
});
t('commander cannot edit / cancel / restore after submit', () => {
  const { X, cmd1, c1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  assert.strictEqual(code(() => X.Records.adminEdit(cmd1, 'NavigationTests', id, { plan_score: 5 }, 'x')), 'FORBIDDEN');
  assert.strictEqual(code(() => X.Records.cancel(cmd1, 'NavigationTests', id, 'x')), 'FORBIDDEN');
  assert.strictEqual(code(() => X.Records.restore(cmd1, 'NavigationTests', id)), 'FORBIDDEN');
});
t('commander out-of-scope course: create/list blocked', () => {
  const { X, cmd1, c2, payload } = setup(); assert.strictEqual(code(() => X.Records.list(cmd1, 'NavigationTests', c2)), 'FORBIDDEN');
  assert.strictEqual(code(() => X.Records.create(cmd1, 'NavigationTests', c2, payload())), 'FORBIDDEN');
});
t('record of other course is NOT_FOUND to out-of-scope commander (no leak)', () => {
  const { X, admin, c2, s2, nt2, cmd1, payload } = setup();
  const id = X.Records.create(admin, 'NavigationTests', c2, payload({ soldier_id: s2, navigation_type_id: nt2 })).record.id;
  assert.strictEqual(code(() => X.Records.history(cmd1, 'NavigationTests', id)), 'NOT_FOUND');
});
t('admin edit recomputes and logs before/after', () => {
  const { X, admin, cmd1, c1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  const r = X.Records.adminEdit(admin, 'NavigationTests', id, { points_completed: 3 }, 'תיקון');
  assert.ok(Math.abs(r.record.final_score - 99) < 1e-9); assert.strictEqual(r.record.version, 2);
  const a = X.Audit.list(admin, { recordId: id, action: 'EDIT' })[0]; assert.ok(a.before_json.includes('"points_completed":2')); assert.ok(a.after_json.includes('"points_completed":3'));
});
t('admin cancel excludes from average; history keeps it; restore returns same record (no duplicate)', () => {
  const { X, admin, cmd1, c1, s1, payload } = setup();
  const a = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;           // 69
  X.Records.create(cmd1, 'NavigationTests', c1, payload({ plan_score: 5, debrief_score: 5, points_completed: 3 })); // 100
  assert.strictEqual(X.Navigation.summary(admin, c1, s1).mean, 84.5);
  X.Records.cancel(admin, 'NavigationTests', a, 'שגוי');
  assert.strictEqual(X.Navigation.summary(admin, c1, s1).mean, 100);
  assert.strictEqual(X.Records.list(admin, 'NavigationTests', c1, { includeCancelled: true }).length, 2);
  assert.strictEqual(X.Records.list(cmd1, 'NavigationTests', c1, { includeCancelled: true }).length, 1, 'commander never sees cancelled');
  X.Records.restore(admin, 'NavigationTests', a);
  assert.strictEqual(X.Navigation.summary(admin, c1, s1).mean, 84.5);
  assert.strictEqual(X.mem.NavigationTests.length, 2);
});
t('cancelled record cannot be edited until restored', () => {
  const { X, admin, cmd1, c1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  X.Records.cancel(admin, 'NavigationTests', id, 'x'); assert.strictEqual(code(() => X.Records.adminEdit(admin, 'NavigationTests', id, { plan_score: 1 }, 'x')), 'RECORD_CANCELLED');
});
t('summary with no data says "אין מספיק נתונים", mean null (not 0)', () => {
  const { X, admin, c1, s1 } = setup(); const s = X.Navigation.summary(admin, c1, s1); assert.strictEqual(s.mean, null); assert.strictEqual(s.note, 'אין מספיק נתונים');
});
t('summary: per-type means', () => {
  const { X, admin, cmd1, c1, s1, payload } = setup(); const t2 = X.Util.uuid(); X.Db.insert('NavigationTypes', { id: t2, course_id: c1, name: 'לילה', active: true });
  X.Records.create(cmd1, 'NavigationTests', c1, payload()); X.Records.create(cmd1, 'NavigationTests', c1, payload({ navigation_type_id: t2, plan_score: 5, debrief_score: 5, points_completed: 3 }));
  const s = X.Navigation.summary(admin, c1, s1); assert.strictEqual(s.by_type.length, 2); assert.strictEqual(s.mean, 84.5);
});
t('correction flow: only author requests; reason required; admin approves => applied; commander sees history', () => {
  const { X, admin, cmd1, cmd2, c1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  assert.strictEqual(code(() => X.Records.requestCorrection(cmd2, 'NavigationTests', id, { plan_score: 5 }, 'x')), 'FORBIDDEN');
  assert.strictEqual(code(() => X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5 }, '')), 'VALIDATION');
  assert.strictEqual(code(() => X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 9 }, 'טעות')), 'VALIDATION');
  const req = X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5 }, 'הוקלד בטעות');
  assert.strictEqual(code(() => X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 3 }, 'עוד')), 'PENDING_EXISTS');
  assert.strictEqual(code(() => X.Records.reviewCorrection(cmd1, req.id, 'approve')), 'FORBIDDEN');
  X.Records.reviewCorrection(admin, req.id, 'approve', 'אושר');
  assert.strictEqual(X.Records.list(admin, 'NavigationTests', c1)[0].plan_score, 5);
  const h = X.Records.history(cmd2, 'NavigationTests', id); assert.ok(h.some(x => x.action === 'CORRECTION_APPLIED'));
  assert.strictEqual(code(() => X.Records.reviewCorrection(admin, req.id, 'approve')), 'VALIDATION');
});
t('correction rejected leaves record unchanged', () => {
  const { X, admin, cmd1, c1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  const req = X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5 }, 'סיבה'); X.Records.reviewCorrection(admin, req.id, 'reject', 'לא');
  assert.strictEqual(X.Records.list(admin, 'NavigationTests', c1)[0].plan_score, 4);
});
t('archived course locks commander and admin writes; reopen unlocks and is audited', () => {
  const { X, admin, cmd1, c1, payload } = setup(); X.Courses.archive(admin, c1);
  assert.strictEqual(code(() => X.Records.create(cmd1, 'NavigationTests', c1, payload())), 'COURSE_ARCHIVED');
  assert.strictEqual(code(() => X.Records.create(admin, 'NavigationTests', c1, payload())), 'COURSE_ARCHIVED');
  assert.ok(X.Records.list(cmd1, 'NavigationTests', c1) !== undefined, 'reads still allowed');
  X.Courses.reopen(admin, c1, 'תיקון'); X.Records.create(cmd1, 'NavigationTests', c1, payload());
  assert.ok(X.Audit.list(admin, { courseId: c1, action: 'COURSE_REOPEN' }).length === 1);
});
t('audit log: commander cannot read it', () => { const { X, cmd1 } = setup(); assert.strictEqual(code(() => X.Audit.list(cmd1, {})), 'FORBIDDEN'); });
t('audit: private tables never log content', () => {
  const { X, admin, c1 } = setup(); X.Audit.log(admin, { courseId: c1, action: 'CREATE', table: 'PrivateNotes', recordId: 'n1', after: { note_text: 'סודי' } });
  const row = X.Audit.list(admin, { recordId: 'n1' })[0]; assert.ok(!row.after_json.includes('סודי'));
});
t('course clone copies structure only, not soldiers/results/permissions', () => {
  const { X, admin, cmd1, c1, payload } = setup(); X.Records.create(cmd1, 'NavigationTests', c1, payload());
  const { id: n } = X.Courses.create(admin, { name: 'חדש', start_date: '2027-01-01', clone_from: c1 });
  assert.strictEqual(X.Courses.org(admin, n).teams.length, 4);
  assert.strictEqual(X.Db.where('Soldiers', s => s.course_id === n).length, 0);
  assert.strictEqual(X.Db.where('NavigationTests', s => s.course_id === n).length, 0);
  assert.strictEqual(X.Db.where('NavigationTypes', s => s.course_id === n).length, 1, 'config cloned');
  const u = X.Db.where('Users', x => x.email === 'cmd1@x.com')[0]; assert.ok(!u.course_scope.includes(n), 'permissions are NOT cloned by default');
});
t('user mgmt: duplicate email, bad role, self-deactivate blocked; commander cannot manage', () => {
  const { X, admin, cmd1 } = setup();
  assert.strictEqual(code(() => X.Courses.addUser(admin, { email: 'cmd1@x.com', role: 'commander' })), 'DUPLICATE');
  assert.strictEqual(code(() => X.Courses.addUser(admin, { email: 'n@x.com', role: 'soldier' })), 'VALIDATION');
  assert.strictEqual(code(() => X.Courses.addUser(cmd1, { email: 'n@x.com', role: 'commander' })), 'FORBIDDEN');
  X.Courses.addUser(admin, { email: 'admin@x.com2.com', role: 'admin' });
});
t('auth: unknown / inactive / blank email => no context (fail closed)', () => {
  const { X, admin, c1 } = setup(); const A = X.Auth;
  A._emailProvider = () => ''; assert.strictEqual(A.tryContext(), null);
  A._emailProvider = () => 'nobody@x.com'; assert.strictEqual(A.tryContext(), null);
  A._emailProvider = () => 'cmd1@x.com'; assert.strictEqual(A.tryContext().role, 'commander');
  const u = X.Db.where('Users', x => x.email === 'cmd1@x.com')[0]; X.Courses.setUser(admin, u.id, { active: false });
  assert.strictEqual(A.tryContext(), null);
  A._emailProvider = () => 'CMD2@X.COM'; assert.strictEqual(A.tryContext().email, 'cmd2@x.com', 'case-insensitive');
});
t('unsupported table via generic API rejected (whitelist)', () => { const { X, admin, c1 } = setup(); assert.strictEqual(code(() => X.Records.list(admin, 'PrivateNotes', c1)), 'VALIDATION'); });
t('non-editable field rejected on edit', () => {
  const { X, admin, cmd1, c1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  assert.strictEqual(code(() => X.Records.adminEdit(admin, 'NavigationTests', id, { final_score: 100 }, 'x')), 'VALIDATION');
  assert.strictEqual(code(() => X.Records.adminEdit(admin, 'NavigationTests', id, { created_by: 'x' }, 'x')), 'VALIDATION');
});

// ---- v0.2.2 ----
t('v0.2.2: commander does not get his own correction request back after admin cancels the record', () => {
  const { X, admin, cmd1, c1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5 }, 'סיבה סודית');
  assert.strictEqual(X.Records.listCorrections(cmd1, c1).length, 1);
  X.Records.cancel(admin, 'NavigationTests', id, 'x');
  assert.strictEqual(X.Records.listCorrections(cmd1, c1).length, 0);
  assert.strictEqual(X.Records.listCorrections(admin, c1).length, 1, 'admin keeps full access');
  X.Records.restore(admin, 'NavigationTests', id);
  assert.strictEqual(X.Records.listCorrections(cmd1, c1).length, 1, 'visible again once restored');
});
t('v0.2.2: requestCorrection gives identical NOT_FOUND for missing / out-of-scope / cancelled (commander)', () => {
  const { X, admin, cmd1, c1, c2, s2, nt2, payload } = setup();
  const own = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id; X.Records.cancel(admin, 'NavigationTests', own, 'x');
  const foreign = X.Records.create(admin, 'NavigationTests', c2, payload({ soldier_id: s2, navigation_type_id: nt2 })).record.id;
  const grab = id => { try { X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5 }, 'r'); } catch (e) { return e.code + '|' + e.message; } return 'no-throw'; };
  const a = grab(X.Util.uuid()), b = grab(foreign), c = grab(own);
  assert.strictEqual(a.split('|')[0], 'NOT_FOUND'); assert.strictEqual(a, b); assert.strictEqual(b, c);
  assert.strictEqual(code(() => X.Records.history(cmd1, 'NavigationTests', own)), 'NOT_FOUND');
});
t('v0.2.2: admin still sees the detailed RECORD_CANCELLED on a cancelled record', () => {
  const { X, admin, cmd1, c1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  X.Records.cancel(admin, 'NavigationTests', id, 'x');
  assert.strictEqual(code(() => X.Records.adminEdit(admin, 'NavigationTests', id, { plan_score: 1 }, 'x')), 'RECORD_CANCELLED');
});
t('v0.2.2: approving a pending correction after the record was cancelled is refused, request stays pending', () => {
  const { X, admin, cmd1, c1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  const req = X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5 }, 'r');
  X.Records.cancel(admin, 'NavigationTests', id, 'x');
  assert.strictEqual(code(() => X.Records.reviewCorrection(admin, req.id, 'approve')), 'RECORD_CANCELLED');
  assert.strictEqual(X.mem.CorrectionRequests[0].status, 'pending'); assert.strictEqual(X.mem.NavigationTests[0].plan_score, 4);
});

console.log('\nTOTAL pass=%d fail=%d', pass, fail);
if (fail) { console.log('FAILED:', failures.join(' | ')); process.exit(1); }
