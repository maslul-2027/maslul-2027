// Stage 3 (v0.4.0): commander assignments, cancelled-soldier snapshot rule, navigation module. [unit] / [integration] / [hardening].
// Node only (in-memory Db). Nothing here proves Apps Script behaviour — see docs/STAGING_TEST_PLAN.md S37+.
const { load } = require('./harness'); const assert = require('assert'); const fs = require('fs'), path = require('path');
const counts = { unit: 0, integration: 0, hardening: 0 }; let fail = 0; const failures = [];
function t(kind, name, fn) { try { fn(); counts[kind]++; console.log('PASS', '[' + kind + ']', name); } catch (e) { fail++; failures.push(name); console.log('FAIL', '[' + kind + ']', name, '\n   ', e.message.split('\n').slice(0,4).join(' | '), (e.stack.split('\n').find(l=>l.includes('stage3.js'))||'')); } }
const code = fn => { try { fn(); return null; } catch (e) { return e.code || ('JS:' + e.message); } };
const msg = fn => { try { fn(); return null; } catch (e) { return e.code + '|' + e.message; } };

function setup() {
  const X = load(); const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
  const c1 = X.Courses.create(admin, { name: 'קורס א', start_date: '2099-01-01' }).id, c2 = X.Courses.create(admin, { name: 'קורס ב', start_date: '2099-02-01' }).id;
  const o1 = X.Courses.org(admin, c1), o2 = X.Courses.org(admin, c2);
  const dep = i => o1.departments[i].id, team = (d, i) => o1.teams.filter(t => t.department_id === o1.departments[d].id)[i].id;
  X.Courses.addUser(admin, { email: 'admin@x.com', role: 'admin', display_name: 'מנהל' });
  const mkCmd = (email, courses) => { X.Courses.addUser(admin, { email, role: 'commander', course_ids: courses || [c1], display_name: 'שם-' + email.split('@')[0] }); return { email, role: 'commander', courseScope: courses || [c1] }; };
  const none = mkCmd('none@x.com'), cT = mkCmd('team@x.com'), cD = mkCmd('dept@x.com'), cC = mkCmd('course@x.com'), cU = mkCmd('union@x.com'), cX = mkCmd('x@x.com', [c1, c2]);
  const assign = (c, type, id, course) => X.Assignments.create(admin, { course_id: course || c1, user_email: c.email, scope_type: type, scope_id: id, reason: 'בדיקה' });
  const aT = assign(cT, 'team', team(0, 0)), aD = assign(cD, 'department', dep(0)), aC = assign(cC, 'course', c1); assign(cU, 'team', team(0, 0)); assign(cU, 'team', team(1, 1));
  X.Courses.addUser(admin, { email: 'other@x.com', role: 'commander', course_ids: [c1], display_name: 'מפקד-אחר-פרטי' }); const cO = { email: 'other@x.com', role: 'commander', courseScope: [c1] }; assign(cO, 'course', c1);
  const nt = X.Navigation.typeCreate(admin, c1, 'יום').id, nt2 = X.Navigation.typeCreate(admin, c1, 'לילה').id;
  const S = {}; // one soldier per team + extra in team(0,0)
  const mk = (n, pn, d, i) => X.Soldiers.create(admin, c1, { full_name: n, personal_number: pn, gender: 'M', department_id: dep(d), team_id: team(d, i), commander_note: 'SECRET' });
  S.a = mk('אלף', '101', 0, 0); S.a2 = mk('אלף-שני', '102', 0, 0); S.b = mk('בית', '201', 0, 1); S.c = mk('גימל', '301', 1, 0); S.d = mk('דלת', '401', 1, 1);
  S.f = X.Soldiers.create(admin, c2, { full_name: 'זר', personal_number: '101', gender: 'F', department_id: o2.departments[0].id, team_id: o2.teams[0].id });
  const nav = (ctxU, soldier, o) => X.Records.create(ctxU, 'NavigationTests', c1, Object.assign({ request_id: X.Util.uuid(), soldier_id: soldier.id, test_date: '2026-03-01', navigation_type_id: nt, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 }, o || {}));
  return { X, admin, c1, c2, o1, dep, team, none, cT, cD, cC, cU, cX, cO, aT, aD, aC, nt, nt2, S, nav, assign, mk,
    raceOnce: hook => { const orig = X.Locks.run; X.Locks.run = function (fn) { X.Locks.run = orig; hook(); return orig(fn); }; }, as: (c, m, a) => { X.Auth._emailProvider = () => c.email; return X.api(m, a); } };
}
const names = r => r.map(s => s.full_name).sort();

// ============ unit ============
t('unit', 'covers_: course / department / team scopes; a foreign scope id never matches', () => {
  const { X, c1 } = setup(); const s = { course_id: c1, department_id: 'D1', team_id: 'T1' }; const A = (type, id) => ({ scope_type: type, scope_id: id });
  assert.ok(X.Assignments.covers_([A('course', c1)], s)); assert.ok(X.Assignments.covers_([A('department', 'D1')], s)); assert.ok(X.Assignments.covers_([A('team', 'T1')], s));
  assert.ok(!X.Assignments.covers_([A('department', 'D2')], s)); assert.ok(!X.Assignments.covers_([A('team', 'T2')], s)); assert.ok(!X.Assignments.covers_([A('course', 'other')], s)); assert.ok(!X.Assignments.covers_([], s));
  assert.ok(!X.Assignments.covers_([A('team', 'D1')], s), 'a department id used as a team id must not match'); assert.ok(X.Assignments.covers_([A('team', 'T2'), A('department', 'D1')], s), 'union');
});
t('unit', 'checkScope_: type / target validation (course id, department/team of the course, scalars only)', () => {
  const S = setup(); const { X, c1, c2 } = S; const o2 = X.Courses.org(S.admin, c2); const E = (ty, id) => code(() => X.Assignments.checkScope_(c1, ty, id));
  assert.strictEqual(E('course', c1), null); assert.strictEqual(E('course', c2), 'VALIDATION'); assert.strictEqual(E('galaxy', c1), 'VALIDATION'); assert.strictEqual(E('department', S.dep(0)), null); assert.strictEqual(E('team', S.team(0, 0)), null);
  assert.strictEqual(E('department', o2.departments[0].id), 'VALIDATION', 'other course'); assert.strictEqual(E('team', S.dep(0)), 'VALIDATION', 'dept id as team'); assert.strictEqual(E('team', {}), 'VALIDATION'); assert.strictEqual(E(['team'], S.team(0, 0)), 'VALIDATION');
  X.Db.update('Teams', S.team(0, 1), { active: false }); assert.strictEqual(E('team', S.team(0, 1)), 'VALIDATION', 'inactive team');
});
t('unit', 'checkUser_: only a registered commander of THIS course', () => {
  const S = setup(); const { X, c1, c2 } = S; const E = em => code(() => X.Assignments.checkUser_(c1, em));
  assert.strictEqual(E('team@x.com'), null); assert.strictEqual(E('TEAM@X.COM'), null); assert.strictEqual(E('nobody@x.com'), 'VALIDATION'); assert.strictEqual(E('admin@x.com'), 'VALIDATION', 'admin needs no assignment'); assert.strictEqual(E({}), 'VALIDATION');
  assert.strictEqual(code(() => X.Assignments.checkUser_(c2, 'team@x.com')), 'VALIDATION', 'commander not in that course');
});
t('unit', 'visibleFn_: no assignment => nothing; cancelled assignment ignored; admin everything; non-commander nothing', () => {
  const S = setup(); const { X, c1 } = S; const row = { course_id: c1, department_id: S.dep(0), team_id: S.team(0, 0), active: true, record_status: 'active' };
  assert.strictEqual(X.Soldiers.visibleFn_(S.none, c1)(row), false); assert.strictEqual(X.Soldiers.visibleFn_(S.cT, c1)(row), true); assert.strictEqual(X.Soldiers.visibleFn_(S.admin, c1)(Object.assign({}, row, { active: false })), true);
  X.Assignments.setActive(S.admin, S.aT.id, false, S.aT.updated_at, 'r'); assert.strictEqual(X.Soldiers.visibleFn_(S.cT, c1)(row), false);
  assert.strictEqual(X.Soldiers.visibleFn_({ email: 'q', role: 'soldier', courseScope: [c1] }, c1)(row), false); assert.strictEqual(X.Soldiers.visibleFn_(S.cX, S.c2)(row), false, 'other course: no assignment there');
});
t('unit', 'Snapshot.eligible_: only cancelled soldiers are excluded', () => { const { X } = setup(); assert.ok(X.Snapshot.eligible_({ record_status: 'active', active: false })); assert.ok(!X.Snapshot.eligible_({ record_status: 'cancelled', active: true })); assert.ok(!X.Snapshot.eligible_(null)); });
t('unit', 'aggregate_: simple mean overall / per type, empty => "אין מספיק נתונים" (never 0)', () => {
  const { X, nt, nt2 } = setup(); const r = (ty, f) => ({ navigation_type_id: ty, final_score: f });
  const a = X.Navigation.aggregate_([r(nt, 69), r(nt, 81), r(nt2, 60)]); assert.strictEqual(a.count, 3); assert.ok(Math.abs(a.mean - 70) < 1e-9); assert.strictEqual(a.by_type.find(x => x.type_id === nt).mean, 75);
  const e = X.Navigation.aggregate_([]); assert.strictEqual(e.mean, null); assert.strictEqual(e.note, 'אין מספיק נתונים'); assert.strictEqual(e.mean_display, null === e.mean ? e.mean_display : '');
});
t('unit', 'navigation type name rules: required, <=50, unique per course (case/space-insensitive)', () => {
  const S = setup(); const { X, c1 } = S; const E = n => code(() => X.Navigation.cleanTypeName_(c1, n, null));
  assert.strictEqual(E(''), 'VALIDATION'); assert.strictEqual(E('x'.repeat(51)), 'VALIDATION'); assert.strictEqual(E('  יום '), 'DUPLICATE'); assert.strictEqual(E('חדש'), null); assert.strictEqual(E({}), 'VALIDATION');
});
t('unit', 'policy: assignment.manage is admin-only and blocked on an archived course', () => {
  const { X, cC, c1 } = setup(); assert.strictEqual(X.Policy.check(cC, 'assignment.manage', { courseId: c1 }).code, 'FORBIDDEN');
  assert.strictEqual(X.Policy.check({ email: 'a', role: 'admin' }, 'assignment.manage', { courseId: c1, courseStatus: 'archived' }).code, 'COURSE_ARCHIVED');
});
t('unit', 'STRUCTURE: Calc.mean only inside Navigation.aggregate_ and Snapshot.mean_; Calc.attendancePercent only inside Attendance.aggregate_; current-state summaries take rows only from Snapshot', () => {
  const dir = path.join(__dirname, '..', 'src'); const files = fs.readdirSync(dir).filter(f => f.endsWith('.gs')); const src = f => fs.readFileSync(path.join(dir, f), 'utf8');
  const users = files.filter(f => src(f).includes('Calc.mean(')).filter(f => f !== 'Calc.gs');
  assert.deepStrictEqual(users.sort(), ['Navigation.gs', 'Snapshot.gs']);
  const nav = src('Navigation.gs'); const body = nav.slice(nav.indexOf('aggregate_(rows)'), nav.indexOf('summary(ctx, courseId, soldierId)'));
  assert.strictEqual((nav.match(/Calc\.mean\(/g) || []).length, (body.match(/Calc\.mean\(/g) || []).length, 'every Calc.mean call in Navigation lives in aggregate_');
  const snap = src('Snapshot.gs'); const mb = snap.slice(snap.indexOf('mean_(rows, key)')); assert.strictEqual((snap.match(/Calc\.mean\(/g) || []).length, (mb.match(/Calc\.mean\(/g) || []).length, 'Snapshot: only in mean_');
  assert.deepStrictEqual(files.filter(f => src(f).includes('Calc.attendancePercent(')).filter(f => f !== 'Calc.gs'), ['Attendance.gs']);
  const att = src('Attendance.gs'); assert.strictEqual((att.match(/Calc\.attendancePercent\(/g) || []).length, 1);
  const { X } = setup(); [X.Navigation.summary, X.Navigation.groupSummaryRaw_, X.Fitness.summary, X.Marksmanship.summary, X.Exams.summary, X.Attendance.summary, X.Marches.summary, X.Readiness.summary].forEach(f => { const s = f.toString(); assert.ok(s.includes('Snapshot.'), 'uses Snapshot: ' + s.slice(0, 40)); assert.ok(!s.includes('Records.list') && !/Db\.where\('(Navigation|Fitness|Marksmanship|TheoreticalExam|Attendance|Marc|Readiness)/.test(s), 'no direct result reads'); });
});

// ============ integration ============
t('integration', 'commander WITHOUT assignment: no soldiers, no results, no groups, cannot enter results; still sees course + structure; mine() says so', () => {
  const S = setup(); const { X } = S; S.nav(S.cC, S.S.a);
  assert.strictEqual(X.Soldiers.list(S.none, S.c1).length, 0); assert.strictEqual(code(() => X.Soldiers.card(S.none, S.S.a.id)), 'NOT_FOUND');
  assert.strictEqual(X.Navigation.list(S.none, S.c1).length, 0); assert.strictEqual(X.Navigation.summary(S.none, S.c1, S.S.a.id).count, 0); const g = X.Navigation.groupSummaryRaw_(S.none, S.c1); assert.strictEqual(g.course.soldiers, 0); assert.strictEqual(g.soldiers.length, 0);
  assert.strictEqual(code(() => S.nav(S.none, S.S.a)), 'VALIDATION'); assert.strictEqual(X.Courses.list(S.none).length, 1); assert.strictEqual(X.Courses.org(S.none, S.c1).teams.length, 4);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(X.Assignments.mine(S.none, S.c1))), { course_wide: false, has_assignment: false, department_ids: [], team_ids: [] });
});
t('integration', 'commander assigned to ONE TEAM: sees exactly that team (list, card, results, groups); other teams/departments are NOT_FOUND', () => {
  const S = setup(); const { X } = S; S.nav(S.cC, S.S.a); S.nav(S.cC, S.S.b); S.nav(S.cC, S.S.c);
  assert.deepStrictEqual(names(X.Soldiers.list(S.cT, S.c1)), ['אלף', 'אלף-שני']); assert.ok(X.Soldiers.card(S.cT, S.S.a.id));
  [S.S.b, S.S.c, S.S.d].forEach(s => assert.strictEqual(code(() => X.Soldiers.card(S.cT, s.id)), 'NOT_FOUND'));
  assert.deepStrictEqual(X.Navigation.list(S.cT, S.c1).map(r => r.soldier_name), ['אלף']); const g = X.Navigation.groupSummaryRaw_(S.cT, S.c1);
  assert.deepStrictEqual(g.teams.map(x => x.id), [S.team(0, 0)]); assert.strictEqual(g.course.soldiers, 2); assert.strictEqual(g.course.count, 1); assert.deepStrictEqual(JSON.parse(JSON.stringify(X.Assignments.mine(S.cT, S.c1))), { course_wide: false, has_assignment: true, department_ids: [S.dep(0)], team_ids: [S.team(0, 0)] });
});
t('integration', 'commander assigned to a WHOLE DEPARTMENT: sees BOTH of its teams, nothing of the other department', () => {
  const S = setup(); const { X } = S; assert.deepStrictEqual(names(X.Soldiers.list(S.cD, S.c1)), ['אלף', 'אלף-שני', 'בית']); assert.strictEqual(code(() => X.Soldiers.card(S.cD, S.S.c.id)), 'NOT_FOUND');
  assert.deepStrictEqual(X.Navigation.groupSummaryRaw_(S.cD, S.c1).departments.map(d => d.id), [S.dep(0)]); assert.strictEqual(X.Navigation.groupSummaryRaw_(S.cD, S.c1).teams.length, 2);
});
t('integration', 'course-wide assignment sees everything; several assignments are a UNION', () => {
  const S = setup(); const { X } = S; assert.strictEqual(X.Soldiers.list(S.cC, S.c1).length, 5); assert.deepStrictEqual(names(X.Soldiers.list(S.cU, S.c1)), ['אלף', 'אלף-שני', 'דלת']);
});
t('integration', 'assignment CRUD by admin: create / update scope / cancel / restore — each audited with before+after (+reason); duplicates and invalid targets rejected', () => {
  const S = setup(); const { X } = S; const A = X.Assignments.create(S.admin, { course_id: S.c1, user_email: 'none@x.com', scope_type: 'team', scope_id: S.team(1, 0), reason: 'בדיקה' });
  const log = a => X.Db.where('AuditLog', x => x.action === a && x.record_id === A.id)[0]; assert.deepStrictEqual(JSON.parse(log('ASSIGNMENT_CREATE').after_json).scope_id, S.team(1, 0));
  assert.strictEqual(code(() => X.Assignments.create(S.admin, { course_id: S.c1, user_email: 'none@x.com', scope_type: 'team', scope_id: S.team(1, 0), reason: 'בדיקה' })), 'DUPLICATE');
  const u = X.Assignments.update(S.admin, A.id, { scope_type: 'department', scope_id: S.dep(1) }, A.updated_at, 'הרחבה'); assert.strictEqual(u.scope_type, 'department');
  const ul = log('ASSIGNMENT_UPDATE'); assert.deepStrictEqual(JSON.parse(ul.before_json), { scope_type: 'team', scope_id: S.team(1, 0) }); assert.deepStrictEqual(JSON.parse(ul.after_json), { scope_type: 'department', scope_id: S.dep(1) }); assert.strictEqual(ul.reason, 'הרחבה');
  const c = X.Assignments.setActive(S.admin, A.id, false, u.updated_at, 'הוסר'); assert.strictEqual(c.active, false); assert.ok(log('ASSIGNMENT_CANCEL')); const r = X.Assignments.setActive(S.admin, A.id, true, c.updated_at, 'חזר'); assert.strictEqual(r.active, true); assert.ok(log('ASSIGNMENT_RESTORE'));
  const E = (p, ex) => code(() => X.Assignments.create(S.admin, Object.assign({ course_id: S.c1, user_email: 'none@x.com', scope_type: 'course', scope_id: S.c1 }, p)));
  assert.strictEqual(E({ user_email: 'admin@x.com' }), 'VALIDATION'); assert.strictEqual(E({ scope_id: S.c2 }), 'VALIDATION'); assert.strictEqual(E({ user_email: 'ghost@x.com' }), 'VALIDATION');
  assert.strictEqual(code(() => X.Assignments.update(S.admin, A.id, { scope_type: 'department' }, r.updated_at, 'x')), 'VALIDATION', 'no actual change'); assert.strictEqual(code(() => X.Assignments.update(S.admin, A.id, { scope_id: S.dep(0) }, r.updated_at, '')), 'VALIDATION', 'reason required');
  assert.strictEqual(X.Db.where('CommanderAssignments', a => a.id === A.id).length, 1, 'no physical delete');
});
t('integration', 'only the admin manages assignments — commanders get FORBIDDEN on every assignment API (direct call)', () => {
  const S = setup(); const a = S.aT;
  [['assignments.list', { courseId: S.c1 }], ['assignments.create', { data: { course_id: S.c1, user_email: 'none@x.com', scope_type: 'course', scope_id: S.c1 } }], ['assignments.update', { id: a.id, patch: { scope_type: 'course', scope_id: S.c1 }, expected_updated_at: a.updated_at, reason: 'r' }],
    ['assignments.setActive', { id: a.id, active: false, expected_updated_at: a.updated_at, reason: 'r' }]].forEach(([m, args]) => assert.strictEqual(S.as(S.cC, m, args).code, 'FORBIDDEN', m));
  assert.strictEqual(S.X.Db.get('CommanderAssignments', a.id).active, true); assert.ok(S.as(S.admin, 'assignments.list', { courseId: S.c1 }).ok);
});
t('integration', 'archived course: assignments cannot be created/changed even by admin', () => {
  const S = setup(); S.X.Db.update('Courses', S.c1, { status: 'archived' });
  assert.strictEqual(code(() => S.assign(S.none, 'course', S.c1)), 'COURSE_ARCHIVED'); assert.strictEqual(code(() => S.X.Assignments.setActive(S.admin, S.aT.id, false, S.aT.updated_at, 'r')), 'COURSE_ARCHIVED');
});
t('integration', 'assignment changes take effect on the very next request (cancel hides, widen shows)', () => {
  const S = setup(); const { X } = S; assert.strictEqual(X.Soldiers.list(S.cT, S.c1).length, 2); const u = X.Assignments.update(S.admin, S.aT.id, { scope_type: 'department', scope_id: S.dep(0) }, S.aT.updated_at, 'הרחבה'); assert.strictEqual(X.Soldiers.list(S.cT, S.c1).length, 3);
  X.Assignments.setActive(S.admin, S.aT.id, false, u.updated_at, 'r'); assert.strictEqual(X.Soldiers.list(S.cT, S.c1).length, 0); assert.strictEqual(code(() => X.Soldiers.card(S.cT, S.S.a.id)), 'NOT_FOUND');
});
t('integration', "moving a SOLDIER between teams changes who sees him, immediately", () => {
  const S = setup(); const { X } = S; const to = { department_id: S.dep(0), team_id: S.team(0, 1) }; const sa = X.Db.get('Soldiers', S.S.a.id);
  X.Soldiers.reassign(S.admin, S.S.a.id, to, sa.updated_at, 'איזון'); assert.strictEqual(code(() => X.Soldiers.card(S.cT, S.S.a.id)), 'NOT_FOUND'); assert.strictEqual(X.Soldiers.list(S.cT, S.c1).length, 1); assert.ok(X.Soldiers.card(S.cD, S.S.a.id));
});
t('integration', 'API direct (out-of-scope commander): list / card / nav.list (soldier, team, department filters) / summary / groups / history / corrections / create — all closed, answers identical to "missing"', () => {
  const S = setup(); const { X } = S; const rec = S.nav(S.cC, S.S.c).record; X.Records.requestCorrection(S.cC, 'NavigationTests', rec.id, { plan_score: 5 }, 'סיבה-סודית');
  const A = (m, a) => S.as(S.cT, m, a);
  assert.deepStrictEqual(names(A('soldiers.list', { courseId: S.c1, opts: { departmentId: S.dep(1) } }).data), []); assert.strictEqual(A('soldiers.card', { id: S.S.c.id }).code, 'NOT_FOUND'); assert.strictEqual(A('soldiers.card', { id: S.S.c.id }).message, A('soldiers.card', { id: 'nope' }).message);
  assert.deepStrictEqual(A('nav.list', { courseId: S.c1, soldierId: S.S.c.id }).data, []); assert.deepStrictEqual(A('nav.list', { courseId: S.c1, teamId: S.team(1, 0) }).data, []); assert.deepStrictEqual(A('nav.list', { courseId: S.c1, departmentId: S.dep(1) }).data, []);
  assert.strictEqual(A('nav.summary', { courseId: S.c1, soldierId: S.S.c.id }).data.count, 0); { const gc = A('nav.groups', { courseId: S.c1, opts: { teamId: S.team(1, 0) } }).data.course; assert.ok(gc.count === 0 || gc.count === null, 'no figure for an out-of-scope team'); }
  assert.strictEqual(A('record.history', { table: 'NavigationTests', id: rec.id }).code, 'NOT_FOUND'); assert.strictEqual(A('correction.list', { courseId: S.c1 }).data.length, 0); assert.strictEqual(A('correction.request', { table: 'NavigationTests', id: rec.id, changes: { plan_score: 1 }, reason: 'r' }).code, 'NOT_FOUND');
  const blocked = A('nav.create', { courseId: S.c1, data: { request_id: 'q1', soldier_id: S.S.c.id, test_date: '2026-03-01', navigation_type_id: S.nt, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 } }); const missing = A('nav.create', { courseId: S.c1, data: { request_id: 'q2', soldier_id: 'nope', test_date: '2026-03-01', navigation_type_id: S.nt, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 } });
  assert.deepStrictEqual(blocked, missing); assert.ok(!JSON.stringify([A('nav.groups', { courseId: S.c1 }), A('nav.list', { courseId: S.c1 })]).includes('סיבה-סודית'));
});
t('integration', 'entering results: in-scope soldier OK, creator recorded, idempotent replay; out-of-scope blocked; list shows creator NAME (commander) / email (admin)', () => {
  const S = setup(); const { X } = S; const p = { request_id: 'rq-1', soldier_id: S.S.a.id, test_date: '2026-03-05', navigation_type_id: S.nt, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 };
  const r = X.Records.create(S.cT, 'NavigationTests', S.c1, p); assert.strictEqual(r.duplicate, false); assert.strictEqual(r.record.created_by, 'team@x.com'); assert.ok(Math.abs(r.record.final_score - 69) < 1e-9);
  assert.strictEqual(X.Records.create(S.cT, 'NavigationTests', S.c1, p).duplicate, true); assert.strictEqual(X.mem.NavigationTests.length, 1);
  assert.strictEqual(code(() => X.Records.create(S.cT, 'NavigationTests', S.c1, Object.assign({}, p, { request_id: 'rq-2', soldier_id: S.S.c.id }))), 'VALIDATION');
  const mine = X.Navigation.list(S.cD, S.c1)[0]; assert.strictEqual(mine.created_by_name, 'שם-team'); assert.ok(!('created_by' in mine)); assert.strictEqual(X.Navigation.list(S.cT, S.c1)[0].own, true); assert.strictEqual(X.Navigation.list(S.cD, S.c1)[0].own, false);
  const adm = X.Navigation.list(S.admin, S.c1)[0]; assert.strictEqual(adm.created_by, 'team@x.com'); assert.strictEqual(adm.record_status, 'active');
});
t('integration', 'edit / correct / cancel / restore of a result with the existing mechanism; every change audited; history visible to the commander', () => {
  const S = setup(); const { X } = S; const rec = S.nav(S.cT, S.S.a).record;
  const req = X.Records.requestCorrection(S.cT, 'NavigationTests', rec.id, { plan_score: 5 }, 'שגיאת הקלדה'); assert.strictEqual(code(() => X.Records.requestCorrection(S.cD, 'NavigationTests', rec.id, { plan_score: 1 }, 'r')), 'FORBIDDEN', 'only the author');
  X.Records.reviewCorrection(S.admin, req.id, 'approve', 'אושר'); assert.strictEqual(X.Db.get('NavigationTests', rec.id).plan_score, 5);
  X.Records.adminEdit(S.admin, 'NavigationTests', rec.id, { debrief_score: 3 }, 'תיקון מנהל'); X.Records.cancel(S.admin, 'NavigationTests', rec.id, 'בוטל'); assert.strictEqual(X.Navigation.list(S.cT, S.c1).length, 0); assert.strictEqual(X.Navigation.list(S.admin, S.c1, { includeCancelled: true }).length, 1);
  X.Records.restore(S.admin, 'NavigationTests', rec.id); assert.strictEqual(X.Navigation.list(S.cT, S.c1).length, 1);
  const acts = X.Db.where('AuditLog', a => a.record_id === rec.id).map(a => a.action); ['CREATE', 'CORRECTION_REQUEST', 'CORRECTION_APPLIED', 'CORRECTION_APPROVED', 'EDIT', 'CANCEL', 'RESTORE'].forEach(a => assert.ok(acts.includes(a), a));
  assert.ok(X.Records.history(S.cT, 'NavigationTests', rec.id).length >= 5); assert.strictEqual(X.Db.where('NavigationTests', () => true).length, 1);
});
t('integration', 'results list: by soldier / team / department / course / type / date range; shape and ordering (newest first)', () => {
  const S = setup(); const { X } = S; S.nav(S.cC, S.S.a, { test_date: '2026-03-01' }); S.nav(S.cC, S.S.b, { test_date: '2026-03-10', navigation_type_id: S.nt2 }); S.nav(S.cC, S.S.c, { test_date: '2026-04-01' });
  const L = o => X.Navigation.list(S.admin, S.c1, o).map(r => r.soldier_name);
  assert.deepStrictEqual(L({}), ['גימל', 'בית', 'אלף']); assert.deepStrictEqual(L({ soldierId: S.S.b.id }), ['בית']); assert.deepStrictEqual(L({ teamId: S.team(0, 0) }), ['אלף']); assert.deepStrictEqual(L({ departmentId: S.dep(0) }), ['בית', 'אלף']);
  assert.deepStrictEqual(L({ typeId: S.nt2 }), ['בית']); assert.deepStrictEqual(L({ from: '2026-03-05', to: '2026-03-31' }), ['בית']); assert.strictEqual(code(() => X.Navigation.list(S.admin, S.c1, { from: '2026-13-01' })), 'VALIDATION');
  const row = X.Navigation.list(S.admin, S.c1)[0]; ['team_name', 'department_name', 'type_name', 'final_display', 'points_score_display', 'test_date'].forEach(k => assert.ok(row[k] !== undefined, k));
});
t('integration', 'group figures: hand-computed means per team / department / course, per-type, coverage ("no result yet"), no ranking order', () => {
  const S = setup(); const { X } = S; const sc = (p, d, n, T) => S.nav(S.cC, p, { plan_score: n, debrief_score: n, points_completed: T, points_total: 3 }); // finals: 5+5+90*T/3
  sc(S.S.a, 0, 5, 3); /*100*/ sc(S.S.a2, 0, 4, 3); /*98*/ sc(S.S.b, 0, 3, 0); /*6*/ S.nav(S.cC, S.S.b, { navigation_type_id: S.nt2, plan_score: 5, debrief_score: 5, points_completed: 3, points_total: 3 }); /*100 type2*/
  const g = X.Navigation.groupSummaryRaw_(S.admin, S.c1); const team = id => g.teams.find(t => t.id === id); const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  assert.strictEqual(team(S.team(0, 0)).count, 2); assert.strictEqual(team(S.team(0, 0)).mean_display, X.Util.display1(mean([100, 98]))); assert.strictEqual(team(S.team(0, 1)).count, 2); assert.strictEqual(team(S.team(0, 1)).mean_display, X.Util.display1(mean([6, 100])));
  assert.strictEqual(g.departments.find(d => d.id === S.dep(0)).mean_display, X.Util.display1(mean([100, 98, 6, 100]))); assert.strictEqual(g.course.count, 4); assert.strictEqual(g.course.soldiers, 5); assert.strictEqual(g.course.soldiers_with_results, 3);
  assert.strictEqual(team(S.team(1, 0)).note, 'אין מספיק נתונים'); assert.strictEqual(team(S.team(1, 0)).count, 0); assert.strictEqual(g.course.by_type.length, 2);
  assert.deepStrictEqual(g.soldiers.map(s => s.full_name), names(g.soldiers).slice().sort((a, b) => a.localeCompare(b, 'he')).length ? g.soldiers.map(s => s.full_name).slice().sort((a, b) => a.localeCompare(b, 'he')) : [], 'ordered by name, never by score');
  assert.strictEqual(g.soldiers.find(s => s.full_name === 'גימל').count, 0); assert.strictEqual(X.Navigation.groupSummaryRaw_(S.admin, S.c1, { typeId: S.nt2 }).course.count, 1); assert.strictEqual(X.Navigation.groupSummaryRaw_(S.admin, S.c1, { from: '2027-01-01' }).course.count, 0);
});
t('integration', "commander's group figures cover ONLY his scope (scope note shown; no hidden team leaks into the course number)", () => {
  const S = setup(); const { X } = S; S.nav(S.cC, S.S.a); S.nav(S.cC, S.S.c, { plan_score: 0, debrief_score: 0, points_completed: 0 });
  const g = X.Navigation.groupSummaryRaw_(S.cT, S.c1); assert.strictEqual(g.course.count, 1); assert.strictEqual(g.course.mean_display, '69'); assert.ok(g.scope_note.length > 0); assert.strictEqual(X.Navigation.groupSummaryRaw_(S.admin, S.c1).scope_note, ''); assert.strictEqual(X.Navigation.groupSummaryRaw_(S.admin, S.c1).course.count, 2);
});
t('integration', 'CANCELLED SOLDIER: results & history preserved untouched; excluded from every current figure; admin still sees card + history; restore brings him back', () => {
  const S = setup(); const { X } = S; S.nav(S.cC, S.S.a); S.nav(S.cC, S.S.a2, { plan_score: 0, debrief_score: 0, points_completed: 0 });
  const before = JSON.stringify(X.mem.NavigationTests); const g0 = X.Navigation.groupSummaryRaw_(S.admin, S.c1); assert.strictEqual(g0.course.count, 2);
  X.Soldiers.cancel(S.admin, S.S.a2.id, 'בוטל'); assert.strictEqual(JSON.stringify(X.mem.NavigationTests), before, 'no stored result or score changed');
  const g1 = X.Navigation.groupSummaryRaw_(S.admin, S.c1); assert.strictEqual(g1.course.count, 1); assert.strictEqual(g1.course.soldiers, 4); assert.strictEqual(g1.course.mean_display, '69'); assert.ok(!g1.soldiers.some(s => s.id === S.S.a2.id));
  assert.strictEqual(g1.teams.find(t => t.id === S.team(0, 0)).count, 1); assert.strictEqual(X.Navigation.summary(S.admin, S.c1, S.S.a2.id).count, 0);
  const card = X.Soldiers.card(S.admin, S.S.a2.id); assert.strictEqual(card.navigation.excluded_from_snapshot, true); assert.strictEqual(card.navigation.count, 0); assert.strictEqual(card.navigation.history_count, 1); assert.strictEqual(card.navigation.records.length, 1); assert.ok(card.history.some(h => h.action === 'SOLDIER_CANCEL'));
  const hist = X.Navigation.list(S.admin, S.c1).find(r => r.soldier_id === S.S.a2.id); assert.ok(hist && hist.soldier_cancelled === true && hist.final_score === 0);
  assert.strictEqual(X.Navigation.list(S.cC, S.c1).filter(r => r.soldier_id === S.S.a2.id).length, 0, 'commanders never see it');
  X.Soldiers.restore(S.admin, S.S.a2.id, 'חזר'); assert.strictEqual(X.Navigation.groupSummaryRaw_(S.admin, S.c1).course.count, 2);
});
t('integration', 'HISTORY vs SNAPSHOT: a cancelled RESULT is out of both snapshot and the default list; admin history can include it; inactive soldier stays in history figures unless onlyActive', () => {
  const S = setup(); const { X } = S; const r1 = S.nav(S.cC, S.S.a).record; S.nav(S.cC, S.S.b, { plan_score: 0, debrief_score: 0, points_completed: 0 }); X.Records.cancel(S.admin, 'NavigationTests', r1.id, 'x');
  assert.strictEqual(X.Navigation.groupSummaryRaw_(S.admin, S.c1).course.count, 1); assert.strictEqual(X.Navigation.list(S.admin, S.c1).length, 1); assert.strictEqual(X.Navigation.list(S.admin, S.c1, { includeCancelled: true }).length, 2);
  const sb = X.Db.get('Soldiers', S.S.b.id); X.Soldiers.setActive(S.admin, S.S.b.id, false, sb.updated_at, 'r'); assert.strictEqual(X.Navigation.groupSummaryRaw_(S.admin, S.c1, { onlyActive: false }).course.count, 1, 'history view still has him'); assert.strictEqual(X.Navigation.groupSummaryRaw_(S.admin, S.c1).course.count, 0, 'D4: current figures exclude active=false by default'); assert.strictEqual(X.Navigation.groupSummaryRaw_(S.admin, S.c1, { onlyActive: true }).course.count, 0);
});
t('integration', 'navigation types: admin creates / renames / deactivates (audited); commanders list active only and cannot manage; inactive type blocks new results, old ones keep the name', () => {
  const S = setup(); const { X } = S; const old = S.nav(S.cT, S.S.a).record; const t3 = X.Navigation.typeCreate(S.admin, S.c1, 'ים'); X.Navigation.typeRename(S.admin, t3.id, 'ים-ארוך'); X.Navigation.typeSetActive(S.admin, S.nt, false);
  assert.deepStrictEqual(X.Navigation.typesList(S.cT, S.c1).map(t => t.name).sort(), ['ים-ארוך', 'לילה']); assert.strictEqual(X.Navigation.typesList(S.admin, S.c1).length, 3);
  assert.strictEqual(code(() => S.nav(S.cT, S.S.a)), 'VALIDATION'); assert.strictEqual(X.Navigation.list(S.cT, S.c1)[0].type_name, 'יום');
  ['navtypes.create', 'navtypes.rename', 'navtypes.setActive'].forEach(m => assert.strictEqual(S.as(S.cC, m, { courseId: S.c1, name: 'x', id: S.nt2, active: false }).code, 'FORBIDDEN', m));
  ['NAVTYPE_CREATE', 'NAVTYPE_RENAME', 'NAVTYPE_ACTIVITY'].forEach(a => assert.ok(X.Db.where('AuditLog', x => x.action === a).length >= 1, a)); assert.strictEqual(code(() => X.Navigation.typeCreate(S.admin, S.c1, ' ים-ארוך ')), 'DUPLICATE');
});
t('integration', 'course isolation: assignments, soldiers, results and types of course A are unreachable from course B (and vice-versa), by every route', () => {
  const S = setup(); const { X } = S; S.nav(S.cC, S.S.a); const o2 = X.Courses.org(S.admin, S.c2); X.Assignments.create(S.admin, { course_id: S.c2, user_email: 'x@x.com', scope_type: 'course', scope_id: S.c2, reason: 'בדיקה' });
  assert.strictEqual(X.Soldiers.list(S.cX, S.c2).length, 1); assert.deepStrictEqual(names(X.Soldiers.list(S.cX, S.c1)), []); assert.strictEqual(code(() => X.Soldiers.card(S.cX, S.S.a.id)), 'NOT_FOUND'); assert.strictEqual(X.Navigation.list(S.cX, S.c1).length, 0);
  assert.strictEqual(code(() => X.Assignments.create(S.admin, { course_id: S.c2, user_email: 'x@x.com', scope_type: 'team', scope_id: S.team(0, 0), reason: 'בדיקה' })), 'VALIDATION', 'a team of course A cannot be assigned inside course B');
  assert.strictEqual(code(() => X.Soldiers.list(S.cT, S.c2)), 'FORBIDDEN'); assert.strictEqual(code(() => X.Navigation.groupSummaryRaw_(S.cT, S.c2)), 'FORBIDDEN'); assert.strictEqual(X.Soldiers.list(S.cX, S.c2)[0].full_name, 'זר');
});
t('integration', 'every state-changing operation of this stage writes exactly one AuditLog row with the right action', () => {
  const S = setup(); const { X } = S; const n = () => X.Db.all('AuditLog').length; const step = (fn, action) => { const b = n(); fn(); assert.strictEqual(n(), b + 1, action); assert.strictEqual(X.Db.all('AuditLog')[b].action, action); };
  let a; step(() => { a = X.Assignments.create(S.admin, { course_id: S.c1, user_email: 'none@x.com', scope_type: 'team', scope_id: S.team(0, 0), reason: 'בדיקה' }); }, 'ASSIGNMENT_CREATE'); step(() => { a = X.Assignments.update(S.admin, a.id, { scope_id: S.team(0, 1) }, a.updated_at, 'r'); }, 'ASSIGNMENT_UPDATE');
  step(() => { a = X.Assignments.setActive(S.admin, a.id, false, a.updated_at, 'r'); }, 'ASSIGNMENT_CANCEL'); step(() => { a = X.Assignments.setActive(S.admin, a.id, true, a.updated_at, 'r'); }, 'ASSIGNMENT_RESTORE');
  let ty; step(() => { ty = X.Navigation.typeCreate(S.admin, S.c1, 'חדש'); }, 'NAVTYPE_CREATE'); step(() => X.Navigation.typeRename(S.admin, ty.id, 'חדש2'), 'NAVTYPE_RENAME'); step(() => X.Navigation.typeSetActive(S.admin, ty.id, false), 'NAVTYPE_ACTIVITY');
  let rec; step(() => { rec = S.nav(S.cT, S.S.a).record; }, 'CREATE'); step(() => X.Records.adminEdit(S.admin, 'NavigationTests', rec.id, { notes: 'x' }, 'r'), 'EDIT'); step(() => X.Records.cancel(S.admin, 'NavigationTests', rec.id, 'r'), 'CANCEL'); step(() => X.Records.restore(S.admin, 'NavigationTests', rec.id), 'RESTORE');
});

// ============ hardening ============
t('hardening', 'race: assignment cancelled between the pre-check and the lock => result entry blocked, nothing written', () => {
  const S = setup(); S.raceOnce(() => S.X.Assignments.setActive(S.admin, S.aT.id, false, S.aT.updated_at, 'r'));
  assert.strictEqual(code(() => S.nav(S.cT, S.S.a)), 'VALIDATION'); assert.strictEqual((S.X.mem.NavigationTests || []).length, 0);
});
t('hardening', 'race: soldier moved out of the commander\'s team between pre-check and lock => entry blocked', () => {
  const S = setup(); const sa = S.X.Db.get('Soldiers', S.S.a.id); S.raceOnce(() => S.X.Db.update('Soldiers', S.S.a.id, { team_id: S.team(0, 1), department_id: S.dep(0) }));
  assert.strictEqual(code(() => S.nav(S.cT, S.S.a)), 'VALIDATION'); assert.strictEqual((S.X.mem.NavigationTests || []).length, 0);
});
t('hardening', 'assignment change concurrent with reads: each read evaluates assignments ONCE (consistent within a request) and the next read sees the change', () => {
  const S = setup(); const { X } = S; let reads = 0; const orig = X.Assignments.activeFor_; X.Assignments.activeFor_ = function () { reads++; return orig.apply(this, arguments); };
  S.nav(S.cC, S.S.a); S.nav(S.cC, S.S.a2); reads = 0; X.Navigation.list(S.cT, S.c1); assert.strictEqual(reads, 1, 'results list'); reads = 0; X.Soldiers.list(S.cT, S.c1); assert.strictEqual(reads, 1, 'soldier list'); reads = 0; X.Navigation.groupSummaryRaw_(S.cT, S.c1); assert.ok(reads <= 2, 'group summary reads: ' + reads);
  X.Assignments.activeFor_ = orig; X.Assignments.setActive(S.admin, S.aT.id, false, S.aT.updated_at, 'r'); assert.strictEqual(X.Navigation.list(S.cT, S.c1).length, 0);
});
t('hardening', 'idempotent replay after the assignment was removed is blocked with the same answer as a fresh request (no result leak); admin unaffected', () => {
  const S = setup(); const { X } = S; const p = { request_id: 'rq-9', soldier_id: S.S.a.id, test_date: '2026-03-05', navigation_type_id: S.nt, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 };
  assert.ok(S.as(S.cT, 'nav.create', { courseId: S.c1, data: p }).ok); X.Assignments.setActive(S.admin, S.aT.id, false, S.aT.updated_at, 'r');
  const replay = S.as(S.cT, 'nav.create', { courseId: S.c1, data: p }), fresh = S.as(S.cT, 'nav.create', { courseId: S.c1, data: Object.assign({}, p, { request_id: 'rq-10' }) }); assert.strictEqual(replay.ok, false); assert.deepStrictEqual(replay, fresh); assert.ok(!JSON.stringify(replay).includes('final_score'));
});
t('hardening', 'mass assignment / type confusion on assignments: forged keys ignored, objects/arrays rejected, user_email not editable', () => {
  const S = setup(); const { X } = S; const a = X.Assignments.create(S.admin, { course_id: S.c1, user_email: 'none@x.com', scope_type: 'course', scope_id: S.c1, id: 'forged', active: false, created_by: 'x@y.z', updated_at: '2000', reason: 'בדיקה' });
  assert.notStrictEqual(a.id, 'forged'); assert.strictEqual(a.active, true); assert.strictEqual(a.created_by, 'admin@x.com'); assert.strictEqual(code(() => X.Assignments.update(S.admin, a.id, { user_email: 'team@x.com' }, a.updated_at, 'r')), 'VALIDATION'); assert.strictEqual(code(() => X.Assignments.update(S.admin, a.id, { active: false }, a.updated_at, 'r')), 'VALIDATION');
  [{ scope_type: ['team'] }, { scope_id: { a: 1 } }, { user_email: ['none@x.com'] }, { course_id: {} }].forEach(o => assert.strictEqual(code(() => X.Assignments.create(S.admin, Object.assign({ course_id: S.c1, user_email: 'union@x.com', scope_type: 'course', scope_id: S.c1 }, o))), 'VALIDATION', JSON.stringify(o)));
  assert.strictEqual(code(() => X.Assignments.setActive(S.admin, a.id, 'false', a.updated_at, 'r')), 'VALIDATION'); assert.strictEqual(code(() => X.Assignments.create(S.admin, null)), 'VALIDATION'); assert.strictEqual(code(() => X.Assignments.create(S.cC, { course_id: S.c1, user_email: 'none@x.com', scope_type: 'course', scope_id: S.c1, reason: 'בדיקה' })), 'FORBIDDEN');
});
t('hardening', 'assignments: stale expected_updated_at => CONFLICT; concurrent second admin cannot overwrite; cancelling twice rejected; user deactivated => no access regardless of assignment', () => {
  const S = setup(); const { X } = S; const first = X.Assignments.update(S.admin, S.aD.id, { scope_type: 'course', scope_id: S.c1 }, S.aD.updated_at, 'r');
  assert.strictEqual(code(() => X.Assignments.update(S.admin, S.aD.id, { scope_type: 'department', scope_id: S.dep(1) }, S.aD.updated_at, 'r')), 'CONFLICT'); assert.strictEqual(X.Db.get('CommanderAssignments', S.aD.id).scope_type, 'course');
  const c = X.Assignments.setActive(S.admin, S.aD.id, false, first.updated_at, 'r'); assert.strictEqual(code(() => X.Assignments.setActive(S.admin, S.aD.id, false, c.updated_at, 'r')), 'VALIDATION');
  X.Auth._emailProvider = () => 'team@x.com'; assert.ok(X.Auth.tryContext()); X.Courses.setUser(S.admin, X.Db.where('Users', u => u.email === 'team@x.com')[0].id, { active: false }); assert.strictEqual(X.Auth.tryContext(), null);
});
t('hardening', 'no leak of other commanders: emails / private names never reach a commander through results, groups, card, history, corrections', () => {
  const S = setup(); const { X } = S; const rec = S.nav(S.cO, S.S.a).record; X.Records.requestCorrection(S.cO, 'NavigationTests', rec.id, { plan_score: 5 }, 'פרטי-של-אחר');
  const all = JSON.stringify([S.as(S.cT, 'nav.list', { courseId: S.c1 }), S.as(S.cT, 'nav.groups', { courseId: S.c1 }), S.as(S.cT, 'soldiers.card', { id: S.S.a.id }), S.as(S.cT, 'correction.list', { courseId: S.c1 }), S.as(S.cT, 'record.history', { table: 'NavigationTests', id: rec.id }), S.as(S.cT, 'assignments.mine', { courseId: S.c1 })]);
  ['other@x.com', 'SECRET', 'admin@x.com'].forEach(k => assert.ok(!all.includes(k), k)); assert.ok(all.includes('מפקד-אחר-פרטי'), 'display name of the author is shown (shared result)');
});
t('hardening', 'cloning a course does NOT clone assignments: commanders in the new course see nobody until the admin assigns them', () => {
  const S = setup(); const { X } = S; const n = X.Courses.create(S.admin, { name: 'חדש', start_date: '2099-05-01', clone_from: S.c1, clone_permissions: true }).id;
  assert.strictEqual(X.Db.where('CommanderAssignments', a => a.course_id === n).length, 0); const cc = { email: 'course@x.com', role: 'commander', courseScope: [S.c1, n] }; assert.ok(X.Soldiers.list(cc, S.c1).length > 0); assert.strictEqual(X.Soldiers.list(cc, n).length, 0);
});
t('hardening', 'physical deletion impossible; rows never decrease through the whole assignment / type / result lifecycle', () => {
  const S = setup(); const { X } = S; const counts0 = ['CommanderAssignments', 'NavigationTypes', 'NavigationTests'].map(t => (X.mem[t] || []).length); const rec = S.nav(S.cT, S.S.a).record;
  X.Assignments.setActive(S.admin, S.aT.id, false, S.aT.updated_at, 'r'); X.Navigation.typeSetActive(S.admin, S.nt2, false); X.Records.cancel(S.admin, 'NavigationTests', rec.id, 'r'); X.Soldiers.cancel(S.admin, S.S.a.id, 'r');
  const counts1 = ['CommanderAssignments', 'NavigationTypes', 'NavigationTests'].map(t => (X.mem[t] || []).length); counts0.forEach((c, i) => assert.ok(counts1[i] >= c)); assert.strictEqual(counts1[2], counts0[2] + 1); ['Assignments', 'Snapshot'].forEach(m => assert.ok(!('delete' in X[m]) && !('remove' in X[m])));
});
t('hardening', 'a commander who is in the course but whose only assignment is in ANOTHER course gets nothing here', () => {
  const S = setup(); const { X } = S; X.Assignments.create(S.admin, { course_id: S.c2, user_email: 'x@x.com', scope_type: 'course', scope_id: S.c2, reason: 'בדיקה' }); assert.strictEqual(X.Soldiers.list(S.cX, S.c1).length, 0); assert.strictEqual(X.Soldiers.list(S.cX, S.c2).length, 1);
});

// ============ v0.4.1 (independent review of v0.4.0) ============
t('integration', 'v0.4.1 #1: assignments.create without a reason is refused through api(): no row, no AuditLog; with a reason it is created and the reason is audited', () => {
  const S = setup(); const { X } = S; const rows0 = X.Db.all('CommanderAssignments').length, aud0 = X.Db.all('AuditLog').length;
  X.Auth._emailProvider = () => 'admin@x.com';
  const base = { course_id: S.c1, user_email: 'none@x.com', scope_type: 'team', scope_id: S.team(0, 1) };
  [undefined, '', '   ', null, ['x'], { a: 1 }, 5].forEach(function (r) {
    const res = X.api('assignments.create', { data: Object.assign({}, base, r === undefined ? {} : { reason: r }) });
    assert.strictEqual(res.ok, false, 'reason=' + JSON.stringify(r)); assert.strictEqual(res.code, 'VALIDATION');
  });
  assert.strictEqual(X.Db.all('CommanderAssignments').length, rows0); assert.strictEqual(X.Db.all('AuditLog').length, aud0);
  const ok = X.api('assignments.create', { data: Object.assign({}, base, { reason: 'שיוך לצוות 2' }) }); assert.strictEqual(ok.ok, true);
  const au = X.Db.where('AuditLog', a => a.action === 'ASSIGNMENT_CREATE' && a.record_id === ok.data.id); assert.strictEqual(au.length, 1); assert.strictEqual(au[0].reason, 'שיוך לצוות 2');
  assert.strictEqual(X.Db.all('CommanderAssignments').length, rows0 + 1);
});
t('integration', 'v0.4.1 #2: nav.groups department/team filters are applied (admin): team, department, combined, mismatched and unknown ids', () => {
  const S = setup(); const { X } = S; [S.S.a, S.S.a2, S.S.b, S.S.c, S.S.d].forEach(s => S.nav(S.admin, s)); S.nav(S.admin, S.S.a, { test_date: '2026-03-02' });
  const g = o => X.Navigation.groupSummaryRaw_(S.admin, S.c1, o);
  const all = g({}); assert.strictEqual(all.course.soldiers, 5); assert.strictEqual(all.course.count, 6);
  const t0 = g({ teamId: S.team(0, 0) }); assert.strictEqual(t0.course.soldiers, 2); assert.strictEqual(t0.course.count, 3); assert.deepStrictEqual(names(t0.soldiers), ['אלף', 'אלף-שני']); assert.strictEqual(t0.teams.length, 1);
  const d0 = g({ departmentId: S.dep(0) }); assert.strictEqual(d0.course.soldiers, 3); assert.deepStrictEqual(names(d0.soldiers), ['אלף', 'אלף-שני', 'בית']); assert.strictEqual(d0.departments.length, 1); assert.strictEqual(d0.teams.length, 2);
  const both = g({ departmentId: S.dep(0), teamId: S.team(0, 1) }); assert.deepStrictEqual(names(both.soldiers), ['בית']); assert.strictEqual(both.course.count, 1);
  const mismatch = g({ departmentId: S.dep(0), teamId: S.team(1, 0) }); assert.strictEqual(mismatch.course.soldiers, 0); assert.strictEqual(mismatch.soldiers.length, 0); assert.strictEqual(mismatch.course.mean_display, null); assert.strictEqual(mismatch.course.note, 'אין מספיק נתונים');
  const unk = g({ teamId: 'no-such' }); assert.strictEqual(unk.soldiers.length, 0); assert.strictEqual(unk.course.count, 0);
  const foreign = g({ teamId: X.Courses.org(S.admin, S.c2).teams[0].id }); assert.strictEqual(foreign.soldiers.length, 0);
  assert.strictEqual(code(() => g({ teamId: ['x'] })), 'VALIDATION');
});
t('hardening', 'v0.4.1 #2: a commander cannot use the filters to read outside his assignment (team / department / course scoped, direct api)', () => {
  const S = setup(); const { X } = S; [S.S.a, S.S.a2, S.S.b, S.S.c, S.S.d].forEach(s => S.nav(S.admin, s));
  const api = (c, o) => S.as(c, 'nav.groups', { courseId: S.c1, opts: o });
  // team-scoped (team 0,0 = אלף, אלף-שני)
  let r = api(S.cT, {}); assert.strictEqual(r.ok, true); assert.deepStrictEqual(names(r.data.soldiers), ['אלף', 'אלף-שני']);
  [{ teamId: S.team(0, 1) }, { teamId: S.team(1, 0) }, { departmentId: S.dep(1) }, { departmentId: S.dep(0), teamId: S.team(1, 1) }].forEach(o => {
    r = api(S.cT, o); assert.strictEqual(r.ok, true); assert.strictEqual(r.data.soldiers.length, 0, JSON.stringify(o)); assert.ok(r.data.course.count === 0 || r.data.course.count === null); assert.ok(r.data.course.soldiers === 0 || r.data.course.soldiers === null);
    assert.ok(!JSON.stringify(r.data).includes('בית') && !JSON.stringify(r.data).includes('גימל') && !JSON.stringify(r.data).includes('דלת'));
  });
  r = api(S.cT, { departmentId: S.dep(0) }); assert.deepStrictEqual(names(r.data.soldiers), ['אלף', 'אלף-שני'], 'a wider filter does not widen the scope');
  r = api(S.cT, { teamId: S.team(0, 0) }); assert.deepStrictEqual(names(r.data.soldiers), ['אלף', 'אלף-שני']);
  // department-scoped (אלף, אלף-שני, בית)
  r = api(S.cD, { teamId: S.team(0, 1) }); assert.deepStrictEqual(names(r.data.soldiers), ['בית']); r = api(S.cD, { departmentId: S.dep(1) }); assert.strictEqual(r.data.soldiers.length, 0); r = api(S.cD, { teamId: S.team(1, 0) }); assert.strictEqual(r.data.soldiers.length, 0);
  // course-scoped, combined filter
  r = api(S.cC, { departmentId: S.dep(1), teamId: S.team(1, 1) }); assert.deepStrictEqual(names(r.data.soldiers), ['דלת']);
  // no assignment: nothing whatever the filter
  r = api(S.none, { teamId: S.team(0, 0) }); assert.strictEqual(r.data.soldiers.length, 0); assert.ok(r.data.course.count === 0 || r.data.course.count === null);
});
t('integration', 'v0.4.1 #3: assignment cannot be created or re-activated for a disabled commander; a disabled user keeps his rows, has no access, and cancel still works', () => {
  const S = setup(); const { X } = S; const U = id => X.Db.where('Users', u => u.email === id)[0].id;
  X.Courses.addUser(S.admin, { email: 'off@x.com', role: 'commander', course_ids: [S.c1], display_name: 'כבוי' }); X.Courses.setUser(S.admin, U('off@x.com'), { active: false });
  const n0 = X.Db.all('CommanderAssignments').length, aud0 = X.Db.all('AuditLog').length;
  X.Auth._emailProvider = () => 'admin@x.com';
  const res = X.api('assignments.create', { data: { course_id: S.c1, user_email: 'off@x.com', scope_type: 'course', scope_id: S.c1, reason: 'ניסיון' } });
  assert.strictEqual(res.ok, false); assert.strictEqual(res.code, 'VALIDATION'); assert.strictEqual(X.Db.all('CommanderAssignments').length, n0); assert.strictEqual(X.Db.all('AuditLog').length, aud0);
  // disabled AFTER receiving an assignment: row stays active, access is gone
  const A = S.aT; X.Courses.setUser(S.admin, U('team@x.com'), { active: false });
  assert.strictEqual(X.Util.isTrue(X.Db.get('CommanderAssignments', A.id).active), true, 'assignment is not deleted/changed');
  X.Auth._emailProvider = () => 'team@x.com'; assert.strictEqual(X.Auth.tryContext(), null); assert.strictEqual(X.api('soldiers.list', { courseId: S.c1 }).ok, false);
  // admin can still cancel it, but cannot re-activate while the user is disabled
  X.Auth._emailProvider = () => 'admin@x.com';
  const cur = () => X.Db.get('CommanderAssignments', A.id);
  X.Assignments.setActive(S.admin, A.id, false, cur().updated_at, 'יציאה'); assert.strictEqual(X.Util.isTrue(cur().active), false);
  const aud1 = X.Db.all('AuditLog').length; assert.strictEqual(code(() => X.Assignments.setActive(S.admin, A.id, true, cur().updated_at, 'חזרה')), 'VALIDATION');
  assert.strictEqual(X.Util.isTrue(cur().active), false); assert.strictEqual(X.Db.all('AuditLog').length, aud1);
  // re-enabled user: re-activation works again
  X.Courses.setUser(S.admin, U('team@x.com'), { active: true }); X.Assignments.setActive(S.admin, A.id, true, cur().updated_at, 'חזרה'); assert.strictEqual(X.Util.isTrue(cur().active), true);
  assert.deepStrictEqual(names(X.Soldiers.list(S.cT, S.c1, {})), ['אלף', 'אלף-שני']);
});

console.log('\nBY TYPE:', JSON.stringify(counts), 'TOTAL pass=' + (counts.unit + counts.integration + counts.hardening) + ' fail=' + fail);
if (fail) { console.log('FAILED:', failures.join(' | ')); process.exit(1); }
