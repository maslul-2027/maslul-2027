// Issue #95 — the course dashboard and the exam report attacked with REAL engine outputs (not UI projections): for N=10 soldiers and every split k=0..10 per domain, the SAME native/insight code (loaded in a Node vm)
// is fed the real source routes of the dashboard, as the course admin AND as a department commander (cohort counted after scope), and the resulting model / PDF / XLSX must never expose a 1–4 cell or let a
// hidden cell be recovered by subtracting displayed counts from a displayed total. Node only; synthetic data only.
const { suite } = require('./tlib'); const { t, done, assert } = suite('insight_server_sweep.js'); const { setup } = require('./fixture'); const I = require('../scripts/lib/insight_node');
const ROUTES = ['nav.groups', 'fitness.summary', 'fitness.completion', 'mk.summary', 'exams.summary', 'attendance.summary', 'marches.summary', 'readiness.summary', 'alerts.counts', 'dash.overview', 'analytics.insights'];
function world(N) {
  const S = setup(), { X, admin, c1, S: sol, mk } = S; const all = [sol.a, sol.a2, sol.b, sol.c, sol.d]; const extra = [['ה1', '501', 0, 0], ['ה2', '502', 0, 1], ['ו1', '601', 1, 0], ['ו2', '602', 1, 1], ['ו3', '603', 1, 1]];
  for (let i = 0; i < N - 5; i++) all.push(mk(extra[i][0], extra[i][1], extra[i][2], extra[i][3])); S.all = all; S.ty = X.ActivityTypes.create(admin, c1, 'מטווח').id; S.nt = X.Navigation.typeCreate(admin, c1, 'ניווט א'); S.ex = X.Exams.defCreate(admin, c1, { name: 'מבחן א' });
  S.as = (u, m, a) => { X.Auth._emailProvider = () => u.email; return X.api(m, a); }; return S;
}
function fill(S, k) {
  const { X, admin, c1, all } = S, rid = S.rid;
  all.slice(0, k).forEach((s, i) => { X.Records.create(admin, 'MarksmanshipTests', c1, { request_id: rid(), soldier_id: s.id, test_date: '2026-03-01', weapon_type: 'M16', distance_m: 100, examiner_score: 70 + i, weapon_zeroed: true });
    const r = X.Records.create(admin, 'FitnessTests', c1, { request_id: rid(), soldier_id: s.id, test_date: '2026-03-01', test_type_id: X.Fitness.typesList(admin, c1).find(x => !x.is_opening).id, pullups: 15 }).record; X.Db.update('FitnessTests', r.id, { weighted_score: 60 + i });
    X.Records.create(admin, 'NavigationTests', c1, { request_id: rid(), soldier_id: s.id, test_date: '2026-03-02', navigation_type_id: S.nt.id, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 });
    X.Exams.addAttempt(admin, c1, { request_id: rid(), soldier_id: s.id, exam_id: S.ex.id, attempt: 'A', attempt_date: '2026-03-03', score: 60 + i * 4 }); });
  all.forEach((s, i) => X.Readiness.assess(admin, c1, { request_id: rid(), soldier_id: s.id, status: i < k ? 'unfit' : 'fit', start_date: '2026-03-06' }));
  X.Attendance.createEvent(admin, c1, { request_id: rid(), event_date: '2026-03-04', activity_type_id: S.ty, scope_type: 'course', scope_id: c1, absent: all.slice(0, k).map(s => ({ soldier_id: s.id })), early_exit: [] });
}
const get = (S, user) => { const R = {}; ROUTES.forEach(m => { R[m] = S.as(user, m, { courseId: S.c1, opts: {} }); }); return R; };
const rowsOf = m => m.sections.reduce((a, s) => a.concat(s.rows.map(r => [s.key, r[0], r[1]])), []);
const isNum = v => typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v));
const SAFE = /ק״מ|מסעות|ממוצע|%|תאריך|גרסה/;
function check(m, N, k, who) {
  const bad = []; rowsOf(m).forEach(([sec, label, v]) => { if (SAFE.test(label)) return; if (isNum(v) && +v >= 1 && +v <= 4) bad.push(who + ' k=' + k + ' ' + sec + '/' + label + '=' + v); });
  m.attention.forEach(a => { const n = /^(\d+)/.exec(a.text); if (n && +n[1] >= 1 && +n[1] <= 4) bad.push(who + ' k=' + k + ' attention ' + a.text); });
  ['readiness'].forEach(sec => { const rr = rowsOf(m).filter(r => r[0] === sec); if (!rr.length || typeof m.soldiers !== 'number') return; const sum = rr.reduce((a, r) => a + (isNum(r[2]) ? +r[2] : 0), 0), rem = m.soldiers - sum; const anyHidden = rr.some(r => !isNum(r[2])); if (rem > 0 && rem < 5) bad.push(who + ' k=' + k + ' ' + sec + ' remainder ' + rem); if (anyHidden && rem === 0) bad.push(who + ' k=' + k + ' hidden cell but exact total'); });
  const nav = rowsOf(m).filter(r => r[0] === 'navigation'); if (nav.length >= 2 && isNum(nav[1][2]) && isNum(nav[0][2])) { const rem = +nav[0][2] - +nav[1][2]; if (rem > 0 && rem < 5) bad.push(who + ' k=' + k + ' navigation complement ' + rem); }
  const fc = rowsOf(m).filter(r => r[0] === 'fitness' && /נתונים מלאים|חסרי נתונים/.test(r[1])); if (fc.length === 2 && fc.every(r => isNum(r[2]))) { const s = fc.reduce((a, r) => a + +r[2], 0); fc.forEach(r => { if (+r[2] > 0 && +r[2] < 5) bad.push(who + ' k=' + k + ' fitness completeness ' + r[2]); }); void s; }
  return bad;
}
t('integration', 'every split k=0..10 of N=10: the dashboard model built from the REAL source routes (course admin) never shows a 1–4 cell, a recoverable remainder, or a hidden-with-exact-total partition', () => {
  const bad = []; for (let k = 0; k <= 10; k++) { const S = world(10); fill(S, k); const m = I.courseModel(get(S, S.admin), { course: 'c', now: '2026-11-26T00:00:00Z' }); if (k === 5 || k === 10) { const vis = rowsOf(m).filter(r => isNum(r[2]) && +r[2] >= 5).length; assert.ok(vis >= 2, 'non-vacuous: legal cells are shown at k=' + k + ' (' + vis + ')'); } bad.push(...check(m, 10, k, 'admin')); assert.ok(!m.failed || !m.failed.length, 'all source routes read: ' + JSON.stringify(m.failed)); } assert.deepStrictEqual(bad, []); });
t('integration', 'the same sweep as the DEPARTMENT COMMANDER (the cohort is counted after the scope: a 9/1 course can be a legal 5/0 for them) — and the commander model is not the admin model', () => {
  const bad = []; let differed = false; for (let k = 0; k <= 10; k++) { const S = world(10); fill(S, k); const adm = I.courseModel(get(S, S.admin), { course: 'c', now: 'x' });
    const u = S.cD; const rr = get(S, u); const m = I.courseModel(rr, { course: 'c', now: 'x' }); bad.push(...check(m, 10, k, 'commander')); if (JSON.stringify(m.sections) !== JSON.stringify(adm.sections)) differed = true; } assert.deepStrictEqual(bad, []); assert.ok(differed, 'commander and admin models differ (scope applied)'); });
t('integration', 'exam report from real exams.defs/attempts/soldiers: for k=0..10 passers of N=10 the pass rate, stages, units, PDF text and XLSX cells never reveal k (1–4) or N−k (1–4); zero and all-pass stay shown', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sweepx-')); const bad = [];
  for (let k = 0; k <= 10; k++) { const S = world(10), { X, admin, c1 } = S; S.all.forEach((s, i) => X.Exams.addAttempt(admin, c1, { request_id: S.rid(), soldier_id: s.id, exam_id: S.ex.id, attempt: 'A', attempt_date: '2026-03-03', score: i < k ? 90 : 50 }));
    const def = S.as(admin, 'exams.defs', { courseId: c1, opts: {} }).data.find(x => x.id === S.ex.id), att = S.as(admin, 'exams.attempts', { courseId: c1, opts: {} }).data, sol = S.as(admin, 'soldiers.list', { courseId: c1, opts: {} }).data; def.pass_score = 80;
    const m = I.examBuild(att, def, sol, { course: 'c', now: '2026-11-26T00:00:00Z' }), small = k >= 1 && k <= 4, nearAll = 10 - k >= 1 && 10 - k <= 4, P = m.pub;
    if (small || nearAll) { if (P.firstPass.pct !== null) bad.push('k=' + k + ' pct shown ' + P.firstPass.txt); if (P.finalPass.pct !== null) bad.push('k=' + k + ' final pct shown'); } else if (P.firstPass.pct === null) bad.push('k=' + k + ' rate hidden without need');
    P.stages.forEach(s => { if (/^[1-4]$/.test(s[1])) bad.push('k=' + k + ' stage ' + s[0] + '=' + s[1]); }); const sum = P.stages.reduce((a, s) => a + (/^\d+$/.test(s[1]) ? +s[1] : 0), 0), rem = P.recorded - sum; if (rem > 0 && rem < 5) bad.push('k=' + k + ' stage remainder ' + rem);
    const f = path.join(tmp, 'e' + k + '.pdf'), x = f.replace('.pdf', '.xlsx'); fs.writeFileSync(f, Buffer.from(I.examPdf(m))); fs.writeFileSync(x, Buffer.from(I.examXlsx(m))); const txt = cp.spawnSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }).stdout;
    if ((small || nearAll) && P.recorded !== null) { const pctk = Math.round(100 * k / 10) + '%'; if (new RegExp('(^|[^\\d])' + pctk.replace('%', '') + '\\s?%').test(txt) && !/ציון/.test(pctk)) bad.push('k=' + k + ' pdf shows ' + pctk); } }
  assert.deepStrictEqual(bad, []); });
done();
