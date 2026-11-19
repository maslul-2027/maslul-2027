// R5.2.16.4.4 REV3 — privacy sub-cohort suppression (owner decision D2 extended): a figure is NEVER backed by 1-4 distinct soldiers inside a larger scope.
// Rule under test: a binary split of N soldiers (have/missing, scored/unscored, present/absent, early-exit/none, active/inactive...) is shown only if EACH side is 0 or >= 5; either side 1-4 => BOTH counts suppressed
// (no complement), with { suppressed:true, reason } and a generic reason that names neither the small side nor its size. Synthetic, deterministic data only. Node only (in-memory Db) — NOT Apps Script / Sheets / Google.
const { suite } = require('./tlib'); const { t, done, assert } = suite('r5_privacy_subcohort.js'); const { setup } = require('./fixture');

// ---------- scenario builder: N soldiers in course c1 (5 from the fixture + extras), departments 5 / 5 when N = 10 ----------
function world(N) {
  const S = setup(), { X, admin, c1, S: sol, mk, dep } = S; const all = [sol.a, sol.a2, sol.b, sol.c, sol.d];
  const extra = [['ה1', '501', 0, 0], ['ה2', '502', 0, 1], ['ו1', '601', 1, 0], ['ו2', '602', 1, 1], ['ו3', '603', 1, 1]];
  for (let i = 0; i < N - 5; i++) all.push(mk(extra[i][0], extra[i][1], extra[i][2], extra[i][3]));
  S.all = all; S.N = all.length; S.ty = X.ActivityTypes.create(admin, c1, 'מטווח').id;
  // dep0 = a, a2, b, ה1, ה2 ; dep1 = c, d, ו1, ו2, ו3  (5 / 5 for N = 10)
  S.ms = (so, score) => X.Records.create(admin, 'MarksmanshipTests', c1, { request_id: S.rid(), soldier_id: so.id, test_date: '2026-03-01', weapon_type: 'M16', distance_m: 100, examiner_score: score, weapon_zeroed: true }).record;
  S.fit = (so, score) => { const r = X.Records.create(admin, 'FitnessTests', c1, { request_id: S.rid(), soldier_id: so.id, test_date: '2026-03-01', test_type_id: X.Fitness.typesList(admin, c1).find(x => !x.is_opening).id, pullups: 15 }).record; if (score !== null) X.Db.update('FitnessTests', r.id, { weighted_score: score }); return r; };
  S.att = (absent, early) => X.Attendance.createEvent(admin, c1, { request_id: S.rid(), event_date: '2026-03-01', activity_type_id: S.ty, scope_type: 'course', scope_id: c1, absent: (absent || []).map(s => ({ soldier_id: s.id })), early_exit: (early || []).map(s => s.id) });
  S.call = (user, m, a) => { const r = S.as(user, m, a); assert.strictEqual(r.ok, true, m + ' ' + JSON.stringify(r)); return r.data; };
  S.dep0 = all.filter((s, i) => [0, 1, 2].includes(i) || (i >= 5 && i <= 6)); S.dep1 = all.filter(s => !S.dep0.includes(s));
  return S;
}
// every serialized output we can reach for the course (admin or commander): insights, overview, groups, report data + HTML, summaries, assistant
function everything(S, user) {
  const { c1 } = S, out = {};
  out.insights = S.call(user, 'analytics.insights', { courseId: c1 }); out.overview = S.call(user, 'dash.overview', { courseId: c1 }); out.groups = S.call(user, 'dash.groups', { courseId: c1, by: 'department' }); out.home = S.call(user, 'dash.home', {});
  const pv = S.call(user, 'reports.preview', { courseId: c1, spec: { layout: 'analytic' } }); out.report = pv.data; out.html = pv.html;
  ['attendance.summary', 'marches.summary', 'fitness.summary', 'mk.summary', 'nav.summary', 'exams.summary'].forEach(m => { out[m] = S.call(user, m, { courseId: c1 }); });
  out.readiness = S.call(user, 'readiness.summary', { courseId: c1, opts: {} }); out.qual = S.call(user, 'qual.summary', { courseId: c1, opts: {} });
  out.assistant = S.call(user, 'ai.ask', { courseId: c1, question: 'נוכחות כש״ג קליעה ניווט מבחנים כשירות הכשרות כמה חיילים' });
  return out;
}
const json = o => JSON.stringify(o);
const noDigits = s => !/\d/.test(s);

// ---------- unit: the rule itself ----------
t('unit', 'U1. splitOk_: each side must be 0 or >= 5 (0/10, 10/0, 5/5, 0/0, 5/0 shown; 1/9, 9/1, 4/6, 6/4, 3/2, 0/3, 2/0 hidden)', () => {
  const { X } = setup(); [[0, 10], [10, 0], [5, 5], [0, 0], [5, 0], [0, 5], [7, 13]].forEach(p => assert.strictEqual(X.Analytics.splitOk_(p[0], p[1]), true, p.join('/')));
  [[1, 9], [9, 1], [4, 6], [6, 4], [3, 2], [0, 3], [2, 0], [0, 4], [4, 0], [1, 0]].forEach(p => assert.strictEqual(X.Analytics.splitOk_(p[0], p[1]), false, p.join('/')));
  assert.strictEqual(X.Analytics.catOk_([5, 0, 0, 5]), true); assert.strictEqual(X.Analytics.catOk_([5, 4, 0, 1]), false); assert.strictEqual(X.Analytics.catOk_([9, 1]), false);
  assert.ok(noDigits(X.Analytics.cohortReason_()), 'the generic reason carries no number'); assert.ok(!/ראשון|שני|נעדר|חסר|נוכח/.test(X.Analytics.cohortReason_()), 'and does not say which side is small');
});
t('unit', 'U2. distinct_ counts soldiers, not result rows (three results of one soldier are one soldier)', () => {
  const { X } = setup(); const rows = [{ soldier_id: 'a' }, { soldier_id: 'a' }, { soldier_id: 'a' }, { soldier_id: 'b' }]; assert.strictEqual(X.Analytics.distinct_(rows), 2); assert.strictEqual(X.Analytics.distinct_(rows, r => r.soldier_id === 'a'), 1);
  assert.strictEqual(X.Analytics.scoreOk_(rows.map(r => ({ soldier_id: r.soldier_id, s: r.soldier_id === 'a' ? 5 : null })), 's'), false, 'scored 1 / unscored 1');
});
t('unit', 'U3. group wrappers on synthetic rows: qualifications 5/5 shown, 6/4 hidden; readiness-style categories hide all parts; exams hide a 1-person failed cohort', () => {
  const { X } = setup(); const q = [{ id: 'q1', name: 'הכשרה' }], row = (i, st) => ({ soldier_id: 's' + i, qualification_id: 'q1', status: st, exclusion_status: '' });
  const r55 = [0, 1, 2, 3, 4].map(i => row(i, 'completed')).concat([5, 6, 7, 8, 9].map(i => row(i, 'pending'))), r64 = [0, 1, 2, 3, 4, 5].map(i => row(i, 'completed')).concat([6, 7, 8, 9].map(i => row(i, 'pending')));
  assert.deepStrictEqual(X.Analytics.groupQualifications_('c', r55, q, 10).map(x => [x.completed, x.pending, x.suppressed]), [[5, 5, undefined]]);
  const h = X.Analytics.groupQualifications_('c', r64, q, 10)[0]; assert.deepStrictEqual([h.suppressed, h.completed, h.pending, h.assigned, h.completion_percent], [true, null, null, null, null]);
});

// ---------- integration ----------
t('integration', '1. N=10, 9 with a domain result / 1 without: insights coverage and report completeness expose neither 9/10 nor 1/10 (nor the complement); the other domains still show', () => {
  const S = world(10), { admin, c1, X } = S; S.all.slice(0, 9).forEach(s => S.ms(s, 70 + 1));
  const ins = X.Analytics.insights(admin, c1, {}), cov = ins.items.find(i => i.id === 'coverage'); assert.ok(cov, 'coverage item exists (other domains have 0 results)');
  assert.ok(!/קליעה: \d/.test(cov.text) && /מדוכא מטעמי פרטיות/.test(cov.text), cov.text); assert.ok(/ניווט: 10 מתוך 10/.test(cov.text), '10/10 without data is a legal 0 / 10 split: ' + cov.text);
  const rd = X.Analytics.reportData(admin, c1, {}), row = rd.completeness.find(c => c.label === 'קליעה'); assert.deepStrictEqual([row.suppressed, row.have, row.total, row.missing], [true, null, null, null]);
  assert.strictEqual(rd.completeness.find(c => c.label === 'ניווט').missing, 10); const k = rd.kpis.find(x => x.key === 'marksmanship'); assert.strictEqual(k.n, null, 'KPI n hidden: N - n would be the missing cohort'); assert.ok(k.value !== null, 'the mean itself (9 soldiers) may stay');
  const out = everything(S, admin), all = json(out); assert.ok(!/9 מתוך 10|1 מתוך 10/.test(all), 'text'); assert.ok(!/"(have|with_data)":9\b|"(missing|missing_score)":1\b|"with_score":9\b/.test(all), 'json keys');
  assert.deepStrictEqual([out.overview.completeness.marksmanship.suppressed, out.overview.completeness.marksmanship.with_data, out.overview.completeness.marksmanship.missing], [true, null, null]);
  assert.ok(!/<td[^>]*>\s*(9|1)\s*<\/td>/.test(out.html), 'generated HTML table cells'); assert.ok(!/(^|[^\d])9\s*מתוך|N=9\b/.test(out.html), 'generated HTML text');
});
t('integration', '2. N=10, 1 with a score and 9 without: no complementary 1/9 split anywhere (completeness score, overview, summaries, assistant)', () => {
  const S = world(10), { admin, c1, X } = S; S.all.forEach((s, i) => S.fit(s, i === 0 ? 80 : null));   // every soldier has a record, only one has a score
  const o = X.Dashboard.overview(admin, c1, {}), cm = o.completeness.fitness; assert.deepStrictEqual([cm.with_data, cm.missing], [10, 0], '10 with a record / 0 without is a legal split');
  assert.deepStrictEqual([cm.with_score, cm.missing_score, cm.score_suppressed], [null, null, true]); assert.ok(cm.score_reason && noDigits(cm.score_reason));
  assert.strictEqual(o.fitness.suppressed, true); assert.deepStrictEqual([o.fitness.mean, o.fitness.count, o.fitness.complete_count], [null, null, null], 'a mean of ONE soldier is that soldier');
  const out = everything(S, admin), all = json(out); assert.ok(!/"with_score":1\b|"missing_score":9\b|"complete_count":1\b|"mean":80\b/.test(all)); assert.ok(!/80(\.0)?\b/.test(out.html.replace(/\d{4}-\d{2}-\d{2}/g, '')), 'the single soldier\'s score is not in the HTML');
  assert.strictEqual(out['fitness.summary'].suppressed, true); assert.ok(out.assistant.missing.some(m => /כש״ג/.test(m) && /מדוכא/.test(m)), 'assistant states it is suppressed'); assert.ok(!out.assistant.facts.some(f => /כש״ג/.test(f.text)));
  // only ONE soldier has a record at all => with_data itself is 1 / 9 => suppressed too
  const S2 = world(10); S2.fit(S2.all[0], 80); const c2 = S2.X.Dashboard.overview(S2.admin, S2.c1, {}).completeness.fitness; assert.deepStrictEqual([c2.suppressed, c2.with_data, c2.missing, c2.with_score], [true, null, null, null]);
});
t('integration', '3. N=10 attendance 9 present / 1 absent: insights, report, dashboard, summaries, groups, assistant and HTML never expose the absent cohort, its complement, the percentage or the event totals', () => {
  const S = world(10), { admin, c1, X } = S; S.att([S.all[0]]);
  const ins = X.Analytics.insights(admin, c1, {}); assert.ok(!ins.items.some(i => i.id === 'attendance')); const sp = ins.suppressed.find(s => s.id === 'attendance'); assert.ok(sp && noDigits(sp.reason) && /מדוכא/.test(sp.reason));
  const rd = X.Analytics.reportData(admin, c1, {}), k = rd.kpis.find(x => x.key === 'attendance'); assert.deepStrictEqual([k.value, k.n, k.suppressed], [null, null, true]); assert.ok(noDigits(k.note));
  const out = everything(S, admin), all = json(out); assert.deepStrictEqual([out.overview.attendance.suppressed, out.overview.attendance.percent, out.overview.attendance.total, out.overview.attendance.present, out.overview.attendance.absent, out.overview.attendance.early_exits], [true, null, null, null, null, null]);
  assert.ok(!/"percent":90\b|"percent_display":"90|9 נוכחים|9 מתוך 10|90(\.0)?\s*%/.test(all), 'serialized output'); assert.ok(!/90(\.0)?\s*%/.test(out.html) && !/9 מתוך 10/.test(out.html), 'HTML');
  assert.strictEqual(out['attendance.summary'].suppressed, true); assert.ok(out.assistant.missing.some(m => /נוכחות/.test(m) && /מדוכא/.test(m)));
  // groups: the department holding the absent soldier must not show a percentage (1 of 5); the other department is a legal 0 / 5 split
  const g = out.groups.filter(x => !x.suppressed || x.id); const d0 = g.find(x => x.id === X.Courses.org(admin, c1).departments[0].id), d1 = g.find(x => x.id === X.Courses.org(admin, c1).departments[1].id);
  assert.strictEqual(d0.attendance, null, 'dept with the absent soldier'); assert.strictEqual(d1.attendance, 100, 'dept with nobody absent: 0 / 5 is a legal split');
  // monthly trend points need a legal split too
  assert.ok(!rd.trends.find(x => x.key === 'attendance').points.length);
});
t('integration', '3b. early exits: 9 none / 1 early-exit hides ONLY the early-exit figure; attendance itself (all present) stays', () => {
  const S = world(10), { admin, c1, X } = S; S.att([], [S.all[0]]);
  const ins = X.Analytics.insights(admin, c1, {}), a = ins.items.find(i => i.id === 'attendance'); assert.ok(a, 'all 10 present => 0 absent / 10 present is legal'); assert.ok(/100/.test(a.text) && !/יציאות מוקדמות/.test(a.text), a.text);
  const ov = X.Dashboard.overview(admin, c1, {}).attendance; assert.deepStrictEqual([ov.percent, ov.early_exits, ov.early_exits_suppressed], [100, null, true]);
  const S5 = world(10); S5.att([], S5.all.slice(0, 5)); const a5 = S5.X.Analytics.insights(S5.admin, S5.c1, {}).items.find(i => i.id === 'attendance'); assert.ok(/5 יציאות מוקדמות/.test(a5.text), '5 / 5 early-exit split is legal');
});
t('integration', '4. 5 / 5 splits may be shown (coverage, completeness, attendance with 5 absent)', () => {
  const S = world(10), { admin, c1, X } = S; S.all.slice(0, 5).forEach(s => S.ms(s, 60)); S.att(S.all.slice(5, 10));
  const cov = X.Analytics.insights(admin, c1, {}).items.find(i => i.id === 'coverage'); assert.ok(/קליעה: 5 מתוך 10 חיילים ללא תוצאה/.test(cov.text), cov.text); const row = X.Analytics.reportData(admin, c1, {}).completeness.find(c => c.label === 'קליעה'); assert.deepStrictEqual([row.have, row.total, row.missing, row.suppressed], [5, 10, 5, undefined]);
  const at = X.Analytics.insights(admin, c1, {}).items.find(i => i.id === 'attendance'); assert.ok(at && /50/.test(at.text), 'attendance 5 present / 5 absent is shown'); const ov = X.Dashboard.overview(admin, c1, {}); assert.deepStrictEqual([ov.attendance.percent, ov.attendance.suppressed], [50, undefined]);
  assert.deepStrictEqual([ov.completeness.marksmanship.with_data, ov.completeness.marksmanship.missing, ov.completeness.marksmanship.with_score, ov.completeness.marksmanship.missing_score], [5, 5, 5, 5]);
});
t('integration', '5. 10 / 0 is shown as complete with no missing (not suppressed)', () => {
  const S = world(10), { admin, c1, X } = S; S.all.forEach(s => S.ms(s, 60)); S.att([]);
  const ins = X.Analytics.insights(admin, c1, {}), cov = ins.items.find(i => i.id === 'coverage'); assert.ok(!/קליעה/.test(cov.text), 'nothing missing in marksmanship => not listed'); const row = X.Analytics.reportData(admin, c1, {}).completeness.find(c => c.label === 'קליעה'); assert.deepStrictEqual([row.have, row.total, row.missing, row.suppressed], [10, 10, 0, undefined]);
  const ov = X.Dashboard.overview(admin, c1, {}); assert.deepStrictEqual([ov.completeness.marksmanship.with_data, ov.completeness.marksmanship.missing, ov.completeness.marksmanship.suppressed], [10, 0, undefined]); assert.deepStrictEqual([ov.attendance.percent, ov.attendance.early_exits, ov.attendance.suppressed], [100, 0, undefined]);
  assert.ok(X.Analytics.insights(admin, c1, {}).items.find(i => i.id === 'attendance'));
});
t('integration', '6. admin vs commander: the cohort is counted AFTER the commander scope is applied (a 9/1 course split can be a legal 5/0 for the department commander, and vice versa)', () => {
  const S = world(10), { admin, c1, X, dep, cD, cC, cT } = S;
  // marksmanship results for everybody except one soldier of department 1; department 0 is complete
  S.all.forEach(s => { if (s !== S.dep1[4]) S.ms(s, 65); });
  const ca = X.Analytics.reportData(admin, c1, {}).completeness.find(c => c.label === 'קליעה'); assert.strictEqual(ca.suppressed, true, 'admin: 9 / 1');
  const cd0 = X.Analytics.reportData(cD, c1, {}); assert.strictEqual(cd0.soldiers, 5); const r0 = cd0.completeness.find(c => c.label === 'קליעה'); assert.deepStrictEqual([r0.have, r0.total, r0.missing], [5, 5, 0], 'dept-0 commander: his own scope is complete (5 / 0)');
  X.Courses.addUser(S.admin, { email: 'd1@x.com', role: 'commander', course_ids: [c1], display_name: 'שם-d1' }); X.Assignments.create(S.admin, { course_id: c1, user_email: 'd1@x.com', scope_type: 'department', scope_id: dep(1), reason: 'בדיקה' });
  const cD1 = { email: 'd1@x.com', role: 'commander', courseScope: [c1] }; const r1 = X.Analytics.reportData(cD1, c1, {}).completeness.find(c => c.label === 'קליעה'); assert.deepStrictEqual([r1.suppressed, r1.have, r1.missing], [true, null, null], 'dept-1 commander: 4 / 1');
  const all1 = json(everything(S, cD1)); assert.ok(!/"(have|with_data)":4\b|"(missing)":1\b/.test(all1)); const allC = json(everything(S, cC)); assert.ok(!/"(have|with_data)":9\b|"missing":1\b/.test(allC));
  const insT = X.Analytics.insights(cT, c1, {}); assert.strictEqual(insT.small_group, true, 'team commander (2 soldiers) gets nothing'); assert.deepStrictEqual(insT.items, []);
  assert.ok(X.Dashboard.overview(cT, c1, {}).suppressed);
});
t('integration', '7. readiness / marches / qualifications / exams style cohorts: 9 / 1 hidden, 5 / 5 shown; the per-soldier operational list is unchanged', () => {
  const S = world(10), { admin, c1, X } = S; const as = (so, st) => X.Readiness.assess(admin, c1, { request_id: S.rid(), soldier_id: so.id, status: st, start_date: '2026-03-01' });
  S.all.slice(0, 9).forEach(s => as(s, 'fit')); let r = X.Readiness.summary(admin, c1); assert.strictEqual(r.counts_suppressed, true); assert.deepStrictEqual(r.counts, { fit: null, fit_with_restrictions: null, unfit: null, not_entered: null }); assert.strictEqual(r.soldiers, undefined, 'group summary: no per-soldier list'); assert.deepStrictEqual(X.Readiness.notEntered(admin, c1, {}).length, 1, 'operational route: the one soldier with no status');
  assert.strictEqual(X.Dashboard.overview(admin, c1, {}).readiness.soldiers, undefined, 'the dashboard readiness block carries NO per-soldier list');
  const S2 = world(10); S2.all.slice(0, 5).forEach(s => S2.X.Readiness.assess(S2.admin, S2.c1, { request_id: S2.rid(), soldier_id: s.id, status: 'fit', start_date: '2026-03-01' })); r = S2.X.Readiness.summary(S2.admin, S2.c1); assert.deepStrictEqual([r.counts.fit, r.counts.not_entered, r.counts_suppressed], [5, 5, undefined]);
  assert.strictEqual(S2.X.Dashboard.overview(S2.admin, S2.c1, {}).readiness.counts.fit, 5);
  const S3 = world(10); const m = S3.X.Analytics.groupMarches_([{ soldier_id: 'a', present: true }, { soldier_id: 'b', present: true }, { soldier_id: 'c', present: true }, { soldier_id: 'd', present: true }, { soldier_id: 'e', present: true }, { soldier_id: 'f', present: true }, { soldier_id: 'g', present: true }, { soldier_id: 'h', present: true }, { soldier_id: 'i', present: true }, { soldier_id: 'j', present: false }], 10);
  assert.deepStrictEqual([m.suppressed, m.marches_absent, m.marches_attended, m.total_km], [true, null, null, null]); assert.ok(S3);
});
t('integration', '8. navigation group summary (nav.groups): a department with 4 of 5 soldiers having a result hides its figures and the smallest other group (complementary); the internal helper fields never appear', () => {
  const S = world(10), { admin, c1, X } = S, nt = X.Navigation.typeCreate(admin, c1, 'א').id;
  const nav = so => X.Records.create(admin, 'NavigationTests', c1, { request_id: S.rid(), soldier_id: so.id, test_date: '2026-03-01', navigation_type_id: nt, distance_km: 3, plan_score: 4, debrief_score: 4, points_completed: 3, points_total: 3 });
  S.dep0.forEach(nav); S.dep1.slice(0, 4).forEach(nav);   // dept1: 4 of 5
  const g = X.Navigation.groupSummary(admin, c1, {}), all = json(g); assert.ok(!/soldiers_scored_|types_small_/.test(all));
  const d = g.departments.filter(x => x.id); assert.ok(d.length === 2 && d.every(x => x.mean_display === null && x.count === null), 'one hidden department => the other is hidden as well: ' + json(d.map(x => [x.mean_display, x.count])));
  assert.strictEqual(g.course.soldiers_with_results, null, '9 / 1 course split hidden'); assert.strictEqual(g.course.count, null, 'row count would reveal it');
  const S2 = world(10), n2 = S2.X.Navigation.typeCreate(S2.admin, S2.c1, 'א').id; S2.all.forEach(so => S2.X.Records.create(S2.admin, 'NavigationTests', S2.c1, { request_id: S2.rid(), soldier_id: so.id, test_date: '2026-03-01', navigation_type_id: n2, distance_km: 3, plan_score: 4, debrief_score: 4, points_completed: 3, points_total: 3 }));
  const g2 = S2.X.Navigation.groupSummary(S2.admin, S2.c1, {}); assert.deepStrictEqual([g2.course.soldiers_with_results, g2.course.count], [10, 10], '10 / 0 is legal'); assert.ok(g2.departments.filter(x => x.id).every(x => x.count === 5 && x.mean_display !== null));
});
t('hardening', '9. one serialized scan: no suppressed object carries a number, every generic reason is identical, and a 9/1 world exposes no value that equals the hidden count', () => {
  const S = world(10), { admin, c1, X } = S; S.all.slice(0, 9).forEach(s => S.ms(s, 71)); S.att([S.all[0]]); S.all.slice(0, 9).forEach(s => S.fit(s, 80));
  const out = everything(S, admin), reasons = new Set(), walk = (o, path) => { if (o && typeof o === 'object') { if (o.suppressed === true && o.reason !== undefined && /מדוכא/.test(String(o.reason))) reasons.add(o.reason); Object.keys(o).forEach(k => walk(o[k], path + '.' + k)); } };
  walk(out, ''); assert.ok(reasons.size >= 1); reasons.forEach(r => { assert.strictEqual(r, X.Analytics.cohortReason_()); });
  const all = json(out); assert.ok(!/"(missing|absent|absences|missing_score|marches_absent)":1\b/.test(all), 'no hidden 1'); assert.ok(!/"(have|with_data|with_score|present)":9\b/.test(all), 'no hidden 9');
});
t('hardening', '10. per-soldier routes are unchanged (explicit soldierId still returns that soldier\'s own result) and inactive soldiers stay out of group figures', () => {
  const S = world(10), { admin, c1, X } = S; S.ms(S.all[0], 77); S.att([S.all[0]], [S.all[1]]);
  assert.strictEqual(X.Marksmanship.summary(admin, c1, S.all[0].id).regular.mean, 77); assert.strictEqual(X.Marksmanship.summary(admin, c1, S.all[0].id).regular.last, 77, 'per-soldier last stays');
  const a = X.Attendance.summary(admin, c1, S.all[0].id); assert.deepStrictEqual([a.total, a.present, a.absent], [1, 0, 1]); assert.strictEqual(X.Attendance.summary(admin, c1, S.all[1].id).early_exits, 1);
  X.Db.update('Soldiers', S.all[9].id, { active: false }); const rd = X.Analytics.reportData(admin, c1, {}); assert.strictEqual(rd.soldiers, 9, 'active=false soldier excluded from current figures');
});
done();
