// Stage 2 (v0.3.0): soldier registry + soldier card. Sections are tagged [unit] / [integration] / [hardening] for the report.
// All Node tests (in-memory Db). None of this proves Apps Script behaviour — see docs/STAGING_TEST_PLAN.md S25+.
const { load } = require('./harness');
const assert = require('assert');
const counts = { unit: 0, integration: 0, hardening: 0 }; let fail = 0; const failures = [];
function t(kind, name, fn) { try { fn(); counts[kind]++; console.log('PASS', '[' + kind + ']', name); } catch (e) { fail++; failures.push(name); console.log('FAIL', '[' + kind + ']', name, '\n   ', e.message); } }
const code = fn => { try { fn(); return null; } catch (e) { return e.code || ('JS:' + e.message); } };
const msg = fn => { try { fn(); return null; } catch (e) { return e.code + '|' + e.message; } };

function setup() {
  const X = load();
  const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
  const mkCourse = (name, start) => X.Courses.create(admin, { name, start_date: start }).id;
  const c1 = mkCourse('קורס א', '2099-01-01');          // not started yet => reassignment is free
  const c2 = mkCourse('קורס ב', '2099-02-01');
  const cs = mkCourse('קורס שהתחיל', '2000-01-01');      // started => reassignment needs an explicit exception
  const o1 = X.Courses.org(admin, c1), o2 = X.Courses.org(admin, c2), os = X.Courses.org(admin, cs);
  const d1 = o1.departments, team = (o, di, ti) => o.teams.filter(t => t.department_id === o.departments[di].id)[ti].id;
  X.Courses.addUser(admin, { email: 'admin@x.com', role: 'admin', display_name: 'מנהל' });
  X.Courses.addUser(admin, { email: 'cmd1@x.com', role: 'commander', course_ids: [c1, cs], display_name: 'מפקד 1' });
  X.Courses.addUser(admin, { email: 'cmd2@x.com', role: 'commander', course_ids: [c2], display_name: 'מפקד 2' });
  X.Assignments.create(admin, { course_id: c1, user_email: 'cmd1@x.com', scope_type: 'course', scope_id: c1, reason: 'בדיקה' }); X.Assignments.create(admin, { course_id: cs, user_email: 'cmd1@x.com', scope_type: 'course', scope_id: cs, reason: 'בדיקה' }); X.Assignments.create(admin, { course_id: c2, user_email: 'cmd2@x.com', scope_type: 'course', scope_id: c2, reason: 'בדיקה' });
  const cmd1 = { email: 'cmd1@x.com', role: 'commander', courseScope: [c1, cs] }, cmd2 = { email: 'cmd2@x.com', role: 'commander', courseScope: [c2] };
  const dep = (o, i) => o.departments[i].id;
  const data = (o, over) => Object.assign({ full_name: 'ישראל ישראלי', personal_number: '1001', gender: 'M', department_id: dep(o, 0), team_id: team(o, 0, 0),
    pakal: 'ק1', enlistment_date: '2026-01-05', sociometric_third: 'ש-אדמין', commander_note: 'הערה-סודית-של-מנהל' }, over || {});
  const raceOnce = hook => { const orig = X.Locks.run; X.Locks.run = function (fn) { X.Locks.run = orig; hook(); return orig(fn); }; };
  return { X, admin, cmd1, cmd2, c1, c2, cs, o1, o2, os, dep, team, data, raceOnce };
}
const mk = (S, over, course, org) => S.X.Soldiers.create(S.admin, course || S.c1, S.data(org || S.o1, over));

// ---------------- unit ----------------
t('unit', 'clean_: valid full record normalised (leading zeros kept)', () => { const { X } = setup(); const f = X.Soldiers.clean_({ full_name: ' דנה ', personal_number: '0012345', gender: 'F' }, true); assert.strictEqual(f.full_name, 'דנה'); assert.strictEqual(f.personal_number, '0012345'); });
t('unit', 'clean_: invalid names / numbers / gender / date / lengths rejected', () => {
  const { X } = setup(); const bad = o => code(() => X.Soldiers.clean_(Object.assign({ full_name: 'א', personal_number: '1', gender: 'M' }, o), true));
  ['', '   ', 'x'.repeat(101)].forEach(v => assert.strictEqual(bad({ full_name: v }), 'VALIDATION'));
  ['', 'abc', '12 3', '1234567890123', '-1', '1.5', '١٢٣', '1e3'].forEach(v => assert.strictEqual(bad({ personal_number: v }), 'VALIDATION', v));
  ['X', '', 'm', 'זכר'].forEach(v => assert.strictEqual(bad({ gender: v }), 'VALIDATION', v));
  ['2026-02-30', '05/01/2026', '2026-13-01'].forEach(v => assert.strictEqual(bad({ enlistment_date: v }), 'VALIDATION', v));
  assert.strictEqual(bad({ pakal: 'p'.repeat(51) }), 'VALIDATION'); assert.strictEqual(bad({ sociometric_third: 's'.repeat(21) }), 'VALIDATION'); assert.strictEqual(bad({ commander_note: 'n'.repeat(1001) }), 'VALIDATION');
});
t('unit', 'clean_: partial patch returns only the present fields; blank optional fields allowed', () => { const { X } = setup(); assert.deepStrictEqual(JSON.parse(JSON.stringify(X.Soldiers.clean_({ pakal: '' }, false))), { pakal: '' }); assert.strictEqual(X.Soldiers.clean_({ enlistment_date: '' }, false).enlistment_date, ''); });
t('unit', 'diff_: only real changes, Date-vs-ISO enlistment not a spurious change', () => {
  const { X } = setup(); const d = X.Soldiers.diff_({ full_name: 'א', enlistment_date: X.Util.now(), pakal: '' }, { full_name: 'ב', enlistment_date: X.Util.cellToIsoDate(X.Util.now()), pakal: '' });
  assert.strictEqual(d.changed, 1); assert.strictEqual(d.before.full_name, 'א'); assert.strictEqual(d.after.full_name, 'ב');
});
t('unit', 'checkStale_: blank => VALIDATION, mismatch => CONFLICT, equal => ok', () => { const { X } = setup(); assert.strictEqual(code(() => X.Soldiers.checkStale_({ updated_at: 'a' }, '')), 'VALIDATION'); assert.strictEqual(code(() => X.Soldiers.checkStale_({ updated_at: 'a' }, 'b')), 'CONFLICT'); assert.strictEqual(code(() => X.Soldiers.checkStale_({ updated_at: 'a' }, 'a')), null); });
t('unit', 'checkOrg_: team must belong to the chosen department and course', () => {
  const S = setup(); const { X, c1, o1, o2, dep, team } = S;
  assert.strictEqual(code(() => X.Soldiers.checkOrg_(c1, dep(o1, 0), team(o1, 0, 1))), null);
  assert.strictEqual(code(() => X.Soldiers.checkOrg_(c1, dep(o1, 0), team(o1, 1, 0))), 'VALIDATION', 'team of the other department');
  assert.strictEqual(code(() => X.Soldiers.checkOrg_(c1, dep(o2, 0), team(o2, 0, 0))), 'VALIDATION', 'other course');
  assert.strictEqual(code(() => X.Soldiers.checkOrg_(c1, 'nope', 'nope')), 'VALIDATION');
});
t('unit', 'view_: commander projection has no admin-only / internal fields', () => {
  const S = setup(); const r = mk(S); const row = S.X.Db.get('Soldiers', r.id);
  const v = S.X.Soldiers.view_(S.cmd1, row); ['sociometric_third', 'commander_note', 'record_status', 'created_by', 'updated_by'].forEach(k => assert.ok(!(k in v), k));
  const a = S.X.Soldiers.view_(S.admin, row); assert.strictEqual(a.commander_note, 'הערה-סודית-של-מנהל');
});
t('unit', 'policy: soldier write actions are admin-only; read allowed for commander; archived course blocks writes', () => {
  const { X, cmd1 } = setup(); ['soldier.create', 'soldier.edit', 'soldier.reassign', 'soldier.cancel', 'soldier.restore', 'soldier.activity'].forEach(a => assert.strictEqual(X.Policy.check(cmd1, a, { courseId: cmd1.courseScope[0] }).code, 'FORBIDDEN', a));
  assert.ok(X.Policy.check(cmd1, 'soldier.read', { courseId: cmd1.courseScope[0] }).ok);
  assert.strictEqual(X.Policy.check({ email: 'a', role: 'admin' }, 'soldier.create', { courseId: 'c', courseStatus: 'archived' }).code, 'COURSE_ARCHIVED');
});

// ---------------- integration ----------------
t('integration', 'admin creates a soldier: stored, audited with after-image, structure unchanged (2x2)', () => {
  const S = setup(); const r = mk(S); const row = S.X.Db.get('Soldiers', r.id);
  assert.strictEqual(row.record_status, 'active'); assert.strictEqual(row.active, true); assert.strictEqual(row.pzm_value, '');
  const a = S.X.Db.where('AuditLog', x => x.action === 'SOLDIER_CREATE' && x.record_id === r.id)[0]; assert.ok(a); assert.strictEqual(JSON.parse(a.after_json).personal_number, '1001');
  const o = S.X.Courses.org(S.admin, S.c1); assert.strictEqual(o.departments.length, 2); assert.strictEqual(o.teams.length, 4);
});
t('integration', 'duplicate personal number: rejected in the same course (also vs cancelled), allowed in another course', () => {
  const S = setup(); const a = mk(S);
  assert.strictEqual(code(() => mk(S, { full_name: 'אחר' })), 'DUPLICATE');
  S.X.Soldiers.cancel(S.admin, a.id, 'x'); assert.strictEqual(code(() => mk(S, { full_name: 'אחר' })), 'DUPLICATE', 'cancelled soldier still holds the number');
  assert.strictEqual(code(() => mk(S, {}, S.c2, S.o2)), null, 'same number in another course is fine');
  S.X.Soldiers.restore(S.admin, a.id); assert.strictEqual(S.X.Db.where('Soldiers', s => s.course_id === S.c1 && s.personal_number === '1001').length, 1, 'restore creates no duplicate');
});
t('integration', 'edit: changed fields only in audit (before/after + reason), updated_at moves, number collision rejected', () => {
  const S = setup(); const a = mk(S); const b = mk(S, { personal_number: '1002', full_name: 'שני' });
  const u = S.X.Soldiers.update(S.admin, a.id, { full_name: 'ישראל כהן', pakal: 'ק2' }, a.updated_at, 'תיקון שם');
  assert.strictEqual(u.full_name, 'ישראל כהן'); const log = S.X.Db.where('AuditLog', x => x.action === 'SOLDIER_EDIT' && x.record_id === a.id)[0];
  assert.deepStrictEqual(JSON.parse(log.before_json), { full_name: 'ישראל ישראלי', pakal: 'ק1' }); assert.deepStrictEqual(JSON.parse(log.after_json), { full_name: 'ישראל כהן', pakal: 'ק2' }); assert.strictEqual(log.reason, 'תיקון שם');
  assert.strictEqual(code(() => S.X.Soldiers.update(S.admin, b.id, { personal_number: '1001' }, b.updated_at, 'x')), 'DUPLICATE');
  assert.strictEqual(S.X.Db.get('Soldiers', b.id).personal_number, '1002');
});
t('integration', 'edit validation: reason required, department/team/active/status not editable here, no-op rejected', () => {
  const S = setup(); const a = mk(S); const E = (p, r) => code(() => S.X.Soldiers.update(S.admin, a.id, p, a.updated_at, r));
  assert.strictEqual(E({ full_name: 'x' }, ''), 'VALIDATION'); assert.strictEqual(E({ department_id: 'z' }, 'r'), 'VALIDATION'); assert.strictEqual(E({ team_id: 'z' }, 'r'), 'VALIDATION');
  assert.strictEqual(E({ active: false }, 'r'), 'VALIDATION'); assert.strictEqual(E({ record_status: 'cancelled' }, 'r'), 'VALIDATION'); assert.strictEqual(E({ course_id: 'x' }, 'r'), 'VALIDATION');
  assert.strictEqual(E({}, 'r'), 'VALIDATION'); assert.strictEqual(E({ full_name: 'ישראל ישראלי' }, 'r'), 'VALIDATION', 'no actual change');
});
t('integration', 'reassign before course start: free; audit has before/after; team of another department rejected; same assignment rejected', () => {
  const S = setup(); const a = mk(S); const to = { department_id: S.dep(S.o1, 1), team_id: S.team(S.o1, 1, 0) };
  assert.strictEqual(code(() => S.X.Soldiers.reassign(S.admin, a.id, { department_id: S.dep(S.o1, 0), team_id: S.team(S.o1, 1, 0) }, a.updated_at, 'x')), 'VALIDATION');
  assert.strictEqual(code(() => S.X.Soldiers.reassign(S.admin, a.id, { department_id: a.department_id, team_id: a.team_id }, a.updated_at, 'x')), 'VALIDATION');
  const r = S.X.Soldiers.reassign(S.admin, a.id, to, a.updated_at, 'איזון');
  assert.strictEqual(r.team_id, to.team_id); assert.strictEqual(r.department_id, to.department_id);
  const log = S.X.Db.where('AuditLog', x => x.action === 'SOLDIER_REASSIGN')[0]; assert.strictEqual(JSON.parse(log.before_json).team_id, a.team_id); assert.strictEqual(JSON.parse(log.after_json).team_id, to.team_id);
  assert.strictEqual(S.X.Courses.org(S.admin, S.c1).teams.length, 4, 'no new teams');
});
t('integration', 'reassign after course start: needs explicit approved_exception; recorded in audit', () => {
  const S = setup(); const a = S.X.Soldiers.create(S.admin, S.cs, S.data(S.os)); const to = { department_id: S.dep(S.os, 1), team_id: S.team(S.os, 1, 0) };
  assert.strictEqual(code(() => S.X.Soldiers.reassign(S.admin, a.id, to, a.updated_at, 'x')), 'REASSIGN_AFTER_START');
  assert.strictEqual(code(() => S.X.Soldiers.reassign(S.admin, a.id, Object.assign({ approved_exception: 'true' }, to), a.updated_at, 'x')), 'REASSIGN_AFTER_START', 'only literal true');
  const r = S.X.Soldiers.reassign(S.admin, a.id, Object.assign({ approved_exception: true }, to), a.updated_at, 'חריג מאושר'); assert.strictEqual(r.team_id, to.team_id);
  assert.strictEqual(JSON.parse(S.X.Db.where('AuditLog', x => x.action === 'SOLDIER_REASSIGN')[0].after_json).after_course_start_exception, true);
});
t('integration', 'activity status: toggled with reason + audit; inactive soldier cannot receive new navigation records', () => {
  const S = setup(); const a = mk(S); const nt = S.X.Util.uuid(); S.X.Db.insert('NavigationTypes', { id: nt, course_id: S.c1, name: 'יום', active: true });
  const p = () => ({ request_id: S.X.Util.uuid(), soldier_id: a.id, test_date: '2026-03-01', navigation_type_id: nt, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 });
  S.X.Records.create(S.cmd1, 'NavigationTests', S.c1, p());
  const r = S.X.Soldiers.setActive(S.admin, a.id, false, a.updated_at, 'השתחרר'); assert.strictEqual(r.active, false);
  assert.strictEqual(code(() => S.X.Records.create(S.cmd1, 'NavigationTests', S.c1, p())), 'VALIDATION');
  assert.strictEqual(code(() => S.X.Soldiers.setActive(S.admin, a.id, false, r.updated_at, 'x')), 'VALIDATION', 'no-op');
  assert.ok(S.X.Db.where('AuditLog', x => x.action === 'SOLDIER_ACTIVITY').length === 1);
  S.X.Soldiers.setActive(S.admin, a.id, true, r.updated_at, 'חזר'); assert.strictEqual(S.X.Db.get('Soldiers', a.id).active, true);
});
t('integration', 'cancel / restore: soft only, audited, hidden from commander, blocks navigation, admin still sees it', () => {
  const S = setup(); const a = mk(S); const before = S.X.mem.Soldiers.length;
  S.X.Soldiers.cancel(S.admin, a.id, 'הוזן בטעות'); assert.strictEqual(S.X.mem.Soldiers.length, before, 'no physical delete');
  assert.strictEqual(S.X.Soldiers.list(S.cmd1, S.c1).length, 0); assert.strictEqual(code(() => S.X.Soldiers.card(S.cmd1, a.id)), 'NOT_FOUND');
  assert.strictEqual(S.X.Soldiers.list(S.admin, S.c1).length, 0); assert.strictEqual(S.X.Soldiers.list(S.admin, S.c1, { includeCancelled: true }).length, 1);
  assert.strictEqual(S.X.Soldiers.card(S.admin, a.id).soldier.record_status, 'cancelled');
  assert.strictEqual(code(() => S.X.Soldiers.update(S.admin, a.id, { pakal: 'x' }, S.X.Db.get('Soldiers', a.id).updated_at, 'r')), 'RECORD_CANCELLED');
  assert.strictEqual(code(() => S.X.Soldiers.cancel(S.admin, a.id, 'again')), 'VALIDATION');
  S.X.Soldiers.restore(S.admin, a.id, 'שוחזר'); assert.strictEqual(S.X.Soldiers.list(S.cmd1, S.c1).length, 1);
  assert.deepStrictEqual(['SOLDIER_CANCEL', 'SOLDIER_RESTORE'], S.X.Db.where('AuditLog', x => x.record_id === a.id && /CANCEL|RESTORE/.test(x.action)).map(x => x.action));
});
t('integration', 'list: search (name / number), filters (department, team, pakal, activity), Hebrew sort, names resolved', () => {
  const S = setup(); const { X } = S;
  mk(S, { full_name: 'בני', personal_number: '2001', pakal: 'ק2' }); mk(S, { full_name: 'אבי', personal_number: '2002', department_id: S.dep(S.o1, 1), team_id: S.team(S.o1, 1, 1) });
  const b = mk(S, { full_name: 'גדי', personal_number: '3003' }); X.Soldiers.setActive(S.admin, b.id, false, b.updated_at, 'x');
  const L = o => X.Soldiers.list(S.admin, S.c1, o);
  assert.deepStrictEqual(L({}).map(s => s.full_name), ['אבי', 'בני', 'גדי']);
  assert.deepStrictEqual(L({ q: 'בנ' }).map(s => s.full_name), ['בני']); assert.deepStrictEqual(L({ q: '2002' }).map(s => s.full_name), ['אבי']);
  assert.strictEqual(L({ departmentId: S.dep(S.o1, 1) }).length, 1); assert.strictEqual(L({ teamId: S.team(S.o1, 1, 1) })[0].full_name, 'אבי');
  assert.strictEqual(L({ pakal: 'ק2' }).length, 1); assert.strictEqual(L({ active: false })[0].full_name, 'גדי'); assert.strictEqual(L({ active: true }).length, 2);
  assert.ok(L({})[0].team_name && L({})[0].department_name);
});
t('integration', 'card: real data only — no PZM / eligibility / future sections; navigation, docs, history present', () => {
  const S = setup(); const { X } = S; const a = mk(S); const nt = X.Util.uuid(); X.Db.insert('NavigationTypes', { id: nt, course_id: S.c1, name: 'יום', active: true });
  X.Records.create(S.cmd1, 'NavigationTests', S.c1, { request_id: 'r1', soldier_id: a.id, test_date: '2026-03-01', navigation_type_id: nt, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 });
  const c = X.Soldiers.card(S.admin, a.id);
  assert.deepStrictEqual(Object.keys(c).sort(), ['course', 'department_name', 'documents', 'history', 'navigation', 'soldier', 'team_name'].sort());
  assert.strictEqual(c.navigation.count, 1); assert.strictEqual(c.navigation.mean_display, '69'); assert.ok(c.history.some(h => h.action === 'SOLDIER_CREATE'));
  const s = JSON.stringify(c); ['pzm', 'eligib', 'favorite', 'strength'].forEach(k => assert.ok(!s.toLowerCase().includes(k), k));
});
t('integration', 'card documents: commander sees file name only for his own uploads; others metadata only', () => {
  const S = setup(); const a = mk(S); const ins = (by, n) => S.X.Db.insert('Documents', { id: S.X.Util.uuid(), course_id: S.c1, soldier_id: a.id, document_type: 'רפואי', drive_file_id: 'DRIVE-SECRET-' + n, file_name: 'file-' + n + '.pdf', uploaded_by: by, uploaded_at: '2026-03-01', approval_status: 'approved' });
  ins('cmd1@x.com', 'mine'); ins('other@x.com', 'theirs');
  const docs = S.X.Soldiers.card(S.cmd1, a.id).documents; const own = docs.find(d => d.can_open), oth = docs.find(d => !d.can_open);
  assert.strictEqual(own.file_name, 'file-mine.pdf'); assert.ok(!('file_name' in oth)); assert.ok(!JSON.stringify(docs).includes('DRIVE-SECRET'));
  assert.strictEqual(S.X.Soldiers.card(S.admin, a.id).documents.find(d => d.uploaded_by === 'other@x.com').file_name, 'file-theirs.pdf');
});
t('integration', 'card history: commander sees event type + time only (no actor, no values); admin sees full before/after', () => {
  const S = setup(); const a = mk(S); S.X.Soldiers.update(S.admin, a.id, { commander_note: 'סוד חדש' }, a.updated_at, 'r');
  const hc = S.X.Soldiers.card(S.cmd1, a.id).history; assert.ok(hc.length === 2); hc.forEach(h => assert.deepStrictEqual(Object.keys(h).sort(), ['action', 'at']));
  assert.ok(!JSON.stringify(hc).includes('סוד')); const ha = S.X.Soldiers.card(S.admin, a.id).history; assert.strictEqual(ha.find(h => h.action === 'SOLDIER_EDIT').after.commander_note, 'סוד חדש');
});
t('integration', 'archived course: every soldier write blocked, even for admin; reads still work', () => {
  const S = setup(); const a = mk(S); S.X.Db.update('Courses', S.c1, { status: 'archived' });
  const E = f => code(f); const u = S.X.Db.get('Soldiers', a.id).updated_at;
  assert.strictEqual(E(() => mk(S, { personal_number: '9' })), 'COURSE_ARCHIVED'); assert.strictEqual(E(() => S.X.Soldiers.update(S.admin, a.id, { pakal: 'z' }, u, 'r')), 'COURSE_ARCHIVED');
  assert.strictEqual(E(() => S.X.Soldiers.reassign(S.admin, a.id, { department_id: S.dep(S.o1, 1), team_id: S.team(S.o1, 1, 0) }, u, 'r')), 'COURSE_ARCHIVED');
  assert.strictEqual(E(() => S.X.Soldiers.setActive(S.admin, a.id, false, u, 'r')), 'COURSE_ARCHIVED'); assert.strictEqual(E(() => S.X.Soldiers.cancel(S.admin, a.id, 'r')), 'COURSE_ARCHIVED');
  assert.strictEqual(S.X.Soldiers.list(S.admin, S.c1).length, 1); assert.ok(S.X.Soldiers.card(S.cmd1, a.id));
});
t('integration', 'API layer: whitelist exposes soldiers.*, identity from session only; commander API calls never leak admin fields', () => {
  const S = setup(); const a = mk(S); const { X } = S;
  X.Auth._emailProvider = () => 'cmd1@x.com';
  const card = X.api('soldiers.card', { id: a.id }); assert.ok(card.ok); const s = JSON.stringify(card); ['הערה-סודית', 'ש-אדמין', 'record_status', 'created_by'].forEach(k => assert.ok(!s.includes(k), k));
  const list = X.api('soldiers.list', { courseId: S.c1, opts: { q: '1001' } }); assert.ok(list.ok && list.data.length === 1); assert.ok(!JSON.stringify(list).includes('הערה-סודית')); assert.ok(!JSON.stringify(list).includes('gender'));
  ['soldiers.create', 'soldiers.update', 'soldiers.reassign', 'soldiers.setActive', 'soldiers.cancel', 'soldiers.restore'].forEach(m => assert.strictEqual(X.api(m, { courseId: S.c1, id: a.id, data: S.data(S.o1, { personal_number: '77' }), patch: { pakal: 'x' }, target: {}, active: false, reason: 'r', expected_updated_at: a.updated_at }).code, 'FORBIDDEN', m));
  assert.strictEqual(X.api('soldiers.nope', {}).code, 'NOT_FOUND'); assert.strictEqual(X.Db.get('Soldiers', a.id).pakal, 'ק1');
  X.Auth._emailProvider = () => 'admin@x.com'; assert.ok(X.api('soldiers.card', { id: a.id }).ok); assert.ok(JSON.stringify(X.api('soldiers.card', { id: a.id })).includes('הערה-סודית-של-מנהל'));
});

// ---------------- hardening ----------------
t('hardening', 'course isolation: other-course commander gets uniform NOT_FOUND (same text as a missing id); list of foreign course FORBIDDEN', () => {
  const S = setup(); const a = mk(S); const x = msg(() => S.X.Soldiers.card(S.cmd2, a.id)), y = msg(() => S.X.Soldiers.card(S.cmd2, 'does-not-exist'));
  assert.strictEqual(x.split('|')[0], 'NOT_FOUND'); assert.strictEqual(x, y);
  assert.strictEqual(code(() => S.X.Soldiers.list(S.cmd2, S.c1)), 'FORBIDDEN');
  S.X.Soldiers.cancel(S.admin, a.id, 'r'); assert.strictEqual(msg(() => S.X.Soldiers.card(S.cmd1, a.id)), y, 'cancelled looks exactly like missing');
});
t('hardening', 'a commander cannot reach soldier data through the generic record API or write to Soldiers', () => {
  const S = setup(); const a = mk(S); ['record.edit', 'record.cancel', 'record.restore', 'record.history'].forEach(m => { S.X.Auth._emailProvider = () => 'cmd1@x.com'; assert.ok(!S.X.api(m, { table: 'Soldiers', id: a.id, patch: { full_name: 'x' }, reason: 'r' }).ok, m); });
  S.X.Auth._emailProvider = () => 'admin@x.com'; assert.strictEqual(S.X.api('record.edit', { table: 'Soldiers', id: a.id, patch: { full_name: 'x' }, reason: 'r' }).code, 'VALIDATION', 'Soldiers is not a generic record type');
});
t('hardening', 'concurrent edits: stale expected_updated_at => CONFLICT and nothing changes; second writer with fresh value succeeds', () => {
  const S = setup(); const a = mk(S); const first = S.X.Soldiers.update(S.admin, a.id, { pakal: 'א' }, a.updated_at, 'r');
  assert.strictEqual(code(() => S.X.Soldiers.update(S.admin, a.id, { pakal: 'ב' }, a.updated_at, 'r')), 'CONFLICT'); assert.strictEqual(S.X.Db.get('Soldiers', a.id).pakal, 'א');
  assert.strictEqual(code(() => S.X.Soldiers.update(S.admin, a.id, { pakal: 'ב' }, first.updated_at, 'r')), null); 
  const stale = S.X.Db.get('Soldiers', a.id).updated_at; assert.strictEqual(code(() => S.X.Soldiers.update(S.admin, a.id, { pakal: 'ג' }, '')), 'VALIDATION'); assert.strictEqual(S.X.Db.get('Soldiers', a.id).updated_at, stale);
});
t('hardening', 'race: edit lands between pre-check and lock (another admin changes the row) => CONFLICT, no overwrite', () => {
  const S = setup(); const a = mk(S);
  S.raceOnce(() => S.X.Db.update('Soldiers', a.id, { pakal: 'ממתחרה', updated_at: '2999-01-01T00:00:00.000Z' }));
  assert.strictEqual(code(() => S.X.Soldiers.update(S.admin, a.id, { full_name: 'שלי' }, a.updated_at, 'r')), 'CONFLICT');
  assert.strictEqual(S.X.Db.get('Soldiers', a.id).full_name, 'ישראל ישראלי'); assert.strictEqual(S.X.Db.where('AuditLog', x => x.action === 'SOLDIER_EDIT').length, 0);
});
t('hardening', 'race: duplicate personal number inserted between pre-check and lock => DUPLICATE (one row only)', () => {
  const S = setup();
  S.raceOnce(() => S.X.Db.insert('Soldiers', { id: 'rival', course_id: S.c1, personal_number: '1001', full_name: 'יריב', gender: 'M', department_id: S.dep(S.o1, 0), team_id: S.team(S.o1, 0, 0), active: true, record_status: 'active' }));
  assert.strictEqual(code(() => mk(S)), 'DUPLICATE'); assert.strictEqual(S.X.Db.where('Soldiers', s => s.personal_number === '1001').length, 1);
});
t('hardening', 'race: course archived at lock time blocks create / update / reassign / cancel, nothing written or audited', () => {
  const run = (name, f) => { const S = setup(); const a = mk(S); const n = S.X.Db.all('AuditLog').length; const u = a.updated_at;
    S.raceOnce(() => S.X.Db.update('Courses', S.c1, { status: 'archived' })); assert.strictEqual(code(() => f(S, a, u)), 'COURSE_ARCHIVED', name); assert.strictEqual(S.X.Db.all('AuditLog').length, n, name); };
  run('create', S => mk(S, { personal_number: '55' })); run('update', (S, a, u) => S.X.Soldiers.update(S.admin, a.id, { pakal: 'z' }, u, 'r'));
  run('reassign', (S, a, u) => S.X.Soldiers.reassign(S.admin, a.id, { department_id: S.dep(S.o1, 1), team_id: S.team(S.o1, 1, 0) }, u, 'r')); run('cancel', (S, a) => S.X.Soldiers.cancel(S.admin, a.id, 'r'));
});
t('hardening', 'race: soldier cancelled between pre-check and lock => update refused (RECORD_CANCELLED), not applied', () => {
  const S = setup(); const a = mk(S); const upd = a.updated_at;
  S.raceOnce(() => S.X.Db.update('Soldiers', a.id, { record_status: 'cancelled' }));
  assert.strictEqual(code(() => S.X.Soldiers.update(S.admin, a.id, { pakal: 'z' }, upd, 'r')), 'RECORD_CANCELLED'); assert.strictEqual(S.X.Db.get('Soldiers', a.id).pakal, 'ק1');
});
t('hardening', 'mass assignment: extra / forged keys on create are ignored (ids, status, authorship, PZM stay server-controlled)', () => {
  const S = setup(); const r = S.X.Soldiers.create(S.admin, S.c1, S.data(S.o1, { id: 'forged', record_status: 'cancelled', created_by: 'x@y.z', course_id: S.c2, active: false, pzm_value: '99', pzm_flag: 'x' }));
  const row = S.X.Db.get('Soldiers', r.id); assert.notStrictEqual(row.id, 'forged'); assert.strictEqual(row.course_id, S.c1); assert.strictEqual(row.record_status, 'active'); assert.strictEqual(row.created_by, 'admin@x.com'); assert.strictEqual(row.active, true); assert.strictEqual(row.pzm_value, '');
});
t('hardening', 'type confusion: objects / arrays / numbers in fields do not slip through', () => {
  const S = setup(); const c = o => code(() => mk(S, o));
  assert.strictEqual(c({ full_name: {} }), 'VALIDATION'); assert.strictEqual(c({ personal_number: {} }), 'VALIDATION'); assert.strictEqual(c({ personal_number: ['1', '2'] }), 'VALIDATION'); assert.strictEqual(c({ gender: ['M'] }), 'VALIDATION');
  assert.strictEqual(c({ department_id: { id: 'x' } }), 'VALIDATION'); assert.strictEqual(c({ team_id: null }), 'VALIDATION');
  assert.strictEqual(code(() => S.X.Soldiers.setActive(S.admin, 'x', 'false', 'a', 'r')), 'VALIDATION', 'active must be boolean');
  assert.strictEqual(code(() => S.X.Soldiers.update(S.admin, 'x', null, 'a', 'r')), 'VALIDATION');
});
t('hardening', 'reassign cannot target another course / inactive structure; soldier of course A cannot be moved into course B', () => {
  const S = setup(); const a = mk(S); const bad = { department_id: S.dep(S.o2, 0), team_id: S.team(S.o2, 0, 0) };
  assert.strictEqual(code(() => S.X.Soldiers.reassign(S.admin, a.id, bad, a.updated_at, 'r')), 'VALIDATION'); assert.strictEqual(S.X.Db.get('Soldiers', a.id).course_id, S.c1);
  S.X.Db.update('Teams', S.team(S.o1, 1, 0), { active: false }); assert.strictEqual(code(() => S.X.Soldiers.reassign(S.admin, a.id, { department_id: S.dep(S.o1, 1), team_id: S.team(S.o1, 1, 0) }, a.updated_at, 'r')), 'VALIDATION');
});
t('hardening', 'no data exposure through any commander endpoint (serialised responses contain no admin-only strings)', () => {
  const S = setup(); const a = mk(S); S.X.Soldiers.update(S.admin, a.id, { commander_note: 'SECRET-NOTE-XYZ' }, a.updated_at, 'r'); S.X.Soldiers.cancel(S.admin, mk(S, { personal_number: '2', full_name: 'CANCELLED-NAME' }).id, 'r');
  S.X.Auth._emailProvider = () => 'cmd1@x.com';
  const all = JSON.stringify([S.X.api('soldiers.list', { courseId: S.c1 }), S.X.api('soldiers.list', { courseId: S.c1, opts: { includeCancelled: true } }), S.X.api('soldiers.card', { id: a.id }), S.X.api('courses.org', { courseId: S.c1 })]);
  ['SECRET-NOTE-XYZ', 'ש-אדמין', 'CANCELLED-NAME', 'admin@x.com'].forEach(k => assert.ok(!all.includes(k), k));
});
t('hardening', 'physical deletion impossible: row counts never decrease across the whole lifecycle', () => {
  const S = setup(); const a = mk(S); const n = S.X.mem.Soldiers.length; let u = a.updated_at;
  u = S.X.Soldiers.setActive(S.admin, a.id, false, u, 'r').updated_at; S.X.Soldiers.cancel(S.admin, a.id, 'r'); S.X.Soldiers.restore(S.admin, a.id, 'r'); assert.strictEqual(S.X.mem.Soldiers.length, n);
  assert.ok(!('delete' in S.X.Soldiers) && !('remove' in S.X.Soldiers));
});

// ---------------- v0.3.1: inactive soldier is invisible to commanders ----------------
const navPayload = (S, soldier, nt) => ({ request_id: S.X.Util.uuid(), soldier_id: soldier, test_date: '2026-03-01', navigation_type_id: nt, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 });
function inactiveSetup() {
  const S = setup(); const a = mk(S, { full_name: 'לא-פעיל-סודי', personal_number: '7001' }); const b = mk(S, { full_name: 'פעיל', personal_number: '7002' });
  const nt = S.X.Util.uuid(); S.X.Db.insert('NavigationTypes', { id: nt, course_id: S.c1, name: 'יום', active: true });
  const rec = S.X.Records.create(S.cmd1, 'NavigationTests', S.c1, navPayload(S, a.id, nt)).record;      // created while the soldier was still active
  S.X.Records.requestCorrection(S.cmd1, 'NavigationTests', rec.id, { plan_score: 5 }, 'סיבה');
  const off = S.X.Soldiers.setActive(S.admin, a.id, false, a.updated_at, 'השתחרר');
  return Object.assign(S, { a, b, nt, rec, off });
}
t('unit', 'isVisible_ matrix: commander sees only (not cancelled AND active); admin sees all', () => {
  const { X, admin, cmd1, c1 } = setup(); const row = (act, st) => ({ course_id: c1, active: act, record_status: st });
  [[true, 'active', true], [false, 'active', false], [true, 'cancelled', false], [false, 'cancelled', false]].forEach(([a, st, exp]) => { assert.strictEqual(X.Soldiers.isVisible_(cmd1, row(a, st)), exp, a + st); assert.strictEqual(X.Soldiers.isVisible_(admin, row(a, st)), true); });
  assert.strictEqual(X.Soldiers.isVisible_(cmd1, null), false); assert.strictEqual(X.Soldiers.isVisible_(cmd1, { course_id: c1, active: '', record_status: 'active' }), false, 'blank active fails closed');
  assert.strictEqual(X.Soldiers.isVisible_(cmd1, { course_id: c1, active: 'TRUE', record_status: 'active' }), true);
});
t('unit', 'Records.soldierVisible_: result of a hidden soldier is hidden for commander, visible for admin', () => {
  const S = inactiveSetup(); assert.strictEqual(S.X.Records.soldierVisible_(S.cmd1, S.rec), false); assert.strictEqual(S.X.Records.soldierVisible_(S.admin, S.rec), true); assert.strictEqual(S.X.Records.soldierVisible_(S.cmd1, { soldier_id: S.b.id }), true);
});
t('integration', 'inactive soldier: absent from commander list (also when searched / filtered), card is NOT_FOUND; admin still sees and opens it', () => {
  const S = inactiveSetup(); const { X } = S;
  assert.deepStrictEqual(X.Soldiers.list(S.cmd1, S.c1).map(s => s.full_name), ['פעיל']);
  assert.strictEqual(X.Soldiers.list(S.cmd1, S.c1, { q: 'סודי' }).length, 0); assert.strictEqual(X.Soldiers.list(S.cmd1, S.c1, { q: '7001' }).length, 0); assert.strictEqual(X.Soldiers.list(S.cmd1, S.c1, { active: false }).length, 0, 'cannot enumerate inactive soldiers');
  assert.strictEqual(X.Soldiers.list(S.cmd1, S.c1, { includeCancelled: true }).length, 1);
  assert.strictEqual(code(() => X.Soldiers.card(S.cmd1, S.a.id)), 'NOT_FOUND');
  assert.strictEqual(X.Soldiers.list(S.admin, S.c1).length, 2); assert.strictEqual(X.Soldiers.list(S.admin, S.c1, { active: false })[0].full_name, 'לא-פעיל-סודי');
  const c = X.Soldiers.card(S.admin, S.a.id); assert.strictEqual(c.soldier.active, false); assert.ok(c.history.some(h => h.action === 'SOLDIER_ACTIVITY'));
});
t('integration', 'admin still manages an inactive soldier (edit, reassign, reactivate); reactivation makes him visible to the commander again', () => {
  const S = inactiveSetup(); const { X } = S; let cur = X.Db.get('Soldiers', S.a.id);
  cur = X.Soldiers.update(S.admin, S.a.id, { pakal: 'חדש' }, cur.updated_at, 'r');
  cur = X.Soldiers.reassign(S.admin, S.a.id, { department_id: S.dep(S.o1, 1), team_id: S.team(S.o1, 1, 0) }, cur.updated_at, 'r');
  assert.strictEqual(X.Soldiers.list(S.cmd1, S.c1).length, 1);
  X.Soldiers.setActive(S.admin, S.a.id, true, cur.updated_at, 'חזר'); assert.strictEqual(X.Soldiers.list(S.cmd1, S.c1).length, 2); assert.ok(X.Soldiers.card(S.cmd1, S.a.id));
});
t('integration', 'API direct (commander): soldiers.list/card hide the inactive soldier; every other soldier-linked route is closed too (nav.list, nav.summary, record.history, correction.list, correction.request, nav.create)', () => {
  const S = inactiveSetup(); const { X } = S; X.Auth._emailProvider = () => 'cmd1@x.com'; const api = (m, a) => X.api(m, a);
  assert.deepStrictEqual(api('soldiers.list', { courseId: S.c1 }).data.map(s => s.full_name), ['פעיל']); assert.strictEqual(api('soldiers.card', { id: S.a.id }).code, 'NOT_FOUND');
  assert.deepStrictEqual(api('nav.list', { courseId: S.c1, soldierId: S.a.id }).data, []); assert.deepStrictEqual(api('nav.list', { courseId: S.c1 }).data, []);
  assert.strictEqual(api('nav.summary', { courseId: S.c1, soldierId: S.a.id }).data.count, 0);
  assert.strictEqual(api('record.history', { table: 'NavigationTests', id: S.rec.id }).code, 'NOT_FOUND');
  assert.strictEqual(api('correction.list', { courseId: S.c1 }).data.length, 0);
  assert.strictEqual(api('correction.request', { table: 'NavigationTests', id: S.rec.id, changes: { plan_score: 1 }, reason: 'r' }).code, 'NOT_FOUND');
  assert.strictEqual(api('nav.create', { courseId: S.c1, data: navPayload(S, S.a.id, S.nt) }).code, 'VALIDATION');
  X.Auth._emailProvider = () => 'admin@x.com';      // admin keeps full access
  assert.strictEqual(api('nav.list', { courseId: S.c1, soldierId: S.a.id }).data.length, 1); assert.strictEqual(api('correction.list', { courseId: S.c1 }).data.length, 1); assert.ok(api('record.history', { table: 'NavigationTests', id: S.rec.id }).ok); assert.ok(api('soldiers.card', { id: S.a.id }).ok);
  X.Soldiers.setActive(S.admin, S.a.id, true, X.Db.get('Soldiers', S.a.id).updated_at, 'חזר'); X.Auth._emailProvider = () => 'cmd1@x.com';
  assert.strictEqual(api('nav.list', { courseId: S.c1, soldierId: S.a.id }).data.length, 1, 'visible again after reactivation');
});
t('hardening', 'uniform NOT_FOUND: inactive, cancelled, missing and foreign-course soldier give the identical code AND message to a commander', () => {
  const S = inactiveSetup(); const { X } = S; const c = mk(S, { personal_number: '7003' }); X.Soldiers.cancel(S.admin, c.id, 'r'); const f = X.Soldiers.create(S.admin, S.c2, S.data(S.o2, { personal_number: '9001' }));
  const msgs = [S.a.id, c.id, 'nope', f.id].map(id => msg(() => X.Soldiers.card(S.cmd1, id))); assert.strictEqual(msgs[0].split('|')[0], 'NOT_FOUND'); msgs.forEach(m => assert.strictEqual(m, msgs[0]));
  const rm = [S.rec.id, 'nope'].map(id => msg(() => X.Records.history(S.cmd1, 'NavigationTests', id))); assert.strictEqual(rm[0], rm[1]);
  const nm = [S.a.id, c.id, 'nope'].map(id => msg(() => X.Records.create(S.cmd1, 'NavigationTests', S.c1, navPayload(S, id, S.nt)))); nm.forEach(m => assert.strictEqual(m, nm[0])); assert.ok(!nm[0].includes('פעיל'), 'no status wording');
});
t('hardening', 'no leak of an inactive soldier through any commander endpoint (name, number, results, correction text)', () => {
  const S = inactiveSetup(); const { X } = S; X.Auth._emailProvider = () => 'cmd1@x.com';
  const all = JSON.stringify([X.api('soldiers.list', { courseId: S.c1 }), X.api('soldiers.list', { courseId: S.c1, opts: { q: '70', includeCancelled: true } }), X.api('soldiers.card', { id: S.a.id }), X.api('nav.list', { courseId: S.c1 }), X.api('nav.summary', { courseId: S.c1, soldierId: S.a.id }), X.api('correction.list', { courseId: S.c1 }), X.api('record.history', { table: 'NavigationTests', id: S.rec.id })]);
  ['לא-פעיל-סודי', '7001', S.a.id, S.rec.id, 'סיבה'].forEach(k => assert.ok(!all.includes(k), k));
});
t('hardening', 'deactivation takes effect immediately for an already-open commander session (no cached visibility)', () => {
  const S = setup(); const a = mk(S, { personal_number: '8001' }); assert.ok(S.X.Soldiers.card(S.cmd1, a.id)); S.X.Soldiers.setActive(S.admin, a.id, false, a.updated_at, 'r'); assert.strictEqual(code(() => S.X.Soldiers.card(S.cmd1, a.id)), 'NOT_FOUND');
});

// ---------------- v0.3.2: idempotent replay must not leak ----------------
function replaySetup() {
  const S = setup(); const a = mk(S, { full_name: 'חייל-שחזור', personal_number: '6001' }); const nt = S.X.Util.uuid(); S.X.Db.insert('NavigationTypes', { id: nt, course_id: S.c1, name: 'יום', active: true });
  const payload = navPayload(S, a.id, nt); const first = S.X.Records.create(S.cmd1, 'NavigationTests', S.c1, payload);
  return Object.assign(S, { a, nt, payload, first });
}
const replayApi = (S, email, data) => { S.X.Auth._emailProvider = () => email; return S.X.api('nav.create', { courseId: S.c1, data: data || S.payload }); };
t('unit', 'replay: active soldier => normal idempotent duplicate (same record, no second row)', () => {
  const S = replaySetup(); const r = S.X.Records.create(S.cmd1, 'NavigationTests', S.c1, S.payload); assert.strictEqual(r.duplicate, true); assert.strictEqual(r.record.id, S.first.record.id); assert.strictEqual(S.X.mem.NavigationTests.length, 1);
});
t('unit', 'SOLDIER_UNAVAILABLE is the single message used by prepare and by the replay path', () => { const { X } = setup(); assert.strictEqual(X.Records.SOLDIER_UNAVAILABLE, 'החייל אינו זמין להזנה בקורס זה.'); });
t('integration', 'API replay with an active soldier still returns ok + duplicate:true (idempotency intact)', () => {
  const S = replaySetup(); const r = replayApi(S, 'cmd1@x.com'); assert.ok(r.ok); assert.strictEqual(r.data.duplicate, true); assert.strictEqual(r.data.record.id, S.first.record.id);
});
t('integration', 'API replay after the soldier became INACTIVE is blocked for the commander with the same answer as a fresh request; nothing leaked', () => {
  const S = replaySetup(); S.X.Soldiers.setActive(S.admin, S.a.id, false, S.a.updated_at, 'r');
  const replay = replayApi(S, 'cmd1@x.com'); const fresh = replayApi(S, 'cmd1@x.com', Object.assign({}, S.payload, { request_id: S.X.Util.uuid() }));
  assert.strictEqual(replay.ok, false); assert.deepStrictEqual(replay, fresh, 'replay indistinguishable from a brand-new request to a hidden soldier');
  const s = JSON.stringify(replay); [S.first.record.id, S.a.id, 'חייל-שחזור', '6001', String(S.first.record.final_score), 'final_score', 'created_by'].forEach(k => assert.ok(!s.includes(k), k));
  assert.strictEqual(S.X.mem.NavigationTests.length, 1);
});
t('integration', 'API replay after the soldier was CANCELLED is blocked the same way', () => {
  const S = replaySetup(); S.X.Soldiers.cancel(S.admin, S.a.id, 'r'); const replay = replayApi(S, 'cmd1@x.com'); assert.strictEqual(replay.ok, false);
  assert.deepStrictEqual(replay, replayApi(S, 'cmd1@x.com', Object.assign({}, S.payload, { request_id: S.X.Util.uuid() }))); assert.ok(!JSON.stringify(replay).includes(S.first.record.id));
});
t('integration', 'API replay after the RESULT was cancelled by admin does not hand the cancelled record back to the commander', () => {
  const S = replaySetup(); S.X.Records.cancel(S.admin, 'NavigationTests', S.first.record.id, 'r'); const r = replayApi(S, 'cmd1@x.com'); assert.strictEqual(r.ok, false); assert.ok(!JSON.stringify(r).includes(S.first.record.id)); assert.ok(!JSON.stringify(r).includes('final_score'));
});
t('integration', 'API replay: admin keeps the existing behaviour even when the soldier is inactive (own request_id)', () => {
  const S = replaySetup(); const adminPayload = navPayload(S, S.a.id, S.nt); const created = replayApi(S, 'admin@x.com', adminPayload); assert.ok(created.ok && !created.data.duplicate);
  S.X.Soldiers.setActive(S.admin, S.a.id, false, S.a.updated_at, 'r'); const again = replayApi(S, 'admin@x.com', adminPayload); assert.ok(again.ok); assert.strictEqual(again.data.duplicate, true); assert.strictEqual(again.data.record.id, created.data.record.id);
});
t('hardening', 'replay across courses: the same request_id used in another course exposes nothing (commander of course B)', () => {
  const S = replaySetup(); S.X.Courses.setUser(S.admin, S.X.Db.where('Users', u => u.email === 'cmd2@x.com')[0].id, { course_ids: [S.c1, S.c2] });
  const cmd2 = { email: 'cmd2@x.com', role: 'commander', courseScope: [S.c1, S.c2] }; S.X.Auth._emailProvider = () => 'cmd2@x.com';
  const r = S.X.api('nav.create', { courseId: S.c2, data: S.payload }); assert.strictEqual(r.ok, false); assert.ok(!JSON.stringify(r).includes(S.first.record.id)); assert.ok(!JSON.stringify(r).includes(S.a.id));
  S.X.Auth._emailProvider = () => 'cmd1@x.com'; const noScope = S.X.api('nav.create', { courseId: S.c2, data: S.payload }); assert.strictEqual(noScope.code, 'FORBIDDEN');
});
t('hardening', 'race: soldier deactivated between the pre-check and the lock => replay is blocked (check runs inside the lock with fresh data)', () => {
  const S = replaySetup(); S.raceOnce(() => S.X.Db.update('Soldiers', S.a.id, { active: false }));
  assert.strictEqual(code(() => S.X.Records.create(S.cmd1, 'NavigationTests', S.c1, S.payload)), 'VALIDATION'); assert.strictEqual(S.X.mem.NavigationTests.length, 1);
});
t('hardening', "another commander's replay of someone else's request_id gets no record back, whether the soldier is visible or hidden", () => {
  const S = replaySetup(); S.X.Courses.addUser(S.admin, { email: 'cmd3@x.com', role: 'commander', course_ids: [S.c1], display_name: 'ג' }); S.X.Assignments.create(S.admin, { course_id: S.c1, user_email: 'cmd3@x.com', scope_type: 'course', scope_id: S.c1, reason: 'בדיקה' });
  const vis = replayApi(S, 'cmd3@x.com'); assert.strictEqual(vis.ok, false); assert.ok(!JSON.stringify(vis).includes(S.first.record.id));
  S.X.Soldiers.setActive(S.admin, S.a.id, false, S.a.updated_at, 'r'); const hid = replayApi(S, 'cmd3@x.com'); assert.strictEqual(hid.ok, false); assert.ok(!JSON.stringify(hid).includes(S.first.record.id));
});

console.log('\nBY TYPE:', JSON.stringify(counts), 'TOTAL pass=' + (counts.unit + counts.integration + counts.hardening) + ' fail=' + fail);
if (fail) { console.log('FAILED:', failures.join(' | ')); process.exit(1); }
