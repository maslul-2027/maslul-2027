// Issue #95 — the course dashboard and the exam report attacked with REAL engine outputs (not UI projections): for N=10 soldiers and every split k=0..10 per domain, the SAME native/insight code (loaded in a Node vm)
// is fed the real source routes of the dashboard, as the course admin AND as a department commander (cohort counted after scope), and the resulting model / PDF / XLSX must never expose a 1–4 cell or let a
// hidden cell be recovered by subtracting displayed counts from a displayed total. Node only; synthetic data only.
const { suite } = require('./tlib'); const F = require('../scripts/lib/filecheck'); const { t, done, assert } = suite('insight_server_sweep.js'); const { setup } = require('./fixture'); const I = require('../scripts/lib/insight_node');
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

// ============ exam report: A/B/C with the approved pass rule, zero / missing scores, four roles, REAL file content (qpdf + pdftotext + openpyxl), intentional-leak negative controls ============
const LBL = { A: 'עברו במועד א׳', B: 'עברו במועד ב׳', C: 'עברו במועד ג׳', failC: 'לא עברו גם במועד ג׳', pend: 'ממתינים למועד הבא' };
const hiddenRate = (k, n) => !n || (k > 0 && k < 5) || (n - k > 0 && n - k < 5), pct = (k, n) => Math.round(100 * k / n) + '%';
// independent oracle: the approved rule from Exams.gs, recomputed here from the RAW route rows (not from insight code)
function truth(att, pass, examId) {
  const by = {}; att.filter(a => a.exam_id === examId).forEach(a => { (by[a.soldier_id] = by[a.soldier_id] || {})[a.attempt] = Number(a.score); });
  const T = { recorded: 0, A: 0, B: 0, C: 0, failC: 0, pend: 0, k1: 0, kf: 0, sumA: 0 };
  Object.values(by).forEach(s => { if (s.A === undefined) return; T.recorded++; T.sumA += s.A; if (s.A >= pass) { T.A++; T.k1++; T.kf++; } else if (s.B === undefined) T.pend++; else if (s.B >= pass) { T.B++; T.kf++; } else if (s.C === undefined) T.pend++; else if (s.C >= pass) { T.C++; T.kf++; } else T.failC++; });
  return T;
}
function findLeaks(T, pass, txt, sheets, tag) {
  const bad = [], cells = F.cellsOf(sheets), strs = cells.map(String), hidden = T.recorded < 5 || pass === null, st = sheets['מסלול עמידה'];
  if (!st) bad.push(tag + ' no stage sheet'); else { let sum = 0, anyHid = false;
    st.slice(1).forEach(r => { const lab = r[0], v = r[1]; if (typeof v === 'number') { if (v >= 1 && v <= 4) bad.push(tag + ' stage ' + lab + '=' + v); sum += v; const key = Object.keys(LBL).find(k => LBL[k] === lab); if (key && v !== T[key]) bad.push(tag + ' stage ' + lab + ' shows ' + v + ' but truth ' + T[key]); } else if (v !== null && v !== '') anyHid = true; });
    const rem = T.recorded - sum; if (!hidden && rem > 0 && rem < 5) bad.push(tag + ' stage remainder recoverable ' + rem); if (hidden && sum > 0) bad.push(tag + ' numbers shown while whole report hidden'); void anyHid; }
  if (hidden) { if (/\d+\s?%/.test(txt)) bad.push(tag + ' pdf shows a percentage while hidden'); if (strs.some(x => /^\d+%$/.test(x) || /\d+\s?%/.test(x))) bad.push(tag + ' xlsx shows a percentage while hidden'); }
  else [[T.k1, 'first'], [T.kf, 'final']].forEach(([k, w]) => { if (hiddenRate(k, T.recorded)) { const p = pct(k, T.recorded); if (new RegExp('(^|[^\\d])' + p.replace('%', '') + '\\s?%').test(txt)) bad.push(tag + ' pdf leaks ' + w + ' pass pct ' + p); if (strs.some(x => x.indexOf(p) >= 0 && /^\D*\d+%\D*$/.test(x))) bad.push(tag + ' xlsx leaks ' + w + ' pass pct ' + p); } });
  if (!hidden) Object.keys(LBL).forEach(k => { if (T[k] >= 1 && T[k] <= 4) { txt.split('\n').filter(l => l.indexOf(LBL[k]) >= 0).forEach(l => { if (/(^|\s)[1-4](\s|$)/.test(l.replace(LBL[k], ''))) bad.push(tag + ' pdf line leaks small ' + k + ': ' + l.trim()); }); } });
  (sheets['יחידות'] || []).slice(1).forEach(r => { if (typeof r[2] === 'number' && r[2] >= 1 && r[2] <= 4) bad.push(tag + ' unit N=' + r[2]); });
  return bad;
}
function expectContent(m, txt, sheets, tag) {   // labels / legal values really present (an empty or wrong file cannot pass)
  const bad = [], need = ['דוח מבחן', m.examName]; if (!m.pub.hidden) need.push('מסלול העמידה'); need.forEach(w => { if (txt.indexOf(w) < 0) bad.push(tag + ' pdf missing "' + w + '"'); });
  ['סיכום', 'מסלול עמידה'].forEach(w => { if (!sheets[w]) bad.push(tag + ' xlsx missing sheet ' + w); }); return bad;
}
function examWorld(spec, pass) {   // spec[i] = [A, B, C] scores (undefined = none); soldier i of the 10
  const S = world(10), { X, admin, c1 } = S; S.ex = X.Exams.defCreate(admin, c1, pass === undefined ? { name: 'מבחן בדיקה' } : { name: 'מבחן בדיקה', pass_score: pass });
  spec.forEach((sc, i) => ['A', 'B', 'C'].forEach((a, j) => { if (sc[j] !== undefined) X.Exams.addAttempt(admin, c1, { request_id: S.rid(), soldier_id: S.all[i].id, exam_id: S.ex.id, attempt: a, attempt_date: '2026-03-0' + (3 + j), score: sc[j] }); })); return S;
}
function viewOf(S, user) {
  const g = (m, a) => { const r = S.as(user, m, Object.assign({ courseId: S.c1, opts: {} }, a || {})); assert.strictEqual(r.ok, true, m + JSON.stringify(r)); return r.data; };
  const att = g('exams.attempts'), defs = g('exams.defs'), sol = g('soldiers.list'), def = defs.find(d => d.id === S.ex.id), sum = g('exams.summary');
  return { att, def, sol, sum, m: I.examBuild(att, def, sol, { course: 'c', now: '2026-11-26T00:00:00Z' }) };
}
function rawSummaryLeaks(sum, tag) {   // the RAW aggregate route response, before any UI projection
  const bad = [], e = sum.exams && sum.exams[0]; if (!e) return bad; const vals = ['soldiers', 'passed', 'failed', 'pending'].map(k => e[k]);
  vals.forEach((v, i) => { if (typeof v === 'number' && v >= 1 && v <= 4) bad.push(tag + ' exams.summary ' + ['soldiers', 'passed', 'failed', 'pending'][i] + '=' + v); });
  if (e.soldiers !== null && e.soldiers !== undefined) { const part = vals.slice(1).filter(v => typeof v === 'number'), rem = e.soldiers - part.reduce((a, b) => a + b, 0); if (vals.slice(1).some(v => v === null) && rem > 0 && rem < 5) bad.push(tag + ' exams.summary remainder ' + rem); }
  return bad;
}
function runScenario(name, spec, pass, users) {
  const S = examWorld(spec, pass), bad = [], seen = {}; (users || [['admin', S.admin], ['dep', S.cD], ['team', S.cT], ['course', S.cC]]).forEach(([who, u]) => {
    const V = viewOf(S, u), tag = name + '/' + who, eff = V.def.pass_score, T = truth(V.att, eff, S.ex.id); seen[who] = T.recorded;
    bad.push(...rawSummaryLeaks(V.sum, tag)); assert.strictEqual(V.m.pass, eff, tag + ' effective pass score is the engine\'s'); assert.strictEqual(V.m.ops.recorded, T.recorded, tag + ' recorded'); ['A', 'B', 'C', 'failC'].forEach(k => assert.strictEqual(V.m.ops.stages[k], T[k], tag + ' ops stage ' + k)); assert.strictEqual(V.m.ops.stages.pendB + V.m.ops.stages.pendC, T.pend, tag + ' pending');
    const txt = F.pdfText(I.examPdf(V.m)), sheets = F.xlsxSheets(I.examXlsx(V.m)); bad.push(...findLeaks(T, eff, txt, sheets, tag), ...expectContent(V.m, txt, sheets, tag));
    if (T.recorded >= 5 && !hiddenRate(T.k1, T.recorded)) { assert.ok(txt.indexOf(pct(T.k1, T.recorded)) >= 0 || /\d+\s?%/.test(txt), tag + ' legal first-pass rate is shown'); } });
  assert.deepStrictEqual(bad, [], name + ': ' + bad.join(' | ')); return seen;
}
const M1 = [[60], [70], [80], [90], [100], [0, 65], [40, 30, 61], [40, 30, 0], [40], []];    // A:5 (60 is the boundary), B:1 (A=0), C:1, failC:1 (C=0), pending B:1, no attempt:1
const M2 = [[60], [70], [80], [90], [100], [0, 65], [10, 60], [40, 85], [59, 99], [59, 60]];  // A:5 + B:5 — legal 5/5 split, zero score, boundary 59/60
t('integration', 'exam A/B/C oracle: mixed small cells (A5/B1/C1/failC1/pending1/none1), own pass 60 — four roles, raw routes + model + REAL PDF text + REAL XLSX cells; nothing 1–4, no recoverable remainder, no 56%/78%', () => { runScenario('mixed', M1, 60); });
t('integration', 'exam legal 5/5 split with zero and boundary scores (59 fails, 60 passes): numbers ARE shown and equal the independent oracle (the files are not simply blank)', () => {
  const S = examWorld(M2, 60), V = viewOf(S, S.admin), T = truth(V.att, 60, S.ex.id); assert.deepStrictEqual([T.A, T.B, T.C, T.failC, T.pend, T.k1, T.kf], [5, 5, 0, 0, 0, 5, 10]);
  const txt = F.pdfText(I.examPdf(V.m)), sh = F.xlsxSheets(I.examXlsx(V.m)), st = sh['מסלול עמידה'].slice(1); assert.strictEqual(st.find(r => r[0] === LBL.A)[1], 5); assert.strictEqual(st.find(r => r[0] === LBL.B)[1], 5);
  assert.ok(/50\s?%/.test(txt) && /100\s?%/.test(txt), 'first 50% and final 100% printed'); assert.ok(F.cellsOf(sh).some(c => /50%/.test(String(c))), 'xlsx has 50%'); runScenario('legal55', M2, 60); });
t('integration', 'exam all-zero scores (0 is a real score): 10 × A=0 ⇒ 0% first pass shown, mean 0 shown, 10 pending B; and a pass score of 0 passes everyone', () => {
  const S = examWorld(Array.from({ length: 10 }, () => [0]), 60), V = viewOf(S, S.admin); assert.strictEqual(V.m.pub.firstPass.pct, 0); const txt = F.pdfText(I.examPdf(V.m)); assert.ok(/0\s?%/.test(txt)); runScenario('zero', Array.from({ length: 10 }, () => [0]), 60);
  const S2 = examWorld(Array.from({ length: 10 }, () => [0]), 0), V2 = viewOf(S2, S2.admin); assert.strictEqual(V2.m.ops.stages.A, 10); });
t('integration', 'exam below N=5 (4 recorded) and null pass score: whole public report hidden — no stage numbers, no percentage, no mean; null/blank scores are rejected by the engine; default (course) pass score is read from the real route', () => {
  runScenario('four', [[70], [70], [50], [50], [], [], [], [], [], []], 60);
  const S = examWorld(M1, 60), V = viewOf(S, S.admin); V.def.pass_score = null; const m = I.examBuild(V.att, V.def, V.sol, { course: 'c', now: 'x' }); assert.strictEqual(m.pub.hidden, true); const txt = F.pdfText(I.examPdf(m)), sh = F.xlsxSheets(I.examXlsx(m)); assert.ok(!/\d+\s?%/.test(txt)); assert.ok(F.cellsOf(sh).every(c => !/%/.test(String(c))));
  const S2 = examWorld([[70], [50]], undefined); const d2 = S2.as(S2.admin, 'exams.defs', { courseId: S2.c1, opts: {} }).data.find(x => x.id === S2.ex.id); assert.ok(typeof d2.pass_score === 'number' && d2.own_pass_score === null || d2.own_pass_score === '' || d2.own_pass_score === undefined, 'course default pass score is effective: ' + JSON.stringify(d2));
  assert.strictEqual(S.as(S.admin, 'exams.attempt', { courseId: S.c1, data: { request_id: 'zz1', soldier_id: S.all[9].id, exam_id: S.ex.id, attempt: 'A', attempt_date: '2026-03-03', score: null } }).ok, false); });
t('integration', 'changing the exam pass score (exams.defPass, with reason) re-evaluates A/B/C from the SAME attempts and the files follow it', () => {
  const S = examWorld(M2, 60), r = S.as(S.admin, 'exams.defPass', { courseId: S.c1, id: S.ex.id, pass: 95, reason: 'בדיקה סינתטית' }); assert.strictEqual(r.ok, true, JSON.stringify(r)); const V = viewOf(S, S.admin); assert.strictEqual(V.def.pass_score, 95); const T = truth(V.att, 95, S.ex.id);
  assert.strictEqual(V.m.ops.stages.A, T.A); assert.deepStrictEqual(findLeaks(T, 95, F.pdfText(I.examPdf(V.m)), F.xlsxSheets(I.examXlsx(V.m)), 'p95'), []); });
t('integration', 'authorization of the export gate for each role: only the course admin is authorized; department / team / course commanders are refused and the refusal is audited', () => {
  const S = examWorld(M2, 60); const ok = S.as(S.admin, 'reports.exportAuthorize', { courseId: S.c1, req: { kind: 'exams', format: 'pdf', scope: S.ex.id } }); assert.strictEqual(ok.ok, true, JSON.stringify(ok));
  [S.cD, S.cT, S.cC].forEach(u => { const r = S.as(u, 'reports.exportAuthorize', { courseId: S.c1, req: { kind: 'exams', format: 'pdf', scope: S.ex.id } }); assert.strictEqual(r.ok, false, u.email + ' must be refused'); assert.strictEqual(r.code, 'FORBIDDEN'); });
  const den = S.as(S.admin, 'audit.list', { courseId: S.c1, opts: {} }); assert.strictEqual(den.ok, true, JSON.stringify(den).slice(0, 200)); assert.ok(JSON.stringify(den.data).indexOf('REPORT_EXPORT_DENIED') >= 0, 'refusals are audited'); });
t('hardening', 'NEGATIVE CONTROLS: a deliberately leaking model (exact stage counts + 56%/78%) must be flagged in the PDF text AND the XLSX cells; garbage / empty / truncated files must make the readers throw', () => {
  const S = examWorld(M1, 60), V = viewOf(S, S.admin), T = truth(V.att, 60, S.ex.id), leaky = JSON.parse(JSON.stringify(V.m));
  leaky.pub.stages = [[LBL.A, '5'], [LBL.B, '1'], [LBL.C, '1'], [LBL.failC, '1'], [LBL.pend, '1']]; leaky.pub.firstPass = { pct: 56, txt: '56%', short: '56%' }; leaky.pub.finalPass = { pct: 78, txt: '78%', short: '78%' };
  const txt = F.pdfText(I.examPdf(leaky)), sh = F.xlsxSheets(I.examXlsx(leaky)), bad = findLeaks(T, 60, txt, sh, 'leaky'); assert.ok(bad.length >= 3, 'the leak detector must fire on a leaking file, got: ' + JSON.stringify(bad));
  assert.ok(bad.some(x => /stage .*=1/.test(x)), 'small stage cell detected in XLSX'); assert.ok(bad.some(x => /pdf (line )?leaks/.test(x)), 'small count / percentage detected in PDF'); assert.ok(bad.some(x => /xlsx leaks/.test(x)), 'percentage detected in XLSX');
  const good = findLeaks(T, 60, F.pdfText(I.examPdf(V.m)), F.xlsxSheets(I.examXlsx(V.m)), 'good'); assert.deepStrictEqual(good, [], 'the honest file passes the same detector');
  assert.throws(() => F.pdfText(Buffer.from('not a pdf')), /qpdf|pdftotext/); assert.throws(() => F.pdfText(Buffer.alloc(0)), /qpdf|pdftotext|empty/); assert.throws(() => F.xlsxSheets(Buffer.from('PK nope')), /openpyxl/); assert.throws(() => F.xlsxSheets(Buffer.alloc(0)), /openpyxl/);
  const pdf = Buffer.from(I.examPdf(V.m)); assert.throws(() => F.pdfText(pdf.slice(0, Math.floor(pdf.length / 3))), /qpdf|pdftotext|short/); });
t('integration', 'course dashboard files: the PDF text and the XLSX cells of the REAL-route model carry the model\'s labels and legal values, and contain no 1–4 person-count cell (admin + team commander)', () => {
  const bad = []; [5, 7].forEach(k => { const S = world(10); fill(S, k); [['admin', S.admin], ['team', S.cT]].forEach(([who, u]) => { const R = get(S, u), m = I.courseModel(R, { course: 'c', now: '2026-11-26T00:00:00Z' }), txt = F.pdfText(I.coursePdf(m, 'all')), sh = F.xlsxSheets(I.courseXlsx(m, 'all')), cells = F.cellsOf(sh);
    m.sections.forEach(s => { if (txt.indexOf(s.title.replace(/ \(.*$/, '')) < 0) bad.push(who + ' k=' + k + ' pdf missing section ' + s.title); }); const vis = rowsOf(m).filter(r => isNum(r[2]) && +r[2] >= 5); vis.forEach(r => { if (!cells.some(c => String(c) === String(r[2]))) bad.push(who + ' k=' + k + ' xlsx lacks legal value ' + r[1] + '=' + r[2]); });
    sh && Object.keys(sh).forEach(n => sh[n].slice(1).forEach(r => { const lab = String(r[0] || ''); if (SAFE.test(lab)) return; r.slice(1).forEach(v => { if (typeof v === 'number' && v >= 1 && v <= 4) bad.push(who + ' k=' + k + ' xlsx ' + n + '/' + lab + '=' + v); }); })); }); });
  assert.deepStrictEqual(bad, []); });
done();
