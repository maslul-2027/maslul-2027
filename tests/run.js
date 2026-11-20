const { load } = require('./harness');
const assert = require('assert');
let pass = 0, fail = 0; const failures = [];
function t(name, fn) { try { fn(); pass++; console.log('PASS', name); } catch (e) { fail++; failures.push(name); console.log('FAIL', name, '\n   ', e.message); } }
function throwsCode(fn, code) {
  try { fn(); } catch (e) { assert.strictEqual(e.code, code, 'expected ' + code + ' got ' + e.code + ' ' + e.message); return; }
  assert.fail('expected throw ' + code);
}

// ---------- pure calculations ----------
{
  const X = load(); const C = X.Calc;
  t('nav: approved example 4/5 + 5/5 + 2/3 = 69', () => {
    const n = C.navNormalize({ distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 });
    assert.ok(Math.abs(C.navCompute(n).final_score - 69) < 1e-9);
  });
  t('nav: points_total=0 rejected', () => throwsCode(() => C.navNormalize({ distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 0, points_total: 0 }), 'VALIDATION'));
  t('nav: completed>total rejected', () => throwsCode(() => C.navNormalize({ distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 4, points_total: 3 }), 'VALIDATION'));
  t('nav: distance not multiple of 0.5 rejected', () => throwsCode(() => C.navNormalize({ distance_km: 3.2, plan_score: 4, debrief_score: 5, points_completed: 1, points_total: 3 }), 'VALIDATION'));
  t('nav: plan>5 rejected', () => throwsCode(() => C.navNormalize({ distance_km: 3, plan_score: 6, debrief_score: 5, points_completed: 1, points_total: 3 }), 'VALIDATION'));
  t('nav: max = 100', () => { const n = C.navNormalize({ distance_km: 1, plan_score: 5, debrief_score: 5, points_completed: 7, points_total: 7 }); assert.strictEqual(C.navCompute(n).final_score, 100); });
  t('nav: blank plan is not silently 0', () => throwsCode(() => C.navNormalize({ distance_km: 3, plan_score: '', debrief_score: 5, points_completed: 1, points_total: 3 }), 'VALIDATION'));
  t('march total km', () => assert.strictEqual(C.marchNormalize({ km_no_stretcher: 6.5, km_stretcher: 2 }).total_km, 8.5));
  t('trap bar: the old formula is gone (the score comes from the gender-specific table, see v103_fitness.js)', () => { assert.strictEqual(C.trapBarScore, undefined); });
  t('exam: A=80 => passed, no meeting', () => { const r = C.examEvaluate({ A: 80 }); assert.strictEqual(r.status, 'passed'); assert.strictEqual(r.meeting_required, false); });
  t('exam: A=79 => pending_B', () => assert.strictEqual(C.examEvaluate({ A: 79 }).status, 'pending_B'));
  t('exam: B passes => weighted 0.7B+0.3A', () => { const r = C.examEvaluate({ A: 60, B: 90 }); assert.ok(Math.abs(r.weighted_score - (0.7 * 90 + 0.3 * 60)) < 1e-9); assert.strictEqual(r.pass_attempt, 'B'); });
  t('exam: B fails => pending_C + meeting required', () => { const r = C.examEvaluate({ A: 60, B: 70 }); assert.strictEqual(r.status, 'pending_C'); assert.strictEqual(r.meeting_required, true); });
  t('exam: C passes after B fail => meeting STILL required, C replaces B', () => { const r = C.examEvaluate({ A: 60, B: 70, C: 85 }); assert.strictEqual(r.status, 'passed'); assert.strictEqual(r.meeting_required, true); assert.ok(Math.abs(r.weighted_score - (0.7 * 85 + 0.3 * 60)) < 1e-9); });
  t('exam: weighted <80 yet attempt passed => passed (per-attempt)', () => { const r = C.examEvaluate({ A: 20, B: 80 }); assert.strictEqual(r.status, 'passed'); assert.ok(r.weighted_score < 80); });
  t('exam: all fail => failed', () => assert.strictEqual(C.examEvaluate({ A: 50, B: 50, C: 50 }).status, 'failed'));
  t('exam: missing A => incomplete, no fabricated score', () => { const r = C.examEvaluate({}); assert.strictEqual(r.status, 'incomplete'); assert.strictEqual(r.weighted_score, null); });
  t('exam: score 101 rejected', () => throwsCode(() => C.examEvaluate({ A: 101 }), 'VALIDATION'));
  t('fitness weighting: missing component => null total', () => { const r = C.weightedFitness({ pull: 80, bars: null, trap: 100, run: 90 }, { pull: 20, bars: 20, trap: 20, run: 40 }); assert.strictEqual(r.score, null); assert.strictEqual(JSON.stringify(r.missing), '["bars"]'); });
  t('fitness weighting: opening weights', () => { const r = C.weightedFitness({ pull: 80, bars: 70, trap: 100, run: 90 }, { pull: 20, bars: 20, trap: 20, run: 40 }); assert.ok(Math.abs(r.score - (16 + 14 + 20 + 36)) < 1e-9); });
  t('fitness weighting: regular weights', () => { const r = C.weightedFitness({ pull: 100, bars: 100, trap: 100, r150: 100, run: 100 }, { pull: 20, bars: 20, trap: 20, r150: 10, run: 30 }); assert.strictEqual(r.score, 100); });
  t('pzm: approved bands', () => { assert.strictEqual(C.pzmFromMonths(4).label, 'ת׳'); assert.strictEqual(C.pzmFromMonths(6).label, 'ת׳+0.5'); assert.strictEqual(C.pzmFromMonths(8).label, 'ת׳+1'); assert.strictEqual(C.pzmFromMonths(10).label, 'ת׳+1.5'); assert.strictEqual(C.pzmFromMonths(12).label, 'ת׳+2'); });
  t('pzm: 3 months is UNVERIFIED (not invented)', () => assert.strictEqual(C.pzmFromMonths(3).status, 'unverified'));
  t('pzm: <3 / >12 flagged', () => { assert.strictEqual(C.pzmFromMonths(2).status, 'anomaly_low'); assert.strictEqual(C.pzmFromMonths(13).status, 'anomaly_high'); });
  t('mean skips null (missing != 0)', () => assert.strictEqual(C.mean([80, null, undefined, 100]), 90));
  t('mean of nothing => null', () => assert.strictEqual(C.mean([]), null));
  t('attendance percent', () => { const r = C.attendancePercent([{ present: true }, { present: true }, { present: false }, { present: true }]); assert.strictEqual(r.percent, 75); assert.strictEqual(r.absent, 1); });
  t('attendance no records => null', () => assert.strictEqual(C.attendancePercent([]), null));
}

// ---------- scoring engine ----------
{
  const X = load(); const S = X.Scoring;
  const draft = { status: 'DRAFT', kind: 'reps', rows: [{ score: 100, reps_min: 20, reps_max: 20 }] };
  const ok = { status: 'APPROVED', kind: 'reps', rows: [{ score: 100, reps_min: 20, reps_max: 20 }, { score: 95, reps_min: 19, reps_max: 19 }, { score: 90, reps_min: 17, reps_max: 18 }] };
  const time = { status: 'APPROVED', kind: 'time', rows: [{ score: 100, from_sec: null, to_sec: 650 }, { score: 99, from_sec: 651, to_sec: 700 }, { score: 98, from_sec: 701, to_sec: null }] };
  t('scoring: DRAFT table blocks calculation', () => throwsCode(() => S.lookup(draft, 20), 'SCORING_NOT_APPROVED'));
  t('scoring: reps lookup incl. ranges', () => { assert.strictEqual(S.lookup(ok, 18), 90); assert.strictEqual(S.lookup(ok, 17), 90); assert.strictEqual(S.lookup(ok, 20), 100); });
  t('scoring: outside table => OUT_OF_RANGE (no guess)', () => { throwsCode(() => S.lookup(ok, 0), 'OUT_OF_RANGE'); throwsCode(() => S.lookup(ok, 25), 'OUT_OF_RANGE'); });
  t('scoring: blank => null', () => assert.strictEqual(S.lookup(ok, ''), null));
  t('scoring: time boundaries inclusive + open ends', () => { assert.strictEqual(S.lookup(time, '10:50'), 100); assert.strictEqual(S.lookup(time, '10:51'), 99); assert.strictEqual(S.lookup(time, '30:00'), 98); assert.strictEqual(S.lookup(time, '05:00'), 100); });
  t('scoring: bad time string rejected', () => throwsCode(() => S.lookup(time, '10:75'), 'VALIDATION'));
  t('scoring: contiguity detects a gap', () => { const bad = { kind: 'reps', rows: [{ score: 100, reps_min: 20, reps_max: 20 }, { score: 90, reps_min: 17, reps_max: 18 }] }; assert.ok(S.checkContiguity(bad).length > 0); });
  t('scoring: contiguity passes on valid', () => assert.strictEqual(JSON.stringify(S.checkContiguity(ok)), '[]'));
}

// ---------- policy matrix ----------
{
  const X = load(); const P = X.Policy;
  const admin = { email: 'a@x.com', role: 'admin', courseScope: '*' }, cmd = { email: 'c@x.com', role: 'commander', courseScope: ['c1'] };
  t('policy: unauthenticated denied', () => assert.strictEqual(P.check(null, 'result.read', { courseId: 'c1' }).code, 'UNAUTHENTICATED'));
  t('policy: commander denied admin-only actions', () => ['result.edit', 'result.cancel', 'result.restore', 'private.read', 'audit.read', 'backup.restore', 'correction.review'].forEach(a => assert.strictEqual(P.check(cmd, a, { courseId: 'c1' }).code, 'FORBIDDEN', a)));
  t('policy: commander can create/read in own course', () => { assert.ok(P.check(cmd, 'result.create', { courseId: 'c1' }).ok); assert.ok(P.check(cmd, 'result.read', { courseId: 'c1' }).ok); });
  t('policy: commander out-of-scope course denied', () => assert.strictEqual(P.check(cmd, 'result.read', { courseId: 'c2' }).code, 'FORBIDDEN'));
  t('policy: archived blocks writes even for admin', () => assert.strictEqual(P.check(admin, 'result.create', { courseId: 'c1', courseStatus: 'archived' }).code, 'COURSE_ARCHIVED'));
  t('policy: archived allows reads and reopen', () => { assert.ok(P.check(admin, 'result.read', { courseId: 'c1', courseStatus: 'archived' }).ok); assert.ok(P.check(admin, 'course.reopen', { courseId: 'c1', courseStatus: 'archived' }).ok); });
  t('policy: commander archived => blocked', () => assert.strictEqual(P.check(cmd, 'result.create', { courseId: 'c1', courseStatus: 'archived' }).code, 'COURSE_ARCHIVED'));
  t('policy: correction.request only by record owner', () => { assert.ok(P.check(cmd, 'correction.request', { courseId: 'c1', ownerEmail: 'c@x.com' }).ok); assert.strictEqual(P.check(cmd, 'correction.request', { courseId: 'c1', ownerEmail: 'other@x.com' }).code, 'FORBIDDEN'); });
  t('policy: unknown role denied', () => assert.strictEqual(P.check({ email: 'z@x.com', role: 'soldier' }, 'result.read', { courseId: 'c1' }).code, 'FORBIDDEN'));
}

console.log('\nTOTAL pass=%d fail=%d', pass, fail);
if (fail) { console.log('FAILED:', failures.join(' | ')); process.exit(1); }
