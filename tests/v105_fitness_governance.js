// v1.0.5 — fitness scoring GOVERNANCE: a draft is editable but never used; an approved version is immutable; approving a new version never changes stored results retroactively;
// every change leaves an audit trail with the reason; errors are clear Hebrew messages; the two sources of the tables agree (cross-source check, closes N3 / N2 evidence).
const { suite } = require(process.env.TLIB || './tlib'); const { t, done, assert } = suite('v105_fitness_governance.js'); const { setup } = require('./fixture');
const fs = require('fs'), path = require('path'); const NONE = 'ללא משקל חיצוני';
const FULL = { pullups: 15, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' };
const S0 = () => { const S = setup(), { X, admin, c1 } = S; S.regular = X.Fitness.typesList(admin, c1).find(x => !x.is_opening); // v1.0.6: no pull-up track configuration (boys: fixed vest table)
  S.rec = (sol, date, raw) => X.Records.create(admin, 'FitnessTests', c1, Object.assign({ request_id: S.rid(), soldier_id: sol.id, test_date: date, test_type_id: S.regular.id }, raw)).record; return S; };
const approve = (X, admin, v, reason) => X.Fitness.approve(admin, v.id, { verified_against_source: true, reason: reason || 'בדיקה' });
const rowOf = (X, vid, gender, comp, score, variant) => X.Db.where('FitnessScoringRows', r => r.version_id === vid && r.gender === gender && r.component === comp && Number(r.score) === score && (variant === undefined || r.variant === variant))[0];

t('integration', '1. a DRAFT is editable (with a reason, audited) but is NEVER used for scoring; an APPROVED version cannot be edited', () => {
  const S = S0(), { X, admin, c1, code } = S; const v = X.Fitness.importDraft(admin, c1, {}); const sol = S.S.a;
  const row = rowOf(X, v.id, 'M', 'run3km', 76); const before = Number(row.to_value);
  assert.strictEqual(code(() => X.Fitness.editRow(admin, v.id, row.id, { to_value: before + 1 }, '')), 'VALIDATION', 'reason is mandatory');
  X.Fitness.editRow(admin, v.id, row.id, { to_value: before }, 'בדיקה: אין שינוי בפועל');   // legal edit
  const audit = X.Audit.list(admin, { action: 'FITSCORING_ROW_EDIT' }); assert.ok(audit.length >= 1 && /בדיקה/.test(audit[0].reason || audit[0].reason_text || JSON.stringify(audit[0])), 'edit is in the history with its reason');
  const r1 = S.rec(sol, '2026-11-09', FULL); assert.strictEqual(r1.weighted_score, '', 'draft only => no score'); assert.strictEqual(X.Fitness.activeVersion_(c1), null);
  approve(X, admin, v); assert.strictEqual(code(() => X.Fitness.editRow(admin, v.id, row.id, { to_value: before + 1 }, 'ניסיון')), 'VALIDATION', 'approved version is immutable'); assert.strictEqual(Number(X.Db.get('FitnessScoringRows', row.id).to_value), before);
  assert.strictEqual(code(() => X.Fitness.addTable(admin, v.id, { gender: 'M', component: 'trap_bar', rows: [] })) !== null, true, 'cannot add a table to an approved version');
});
t('integration', '2. approving a structurally broken draft is refused with a clear message; the broken version stays DRAFT', () => {
  const S = S0(), { X, admin, c1, code } = S; const v = X.Fitness.importDraft(admin, c1, {}); const row = rowOf(X, v.id, 'F', 'run3km', 90);
  const r = X.Fitness.editRow(admin, v.id, row.id, { to_value: Number(row.to_value) + 5 }, 'יצירת חפיפה בכוונה'); assert.ok(r.issues.length > 0, 'the edit created an overlap/gap and the version reports issues');
  let err; try { approve(X, admin, v); } catch (e) { err = e; } assert.ok(err && err.code === 'VALIDATION' && /מבנית|ממצאים/.test(err.message) && /[א-ת]/.test(err.message), 'clear Hebrew message: ' + (err && err.message));
  assert.strictEqual(X.Db.get('FitnessScoringVersions', v.id).status, 'DRAFT'); assert.strictEqual(X.Fitness.activeVersion_(c1), null);
  assert.ok(!/undefined|\[object|Error:|at /.test(err.message), 'no technical text');
});
t('integration', '3. NO RETROACTIVE EFFECT: approving a newer version (with a changed table) leaves earlier results, their scores and scoring_version_id untouched; only an explicit "recompute" (reason, audited) re-scores', () => {
  const S = S0(), { X, admin, c1 } = S; const sol = S.S.a;
  const v1 = X.Fitness.importDraft(admin, c1, { label: 'v1' }); approve(X, admin, v1); const old = S.rec(sol, '2026-11-09', FULL); assert.strictEqual(Number(old.weighted_score), 90.8); assert.strictEqual(old.scoring_version_id, v1.id);
  const v2 = X.Fitness.importDraft(admin, c1, { label: 'v2' }); const row = rowOf(X, v2.id, 'M', 'run3km', 76);   // 13:00 is worth 76 today; the new version makes that row worth 76.5
  X.Fitness.editRow(admin, v2.id, row.id, { score: 76.5 }, 'בדיקה: שינוי ניקוד');
  approve(X, admin, v2);
  assert.strictEqual(X.Db.get('FitnessScoringVersions', v1.id).status, 'SUPERSEDED', 'history of versions is kept'); assert.strictEqual(X.Fitness.activeVersion_(c1).id, v2.id);
  const stored = X.Db.get('FitnessTests', old.id); assert.strictEqual(Number(stored.weighted_score), 90.8, 'stored score unchanged'); assert.strictEqual(stored.scoring_version_id, v1.id, 'still points to the version it was scored with');
  assert.strictEqual(Number(X.Fitness.summary(admin, c1, sol.id).mean), 90.8, 'summary shows the stored score'); assert.strictEqual(Number(X.Fitness.list(admin, c1, {})[0].weighted_score), 90.8);
  const fresh = S.rec(sol, '2026-11-10', FULL); assert.strictEqual(fresh.scoring_version_id, v2.id); assert.ok(Math.abs(Number(fresh.weighted_score) - 90.95) < 1e-9, 'new result uses the new version: ' + fresh.weighted_score);
  const q = X.Fitness.dataQuality(admin, c1); assert.strictEqual(q.scored_under_other_version, 1, 'the report FLAGS the old result, it does not change it');
  assert.strictEqual(Number(X.Db.get('FitnessTests', old.id).weighted_score), 90.8, 'reading the quality report changed nothing');
  X.Fitness.recompute(admin, old.id, 'בדיקה: חישוב מחדש מכוון'); const re = X.Db.get('FitnessTests', old.id); assert.strictEqual(re.scoring_version_id, v2.id); assert.ok(Math.abs(Number(re.weighted_score) - 90.95) < 1e-9);
  assert.ok(X.Audit.list(admin, { recordId: old.id, action: 'EDIT' }).length >= 1, 'recompute is in the audit trail');
});
t('integration', '4. audit trail of the scoring process: import, every row edit, approval (and supersede) are recorded with the actor and the reason', () => {
  const S = S0(), { X, admin, c1 } = S; const v = X.Fitness.importDraft(admin, c1, {}); const row = rowOf(X, v.id, 'M', 'trap_bar', 100); X.Fitness.editRow(admin, v.id, row.id, { score: 99 }, 'סיבה-א'); approve(X, admin, v, 'סיבה-ב');
  const acts = X.Audit.list(admin, {}).map(a => a.action); ['FITSCORING_ROW_EDIT', 'FITSCORING_APPROVE'].forEach(a => assert.ok(acts.includes(a), 'missing audit action ' + a));
  const ap = X.Audit.list(admin, { action: 'FITSCORING_APPROVE' })[0]; assert.ok(JSON.stringify(ap).includes('סיבה-ב')); assert.ok(JSON.stringify(ap).includes('admin@x.com'));
});
t('integration', '5. which table is used: unapproved/other-course/other-gender/other-variant tables are never used (a boy never gets the girls table, a variant with no table for his gender gives no score)', () => {
  const S = S0(), { X, admin, c1 } = S; const v = X.Fitness.importDraft(admin, c1, { sheets: ['F'] }); approve(X, admin, v); const boy = S.rec(S.S.a, '2026-11-09', FULL), girl = S.rec(S.S.a2, '2026-11-09', FULL);
  assert.strictEqual(boy.weighted_score, '', 'a version with only the girls tables gives a boy nothing'); assert.ok(Number(girl.weighted_score) > 0);
  const cs = JSON.parse(boy.component_scores_json); Object.keys(cs).forEach(k => assert.strictEqual(cs[k].reason, 'no_table', k));
});
t('unit', '6. cross-source check: the stored tables (rendered images) equal the independent earlier transcription of the original source photos for all 7 comparable tables, except girls pull-ups row "40" (N1)', () => {
  const root = path.join(__dirname, '..'); const A = JSON.parse(fs.readFileSync(path.join(root, 'fitness_scoring_draft.json'), 'utf8')).tables, B = JSON.parse(fs.readFileSync(path.join(root, 'scoring', 'fitness_scoring_v103.json'), 'utf8')).tables;
  const map = { run3km_A: 'run3km_M', run3km_B: 'run3km_F', run150x2_A: 'run150x2_M', run150x2_B: 'run150x2_F', pullups_A_noweight: 'pullups_M_none', pullups_A_vest: 'pullups_M_vest', pullups_B_rubberband: 'pullups_F_band' };
  const norm = (t) => t.rows.map(r => Array.isArray(r) ? r.slice(0, 3) : [r.score, r.from_sec !== undefined ? r.from_sec : r.reps_min, r.to_sec !== undefined ? r.to_sec : r.reps_max]);
  Object.keys(map).forEach(k => { const a = norm(A.find(x => x.id === k)), b = norm(B.find(x => x.id === map[k])); if (k === 'pullups_B_rubberband') { assert.strictEqual(a.length, 13); assert.strictEqual(b.length, 12); assert.deepStrictEqual(a.slice(0, 11), b.slice(0, 11), 'first 11 rows agree'); assert.deepStrictEqual(a[11], [45, 1, 1], 'the image prints 45 for one rep'); assert.deepStrictEqual(a[12], [40, 1, 1]); assert.deepStrictEqual(b[11], [40, 1, 1], 'v1.0.6 APPROVED PROFESSIONAL DECISION N1: one rep = 40 (not a value copied from the source image)'); } else assert.deepStrictEqual(a, b, k + ' differs between the two transcriptions'); });
  assert.strictEqual(norm(B.find(x => x.id === 'run3km_M')).length, 61); assert.strictEqual(norm(B.find(x => x.id === 'run3km_F')).length, 61);
});
t('hardening', '7. data-quality report is READ-ONLY: a full snapshot of EVERY table (incl. audit log, approvals, results, soldiers, permissions) is identical before and after; it neither fixes, deletes, approves nor changes permissions — and it names the source of each problem', () => {
  const S = S0(), { X, admin, c1 } = S; const sol = S.S.a;
  const v = X.Fitness.importDraft(admin, c1, {}); S.rec(sol, '2026-11-09', FULL);                              // draft only => no_table
  approve(X, admin, v); S.rec(sol, '2026-11-10', FULL); S.rec(S.S.a2, '2026-11-10', Object.assign({}, FULL, { pullups: 25 }));   // girl: 25 pull-ups => out_of_range
  S.rec(sol, '2026-11-11', Object.assign({}, FULL, { pullups: 16 }));   // boy: 16 pull-ups is above the vest table (max 15) => out_of_range, review (v1.0.6: no variant_unset exists any more)
  const ng = X.Soldiers.create(admin, c1, { full_name: 'ללא מין', personal_number: '9998', gender: 'M', department_id: X.Courses.org(admin, c1).departments[0].id, team_id: X.Courses.org(admin, c1).teams[0].id }); X.Db.update('Soldiers', ng.id, { gender: '' });
  const tables = ['FitnessTests', 'FitnessScoringVersions', 'FitnessScoringRows', 'FitnessTestTypes', 'Soldiers', 'AuditLog', 'Users', 'UserAssignments', 'CourseUsers', 'Courses', 'Settings'].filter(n => { try { X.Db.all(n); return true; } catch (e) { return false; } });
  assert.ok(tables.includes('FitnessTests') && tables.includes('Soldiers') && tables.includes('FitnessScoringVersions'), 'snapshot covers the key tables: ' + tables.join(','));
  const take = () => JSON.stringify(tables.map(n => [n, X.Db.all(n)])); const before = take();
  const q = X.Fitness.dataQuality(admin, c1); const q2 = X.Fitness.dataQuality(admin, c1);
  assert.strictEqual(take(), before, 'NOTHING changed (data, approvals, audit log, permissions)'); assert.deepStrictEqual(q, q2, 'deterministic');
  const codes = q.incomplete_reasons.map(r => r.code).sort(); ['no_table', 'out_of_range'].forEach(c => assert.ok(codes.includes(c), 'reason ' + c + ' missing from ' + codes)); assert.ok(!codes.includes('variant_unset'), 'v1.0.6: variant_unset no longer exists');
  q.incomplete_reasons.forEach(r => assert.ok(/[א-ת]/.test(r.text) && !/_/.test(r.text), 'plain Hebrew: ' + r.text)); assert.ok(q.incomplete_detail.every(d => d.id && d.test_date && d.reasons.length), 'each unscored result is listed with its reasons');
  assert.ok(q.soldiers_without_gender.some(x => x.id === ng.id)); assert.ok(q.advice.length > 0);
  // the report has no write path: the API method only reads; calling it as admin via the API must also leave everything unchanged
  X.Auth._emailProvider = () => 'admin@x.com'; const r = X.api('fitness.quality', { courseId: c1 }); assert.strictEqual(r.ok, true); assert.strictEqual(take(), before, 'API call changed nothing');
});
t('hardening', '8. DIRECT API (not the UI): every fitness admin endpoint refuses a commander — and a user with no assignment — with no data in the reply; a team commander sees fitness results of his own team only; the server (not the UI) enforces it', () => {
  const S = S0(), { X, admin, c1, cT, cC, none } = S; const v = X.Fitness.importDraft(admin, c1, {}); approve(X, admin, v); const type = S.regular.id;
  S.rec(S.S.a, '2026-11-09', FULL); S.rec(S.S.c, '2026-11-09', FULL);   // a = team of cT ; c = another department
  const row = rowOf(X, v.id, 'M', 'run3km', 76), calls = [['fitness.types', { courseId: c1 }, true], ['fitness.typeCreate', { courseId: c1, data: { name: 'x', weights: { pullups: 100 } } }], ['fitness.typeWeights', { id: type, weights: { pullups: 100 }, reason: 'x' }], ['fitness.typeActive', { id: type, active: false, reason: 'x' }],
    ['fitness.typeVariant', { id: type, component: 'pullups', variant: 'בסיוע גומי', reason: 'x' }], ['fitness.draftSource', {}], ['fitness.versions', { courseId: c1 }], ['fitness.importDraft', { courseId: c1, data: {} }], ['fitness.editRow', { versionId: v.id, rowId: row.id, patch: { score: 1 }, reason: 'x' }],
    ['fitness.addTable', { versionId: v.id, data: {} }], ['fitness.approve', { versionId: v.id, data: { verified_against_source: true, reason: 'x' } }], ['fitness.quality', { courseId: c1 }], ['fitness.recompute', { id: S.S.a && X.Db.all('FitnessTests')[0].id, reason: 'x' }]];
  const snap = () => JSON.stringify(['FitnessScoringVersions', 'FitnessScoringRows', 'FitnessTestTypes', 'FitnessTests'].map(n => X.Db.all(n))); const before = snap();
  [cT, none].forEach(u => { X.Auth._emailProvider = () => u.email; calls.forEach(([m, a, readOk]) => { const r = X.api(m, a); if (readOk) return; assert.strictEqual(r.ok, false, m + ' as ' + u.email + ' must be refused'); const j = JSON.stringify(r); assert.ok(!/run3km|pullups|trap_bar|from_value|to_value|scoring_version/.test(j) || /FORBIDDEN|הרשאה|אין/.test(j), m + ' reply leaks: ' + j.slice(0, 120)); assert.ok(!/"data":\s*\{[^}]*score/.test(j)); }); });
  assert.strictEqual(snap(), before, 'no refused call changed anything');
  X.Auth._emailProvider = () => cT.email; const lst = X.api('fitness.list', { courseId: c1 }); assert.strictEqual(lst.ok, true); assert.deepStrictEqual(lst.data.map(r => r.soldier_id), [S.S.a.id], 'team commander sees only his team');
  X.Auth._emailProvider = () => none.email; const l2 = X.api('fitness.list', { courseId: c1 }); assert.ok(l2.ok === false || l2.data.length === 0, 'no assignment => nothing');
  X.Auth._emailProvider = () => cC.email; assert.strictEqual(X.api('fitness.list', { courseId: c1 }).data.length, 2, 'course commander sees both');
});
done();
