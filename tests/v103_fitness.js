// v1.0.3 — closing the fitness scoring formulas (5 components, boys / girls tables transcribed from the user's images, weighted total).
// Node only (in-memory Db). The expected values below are typed BY HAND from the images (independent of src/FitnessDraft.gs); a second group iterates the stored tables for boundary consistency.
const { suite } = require(process.env.TLIB || './tlib'); const { t, done, assert } = suite('v103_fitness.js'); const { setup } = require('./fixture');
const close = (a, b) => Math.abs(a - b) < 1e-9;
const NONE = 'ללא משקל חיצוני', VEST = 'אפוד אישי 7 ק״ג', BAND = 'בסיוע גומי';
const S0 = () => {
  const S = setup(); const { X, admin, c1 } = S;
  const types = X.Fitness.typesList(admin, c1); S.opening = types.find(x => x.is_opening); S.regular = types.find(x => !x.is_opening);
  const v = X.Fitness.importDraft(admin, c1, { label: 'v103' }); X.Fitness.approve(admin, v.id, { verified_against_source: true, reason: 'בדיקה: אומת מול התמונות' }); S.ver = X.Fitness.activeVersion_(c1);
  S.cs = (gender, comp, raw, variantCfg) => X.Fitness.componentScore_(S.ver, gender, comp, raw, variantCfg || {});
  S.rec = (ctx, sol, o) => X.Records.create(ctx, 'FitnessTests', c1, Object.assign({ request_id: S.rid(), soldier_id: sol.id, test_date: '2026-11-09', test_type_id: S.regular.id }, o)).record;
  return S;
};
// ---- hand-typed expectations from the images:  [component, raw, expected score, variant]
const BOYS = [
  // v1.0.6: no 'ללא משקל חיצוני' pull-up track for boys (binding professional decision) — expectations for that table were removed on purpose; see v106_pullups.js
  ['pullups', 15, 100, VEST], ['pullups', 14, 95, VEST], ['pullups', 13, 90, VEST], ['pullups', 12, 85, VEST], ['pullups', 11, 80, VEST], ['pullups', 10, 75, VEST], ['pullups', 9, 70, VEST], ['pullups', 8, 65, VEST], ['pullups', 7, 60, VEST], ['pullups', 6, 55, VEST], ['pullups', 5, 55, VEST], ['pullups', 4, 50, VEST], ['pullups', 3, 50, VEST], ['pullups', 2, 45, VEST], ['pullups', 1, 40, VEST],
  ['parallel_bars', 20, 100, NONE], ['parallel_bars', 19, 95, NONE], ['parallel_bars', 18, 90, NONE], ['parallel_bars', 17, 85, NONE], ['parallel_bars', 16, 80, NONE], ['parallel_bars', 15, 80, NONE], ['parallel_bars', 14, 75, NONE], ['parallel_bars', 13, 75, NONE], ['parallel_bars', 12, 70, NONE], ['parallel_bars', 11, 70, NONE], ['parallel_bars', 10, 65, NONE], ['parallel_bars', 9, 65, NONE], ['parallel_bars', 8, 60, NONE], ['parallel_bars', 7, 60, NONE], ['parallel_bars', 6, 55, NONE], ['parallel_bars', 5, 55, NONE], ['parallel_bars', 4, 50, NONE], ['parallel_bars', 3, 50, NONE], ['parallel_bars', 2, 45, NONE], ['parallel_bars', 1, 40, NONE],
  ['trap_bar', 10, 100], ['trap_bar', 9, 95], ['trap_bar', 8, 90], ['trap_bar', 7, 80], ['trap_bar', 6, 70], ['trap_bar', 5, 60], ['trap_bar', 4, 50], ['trap_bar', 3, 40], ['trap_bar', 2, 30], ['trap_bar', 1, 20],
  ['run150x2', '00:00', 100], ['run150x2', '00:43', 100], ['run150x2', '00:44', 95], ['run150x2', '00:45', 90], ['run150x2', '00:46', 90], ['run150x2', '00:47', 85], ['run150x2', '00:48', 85], ['run150x2', '00:49', 80], ['run150x2', '00:50', 80], ['run150x2', '00:51', 75], ['run150x2', '00:53', 75], ['run150x2', '00:54', 70], ['run150x2', '00:56', 70], ['run150x2', '00:57', 65], ['run150x2', '00:59', 65], ['run150x2', '01:00', 60], ['run150x2', '01:01', 60], ['run150x2', '01:02', 55], ['run150x2', '01:04', 55], ['run150x2', '01:05', 50], ['run150x2', '01:07', 50], ['run150x2', '01:08', 45], ['run150x2', '01:10', 45], ['run150x2', '01:11', 40], ['run150x2', '05:00', 40],
  ['run3km', '10:57', 100], ['run3km', '10:58', 99], ['run3km', '11:03', 99], ['run3km', '11:04', 98], ['run3km', '11:15', 97], ['run3km', '11:20', 96], ['run3km', '11:25', 95], ['run3km', '11:50', 90], ['run3km', '12:00', 88], ['run3km', '12:40', 80], ['run3km', '12:41', 79], ['run3km', '12:56', 76], ['run3km', '13:00', 76], ['run3km', '13:01', 75], ['run3km', '13:31', 70], ['run3km', '13:32', 69], ['run3km', '14:00', 65], ['run3km', '14:29', 60], ['run3km', '14:30', 59], ['run3km', '14:39', 59], ['run3km', '14:40', 58], ['run3km', '15:20', 55], ['run3km', '15:59', 49], ['run3km', '16:00', 48], ['run3km', '16:50', 41], ['run3km', '16:51', 40], ['run3km', '30:00', 40]
];
const GIRLS = [
  ['pullups', 20, 100, BAND], ['pullups', 19, 95, BAND], ['pullups', 18, 90, BAND], ['pullups', 17, 90, BAND], ['pullups', 16, 85, BAND], ['pullups', 14, 85, BAND], ['pullups', 13, 80, BAND], ['pullups', 11, 80, BAND], ['pullups', 10, 75, BAND], ['pullups', 9, 75, BAND], ['pullups', 8, 70, BAND], ['pullups', 7, 70, BAND], ['pullups', 6, 65, BAND], ['pullups', 5, 65, BAND], ['pullups', 4, 60, BAND], ['pullups', 3, 55, BAND], ['pullups', 2, 50, BAND], ['pullups', 1, 40, BAND],
  ['parallel_bars', 20, 100, BAND], ['parallel_bars', 19, 95, BAND], ['parallel_bars', 18, 90, BAND], ['parallel_bars', 17, 85, BAND], ['parallel_bars', 16, 80, BAND], ['parallel_bars', 15, 80, BAND], ['parallel_bars', 14, 75, BAND], ['parallel_bars', 13, 75, BAND], ['parallel_bars', 12, 70, BAND], ['parallel_bars', 11, 70, BAND], ['parallel_bars', 10, 65, BAND], ['parallel_bars', 9, 65, BAND], ['parallel_bars', 8, 60, BAND], ['parallel_bars', 7, 60, BAND], ['parallel_bars', 6, 55, BAND], ['parallel_bars', 5, 55, BAND], ['parallel_bars', 4, 50, BAND], ['parallel_bars', 3, 50, BAND], ['parallel_bars', 2, 45, BAND], ['parallel_bars', 1, 40, BAND],
  ['trap_bar', 10, 100], ['trap_bar', 9, 95], ['trap_bar', 8, 90], ['trap_bar', 7, 80], ['trap_bar', 6, 70], ['trap_bar', 5, 60], ['trap_bar', 4, 50], ['trap_bar', 3, 40], ['trap_bar', 2, 30], ['trap_bar', 1, 20],
  ['run150x2', '00:00', 100], ['run150x2', '00:50', 100], ['run150x2', '00:51', 95], ['run150x2', '00:52', 95], ['run150x2', '00:53', 90], ['run150x2', '00:54', 90], ['run150x2', '00:55', 85], ['run150x2', '00:56', 85], ['run150x2', '00:57', 80], ['run150x2', '00:59', 80], ['run150x2', '01:00', 75], ['run150x2', '01:02', 75], ['run150x2', '01:03', 70], ['run150x2', '01:04', 70], ['run150x2', '01:05', 65], ['run150x2', '01:06', 65], ['run150x2', '01:07', 60], ['run150x2', '01:09', 60], ['run150x2', '01:10', 55], ['run150x2', '01:12', 55], ['run150x2', '01:13', 50], ['run150x2', '01:14', 50], ['run150x2', '01:15', 45], ['run150x2', '01:16', 45], ['run150x2', '01:17', 40], ['run150x2', '04:00', 40],
  ['run3km', '12:38', 100], ['run3km', '12:39', 99], ['run3km', '12:47', 99], ['run3km', '12:48', 98], ['run3km', '12:57', 98], ['run3km', '12:58', 97], ['run3km', '13:00', 97], ['run3km', '13:06', 97], ['run3km', '13:07', 96], ['run3km', '14:00', 91], ['run3km', '14:01', 90], ['run3km', '15:40', 80], ['run3km', '15:41', 79], ['run3km', '17:02', 71], ['run3km', '17:03', 70], ['run3km', '17:39', 67], ['run3km', '17:40', 66], ['run3km', '18:51', 59], ['run3km', '18:52', 58], ['run3km', '20:04', 51], ['run3km', '20:05', 50], ['run3km', '21:35', 41], ['run3km', '21:36', 40], ['run3km', '40:00', 40]
];
const comps = ['pullups', 'parallel_bars', 'trap_bar', 'run150x2', 'run3km'];

t('unit', '1. boys: all five components score exactly as printed in the boys image (both boys pull-up variants; incl. every range edge)', () => {
  const S = S0(); BOYS.forEach(([c, raw, exp, v]) => { const r = S.cs('M', c, raw, v ? { [c]: v } : {}); assert.strictEqual(r.reason, 'ok', c + ' ' + raw); assert.strictEqual(r.score, exp, 'boys ' + c + ' ' + (v || '') + ' ' + raw); });
  assert.deepStrictEqual(comps.filter(c => !BOYS.some(b => b[0] === c)), [], 'all five components covered');
});
t('unit', '2. girls: all five components score exactly as printed in the girls image (rubber-band pull-ups and parallel bars)', () => {
  const S = S0(); GIRLS.forEach(([c, raw, exp, v]) => { const r = S.cs('F', c, raw, v ? { [c]: v } : {}); assert.strictEqual(r.reason, 'ok', c + ' ' + raw); assert.strictEqual(r.score, exp, 'girls ' + c + ' ' + raw); });
  assert.deepStrictEqual(comps.filter(c => !GIRLS.some(b => b[0] === c)), []);
});
t('integration', '3. the table is chosen by the soldier\'s gender: identical raw values give different scores; a boy is never scored on the girls table and vice versa', () => {
  const S = S0(); const { X, admin } = S; assert.throws(() => X.Fitness.typeSetVariant(admin, S.regular.id, 'pullups', NONE, 'בדיקה'), /VALIDATION|ללא משקל|לא ניתן/);
  assert.strictEqual(S.cs('M', 'run150x2', '00:50').score, 80); assert.strictEqual(S.cs('F', 'run150x2', '00:50').score, 100);
  assert.strictEqual(S.cs('M', 'run3km', '13:00').score, 76); assert.strictEqual(S.cs('F', 'run3km', '13:00').score, 97);
  assert.strictEqual(S.cs('M', 'pullups', 15, { pullups: NONE }).score, 100, 'boys: always the vest table, a configured no-weight variant is ignored'); assert.strictEqual(S.cs('F', 'pullups', 15).score, 85, 'girls: the single (rubber-band) table is used');
  assert.strictEqual(S.cs('M', 'pullups', 15, { pullups: BAND }).score, 100, 'a boy is never scored on the girls table (config ignored; vest table)');
  const boy = S.rec(admin, S.S.a, { run150x2: '00:50', run3km: '13:00', pullups: 15, parallel_bars: 20, trap_bar: 10 }), girl = S.rec(admin, S.S.a2, { run150x2: '00:50', run3km: '13:00', pullups: 15, parallel_bars: 20, trap_bar: 10 });
  assert.strictEqual(JSON.parse(boy.component_scores_json).run3km.score, 76); assert.strictEqual(JSON.parse(girl.component_scores_json).run3km.score, 97);
  assert.strictEqual(S.cs('', 'run3km', '13:00').reason, 'gender_missing', 'no gender => no score (nothing assumed)'); assert.strictEqual(S.cs(undefined, 'trap_bar', 5).score, null);
});
t('unit', '4. weighted total: the user\'s example 90/80/100/70/90 = 88.0 (weights 20/20/20/10/30); weights sum 100; unrounded value stored, shown with one decimal', () => {
  const S = S0(); const { X, admin } = S;
  const w = X.Util.parseJson(S.regular.weights ? JSON.stringify(S.regular.weights) : '{}', {}); assert.deepStrictEqual(w, { pullups: 20, parallel_bars: 20, trap_bar: 20, run150x2: 10, run3km: 30 });
  const tot = X.Calc.weightedFitness({ pullups: 90, parallel_bars: 80, trap_bar: 100, run150x2: 70, run3km: 90 }, w); assert.ok(close(tot.score, 88)); assert.deepStrictEqual(tot.missing, []);
  assert.strictEqual(X.Util.display1(tot.score), '88', 'existing display policy (Util.display1) is unchanged'); assert.strictEqual(X.Util.display1(90.8), '90.8'); assert.strictEqual(X.Util.display1(88.04), '88');
  const t2 = X.Calc.weightedFitness({ pullups: 83, parallel_bars: 77, trap_bar: 95, run150x2: 65, run3km: 71 }, w); assert.ok(close(t2.score, (83 * 20 + 77 * 20 + 95 * 20 + 65 * 10 + 71 * 30) / 100), 'no rounding of component scores or of the total');
});
t('integration', '5. boundary values: for EVERY stored table, each row\'s first/last value maps to that row, and the neighbours map to the adjacent rows (no gap / overlap / wrong edge)', () => {
  const S = S0(); const { X } = S; let n = 0;
  X.Fitness.groups_(S.ver.id).forEach(g => {
    const rows = X.Fitness.tableRows_(S.ver, g.gender, g.component, g.variant), tab = X.Fitness.buildTable_(S.ver, rows), time = tab.kind === 'time';
    const L = (v) => X.Scoring.lookup(tab, v); const fmt = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    tab.rows.forEach((r, i) => {
      const lo = time ? r.from_sec : r.reps_min, hi = time ? r.to_sec : r.reps_max, enc = time ? fmt : (x => x);
      const prev = tab.rows[i - 1], next = tab.rows[i + 1];                       // time tables ascend in value, reps tables descend: the row below the low edge is i-1 (time) / i+1 (reps)
      const belowRow = time ? prev : next, aboveRow = time ? next : prev;
      if (lo !== null) { assert.strictEqual(L(enc(lo)), r.score, g.component + ' low edge'); n++; if (belowRow) { assert.strictEqual(L(enc(lo - 1)), belowRow.score, g.component + ' just below low edge'); n++; } }
      if (hi !== null) { assert.strictEqual(L(enc(hi)), r.score, g.component + ' high edge'); n++; if (aboveRow) { assert.strictEqual(L(enc(hi + 1)), aboveRow.score, g.component + ' just above high edge'); n++; } }
    });
  });
  assert.ok(n > 700, 'checked ' + n + ' boundary lookups');
  assert.deepStrictEqual(X.Fitness.versionIssues_(S.ver), [], 'structural check: every table gapless and descending');
});
t('unit', '6. values outside the table get NO automatic score (out_of_range => review text); between-range values cannot exist (contiguous tables); open time ends are covered', () => {
  const S = S0(); const { X, admin } = S;
  [['M', 'pullups', 21, { pullups: NONE }], ['M', 'pullups', 16, { pullups: VEST }], ['M', 'pullups', 0, { pullups: NONE }], ['F', 'pullups', 21, {}], ['F', 'pullups', 0, {}], ['M', 'parallel_bars', 21, { parallel_bars: NONE }], ['M', 'parallel_bars', 0, { parallel_bars: NONE }], ['M', 'trap_bar', 11, {}], ['M', 'trap_bar', 0, {}], ['F', 'trap_bar', 80, {}]]
    .forEach(([g, c, raw, v]) => { const r = S.cs(g, c, raw, v); assert.strictEqual(r.score, null, g + c + raw); assert.strictEqual(r.reason, 'out_of_range', g + ' ' + c + ' ' + raw); });
  assert.strictEqual(S.cs('M', 'run3km', '00:01').score, 100); assert.strictEqual(S.cs('M', 'run3km', '59:59').score, 40);
  // the record shows a review request, not a score and not a number
  const r = S.rec(admin, S.S.a, { pullups: 25, parallel_bars: 10, trap_bar: 5, run150x2: '00:50', run3km: '13:00' });
  assert.strictEqual(r.weighted_score, ''); const v = X.Fitness.list(admin, S.c1, {})[0]; assert.strictEqual(v.weighted_display, 'נדרשת בדיקה — ערך מחוץ לטווח הטבלה'); assert.deepStrictEqual(Object.keys(v.component_status), ['pullups']); assert.strictEqual(v.component_status.pullups, 'מחוץ לטווח הטבלה — נדרשת בדיקה');
});
t('integration', '7+10. a missing value in ANY of the five components => no final score, "ממתין להשלמת נתונים", the missing component is never 0, and the others keep their scores', () => {
  const S = S0(); const { X, admin } = S;
  const full = { pullups: 15, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' };
  assert.ok(S.rec(admin, S.S.a, full).weighted_score !== '', 'sanity: complete data gives a score');
  comps.forEach((miss, i) => {
    [undefined, '', null].forEach(blank => {
      const o = Object.assign({}, full, { test_date: '2026-10-0' + (i + 1) }); if (blank === undefined) delete o[miss]; else o[miss] = blank;
      const r = S.rec(admin, S.S.a, o), cs = JSON.parse(r.component_scores_json);
      assert.strictEqual(r.weighted_score, '', 'no total when ' + miss + ' is ' + String(blank)); assert.strictEqual(cs[miss].score, null); assert.strictEqual(cs[miss].reason, 'not_entered');
      comps.filter(c => c !== miss).forEach(c => assert.ok(cs[c].score !== null && cs[c].score > 0, c + ' still scored'));
      assert.strictEqual(X.Records.list(admin, 'FitnessTests', S.c1, {}).find(x => x.id === r.id).weighted_score, '');
    });
  });
  assert.ok(X.Fitness.list(admin, S.c1, {}).filter(x => x.test_date !== '2026-11-09').every(x => x.weighted_display === 'ממתין להשלמת נתונים' && x.weighted_score === null));
  const nothing = (() => { try { S.rec(admin, S.S.a, { test_date: '2026-09-01' }); } catch (e) { return e.code; } })(); assert.strictEqual(nothing, 'VALIDATION', 'a record with no component is rejected');
});
t('hardening', '8. time format: only mm:ss text is accepted; invalid formats are rejected (never guessed, never 0); reps / working weight / time are not mixed up', () => {
  const S = S0(); const { X, admin } = S; const code = f => { try { f(); return 'ok'; } catch (e) { return e.code; } };
  ['00:50', '0:50', '13:00', '9:05', '12:59'].forEach(v => assert.strictEqual(code(() => S.cs('M', 'run3km', v)), 'ok', v));
  ['13', '1300', '13:5', '13:60', '13:00:00', '13.00', '-1:00', ':50', '13:', 'abc', '١٣:٠٠', '13 :00', 780, 780.5, 13, true, ['13:00'], { m: 13 }].forEach(v => assert.strictEqual(code(() => S.cs('M', 'run3km', v)), 'VALIDATION', String(JSON.stringify(v))));
  assert.strictEqual(S.cs('M', 'run3km', ' 13:00 ').score, 76, 'surrounding spaces tolerated');
  ['', null, undefined].forEach(v => assert.strictEqual(S.cs('M', 'run3km', v).reason, 'not_entered'));
  ['5.5', 'x', -1, 2.5, ['5'], '', {}].forEach(v => { if (v === '') return; assert.strictEqual(code(() => S.cs('M', 'trap_bar', v)), 'VALIDATION', 'reps ' + JSON.stringify(v)); });
  assert.strictEqual(code(() => S.cs('M', 'trap_bar', '10:00')), 'VALIDATION', 'a time typed into a reps field'); assert.strictEqual(S.cs('M', 'trap_bar', 80).reason, 'out_of_range', 'working weight typed as reps is flagged, not scored');
  const before = X.Db.all('FitnessTests').length; assert.strictEqual(code(() => S.rec(admin, S.S.a, { pullups: 5, parallel_bars: 5, trap_bar: 5, run150x2: 50, run3km: '13:00' })), 'VALIDATION', 'numeric 50 for the 300 m run is rejected (ambiguous)'); assert.strictEqual(X.Db.all('FitnessTests').length, before, 'nothing stored');
});
t('integration', '9. the reported case (2026-11-09, regular, pull-ups 15, parallel 20, Trap Bar 10, 300 m 00:50, 3 km 13:00): root causes reproduced and fixed', () => {
  const S = setup(); const { X, admin, c1 } = S; const types = X.Fitness.typesList(admin, c1), reg = types.find(x => !x.is_opening);
  const rec = (sol) => X.Records.create(admin, 'FitnessTests', c1, { request_id: S.rid(), soldier_id: sol.id, test_date: '2026-11-09', test_type_id: reg.id, pullups: 15, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' }).record;
  const byId = (rr) => X.Fitness.list(admin, c1, {}).find(x => x.id === rr.id);
  // cause 1: no APPROVED scoring version (tables only DRAFT / none) => no component can be scored, total waits
  let r = rec(S.S.a); assert.strictEqual(r.weighted_score, ''); assert.ok(comps.every(c => JSON.parse(r.component_scores_json)[c].reason === 'no_table'));
  const v = X.Fitness.importDraft(admin, c1, {}); r = rec(S.S.a); assert.strictEqual(r.weighted_score, '', 'a DRAFT is never used');
  X.Fitness.approve(admin, v.id, { verified_against_source: true, reason: 'אומת' });
  // cause 2 (v1.0.5: boys had two pull-up tables and needed a configured variant) no longer exists: v1.0.6 boys ALWAYS use the vest 7 kg table, no configuration, no 'variant_unset'
  r = rec(S.S.a); let cs = JSON.parse(r.component_scores_json);
  assert.deepStrictEqual([cs.pullups.score, cs.parallel_bars.score, cs.trap_bar.score, cs.run150x2.score, cs.run3km.score], [100, 100, 100, 80, 76]); assert.ok(close(Number(r.weighted_score), 90.8)); assert.strictEqual(byId(r).weighted_display, '90.8');
  assert.throws(() => X.Fitness.typeSetVariant(admin, reg.id, 'pullups', NONE, 'N6'), /VALIDATION|לא ניתן/); r = rec(S.S.a); assert.ok(close(Number(r.weighted_score), 90.8), 'rejected selection changed nothing');
  r = rec(S.S.a2); cs = JSON.parse(r.component_scores_json); assert.deepStrictEqual([cs.pullups.score, cs.parallel_bars.score, cs.trap_bar.score, cs.run150x2.score, cs.run3km.score], [85, 100, 100, 100, 97]); assert.ok(close(Number(r.weighted_score), 96.1));
  // the old Trap Bar formula (100-10*(10-reps)) is gone: 9 reps = 95 from the table (the old formula gave 90)
  assert.strictEqual(X.Calc.trapBarScore, undefined);
});
t('integration', '11. one soldier\'s score is not affected by the other gender\'s table (edit / remove the girls table: boys score unchanged, and vice versa)', () => {
  const S = setup(); const { X, admin, c1 } = S; const reg = X.Fitness.typesList(admin, c1).find(x => !x.is_opening);
  const raw = { pullups: 12, parallel_bars: 9, trap_bar: 7, run150x2: '00:55', run3km: '14:10' };
  const score = (sol) => { const r = X.Records.create(admin, 'FitnessTests', c1, Object.assign({ request_id: S.rid(), soldier_id: sol.id, test_date: '2026-11-0' + (1 + Math.floor(Math.random() * 8)), test_type_id: reg.id }, raw)).record; return { w: r.weighted_score, c: JSON.parse(r.component_scores_json) }; };
  const full = X.Fitness.importDraft(admin, c1, {}); X.Fitness.approve(admin, full.id, { verified_against_source: true, reason: 'אומת' }); const b0 = score(S.S.a), g0 = score(S.S.a2);
  assert.ok(b0.w !== '' && g0.w !== ''); assert.notStrictEqual(b0.w, g0.w);
  // a version where the GIRLS rows were changed (draft edit) -> boys identical, girls different
  const alt = X.Fitness.importDraft(admin, c1, {}); const row = X.Db.where('FitnessScoringRows', r => r.version_id === alt.id && r.gender === 'F' && r.component === 'run3km' && Number(r.score) === 89)[0];
  X.Fitness.editRow(admin, alt.id, row.id, { score: 89.5 }, 'בדיקה: שינוי סינתטי בטבלת הבנות בלבד (14:10 נופל בשורה זו)'); assert.deepStrictEqual(X.Fitness.versionIssues_(alt), []);
  X.Fitness.approve(admin, alt.id, { verified_against_source: true, reason: 'בדיקה' });
  const b1 = score(S.S.a), g1 = score(S.S.a2); assert.strictEqual(b1.w, b0.w, 'boys: unchanged by the girls table'); assert.deepStrictEqual(b1.c, b0.c); assert.notStrictEqual(g1.w, g0.w, 'girls: do change when their own table changes'); assert.strictEqual(g1.c.run3km.score, 89.5);
  // versions that contain only one gender: the other gender gets no table at all (never the wrong table)
  const onlyM = X.Fitness.importDraft(admin, c1, { sheets: ['M'] }); X.Fitness.approve(admin, onlyM.id, { verified_against_source: true, reason: 'בדיקה' });
  const bm = score(S.S.a), gm = score(S.S.a2); assert.strictEqual(bm.w, b0.w); assert.strictEqual(gm.w, ''); assert.ok(comps.every(c => gm.c[c].reason === 'no_table'));
  const onlyF = X.Fitness.importDraft(admin, c1, { sheets: ['F'] }); X.Fitness.approve(admin, onlyF.id, { verified_against_source: true, reason: 'בדיקה' });
  const bf = score(S.S.a), gf = score(S.S.a2); assert.strictEqual(bf.w, ''); assert.ok(comps.every(c => bf.c[c].reason === 'no_table')); assert.strictEqual(gf.w, g0.w, 'girls: same as with the full version');
});
t('integration', 'labels & terms: the 300 m component is named "ריצת הלוך־חזור 300 מ׳"; no "עליות און" anywhere in code or UI; weights unchanged', () => {
  const S = S0(); const { X } = S; assert.strictEqual(X.Fitness.LABELS.run150x2, 'ריצת הלוך־חזור 300 מ׳'); assert.strictEqual(X.Fitness.LABELS.pullups, 'מתח');
  const fs = require('fs'), path = require('path'); const root = path.join(__dirname, '..', 'src');
  fs.readdirSync(root).forEach(f => { const txt = fs.readFileSync(path.join(root, f), 'utf8'); assert.ok(!txt.includes('עליות און'), f); });
  const ui = fs.readFileSync(path.join(root, 'Index.html'), 'utf8'); assert.ok(ui.includes('ריצת הלוך־חזור 300 מ׳') && ui.includes('דקות:שניות'), 'UI labels: time entered as mm:ss');
  assert.deepStrictEqual(S.opening.weights, { pullups: 20, parallel_bars: 20, trap_bar: 20, run3km: 40 }, 'opening weights untouched');
});
done();
