// Regression — duplicate detection in results import (reported bug): importing the SAME fitness results again in a NEW file must report 'duplicate', not 'ok'.
// Root cause: Import.prepareRow_ compared Object.keys(data) against stored columns, but fitness components are stored inside raw_values_json, not as columns.
const { suite } = require('./tlib'); const { t, done, assert } = suite('v1_import_dups.js'); const { setup } = require('./fixture');
const SM = { personal_number: 'מ.א', full_name: 'שם', gender: 'מין', department: 'מחלקה', team: 'צוות', pakal: 'פקל', enlistment_date: 'גיוס' };
const FM = { personal_number: 'מ', test_date: 'ת', test_type: 'ס', pullups: 'מ1', parallel_bars: 'מ2', trap_bar: 'מ3', run150x2: 'מ4', run3km: 'מ5' };
const REG = 'מבחן רגיל', OPEN = 'מבחן פתיחה';
const fr = (pn, o) => Object.assign({ 'מ': pn, 'ת': '2026-03-01', 'ס': REG, 'מ1': 8, 'מ2': 20, 'מ3': 60, 'מ4': '00:36', 'מ5': '12:00' }, o || {});
function world() {   // 60 soldiers imported through the real import, as in the report
  const S = setup(), { X, admin, c1, o1 } = S; const dep = o1.departments[0], team = o1.teams.find(x => x.department_id === dep.id);
  const rows = []; for (let i = 1; i <= 60; i++) rows.push({ 'מ.א': String(8000 + i), 'שם': 'חייל ' + i, 'מין': i % 2 ? 'זכר' : 'נקבה', 'מחלקה': dep.name, 'צוות': team.name, 'פקל': '', 'גיוס': '' });
  const j = X.Import.start(admin, c1, { target: 'soldiers', file_name: 's.xlsx', mapping: SM, rows }); S.j60 = j; S.s60 = X.Import.commit(admin, j.id, true);
  S.imp = (rows, file) => X.Import.start(admin, c1, { target: 'fitness', file_name: file || 'f.xlsx', mapping: FM, rows });
  S.cnt = () => X.Db.all('FitnessTests').length; S.counts = j => [j.counts.ok, j.counts.duplicate, j.counts.error];
  return S;
}
t('integration', 'reported scenario: 60 soldiers (60 ok / 60 created), 3 fitness results (3 ok / 3 created), SAME 3 in a NEW file → 3 duplicate, 0 ok, commit creates NOTHING', () => {
  const S = world(), { X, admin } = S; assert.deepStrictEqual([S.j60.counts.ok, S.j60.counts.error, S.s60.created], [60, 0, 60]);
  const rows = [fr('8001'), fr('8002'), fr('8003')]; const j1 = S.imp(rows, 'a.xlsx'); assert.deepStrictEqual(S.counts(j1), [3, 0, 0]); assert.strictEqual(X.Import.commit(admin, j1.id, true).created, 3); assert.strictEqual(S.cnt(), 3);
  const j2 = S.imp(rows, 'b.xlsx'); assert.notStrictEqual(j2.id, j1.id, 'a NEW import job'); assert.deepStrictEqual(S.counts(j2), [0, 3, 0], '3 duplicate'); assert.ok(j2.rows.every(r => r.status === 'duplicate'));
  const s2 = X.Import.commit(admin, j2.id, true); assert.strictEqual(s2.created, 0); assert.strictEqual(S.cnt(), 3, 'no extra record created'); assert.strictEqual(X.Db.all('FitnessTests').filter(r => r.record_status === 'active').length, 3);
});
t('integration', 'a changed component value is NOT a duplicate (each of the five components, separately)', () => {
  const S = world(), { X, admin } = S; X.Import.commit(admin, S.imp([fr('8001')]).id, true);
  [['מ1', 9], ['מ2', 21], ['מ3', 61], ['מ4', '00:37'], ['מ5', '12:01']].forEach(([k, v]) => { const j = S.imp([fr('8001', { [k]: v })]); assert.deepStrictEqual(S.counts(j), [1, 0, 0], 'changed ' + k + ' → ok'); });
  assert.deepStrictEqual(S.counts(S.imp([fr('8001')])), [0, 1, 0], 'unchanged → duplicate'); assert.strictEqual(S.cnt(), 1, 'previews write nothing');
});
t('integration', 'a different test type, test date or soldier is NOT a duplicate', () => {
  const S = world(), { X, admin } = S; const base = fr('8001', { 'מ4': '' }); X.Import.commit(admin, S.imp([base]).id, true);
  assert.deepStrictEqual(S.counts(S.imp([Object.assign({}, base, { 'ס': OPEN })])), [1, 0, 0], 'other type'); assert.deepStrictEqual(S.counts(S.imp([Object.assign({}, base, { 'ת': '2026-03-02' })])), [1, 0, 0], 'other date');
  assert.deepStrictEqual(S.counts(S.imp([Object.assign({}, base, { 'מ': '8002' })])), [1, 0, 0], 'other soldier'); assert.deepStrictEqual(S.counts(S.imp([base])), [0, 1, 0], 'same → duplicate');
});
t('integration', 'equivalent representations are the same result: 8 vs "8" vs "8.0", blank vs missing component (record entered through the normal path with fewer fields)', () => {
  const S = world(), { X, admin, c1 } = S; const sol = X.Db.where('Soldiers', x => x.personal_number === '8005')[0], reg = X.Fitness.typesList(admin, c1).find(x => !x.is_opening);
  X.Records.create(admin, 'FitnessTests', c1, { request_id: S.rid(), soldier_id: sol.id, test_date: '2026-03-01', test_type_id: reg.id, pullups: 8, run3km: '12:00' });   // other components never entered
  assert.deepStrictEqual(S.counts(S.imp([fr('8005', { 'מ2': '', 'מ3': '', 'מ4': '' })])), [0, 1, 0], 'blank == missing');
  assert.deepStrictEqual(S.counts(S.imp([fr('8005', { 'מ1': '8', 'מ2': '', 'מ3': '', 'מ4': '' })])), [0, 1, 0], '"8" == 8'); assert.deepStrictEqual(S.counts(S.imp([fr('8005', { 'מ1': '8.0', 'מ2': '', 'מ3': '', 'מ4': '' })])), [0, 1, 0], '8.0 == 8');
  assert.deepStrictEqual(S.counts(S.imp([fr('8005', { 'מ2': '', 'מ3': '', 'מ4': '', 'מ1': 9 })])), [1, 0, 0], 'a different value is still ok');
  assert.deepStrictEqual(S.counts(S.imp([fr('8005', { 'מ2': 20, 'מ3': '', 'מ4': '' })])), [1, 0, 0], 'an extra component that the stored record lacks is a different result');
});
t('integration', 'only ACTIVE records count: a cancelled record is not an active duplicate (re-import creates a new active one), and the next import then sees the new active one as a duplicate', () => {
  const S = world(), { X, admin } = S; const j1 = S.imp([fr('8001'), fr('8002')]); X.Import.commit(admin, j1.id, true);
  const rec = X.Db.all('FitnessTests').find(r => X.Db.get('Soldiers', r.soldier_id).personal_number === '8001'); X.Records.cancel(admin, 'FitnessTests', rec.id, 'בדיקה');
  const j2 = S.imp([fr('8001'), fr('8002')]); assert.deepStrictEqual(S.counts(j2), [1, 1, 0], 'cancelled → ok; the active one → duplicate'); assert.strictEqual(j2.rows[0].status, 'ok'); assert.strictEqual(j2.rows[1].status, 'duplicate');
  assert.strictEqual(X.Import.commit(admin, j2.id, true).created, 1); assert.strictEqual(S.cnt(), 3); assert.deepStrictEqual(S.counts(S.imp([fr('8001'), fr('8002')])), [0, 2, 0]);
});
t('integration', 'the same Import Job cannot be committed twice (job guard unchanged) and its request ids stay idempotent', () => {
  const S = world(), { X, admin, code } = S; const j = S.imp([fr('8001'), fr('8002')]); X.Import.commit(admin, j.id, true); assert.strictEqual(code(() => X.Import.commit(admin, j.id, true)), 'VALIDATION'); assert.strictEqual(S.cnt(), 2);
  const ids = X.Db.all('ImportRows').filter(r => r.job_id === j.id).map(r => r.committed_record_id); assert.strictEqual(new Set(ids).size, 2);
});
t('integration', 'other targets keep detecting duplicates on re-import in a NEW file (navigation, marksmanship, theoretical exams) and changed values / dates / types are not duplicates', () => {
  const S = world(), { X, admin, c1 } = S; X.Navigation.typeCreate(admin, c1, 'ניווט א'); X.Navigation.typeCreate(admin, c1, 'ניווט ב'); X.Exams.defCreate(admin, c1, { name: 'מבחן' });
  const imp = (target, mapping, rows) => X.Import.start(admin, c1, { target, file_name: 'x' + Math.random() + '.xlsx', mapping, rows }); const cc = j => [j.counts.ok, j.counts.duplicate, j.counts.error];
  const mapN = { personal_number: 'מ', test_date: 'ת', navigation_type: 'ס', distance_km: 'ק', plan_score: 'ת1', debrief_score: 'ת2', points_completed: 'נ1', points_total: 'נ2' };
  const nr = o => Object.assign({ 'מ': '8001', 'ת': '2026-03-01', 'ס': 'ניווט א', 'ק': 3, 'ת1': 4, 'ת2': 4, 'נ1': 2, 'נ2': 3 }, o || {});
  X.Import.commit(admin, imp('navigation', mapN, [nr()]).id, true); assert.deepStrictEqual(cc(imp('navigation', mapN, [nr()])), [0, 1, 0], 'navigation duplicate');
  [{ 'ק': 4 }, { 'ת1': 3 }, { 'נ1': 1 }, { 'ת': '2026-03-02' }, { 'ס': 'ניווט ב' }, { 'מ': '8002' }].forEach(o => assert.deepStrictEqual(cc(imp('navigation', mapN, [nr(o)])), [1, 0, 0], 'navigation changed ' + JSON.stringify(o)));
  const mapM = { personal_number: 'מ', test_date: 'ת', weapon_type: 'נ', distance_m: 'ר', examiner_score: 'צ', ylm_score: 'י', weapon_zeroed: 'א' };
  const mr = o => Object.assign({ 'מ': '8001', 'ת': '2026-03-01', 'נ': 'M16', 'ר': 100, 'צ': 80, 'י': '', 'א': 'כן' }, o || {});
  X.Import.commit(admin, imp('marksmanship', mapM, [mr()]).id, true); assert.deepStrictEqual(cc(imp('marksmanship', mapM, [mr()])), [0, 1, 0], 'marksmanship duplicate');
  [{ 'צ': 81 }, { 'ת': '2026-03-02' }, { 'ר': 50 }, { 'א': 'לא' }].forEach(o => assert.deepStrictEqual(cc(imp('marksmanship', mapM, [mr(o)])), [1, 0, 0], 'marksmanship changed ' + JSON.stringify(o)));
  const mapE = { personal_number: 'מ', exam: 'מ1', attempt: 'מו', attempt_date: 'ת', score: 'צ' }; const er = o => Object.assign({ 'מ': '8001', 'מ1': 'מבחן', 'מו': 'A', 'ת': '2026-03-01', 'צ': 80 }, o || {});
  X.Import.commit(admin, imp('exams', mapE, [er()]).id, true); const ej = imp('exams', mapE, [er()]); const before = X.Db.all('TheoreticalExamAttempts').length;
  assert.deepStrictEqual(cc(ej), [0, 0, 1], 'exams (unchanged behaviour): an identical active attempt is rejected by the normal attempt rules — as a row error, never created twice'); assert.ok(ej.rows[0].issues[0].includes('כבר קיים ניסיון A פעיל'));
  assert.strictEqual(X.Import.commit(admin, ej.id, true).created, 0); assert.strictEqual(X.Db.all('TheoreticalExamAttempts').length, before); assert.deepStrictEqual(cc(imp('exams', mapE, [er({ 'מ': '8002' })])), [1, 0, 0], 'another soldier → ok');
});
done();
