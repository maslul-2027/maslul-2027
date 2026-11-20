// v1.0.4 — independent audit of the fitness data path: an INCOMPLETE fitness result (weighted_score '') must never turn into 0 anywhere downstream
// (dashboard means, trends, per-soldier means, summary, report/export, list), and a complete one must be counted exactly once.
const { suite } = require(process.env.TLIB || './tlib'); const { t, done, assert } = suite('v104_audit.js'); const { setup } = require('./fixture');
const NONE = 'ללא משקל חיצוני';
const S0 = () => {
  const S = setup(); const { X, admin, c1 } = S;
  const types = X.Fitness.typesList(admin, c1); S.regular = types.find(x => !x.is_opening); S.opening = types.find(x => x.is_opening);
  const v = X.Fitness.importDraft(admin, c1, { label: 'v104' }); X.Fitness.approve(admin, v.id, { verified_against_source: true, reason: 'בדיקה' });
  // v1.0.6: no pull-up / parallel-bars track configuration exists any more (boys: fixed vest table)
  S.rec = (sol, date, raw) => X.Records.create(admin, 'FitnessTests', c1, Object.assign({ request_id: S.rid(), soldier_id: sol.id, test_date: date, test_type_id: S.regular.id }, raw)).record;
  return S;
};
const FULL = { pullups: 15, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' };
t('integration', 'A. incomplete result: stored without a weighted score (empty), never 0; complete result gets a real score', () => {
  const S = S0(), { X, admin, c1 } = S; const sol = S.S.a;   // boy
  const inc = S.rec(sol, '2026-11-09', (function(){ const o = Object.assign({}, FULL); delete o.run3km; return o; })()); assert.ok(inc.weighted_score === '' || inc.weighted_score === null, 'incomplete => empty, got ' + JSON.stringify(inc.weighted_score));
  const full = S.rec(sol, '2026-11-10', FULL); assert.strictEqual(Number(full.weighted_score), 90.8, 'boy, vest 7 kg table (hand: 100*.2+100*.2+100*.2+80*.1+76*.3 = 90.8)');
});
t('integration', 'B. dashboard / summary / trends / report ignore the incomplete result (no zero is averaged in)', () => {
  const S = S0(), { X, admin, c1 } = S; const sol = S.S.a;
  S.rec(sol, '2026-11-09', (function(){ const o = Object.assign({}, FULL); delete o.run3km; return o; })()); S.rec(sol, '2026-11-10', FULL);
  const o = X.Dashboard.overview(admin, c1, {}); assert.strictEqual(X.Fitness.aggregate_(X.Snapshot.rows(admin, 'FitnessTests', c1, {})).mean, 90.8, 'mean over the COMPLETE result only (a zero would give 45.4)'); assert.strictEqual(o.fitness.suppressed, true, 'D2 sub-cohort: one scored soldier => the dashboard figure is suppressed, not shown'); assert.strictEqual(o.fitness.mean, null);
  const sm0 = X.Fitness.summary(admin, c1, sol.id), sm = sm0;
  assert.strictEqual(sm.count, 2); assert.strictEqual(sm.complete_count, 1); assert.strictEqual(sm.mean, 90.8); assert.strictEqual(sm.last, 90.8);
  assert.strictEqual(sm.progress, null, 'no progress computed from an incomplete previous result');
  const tr = X.Dashboard.trends(admin, c1, sol.id); assert.strictEqual(tr.fitness.points.length, 1, 'trend: only the complete result is a point');
  const rep = X.Reports.tables_(admin, c1, ['fitness'], {}, false)[0].rows.map(r => r[3]); assert.ok(rep.includes(X.Fitness.WAITING_TEXT), 'report shows the waiting text'); assert.ok(!rep.includes(0) && !rep.includes('0'), 'report never shows 0 for a missing score');
});
t('integration', 'C. only incomplete results: mean is null/empty (not 0) everywhere', () => {
  const S = S0(), { X, admin, c1 } = S; const sol = S.S.a; S.rec(sol, '2026-11-09', { pullups: 15 });
  const sm = X.Fitness.summary(admin, c1, sol.id); assert.strictEqual(sm.complete_count, 0); assert.ok(sm.mean === null || sm.mean === undefined, 'mean=' + sm.mean); assert.strictEqual(sm.note, X.Fitness.WAITING_TEXT);
  const o = X.Dashboard.overview(admin, c1, {}); assert.ok(o.fitness.mean === null || o.fitness.mean === undefined, 'dashboard mean=' + o.fitness.mean);
  const row = X.Fitness.list(admin, c1, {}).find(r => r.soldier_id === sol.id); assert.strictEqual(row.weighted_score, null); assert.strictEqual(row.weighted_display, X.Fitness.WAITING_TEXT);
});
t('integration', 'D. opening vs regular test: weights differ and apply only to their own components (opening has no 300 m)', () => {
  const S = S0(), { X } = S; assert.deepStrictEqual(S.regular.weights, { pullups: 20, parallel_bars: 20, trap_bar: 20, run150x2: 10, run3km: 30 }); assert.deepStrictEqual(S.opening.weights, { pullups: 20, parallel_bars: 20, trap_bar: 20, run3km: 40 });
  const sum = w => Object.values(w).reduce((a, b) => a + b, 0); assert.strictEqual(sum(S.regular.weights), 100); assert.strictEqual(sum(S.opening.weights), 100);
});
t('hardening', 'E. permissions + course isolation: a commander cannot import / approve / change variants / add tables; a version approved in course 1 is never used in course 2', () => {
  const S = S0(), { X, admin, c1, c2, cC, cT, none, code } = S; const ver = X.Fitness.activeVersion_(c1);
  [cC, cT, none].forEach(ctx => {
    assert.strictEqual(code(() => X.Fitness.importDraft(ctx, c1, {})), 'FORBIDDEN');
    assert.strictEqual(code(() => X.Fitness.approve(ctx, ver.id, { verified_against_source: true, reason: 'x' })), 'FORBIDDEN');
    assert.strictEqual(code(() => X.Fitness.typeSetVariant(ctx, S.regular.id, 'pullups', NONE, 'x')), 'FORBIDDEN');
    assert.strictEqual(code(() => X.Fitness.versionsList(ctx, c1)), 'FORBIDDEN');
  });
  assert.strictEqual(X.Fitness.activeVersion_(c2), null, 'course 2 has no approved version of its own => nothing is scored there'); assert.ok(X.Fitness.versionsList(admin, c2).length === 0, 'course 2 sees none of course 1 versions');
});
t('hardening', 'F. a version that is only a DRAFT is never used, and approving requires the explicit verification flag + reason (nothing auto-approves N1-N8)', () => {
  const S = setup(), { X, admin, c1, code } = S; const v = X.Fitness.importDraft(admin, c1, {});
  assert.strictEqual(X.Fitness.activeVersion_(c1), null);
  assert.strictEqual(code(() => X.Fitness.approve(admin, v.id, { reason: 'x' })), 'VALIDATION'); assert.strictEqual(code(() => X.Fitness.approve(admin, v.id, { verified_against_source: true })), 'VALIDATION');
  assert.strictEqual(code(() => X.Fitness.approve(admin, v.id, { verified_against_source: 'true', reason: 'x' })), 'VALIDATION', 'truthy string is not the flag');
  assert.strictEqual(X.Fitness.activeVersion_(c1), null);
});
t('integration', 'G. data-quality report (read-only): counts, soldiers without gender, results scored under another version; commander is refused; nothing is modified', () => {
  const S = S0(), { X, admin, c1, cC, code } = S; const sol = S.S.a;
  const FULLX = Object.assign({}, FULL); S.rec(sol, '2026-11-09', FULLX); S.rec(sol, '2026-11-10', { pullups: 15 });
  const ng = X.Soldiers.create(admin, c1, { full_name: 'ללא מין', personal_number: '9999', gender: 'M', department_id: X.Courses.org(admin, c1).departments[0].id, team_id: X.Courses.org(admin, c1).teams[0].id }); X.Db.update('Soldiers', ng.id, { gender: '' });   // legacy / imported row (the API refuses a missing gender)
  const before = JSON.stringify(X.Db.all('FitnessTests')), q = X.Fitness.dataQuality(admin, c1);
  assert.strictEqual(q.results, 2); assert.strictEqual(q.complete, 1); assert.strictEqual(q.incomplete, 2 - 1); assert.strictEqual(q.scored_under_other_version, 0);
  assert.ok(q.soldiers_without_gender.some(x => x.id === ng.id), 'soldier with no gender is listed'); assert.strictEqual(JSON.stringify(X.Db.all('FitnessTests')), before, 'read-only');
  const v2 = X.Fitness.importDraft(admin, c1, { label: 'v2' }); X.Fitness.approve(admin, v2.id, { verified_against_source: true, reason: 'בדיקה' });
  const q2 = X.Fitness.dataQuality(admin, c1); assert.strictEqual(q2.scored_under_other_version, 1, 'the scored result belongs to the superseded version'); assert.ok(/חשב מחדש/.test(q2.advice));
  assert.strictEqual(code(() => X.Fitness.dataQuality(cC, c1)), 'FORBIDDEN');
});
done();
