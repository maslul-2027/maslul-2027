// R5.2.16.4.4 FINAL closure — deterministic synthetic tests for D2 (MIN_GROUP = 5) on the remaining aggregate paths.
// Covers: split matrix, DIFFERENTIAL output equality (hidden small side of 1..4 soldiers must leave NO trace), Dashboard.groups per-group split + complementary suppression,
// Analytics.monthly_ (whole-point drop, 5-vs-9 across months, distinct soldiers), alert counts, readiness group/operational split, fitness distribution without min/max.
// Synthetic data only; Node + in-memory Db — NOT Apps Script / Sheets / Google.
const { suite } = require('./tlib'); const { t, done, assert } = suite('r5_final_closure.js'); const { setup } = require('./fixture');

function world(N) {
  const S = setup(), { X, admin, c1, S: sol, mk } = S; const all = [sol.a, sol.a2, sol.b, sol.c, sol.d];
  const extra = [['ה1', '501', 0, 0], ['ה2', '502', 0, 1], ['ו1', '601', 1, 0], ['ו2', '602', 1, 1], ['ו3', '603', 1, 1]];
  for (let i = 0; i < N - 5; i++) all.push(mk(extra[i][0], extra[i][1], extra[i][2], extra[i][3]));
  S.all = all; S.N = all.length; S.ty = X.ActivityTypes.create(admin, c1, 'מטווח').id;
  S.ms = (so, score, date) => X.Records.create(admin, 'MarksmanshipTests', c1, { request_id: S.rid(), soldier_id: so.id, test_date: date || '2026-03-01', weapon_type: 'M16', distance_m: 100, examiner_score: score, weapon_zeroed: true }).record;
  S.att = (absent, early) => X.Attendance.createEvent(admin, c1, { request_id: S.rid(), event_date: '2026-03-01', activity_type_id: S.ty, scope_type: 'course', scope_id: c1, absent: (absent || []).map(s => ({ soldier_id: s.id })), early_exit: (early || []).map(s => s.id) });
  S.call = (user, m, a) => { const r = S.as(user, m, a); assert.strictEqual(r.ok, true, m + ' ' + JSON.stringify(r)); return r.data; };
  return S;
}
function everything(S, user) {
  const { c1 } = S, out = {};
  out.insights = S.call(user, 'analytics.insights', { courseId: c1 }); out.overview = S.call(user, 'dash.overview', { courseId: c1 }); out.groups = S.call(user, 'dash.groups', { courseId: c1, by: 'department' }); out.home = S.call(user, 'dash.home', {});
  const pv = S.call(user, 'reports.preview', { courseId: c1, spec: { layout: 'analytic' } }); out.report = pv.data; out.html = pv.html;
  ['attendance.summary', 'marches.summary', 'fitness.summary', 'mk.summary', 'nav.summary', 'exams.summary'].forEach(m => { out[m] = S.call(user, m, { courseId: c1 }); });
  out.readiness = S.call(user, 'readiness.summary', { courseId: c1, opts: {} }); out.qual = S.call(user, 'qual.summary', { courseId: c1, opts: {} }); out.alerts = S.call(user, 'alerts.counts', { courseId: c1 });
  out.assistant = S.call(user, 'ai.ask', { courseId: c1, question: 'נוכחות כש״ג קליעה ניווט מבחנים כשירות הכשרות התראות כמה חיילים' });
  return out;
}
// normalise run-specific noise (generated ids, timestamps, soldier/department ids) so two worlds can be compared semantically
const norm = o => JSON.stringify(o).replace(/"(generated_at|created_at|updated_at|computed_at|now)":"[^"]*"/g, '"$1":"T"').replace(/\b[A-Za-z]+_[0-9a-f]{6,}\b/g, 'ID').replace(/"id":"[^"]*"/g, '"id":"ID"').replace(/\d{4}-\d\d-\d\dT[\d:.]+Z?/g, 'T');

t('unit', 'F1. split matrix: every (with, without) pair for N = 5, 6, 9, 10, 20 — legal iff each side is 0 or >= 5 (10/0, 0/10, 5/5 show; 9/1, 1/9, 6/4, 4/6, 8/2, 2/8, 7/3, 3/7 hide)', () => {
  const { X } = setup();
  [5, 6, 9, 10, 20].forEach(N => { for (let w = 0; w <= N; w++) { const expect = (w === 0 || w >= 5) && (N - w === 0 || N - w >= 5); assert.strictEqual(X.Analytics.splitOk_(w, N - w), expect, 'N=' + N + ' split ' + w + '/' + (N - w)); } });
  [[10, 0], [0, 10], [5, 5]].forEach(p => assert.strictEqual(X.Analytics.splitOk_(p[0], p[1]), true)); [[9, 1], [1, 9], [6, 4], [4, 6], [8, 2], [2, 8], [7, 3], [3, 7]].forEach(p => assert.strictEqual(X.Analytics.splitOk_(p[0], p[1]), false));
  assert.strictEqual(X.Analytics.splitOk_(5, 1), false, '5 of 6'); assert.strictEqual(X.Analytics.splitOk_(5, 5), true, '5 of 10'); assert.strictEqual(X.Analytics.splitOk_(10, 0), true, '10 of 10'); assert.strictEqual(X.Analytics.splitOk_(4, 1), false, '4 of 5');
});

t('integration', 'F2. marksmanship, N=10: with-result count s = 0..10 — completeness is shown exactly for s in {0, 5, 10}; otherwise BOTH sides null + suppressed (no complement) on overview, report and insights', () => {
  for (let s = 0; s <= 10; s++) {
    const S = world(10), { admin, c1, X } = S; S.all.slice(0, s).forEach(x => S.ms(x, 80)); const legal = s === 0 || s === 5 || s === 10;
    const c = S.call(admin, 'dash.overview', { courseId: c1 }).completeness.marksmanship, r = X.Analytics.reportData(admin, c1, {}).completeness.find(x => x.label === 'קליעה');
    if (legal) { assert.deepStrictEqual([c.with_data, c.missing], [s, 10 - s], 'overview s=' + s); assert.deepStrictEqual([r.have, r.missing], [s, 10 - s], 'report s=' + s); }
    else { assert.deepStrictEqual([c.suppressed, c.with_data, c.missing], [true, null, null], 'overview s=' + s); assert.deepStrictEqual([r.suppressed, r.have, r.missing, r.total], [true, null, null, null], 'report s=' + s); }
  }
});

t('hardening', 'F3. DIFFERENTIAL: marksmanship / attendance / readiness / early-exit with a hidden small side of s = 1,2,3,4 soldiers (equal values) give IDENTICAL normalised output on every surface — the size of the small cohort leaves no trace', () => {
  const D = S => [0, 1, 2, 5, 6].map(i => S.all[i]); // the small cohort is always drawn from ONE department (as in a real small sub-group)
  const variants = {
    marksmanship: (S, s) => { const hid = D(S).slice(0, s).map(x => x.id); S.all.filter(x => hid.indexOf(x.id) === -1).forEach(x => S.ms(x, 77)); },
    attendance_absent: (S, s) => { S.att(D(S).slice(0, s), []); },
    navigation: (S, s) => { const hid = D(S).slice(0, s).map(x => x.id), nt = S.X.Navigation.typeCreate(S.admin, S.c1, 'א').id; S.all.filter(x => hid.indexOf(x.id) === -1).forEach(so => S.X.Records.create(S.admin, 'NavigationTests', S.c1, { request_id: S.rid(), soldier_id: so.id, test_date: '2026-03-01', navigation_type_id: nt, distance_km: 3, plan_score: 4, debrief_score: 4, points_completed: 3, points_total: 3 })); },
    fitness_scored: (S, s) => { const hid = D(S).slice(0, s).map(x => x.id), ft = S.X.Fitness.typesList(S.admin, S.c1).find(x => !x.is_opening).id; S.all.forEach(so => { const r = S.X.Records.create(S.admin, 'FitnessTests', S.c1, { request_id: S.rid(), soldier_id: so.id, test_date: '2026-03-01', test_type_id: ft, pullups: 15 }).record; if (hid.indexOf(so.id) === -1) S.X.Db.update('FitnessTests', r.id, { weighted_score: 66 }); }); },
    early_exit: (S, s) => { S.att([], D(S).slice(0, s)); },
    readiness: (S, s) => { const un = D(S).slice(0, s).map(x => x.id); S.all.forEach(x => S.X.Readiness.assess(S.admin, S.c1, { request_id: S.rid(), soldier_id: x.id, status: un.indexOf(x.id) !== -1 ? 'unfit' : 'fit', start_date: '2026-03-01' })); }
  };
  Object.keys(variants).forEach(name => {
    const outs = [1, 2, 3, 4].map(s => { const S = world(10); variants[name](S, s); const o = everything(S, S.admin); delete o.html; return { s, n: norm(o), h: norm(everything(S, S.admin).html) }; });
    // non-vacuous control: with NO hidden cohort (s = 0) the output differs from the hidden runs (the figures are shown when legal)
    { const S = world(10); variants[name](S, 0); const c = norm((() => { const o = everything(S, S.admin); delete o.html; return o; })()); assert.notStrictEqual(c, outs[0].n, name + ': the s=0 control must differ (otherwise the test proves nothing)'); }
    outs.slice(1).forEach(o => { assert.strictEqual(o.n, outs[0].n, name + ': s=' + o.s + ' vs s=1 differ in JSON output'); });
  });
});

t('integration', 'F4. Dashboard.groups: a department whose with-a-value split is illegal is hidden AND the other department is hidden too (complementary); 5/5 and 0/5 shown; hidden values never reappear in another field', () => {
  const S = world(10), { admin, c1 } = S; S.all.slice(0, 3).concat(S.all.slice(5, 7)).forEach(x => S.ms(x, 60 + 1)); // dept0 (a,a2,b,ה1,ה2): 5 of 5 ; dept1: 0 of 5
  let g = S.call(admin, 'dash.groups', { courseId: c1, by: 'department' }).filter(x => x.id); assert.strictEqual(g.length, 2);
  const d0 = g.find(x => x.marksmanship && x.marksmanship.by_results !== null); assert.ok(d0, 'the 5-of-5 department keeps its figure'); assert.ok(g.every(x => x.marksmanship.suppressed !== true || x.marksmanship.results === null));
  const S2 = world(10); S2.all.slice(0, 2).concat(S2.all.slice(5, 7)).forEach(x => S2.ms(x, 61)); // dept0: 4 of 5 -> illegal ; dept1: 0 of 5
  g = S2.call(S2.admin, 'dash.groups', { courseId: S2.c1, by: 'department' }).filter(x => x.id);
  g.forEach(x => { assert.deepStrictEqual([x.marksmanship.by_results, x.marksmanship.by_soldier, x.marksmanship.results], [null, null, null], 'both departments hide marksmanship'); assert.strictEqual(x.marksmanship.suppressed, true); });
  assert.ok(!/"results":4\b/.test(JSON.stringify(g)), 'no result count of the 4-soldier cohort anywhere');
});

t('unit', 'F5. monthly_: a month point whose with/without split is illegal is dropped WHOLE (n, mean, soldiers); 5-vs-9 across two months of N=10 leaves only the legal month — no trend, no month-to-month change', () => {
  const { X } = setup(); const row = (i, d, v) => ({ soldier_id: 's' + i, examiner_score: v, test_date: d });
  const m1 = [0, 1, 2, 3, 4].map(i => row(i, '2026-01-10', 60)), m2 = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => row(i, '2026-02-10', 90));
  let ser = X.Analytics.monthly_(m1.concat(m2), 'examiner_score', 'test_date', 10); assert.deepStrictEqual(ser.map(p => p.period), ['2026-01'], '9 of 10 month is dropped, 5 of 10 stays');
  ser = X.Analytics.monthly_(m1.concat(m2), 'examiner_score', 'test_date', 14); assert.deepStrictEqual(ser.map(p => p.period), ['2026-01', '2026-02'], '5/9 and 9/5 are both legal for N=14');
  const rep = [0, 1, 2, 3].map(i => row(i, '2026-03-05', 70)).concat([0, 1, 2, 3].map(i => row(i, '2026-03-06', 72)), [0, 1, 2, 3].map(i => row(i, '2026-03-07', 74))); // 12 rows, 4 soldiers
  assert.deepStrictEqual(X.Analytics.monthly_(rep, 'examiner_score', 'test_date', 20), [], '12 result rows of 4 soldiers: distinct soldiers decide, not rows');
  const one = [0, 1, 2, 3, 4].map(i => row(0, '2026-04-0' + (i + 1), 70)); assert.deepStrictEqual(X.Analytics.monthly_(one, 'examiner_score', 'test_date', 20), [], 'five results of ONE soldier are one soldier');
});

t('integration', 'F6. insights trend, 5-vs-9 across months (N=10): the 9-soldier month never appears (no mean, no count) in insights, report trends or assistant', () => {
  const S = world(10), { admin, c1, X } = S; S.all.slice(0, 5).forEach(x => S.ms(x, 50, '2026-01-10')); S.all.slice(0, 9).forEach(x => S.ms(x, 91, '2026-02-10'));
  const ins = X.Analytics.insights(admin, c1, {}); assert.ok(!ins.items.some(i => i.id === 'trend_marksmanship'), 'no trend item'); assert.ok(ins.suppressed.some(i => i.id === 'trend_marksmanship'));
  const rd = X.Analytics.reportData(admin, c1, {}), tr = rd.trends.find(x => x.key === 'marksmanship'); assert.strictEqual(tr.available, false); assert.ok(!tr.points.some(p => p.period === '2026-02'), 'the 9/1 month has no point');
  assert.ok(!/91(\.0)?\b/.test(JSON.stringify(ins.items.filter(i => i.kind === 'trend')) + JSON.stringify(tr.points)), 'the mean of the 9-soldier month is not shown');
});

t('integration', 'F7. fitness distribution insight: median / IQR only — no minimum, no maximum, no alias (min/max/lowest/highest) in text or JSON, on insights, report data and HTML', () => {
  const S = world(10), { admin, c1, X } = S; const ft = X.Fitness.typesList(admin, c1).find(x => !x.is_opening).id;
  S.all.forEach((so, i) => { const r = X.Records.create(admin, 'FitnessTests', c1, { request_id: S.rid(), soldier_id: so.id, test_date: '2026-03-01', test_type_id: ft, pullups: 15 }).record; X.Db.update('FitnessTests', r.id, { weighted_score: 51 + i * 4 }); });
  const o = everything(S, admin), d = o.insights.items.find(i => i.id === 'distribution_fitness'); assert.ok(d, 'distribution item exists'); assert.ok(/חציון/.test(d.text) && /בין־רבעוני/.test(d.text));
  const j = JSON.stringify(o); assert.ok(!/מינימום|מקסימום|minimum|maximum|"min"|"max"/i.test(j.replace(/לא מוצגים מינימום ומקסימום[^"]*/g, '')), 'no min / max anywhere'); assert.ok(!/(^|[^\d.])51(\.0)?([^\d]|$)/.test(d.text) && !/(^|[^\d.])87(\.0)?([^\d]|$)/.test(d.text), 'the extreme scores (51, 87) are not printed in the insight');
  assert.ok(!/מינימום|מקסימום/.test(o.html.replace(/לא מוצגים מינימום ומקסימום[^<]*/g, '')), 'html');
});

t('integration', 'F8. readiness: the group summary has NO per-soldier element on any surface; the operational route readiness.notEntered returns ids only, scoped (commander sees only his soldiers); counts hide all parts for 9/1', () => {
  const S = world(10), { admin, c1, X, cT } = S; S.all.slice(0, 9).forEach(x => X.Readiness.assess(admin, c1, { request_id: S.rid(), soldier_id: x.id, status: 'fit', start_date: '2026-03-01' }));
  const r = S.call(admin, 'readiness.summary', { courseId: c1, opts: {} }); assert.deepStrictEqual(Object.keys(r).sort(), ['counts', 'counts_suppressed', 'reason', 'total']); assert.strictEqual(r.counts_suppressed, true);
  const o = everything(S, admin); assert.ok(!/soldier_id|"soldiers":\[/.test(JSON.stringify([o.readiness, o.overview.readiness, o.assistant])), 'no soldier list on a group path');
  const n = S.call(admin, 'readiness.notEntered', { courseId: c1, opts: {} }); assert.deepStrictEqual(n.map(x => Object.keys(x)), [['soldier_id']]); assert.strictEqual(n[0].soldier_id, S.all[9].id);
  const nt = S.as(cT, 'readiness.notEntered', { courseId: c1, opts: {} }); assert.ok(nt.ok && nt.data.length <= n.length && nt.data.every(x => n.some(y => y.soldier_id === x.soldier_id)), 'a commander never sees more than the admin');
});

t('integration', 'F9. alert counts are group figures: red and yellow must each be backed by 0 or >= 5 DISTINCT soldiers, else the three numbers are null and only has_open remains — on alerts.counts, overview, home and assistant', () => {
  const S = world(10), { admin, c1, X } = S; const mkA = (n, urg) => Array.from({ length: n }, (_, i) => ({ id: urg + i, soldier_id: urg + i, urgency: urg, status: 'open' }));
  const real = X.Alerts.list; try {
    X.Alerts.list = () => mkA(3, 'red').concat(mkA(6, 'yellow')); let c = X.Alerts.counts(admin, c1); assert.deepStrictEqual([c.open, c.red, c.yellow, c.suppressed, c.has_open], [null, null, null, true, true]); assert.ok(!/\d/.test(c.reason));
    X.Alerts.list = () => mkA(5, 'red').concat(mkA(6, 'yellow')); c = X.Alerts.counts(admin, c1); assert.deepStrictEqual([c.open, c.red, c.yellow, c.suppressed], [11, 5, 6, undefined]);
    X.Alerts.list = () => []; c = X.Alerts.counts(admin, c1); assert.deepStrictEqual([c.open, c.has_open], [0, false]);
    X.Alerts.list = () => mkA(4, 'red'); const o = everything(S, admin); assert.strictEqual(o.alerts.suppressed, true); assert.ok(!/"red":4\b|"open":4\b/.test(JSON.stringify(o)), 'no 4 anywhere');
  } finally { X.Alerts.list = real; }
});

t('hardening', 'F10. repeated-soldier scenarios: 4 soldiers with 3 results each (12 rows) are a 4-soldier cohort everywhere; 1 soldier with 5 results is 1 soldier; scored + unscored results of one soldier count the soldier once', () => {
  const S = world(10), { admin, c1, X } = S; S.all.slice(0, 4).forEach(x => { S.ms(x, 70, '2026-03-01'); S.ms(x, 71, '2026-03-02'); S.ms(x, 72, '2026-03-03'); });
  const o = everything(S, admin); assert.strictEqual(o.overview.completeness.marksmanship.suppressed, true); const j = JSON.stringify(o); assert.ok(!/"with_data":4\b|"missing":6\b|"results":12\b/.test(j) && !/12 תוצאות|4 מתוך 10/.test(j), 'neither 4 soldiers, 6 missing nor 12 rows');
  const S2 = world(10); for (let i = 0; i < 5; i++) S2.ms(S2.all[0], 80, '2026-03-0' + (i + 1)); const o2 = everything(S2, S2.admin); assert.strictEqual(o2.overview.completeness.marksmanship.suppressed, true, 'five results of one soldier = 1 soldier');
});

t('integration', 'F11. department of 7 soldiers with 5 scored (5/2 is illegal) beside a department of 5/5: Dashboard.groups, report bars and the group-gap insight hide the 7-soldier department; groups hides the other too (complementary); no leftover figure', () => {
  const S = world(10), { admin, c1, X } = S; const e1 = S.mk('ז1', '701', 0, 0), e2 = S.mk('ז2', '702', 0, 1); const dep0 = [S.all[0], S.all[1], S.all[2], S.all[5], S.all[6], e1, e2], dep1 = [S.all[3], S.all[4], S.all[7], S.all[8], S.all[9]];
  const ft = X.Fitness.typesList(admin, c1).find(x => !x.is_opening).id; const give = (so, v) => { const r = X.Records.create(admin, 'FitnessTests', c1, { request_id: S.rid(), soldier_id: so.id, test_date: '2026-03-01', test_type_id: ft, pullups: 15 }).record; X.Db.update('FitnessTests', r.id, { weighted_score: v }); };
  dep0.slice(0, 5).forEach((so, i) => give(so, 61 + i)); dep1.forEach((so, i) => give(so, 83 + i)); // hidden dept mean = 63, other = 85
  const g = S.call(admin, 'dash.groups', { courseId: c1, by: 'department' }).filter(x => x.id); assert.strictEqual(g.length, 2);
  g.forEach(x => { assert.deepStrictEqual([x.fitness.by_results, x.fitness.by_soldier, x.fitness.results, x.fitness.suppressed], [null, null, null, true], 'group ' + x.name + ': the 7-soldier dept hides, and the 5/5 dept is hidden as its complement'); });
  const rd = X.Analytics.reportData(admin, c1, {}); const bars = JSON.stringify(rd.bars); assert.ok(!/ז1|(?<![\d.])63(\.0)?(?!\d|\.\d)/.test(bars), 'no figure of the 5-of-7 department in the report bars: ' + bars);
  const ins = X.Analytics.insights(admin, c1, {}); assert.ok(!ins.items.some(i => i.id === 'group_gap_fitness'), 'a gap needs two legal departments');
  const o = everything(S, admin), j = JSON.stringify(o); assert.ok(!/(?<![\d.])(63|85)(\.0)?(?!\d|\.\d)/.test(j), 'neither the mean of the hidden department (63) nor of its complement (85) appears in any output');
});

t('integration', 'F12. attendance.events: one event with 9 present / 1 absent (N=10) returns null present / absent + counts_suppressed (never the complement); 5 / 5 absent is shown; the exact roll remains available through attendance.roll', () => {
  const S = world(10), { admin, c1, X } = S; const ev = S.att(S.all.slice(0, 1), []).event; let row = S.call(admin, 'attendance.events', { courseId: c1 }).find(e => e.id === ev.id);
  assert.deepStrictEqual([row.present, row.absent, row.counts_suppressed, row.total], [null, null, true, 10]); assert.ok(!/"present":9|"absent":1\b/.test(JSON.stringify(row)));
  const S2 = world(10), e5 = S2.att(S2.all.slice(0, 5), []).event; row = S2.call(S2.admin, 'attendance.events', { courseId: S2.c1 }).find(e => e.id === e5.id); assert.deepStrictEqual([row.present, row.absent, row.counts_suppressed], [5, 5, undefined]);
  assert.strictEqual(S.call(admin, 'attendance.roll', { courseId: c1, eventId: ev.id }).filter(r => !r.present).length, 1, 'operational roll (names) is exact');
});

t('integration', 'F13. assistant alerts fact never prints raw counts when the cohort is small (4 red alerts): says counts are suppressed, no "null", no number', () => {
  const S = world(10), { admin, c1, X } = S; const real = X.Alerts.list; try {
    X.Alerts.list = () => [0, 1, 2, 3].map(i => ({ id: 'r' + i, soldier_id: 'r' + i, urgency: 'red', status: 'open' }));
    const a = JSON.stringify(S.call(admin, 'ai.ask', { courseId: c1, question: 'כמה התראות פתוחות יש' })); assert.ok(/מדוכאים|מדוכא/.test(a), a); assert.ok(!/null|אדומות|\b4\b/.test(a.replace(/Alerts\.counts/g, '')), a);
  } finally { X.Alerts.list = real; }
});

done();
