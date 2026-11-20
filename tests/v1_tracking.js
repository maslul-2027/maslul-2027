// v1.0.0 tracking modules: settings, fitness (+scoring versions), marksmanship, exams, attendance, marches, readiness, events. Node only (in-memory Db).
const { suite } = require(process.env.TLIB||'./tlib'); const { t, done, assert } = suite('v1_tracking.js'); const { setup } = require('./fixture');
const close = (a, b) => Math.abs(a - b) < 1e-9;
const fitSetup = (opts) => {
  const S = setup(); const { X, admin, c1 } = S; opts = opts || {};
  const types = X.Fitness.typesList(admin, c1); S.opening = types.find(x => x.is_opening); S.regular = types.find(x => !x.is_opening);
  S.mkVersion = () => X.Fitness.importDraft(admin, c1, { label: 'v-test' });   // v1.0.3: the transcription carries an explicit gender per table; nothing is mapped or patched by the test
  S.approve = (v) => X.Fitness.approve(admin, v.id, { verified_against_source: true, reason: 'בדיקה' });
  S.fit = (ctx, soldier, o) => X.Records.create(ctx, 'FitnessTests', c1, Object.assign({ request_id: S.rid(), soldier_id: soldier.id, test_date: '2026-03-01', test_type_id: S.opening.id }, o || {}));
  return S;
};

// ================= settings =================
t('unit', 'settings: spec defaults only (exam 80, alert 7d); every professional threshold is UNSET (never guessed)', () => {
  const { X, admin, c1 } = setup(); const L = X.Settings.list(admin, c1), by = k => L.find(x => x.key === k);
  assert.strictEqual(by('exam.pass_score').value, 80); assert.strictEqual(by('qual.early_alert_days').value, 7);
  ['attendance.min_percent', 'trend.drop_points', 'low.nav', 'low.fitness', 'low.marksmanship', 'level.nav.green_min', 'level.fitness.yellow_min', 'evidence.min_records', 'health.weights'].forEach(k => { assert.strictEqual(by(k).is_set, false, k); assert.strictEqual(by(k).value, null, k); });
  assert.strictEqual(X.Settings.level(c1, 'nav', 70), null, 'no thresholds => no colour');
});
t('integration', 'settings: set with reason + effective date, history kept, latest effective wins, audit before/after; validation of ranges/types/weights', () => {
  const { X, admin, c1, code } = setup();
  assert.strictEqual(code(() => X.Settings.set(admin, c1, 'exam.pass_score', 70, '', '')), 'VALIDATION', 'reason required');
  X.Settings.set(admin, c1, 'exam.pass_score', 70, '2000-01-01', 'שינוי'); assert.strictEqual(X.Settings.get(c1, 'exam.pass_score'), 70);
  X.Settings.set(admin, c1, 'exam.pass_score', 85, '2999-01-01', 'עתידי'); assert.strictEqual(X.Settings.get(c1, 'exam.pass_score'), 70, 'future setting not yet effective');
  assert.strictEqual(X.Settings.get(c1, 'exam.pass_score', '2999-06-01'), 85);
  const h = X.Settings.list(admin, c1).find(x => x.key === 'exam.pass_score').history; assert.strictEqual(h.length, 2);
  const au = X.Db.where('AuditLog', a => a.action === 'SETTING_SET'); assert.strictEqual(au.length, 2); assert.ok(au[0].before_json.includes('80'));
  ['x', 101, -1, true, [], null, ''].forEach(v => assert.strictEqual(code(() => X.Settings.set(admin, c1, 'exam.pass_score', v, '', 'r')), 'VALIDATION', String(v)));
  assert.strictEqual(code(() => X.Settings.set(admin, c1, 'nope', 1, '', 'r')), 'VALIDATION'); assert.strictEqual(code(() => X.Settings.set(admin, c1, 'qual.early_alert_days', 2.5, '', 'r')), 'VALIDATION');
  assert.strictEqual(code(() => X.Settings.set(admin, c1, 'health.weights', { fitness: 60, navigation: 30 }, '', 'r')), 'VALIDATION', 'sum must be 100');
  X.Settings.set(admin, c1, 'health.weights', { fitness: 60, navigation: 40 }, '', 'r'); assert.deepStrictEqual(X.Settings.get(c1, 'health.weights'), { fitness: 60, navigation: 40 });
  X.Settings.set(admin, c1, 'level.nav.green_min', 80, '', 'r'); X.Settings.set(admin, c1, 'level.nav.yellow_min', 60, '', 'r');
  assert.deepStrictEqual([90, 80, 79.9, 60, 59.9].map(v => X.Settings.level(c1, 'nav', v)), ['green', 'green', 'yellow', 'yellow', 'red']); assert.strictEqual(X.Settings.level(c1, 'nav', null), null);
});
t('hardening', 'settings: commander cannot write; reads current values only (no history); archived course blocks writes', () => {
  const S = setup(); const { X, admin, c1, cC, code } = S;
  assert.strictEqual(code(() => X.Settings.set(cC, c1, 'exam.pass_score', 70, '', 'r')), 'FORBIDDEN'); const L = X.Settings.list(cC, c1); assert.ok(L.length && L.every(x => !('history' in x)));
  X.Courses.archive(admin, c1); assert.strictEqual(code(() => X.Settings.set(admin, c1, 'exam.pass_score', 70, '', 'r')), 'COURSE_ARCHIVED');
});

// ================= fitness =================
t('unit', 'fitness: approved default types/weights are seeded (opening 20/20/20/40, regular 20/20/20/10/30), weights validated, no hidden tables', () => {
  const S = fitSetup(); const { X, admin, c1, code } = S;
  assert.deepStrictEqual(S.opening.weights, { pullups: 20, parallel_bars: 20, trap_bar: 20, run3km: 40 }); assert.deepStrictEqual(S.regular.weights, { pullups: 20, parallel_bars: 20, trap_bar: 20, run150x2: 10, run3km: 30 });
  assert.strictEqual(X.Fitness.activeVersion_(c1), null, 'no scoring version exists until an admin imports + approves one');
  assert.strictEqual(code(() => X.Fitness.typeCreate(admin, c1, { name: 'x', weights: { pullups: 50, run3km: 40 } })), 'VALIDATION', 'sum 90');
  assert.strictEqual(code(() => X.Fitness.typeCreate(admin, c1, { name: 'x', weights: { pullups: 50, swim: 50 } })), 'VALIDATION', 'unknown component');
  assert.strictEqual(code(() => X.Fitness.typeCreate(admin, c1, { name: 'מבחן פתיחה', weights: { pullups: 100 } })), 'DUPLICATE');
  assert.ok(X.Fitness.typeCreate(admin, c1, { name: 'מותאם', weights: { pullups: 50, run3km: 50 } }).id);
});
t('integration', 'fitness scoring versions: draft source (v1.0.3, explicit gender per table) lists its open questions; a full import is structurally valid; approval needs an explicit verification statement; approved versions are immutable', () => {
  const { X, admin, c1, code } = setup();
  const src = X.Fitness.draftSource(admin); assert.strictEqual(src.tables.length, 11); assert.deepStrictEqual(src.uncertain.map(u => u.id), ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'U6']);
  assert.ok(src.tables.every(t => t.gender === 'M' || t.gender === 'F'), 'gender explicit on every table'); assert.deepStrictEqual(src.tables.filter(t => t.component === 'trap_bar').map(t => t.meta.work_weight_kg).sort(), [40, 80]);
  assert.strictEqual(code(() => X.Fitness.importDraft(admin, c1, { sheets: ['X'] })), 'VALIDATION'); assert.strictEqual(code(() => X.Fitness.importDraft(admin, c1, { sheets: [] })), 'VALIDATION');
  const v = X.Fitness.importDraft(admin, c1, {}); assert.strictEqual(v.issues.length, 0, 'every table is contiguous (no gap / overlap)'); assert.strictEqual(v.rows, 219, 'v1.0.6: 232 transcribed rows minus the 13 rows of the excluded historical boys no-weight table');
  assert.strictEqual(code(() => X.Fitness.approve(admin, v.id, { reason: 'r' })), 'VALIDATION', 'needs verified_against_source');
  assert.strictEqual(X.Fitness.activeVersion_(c1), null, 'importing never activates anything');
  const only = X.Fitness.importDraft(admin, c1, { sheets: ['M'] }); assert.ok(only.rows < v.rows); assert.ok(X.Db.where('FitnessScoringRows', r => r.version_id === only.id).every(r => r.gender === 'M'));
  const ap = X.Fitness.approve(admin, only.id, { verified_against_source: true, reason: 'אומת' }); assert.strictEqual(ap.status, 'APPROVED'); assert.strictEqual(X.Fitness.activeVersion_(c1).id, only.id);
  assert.strictEqual(code(() => X.Fitness.editRow(admin, only.id, X.Db.all('FitnessScoringRows')[0].id, { score: 1 }, 'r')), 'VALIDATION', 'approved version is immutable');
});
t('integration', 'fitness: DRAFT tables are never used; without an approved version component scores are null (not 0) and the total says "ממתין להשלמת נתונים"', () => {
  const S = fitSetup(); const { X, admin, c1, S: sol } = S;
  X.Fitness.importDraft(admin, c1, {});
  const r = S.fit(admin, sol.a, { run3km: '10:00', trap_bar: 7 }).record;
  const comps = JSON.parse(r.component_scores_json); assert.strictEqual(comps.run3km.score, null); assert.strictEqual(comps.run3km.reason, 'no_table'); assert.strictEqual(comps.trap_bar.score, null); assert.strictEqual(comps.trap_bar.reason, 'no_table'); assert.strictEqual(r.weighted_score, '');
  assert.strictEqual(r.scoring_version_id, ''); assert.strictEqual(X.Fitness.list(admin, c1, {})[0].weighted_display, 'ממתין להשלמת נתונים');
});
t('integration', 'fitness: full calculation with an approved version — hand-computed weighted score (opening 20/20/20/40), gender picks the table, version id stored, old results keep their version', () => {
  const S = fitSetup(); const { X, admin, c1, S: sol } = S; const v = S.mkVersion(); S.approve(v);
  // boys: pull-ups 15 (vest 7 kg table, v1.0.6) -> 100; parallel 12 -> 70 (11-12); Trap Bar 8 -> 90; 3 km 13:00 -> 76  => (100*20 + 70*20 + 90*20 + 76*40) / 100 = 82.4
  const r = S.fit(admin, sol.a, { pullups: 15, parallel_bars: 12, trap_bar: 8, run3km: '13:00' }).record, c = JSON.parse(r.component_scores_json);
  assert.strictEqual(c.pullups.score, 100); assert.strictEqual(c.parallel_bars.score, 70); assert.strictEqual(c.trap_bar.score, 90); assert.strictEqual(c.run3km.score, 76);
  assert.ok(close(Number(r.weighted_score), 82.4)); assert.strictEqual(r.scoring_version_id, X.Fitness.activeVersion_(c1).id);
  // girls with the SAME raw values: rubber-band pull-ups (only F variant, no configuration needed): 20 -> 100; parallel 12 -> 70; Trap Bar 8 -> 90; 3 km 13:00 -> 97 => (2000 + 1400 + 1800 + 97*40) / 100 = 90.8
  const f = S.fit(admin, sol.a2, { pullups: 20, parallel_bars: 12, trap_bar: 8, run3km: '13:00' }).record, cf = JSON.parse(f.component_scores_json);
  assert.strictEqual(cf.pullups.score, 100); assert.strictEqual(cf.run3km.score, 97); assert.ok(close(Number(f.weighted_score), (100 * 20 + 70 * 20 + 90 * 20 + 97 * 40) / 100));
  // a later approved version does not change old results
  const v2 = S.mkVersion(); S.approve(v2); assert.strictEqual(X.Db.get('FitnessTests', r.id).scoring_version_id, v.id); assert.strictEqual(X.Fitness.activeVersion_(c1).id, v2.id);
  assert.strictEqual(X.Db.get('FitnessScoringVersions', v.id).status, 'SUPERSEDED');
});
t('integration', 'fitness: missing / unsupported inputs are null with a reason — never zero (out of range, not entered)', () => {
  const S = fitSetup(); const { X, admin, c1, S: sol } = S; S.approve(S.mkVersion());
  const r = S.fit(admin, sol.a, { pullups: 5, trap_bar: 5, run3km: '10:00' }).record, c = JSON.parse(r.component_scores_json);
  assert.strictEqual(c.pullups.reason, 'ok', 'v1.0.6: boys always use the vest 7 kg table, nothing to configure'); assert.strictEqual(c.pullups.score, 55);
  assert.strictEqual(c.parallel_bars.reason, 'not_entered'); assert.strictEqual(r.weighted_score, ''); assert.strictEqual(c.trap_bar.score, 60);
  const z = JSON.parse(S.fit(admin, sol.a, { pullups: 0, parallel_bars: 50, trap_bar: 0, run3km: '10:00', test_date: '2026-03-02' }).record.component_scores_json);
  assert.strictEqual(z.pullups.reason, 'out_of_range'); assert.strictEqual(z.pullups.score, null, '0 reps is NOT silently 0'); assert.strictEqual(z.parallel_bars.reason, 'out_of_range'); assert.strictEqual(z.trap_bar.reason, 'out_of_range'); assert.strictEqual(z.trap_bar.score, null, 'Trap Bar 0 reps has no table row: not 0');
  const s2 = X.Records.create(admin, 'FitnessTests', c1, { request_id: S.rid(), soldier_id: sol.a.id, test_date: '2026-03-03', test_type_id: S.regular.id, run150x2: '00:40', run3km: '10:00' }).record;
  assert.strictEqual(JSON.parse(s2.component_scores_json).run150x2.score, 100);
});
t('hardening', 'fitness: input validation (reps ints, time mm:ss only, no component, component outside type, bad type/soldier/date) and uniform soldier message', () => {
  const S = fitSetup(); const { X, admin, c1, S: sol, code } = S; S.approve(S.mkVersion());
  const bad = o => code(() => S.fit(admin, sol.a, o));
  assert.strictEqual(bad({ trap_bar: -1 }), 'VALIDATION'); assert.strictEqual(bad({ trap_bar: 2.5 }), 'VALIDATION'); assert.strictEqual(bad({ pullups: 3.5 }), 'VALIDATION'); assert.strictEqual(bad({ pullups: -2 }), 'VALIDATION');
  assert.strictEqual(bad({ run3km: '10:5' }), 'VALIDATION'); assert.strictEqual(bad({ run3km: 650.5 }), 'VALIDATION'); assert.strictEqual(bad({ run3km: 'abc' }), 'VALIDATION'); assert.strictEqual(bad({}), 'VALIDATION', 'no component');
  assert.strictEqual(bad({ run150x2: '00:40' }), 'VALIDATION', 'opening type has no 150x2'); assert.strictEqual(bad({ trap_bar: 5, test_date: '2026-02-30' }), 'VALIDATION'); assert.strictEqual(bad({ trap_bar: 5, test_type_id: 'nope' }), 'VALIDATION');
  assert.strictEqual(bad({ trap_bar: ['5'] }), 'VALIDATION', 'type confusion'); assert.strictEqual(X.Db.all('FitnessTests').length, 0, 'nothing stored on any rejected input');
  const m1 = (() => { try { S.fit(admin, sol.f, { trap_bar: 5 }); } catch (e) { return e.message; } })(), m2 = (() => { try { S.fit(admin, { id: 'nope' }, { trap_bar: 5 }); } catch (e) { return e.message; } })(); assert.strictEqual(m1, m2, 'foreign-course soldier == missing soldier');
});
t('integration', 'fitness: idempotent request_id, admin edit recomputes + audit before/after, cancel/restore, correction request flow, history & progress', () => {
  const S = fitSetup(); const { X, admin, c1, cC, S: sol, code } = S; S.approve(S.mkVersion());
  const rq = S.rid(), a = X.Records.create(cC, 'FitnessTests', c1, { request_id: rq, soldier_id: sol.a.id, test_date: '2026-03-01', test_type_id: S.opening.id, pullups: 10, parallel_bars: 10, trap_bar: 5, run3km: '11:00' });
  const again = X.Records.create(cC, 'FitnessTests', c1, { request_id: rq, soldier_id: sol.a.id, test_date: '2026-03-01', test_type_id: S.opening.id, pullups: 20 }); assert.strictEqual(again.duplicate, true); assert.strictEqual(X.Db.all('FitnessTests').length, 1);
  assert.strictEqual(code(() => X.Records.adminEdit(cC, 'FitnessTests', a.record.id, { pullups: 1 }, 'x')), 'FORBIDDEN', 'commander cannot edit after submit');
  const before = Number(a.record.weighted_score); X.Records.adminEdit(admin, 'FitnessTests', a.record.id, { trap_bar: 10 }, 'תיקון');
  const now = X.Db.get('FitnessTests', a.record.id); assert.ok(Number(now.weighted_score) > before); assert.strictEqual(JSON.parse(now.raw_values_json).pullups, 10, 'untouched raw values preserved');
  const au = X.Db.where('AuditLog', x => x.table_name === 'FitnessTests' && x.action === 'EDIT'); assert.strictEqual(au.length, 1); assert.ok(au[0].before_json.includes('weighted_score') && au[0].reason === 'תיקון');
  const cr = X.Records.requestCorrection(cC, 'FitnessTests', a.record.id, { pullups: 12 }, 'טעות הקלדה'); X.Records.reviewCorrection(admin, cr.id, 'approve', 'אושר'); assert.strictEqual(JSON.parse(X.Db.get('FitnessTests', a.record.id).raw_values_json).pullups, 12);
  S.fit(admin, sol.a, { test_date: '2026-04-01', pullups: 15, parallel_bars: 20, trap_bar: 10, run3km: '10:00' });
  const sm = X.Fitness.summary(admin, c1, sol.a.id); assert.strictEqual(sm.count, 2); assert.ok(sm.progress > 0 && sm.last > sm.previous);
  X.Records.cancel(admin, 'FitnessTests', a.record.id, 'שגוי'); assert.strictEqual(X.Fitness.summary(admin, c1, sol.a.id).count, 1); assert.strictEqual(X.Fitness.list(admin, c1, { includeCancelled: true }).length, 2); assert.strictEqual(X.Fitness.list(admin, c1, {}).length, 1);
  X.Records.restore(admin, 'FitnessTests', a.record.id); assert.strictEqual(X.Fitness.summary(admin, c1, sol.a.id).count, 2); assert.strictEqual(X.Db.all('FitnessTests').length, 2, 'no duplicate on restore');
});
t('hardening', 'fitness: commander scope (team commander enters/reads only his team), cancelled soldier excluded from snapshot but history kept, archived course locks writes', () => {
  const S = fitSetup(); const { X, admin, c1, cT, S: sol, code } = S; S.approve(S.mkVersion());
  assert.strictEqual(code(() => S.fit(cT, sol.b, { trap_bar: 5 })), 'VALIDATION', 'soldier outside the assignment => uniform unavailable message'); S.fit(cT, sol.a, { trap_bar: 5 }); S.fit(admin, sol.b, { trap_bar: 5 });
  assert.strictEqual(X.Fitness.list(cT, c1, {}).length, 1); assert.strictEqual(X.Fitness.list(admin, c1, {}).length, 2);
  X.Soldiers.cancel(admin, sol.b.id, 'בדיקה'); assert.strictEqual(X.Fitness.summary(admin, c1, sol.b.id).count, 0, 'cancelled soldier: no current-state data'); assert.strictEqual(X.Fitness.list(admin, c1, { soldierId: sol.b.id }).length, 1, 'history kept for admin');
  X.Courses.archive(admin, c1); assert.strictEqual(code(() => S.fit(admin, sol.a, { trap_bar: 5 })), 'COURSE_ARCHIVED');
});
t('integration', 'fitness: course clone copies test types + approved scoring tables (config) but no results', () => {
  const S = fitSetup(); const { X, admin, c1, S: sol } = S; S.approve(S.mkVersion()); S.fit(admin, sol.a, { trap_bar: 5 });
  const n = X.Courses.create(admin, { name: 'חדש', start_date: '2099-03-01', clone_from: c1 }).id;
  assert.strictEqual(X.Fitness.typesList(admin, n).length, 2); const v = X.Fitness.activeVersion_(n); assert.ok(v && v.id !== X.Fitness.activeVersion_(c1).id && v.status === 'APPROVED');
  assert.strictEqual(X.Db.where('FitnessScoringRows', r => r.version_id === v.id).length, X.Db.where('FitnessScoringRows', r => r.version_id === X.Fitness.activeVersion_(c1).id).length); assert.strictEqual(X.Db.where('FitnessTests', r => r.course_id === n).length, 0);
});

// ================= marksmanship =================
const msd = (S, o) => Object.assign({ request_id: S.rid(), soldier_id: S.S.a.id, test_date: '2026-03-01', weapon_type: 'M16', distance_m: 100, examiner_score: 80, weapon_zeroed: true }, o || {});
t('unit', 'marksmanship: regular and YLM are separate measures; no hits-of-rounds field; YLM never enters the regular mean', () => {
  const S = setup(); const { X, admin, c1 } = S;
  assert.ok(!X.TABLES.MarksmanshipTests.cols.some(c => /hit|round|bullet/i.test(c)), 'no hits/rounds column');
  X.Records.create(admin, 'MarksmanshipTests', c1, msd(S, { examiner_score: 80 })); X.Records.create(admin, 'MarksmanshipTests', c1, msd(S, { examiner_score: 60, ylm_score: 40, test_date: '2026-03-02' })); X.Records.create(admin, 'MarksmanshipTests', c1, msd(S, { examiner_score: '', ylm_score: 20, test_date: '2026-03-03' }));
  const m = X.Marksmanship.summary(admin, c1, S.S.a.id); assert.ok(close(m.regular.mean, 70)); assert.strictEqual(m.regular.count, 2); assert.ok(close(m.ylm.mean, 30)); assert.strictEqual(m.ylm.count, 2);
  assert.deepStrictEqual(X.Marksmanship.list(admin, c1, {}).map(r => r.test_kind).sort(), ['both', 'regular', 'ylm']);
});
t('hardening', 'marksmanship: validation (needs a score, ranges, zeroed yes/no, weapon, distance), no zero-filling, scope and idempotency', () => {
  const S = setup(); const { X, admin, c1, cT, code } = S; const mk = (c, o) => X.Records.create(c, 'MarksmanshipTests', c1, msd(S, o));
  ['examiner_score:101', 'examiner_score:-1', 'ylm_score:150', 'distance_m:0', 'distance_m:-5', 'weapon_zeroed:maybe', 'weapon_type:', 'test_date:2026-13-01'].forEach(p => { const [k, v] = p.split(':'); assert.strictEqual(code(() => mk(admin, { [k]: v === '' ? '' : (isNaN(+v) ? v : +v) })), 'VALIDATION', p); });
  assert.strictEqual(code(() => mk(admin, { examiner_score: '', ylm_score: '' })), 'VALIDATION', 'no score at all'); assert.strictEqual(code(() => mk(admin, { weapon_type: ['M16'] })), 'VALIDATION');
  assert.strictEqual(X.Db.all('MarksmanshipTests').length, 0); const rq = S.rid(); mk(cT, { request_id: rq }); assert.strictEqual(mk(cT, { request_id: rq }).duplicate, true); assert.strictEqual(code(() => mk(cT, { soldier_id: S.S.b.id })), 'VALIDATION');
  assert.strictEqual(X.Marksmanship.summary(admin, c1, S.S.c.id).note, 'אין מספיק נתונים'); assert.strictEqual(X.Marksmanship.summary(admin, c1, S.S.c.id).regular.mean, null);
});

// ================= exams =================
const exSetup = () => { const S = setup(); S.ex = S.X.Exams.defCreate(S.admin, S.c1, { name: 'מבחן א' }); S.at = (ctx, soldier, att, score, o) => S.X.Exams.addAttempt(ctx, S.c1, Object.assign({ request_id: S.rid(), soldier_id: soldier.id, exam_id: S.ex.id, attempt: att, attempt_date: '2026-03-01', score }, o || {})); return S; };
t('unit', 'exams: approved rules — B only after failed A, C only after failed B, weighted 0.7*retake + 0.3*A, meeting required when B fails (even if C passes)', () => {
  const S = exSetup(); const { X, admin, c1, S: sol, code } = S;
  assert.strictEqual(code(() => S.at(admin, sol.a, 'B', 90)), 'VALIDATION', 'B without A'); S.at(admin, sol.a, 'A', 70); assert.strictEqual(code(() => S.at(admin, sol.a, 'C', 90)), 'VALIDATION', 'C without B');
  assert.strictEqual(code(() => S.at(admin, sol.a, 'A', 75, { request_id: S.rid() })), 'DUPLICATE', 'one active A'); S.at(admin, sol.a, 'B', 60);
  assert.strictEqual(X.Db.where('ExamMeetings', m => m.soldier_id === sol.a.id).length, 1, 'meeting opened by the failed B'); S.at(admin, sol.a, 'C', 90);
  const ev = X.Exams.summary(admin, c1, sol.a.id).exams[0].statuses[0]; assert.strictEqual(ev.status, 'passed'); assert.strictEqual(ev.pass_attempt, 'C'); assert.ok(close(ev.weighted_score, 0.7 * 90 + 0.3 * 70)); assert.strictEqual(ev.meeting_required, true);
  S.at(admin, sol.b, 'A', 95); assert.strictEqual(code(() => S.at(admin, sol.b, 'B', 80)), 'VALIDATION', 'A passed => no B'); assert.strictEqual(X.Db.where('ExamMeetings', m => m.soldier_id === sol.b.id).length, 0);
  S.at(admin, sol.c, 'A', 79.9); S.at(admin, sol.c, 'B', 80); const e2 = X.Exams.summary(admin, c1, sol.c.id).exams[0].statuses[0]; assert.strictEqual(e2.status, 'passed'); assert.ok(close(e2.weighted_score, 0.7 * 80 + 0.3 * 79.9)); assert.strictEqual(e2.meeting_required, false, '80 passes');
});
t('integration', 'exams: pass score is configurable per course/exam; meeting documentation needs role+date; commanders cannot see discipline notes; every attempt kept', () => {
  const S = exSetup(); const { X, admin, c1, cC, S: sol, code } = S;
  S.at(admin, sol.a, 'A', 70); X.Settings.set(admin, c1, 'exam.pass_score', 70, '', 'שינוי ספי'); assert.strictEqual(X.Exams.summary(admin, c1, sol.a.id).exams[0].statuses[0].status, 'passed', '70 passes after the change');
  X.Exams.defSetPass(admin, S.ex.id, 90, 'מבחן קשה'); assert.strictEqual(X.Exams.summary(admin, c1, sol.a.id).exams[0].statuses[0].status, 'pending_B');
  S.at(admin, sol.a, 'B', 50); const m = X.Db.where('ExamMeetings', x => x.soldier_id === sol.a.id)[0];
  assert.strictEqual(m.created_by, 'system'); assert.strictEqual(code(() => X.Records.adminEdit(admin, 'ExamMeetings', m.id, { done: true }, 'r')), 'VALIDATION', 'done needs role and date'); assert.strictEqual(code(() => X.Records.adminEdit(admin, 'ExamMeetings', m.id, { done: true, owner_role: 'סמל', meeting_date: '2026-03-05' }, 'r')), 'VALIDATION');
  X.Records.adminEdit(admin, 'ExamMeetings', m.id, { done: true, owner_role: 'מ״פ', meeting_date: '2026-03-05', notes: 'שיחה בוצעה' }, 'תיעוד');
  assert.strictEqual(X.Exams.meetingsList(admin, c1, {})[0].notes, 'שיחה בוצעה'); assert.ok(!('notes' in X.Exams.meetingsList(cC, c1, {})[0]), 'commander gets no discipline notes'); assert.strictEqual(X.Exams.meetingsList(cC, c1, {})[0].done, true);
  assert.strictEqual(code(() => X.Records.requestCorrection(cC, 'ExamMeetings', m.id, { done: false }, 'x')), 'FORBIDDEN', 'system record has no owner');
  assert.strictEqual(X.Exams.summary(admin, c1, sol.a.id).meetings_open, 0); assert.strictEqual(X.Db.where('TheoreticalExamAttempts', () => true).length, 2);
});
t('hardening', 'exams: validation, uniform soldier message, cancelled attempt re-opens the sequence, cancelled soldier excluded from pass rate, no meeting duplicate on replay', () => {
  const S = exSetup(); const { X, admin, c1, cT, S: sol, code } = S;
  ['D', 'a', '', ['A'], null].forEach(l => assert.strictEqual(code(() => S.at(admin, sol.a, l, 50)), 'VALIDATION', String(l)));
  [101, -1, 'x', '', null, [50]].forEach(v => assert.strictEqual(code(() => S.at(admin, sol.a, 'A', v)), 'VALIDATION', String(v))); assert.strictEqual(code(() => S.at(admin, sol.a, 'A', 50, { exam_id: 'nope' })), 'VALIDATION');
  assert.strictEqual(code(() => S.at(cT, sol.b, 'A', 50)), 'VALIDATION', 'outside assignment'); assert.strictEqual(X.Db.all('TheoreticalExamAttempts').length, 0);
  const rq = S.rid(); S.at(admin, sol.a, 'A', 50); S.at(admin, sol.a, 'B', 40, { request_id: rq }); const rep = S.at(admin, sol.a, 'B', 40, { request_id: rq }); assert.strictEqual(rep.duplicate, true); assert.strictEqual(X.Db.where('ExamMeetings', () => true).length, 1);
  S.at(admin, sol.c, 'A', 90); S.at(admin, sol.d, 'A', 10); S.at(admin, sol.d, 'B', 10); S.at(admin, sol.d, 'C', 10);
  let r = X.Exams.summary(admin, c1, sol.a.id); assert.strictEqual(r.exams[0].pending, 1); const all = X.Exams.aggregate_(c1, X.Snapshot.rows(admin, 'TheoreticalExamAttempts', c1, {}), []); assert.strictEqual(all.exams[0].passed, 1); assert.strictEqual(all.exams[0].failed, 1); assert.strictEqual(all.exams[0].pending, 1); assert.ok(close(all.exams[0].pass_rate, 50), 'pending is neither pass nor fail');
  X.Soldiers.cancel(admin, sol.d.id, 'בדיקה'); const all2 = X.Exams.aggregate_(c1, X.Snapshot.rows(admin, 'TheoreticalExamAttempts', c1, {}), []); assert.strictEqual(all2.exams[0].failed, 0); assert.strictEqual(all2.exams[0].pass_rate, 100);
  const B = X.Db.where('TheoreticalExamAttempts', a => a.soldier_id === sol.a.id && a.attempt === 'B')[0]; X.Records.cancel(admin, 'TheoreticalExamAttempts', B.id, 'שגוי'); S.at(admin, sol.a, 'B', 85, { attempt_date: '2026-03-09' });
  assert.strictEqual(X.Exams.summary(admin, c1, sol.a.id).exams[0].statuses[0].status, 'passed');
});

// ================= attendance =================
const atSetup = () => { const S = setup(); S.ty = S.X.ActivityTypes.create(S.admin, S.c1, 'מטווח').id; S.ev = (ctx, o) => S.X.Attendance.createEvent(ctx, S.c1, Object.assign({ request_id: S.rid(), event_date: '2026-03-01', activity_type_id: S.ty, scope_type: 'course', scope_id: S.c1 }, o || {})); return S; };
t('integration', 'attendance: everyone in scope present by default, a row per soldier, only absentees marked, early exit optional, idempotent, cumulative % from Snapshot', () => {
  const S = atSetup(); const { X, admin, c1, S: sol } = S;
  const rq = S.rid(), r = S.ev(admin, { request_id: rq, absent: [{ soldier_id: sol.a.id, notes: 'מחלה' }], early_exit: [sol.b.id] }); assert.strictEqual(r.records, 5);
  const roll = X.Attendance.eventRoll(admin, c1, r.event.id); assert.strictEqual(roll.filter(x => x.present).length, 4); assert.strictEqual(roll.find(x => x.soldier_id === sol.a.id).present, false); assert.strictEqual(roll.find(x => x.soldier_id === sol.b.id).early_exit, true);
  const again = S.ev(admin, { request_id: rq, absent: [] }); assert.strictEqual(again.duplicate, true); assert.strictEqual(X.Db.all('AttendanceRecords').length, 5);
  S.ev(admin, { event_date: '2026-03-02' }); const a = X.Attendance.summary(admin, c1, sol.a.id); assert.strictEqual(a.total, 2); assert.strictEqual(a.present, 1); assert.ok(close(a.percent, 50)); assert.strictEqual(X.Attendance.summary(admin, c1, sol.b.id).early_exits, 1);
  assert.strictEqual(X.Attendance.summary(admin, c1, sol.a.id, { from: '2026-03-02' }).total, 1, 'date filter via the parent event');
  const g = X.Attendance.aggregate_(X.Snapshot.rows(admin, 'AttendanceRecords', c1, {})); assert.strictEqual(g.total, 10); assert.strictEqual(g.absent, 1);   // the pure cumulative maths from Snapshot rows
  const gr = X.Attendance.summary(admin, c1, undefined); assert.strictEqual(gr.suppressed, true, 'D2 sub-cohort: 1 absent soldier of 5 => the group route must not return the figure'); assert.strictEqual(gr.total, null); assert.strictEqual(gr.absent, null); assert.strictEqual(gr.percent, null);
  assert.ok(!('justified' in X.TABLES.AttendanceRecords.cols) && !X.TABLES.AttendanceRecords.cols.includes('unjustified'));
});
t('integration', 'attendance: scope (course / department / team) selects soldiers; commander only inside his assignment; absent outside scope rejected; inactive/cancelled soldiers not included', () => {
  const S = atSetup(); const { X, admin, c1, cT, cD, S: sol, code } = S;
  assert.strictEqual(S.ev(admin, { scope_type: 'team', scope_id: S.team(0, 0) }).records, 2); assert.strictEqual(S.ev(admin, { scope_type: 'department', scope_id: S.dep(1), event_date: '2026-03-02' }).records, 2);
  assert.strictEqual(code(() => S.ev(cT, { scope_type: 'course', scope_id: c1 })), 'VALIDATION', 'team commander cannot open a course-wide activity'); assert.strictEqual(code(() => S.ev(cT, { scope_type: 'team', scope_id: S.team(0, 1) })), 'VALIDATION');
  assert.strictEqual(S.ev(cT, { scope_type: 'team', scope_id: S.team(0, 0), event_date: '2026-03-03' }).records, 2); assert.strictEqual(S.ev(cD, { scope_type: 'department', scope_id: S.dep(0), event_date: '2026-03-04' }).records, 3);
  assert.strictEqual(S.ev(cD, { scope_type: 'team', scope_id: S.team(0, 1), event_date: '2026-03-05' }).records, 1, 'department commander may open one of his teams');
  assert.strictEqual(code(() => S.ev(admin, { scope_type: 'team', scope_id: S.team(0, 0), absent: [sol.c.id], event_date: '2026-03-06' })), 'VALIDATION', 'absentee not in scope'); assert.strictEqual(code(() => S.ev(admin, { scope_type: 'team', scope_id: S.team(0, 0), absent: sol.c.id, event_date: '2026-03-06' })), 'VALIDATION');
  X.Soldiers.setActive(admin, sol.d.id, false, X.Db.get('Soldiers', sol.d.id).updated_at, 'שחרור'); X.Soldiers.cancel(admin, sol.c.id, 'בדיקה');
  assert.strictEqual(S.ev(admin, { event_date: '2026-03-07' }).records, 3, 'only active, non-cancelled soldiers');
  assert.strictEqual(code(() => X.Attendance.eventRoll(cT, c1, X.Attendance.eventsList(admin, c1, {})[0].id)), null);
  const evs = X.Attendance.eventsList(cT, c1, {}); assert.ok(evs.length >= 1);
});
t('hardening', 'attendance: commander sees only his soldiers in a roll; cancelled event leaves the figures; absence_approved is admin-only; archived course; type confusion', () => {
  const S = atSetup(); const { X, admin, c1, cT, S: sol, code } = S;
  const r = S.ev(admin, { absent: [sol.a.id] }); const rollT = X.Attendance.eventRoll(cT, c1, r.event.id); assert.deepStrictEqual(rollT.map(x => x.soldier_name).sort(), ['אלף', 'אלף-שני']); assert.ok(rollT.every(x => !JSON.stringify(x).includes('בית')));
  const rec = X.Db.where('AttendanceRecords', x => x.soldier_id === sol.a.id)[0];
  assert.strictEqual(code(() => X.Records.adminEdit(cT, 'AttendanceRecords', rec.id, { absence_approved: true }, 'r')), 'FORBIDDEN'); X.Records.adminEdit(admin, 'AttendanceRecords', rec.id, { absence_approved: true }, 'אושר'); assert.strictEqual(X.Db.get('AttendanceRecords', rec.id).absence_approved, true);
  assert.strictEqual(X.Attendance.summary(admin, c1, sol.a.id).percent, 0, 'approved absence still an absence (no justified/unjustified split)');
  const own = S.ev(cT, { scope_type: 'team', scope_id: S.team(0, 0), event_date: '2026-03-20' }); const rec2 = X.Db.where('AttendanceRecords', x => x.event_id === own.event.id)[0]; const cr = X.Records.requestCorrection(cT, 'AttendanceRecords', rec2.id, { present: false }, 'טעות'); assert.strictEqual(cr.status, 'pending');
  X.Records.cancel(admin, 'AttendanceEvents', r.event.id, 'שגוי'); assert.strictEqual(X.Attendance.summary(admin, c1, sol.a.id).total, 1, 'cancelled event drops its rows (only the second event remains)'); assert.strictEqual(X.Attendance.eventsList(cT, c1, {}).length, 1);
  X.Records.restore(admin, 'AttendanceEvents', r.event.id); assert.strictEqual(X.Attendance.summary(admin, c1, sol.a.id).total, 2);
  assert.strictEqual(code(() => S.ev(admin, { activity_type_id: 'nope' })), 'VALIDATION'); assert.strictEqual(code(() => S.ev(admin, { event_date: '2026-02-31' })), 'VALIDATION'); assert.strictEqual(code(() => S.ev(admin, { scope_type: ['team'], scope_id: S.team(0, 0) })), 'VALIDATION');
  X.Courses.archive(admin, c1); assert.strictEqual(code(() => S.ev(admin, { event_date: '2026-04-01' })), 'COURSE_ARCHIVED');
});
t('hardening', 'attendance: failure in the middle of row creation cancels the event (no half-written roll)', () => {
  const S = atSetup(); const { X, admin, c1 } = S; const orig = X.Db.insert; let n = 0;
  X.Db.insert = function (t, o) { if (t === 'AttendanceRecords' && ++n === 3) throw new Error('boom'); return orig.apply(this, arguments); };
  assert.throws(() => S.ev(admin, {}), /boom/); X.Db.insert = orig;
  const ev = X.Db.all('AttendanceEvents')[0]; assert.strictEqual(ev.record_status, 'cancelled'); assert.strictEqual(X.Attendance.summary(admin, c1, undefined).total, 0);
});

// ================= marches =================
t('integration', 'marches: total km = no stretcher + stretcher, attendance default present, soldier totals only for attended marches, no completion march, scope rules', () => {
  const S = setup(); const { X, admin, c1, cT, S: sol, code } = S; const mk = (ctx, o) => X.Marches.create(ctx, c1, Object.assign({ request_id: S.rid(), march_date: '2026-03-01', location: 'מסלול א', km_no_stretcher: 10, km_stretcher: 2.5 }, o || {}));
  const m1 = mk(admin, { absent: [sol.a.id] }); assert.strictEqual(Number(m1.march.total_km), 12.5); mk(admin, { march_date: '2026-03-02', km_no_stretcher: 5, km_stretcher: 5 });
  const a = X.Marches.summary(admin, c1, sol.a.id), b = X.Marches.summary(admin, c1, sol.b.id); assert.deepStrictEqual([a.marches_attended, a.marches_absent, a.total_km, a.km_stretcher], [1, 1, 10, 5]); assert.deepStrictEqual([b.marches_attended, b.total_km, b.km_no_stretcher], [2, 22.5, 15]);
  assert.ok(!X.TABLES.Marches.cols.includes('is_makeup')); assert.strictEqual(code(() => mk(admin, { km_no_stretcher: -1 })), 'VALIDATION'); assert.strictEqual(code(() => mk(admin, { km_stretcher: 'x' })), 'VALIDATION'); assert.strictEqual(code(() => mk(admin, { location: '' })), 'VALIDATION');
  assert.strictEqual(code(() => mk(cT, {})), 'VALIDATION', 'team commander cannot open a course-wide march'); assert.strictEqual(mk(cT, { scope_type: 'team', scope_id: S.team(0, 0), march_date: '2026-03-03' }).march.scope_type, 'team');
  assert.strictEqual(X.Marches.soldierLog(admin, c1, sol.a.id).length, 3); X.Soldiers.cancel(admin, sol.b.id, 'ב'); assert.strictEqual(X.Marches.summary(admin, c1, sol.b.id).marches_total, 0);
  const rq = S.rid(); mk(admin, { request_id: rq, march_date: '2026-03-09' }); assert.strictEqual(mk(admin, { request_id: rq }).duplicate, true); assert.strictEqual(X.Marches.list(admin, c1, {}).length, 4);
});

// ================= readiness + events =================
t('integration', 'readiness: statuses, restrictions rules, every re-assessment kept + review log, latest is current, missing is "not entered" (never fit), commander scope', () => {
  const S = setup(); const { X, admin, c1, cT, S: sol, code } = S; const as = (ctx, o) => X.Readiness.assess(ctx, c1, Object.assign({ request_id: S.rid(), soldier_id: sol.a.id, status: 'fit', start_date: '2026-03-01' }, o || {}));
  assert.strictEqual(X.Readiness.soldierCurrent(admin, c1, sol.a.id).status, null); as(admin); as(cT, { status: 'fit_with_restrictions', restrictions: 'ללא ריצה', start_date: '2026-03-10', next_review_date: '2026-03-20' });
  assert.strictEqual(X.Readiness.soldierCurrent(admin, c1, sol.a.id).label, 'כשיר עם מגבלות'); assert.strictEqual(X.Db.all('ReadinessReviews').length, 2); assert.strictEqual(X.Db.all('ReadinessRecords').length, 2);
  as(admin, { status: 'unfit', start_date: '2026-03-15' }); const sm = X.Readiness.summary(admin, c1); assert.strictEqual(sm.counts_suppressed, true, 'D2 sub-cohort: statuses of 1 and 4 soldiers are not shown as counts'); assert.deepStrictEqual(sm.counts, { fit: null, fit_with_restrictions: null, unfit: null, not_entered: null });
  assert.strictEqual(sm.soldiers, undefined, 'the group summary carries NO per-soldier list'); assert.deepStrictEqual([X.Readiness.list(admin, c1, {}).filter(x => x.status === 'unfit').length, X.Readiness.notEntered(admin, c1, {}).length], [1, 4], 'the explicit operational routes (authorised scope) still give the per-soldier facts');
  [{ status: 'fit_with_restrictions' }, { status: 'fit', restrictions: 'x' }, { status: 'sick' }, { start_date: '2026-03-10', next_review_date: '2026-03-01' }, { status: ['fit'] }].forEach(o => assert.strictEqual(code(() => as(admin, o)), 'VALIDATION', JSON.stringify(o)));
  assert.strictEqual(code(() => as(cT, { soldier_id: sol.b.id })), 'VALIDATION'); assert.ok(!X.TABLES.ReadinessRecords.cols.some(c => /diagnos|severity/i.test(c)));
  const rq = S.rid(); as(admin, { request_id: rq, soldier_id: sol.c.id }); as(admin, { request_id: rq, soldier_id: sol.c.id }); assert.strictEqual(X.Db.where('ReadinessReviews', r => r.soldier_id === sol.c.id).length, 1, 'replay writes neither record nor review log twice');
  assert.strictEqual(X.Readiness.summary(cT, c1).total, 2);
});
t('integration', 'soldier events/achievements: type, description required, commander create, correction path, history', () => {
  const S = setup(); const { X, admin, c1, cT, S: sol, code } = S; const ev = (ctx, o) => X.Records.create(ctx, 'SoldierEvents', c1, Object.assign({ request_id: S.rid(), soldier_id: sol.a.id, event_date: '2026-03-01', event_type: 'achievement', description: 'מצטיין מטווח' }, o || {}));
  const r = ev(cT).record; ev(admin, { event_type: 'event', description: 'פציעה קלה בתרגיל', event_date: '2026-03-02' });
  assert.deepStrictEqual(X.SoldierEvents.list(admin, c1, { soldierId: sol.a.id }).map(e => e.type_label), ['אירוע', 'הישג']); [{ event_type: 'x' }, { description: '' }, { description: 'x'.repeat(501) }, { event_date: 'x' }].forEach(o => assert.strictEqual(code(() => ev(admin, o)), 'VALIDATION'));
  assert.strictEqual(code(() => X.Records.adminEdit(cT, 'SoldierEvents', r.id, { description: 'y' }, 'r')), 'FORBIDDEN'); const cr = X.Records.requestCorrection(cT, 'SoldierEvents', r.id, { description: 'מצטיין מטווח וניווט' }, 'השלמה'); X.Records.reviewCorrection(admin, cr.id, 'approve', '');
  assert.strictEqual(X.Db.get('SoldierEvents', r.id).description, 'מצטיין מטווח וניווט');
});
done();
