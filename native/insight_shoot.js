
/* ===== SHOOTING insight ("דוח קליעה"): regular score and YLM are SEPARATE measures (Marksmanship.gs); one value per SOLDIER (the latest result of that measure), never per record.
   No pass/fail threshold is approved for marksmanship (scale assumption only) ⇒ NO pass rate, no grade, no ranking, no prediction: coverage, distribution, mean/median, weapon zeroing, weapon type and units.
   Same small-cell policy as the other reports: group-facing projection `pub` (screen, PDF, Excel) vs operational zone `ops` (screen only, exact numbers for authorized staff). ===== */
var IN_SH_MD = { version: 'insight-shoot-1', source: 'mk.list · soldiers.list' };
function inShootBuild(list, soldiers, ctx) {
  ctx = ctx || {}; var sol = {}, active = {}; (soldiers || []).forEach(function (s) { sol[s.id] = s; if (s.active !== false && s.record_status !== 'cancelled') active[s.id] = 1; });
  var cancelledRecs = 0, reg = {}, ylm = {}, any = {};
  var later = function (a, b) { return !a || String(b.test_date) > String(a.test_date) || (String(b.test_date) === String(a.test_date) && String(b.updated_at || '') >= String(a.updated_at || '')); };
  (list || []).forEach(function (r) { if (r.record_status === 'cancelled') { cancelledRecs++; return; } if (r.soldier_cancelled) return; any[r.soldier_id] = later(any[r.soldier_id], r) ? r : any[r.soldier_id];
    if (inNum(r.examiner_score) && later(reg[r.soldier_id], r)) reg[r.soldier_id] = r; if (inNum(r.ylm_score) && later(ylm[r.soldier_id], r)) ylm[r.soldier_id] = r; });
  var rows = Object.keys(reg).map(function (id) { var r = reg[id], so = sol[id] || {}; return { soldier_id: id, soldier_name: r.soldier_name || so.full_name || id, department_id: so.department_id, department_name: so.department_name, team_id: so.team_id, team_name: so.team_name, final_score: Number(r.examiner_score), weapon: String(r.weapon_type || '—'), zeroed: r.weapon_zeroed === true }; });
  var yl = Object.keys(ylm).map(function (id) { return Number(ylm[id].ylm_score); });
  var elig = Object.assign({}, active); Object.keys(any).forEach(function (id) { elig[id] = 1; }); var eligible = Object.keys(elig).length, recorded = rows.length, hidden = recorded < IN_MIN_N;
  var zYes = rows.filter(function (r) { return r.zeroed; }).length, wc = {}; rows.forEach(function (r) { (wc[r.weapon] = wc[r.weapon] || []).push(r); });
  var m = { v: 1, kind: 'shooting', version: IN_SH_MD.version, course: ctx.course || '', generatedAt: ctx.now || new Date().toISOString(), source: IN_SH_MD.source };
  m.ops = { recorded: recorded, eligible: eligible, missing: eligible - recorded, ylm: yl.length, zeroed: zYes, notZeroed: recorded - zYes, cancelledRecs: cancelledRecs, attention: [], notZeroedList: rows.filter(function (r) { return !r.zeroed; }), missingList: Object.keys(elig).filter(function (id) { return !reg[id]; }).map(function (id) { return { soldier_id: id, soldier_name: (sol[id] || {}).full_name || id }; }) };
  if (m.ops.missing > 0) m.ops.attention.push({ id: 'missing', text: m.ops.missing + ' חניכים ללא תוצאת קליעה רגילה', go: 'd/mk' });
  if (m.ops.notZeroed > 0) m.ops.attention.push({ id: 'zero', text: m.ops.notZeroed + ' חניכים שהנשק בבדיקה האחרונה לא מאופס', go: 'd/mk' });
  var pub = { eligible: eligible, eligibleCell: eligible >= IN_MIN_N ? eligible : 'פחות מ-' + IN_MIN_N, recorded: hidden ? null : recorded, hidden: hidden, basis: 'חניכים פעילים כיום בהיקף ההרשאה, בתוספת חניכים שיש להם תוצאה (אין תיעוד היסטורי של הרכב הקורס)', pct: null, coverage: inRate(recorded, eligible), findings: [], attention: [], weapons: [], departments: [], teams: [] };
  if (!hidden) { pub.pct = Math.round(100 * recorded / eligible); var sc = inScores(rows);
    pub.score = { n: recorded, mean: inMean(sc), median: inMedian(sc), bins: inMergeBins(sc) }; pub.zeroRate = inRate(zYes, recorded);
    pub.ylm = yl.length >= IN_MIN_N ? { n: yl.length, mean: inMean(yl), median: inMedian(yl) } : { hidden: true, reason: 'פחות מ-' + IN_MIN_N + ' תוצאות יל״מ' };
    var wk = Object.keys(wc), cells = {}; wk.forEach(function (k, i) { cells['w' + i] = wc[k].length; }); var parts = inPart(cells, recorded);
    pub.weapons = wk.map(function (k, i) { var vis = /^\d+$/.test(parts['w' + i]); return { name: k, n: vis ? wc[k].length : null, hidden: !vis, mean: vis ? inMean(inScores(wc[k])) : undefined, reason: vis ? '' : 'פחות מ-' + IN_MIN_N + ' / הסתרה משלימה' }; }).sort(inByName);
    var cur = inUnitsOf(rows, recorded); pub.departments = cur.departments; pub.teams = cur.teams;
    pub.findings.push('כיסוי קליעה רגילה: ' + (pub.coverage.pct === null ? pub.coverage.txt : pub.coverage.txt) + '. ממוצע ' + inFmt(pub.score.mean) + ', חציון ' + inFmt(pub.score.median) + ' (N=' + recorded + ').');
    pub.findings.push(pub.zeroRate.pct === null ? 'שיעור נשק מאופס: ' + pub.zeroRate.txt + '.' : 'נשק מאופס בבדיקה האחרונה: ' + pub.zeroRate.txt + '.');
    pub.findings.push(pub.ylm.hidden ? 'יל״מ (נמדד בנפרד, לא נכלל בממוצע הרגיל): ' + pub.ylm.reason + '.' : 'יל״מ (נמדד בנפרד, לא נכלל בממוצע הרגיל): ממוצע ' + inFmt(pub.ylm.mean) + ', חציון ' + inFmt(pub.ylm.median) + ' (N=' + pub.ylm.n + ').');
    pub.findings.push('לא הוגדר סף עמידה בקליעה, ולכן אין אחוז עובר ואין דירוג.'); var ms = eligible - recorded; if (ms > 0) pub.attention.push({ id: 'missing', text: (ms >= IN_MIN_N ? ms : 'פחות מ-' + IN_MIN_N) + ' חניכים ללא תוצאת קליעה רגילה' });
  } else pub.findings.push('פחות מ-' + IN_MIN_N + ' חניכים עם תוצאת קליעה רגילה: לא מוצגים ממוצע, התפלגות או פילוחים. הנתונים המבצעיים זמינים למורשים בלבד.');
  m.pub = pub; m.rows = rows; return m;
}
function inShootPdf(m, logos) {
  var p = m.pub, d = RK.Pdf({ title: 'דוח קליעה', stamp: inStamp(m.generatedAt), logos: logos || [] }), R = RK.colors.RED;
  d.header('דוח קליעה — תמונת מצב', (m.course || 'קורס'), ['נוצר: ' + String(m.generatedAt).slice(0, 16).replace('T', ' ') + ' (UTC) · גרסת שיטה ' + m.version + ' · מקור: ' + m.source, 'ספירות קטנות מ-' + IN_MIN_N + ' מוסתרות · ללא שמות, מספרים אישיים או דירוג אישי · קליעה רגילה ויל״מ נמדדות בנפרד']);
  d.kpis([{ label: 'כיסוי קליעה רגילה', value: p.hidden ? 'אין מספיק נתונים' : p.coverage.short, note: p.hidden ? 'פחות מ-' + IN_MIN_N + ' תוצאות' : 'N=' + p.recorded }, { label: 'ממוצע קליעה רגילה', value: p.hidden ? '—' : inFmt(p.score.mean), note: p.hidden ? '' : 'חציון ' + inFmt(p.score.median) }, { label: 'יל״מ (נפרד)', value: p.hidden || p.ylm.hidden ? '—' : inFmt(p.ylm.mean), note: p.hidden || p.ylm.hidden ? 'פחות מ-' + IN_MIN_N : 'N=' + p.ylm.n }, { label: 'נשק מאופס', value: p.hidden ? '—' : p.zeroRate.short, note: 'בבדיקה האחרונה' }]);
  d.h2('מסקנות עיקריות'); p.findings.forEach(function (t) { d.callout(t); });
  if (!p.hidden) {
    if (p.score.bins.length >= 2) d.histogram({ title: 'התפלגות ציון קליעה רגילה', note: 'ציר מספרי משמאל לימין · כל עמודה ≥ ' + IN_MIN_N + ' חניכים', h: 130, bins: p.score.bins });
    d.h2('לפי סוג נשק'); d.table(['נשק', 'חניכים', 'ממוצע'], p.weapons.map(function (w) { return [w.name, w.hidden ? 'מוסתר' : String(w.n), w.hidden ? 'מוסתר' : inFmt(w.mean)]; }));
    d.pageBreak(); d.h2('יחידות'); var us = p.departments.concat(p.teams); d.table(['יחידה', 'N', 'ממוצע'], us.length ? us.map(function (u) { return [u.name, u.hidden ? 'מוסתר' : String(u.n), u.hidden ? 'מוסתר' : inFmt(u.mean)]; }) : [['אין יחידות להצגה', '', '']]);
  }
  if (p.attention.length) { d.h2('מה דורש טיפול'); p.attention.forEach(function (a) { d.callout(a.text, { accent: R }); }); }
  d.banner('איכות הנתונים והיקף', '', 'מה נספר, מה חסר ומה הוסתר'); d.p('בסיס הכיסוי: ' + p.basis + '.', { size: 9 });
  d.h2('הגדרות ושיטה'); d.table(['מדד', 'הגדרה'], [['ערך לחניך', 'התוצאה האחרונה של אותו חניך בכל מדד (לא ממוצע רשומות); קליעה רגילה ויל״מ נפרדות'], ['כיסוי', 'חניכים עם תוצאה רגילה מתוך החניכים בהיקף'], ['נשק מאופס', 'בבדיקה הרגילה האחרונה של החניך'], ['סף עמידה', 'לא הוגדר — אין אחוז עובר, אין דירוג'], ['הסתרה', 'ספירה קטנה מ-' + IN_MIN_N + ' ומשלימה לה אינן מוצגות; אין מינימום/מקסימום']]);
  d.p('כל המספרים נגזרים מאותו מודל כמו המסך. מידע סינתטי בסביבת בדיקה בלבד.', { size: 8.5, color: RK.colors.GREY }); return d.build();
}
function inShootXlsx(m) {
  var p = m.pub, sh = [], c = function (v) { return v === null || v === undefined ? 'מוסתר' : v; };
  sh.push({ name: 'סיכום', header: ['מדד', 'ערך', 'הערה'], rows: [['קורס', m.course, ''], ['חניכים בהיקף (מכנה)', p.eligibleCell, p.basis], ['חניכים עם תוצאה רגילה', p.hidden ? 'פחות מ-' + IN_MIN_N : c(p.recorded), ''], ['כיסוי', p.hidden ? '—' : p.coverage.txt, ''], ['ממוצע קליעה רגילה', p.hidden ? '—' : inR1(p.score.mean), p.hidden ? '' : 'חציון ' + inR1(p.score.median)], ['יל״מ — ממוצע (נפרד)', p.hidden || p.ylm.hidden ? '—' : inR1(p.ylm.mean), p.hidden || p.ylm.hidden ? '' : 'N=' + p.ylm.n], ['נשק מאופס', p.hidden ? '—' : p.zeroRate.txt, 'בבדיקה האחרונה'], ['גרסת שיטה', m.version, ''], ['נוצר (UTC)', m.generatedAt, '']] });
  sh.push({ name: 'התפלגות', header: ['טווח ציון', 'חניכים'], rows: p.hidden ? [['אין מספיק נתונים', '']] : p.score.bins.map(function (b) { return [b.label, b.n]; }) });
  sh.push({ name: 'סוג נשק', header: ['נשק', 'חניכים', 'ממוצע'], rows: p.weapons.length ? p.weapons.map(function (w) { return [w.name, w.hidden ? 'מוסתר' : w.n, w.hidden ? 'מוסתר' : inR1(w.mean)]; }) : [['אין מספיק נתונים', '', '']] });
  var ur = function (lvl) { return function (u) { return [lvl, u.name, u.hidden ? 'מוסתר' : u.n, u.hidden ? 'מוסתר' : inR1(u.mean), u.reason || '']; }; };
  sh.push({ name: 'יחידות', header: ['רמה', 'יחידה', 'N', 'ממוצע', 'הערה'], rows: p.departments.map(ur('מחלקה')).concat(p.teams.map(ur('צוות'))) });
  sh.push({ name: 'מה דורש טיפול', header: ['פריט'], rows: p.attention.length ? p.attention.map(function (a) { return [a.text]; }) : [['אין פריטים']] });
  return RK.xlsx({ sheets: sh });
}
function inShootLoad() { var cid = S.course.id; return Promise.all([api('soldiers.list', { courseId: cid, opts: {} }, 'fresh'), api('mk.list', { courseId: cid, opts: {} }, 'fresh')]).then(function (rr) { for (var i = 0; i < 2; i++) if (!rr[i].ok) return rr[i]; return { ok: true, model: inShootBuild(rr[1].data || [], rr[0].data || [], { course: S.course && S.course.name }) }; }); }
function inShootFile(m, kind) { var pdf = kind === 'pdf'; return inGated('shooting', pdf ? 'pdf' : 'xlsx', 'all', function () { return pdf ? inShootPdf(m) : inShootXlsx(m); }, 'maslul-shooting_' + String(m.generatedAt).slice(0, 10) + '_v1.' + (pdf ? 'pdf' : 'xlsx')); }
function ShootInsight() {
  var body = h('div', { 'aria-live': 'polite' }, [skeleton(3)]);
  mount('more', [h('button', { class: 'back', type: 'button', id: 'shBack', onclick: function () { go('insight'); }, text: '→ חזרה לתובנות ודוחות' }), h('h1', { class: 'page', text: 'דוח קליעה' }), body], 'דוח קליעה');
  function draw() {
    body.replaceChildren(skeleton(3)); inShootLoad().then(function (r) {
      body.replaceChildren(); if (!r.ok) { body.append(errBox(r, draw), h('p', { class: 'muted', text: 'לא מוצגים נתונים או תובנות כשהקריאה מהשרת נכשלה.' })); return; }
      var m = r.model, P = m.pub, O = m.ops; window.__insight.shoot = m;
      body.append(h('p', { class: 'in-sub', id: 'shSub', text: (m.course || '') + ' · קליעה רגילה ויל״מ נמדדות בנפרד · ללא סף עמידה' }), h('details', { class: 'in-meta', id: 'shStamp' }, [h('summary', { text: 'נקרא מהשרת ' + new Date(m.generatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + ' · מקור ומכנה' }), h('p', { text: 'מקור: ' + m.source + ' · מכנה: ' + P.eligible + ' חניכים (' + P.basis + ')' })]));
      if (!O.recorded) { body.append(emptyBox('אין עדיין תוצאות קליעה רגילה — אין מה לנתח.')); return; }
      body.append(h('div', { class: 'in-kpis' }, [kpi('כיסוי קליעה', P.hidden ? 'אין מספיק נתונים' : P.coverage.short, P.hidden ? 'פחות מ-' + IN_MIN_N + ' תוצאות' : 'N=' + P.recorded, 'shK1', '', P.hidden ? undefined : P.pct), kpi('ממוצע רגילה', P.hidden ? '—' : inFmt(P.score.mean), P.hidden ? '' : 'חציון ' + inFmt(P.score.median), 'shK2'), kpi('יל״מ (נפרד)', P.hidden || P.ylm.hidden ? '—' : inFmt(P.ylm.mean), P.hidden || P.ylm.hidden ? '' : 'N=' + P.ylm.n, 'shK3'), kpi('נשק מאופס', P.hidden ? '—' : P.zeroRate.short, 'בבדיקה האחרונה', 'shK4')]));
      var act = h('div', { class: 'btns in-act' }); if (isAdmin()) act.append(h('button', { class: 'primary', type: 'button', id: 'shPdf', text: 'יצירת דוח PDF', onclick: function (ev) { var b = ev.currentTarget; busy(b, true); setTimeout(function () { inShootFile(m, 'pdf').then(function () { busy(b, false); }); }, 30); } }), h('button', { class: 'secondary', type: 'button', id: 'shXlsx', text: 'ייצוא נתונים (Excel)', onclick: function (ev) { var b = ev.currentTarget; busy(b, true); setTimeout(function () { inShootFile(m, 'xlsx').then(function () { busy(b, false); }); }, 30); } })); else act.append(h('p', { class: 'muted', id: 'shNoExport', text: 'הפקת קבצים מותרת למנהל הקורס בלבד.' }));
      act.append(h('button', { class: 'secondary', type: 'button', id: 'shRefresh', text: 'רענון', onclick: draw })); body.append(act);
      body.append(sectionHead('ממצאים', null), h('ul', { class: 'in-find', id: 'shFind' }, P.findings.map(function (t) { return h('li', { text: t }); })));
      if (P.hidden) body.append(h('div', { class: 'msg', id: 'shInsufficient', role: 'status', text: 'אין מספיק נתונים להצגה קבוצתית. הנתונים המבצעיים למטה מיועדים למורשים בלבד.' }));
      else {
        var picked = -1, hb = h('div', { id: 'shHistBox' }), sb = h('div', { id: 'shSheetBox' }); var drawH = function () { hb.replaceChildren(chartFigure('shHist', 'התפלגות ציון קליעה · N=' + P.score.n + ' · הקשה על עמודה מראה פירוט', histChart(P, function (i) { picked = i; drawH(); }, picked), 'התפלגות ציון קליעה: ' + P.score.bins.map(function (b) { return b.label + ' — ' + b.n; }).join('; '), ['טווח', 'חניכים'], P.score.bins.map(function (b) { return [b.label, b.n]; }))); sb.replaceChildren(); if (picked >= 0) sb.append(inBinSheet(P, picked, m.rows, 'shSheet')); }; body.append(sectionHead('התפלגות ציון קליעה רגילה', 'כל עמודה ≥ ' + IN_MIN_N), hb, sb); drawH();
        body.append(sectionHead('לפי סוג נשק', null), h('table', { class: 'in-table', id: 'shWeapons' }, [h('thead', {}, [h('tr', {}, ['נשק', 'חניכים', 'ממוצע'].map(function (x) { return h('th', { scope: 'col', text: x }); }))]), h('tbody', {}, P.weapons.map(function (w) { return h('tr', {}, [h('td', { text: w.name }), h('td', { text: w.hidden ? 'מוסתר' : String(w.n) }), h('td', { text: w.hidden ? 'מוסתר' : inFmt(w.mean) })]); }))]));
        var us = P.departments.concat(P.teams); if (us.length) { body.append(sectionHead('יחידות', 'N≥' + IN_MIN_N)); body.append(h('table', { class: 'in-table', id: 'shUnits' }, [h('thead', {}, [h('tr', {}, ['יחידה', 'N', 'ממוצע'].map(function (x) { return h('th', { scope: 'col', text: x }); }))]), h('tbody', {}, us.map(function (u) { return h('tr', {}, [h('td', { text: u.name }), h('td', { text: u.hidden ? 'מוסתר' : String(u.n) }), h('td', { text: u.hidden ? u.reason : inFmt(u.mean) })]); }))])); }
      }
      var opBox = h('section', { class: 'in-op', id: 'shOps', 'aria-label': 'תצוגה מבצעית' }, [h('h3', { text: 'תצוגה מבצעית — מספרים מדויקים (לא נכללים בקבצים)' }), h('p', { class: 'muted', id: 'shOpsLine', text: O.recorded + ' עם תוצאה רגילה · ' + O.eligible + ' בהיקף · ' + O.missing + ' ללא תוצאה · יל״מ: ' + O.ylm + ' · נשק מאופס/לא מאופס: ' + O.zeroed + '/' + O.notZeroed })]);
      O.attention.forEach(function (a) { opBox.append(card(a.text, 'פתיחת המסך הרלוונטי', null, function () { go(a.go); })); });
      O.notZeroedList.slice(0, 60).forEach(function (x) { opBox.append(card(x.soldier_name, 'נשק לא מאופס בבדיקה האחרונה · ציון ' + inFmt(x.final_score), null, function () { go('soldier/' + x.soldier_id); })); }); body.append(opBox);
    });
  }
  draw();
}
window.__insight.shootBuild = inShootBuild; window.__insight.shootPdf = inShootPdf; window.__insight.shootXlsx = inShootXlsx;
