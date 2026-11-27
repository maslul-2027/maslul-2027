// Issue #95 — shooting (קליעה) report: model + REAL PDF text (qpdf+pdftotext) + REAL XLSX cells (openpyxl) from the REAL mk.list / soldiers.list routes, four roles, independent oracle,
// zero / missing / YLM-only / cancelled records, small-cell + complementary suppression, intentional-leak negative controls. Node only; synthetic data only.
const { suite } = require('./tlib'); const { t, done, assert } = suite('insight_shoot_report.js'); const { setup } = require('./fixture'); const I = require('../scripts/lib/insight_node'); const F = require('../scripts/lib/filecheck');
function world() {
  const S = setup(), { X, admin, c1, S: sol, mk } = S; const all = [sol.a, sol.a2, sol.b, sol.c, sol.d]; [['ה1', '501', 0, 0], ['ה2', '502', 0, 1], ['ו1', '601', 1, 0], ['ו2', '602', 1, 1], ['ו3', '603', 1, 1]].forEach(e => all.push(mk(e[0], e[1], e[2], e[3])));
  S.all = all; S.as = (u, m, a) => { X.Auth._emailProvider = () => u.email; return X.api(m, a); };
  S.mk = (i, o) => X.Records.create(admin, 'MarksmanshipTests', c1, Object.assign({ request_id: S.rid(), soldier_id: all[i].id, test_date: '2026-03-01', weapon_type: 'M16', distance_m: 100, weapon_zeroed: true }, o)); return S;
}
function view(S, user) {
  const g = m => { const r = S.as(user, m, { courseId: S.c1, opts: {} }); assert.strictEqual(r.ok, true, m + JSON.stringify(r)); return r.data; }, list = g('mk.list'), sol = g('soldiers.list'); return { list, sol, m: I.shootBuild(list, sol, { course: 'c', now: '2026-11-26T00:00:00Z' }) };
}
// independent oracle: latest regular result per soldier (by test_date, then later row), YLM separate
function oracle(list) {
  const reg = {}, ylm = {}; list.filter(r => r.record_status !== 'cancelled' && !r.soldier_cancelled).forEach(r => { if (r.examiner_score !== null && r.examiner_score !== undefined && (!reg[r.soldier_id] || r.test_date >= reg[r.soldier_id].test_date)) reg[r.soldier_id] = r; if (r.ylm_score !== null && r.ylm_score !== undefined && (!ylm[r.soldier_id] || r.test_date >= ylm[r.soldier_id].test_date)) ylm[r.soldier_id] = r; });
  const sc = Object.values(reg).map(r => r.examiner_score); return { n: sc.length, sum: sc.reduce((a, b) => a + b, 0), zeroed: Object.values(reg).filter(r => r.weapon_zeroed).length, ylmN: Object.keys(ylm).length, weapons: Object.values(reg).reduce((a, r) => (a[r.weapon_type] = (a[r.weapon_type] || 0) + 1, a), {}) };
}
const hiddenRate = (k, n) => !n || (k > 0 && k < 5) || (n - k > 0 && n - k < 5), pct = (k, n) => Math.round(100 * k / n) + '%';
function leaks(O, txt, sh, tag) {
  const bad = [], strs = F.cellsOf(sh).map(String), hidden = O.n < 5;
  if (hidden) { if (/\d+\s?%/.test(txt)) bad.push(tag + ' pdf percentage while hidden'); if (strs.some(x => /%/.test(x))) bad.push(tag + ' xlsx percentage while hidden'); if (strs.some(x => /^\d+(\.\d+)?$/.test(x) && +x !== 0 && x !== String(10))) { /* numeric cells other than the denominator are not allowed while hidden */ const num = F.cellsOf(sh).filter(v => typeof v === 'number' && v !== O.eligible || O.eligible < 5); if (num.length) bad.push(tag + ' numeric cells while hidden: ' + num.join(',')); } return bad; }
  [[O.zeroed, 'zero-rate']].forEach(([k, w]) => { if (hiddenRate(k, O.n)) { const p = pct(k, O.n); if (new RegExp('(^|[^\\d])' + p.replace('%', '') + '\\s?%').test(txt)) bad.push(tag + ' pdf leaks ' + w + ' ' + p); if (strs.some(x => x.indexOf(p) >= 0)) bad.push(tag + ' xlsx leaks ' + w + ' ' + p); } });
  const cov = pct(O.n, O.eligible); if (hiddenRate(O.n, O.eligible)) { if (new RegExp('(^|[^\\d])' + cov.replace('%', '') + '\\s?%').test(txt)) bad.push(tag + ' pdf leaks coverage ' + cov); if (strs.some(x => x.indexOf(cov) >= 0)) bad.push(tag + ' xlsx leaks coverage ' + cov); }
  const w = sh['סוג נשק'] || []; let sum = 0; w.slice(1).forEach(r => { if (typeof r[1] === 'number') { if (r[1] >= 1 && r[1] <= 4) bad.push(tag + ' weapon ' + r[0] + '=' + r[1]); sum += r[1]; if (O.weapons[r[0]] !== r[1]) bad.push(tag + ' weapon ' + r[0] + ' shows ' + r[1] + ' truth ' + O.weapons[r[0]]); } }); const rem = O.n - sum; if (rem > 0 && rem < 5) bad.push(tag + ' weapon remainder recoverable ' + rem);
  (sh['יחידות'] || []).slice(1).forEach(r => { if (typeof r[2] === 'number' && r[2] >= 1 && r[2] <= 4) bad.push(tag + ' unit N=' + r[2]); }); return bad;
}
function content(m, txt, sh, tag) { const bad = []; ['דוח קליעה'].concat(m.pub.hidden ? [] : ['לפי סוג נשק']).forEach(w => { if (txt.indexOf(w) < 0) bad.push(tag + ' pdf missing ' + w); }); ['סיכום', 'התפלגות', 'סוג נשק', 'יחידות'].forEach(w => { if (!sh[w]) bad.push(tag + ' xlsx missing sheet ' + w); }); return bad; }
function run(S, name) {
  const bad = [], users = [['admin', S.admin], ['dep', S.cD], ['team', S.cT], ['course', S.cC]];
  users.forEach(([who, u]) => { const V = view(S, u), tag = name + '/' + who, o = oracle(V.list); assert.strictEqual(V.m.ops.recorded, o.n, tag + ' recorded'); assert.strictEqual(V.m.ops.zeroed, o.zeroed, tag + ' zeroed'); assert.strictEqual(V.m.ops.ylm, o.ylmN, tag + ' ylm');
    if (o.n >= 5) assert.ok(Math.abs(V.m.pub.score.mean - o.sum / o.n) < 1e-9, tag + ' mean = oracle'); const txt = F.pdfText(I.shootPdf(V.m)), sh = F.xlsxSheets(I.shootXlsx(V.m)); o.eligible = V.m.ops.eligible; bad.push(...leaks(o, txt, sh, tag), ...content(V.m, txt, sh, tag)); });
  assert.deepStrictEqual(bad, [], name + ': ' + bad.join(' | '));
}
t('integration', 'mixed: 10 soldiers, scores incl. 0 and 100, 3 not zeroed, two weapons 6/4, YLM-only record, cancelled record, repeat tests (latest wins) — four roles, files carry no 1–4 cell and no recoverable remainder', () => {
  const S = world(), { X, admin, c1 } = S; for (let i = 0; i < 10; i++) S.mk(i, { examiner_score: [0, 100, 55, 70, 80, 90, 65, 75, 85, 95][i], weapon_type: i < 6 ? 'M16' : 'תבור', weapon_zeroed: i >= 3 });
  S.mk(0, { examiner_score: 40, test_date: '2026-02-01' }); S.mk(1, { examiner_score: null, ylm_score: 77, test_date: '2026-03-05' }); const c = S.mk(2, { examiner_score: 10, test_date: '2026-03-09' }).record; X.Records.cancel(admin, 'MarksmanshipTests', c.id, 'בדיקה');
  const V = view(S, admin), o = oracle(V.list); assert.strictEqual(o.n, 10); assert.strictEqual(V.m.ops.recorded, 10); run(S, 'mixed'); });
t('integration', 'score 0 is a real score (included in mean/distribution), a record with ONLY YLM is not a regular result, and YLM never enters the regular mean', () => {
  const S = world(); for (let i = 0; i < 10; i++) S.mk(i, { examiner_score: i < 5 ? 0 : 100 }); for (let i = 0; i < 6; i++) S.mk(i, { examiner_score: null, ylm_score: 20, test_date: '2026-03-02' }); const V = view(S, S.admin);
  assert.strictEqual(V.m.pub.score.mean, 50); assert.strictEqual(V.m.ops.ylm, 6); assert.strictEqual(V.m.pub.ylm.mean, 20); const sh = F.xlsxSheets(I.shootXlsx(V.m)), sum = sh['סיכום']; assert.ok(sum.some(r => r[0] === 'ממוצע קליעה רגילה' && Number(r[1]) === 50), 'xlsx mean 50 (YLM excluded)'); run(S, 'zero'); });
t('integration', 'fewer than 5 regular results (4 + YLM-only): public report hidden, no numbers/percentages in PDF or XLSX; operational view still exact', () => {
  const S = world(); for (let i = 0; i < 4; i++) S.mk(i, { examiner_score: 60 + i }); S.mk(4, { examiner_score: null, ylm_score: 50 }); const V = view(S, S.admin); assert.strictEqual(V.m.pub.hidden, true); assert.strictEqual(V.m.ops.recorded, 4); run(S, 'four'); });
t('integration', 'small cells: 9 scored / 1 missing, 8 zeroed / 1 not (k=1 and n-k=1), 6/3 weapon split (3 hidden ⇒ complementary) — never a 1–4 cell, coverage/zero rate percentages withheld', () => {
  const S = world(); for (let i = 0; i < 9; i++) S.mk(i, { examiner_score: 50 + i, weapon_type: i < 6 ? 'M16' : 'תבור', weapon_zeroed: i !== 8 }); const V = view(S, S.admin); assert.strictEqual(V.m.pub.coverage.pct, null); assert.strictEqual(V.m.pub.zeroRate.pct, null);
  const w = V.m.pub.weapons; assert.ok(w.every(x => x.hidden || x.n >= 5)); run(S, 'small'); });
t('integration', 'authorization: export gate kind "shooting" — admin authorized once; department/team/course commanders refused; unknown kind refused', () => {
  const S = world(); for (let i = 0; i < 10; i++) S.mk(i, { examiner_score: 50 + i }); const rq = k => ({ courseId: S.c1, req: { kind: k, format: 'pdf', scope: 'all' } }); const a = S.as(S.admin, 'reports.exportAuthorize', rq('shooting')); assert.strictEqual(a.ok, true, JSON.stringify(a));
  [S.cD, S.cT, S.cC].forEach(u => { const r = S.as(u, 'reports.exportAuthorize', rq('shooting')); assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'FORBIDDEN'); }); assert.strictEqual(S.as(S.admin, 'reports.exportAuthorize', rq('nope')).ok, false); });
t('hardening', 'NEGATIVE CONTROLS: a deliberately leaking shooting model (small weapon cell, 90% zero-rate for 9/10) is flagged in PDF text AND XLSX cells; an honest file passes the same detector', () => {
  const S = world(); for (let i = 0; i < 10; i++) S.mk(i, { examiner_score: 50 + i, weapon_type: i < 9 ? 'M16' : 'תבור', weapon_zeroed: i !== 0 }); const V = view(S, S.admin), o = oracle(V.list); o.eligible = V.m.ops.eligible;
  const leaky = JSON.parse(JSON.stringify(V.m)); leaky.pub.weapons = [{ name: 'M16', n: 9, hidden: false, mean: 54 }, { name: 'תבור', n: 1, hidden: false, mean: 59 }]; leaky.pub.zeroRate = { pct: 90, txt: '90%', short: '90%' };
  const bad = leaks(o, F.pdfText(I.shootPdf(leaky)), F.xlsxSheets(I.shootXlsx(leaky)), 'leaky'); assert.ok(bad.some(x => /weapon תבור=1/.test(x)), 'small weapon cell: ' + bad.join('|')); assert.ok(bad.some(x => /zero-rate 90%/.test(x)), 'zero-rate leak');
  assert.deepStrictEqual(leaks(o, F.pdfText(I.shootPdf(V.m)), F.xlsxSheets(I.shootXlsx(V.m)), 'good'), []); });
done();
