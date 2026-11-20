// v1.0.6 — BINDING PROFESSIONAL DECISIONS on pull-ups (and their regression envelope).
//  * Boys: ONLY the "אפוד אישי 7 ק״ג" table, in EVERY test type. "ללא משקל חיצוני" is not a scoring track for boys. Table ends at 15; more => review, no automatic score, no clamping, no other table.
//  * Girls: 1 rep = 40 (APPROVED PROFESSIONAL DECISION N1, not a value copied from the source), 0 reps = no automatic score (review).
//  * missing vs zero vs out-of-range stay separate reasons. No silent fallback between tables.
//  * everything else is unchanged from v1.0.5 (frozen v1.0.5 tables in tests/fixtures are compared row by row; boundaries of every other table re-scored).
const { suite } = require(process.env.TLIB || './tlib'); const { t, done, assert } = suite('v106_pullups.js'); const { setup } = require('./fixture');
const fs = require('fs'), path = require('path');
const NONE = 'ללא משקל חיצוני', VEST = 'אפוד אישי 7 ק״ג', BAND = 'בסיוע גומי';
const VEST_TABLE = [[15, 100], [14, 95], [13, 90], [12, 85], [11, 80], [10, 75], [9, 70], [8, 65], [7, 60], [6, 55], [5, 55], [4, 50], [3, 50], [2, 45], [1, 40]];   // hand-typed from the 7 kg image
const FROZEN = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'fitness_scoring_v105_frozen.json'), 'utf8')).tables;
const W5 = { pullups: 20, parallel_bars: 20, trap_bar: 20, run150x2: 10, run3km: 30 };
function S0() {
  const S = setup(), { X, admin, c1 } = S;
  S.regular = X.Fitness.typesList(admin, c1).find(x => !x.is_opening); S.opening = X.Fitness.typesList(admin, c1).find(x => x.is_opening);
  S.custom = X.Fitness.typeCreate(admin, c1, { name: 'סוג מותאם', weights: { pullups: 40, run3km: 60 } });
  S.ver = X.Fitness.importDraft(admin, c1, {}); X.Fitness.approve(admin, S.ver.id, { verified_against_source: true, reason: 'בדיקה' });
  S.cs = (g, c, raw) => X.Fitness.componentScore_(X.Db.get('FitnessScoringVersions', S.ver.id), g, c, raw, {});
  S.rec = (sol, typeId, raw, date) => X.Records.create(admin, 'FitnessTests', c1, Object.assign({ request_id: S.rid(), soldier_id: sol.id, test_date: date || '2026-11-09', test_type_id: typeId }, raw)).record;
  return S;
}
const sec2 = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');

t('unit', '1. boy, EVERY test type (regular, opening, custom): pull-ups are scored by the 7 kg table — even when a legacy no-weight / band / garbage variant is persisted on the type', () => {
  const S = S0(), { X, admin } = S;
  [S.regular.id, S.opening.id, S.custom.id].forEach(typeId => {
    ['', NONE, BAND, 'משהו אחר'].forEach(legacy => {
      X.Db.update('FitnessTestTypes', typeId, { variants_json: legacy ? JSON.stringify({ pullups: legacy }) : '{}' });   // legacy persisted configuration is ignored
      const type = X.Db.get('FitnessTestTypes', typeId), raw = { pullups: 15, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' };
      const r = X.Fitness.compute_(S.c1, X.Db.get('Soldiers', S.S.a.id), type, raw, S.ver.id);
      assert.strictEqual(r.component_scores.pullups.reason, 'ok'); assert.strictEqual(r.component_scores.pullups.score, 100, 'type ' + type.name + ' legacy=' + legacy);
    });
    VEST_TABLE.forEach(([reps, score]) => { const type = X.Db.get('FitnessTestTypes', typeId); const r = X.Fitness.compute_(S.c1, X.Db.get('Soldiers', S.S.a.id), type, { pullups: reps, run3km: '13:00', parallel_bars: 1, trap_bar: 1, run150x2: '00:50' }, S.ver.id); assert.strictEqual(r.component_scores.pullups.score, score, 'reps ' + reps); });
  });
  // end to end through the record API as well
  [S.regular.id, S.opening.id].forEach(typeId => { const w = X.Util.parseJson(X.Db.get('FitnessTestTypes', typeId).weights_json, {}); const raw = { pullups: 10 }; Object.keys(w).forEach(c => { if (c !== 'pullups') raw[c] = { parallel_bars: 10, trap_bar: 5, run150x2: '00:50', run3km: '13:00' }[c]; });
    const r = S.rec(S.S.a, typeId, raw, '2026-11-1' + (typeId === S.regular.id ? 1 : 2)); assert.strictEqual(JSON.parse(r.component_scores_json).pullups.score, 75); });
});
t('hardening', '2. selecting the no-weight pull-up track for a boy is REJECTED (typeSetVariant, addTable, importing / approving a version that contains it); nothing is stored', () => {
  const S = S0(), { X, admin, code } = S;
  const before = X.Db.get('FitnessTestTypes', S.regular.id).variants_json;
  [NONE, BAND, 'x'].forEach(v => assert.strictEqual(code(() => X.Fitness.typeSetVariant(admin, S.regular.id, 'pullups', v, 'ניסיון')), 'VALIDATION', v));
  assert.strictEqual(code(() => X.Fitness.typeSetVariant(admin, S.regular.id, 'parallel_bars', NONE, 'ניסיון')), 'VALIDATION'); assert.strictEqual(X.Db.get('FitnessTestTypes', S.regular.id).variants_json, before, 'nothing stored');
  const msg = (() => { try { X.Fitness.typeSetVariant(admin, S.regular.id, 'pullups', NONE, 'ניסיון'); } catch (e) { return e.message; } })(); assert.ok(/[א-ת]/.test(msg) && /אפוד/.test(msg) && !/undefined|\bat \w+\(/.test(msg), msg);
  // via the API endpoint too
  X.Auth._emailProvider = () => 'admin@x.com'; const api = X.api('fitness.typeVariant', { id: S.regular.id, component: 'pullups', variant: NONE, reason: 'ניסיון' }); assert.strictEqual(api.ok, false);
  // a new DRAFT version: addTable with a boys no-weight pull-up table is refused; a girls table with the same name is fine
  const v = X.Fitness.importDraft(admin, S.c1, { label: 'v-new' });
  assert.strictEqual(code(() => X.Fitness.addTable(admin, v.id, { gender: 'M', component: 'pullups', variant: NONE, reason: 'ניסיון', rows: [{ score: 100, from: 20, to: 20 }, { score: 40, from: 1, to: 19 }] })), 'VALIDATION');
  assert.strictEqual(code(() => X.Fitness.addTable(admin, v.id, { gender: 'M', component: 'pullups', variant: '', reason: 'ניסיון', rows: [{ score: 100, from: 15, to: 15 }] })), 'VALIDATION', 'a boys pull-up table without the vest variant is refused as well');
  // a version that somehow contains the forbidden table (inserted behind the API's back) cannot be approved
  const v2 = X.Fitness.importDraft(admin, S.c1, { label: 'v-forged' }); X.Db.insert('FitnessScoringRows', { id: X.Util.uuid(), version_id: v2.id, gender: 'M', component: 'pullups', variant: NONE, score: 100, from_value: 20, to_value: 20, created_at: X.Util.nowIso(), kind: 'reps', sheet: 'M', row_no: 1, flag: '' });
  assert.strictEqual(code(() => X.Fitness.approve(admin, v2.id, { verified_against_source: true, reason: 'ניסיון' })), 'VALIDATION', 'forbidden table blocks approval'); assert.strictEqual(X.Db.get('FitnessScoringVersions', v2.id).status, 'DRAFT');
  // and even if such rows existed in an approved version, they are NEVER used: boys fall to no_table only if the vest table is missing (no fallback to the no-weight table)
  const only = X.Db.where('FitnessScoringRows', r => r.version_id === S.ver.id && r.gender === 'M' && r.component === 'pullups' && r.variant === VEST); assert.strictEqual(only.length, 13);
});
t('unit', '3. importing the draft: the boys no-weight table is NOT imported (historical source only); the vest table is; the transcription still carries the historical table as excluded', () => {
  const S = S0(), { X } = S; const rows = X.Db.where('FitnessScoringRows', r => r.version_id === S.ver.id);
  assert.strictEqual(rows.filter(r => r.gender === 'M' && r.component === 'pullups' && r.variant === NONE).length, 0, 'no boys no-weight rows');
  assert.strictEqual(rows.filter(r => r.gender === 'M' && r.component === 'pullups').every(r => r.variant === VEST), true);
  assert.strictEqual(rows.length, 219); const hist = X.FITNESS_DRAFT.tables.find(t => t.id === 'pullups_M_none'); assert.ok(hist && hist.excluded && /אין מסלול/.test(hist.excluded), 'kept as excluded historical material');
  const src = X.Fitness.draftSource(S.admin); assert.ok(src.tables.find(t => t.id === 'pullups_M_none'), 'draft source listing keeps it'); assert.ok(src.tables.find(t => t.id === 'pullups_M_vest'));
});
t('unit', '4. boy, 15 reps = 100 (computed from the table); every row 1..15 per the table; 16 / 20 / 21 / 500 => review (out_of_range), NO score, no clamp to 100, no switch to another table', () => {
  const S = S0(); assert.strictEqual(S.cs('M', 'pullups', 15).score, 100); VEST_TABLE.forEach(([reps, score]) => assert.strictEqual(S.cs('M', 'pullups', reps).score, score, 'reps ' + reps));
  [16, 17, 20, 21, 25, 500].forEach(n => { const r = S.cs('M', 'pullups', n); assert.strictEqual(r.score, null, n); assert.strictEqual(r.reason, 'out_of_range', n); });
  // 20 would be 100 on the (excluded) no-weight table and 95 on the girls band table: neither is used
  assert.notStrictEqual(S.cs('M', 'pullups', 20).score, 100); assert.notStrictEqual(S.cs('M', 'pullups', 19).score, 95);
  const { X, admin } = S; const r = S.rec(S.S.a, S.regular.id, { pullups: 16, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' }); assert.strictEqual(r.weighted_score, '');
  const row = X.Fitness.list(admin, S.c1, {}).find(x => x.id === r.id); assert.strictEqual(row.weighted_display, 'נדרשת בדיקה — ערך מחוץ לטווח הטבלה'); assert.strictEqual(row.component_status.pullups, 'מחוץ לטווח הטבלה — נדרשת בדיקה');
});
t('unit', '5. girls: one rep = 40 (approved professional decision N1); 0 reps => review, no automatic score; rest of the girls table unchanged', () => {
  const S = S0(), { X } = S; assert.strictEqual(S.cs('F', 'pullups', 1).score, 40); assert.strictEqual(S.cs('F', 'pullups', 1).reason, 'ok');
  const z = S.cs('F', 'pullups', 0); assert.strictEqual(z.score, null); assert.strictEqual(z.reason, 'out_of_range'); assert.notStrictEqual(z.reason, 'not_entered', '0 reps is a value, not a missing value');
  [[2, 50], [3, 55], [4, 60], [5, 65], [6, 65], [7, 70], [8, 70], [9, 75], [10, 75], [11, 80], [13, 80], [14, 85], [16, 85], [17, 90], [18, 90], [19, 95], [20, 100]].forEach(([n, sc]) => assert.strictEqual(S.cs('F', 'pullups', n).score, sc, 'girls ' + n));
  assert.strictEqual(S.cs('F', 'pullups', 21).reason, 'out_of_range');
  // the 40 is documented as a professional decision in the stored row, the draft source and the transcription — not as a value copied from the image
  const row = X.Db.where('FitnessScoringRows', r => r.version_id === S.ver.id && r.gender === 'F' && r.component === 'pullups' && Number(r.from_value) === 1)[0]; assert.strictEqual(Number(row.score), 40); assert.strictEqual(row.flag, 'PROF_DECISION_N1');
  const tb = X.FITNESS_DRAFT.tables.find(x => x.id === 'pullups_F_band'); assert.ok(/החלטה מקצועית/.test(tb.meta.professional_decision) && /לא ערך שהועתק מהמקור/.test(tb.meta.professional_decision));
  const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'FITNESS_SCORING_TRANSCRIPTION_v1.0.3.md'), 'utf8'); assert.ok(/החלטה מקצועית מאושרת/.test(doc));
});
t('unit', '6. missing vs zero vs out-of-range stay three different things (pull-ups, both genders)', () => {
  const S = S0();
  ['M', 'F'].forEach(g => { assert.strictEqual(S.cs(g, 'pullups', '').reason, 'not_entered'); assert.strictEqual(S.cs(g, 'pullups', null).reason, 'not_entered'); assert.strictEqual(S.cs(g, 'pullups', undefined).reason, 'not_entered'); assert.strictEqual(S.cs(g, 'pullups', 0).reason, 'out_of_range'); assert.strictEqual(S.cs(g, 'pullups', 0).score, null); assert.strictEqual(S.cs(g, 'pullups', 1).reason, 'ok'); });
  assert.strictEqual(S.cs('', 'pullups', 5).reason, 'gender_missing'); assert.strictEqual(S.cs('M', 'pullups', 3.5 === 3 ? 3 : 3).reason, 'ok');
  const { X, admin, code } = S; assert.strictEqual(code(() => S.cs('M', 'pullups', 3.5)), 'VALIDATION'); assert.strictEqual(code(() => S.cs('M', 'pullups', -1)), 'VALIDATION'); assert.strictEqual(code(() => S.cs('M', 'pullups', 'abc')), 'VALIDATION');
  // a result with 0 pull-ups is stored WITHOUT a score and is not "waiting for data"
  const r = S.rec(S.S.a, S.regular.id, { pullups: 0, parallel_bars: 10, trap_bar: 5, run150x2: '00:50', run3km: '13:00' }); assert.strictEqual(r.weighted_score, ''); const row = X.Fitness.list(admin, S.c1, {}).find(x => x.id === r.id); assert.strictEqual(row.weighted_display, 'נדרשת בדיקה — ערך מחוץ לטווח הטבלה');
  const m = S.rec(S.S.a, S.regular.id, { parallel_bars: 10, trap_bar: 5, run150x2: '00:50', run3km: '13:00' }, '2026-11-10'); const row2 = X.Fitness.list(admin, S.c1, {}).find(x => x.id === m.id); assert.strictEqual(row2.weighted_display, 'ממתין להשלמת נתונים');
});
t('unit', '7. NO silent fallback between tables: a version without the vest table gives boys no_table (never the girls / any other pull-up table); a girls-only version gives boys nothing', () => {
  const S = setup(), { X, admin, c1 } = S; const v = X.Fitness.importDraft(admin, c1, {}); X.Fitness.approve(admin, v.id, { verified_against_source: true, reason: 'בדיקה' });
  X.Db.where('FitnessScoringRows', r => r.version_id === v.id && r.gender === 'M' && r.component === 'pullups').forEach(r => X.Db.update('FitnessScoringRows', r.id, { variant: BAND }));   // vest table is gone; a (mislabelled) band table for boys exists
  const ver = X.Db.get('FitnessScoringVersions', v.id);
  assert.strictEqual(X.Fitness.componentScore_(ver, 'M', 'pullups', 5, {}).reason, 'no_table'); assert.strictEqual(X.Fitness.componentScore_(ver, 'M', 'pullups', 5, { pullups: BAND }).reason, 'no_table'); assert.strictEqual(X.Fitness.componentScore_(ver, 'F', 'pullups', 5, {}).score, 65, 'girls unaffected');
  // two tables for the same (gender, component) and no policy for it => no_table, not "first one"
  X.Db.insert('FitnessScoringRows', { id: X.Util.uuid(), version_id: v.id, gender: 'F', component: 'parallel_bars', variant: 'אחר', score: 100, from_value: 1, to_value: 1, created_at: X.Util.nowIso(), kind: 'reps', sheet: 'F', row_no: 1, flag: '' });
  assert.strictEqual(X.Fitness.componentScore_(ver, 'F', 'parallel_bars', 5, {}).reason, 'no_table'); assert.strictEqual(X.Fitness.componentScore_(ver, 'F', 'parallel_bars', 5, { parallel_bars: BAND }).reason, 'no_table', 'configuration no longer selects a table');
});
t('integration', '8. REGRESSION vs frozen v1.0.5: every v1.0.5 table is identical in v1.0.6 except (a) the excluded boys no-weight table and (b) girls pull-ups 1 rep 45 -> 40', () => {
  const S = S0(), { X } = S; const rows = X.Db.where('FitnessScoringRows', r => r.version_id === S.ver.id);
  const key = t => t.gender + '|' + t.component + '|' + t.variant; const got = {}; rows.forEach(r => { (got[r.gender + '|' + r.component + '|' + r.variant] = got[r.gender + '|' + r.component + '|' + r.variant] || []).push(r); });
  const norm = (a) => a.map(r => [Number(r.score), r.from_value === '' ? null : Number(r.from_value), r.to_value === '' ? null : Number(r.to_value)]);
  let compared = 0, diffs = [];
  FROZEN.forEach(ft => {
    const g = got[key(ft)]; if (ft.id === 'pullups_M_none') { assert.strictEqual(g, undefined, 'excluded'); return; }
    assert.ok(g, ft.id + ' missing'); const a = ft.rows.map(r => [r[0], r[1], r[2]]), b = norm(g.slice().sort((x, y) => x.row_no - y.row_no)); assert.strictEqual(b.length, a.length, ft.id + ' row count');
    a.forEach((r, i) => { compared++; if (JSON.stringify(r) !== JSON.stringify(b[i])) diffs.push(ft.id + ' row ' + (i + 1) + ': ' + JSON.stringify(r) + ' -> ' + JSON.stringify(b[i])); });
  });
  assert.deepStrictEqual(diffs, ['pullups_F_band row 12: [45,1,1] -> [40,1,1]'], 'the ONLY value difference'); assert.ok(compared >= 200, 'compared ' + compared + ' rows');
  assert.strictEqual(Object.keys(got).length, FROZEN.length - 1, 'exactly one table fewer');
});
t('integration', '9. REGRESSION: boundaries of every other component/table score exactly as in frozen v1.0.5 (every row, both ends), both genders', () => {
  const S = S0(); let n = 0;
  FROZEN.forEach(ft => {
    if (ft.id === 'pullups_M_none') return;
    ft.rows.forEach((r, i) => {
      const exp = (ft.id === 'pullups_F_band' && r[1] === 1) ? 40 : r[0]; const ends = [];
      if (ft.kind === 'time') { if (r[1] !== null) ends.push(sec2(r[1])); if (r[2] !== null) ends.push(sec2(r[2])); } else { ends.push(r[1], r[2]); }
      ends.forEach(v => { const res = S.cs(ft.gender, ft.component, v); assert.strictEqual(res.reason, 'ok', ft.id + ' ' + v); assert.strictEqual(res.score, exp, ft.id + ' row ' + (i + 1) + ' value ' + v); n++; });
    });
  });
  assert.ok(n > 300, 'checked ' + n + ' boundary values');
  [['M', 'parallel_bars', 21], ['M', 'parallel_bars', 0], ['F', 'parallel_bars', 21], ['M', 'trap_bar', 11], ['M', 'trap_bar', 0], ['F', 'trap_bar', 11]].forEach(([g, c, v]) => assert.strictEqual(S.cs(g, c, v).reason, 'out_of_range', g + c + v));
  assert.strictEqual(S.cs('M', 'trap_bar', 7).score, 80); assert.strictEqual(S.cs('F', 'trap_bar', 7).score, 80, 'Trap Bar: image table, same ladder for both');
});
t('integration', '10. HISTORICAL results are untouched: stored score / version id / raw values stay; approving v1.0.6-style versions never re-scores them; only an explicit recompute does', () => {
  const S = S0(), { X, admin, c1 } = S;
  // a result stored earlier under another (old) version id with a score that today's rules would not give (old boys no-weight table: 15 pull-ups = 80)
  const legacy0 = S.rec(S.S.a, S.regular.id, { pullups: 15, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' }, '2026-01-05');
  X.Db.update('FitnessTests', legacy0.id, { component_scores_json: JSON.stringify({ pullups: { score: 80, reason: 'ok' } }), weighted_score: 86.8, scoring_version_id: 'legacy-v105-version' }); const legacy = X.Db.get('FitnessTests', legacy0.id);
  const snap = JSON.stringify(X.Db.get('FitnessTests', legacy.id));
  const v2 = X.Fitness.importDraft(admin, c1, { label: 'v-later' }); X.Fitness.approve(admin, v2.id, { verified_against_source: true, reason: 'אומת' });
  S.rec(S.S.a, S.regular.id, { pullups: 15, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' }, '2026-11-20');
  assert.strictEqual(JSON.stringify(X.Db.get('FitnessTests', legacy.id)), snap, 'historical row byte-identical'); const q = X.Fitness.dataQuality(admin, c1); assert.ok(q.results >= 2);
  assert.strictEqual(JSON.stringify(X.Db.get('FitnessTests', legacy.id)), snap, 'data-quality report did not touch it');
  assert.strictEqual(X.Fitness.summary(admin, c1, S.S.a.id).count >= 2, true);
  const list = X.Fitness.list(admin, c1, {}); assert.strictEqual(list.find(x => x.id === legacy.id).weighted_display, '86.8', 'shown as stored');
});
t('hardening', '11. girls are never affected by the boys rule and vice versa; UI source has no pull-up selector and no no-weight option', () => {
  const S = S0(), { X } = S; assert.strictEqual(S.cs('F', 'pullups', 20).score, 100); assert.strictEqual(S.cs('M', 'pullups', 20).score, null);
  const ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8'); assert.ok(!/fitness\.typeVariant/.test(ui), 'UI does not call typeVariant'); assert.ok(!/ללא משקל חיצוני/.test(ui), 'UI does not offer no-weight'); assert.ok(/מתח בנים: אפוד אישי 7 ק״ג — קבוע/.test(ui));
});
done();
