// v1.0.0 qualifications — Node only (in-memory Db).
const { suite } = require('./tlib'); const { t, done, assert } = suite('v1_qual.js'); const { setup } = require('./fixture');
const mkQ = (S, o) => S.X.Qualifications.define(S.admin, S.c1, Object.assign({ name: 'עזרה ראשונה', completion_terms: 'מעבר מבחן מעשי (הגדרת מנהל בבדיקה)' }, o || {}));
t('integration', 'course-wide qualification is assigned to every soldier, soldiers added LATER are covered, individual scope covers only the chosen, no ranking field, no expiry field', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; const r = mkQ(S, { target_date: '2099-06-01' }); assert.strictEqual(r.assigned, 5);
  const n = X.Soldiers.create(admin, c1, { full_name: 'חדש', personal_number: '501', gender: 'M', department_id: S.dep(0), team_id: S.team(0, 0) }); assert.strictEqual(X.Qualifications.assignments(admin, c1, { soldierId: n.id }).length, 1);
  const ind = mkQ(S, { name: 'נהיגה', scope_type: 'individual', soldier_ids: [sol.a.id, sol.b.id] }); assert.strictEqual(ind.assigned, 2); assert.strictEqual(X.Qualifications.assignments(admin, c1, { qualificationId: ind.qualification.id }).length, 2);
  const n2 = X.Soldiers.create(admin, c1, { full_name: 'חדש2', personal_number: '502', gender: 'M', department_id: S.dep(0), team_id: S.team(0, 0) }); assert.strictEqual(X.Qualifications.assignments(admin, c1, { qualificationId: ind.qualification.id }).length, 2, 'individual scope is not extended');
  assert.ok(!X.TABLES.Qualifications.cols.some(c => /rank|expir|valid_until/i.test(c)) && !X.TABLES.QualificationAssignments.cols.some(c => /rank|expir/i.test(c)));
  assert.strictEqual(X.Qualifications.sync_(admin, c1), 0, 'sync is idempotent');
});
t('hardening', 'define: validation, duplicates, admin only, archived course, type confusion; completion terms are mandatory text (never invented)', () => {
  const S = setup(); const { X, admin, c1, cC, code } = S; const bad = o => code(() => mkQ(S, o));
  assert.strictEqual(bad({ name: '' }), 'VALIDATION'); assert.strictEqual(bad({ completion_terms: '' }), 'VALIDATION'); assert.strictEqual(bad({ scope_type: 'team' }), 'VALIDATION'); assert.strictEqual(bad({ target_date: '2099-02-30' }), 'VALIDATION'); assert.strictEqual(bad({ early_alert_days: -1 }), 'VALIDATION'); assert.strictEqual(bad({ name: ['x'] }), 'VALIDATION');
  assert.strictEqual(bad({ scope_type: 'individual' }), 'VALIDATION'); assert.strictEqual(bad({ scope_type: 'individual', soldier_ids: [S.S.f.id] }), 'VALIDATION', 'foreign soldier'); assert.strictEqual(bad({ soldier_ids: [S.S.a.id] }), 'VALIDATION');
  mkQ(S); assert.strictEqual(bad({}), 'DUPLICATE'); assert.strictEqual(code(() => X.Qualifications.define(cC, c1, { name: 'x', completion_terms: 'y' })), 'FORBIDDEN');
  X.Courses.archive(admin, c1); assert.strictEqual(bad({ name: 'אחר' }), 'COURSE_ARCHIVED'); assert.strictEqual(X.Qualifications.list(admin, c1).length, 1);
});
t('integration', 'update: status flow needs completion date, history appended, undo of completion needs a reason, concurrency, commander only inside his scope, excluded cannot be updated', () => {
  const S = setup(); const { X, admin, c1, cT, cC, S: sol, code } = S; mkQ(S); const A = who => X.Qualifications.assignments(admin, c1, { soldierId: who.id })[0];
  const a = A(sol.a); assert.strictEqual(a.status, 'pending');
  assert.strictEqual(code(() => X.Qualifications.update(cT, a.id, { status: 'completed' }, null, '')), 'VALIDATION', 'needs completion date');
  const u1 = X.Qualifications.update(cT, a.id, { status: 'in_progress' }, a.updated_at, ''); assert.strictEqual(u1.status, 'in_progress');
  assert.strictEqual(code(() => X.Qualifications.update(cT, a.id, { status: 'completed', completion_date: '2026-03-01' }, a.updated_at, '')), 'CONFLICT', 'stale');
  const u2 = X.Qualifications.update(cT, a.id, { status: 'completed', completion_date: '2026-03-01' }, u1.updated_at, ''); assert.strictEqual(u2.history.length, 3);
  assert.strictEqual(code(() => X.Qualifications.update(cT, a.id, { status: 'pending' }, null, '')), 'VALIDATION', 'undo needs reason'); assert.strictEqual(code(() => X.Qualifications.update(cT, a.id, { status: 'pending', completion_date: '2026-03-01' }, null, 'x')), 'VALIDATION');
  X.Qualifications.update(cT, a.id, { status: 'pending' }, null, 'הוזן בטעות'); assert.strictEqual(A(sol.a).completion_date, ''); assert.strictEqual(A(sol.a).history.length, 4, 'nothing deleted');
  const b = A(sol.b); assert.strictEqual(code(() => X.Qualifications.update(cT, b.id, { status: 'in_progress' }, null, '')), 'NOT_FOUND', 'outside team assignment'); assert.strictEqual(code(() => X.Qualifications.update(S.none, b.id, { status: 'in_progress' }, null, '')), 'NOT_FOUND');
  assert.strictEqual(X.Qualifications.assignments(cT, c1, {}).length, 2); assert.strictEqual(X.Qualifications.assignments(S.none, c1, {}).length, 0);
  ['status:bogus', 'status:', 'foo:1'].forEach(p => { const [k, v] = p.split(':'); assert.strictEqual(code(() => X.Qualifications.update(admin, b.id, { [k]: v }, null, '')), 'VALIDATION', p); });
  assert.strictEqual(code(() => X.Qualifications.update(admin, { id: b.id }, { status: 'in_progress' }, null, '')), 'NOT_FOUND', 'object id');
  const rq = X.Qualifications.requestExclusion(cC, b.id, 'שוחרר לתפקיד אחר'); assert.strictEqual(rq.exclusion_status, 'requested'); assert.strictEqual(code(() => X.Qualifications.requestExclusion(cC, b.id, 'שוב')), 'DUPLICATE');
  assert.strictEqual(code(() => X.Qualifications.reviewExclusion(cC, b.id, 'approve', '')), 'FORBIDDEN'); X.Qualifications.reviewExclusion(admin, b.id, 'approve', 'אושר');
  assert.strictEqual(code(() => X.Qualifications.update(admin, b.id, { status: 'in_progress' }, null, '')), 'VALIDATION', 'excluded'); assert.strictEqual(code(() => X.Qualifications.reviewExclusion(admin, b.id, 'approve', '')), 'VALIDATION');
  assert.strictEqual(code(() => X.Qualifications.requestExclusion(cC, A(sol.c).id, '')), 'VALIDATION'); assert.strictEqual(code(() => X.Qualifications.requestExclusion(cC, A(sol.c).id, 5)), 'VALIDATION');
});
t('integration', 'completion % from Snapshot: cancelled soldier and approved exclusions not counted, nothing is "0 by default" when nobody is assigned', () => {
  const S = setup(); const { X, admin, c1, cC, S: sol } = S; const q = mkQ(S).qualification; const A = who => X.Qualifications.assignments(admin, c1, { soldierId: who.id })[0];
  X.Qualifications.update(admin, A(sol.a).id, { status: 'completed', completion_date: '2026-03-01' }, null, ''); X.Qualifications.update(admin, A(sol.b).id, { status: 'completed', completion_date: '2026-03-01' }, null, '');
  const raw = () => X.Qualifications.aggregate_(c1, X.Snapshot.rows(admin, 'QualificationAssignments', c1, {}), X.Db.where('Qualifications', q => q.course_id === c1 && X.Util.isTrue(q.active)))[0];   // pure maths (D2 sub-cohort gating is tested in r5_privacy_subcohort)
  let s = raw(); assert.deepStrictEqual([s.assigned, s.completed, s.completion_percent], [5, 2, 40]);
  assert.strictEqual(X.Qualifications.summary(admin, c1)[0].suppressed, true, 'D2: 2 completed / 3 pending soldiers => the group route hides the counts'); assert.strictEqual(X.Qualifications.summary(admin, c1)[0].completed, null);
  X.Qualifications.requestExclusion(cC, A(sol.c).id, 'סיבה'); X.Qualifications.reviewExclusion(admin, A(sol.c).id, 'approve', ''); X.Soldiers.cancel(admin, sol.d.id, 'ביטול');
  s = raw(); assert.deepStrictEqual([s.assigned, s.completed, s.excluded, s.completion_percent], [3, 2, 1, 66.7]);
  const ss = X.Qualifications.soldierSummary(admin, c1, sol.a.id); assert.deepStrictEqual([ss.assigned, ss.completed, ss.percent], [1, 1, 100]); assert.strictEqual(X.Qualifications.soldierSummary(admin, c1, sol.d.id).percent, null);
  assert.strictEqual(X.Qualifications.summary(S.none, c1)[0].completion_percent, null);
});
t('integration', 'postpone: admin only, reason, date history kept; due items: yellow within window, red after, not for completed/excluded/cancelled soldiers; per-qualification window overrides setting', () => {
  const S = setup(); const { X, admin, c1, cC, S: sol, code } = S; const q = mkQ(S, { target_date: '2026-06-10' }).qualification; const A = who => X.Qualifications.assignments(admin, c1, { soldierId: who.id })[0];
  const cnt = (day) => X.Qualifications.dueItems_(c1, day).reduce((m, i) => (m[i.urgency] = (m[i.urgency] || 0) + 1, m), {});
  assert.deepStrictEqual(cnt('2026-06-02'), {}); assert.deepStrictEqual(cnt('2026-06-03'), { yellow: 5 }, '7 days before'); assert.deepStrictEqual(cnt('2026-06-10'), { yellow: 5 }, 'on the day'); assert.deepStrictEqual(cnt('2026-06-11'), { red: 5 });
  X.Qualifications.update(admin, A(sol.a).id, { status: 'completed', completion_date: '2026-06-01' }, null, ''); X.Soldiers.cancel(admin, sol.d.id, 'ב'); assert.deepStrictEqual(cnt('2026-06-11'), { red: 3 });
  assert.strictEqual(code(() => X.Qualifications.postpone(cC, q.id, '2026-07-01', 'x')), 'FORBIDDEN'); assert.strictEqual(code(() => X.Qualifications.postpone(admin, q.id, '2026-07-01', '')), 'VALIDATION'); assert.strictEqual(code(() => X.Qualifications.postpone(admin, q.id, '2026-06-10', 'x')), 'VALIDATION');
  X.Qualifications.postpone(admin, q.id, '2026-07-01', 'דחייה מבצעית'); X.Qualifications.postpone(admin, q.id, '2026-08-01', 'שוב'); const h = X.Qualifications.dueHistory(admin, q.id); assert.deepStrictEqual(h.map(x => [x.original_date, x.new_date]), [['2026-06-10', '2026-07-01'], ['2026-07-01', '2026-08-01']]);
  assert.deepStrictEqual(cnt('2026-06-11'), {}); X.Settings.set(admin, c1, 'qual.early_alert_days', 30, '2000-01-01', 'הרחבה'); assert.deepStrictEqual(cnt('2026-07-05'), { yellow: 3 });
  const q2 = mkQ(S, { name: 'אחר', target_date: '2026-06-10', early_alert_days: 1 }).qualification; assert.strictEqual(X.Qualifications.dueItems_(c1, '2026-06-08').filter(i => i.qualification.id === q2.id).length, 0); assert.strictEqual(X.Qualifications.dueItems_(c1, '2026-06-09').filter(i => i.qualification.id === q2.id).length, 4, 'cancelled soldier gets no assignment');
});
t('hardening', 'deactivating hides it from commanders but keeps the data; reactivation re-syncs; assignments of other courses invisible', () => {
  const S = setup(); const { X, admin, c1, cC, code } = S; const q = mkQ(S).qualification;
  X.Qualifications.setActive(admin, q.id, false, 'לא רלוונטי'); assert.strictEqual(X.Qualifications.list(cC, c1).length, 0); assert.strictEqual(X.Qualifications.list(admin, c1).length, 1); assert.strictEqual(X.Qualifications.summary(admin, c1).length, 0);
  assert.strictEqual(code(() => X.Qualifications.setActive(admin, q.id, true, '')), 'VALIDATION'); assert.strictEqual(code(() => X.Qualifications.setActive(cC, q.id, true, 'x')), 'FORBIDDEN'); X.Qualifications.setActive(admin, q.id, true, 'חזרה');
  assert.strictEqual(X.Qualifications.assignments(admin, S.c2, {}).length, 0); assert.strictEqual(code(() => X.Qualifications.assignments(cC, S.c2, {})), 'FORBIDDEN');
});
done();
