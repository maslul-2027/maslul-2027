// product-dev5 / F-1: a correction request on FitnessTests must snapshot the PREVIOUS component values from raw_values_json (they are not columns).
// Covers all five components. Other tables' behaviour is covered by pd2_corrections.js (unchanged). Node only, in-memory, synthetic data.
const { suite } = require(process.env.TLIB || './tlib'); const { t, done, assert } = suite('pd5_f1_fitness_snapshot.js'); const { setup } = require('./fixture');
const COMP = [['pullups', '7', '8', 'מתח'], ['parallel_bars', '12', '13', 'מקבילים'], ['trap_bar', '9', '10', 'Trap Bar'], ['run150x2', '00:50', '00:48', '150×2'], ['run3km', '13:00', '12:30', '3 ק״מ']];
const ALL = { pullups: '7', parallel_bars: '12', trap_bar: '9', run150x2: '00:50', run3km: '13:00' };
function S0() {
  const S = setup(), { X, admin, c1 } = S; S.reg = X.Fitness.typesList(admin, c1).find(x => !x.is_opening);
  S.mkRec = (ctx, raw, sol) => X.Records.create(ctx, 'FitnessTests', c1, Object.assign({ request_id: S.rid(), soldier_id: (sol || S.S.a).id, test_date: '2026-11-09', test_type_id: S.reg.id }, raw)).record;
  S.cmd = S.cC;   // commander with course scope; owns the records he creates
  S.pending = () => X.Records.listCorrections(admin, c1, 'pending');
  return S;
}
COMP.forEach(([k, prev, next, he]) => {
  t('integration', k + ' (' + he + '): single-component request keeps the exact previous value; other components are not in the snapshot', () => {
    const S = S0(), { X } = S; const r = S.mkRec(S.cmd, ALL);
    const req = X.Records.requestCorrection(S.cmd, 'FitnessTests', r.id, { [k]: next }, 'תיקון');
    assert.deepStrictEqual(JSON.parse(req.before_json), { [k]: prev }); const row = S.pending()[0];
    assert.deepStrictEqual(row.before, { [k]: prev }); assert.strictEqual(row.has_snapshot, true);
  });
  t('integration', k + ': missing previous value is saved as missing (empty string), NOT zero', () => {
    const S = S0(), { X } = S; const others = Object.assign({}, ALL); delete others[k]; const r = S.mkRec(S.cmd, others);
    X.Records.requestCorrection(S.cmd, 'FitnessTests', r.id, { [k]: next }, 'השלמה');
    const b = S.pending()[0].before; assert.strictEqual(b[k], ''); assert.notStrictEqual(b[k], 0); assert.notStrictEqual(b[k], '0'); assert.ok(k in b);
  });
  t('integration', k + ': snapshot does not change when the record is changed after the request; reject leaves the record untouched', () => {
    const S = S0(), { X, admin, c1 } = S; const r = S.mkRec(S.cmd, ALL);
    const req = X.Records.requestCorrection(S.cmd, 'FitnessTests', r.id, { [k]: next }, 'תיקון'); const snap = S.pending()[0].before;
    X.Records.adminEdit(admin, 'FitnessTests', r.id, { [k]: prev === '7' ? '6' : '11' === prev ? '10' : (k === 'run3km' ? '14:00' : k === 'run150x2' ? '00:55' : '5') }, 'עריכת מנהל');
    assert.deepStrictEqual(S.pending()[0].before, snap, 'snapshot frozen at request time'); assert.deepStrictEqual(S.pending()[0].before, { [k]: prev });
    const rawBefore = X.Db.get('FitnessTests', r.id).raw_values_json; X.Records.reviewCorrection(admin, req.id, 'reject', 'לא מאושר');
    assert.strictEqual(X.Db.get('FitnessTests', r.id).raw_values_json, rawBefore, 'reject must not change the record'); assert.strictEqual(X.Db.get('CorrectionRequests', req.id).status, 'rejected');
  });
  t('integration', k + ': approve changes the value and produces valid history (before/after of the edit, CORRECTION_REQUEST + CORRECTION_APPLIED)', () => {
    const S = S0(), { X, admin, c1 } = S; const r = S.mkRec(S.cmd, ALL);
    const req = X.Records.requestCorrection(S.cmd, 'FitnessTests', r.id, { [k]: next }, 'תיקון'); X.Records.reviewCorrection(admin, req.id, 'approve', 'אושר');
    const raw = JSON.parse(X.Db.get('FitnessTests', r.id).raw_values_json); assert.strictEqual(String(raw[k]), next);
    COMP.filter(c => c[0] !== k).forEach(c => assert.strictEqual(String(raw[c[0]]), ALL[c[0]], 'other components intact: ' + c[0]));
    const h = X.Records.history(admin, 'FitnessTests', r.id); const acts = h.map(x => x.action); assert.ok(acts.indexOf('CORRECTION_REQUEST') !== -1 && acts.indexOf('CORRECTION_APPLIED') !== -1, acts.join(','));
    const ap = h.find(x => x.action === 'CORRECTION_APPLIED'); const js = v => typeof v === 'string' ? JSON.parse(v) : v; const bef = js(ap.before_json !== undefined ? ap.before_json : ap.before), aft = js(ap.after_json !== undefined ? ap.after_json : ap.after);
    assert.strictEqual(String(JSON.parse(bef.raw_values_json)[k]), prev, 'history before'); assert.strictEqual(String(JSON.parse(aft.raw_values_json)[k]), next, 'history after');
  });
});
t('integration', 'multi-component request: ALL previous values are kept (incl. one that was missing)', () => {
  const S = S0(), { X } = S; const o = Object.assign({}, ALL); delete o.trap_bar; const r = S.mkRec(S.cmd, o);
  X.Records.requestCorrection(S.cmd, 'FitnessTests', r.id, { pullups: '8', trap_bar: '10', run3km: '12:30', run150x2: '00:48', parallel_bars: '13' }, 'תיקון מרוכז');
  assert.deepStrictEqual(S.pending()[0].before, { pullups: '7', trap_bar: '', run3km: '13:00', run150x2: '00:50', parallel_bars: '12' });
});
t('integration', 'mixed request: a column field (notes) and a component are both snapshotted correctly', () => {
  const S = S0(), { X } = S; const r = S.mkRec(S.cmd, Object.assign({ notes: 'ישן' }, ALL));
  X.Records.requestCorrection(S.cmd, 'FitnessTests', r.id, { notes: 'חדש', pullups: '9' }, 'מעורב'); assert.deepStrictEqual(S.pending()[0].before, { notes: 'ישן', pullups: '7' });
});
t('integration', 'legacy request with empty / missing / malformed before_json lists safely (before=null, has_snapshot=false); no previous value is invented; still approvable', () => {
  const S = S0(), { X, admin, c1 } = S;
  [undefined, '', '   ', 'not json'].forEach((bj, i) => {
    const r = S.mkRec(S.cmd, ALL, [S.S.a, S.S.a2, S.S.b, S.S.c][i]); const id = X.Util.uuid();
    const row = { id, course_id: c1, table_name: 'FitnessTests', record_id: r.id, changes_json: JSON.stringify({ pullups: '8' }), reason: 'ישן', requested_by: S.cmd.email, requested_at: X.Util.nowIso(), status: 'pending' }; if (bj !== undefined) row.before_json = bj; X.Db.insert('CorrectionRequests', row);
    const l = X.Records.listCorrections(admin, c1, 'pending').find(x => x.id === id); assert.strictEqual(l.before, null, JSON.stringify(bj)); assert.strictEqual(l.has_snapshot, false);
    X.Records.reviewCorrection(admin, id, 'approve', 'ok'); assert.strictEqual(String(JSON.parse(X.Db.get('FitnessTests', r.id).raw_values_json).pullups), '8');
  });
});
t('integration', 'other tables unchanged: no snapshotSource on navigation/marksmanship/exam types; navigation snapshot still reads columns', () => {
  const S = S0(), { X } = S; ['NavigationTests', 'MarksmanshipTests', 'TheoreticalExamAttempts', 'ExamMeetings', 'SoldierEvents', 'ReadinessRecords', 'AttendanceEvents', 'Marches', 'AttendanceRecords', 'MarchAttendance'].forEach(n => { const ty = X.Records.typeFor_(n); assert.strictEqual(typeof ty.snapshotSource, 'undefined', n); });
  assert.strictEqual(typeof X.Records.typeFor_('FitnessTests').snapshotSource, 'function');
});
t('integration', 'permissions unchanged: a commander cannot request a correction on a record he did not create; a commander cannot review', () => {
  const S = S0(), { X, admin } = S; const r = S.mkRec(admin, ALL);
  assert.strictEqual(S.code(() => X.Records.requestCorrection(S.cmd, 'FitnessTests', r.id, { pullups: '8' }, 'x')), 'FORBIDDEN');
  const r2 = S.mkRec(S.cmd, ALL, S.S.b); const q = X.Records.requestCorrection(S.cmd, 'FitnessTests', r2.id, { pullups: '8' }, 'x'); assert.strictEqual(S.code(() => X.Records.reviewCorrection(S.cmd, q.id, 'approve')), 'FORBIDDEN');
});
done();
