// Regression — duplicates INSIDE one import file (reported bug): two identical result rows of the same job were both 'ok' and both created.
// Rule: the first identical row stays 'ok'; the 2nd and later are 'duplicate' (nothing stored for them at Commit). Differences in soldier / date / test type / any value are NOT duplicates.
// Exams are intentionally unchanged (the normal attempt rules reject the repeated attempt: row error at Commit, never two records).
const { suite } = require('./tlib'); const { t, done, assert } = suite('v1_import_infile.js'); const { setup } = require('./fixture');
const SM = { personal_number: 'מ.א', full_name: 'שם', gender: 'מין', department: 'מחלקה', team: 'צוות', pakal: 'פקל', enlistment_date: 'גיוס' };
const FM = { personal_number: 'מ', test_date: 'ת', test_type: 'ס', pullups: 'מ1', parallel_bars: 'מ2', trap_bar: 'מ3', run150x2: 'מ4', run3km: 'מ5' };
const NM = { personal_number: 'מ', test_date: 'ת', navigation_type: 'ס', distance_km: 'ק', plan_score: 'ת1', debrief_score: 'ת2', points_completed: 'נ1', points_total: 'נ2' };
const MM = { personal_number: 'מ', test_date: 'ת', weapon_type: 'נ', distance_m: 'ר', examiner_score: 'צ', ylm_score: 'י', weapon_zeroed: 'א' };
const EM = { personal_number: 'מ', exam: 'מ1', attempt: 'מו', attempt_date: 'ת', score: 'צ' };
const fr = (pn, o) => Object.assign({ 'מ': pn, 'ת': '2026-03-01', 'ס': 'מבחן רגיל', 'מ1': 8, 'מ2': 20, 'מ3': 60, 'מ4': '00:36', 'מ5': '12:00' }, o || {});
const nr = o => Object.assign({ 'מ': '8001', 'ת': '2026-03-01', 'ס': 'ניווט א', 'ק': 3, 'ת1': 4, 'ת2': 4, 'נ1': 2, 'נ2': 3 }, o || {});
const mr = o => Object.assign({ 'מ': '8001', 'ת': '2026-03-01', 'נ': 'M16', 'ר': 100, 'צ': 80, 'י': '', 'א': 'כן' }, o || {});
const er = o => Object.assign({ 'מ': '8001', 'מ1': 'מבחן', 'מו': 'A', 'ת': '2026-03-01', 'צ': 80 }, o || {});
function world() {
  const S = setup(), { X, admin, c1, o1 } = S; const dep = o1.departments[0], team = o1.teams.find(x => x.department_id === dep.id);
  const rows = []; for (let i = 1; i <= 10; i++) rows.push({ 'מ.א': String(8000 + i), 'שם': 'חייל ' + i, 'מין': i % 2 ? 'זכר' : 'נקבה', 'מחלקה': dep.name, 'צוות': team.name, 'פקל': '', 'גיוס': '' });
  X.Import.commit(admin, X.Import.start(admin, c1, { target: 'soldiers', file_name: 's.xlsx', mapping: SM, rows }).id, true);
  X.Navigation.typeCreate(admin, c1, 'ניווט א'); X.Navigation.typeCreate(admin, c1, 'ניווט ב'); X.Exams.defCreate(admin, c1, { name: 'מבחן' });
  S.imp = (target, mapping, rows) => X.Import.start(admin, c1, { target, file_name: 'f' + Math.random() + '.xlsx', mapping, rows });
  S.st = j => j.rows.map(r => r.status); S.cc = j => [j.counts.ok, j.counts.duplicate, j.counts.error]; S.n = tb => X.Db.all(tb).length;
  S.commitProves = (j, table, created, rowsAfter) => { const before = S.n(table), sum = X.Import.commit(admin, j.id, true); assert.strictEqual(sum.created, created, 'Commit created ' + created); assert.strictEqual(S.n(table) - before, created, 'table grew by exactly ' + created); assert.strictEqual(rowsAfter, S.n(table)); return sum; };
  return S;
}
t('integration', 'fitness: 2 identical rows in one file → 1st ok, 2nd duplicate; COMMIT creates exactly ONE record (not just the preview)', () => {
  const S = world(), { X, admin } = S; const j = S.imp('fitness', FM, [fr('8001'), fr('8001')]);
  assert.deepStrictEqual(S.st(j), ['ok', 'duplicate']); assert.deepStrictEqual(S.cc(j), [1, 1, 0]); assert.ok(j.rows[1].issues[0].includes('שורה 1'), 'points at the first row');
  assert.strictEqual(S.n('FitnessTests'), 0, 'preview writes nothing'); S.commitProves(j, 'FitnessTests', 1, 1);
  const stored = X.Db.where('ImportRows', r => r.job_id === j.id).sort((a, b) => a.row_no - b.row_no); assert.deepStrictEqual(stored.map(r => r.status), ['committed', 'duplicate']); assert.strictEqual(stored[1].committed_record_id, '');
  assert.strictEqual(X.Db.all('FitnessTests').filter(r => r.record_status === 'active').length, 1);
});
t('integration', 'fitness: 3 identical rows → ok, duplicate, duplicate; Commit creates ONE; a mixed file keeps order (A,A,B,A,B → ok,dup,ok,dup,dup)', () => {
  const S = world(); const j = S.imp('fitness', FM, [fr('8001'), fr('8001'), fr('8001')]); assert.deepStrictEqual(S.st(j), ['ok', 'duplicate', 'duplicate']); assert.deepStrictEqual(S.cc(j), [1, 2, 0]); S.commitProves(j, 'FitnessTests', 1, 1);
  const k = S.imp('fitness', FM, [fr('8002'), fr('8002'), fr('8003'), fr('8002'), fr('8003')]); assert.deepStrictEqual(S.st(k), ['ok', 'duplicate', 'ok', 'duplicate', 'duplicate']); S.commitProves(k, 'FitnessTests', 2, 3);
});
t('integration', 'fitness: rows differing in ONE thing are NOT duplicates — each of the five components, the soldier, the date, the test type (all ok; Commit creates all)', () => {
  const S = world(); const v = [['מ1', 9], ['מ2', 21], ['מ3', 61], ['מ4', '00:37'], ['מ5', '12:01'], ['מ', '8002'], ['ת', '2026-03-02'], ['ס', 'מבחן פתיחה']];
  v.forEach(([k, val], i) => { const base = fr(String(8001 + i), { 'מ4': '' }), other = Object.assign({}, base, { [k]: val === '8002' ? '8010' : val });   /* a fresh soldier per case, so nothing committed earlier can match */ const j = S.imp('fitness', FM, [base, other]); assert.deepStrictEqual(S.cc(j), [2, 0, 0], 'differs in ' + k); const b = S.n('FitnessTests'); S.commitProves(j, 'FitnessTests', 2, b + 2); });
  const j = S.imp('fitness', FM, [fr('8004'), fr('8004', { 'מ1': 9 }), fr('8004', { 'מ1': 10 })]); assert.deepStrictEqual(S.st(j), ['ok', 'ok', 'ok']);
});
t('integration', 'fitness: equivalent representations in one file are the same row (8 vs "8.0", blank vs "")', () => {
  const S = world(); const j = S.imp('fitness', FM, [fr('8001', { 'מ4': '' }), fr('8001', { 'מ1': '8.0', 'מ4': '' })]); assert.deepStrictEqual(S.st(j), ['ok', 'duplicate']); S.commitProves(j, 'FitnessTests', 1, 1);
});
t('integration', 'fitness: in-file check + existing records: identical to an ACTIVE record → every copy duplicate; against a CANCELLED record → first ok, rest duplicate', () => {
  const S = world(), { X, admin } = S; X.Import.commit(admin, S.imp('fitness', FM, [fr('8001')]).id, true);
  const j = S.imp('fitness', FM, [fr('8001'), fr('8001'), fr('8001')]); assert.deepStrictEqual(S.st(j), ['duplicate', 'duplicate', 'duplicate']); S.commitProves(j, 'FitnessTests', 0, 1);
  const rec = X.Db.all('FitnessTests')[0]; X.Records.cancel(admin, 'FitnessTests', rec.id, 'בדיקה');
  const k = S.imp('fitness', FM, [fr('8001'), fr('8001'), fr('8001')]); assert.deepStrictEqual(S.st(k), ['ok', 'duplicate', 'duplicate'], 'cancelled is not an active duplicate'); S.commitProves(k, 'FitnessTests', 1, 2);
  assert.strictEqual(X.Db.all('FitnessTests').filter(r => r.record_status === 'active').length, 1);
});
t('integration', 'navigation: same bug existed → 2/3 identical rows: 1st ok, rest duplicate, Commit creates ONE; any single differing field (value / date / type / soldier) is not a duplicate', () => {
  const S = world(); const j = S.imp('navigation', NM, [nr(), nr(), nr()]); assert.deepStrictEqual(S.st(j), ['ok', 'duplicate', 'duplicate']); S.commitProves(j, 'NavigationTests', 1, 1);
  [{ 'ק': 4 }, { 'ת1': 3 }, { 'ת2': 3 }, { 'נ1': 1 }, { 'נ2': 4 }, { 'ת': '2026-03-02' }, { 'ס': 'ניווט ב' }, { 'מ': '8002' }].forEach(o => { const k = S.imp('navigation', NM, [nr({ 'מ': '8005' }), nr(Object.assign({ 'מ': '8005' }, o))]); assert.deepStrictEqual(S.cc(k), [2, 0, 0], 'nav differs ' + JSON.stringify(o)); });
  const x = S.imp('navigation', NM, [nr({ 'מ': '8006' }), nr({ 'מ': '8006' }), nr({ 'מ': '8007' })]); assert.deepStrictEqual(S.st(x), ['ok', 'duplicate', 'ok']); S.commitProves(x, 'NavigationTests', 2, 3);
});
t('integration', 'marksmanship: same bug existed → identical rows: 1st ok, rest duplicate, Commit creates ONE; differing field is not a duplicate', () => {
  const S = world(); const j = S.imp('marksmanship', MM, [mr(), mr(), mr()]); assert.deepStrictEqual(S.st(j), ['ok', 'duplicate', 'duplicate']); S.commitProves(j, 'MarksmanshipTests', 1, 1);
  [{ 'צ': 81 }, { 'ת': '2026-03-02' }, { 'ר': 50 }, { 'א': 'לא' }, { 'נ': 'Tavor' }, { 'מ': '8002' }].forEach(o => { const k = S.imp('marksmanship', MM, [mr({ 'מ': '8005' }), mr(Object.assign({ 'מ': '8005' }, o))]); assert.deepStrictEqual(S.cc(k), [2, 0, 0], 'marks differs ' + JSON.stringify(o)); });
});
t('integration', 'theoretical exams UNCHANGED: a repeated attempt in one file is not keyed in preview (both ok); at Commit the normal attempt rules reject the 2nd as a row error — exactly ONE record, job partial', () => {
  const S = world(), { X, admin } = S; const j = S.imp('exams', EM, [er(), er()]); assert.deepStrictEqual(S.st(j), ['ok', 'ok'], 'current behaviour preserved');
  const sum = X.Import.commit(admin, j.id, true); assert.deepStrictEqual([sum.created, sum.failed], [1, 1]); assert.strictEqual(S.n('TheoreticalExamAttempts'), 1); assert.strictEqual(X.Db.get('ImportJobs', j.id).status, 'partial');
  const rows = X.Db.where('ImportRows', r => r.job_id === j.id).sort((a, b) => a.row_no - b.row_no); assert.deepStrictEqual(rows.map(r => r.status), ['committed', 'error']);
});
t('hardening', 'double commit of the same Import Job is still refused and creates nothing (job guard unchanged), also for a job that had in-file duplicates', () => {
  const S = world(), { X, admin, code } = S; const j = S.imp('fitness', FM, [fr('8001'), fr('8001')]); X.Import.commit(admin, j.id, true); assert.strictEqual(code(() => X.Import.commit(admin, j.id, true)), 'VALIDATION'); assert.strictEqual(S.n('FitnessTests'), 1);
  const nj = S.imp('navigation', NM, [nr(), nr()]); X.Import.commit(admin, nj.id, true); assert.strictEqual(code(() => X.Import.commit(admin, nj.id, true)), 'VALIDATION'); assert.strictEqual(S.n('NavigationTests'), 1);
});
done();
