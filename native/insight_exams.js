
/* ===== EXAMS insight ("דוח מבחן"): attempts A/B/C per soldier → first-attempt pass, final pass, outcome stages, A-score distribution, units; real PDF + XLSX.
   Rules are the APPROVED exam rules only (Exams.gs): pass score = the exam's own/course pass score; A<pass ⇒ B; B<pass ⇒ C. No weighted score is recomputed here; no per-person ranking; no prediction.
   Same small-cell policy as the navigation report: the group-facing projection `pub` (screen, PDF, Excel) vs the operational zone `ops` (screen only). ===== */
var IN_EX_MD = { version: 'insight-exam-1', source: 'exams.defs · exams.attempts · soldiers.list' };
/* a rate must not reveal a small cell: k passers of n. k in 1..4 or (n-k) in 1..4 ⇒ no percentage (the percentage times N would recover the small count). */
function inRate(k, n) { if (!n) return { pct: null, txt: '—', short: '—' }; if (k > 0 && k < IN_MIN_N) return { pct: null, txt: 'פחות מ-' + IN_MIN_N + ' חניכים', short: 'פחות מ-' + IN_MIN_N }; if (n - k > 0 && n - k < IN_MIN_N) return { pct: null, txt: 'כמעט כולם (פחות מ-' + IN_MIN_N + ' לא עברו)', short: 'כמעט כולם' }; var v = 100 * k / n; return { pct: v, txt: String(Math.round(v)) + '%', short: String(Math.round(v)) + '%' }; }
/* ONE coverage projection for every domain (nav, exams, shooting, fitness): the percentage / progress bar / ratio / denominator may be shown ONLY when inRate allows it (no 1–4 cell on either side) and the group is ≥5.
   Otherwise: no bar, no percentage, no "k/n", no denominator — only the suppressed wording. Screen text, bar width, aria-label, meta, PDF and XLSX all read this object. */
function inCover(recorded, eligible, hiddenAll) {
  var no = function (t) { return { pct: null, bar: undefined, short: t, txt: t, denom: 'מוסתר', denomCell: 'פחות מ-' + IN_MIN_N, denomNum: null, ratio: t, visible: false }; };
  if (hiddenAll || !eligible || recorded < IN_MIN_N || eligible < IN_MIN_N) return no(hiddenAll || recorded < IN_MIN_N ? 'אין מספיק נתונים' : '—');
  var c = inRate(recorded, eligible); if (c.pct === null) return no(c.short);
  var p = Math.round(c.pct); return { pct: p, bar: p, short: c.short, txt: c.txt, denom: String(eligible), denomCell: eligible, denomNum: eligible, ratio: recorded + '/' + eligible, visible: true };
}
function inFmtP(v) { return v === null || v === undefined ? '—' : String(Math.round(v)) + '%'; }
function inExamBuild(attempts, def, soldiers, ctx) {
  ctx = ctx || {}; var pass = def && def.pass_score !== null && def.pass_score !== undefined && def.pass_score !== '' && inNum(Number(def.pass_score)) ? Number(def.pass_score) : null, by = {}, cancelledSoldiers = 0, cancelledRecs = 0, dup = 0;
  (attempts || []).forEach(function (a) { if (a.exam_id !== def.id) return; if (a.record_status === 'cancelled') { cancelledRecs++; return; } if (a.soldier_cancelled) { cancelledSoldiers++; return; } var s = by[a.soldier_id] = by[a.soldier_id] || {}, p = s[a.attempt]; if (p) { dup++; if (String(a.updated_at || '') < String(p.updated_at || '')) return; } s[a.attempt] = a; });
  var sol = {}, active = {}; (soldiers || []).forEach(function (s) { sol[s.id] = s; if (s.active !== false && s.record_status !== 'cancelled') active[s.id] = 1; });
  var rows = [], pend = { B: [], C: [] }, odd = 0;
  Object.keys(by).forEach(function (id) { var s = by[id], A = s.A && inNum(s.A.score) ? s.A.score : null, B = s.B && inNum(s.B.score) ? s.B.score : null, C = s.C && inNum(s.C.score) ? s.C.score : null; if (A === null) { odd++; return; }
    var st = pass === null ? 'noPass' : A >= pass ? 'A' : B === null ? 'pendB' : B >= pass ? 'B' : C === null ? 'pendC' : C >= pass ? 'C' : 'failC', so = sol[id] || {};
    var r = { soldier_id: id, soldier_name: (s.A.soldier_name) || so.full_name || id, department_id: so.department_id, department_name: so.department_name, team_id: so.team_id, team_name: so.team_name, final_score: A, st: st, pass1: pass !== null && A >= pass, passFinal: st === 'A' || st === 'B' || st === 'C' };
    if (st === 'pendB') pend.B.push(r); if (st === 'pendC') pend.C.push(r); rows.push(r); });
  var elig = Object.assign({}, active); rows.forEach(function (r) { elig[r.soldier_id] = 1; }); var eligible = Object.keys(elig).length, recorded = rows.length, hiddenAll = recorded < IN_MIN_N || pass === null;
  var m = { v: 1, kind: 'exam', version: IN_EX_MD.version, examId: def.id, examName: def.name, pass: pass, course: ctx.course || '', generatedAt: ctx.now || new Date().toISOString(), source: IN_EX_MD.source };
  var cnt = function (k) { return rows.filter(function (r) { return r.st === k; }).length; };
  m.ops = { recorded: recorded, eligible: eligible, missing: eligible - recorded, stages: { A: cnt('A'), B: cnt('B'), C: cnt('C'), failC: cnt('failC'), pendB: cnt('pendB'), pendC: cnt('pendC') }, pend: pend, odd: odd, dup: dup, cancelledRecs: cancelledRecs, cancelledSoldiers: cancelledSoldiers, attention: [] };
  if (m.ops.missing > 0) m.ops.attention.push({ id: 'missing', text: m.ops.missing + ' חניכים ללא ניסיון א׳ במבחן', go: 'd/exams' });
  if (m.ops.stages.pendB) m.ops.attention.push({ id: 'pendB', text: m.ops.stages.pendB + ' חניכים ממתינים למועד ב׳', go: 'd/exams' });
  if (m.ops.stages.pendC) m.ops.attention.push({ id: 'pendC', text: m.ops.stages.pendC + ' חניכים ממתינים למועד ג׳', go: 'd/exams' });
  if (m.ops.stages.failC) m.ops.attention.push({ id: 'failC', text: m.ops.stages.failC + ' חניכים לא עברו גם במועד ג׳', go: 'd/exams' });
  if (odd) m.ops.attention.push({ id: 'odd', text: odd + ' חניכים עם מועד ב׳/ג׳ ללא מועד א׳ (חריגה בנתונים)', go: 'd/exams' });
  var cover = inCover(recorded, eligible, hiddenAll), pub = { cover: cover, eligible: cover.denomNum, eligibleCell: cover.denomCell, basis: 'חניכים פעילים כיום בהיקף ההרשאה, בתוספת חניכים שיש להם ניסיון א׳ (אין תיעוד היסטורי של הרכב הקורס)', hidden: hiddenAll, reason: pass === null ? 'לא הוגדר ציון עובר' : '', recorded: hiddenAll ? null : recorded, pct: cover.pct };
  if (!hiddenAll) {
    var p1 = rows.filter(function (r) { return r.pass1; }).length, pf = rows.filter(function (r) { return r.passFinal; }).length, sc = rows.map(function (r) { return r.final_score; });
    pub.score = { n: recorded, mean: inMean(sc), median: inMedian(sc), bins: inMergeBins(sc) }; pub.firstPass = inRate(p1, recorded); pub.finalPass = inRate(pf, recorded);
    var parts = inPart({ A: m.ops.stages.A, B: m.ops.stages.B, C: m.ops.stages.C, failC: m.ops.stages.failC, pend: m.ops.stages.pendB + m.ops.stages.pendC }, recorded);
    pub.stages = [['עברו במועד א׳', parts.A], ['עברו במועד ב׳', parts.B], ['עברו במועד ג׳', parts.C], ['לא עברו גם במועד ג׳', parts.failC], ['ממתינים למועד הבא', parts.pend]];
    var cur = inUnitsOf(rows, recorded), rate = {}; ['department_id', 'team_id'].forEach(function (k) { var g = {}; rows.forEach(function (r) { if (r[k]) { (g[r[k]] = g[r[k]] || []).push(r); } }); Object.keys(g).forEach(function (id) { rate[id] = g[id].length >= IN_MIN_N ? inRate(g[id].filter(function (r) { return r.pass1; }).length, g[id].length) : { pct: null, txt: '—' }; }); });
    pub.departments = cur.departments; pub.teams = cur.teams; pub.departments.concat(pub.teams).forEach(function (u) { if (!u.hidden) u.pass1 = rate[u.id]; });
  } else { pub.score = { hidden: true, reason: pass === null ? 'לא הוגדר ציון עובר למבחן' : 'פחות מ-' + IN_MIN_N + ' תוצאות — אין מספיק נתונים' }; pub.stages = []; pub.departments = []; pub.teams = []; }
  pub.attention = []; if (!hiddenAll) { var ms = eligible - recorded; if (ms > 0) pub.attention.push({ id: 'missing', text: (ms >= IN_MIN_N ? ms : 'פחות מ-' + IN_MIN_N) + ' חניכים ללא ניסיון א׳' }); var pd = inPart({ pend: m.ops.stages.pendB + m.ops.stages.pendC }, recorded).pend; if (/^\d+$/.test(pd) && +pd > 0) pub.attention.push({ id: 'pend', text: pd + ' חניכים ממתינים למועד הבא' }); }
  pub.findings = [];
  if (hiddenAll) pub.findings.push(pass === null ? 'לא הוגדר ציון עובר למבחן, ולכן אין חישוב עמידה.' : 'פחות מ-' + IN_MIN_N + ' חניכים עם תוצאה: לא מוצגים ממוצע, אחוזי עמידה או התפלגות.');
  else { pub.findings.push('עמידה במועד א׳: ' + pub.firstPass.txt + ' (N=' + recorded + ', ציון עובר ' + pass + '); עמידה סופית לאחר מועדים נוספים: ' + pub.finalPass.txt + '.'); pub.findings.push('ממוצע מועד א׳ ' + inFmt(pub.score.mean) + ', חציון ' + inFmt(pub.score.median) + '.'); var vu = pub.departments.filter(function (u) { return !u.hidden && u.pass1 && u.pass1.pct !== null; }).sort(function (a, b) { return b.pass1.pct - a.pass1.pct; }); if (vu.length >= 2) pub.findings.push('הפער בעמידה במועד א׳ בין המחלקות הגלויות: ' + Math.round(vu[0].pass1.pct - vu[vu.length - 1].pass1.pct) + ' נקודות אחוז (' + vu[0].name + ' לעומת ' + vu[vu.length - 1].name + '); תיאור בלבד, לא מסקנה סיבתית.'); }
  m.pub = pub; m.rows = rows; return m;
}
function inExamPdf(m, logos) {
  var p = m.pub, d = RK.Pdf({ title: 'דוח מבחן — ' + m.examName, stamp: inStamp(m.generatedAt), logos: logos || [] }), T = RK.colors.TEAL, R = RK.colors.RED;
  d.header('דוח מבחן עיוני — תמונת מצב', m.examName + ' · ' + (m.course || 'קורס'), ['נוצר: ' + String(m.generatedAt).slice(0, 16).replace('T', ' ') + ' (UTC) · גרסת שיטה ' + m.version + ' · מקור: ' + m.source, 'ספירות קטנות מ-' + IN_MIN_N + ' מוסתרות · ללא שמות, מספרים אישיים או דירוג אישי · ציון עובר: ' + (m.pass === null ? 'לא הוגדר' : m.pass)]);
  d.kpis([{ label: 'כיסוי מועד א׳', value: p.hidden ? 'אין מספיק נתונים' : p.cover.ratio, note: p.hidden ? 'פחות מ-' + IN_MIN_N + ' תוצאות' : p.cover.visible ? p.cover.txt + ' מהחניכים' : p.cover.txt }, { label: 'עמידה במועד א׳', value: p.hidden ? '—' : p.firstPass.short, note: p.hidden ? '' : 'N=' + p.recorded }, { label: 'עמידה סופית', value: p.hidden ? '—' : p.finalPass.short, note: p.hidden ? '' : 'לאחר מועדים ב׳/ג׳' }, { label: 'ציון א׳ ממוצע', value: p.hidden ? '—' : inFmt(p.score.mean), note: p.hidden ? '' : 'חציון ' + inFmt(p.score.median), accent: T }]);
  d.h2('מסקנות עיקריות'); p.findings.forEach(function (t) { d.callout(t); });
  if (!p.hidden) {
    d.h2('מסלול העמידה'); d.hbars({ title: 'חניכים לפי מועד העמידה', note: 'ספירות קטנות מ-' + IN_MIN_N + ' מוסתרות; הסתרה משלימה מונעת חישוב בהפרש', max: p.recorded, rowH: 22, rows: p.stages.map(function (s) { var n = /^\d+$/.test(s[1]) ? +s[1] : null; return { label: s[0], value: n, text: s[1], color: s[0].indexOf('לא עברו') === 0 ? R : T }; }) });
    if (p.score.bins.length >= 2) d.histogram({ title: 'התפלגות ציון מועד א׳', note: 'ציר מספרי משמאל לימין · כל עמודה ≥ ' + IN_MIN_N + ' חניכים · ציון עובר ' + m.pass, h: 130, bins: p.score.bins }); else d.callout('מספר החניכים קטן מכדי להציג התפלגות מפורטת.');
    d.pageBreak(); var vu = p.departments.filter(function (u) { return !u.hidden; }), hid = p.departments.length - vu.length; d.h2('יחידות');
    if (vu.length) { d.hbars({ title: 'עמידה במועד א׳ לפי מחלקה', note: 'רק יחידות עם N≥' + IN_MIN_N + (hid ? ' · ' + hid + ' יחידות הוסתרו' : ''), max: 100, rowH: 20, rows: vu.map(function (u) { return { label: u.name, value: u.pass1 && u.pass1.pct !== null ? u.pass1.pct : null, text: (u.pass1 ? u.pass1.short : '—') + ' · N=' + u.n }; }) }); d.table(['יחידה', 'N', 'עמידה במועד א׳', 'ממוצע א׳'], vu.concat(p.teams.filter(function (u) { return !u.hidden; })).map(function (u) { return [u.name, String(u.n), u.pass1 ? u.pass1.txt : '—', inFmt(u.mean)]; })); } else d.p('כל היחידות קטנות מ-' + IN_MIN_N + ' או הוסתרו — אין פירוט לפי יחידה.');
  }
  d.banner('איכות הנתונים והיקף', '', 'מה נספר, מה חסר ומה הוסתר'); d.p('בסיס הכיסוי: ' + p.basis + '.', { size: 9 });
  d.table(['פריט', 'ערך'], [['חניכים בהיקף (מכנה)', String(p.eligibleCell)], ['חניכים עם ניסיון א׳', p.hidden ? 'פחות מ-' + IN_MIN_N : String(p.recorded)], ['ציון עובר', m.pass === null ? 'לא הוגדר' : String(m.pass)]]);
  if (p.attention.length) { d.h2('מה דורש טיפול'); p.attention.forEach(function (a) { d.callout(a.text, { accent: R }); }); }
  d.h2('הגדרות ושיטה'); d.table(['מדד', 'הגדרה'], [['עמידה במועד א׳', 'חניכים שציון מועד א׳ שלהם ≥ ציון עובר, מתוך החניכים עם ניסיון א׳'], ['עמידה סופית', 'חניכים שעברו באחד המועדים א׳/ב׳/ג׳ (לפי כללי המבחנים המאושרים), מתוך אותם חניכים'], ['ממתינים למועד הבא', 'נכשלו במועד האחרון שנרשם ועדיין אין מועד נוסף'], ['לא נכלל', 'ציון משוקלל, דירוג אישי, חיזוי או ספי עמידה שלא הוגדרו']]);
  d.p('כל המספרים נגזרים מאותו מודל כמו המסך. ספירה קטנה מ-' + IN_MIN_N + ' אינה מוצגת; אין מינימום/מקסימום; הסתרה משלימה בין יחידות. מידע סינתטי בלבד בסביבת בדיקה.', { size: 8, color: RK.colors.GREY });
  return d.build();
}
function inExamXlsx(m) {
  var p = m.pub, sh = [], c = function (v) { return v === null || v === undefined ? 'מוסתר' : v; };
  sh.push({ name: 'סיכום', header: ['מדד', 'ערך', 'הערה'], rows: [['מבחן', m.examName, ''], ['קורס', m.course, ''], ['ציון עובר', m.pass === null ? 'לא הוגדר' : m.pass, ''], ['חניכים בהיקף (מכנה)', p.eligibleCell, p.basis], ['חניכים עם ניסיון א׳', p.hidden ? 'פחות מ-' + IN_MIN_N : p.recorded, ''], ['עמידה במועד א׳', p.hidden ? 'מוסתר' : p.firstPass.txt, ''], ['עמידה סופית', p.hidden ? 'מוסתר' : p.finalPass.txt, ''], ['ציון א׳ ממוצע', p.hidden ? 'מוסתר' : inR1(p.score.mean), p.hidden ? '' : 'N=' + p.score.n], ['כלל הסתרה', 'ספירה קטנה מ-' + IN_MIN_N + ' אינה מוצגת', ''], ['נוצר (UTC)', m.generatedAt, 'גרסה ' + m.version]] });
  sh.push({ name: 'מסלול עמידה', header: ['שלב', 'חניכים'], rows: p.stages.length ? p.stages.map(function (s) { return [s[0], /^\d+$/.test(s[1]) ? +s[1] : s[1]]; }) : [['אין מספיק נתונים', '']] });
  sh.push({ name: 'התפלגות', header: ['טווח ציון', 'חניכים'], rows: p.hidden ? [['אין מספיק נתונים', '']] : p.score.bins.map(function (b) { return [b.label, b.n]; }) });
  var ur = function (lvl) { return function (u) { return [lvl, u.name, u.hidden ? 'מוסתר' : u.n, u.hidden ? 'מוסתר' : inR1(u.mean), u.hidden ? 'מוסתר' : (u.pass1 ? u.pass1.txt : '—'), u.reason || '']; }; };
  sh.push({ name: 'יחידות', header: ['רמה', 'יחידה', 'N', 'ממוצע א׳', 'עמידה במועד א׳', 'הערה'], rows: p.departments.map(ur('מחלקה')).concat(p.teams.map(ur('צוות'))) });
  sh.push({ name: 'מה דורש טיפול', header: ['פריט'], rows: p.attention.length ? p.attention.map(function (a) { return [a.text]; }) : [['אין פריטים']] });
  return RK.xlsx({ sheets: sh });
}
function inExamLoad(examId) {
  var cid = S.course.id; return Promise.all([api('soldiers.list', { courseId: cid, opts: {} }, 'fresh'), api('exams.defs', { courseId: cid, opts: {} }, 'fresh'), api('exams.attempts', { courseId: cid, opts: {} }, 'fresh')]).then(function (rr) {
    for (var i = 0; i < 3; i++) if (!rr[i].ok) return rr[i]; var def = (rr[1].data || []).filter(function (x) { return x.id === examId; })[0]; if (!def) return { ok: false, code: 'NOT_FOUND', message: 'המבחן לא נמצא.' };
    return { ok: true, model: inExamBuild(rr[2].data || [], def, rr[0].data || [], { course: S.course && S.course.name }) };
  });
}
function inExamFile(m, kind) { var pdf = kind === 'pdf'; return inGated('exams', pdf ? 'pdf' : 'xlsx', m.examId, function () { return pdf ? inExamPdf(m) : inExamXlsx(m); }, 'maslul-exam_' + String(m.examId).replace(/[^A-Za-z0-9-]/g, '') + '_' + String(m.generatedAt).slice(0, 10) + '_v1.' + (pdf ? 'pdf' : 'xlsx')); }
function ExamInsight(examId) {
  var body = h('div', { 'aria-live': 'polite' }, [skeleton(3)]);
  mount('more', [h('button', { class: 'back', type: 'button', id: 'exBack', onclick: function () { go('insight'); }, text: '→ חזרה לתובנות ודוחות' }), h('h1', { class: 'page', text: 'ניתוח מבחן' }), body], 'ניתוח מבחן');
  function draw() {
    body.replaceChildren(skeleton(3)); inExamLoad(examId).then(function (r) {
      body.replaceChildren(); if (!r.ok) { body.append(errBox(r, draw), h('p', { class: 'muted', text: 'לא מוצגים נתונים או תובנות כשהקריאה מהשרת נכשלה.' })); return; }
      var m = r.model, P = m.pub, O = m.ops; window.__insight.exam = m;
      body.append(h('p', { class: 'in-sub', id: 'exSub', text: m.examName + ' · ' + (m.course || '') + ' · ציון עובר ' + (m.pass === null ? 'לא הוגדר' : m.pass) }), h('details', { class: 'in-meta', id: 'exStamp' }, [h('summary', { text: 'נקרא מהשרת ' + new Date(m.generatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + ' · מקור ומכנה' }), h('p', { text: 'מקור: ' + m.source + ' · מכנה: ' + (P.cover.visible ? P.cover.denom + ' חניכים' : 'מוסתר (קבוצה קטנה / משלים קטן מ-' + IN_MIN_N + ')') + ' (' + P.basis + ')' })]));
      if (!O.recorded) { body.append(emptyBox('אין עדיין ניסיונות א׳ במבחן זה — אין מה לנתח.')); return; }
      body.append(h('div', { class: 'in-kpis' }, [kpi('כיסוי מועד א׳', P.hidden ? 'אין מספיק נתונים' : P.cover.ratio, P.hidden ? 'פחות מ-' + IN_MIN_N + ' תוצאות' : P.cover.txt, 'exK1', '', P.cover.bar), kpi('עמידה במועד א׳', P.hidden ? '—' : P.firstPass.short, P.hidden ? '' : 'N=' + P.recorded, 'exK2'), kpi('עמידה סופית', P.hidden ? '—' : P.finalPass.short, P.hidden ? '' : 'לאחר מועדים ב׳/ג׳', 'exK3'), kpi('ממוצע מועד א׳', P.hidden ? '—' : inFmt(P.score.mean), P.hidden ? '' : 'חציון ' + inFmt(P.score.median), 'exK4')]));
      var act = h('div', { class: 'btns in-act' }); if (isAdmin()) act.append(h('button', { class: 'primary', type: 'button', id: 'exPdf', text: 'יצירת דוח PDF', onclick: function (ev) { var b = ev.currentTarget; busy(b, true); setTimeout(function () { inExamFile(m, 'pdf').then(function () { busy(b, false); }); }, 30); } }), h('button', { class: 'secondary', type: 'button', id: 'exXlsx', text: 'ייצוא נתונים (Excel)', onclick: function (ev) { var b = ev.currentTarget; busy(b, true); setTimeout(function () { inExamFile(m, 'xlsx').then(function () { busy(b, false); }); }, 30); } })); else act.append(h('p', { class: 'muted', id: 'exNoExport', text: 'הפקת קבצים מותרת למנהל בלבד. הכפתורים מוסתרים כאן, וההרשאה נבדקת ונרשמת גם בשרת בכל הפקה.' }));
      act.append(h('button', { class: 'secondary', type: 'button', id: 'exRefresh', text: 'רענון', onclick: draw })); body.append(act);
      body.append(sectionHead('ממצאים', null), h('ul', { class: 'in-find', id: 'exFind' }, P.findings.map(function (t) { return h('li', { text: t }); })));
      if (P.hidden) body.append(h('div', { class: 'msg', id: 'exInsufficient', role: 'status', text: (P.score.reason || 'אין מספיק נתונים') + '. כל המדדים הקבוצתיים מוסתרים; הנתונים המבצעיים למטה מיועדים למורשים בלבד.' }));
      else {
        body.append(sectionHead('מסלול העמידה', null), h('table', { class: 'in-table', id: 'exStages' }, [h('thead', {}, [h('tr', {}, ['שלב', 'חניכים'].map(function (x) { return h('th', { scope: 'col', text: x }); }))]), h('tbody', {}, P.stages.map(function (s) { return h('tr', {}, [h('td', { text: s[0] }), h('td', { text: s[1] })]); }))]));
        var picked = -1, hb = h('div', { id: 'exHistBox' }), sb = h('div', { id: 'exSheetBox' }); var drawH = function () { hb.replaceChildren(chartFigure('exHist', 'התפלגות ציון מועד א׳ · N=' + P.score.n + ' · הקשה על עמודה מראה פירוט', histChart(P, function (i) { picked = i; drawH(); }, picked), 'התפלגות ציון מועד א׳: ' + P.score.bins.map(function (b) { return b.label + ' — ' + b.n; }).join('; '), ['טווח', 'חניכים'], P.score.bins.map(function (b) { return [b.label, b.n]; }))); sb.replaceChildren(); if (picked >= 0) sb.append(inBinSheet(P, picked, null, 'exSheet')); }; body.append(sectionHead('התפלגות ציון מועד א׳', 'כל עמודה ≥ ' + IN_MIN_N), hb, sb); drawH();
        var us = P.departments.concat(P.teams); if (us.length) { body.append(sectionHead('יחידות', 'N≥' + IN_MIN_N)); body.append(h('table', { class: 'in-table', id: 'exUnits' }, [h('thead', {}, [h('tr', {}, ['יחידה', 'N', 'עמידה במועד א׳', 'ממוצע'].map(function (x) { return h('th', { scope: 'col', text: x }); }))]), h('tbody', {}, us.map(function (u) { return h('tr', {}, [h('td', { text: u.name }), h('td', { text: u.hidden ? 'מוסתר' : String(u.n) }), h('td', { text: u.hidden ? u.reason : (u.pass1 ? u.pass1.txt : '—') }), h('td', { text: u.hidden ? 'מוסתר' : inFmt(u.mean) })]); }))])); }
      }
      var opBox = h('section', { class: 'in-op', id: 'exOps', 'aria-label': 'תצוגה מבצעית' }, [h('h3', { text: 'תצוגה מבצעית — מספרים מדויקים (לא נכללים בקבצים)' }), h('p', { class: 'muted', id: 'exOpsLine', text: O.recorded + ' עם ניסיון א׳ · ' + O.eligible + ' בהיקף · ' + O.missing + ' ללא ניסיון · עברו א׳/ב׳/ג׳: ' + O.stages.A + '/' + O.stages.B + '/' + O.stages.C + ' · לא עברו: ' + O.stages.failC + ' · ממתינים: ' + (O.stages.pendB + O.stages.pendC) })]);
      O.attention.forEach(function (a) { opBox.append(card(a.text, 'פתיחת המסך הרלוונטי', null, function () { go(a.go); })); });
      var pl = O.pend.B.concat(O.pend.C); if (pl.length) { opBox.append(h('h4', { text: 'ממתינים למועד הבא (מבצעי)' })); pl.slice(0, 60).forEach(function (x) { opBox.append(card(x.soldier_name, 'ציון מועד א׳: ' + inFmt(x.final_score), null, function () { go('soldier/' + x.soldier_id); })); }); }
      body.append(opBox);
    });
  }
  draw();
}
window.__insight.examBuild = inExamBuild; window.__insight.examPdf = inExamPdf; window.__insight.examXlsx = inExamXlsx;
