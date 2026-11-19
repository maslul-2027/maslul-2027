// v1.0.0 alerts engine — Node only.
const { suite } = require('./tlib'); const { t, done, assert } = suite('v1_alerts.js'); const { setup } = require('./fixture');
const T = '2026-06-10';
t('integration', 'exam meeting alert: created when B fails, disappears (archived by system) when the meeting is documented, dedupe on repeated refresh, commander sees only his soldiers', () => {
  const S = setup(); const { X, admin, c1, cT, cC, S: sol } = S; const ex = X.Exams.defCreate(admin, c1, { name: 'מבחן' }); const at = (so, l, sc) => X.Exams.addAttempt(admin, c1, { request_id: S.rid(), soldier_id: so.id, exam_id: ex.id, attempt: l, attempt_date: '2026-03-01', score: sc });
  at(sol.a, 'A', 50); at(sol.a, 'B', 50); at(sol.c, 'A', 50); at(sol.c, 'B', 50); const r1 = X.Alerts.refresh(admin, c1, T); assert.strictEqual(r1.created, 2); assert.strictEqual(X.Alerts.refresh(admin, c1, T).created, 0, 'dedupe');
  assert.strictEqual(X.Alerts.list(admin, c1, {}).length, 2); assert.deepStrictEqual(X.Alerts.list(cT, c1, {}).map(a => a.soldier_name), ['אלף']); assert.strictEqual(X.Alerts.list(cC, c1, {}).length, 2); assert.strictEqual(X.Alerts.list(S.none, c1, {}).length, 0);
  const m = X.Db.where('ExamMeetings', x => x.soldier_id === sol.a.id)[0]; X.Records.adminEdit(admin, 'ExamMeetings', m.id, { done: true, owner_role: 'מ״פ', meeting_date: '2026-03-05' }, 'תועד');
  const r2 = X.Alerts.refresh(admin, c1, T); assert.strictEqual(r2.archived, 1); assert.strictEqual(X.Alerts.list(admin, c1, { status: 'open' }).length, 1); const h = X.Alerts.list(admin, c1, { status: 'archived' })[0].history; assert.deepStrictEqual(h.map(x => x.to), ['open', 'archived']);
});
t('integration', 'qualification + readiness alerts: yellow window / red overdue, completed removes, readiness review on its date, none for cancelled soldiers', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; const q = X.Qualifications.define(admin, c1, { name: 'עזרה ראשונה', completion_terms: 'ת', target_date: '2026-06-12' }).qualification;
  X.Readiness.assess(admin, c1, { request_id: S.rid(), soldier_id: sol.a.id, status: 'fit_with_restrictions', restrictions: 'ללא ריצה', start_date: '2026-06-01', next_review_date: '2026-06-10' });
  X.Alerts.refresh(admin, c1, T); let L = X.Alerts.list(admin, c1, {}); assert.strictEqual(L.filter(a => a.rule_key === 'qual.due_soon').length, 5); assert.strictEqual(L.filter(a => a.rule_key === 'readiness.review_due').length, 1); assert.strictEqual(L.find(a => a.rule_key === 'readiness.review_due').urgency, 'yellow', 'on the date');
  const A = so => X.Qualifications.assignments(admin, c1, { soldierId: so.id })[0]; X.Qualifications.update(admin, A(sol.a).id, { status: 'completed', completion_date: '2026-06-09' }, null, ''); X.Soldiers.cancel(admin, sol.d.id, 'ב');
  X.Alerts.refresh(admin, c1, T); assert.strictEqual(X.Alerts.list(admin, c1, { status: 'open' }).filter(a => a.rule_key === 'qual.due_soon').length, 3);
  X.Alerts.refresh(admin, c1, '2026-06-13'); L = X.Alerts.list(admin, c1, { status: 'open' }); assert.strictEqual(L.filter(a => a.rule_key === 'qual.overdue').length, 3); assert.strictEqual(L.filter(a => a.rule_key === 'qual.due_soon').length, 0); assert.strictEqual(L.find(a => a.rule_key === 'readiness.review_due').urgency, 'red'); assert.strictEqual(L[0].urgency, 'red', 'red first');
});
t('integration', 'threshold rules are OFF until configured; then low-mean and trend-drop alerts appear; thresholds are admin settings, never defaults', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; const nt = X.Navigation.typeCreate(admin, c1, 'א'); const nav = (so, d, ps, ds) => X.Records.create(admin, 'NavigationTests', c1, { request_id: S.rid(), soldier_id: so.id, test_date: d, navigation_type_id: nt.id, distance_km: 3, plan_score: ps, debrief_score: ds, points_completed: 3, points_total: 3 });
  nav(sol.a, '2026-03-01', 5, 5); nav(sol.a, '2026-04-01', 1, 1); nav(sol.b, '2026-03-01', 4, 4);
  assert.strictEqual(X.Alerts.refresh(admin, c1, T).created, 0, 'no thresholds => no threshold alerts');
  X.Settings.set(admin, c1, 'trend.drop_points', 5, '2000-01-01', 'הגדרה'); X.Alerts.refresh(admin, c1, T); let L = X.Alerts.list(admin, c1, {}); assert.deepStrictEqual(L.map(a => [a.rule_key, a.soldier_name]), [['trend.drop.nav', 'אלף']]);
  X.Settings.set(admin, c1, 'low.nav', 99, '2000-01-01', 'גבוה לבדיקה'); X.Alerts.refresh(admin, c1, T); L = X.Alerts.list(admin, c1, {}); assert.ok(L.some(a => a.rule_key === 'low.nav' && a.soldier_name === 'אלף') && L.some(a => a.rule_key === 'low.nav' && a.soldier_name === 'בית'));
  X.Settings.set(admin, c1, 'low.nav', 1, '2000-01-02', 'נמוך'); X.Alerts.refresh(admin, c1, T); assert.ok(X.Alerts.list(admin, c1, { status: 'open' }).every(a => a.rule_key !== 'low.nav'), 'condition ended');
});
t('hardening', 'handling: admin only, note required for handled, history, handled alert is not re-created for the same key, reopen possible; commander cannot handle or refresh; follow-up alerts are admin-only and carry no private text', () => {
  const S = setup(); const { X, admin, c1, cC, S: sol, code } = S; X.Qualifications.define(admin, c1, { name: 'ק', completion_terms: 'ת', target_date: '2026-06-12' }); X.Private.createFollowUp(admin, c1, { soldier_id: sol.a.id, what_to_check: 'סודי-מ״פ', due_date: '2026-06-01' });
  X.Alerts.refresh(admin, c1, T); const L = X.Alerts.list(admin, c1, { status: 'open' }); const fu = L.find(a => a.rule_key === 'followup.due'); assert.ok(fu && !JSON.stringify(X.Db.all('Alerts')).includes('סודי'));
  assert.ok(X.Alerts.list(cC, c1, {}).every(a => a.rule_key !== 'followup.due') && X.Alerts.list(cC, c1, {}).length === L.length - 1);
  const q = L.find(a => a.rule_key === 'qual.due_soon'); assert.strictEqual(code(() => X.Alerts.handle(cC, q.id, 'handled', 'x')), 'FORBIDDEN'); assert.strictEqual(code(() => X.Alerts.refresh(cC, c1, T)), 'FORBIDDEN'); assert.strictEqual(code(() => X.Alerts.handle(admin, q.id, 'handled', '')), 'VALIDATION'); assert.strictEqual(code(() => X.Alerts.handle(admin, q.id, 'bogus', 'x')), 'VALIDATION'); assert.strictEqual(code(() => X.Alerts.handle(admin, { id: q.id }, 'handled', 'x')), 'NOT_FOUND'); assert.strictEqual(code(() => X.Alerts.handle(admin, q.id, 'handled', 5)), 'VALIDATION');
  X.Alerts.handle(admin, q.id, 'handled', 'טופל בשיחה'); assert.strictEqual(X.Alerts.refresh(admin, c1, T).created, 0, 'not recreated'); assert.strictEqual(X.Alerts.list(admin, c1, { status: 'handled' })[0].handled_by, 'admin@x.com'); assert.strictEqual(code(() => X.Alerts.handle(admin, q.id, 'handled', 'x')), 'VALIDATION');
  X.Alerts.handle(admin, q.id, 'open', 'נפתח שוב'); assert.strictEqual(X.Alerts.list(admin, c1, { status: 'open' }).length, L.length); assert.strictEqual(X.Alerts.counts(admin, c1).open, L.length);
  X.Courses.archive(admin, c1); assert.strictEqual(code(() => X.Alerts.handle(admin, q.id, 'archived', 'x')), 'COURSE_ARCHIVED'); assert.strictEqual(code(() => X.Alerts.list(cC, S.c2, {})), 'FORBIDDEN');
});
done();
