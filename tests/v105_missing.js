// v1.0.5 — missing / invalid values are NEVER zero, in every consumer (Snapshot, dashboard KPI, group comparison, course comparison, trends, strengths/gaps, alerts, completeness, reports, soldier summaries).
// Two groups: (1) unit — the shared definition Calc.validNumber and Snapshot.mean_ over every kind of non-value; (2) integration — a corrupted score cell (null / '' / whitespace / text / false / NaN) must change NOTHING downstream
// compared with the row simply not having a score. A real 0 stays a valid score (tested separately).
const { suite } = require(process.env.TLIB || './tlib'); const { t, done, assert } = suite('v105_missing.js'); const { setup } = require('./fixture');
const BAD = [null, undefined, '', '   ', '\t', 'abc', '85abc', 'NaN', false, true, NaN, Infinity, -Infinity, {}, []];
const close = (a, b) => Math.abs(a - b) < 1e-9;

t('unit', '1. Calc.validNumber: only real numbers (or numeric text) are values; every kind of non-value is null; real 0 is valid', () => {
  const S = setup(), { X } = S; BAD.forEach(v => assert.strictEqual(X.Calc.validNumber(v), null, 'bad value accepted: ' + JSON.stringify(v) + ' (' + typeof v + ')'));
  assert.strictEqual(X.Calc.validNumber(0), 0); assert.strictEqual(X.Calc.validNumber('0'), 0); assert.strictEqual(X.Calc.validNumber(' 85 '), 85); assert.strictEqual(X.Calc.validNumber('85.5'), 85.5); assert.strictEqual(X.Calc.validNumber(100), 100);
  assert.strictEqual(X.Calc.hasScore(0), true); BAD.forEach(v => assert.strictEqual(X.Calc.hasScore(v), false));
});
t('unit', '2. Snapshot.mean_ / Calc.mean: mean over valid values only; all-invalid => null (not 0); a real 0 IS averaged', () => {
  const S = setup(), { X } = S;
  BAD.forEach(b => { const rows = [{ s: 80 }, { s: b }, { s: 60 }]; assert.ok(close(X.Snapshot.mean_(rows, 's'), 70), 'mean with ' + JSON.stringify(b) + ' = ' + X.Snapshot.mean_(rows, 's')); assert.strictEqual(X.Snapshot.mean_([{ s: b }], 's'), null, 'only ' + JSON.stringify(b)); });
  assert.strictEqual(X.Snapshot.mean_([], 's'), null); assert.strictEqual(X.Snapshot.mean_([{}, {}], 's'), null, 'field missing entirely');
  assert.ok(close(X.Snapshot.mean_([{ s: 0 }, { s: 100 }], 's'), 50), 'a real zero is a score'); assert.ok(close(X.Snapshot.mean_([{ s: '0' }, { s: 100 }], 's'), 50));
  BAD.forEach(b => assert.ok(close(X.Calc.mean([80, b, 60]), 70))); assert.strictEqual(X.Calc.mean([null, '', undefined]), null);
});

// ---------- integration over the three scored domains ----------
const DOM = { nav: { table: 'NavigationTests', field: 'final_score', ov: o => o.navigation.mean, grp: 'navigation', tr: 'navigation', low: 'low.nav' },
  fit: { table: 'FitnessTests', field: 'weighted_score', ov: o => o.fitness.mean, grp: 'fitness', tr: 'fitness', low: 'low.fitness' },
  mk: { table: 'MarksmanshipTests', field: 'examiner_score', ov: o => o.marksmanship.regular.mean, grp: 'marksmanship', tr: 'marksmanship', low: 'low.marksmanship' } };
function seed(dom, bad) {
  const S = setup(), { X, admin, c1, S: sol } = S; const nt = X.Navigation.typeCreate(admin, c1, 'א').id; const D = DOM[dom], ids = {};
  const mkRec = (so, date) => {
    if (dom === 'nav') return X.Records.create(admin, 'NavigationTests', c1, { request_id: S.rid(), soldier_id: so.id, test_date: date, navigation_type_id: nt, distance_km: 3, plan_score: 3, debrief_score: 2, points_completed: 3, points_total: 3 }).record;
    if (dom === 'mk') return X.Records.create(admin, 'MarksmanshipTests', c1, { request_id: S.rid(), soldier_id: so.id, test_date: date, weapon_type: 'M16', distance_m: 100, examiner_score: 50, weapon_zeroed: true }).record;
    return X.Records.create(admin, 'FitnessTests', c1, { request_id: S.rid(), soldier_id: so.id, test_date: date, test_type_id: X.Fitness.typesList(admin, c1).find(x => !x.is_opening).id, pullups: 15 }).record;
  };
  const set = (rec, v) => X.Db.update(D.table, rec.id, { [D.field]: v });
  const a = mkRec(sol.a, '2026-03-01'), b = mkRec(sol.b, '2026-03-01'), c1r = mkRec(sol.c, '2026-03-01'), c2r = mkRec(sol.c, '2026-03-02');
  set(a, 80); set(b, 60); set(c1r, 90); set(c2r, bad);   // soldier C: one valid 90, then a corrupt/blank cell. Soldiers a2 and d have no record at all.
  Object.assign(S, { dom: D, a, b, c1r, c2r, set, ids }); return S;
}
const VARIANTS = [null, '', '   ', 'abc', false, NaN];   // undefined is covered by the unit tests (Db.update ignores an undefined patch value, so it cannot be stored)
const lbl = v => JSON.stringify(v === undefined ? 'undefined' : (typeof v === 'number' && isNaN(v) ? 'NaN' : v));
['nav', 'fit', 'mk'].forEach(dom => VARIANTS.forEach(bad => {
  t('integration', '3[' + dom + '] corrupt score cell ' + lbl(bad) + ' counts as NO score everywhere (KPI, groups, trends, strengths/gaps, alerts, completeness, soldier summary, report)', () => {
    const S = seed(dom, bad), { X, admin, c1, S: sol } = S, D = S.dom;
    // KPI over the whole course: (80+60+90)/3 — a zero would give 57.5
    const o = X.Dashboard.overview(admin, c1, {});
    // D2 sub-cohort rule (REV3): only 3 of 5 soldiers have a score => the dashboard figure and the score-availability counts are suppressed; the DEFINITION (corrupt cell = no score) is verified on the pure aggregate and on distinct soldiers
    const rawRows = dom === 'nav' ? X.Snapshot.navigationRows(admin, c1, { onlyActive: true }) : X.Snapshot.rows(admin, D.table, c1, { onlyActive: true });
    const rawMean = dom === 'nav' ? X.Navigation.aggregate_(rawRows).mean : (dom === 'fit' ? X.Fitness.aggregate_(rawRows).mean : X.Marksmanship.aggregate_(rawRows).regular.mean);
    assert.strictEqual(D.ov(o), null, 'D2: suppressed, not shown'); assert.ok(close(rawMean, 230 / 3), 'pure mean ' + rawMean);
    // completeness: 3 soldiers with a SCORE out of 5 (C has two records, one unscored; a2 and d have none) — never "4 with data" by counting the unscored cell as a score
    const cm = o.completeness[D.grp]; assert.strictEqual(X.Analytics.distinct_(rawRows, r => X.Calc.hasScore(r[D.field])), 3, 'distinct soldiers with a SCORE (the corrupt cell is not one)'); assert.deepStrictEqual([cm.with_score, cm.missing_score, cm.score_suppressed], [null, null, true], 'D2: 3 / 2 split of 5 => both counts suppressed');
    // group comparison, BOTH methods: dept0 = A,B => 70 ; dept1 = C => 90 (a zero would give 45)
    const g = X.Dashboard.groupsRaw_(admin, c1, 'department', {}); const g0 = g.find(x => x.soldiers && x[D.grp].by_results !== null && close(x[D.grp].by_results, 70)), g1 = g.find(x => x[D.grp].by_results !== null && close(x[D.grp].by_results, 90));
    assert.ok(g0, 'dept 0 mean must be 70: ' + JSON.stringify(g.map(x => x[D.grp]))); assert.ok(g1, 'dept 1 mean must be 90'); assert.ok(close(g1[D.grp].by_soldier, 90), 'by_soldier dept1'); assert.ok(close(g0[D.grp].by_soldier, 70), 'by_soldier dept0');
    // trend of C: ONE valid point => no trend, no change (a zero would fake a drop of 90)
    const tr = X.Dashboard.trends(admin, c1, sol.c.id)[D.tr]; assert.strictEqual(tr.points.length, 1); assert.strictEqual(tr.trend_available, false); assert.strictEqual(tr.change, null); assert.strictEqual(tr.points[0].value, 90);
    // alerts: low threshold 70 + trend drop 5 — only B (mean 60) is low; C (mean 90) must NOT be low and must NOT show a "drop"
    X.Settings.set(admin, c1, D.low, 70, '2000-01-01', 'בדיקה'); X.Settings.set(admin, c1, 'trend.drop_points', 5, '2000-01-01', 'בדיקה');
    const cand = X.Alerts.candidates_(admin, c1, X.Util.todayIso()); const lows = cand.filter(x => x.rule_key === D.low), drops = cand.filter(x => x.rule_key === 'trend.drop.' + D.low.slice(4));
    assert.deepStrictEqual(lows.map(x => x.soldier_id), [sol.b.id], 'only B is low'); assert.strictEqual(drops.length, 0, 'no fake drop');
    // strengths / gaps for C with evidence.min_records 1: mean 90 is not a gap
    X.Settings.set(admin, c1, 'evidence.min_records', 1, '2000-01-01', 'בדיקה'); const sg = X.Dashboard.strengthsGaps(admin, c1, sol.c.id); assert.ok(!sg.gaps.some(x => x.domain === D.grp), 'C must not be a gap: ' + JSON.stringify(sg.gaps));
    const sgi = sg.strengths.concat(sg.gaps).find(x => x.domain === D.grp); if (sgi) { assert.strictEqual(sgi.count, 1); assert.ok(close(sgi.mean, 90)); }
    // evidence count: an unscored record is NOT evidence. C has 1 valid + 1 unscored record; with min_records = 2 and a high 'low' threshold C must NOT be reported (1 valid < 2), neither as a gap nor as anything else
    X.Settings.set(admin, c1, 'evidence.min_records', 2, '2000-01-02', 'בדיקה'); X.Settings.set(admin, c1, D.low, 95, '2000-01-02', 'בדיקה'); const sg2 = X.Dashboard.strengthsGaps(admin, c1, sol.c.id);
    assert.ok(!sg2.gaps.concat(sg2.strengths).some(x => x.domain === D.grp), 'unscored record must not count as evidence: ' + JSON.stringify(sg2));
    // reports: the unscored cell is empty / waiting text, never 0 / false / null text
    const sec = { nav: 'navigation', fit: 'fitness', mk: 'marksmanship' }[dom]; const rows = X.Reports.tables_(admin, c1, [sec], {}, false)[0].rows;
    rows.forEach(r => r.forEach(cell => { assert.ok(cell !== 0 && cell !== '0' && cell !== false && cell !== null && cell !== undefined && cell !== 'NaN', 'report cell ' + JSON.stringify(cell)); }));
    // per-soldier summaries
    if (dom === 'fit') { const sm = X.Fitness.summary(admin, c1, sol.c.id); assert.strictEqual(sm.complete_count, 1); assert.ok(close(sm.mean, 90)); assert.strictEqual(sm.last, 90); assert.strictEqual(sm.progress, null); }
    if (dom === 'mk') { const sm = X.Marksmanship.summary(admin, c1, sol.c.id); assert.strictEqual(sm.regular.count, 1); assert.ok(close(sm.regular.mean, 90)); assert.strictEqual(sm.regular.last, 90); }
  });
}));

t('integration', '4. a soldier with ONLY unscored records: every mean is null (not 0), no alert, no gap, health index null with a reason, completeness counts him as without score', () => {
  VARIANTS.forEach(bad => ['nav', 'fit', 'mk'].forEach(dom => {
    const S = seed(dom, bad), { X, admin, c1, S: sol } = S, D = S.dom; [S.a, S.b, S.c1r].forEach(r => S.set(r, bad));   // EVERY row is unscored
    const o = X.Dashboard.overview(admin, c1, {}); assert.strictEqual(D.ov(o), null, dom + ' ' + lbl(bad) + ' overview mean'); const rr4 = dom === 'nav' ? X.Snapshot.navigationRows(admin, c1, { onlyActive: true }) : X.Snapshot.rows(admin, D.table, c1, { onlyActive: true }); assert.strictEqual(X.Analytics.distinct_(rr4, r => X.Calc.hasScore(r[D.field])), 0, 'no soldier has a score'); assert.strictEqual(o.completeness[D.grp].with_score, null, 'D2: 3 soldiers with records, 0 scored => the score split is suppressed (never reported as a count)');
    const g = X.Dashboard.groupsRaw_(admin, c1, 'department', {}); g.forEach(x => { assert.strictEqual(x[D.grp].by_results, null); assert.strictEqual(x[D.grp].by_soldier, null); });
    X.Settings.set(admin, c1, D.low, 99, '2000-01-01', 'בדיקה'); assert.strictEqual(X.Alerts.candidates_(admin, c1, X.Util.todayIso()).filter(x => x.rule_key === D.low).length, 0, 'no low alert from missing data');
    X.Settings.set(admin, c1, 'health.weights', { [D.grp]: 100 }, '2000-01-01', 'בדיקה'); const h = X.Dashboard.overview(admin, c1, {}).health; assert.strictEqual(h.index, null); assert.ok(h.reason && h.reason.length > 0);
    const cmp = X.Dashboard.compareCourses(admin, [c1, S.c2]); cmp.forEach(r => assert.ok(r.suppressed === true /* dev6.2 D2: scope < 5 soldiers */ || { nav: r.navigation, fit: r.fitness, mk: r.marksmanship }[dom] === null, 'course comparison ' + dom + ' must be null, got ' + JSON.stringify(r)));
    const home = X.Dashboard.home(admin).courses.find(c => c.course_id === c1); const shown = { nav: home.navigation_mean, fit: home.fitness_mean }[dom]; if (dom !== 'mk') assert.ok(shown === null || shown === '' || shown === undefined || /אין|—|^$/.test(String(shown)), 'home card shows ' + JSON.stringify(shown));
  }));
});
t('integration', '5. a real 0 is a valid score and IS counted (the guard distinguishes "0" from "missing")', () => {
  const S = seed('mk', 0), { X, admin, c1 } = S;   // rows: A 80, B 60, C 90, C 0
  const rr5 = X.Snapshot.rows(admin, 'MarksmanshipTests', c1, { onlyActive: true }), m5 = X.Marksmanship.aggregate_(rr5).regular.mean; assert.ok(close(m5, (80 + 60 + 90 + 0) / 4), String(m5)); assert.strictEqual(X.Analytics.distinct_(rr5, r => X.Calc.hasScore(r.examiner_score)), 3);   // pure maths; the dashboard itself suppresses a 3-of-5 cohort (D2 sub-cohort)
  assert.strictEqual(X.Dashboard.overview(admin, c1, {}).marksmanship.suppressed, true);
  const tr = X.Dashboard.trends(admin, c1, S.S.c.id).marksmanship; assert.strictEqual(tr.points.length, 2); assert.strictEqual(tr.change, -90, 'a real drop to 0 is a real drop');
});
t('integration', '6. completeness distinguishes "has a record" from "has a score" (no soldier is reported as scored because of an empty cell)', () => {
  const S = seed('fit', ''), { X, admin, c1 } = S; const rows6 = () => X.Snapshot.rows(admin, 'FitnessTests', c1, { onlyActive: true }), has6 = () => X.Analytics.distinct_(rows6(), r => X.Calc.hasScore(r.weighted_score)), rec6 = () => X.Analytics.distinct_(rows6());   // D2: the dashboard suppresses 3-of-5 splits; the record/score distinction is checked on the distinct-soldier counts it is built from
  assert.strictEqual(rec6(), 3, 'A,B,C have records'); assert.strictEqual(has6(), 3); assert.strictEqual(X.Dashboard.overview(admin, c1, {}).completeness.fitness.suppressed, true); S.set(S.c1r, ''); const cm2 = X.Dashboard.overview(admin, c1, {}).completeness.fitness;
  assert.strictEqual(rec6(), 3); assert.strictEqual(has6(), 2, 'C has records but no score'); assert.deepStrictEqual([cm2.with_data, cm2.missing, cm2.with_score, cm2.missing_score], [null, null, null, null], 'D2: no counts');
});
done();
