/* MASLUL 2027 — data → insight → decision → report (first vertical slice: NAVIGATION).
   ONE model per navigation event (type + date) is built from the EXISTING authorized read `nav.list` + `soldiers.list`; the same model feeds the screen, the PDF and the Excel file (no second calculation).
   Privacy: aggregates (average / median / distribution / unit rows / trend / deltas) exist only for N ≥ 5, with complementary suppression among siblings; the PDF and Excel contain aggregates only.
   Individual rows appear only in the operational list on screen (the same records the account already sees in "ניווט"), never in a file. Descriptive, deterministic sentences only — no AI, no thresholds, no personal judgement.
   Files are produced in the browser by ReportKit from data the server already authorized for this session; the server's per-request audit covers the reads. */
  var IN_MIN_N = 5;
  /* MetricDefinition registry — every number on screen / in the PDF / in the Excel points at one of these. */
  var MD = {
    'nav.final': { label: 'ציון ניווט סופי', unit: 'נקודות (0–100)', source: 'NavigationTests.final_score דרך nav.list', numerator: 'ממוצע final_score', denominator: 'חניכים פעילים עם רשומה פעילה וציון סופי באירוע', direction: 'גבוה = טוב יותר', nulls: 'רשומה ללא ציון סופי אינה נספרת בממוצע ומוצגת כ"ללא ציון"', compare: 'אותו סוג ניווט בלבד; השוואה רק כש-N≥5 בשני האירועים', version: 'insight-1' },
    'nav.plan': { label: 'ציון תכנון', unit: '0–5', source: 'NavigationTests.plan_score', numerator: 'ממוצע plan_score', denominator: 'רשומות פעילות עם ערך', direction: 'גבוה = טוב יותר', nulls: 'ערך חסר אינו נספר', compare: 'לא מושווה', version: 'insight-1' },
    'nav.debrief': { label: 'ציון תחקיר', unit: '0–5', source: 'NavigationTests.debrief_score', numerator: 'ממוצע debrief_score', denominator: 'רשומות פעילות עם ערך', direction: 'גבוה = טוב יותר', nulls: 'ערך חסר אינו נספר', compare: 'לא מושווה', version: 'insight-1' },
    'nav.points': { label: 'נקודות שנדקרו', unit: '% מסך הנקודות', source: 'NavigationTests.points_completed / points_total', numerator: 'ממוצע points_completed ÷ points_total × 100', denominator: 'רשומות פעילות עם points_total > 0', direction: 'גבוה = טוב יותר', nulls: 'points_total חסר או 0 אינו נספר', compare: 'לא מושווה', version: 'insight-1' },
    'nav.coverage': { label: 'כיסוי', unit: '% מהחניכים הפעילים', source: 'soldiers.list (פעילים) מול nav.list', numerator: 'חניכים עם רשומה פעילה באירוע', denominator: 'חניכים פעילים בהיקף ההרשאה של המשתמש', direction: 'גבוה = כיסוי רחב יותר', nulls: 'היעדרות/פטור אינם נתמכים במודל הנתונים ולכן אינם מוצגים', compare: 'לא מושווה', version: 'insight-1' }
  };
  var inNum = function (v) { return typeof v === 'number' && isFinite(v); };
  var inR1 = function (v) { return Math.round(v * 10) / 10; };
  var inFmt = function (v) { return inNum(v) ? String(inR1(v)) : '—'; };
  var inSign = function (v) { return '\u200e' + (v > 0 ? '+' : v < 0 ? '−' : '') + inR1(Math.abs(v)); };
  function inMean(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
  function inMedian(a) { var s = a.slice().sort(function (x, y) { return x - y; }), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
  var IN_BINS = [[0, 59, '0–59'], [60, 69, '60–69'], [70, 79, '70–79'], [80, 89, '80–89'], [90, 100, '90–100']];

  /* active, scored, one-per-soldier view of one event; duplicates are counted (the server has no atomic uniqueness yet), the latest record wins */
  function inEventRows(rows, typeId, date) {
    var by = {}, dup = 0, cancelled = 0;
    rows.forEach(function (r) { if (r.navigation_type_id !== typeId || String(r.test_date).slice(0, 10) !== date) return; if (r.record_status === 'cancelled') { cancelled++; return; } var p = by[r.soldier_id]; if (p) { dup++; if (String(r.created_at || '') >= String(p.created_at || '')) by[r.soldier_id] = r; } else by[r.soldier_id] = r; });
    return { rows: Object.keys(by).map(function (k) { return by[k]; }), dup: dup, cancelled: cancelled };
  }
  function inGroupStats(list) { var v = list.map(function (r) { return r.final_score; }).filter(inNum); return v.length >= IN_MIN_N ? { n: v.length, mean: inMean(v), median: inMedian(v), min: Math.min.apply(null, v), max: Math.max.apply(null, v) } : { n: v.length, hidden: true }; }
  function inUnits(evRows, key, nameKey, prevByKey) {
    var g = {}; evRows.forEach(function (r) { var k = r[key]; if (!k) return; (g[k] = g[k] || { id: k, name: r[nameKey] || k, rows: [] }).rows.push(r); });
    var out = Object.keys(g).map(function (k) { var u = g[k], st = inGroupStats(u.rows); return { id: u.id, name: u.name, n: st.n, hidden: !!st.hidden, mean: st.mean, median: st.median, reason: st.hidden ? 'קבוצה קטנה מ-' + IN_MIN_N : '' }; });
    var hid = out.filter(function (u) { return u.hidden; });
    if (hid.length === 1 && out.length > 1) { var vis = out.filter(function (u) { return !u.hidden; }).sort(function (a, b) { return a.n - b.n; })[0]; if (vis) { vis.hidden = true; vis.reason = 'הסתרה משלימה (מונעת חישוב ערך מוסתר)'; vis.mean = vis.median = undefined; } }
    out.forEach(function (u) { if (!u.hidden && prevByKey && prevByKey[u.id] && inNum(prevByKey[u.id].mean)) u.delta = u.mean - prevByKey[u.id].mean; });
    return out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'he'); });
  }
  function inBuildModel(allRows, soldiers, typeId, date, ctx) {
    ctx = ctx || {}; var ev = inEventRows(allRows, typeId, date), rows = ev.rows, scored = rows.filter(function (r) { return inNum(r.final_score); }), st = inGroupStats(rows);
    var active = (soldiers || []).filter(function (s) { return s.active !== false && s.record_status !== 'cancelled'; }), typeName = (rows[0] && (rows[0].type_name || rows[0].navigation_type_name)) || ctx.typeName || '';
    var m = { v: 1, version: MD['nav.final'].version, typeId: typeId, typeName: typeName, date: date, course: ctx.course || '', generatedAt: ctx.now || new Date().toISOString(), source: 'nav.list · soldiers.list',
      coverage: { eligible: active.length, recorded: rows.length, noScore: rows.length - scored.length, dup: ev.dup, cancelled: ev.cancelled, pct: active.length ? Math.round(100 * rows.length / active.length) : null, absentExempt: 'לא נתמך במודל הנתונים' } };
    m.score = st.hidden ? { n: st.n, hidden: true, reason: 'פחות מ-' + IN_MIN_N + ' תוצאות — אין מספיק נתונים להצגת ממוצע, חציון או התפלגות' } : { n: st.n, mean: st.mean, median: st.median, min: st.min, max: st.max, bins: IN_BINS.map(function (b) { return { label: b[2], lo: b[0], hi: b[1], n: scored.filter(function (r) { return r.final_score >= b[0] && r.final_score <= b[1]; }).length }; }) };
    function comp(vals) { return vals.length >= IN_MIN_N ? { n: vals.length, mean: inMean(vals) } : { n: vals.length, hidden: true }; }
    m.components = st.hidden ? null : { plan: comp(rows.map(function (r) { return r.plan_score; }).filter(inNum)), debrief: comp(rows.map(function (r) { return r.debrief_score; }).filter(inNum)), points: comp(rows.filter(function (r) { return inNum(r.points_completed) && inNum(r.points_total) && r.points_total > 0; }).map(function (r) { return 100 * r.points_completed / r.points_total; })) };
    /* history of the SAME navigation type only (never pooled across types) */
    var dates = {}; allRows.forEach(function (r) { if (r.navigation_type_id === typeId && r.record_status !== 'cancelled') dates[String(r.test_date).slice(0, 10)] = 1; });
    var trend = Object.keys(dates).sort().map(function (d) { var e = inEventRows(allRows, typeId, d), s = inGroupStats(e.rows); return { date: d, n: s.n, mean: s.hidden ? null : s.mean, hidden: !!s.hidden }; }); m.trend = trend;
    var prior = null; for (var i = trend.length - 1; i >= 0; i--) if (trend[i].date < date && !trend[i].hidden) { prior = trend[i]; break; }
    if (prior && !st.hidden) {
      var pe = inEventRows(allRows, typeId, prior.date), pm = {}; pe.rows.forEach(function (r) { if (inNum(r.final_score)) pm[r.soldier_id] = r.final_score; });
      var both = scored.filter(function (r) { return pm[r.soldier_id] !== undefined; }), pdist = {}, cdist = {}; pe.rows.forEach(function (r) { if (inNum(r.distance_km)) pdist[r.distance_km] = 1; }); rows.forEach(function (r) { if (inNum(r.distance_km)) cdist[r.distance_km] = 1; });
      m.prior = { date: prior.date, n: prior.n, mean: prior.mean, delta: st.mean - prior.mean, matchedN: both.length, matchedDelta: both.length >= IN_MIN_N ? inMean(both.map(function (r) { return r.final_score - pm[r.soldier_id]; })) : null, sameDistance: Object.keys(pdist).sort().join() === Object.keys(cdist).sort().join() };
      var pByDep = {}, pByTeam = {}; inUnits(pe.rows, 'department_id', 'department_name').forEach(function (u) { if (!u.hidden) pByDep[u.id] = u; }); inUnits(pe.rows, 'team_id', 'team_name').forEach(function (u) { if (!u.hidden) pByTeam[u.id] = u; });
      m.departments = inUnits(rows, 'department_id', 'department_name', pByDep); m.teams = inUnits(rows, 'team_id', 'team_name', pByTeam);
    } else { m.prior = null; m.departments = st.hidden ? [] : inUnits(rows, 'department_id', 'department_name'); m.teams = st.hidden ? [] : inUnits(rows, 'team_id', 'team_name'); }
    /* what needs attention — each item is clickable (target = the filtered view that fixes it) */
    m.attention = [];
    var missing = active.length - rows.length; if (missing > 0) m.attention.push({ id: 'missing', text: missing + ' חניכים פעילים ללא תוצאה באירוע זה', go: 'd/nav' });
    if (m.coverage.noScore) m.attention.push({ id: 'noscore', text: m.coverage.noScore + ' רשומות ללא ציון סופי', go: 'd/nav' });
    if (ev.dup) m.attention.push({ id: 'dup', text: ev.dup + ' רשומות כפולות לאותו חניך באירוע (נספרה האחרונה; אין מניעת כפילויות אטומית בשרת)', go: 'd/nav' });
    m.findings = inFindings(m); m.rows = rows; return m;
  }
  function inFindings(m) {
    var f = [], c = m.coverage; f.push('נרשמה תוצאה ל-' + c.recorded + ' מתוך ' + c.eligible + ' חניכים פעילים' + (c.pct !== null ? ' (' + c.pct + '%)' : '') + '.');
    if (m.score.hidden) f.push(m.score.reason + '.'); else f.push('הציון הסופי הממוצע ' + inFmt(m.score.mean) + ' (חציון ' + inFmt(m.score.median) + ', טווח ' + inFmt(m.score.min) + '–' + inFmt(m.score.max) + ', N=' + m.score.n + ').');
    if (m.prior) f.push('לעומת הניווט הקודם מאותו סוג (' + m.prior.date + ', N=' + m.prior.n + ') הממוצע ' + (m.prior.delta === 0 ? 'ללא שינוי' : 'השתנה ב-' + inSign(m.prior.delta) + ' נקודות') + (m.prior.matchedDelta !== null ? '; בקבוצה זהה של ' + m.prior.matchedN + ' חניכים השינוי ' + inSign(m.prior.matchedDelta) + '.' : '; אין מספיק חניכים משותפים (N<' + IN_MIN_N + ') להשוואה על אותה קבוצה.') + (m.prior.sameDistance ? '' : ' שימו לב: מרחק הניווט שונה בין האירועים.'));
    else if (!m.score.hidden) f.push('אין ניווט קודם מאותו סוג עם N≥' + IN_MIN_N + ' — לא מוצגת השוואה.');
    var vis = (m.departments || []).filter(function (u) { return !u.hidden; }); if (vis.length > 1) { var hi = vis.slice().sort(function (a, b) { return b.mean - a.mean; })[0], lo = vis.slice().sort(function (a, b) { return a.mean - b.mean; })[0]; f.push('בין היחידות המוצגות: ממוצע גבוה ביותר ' + hi.name + ' (' + inFmt(hi.mean) + ', N=' + hi.n + '), נמוך ביותר ' + lo.name + ' (' + inFmt(lo.mean) + ', N=' + lo.n + ').'); }
    return f;
  }
  /* ---- the SAME model → PDF / XLSX ---- */
  function inStamp(iso) { return String(iso).replace(/[-:T]/g, '').slice(0, 14); }
  function inDate(d) { return String(d).slice(0, 10).split('-').reverse().join('.'); }
  function inMeta(m) { return ['נוצר: ' + String(m.generatedAt).slice(0, 16).replace('T', ' ') + ' (UTC) · גרסת שיטה ' + m.version + ' · מקור: ' + m.source, 'היקף: ' + (m.course || 'קורס') + ' · אירוע: ' + m.typeName + ' ' + inDate(m.date) + ' · קבוצות קטנות מ-' + IN_MIN_N + ' מוסתרות']; }
  function inNavPdf(m, logos) {
    var d = RK.Pdf({ title: 'דוח ניווט — ' + m.typeName + ' ' + inDate(m.date), stamp: inStamp(m.generatedAt), logos: logos || [] }), c = m.coverage, T = RK.colors.TEAL, R = RK.colors.RED;
    d.header('דוח ניווט — תמונת מצב לאירוע', m.typeName + ' · ' + inDate(m.date) + (m.course ? ' · ' + m.course : ''), inMeta(m));
    d.kpis([{ label: 'כיסוי', value: c.recorded + '/' + c.eligible, note: (c.pct !== null ? c.pct + '% מהחניכים הפעילים' : '') }, { label: 'ציון סופי ממוצע', value: m.score.hidden ? 'אין מספיק נתונים' : inFmt(m.score.mean), note: m.score.hidden ? 'N<' + IN_MIN_N : 'חציון ' + inFmt(m.score.median) + ' · N=' + m.score.n },
      { label: 'שינוי מהניווט הקודם', value: m.prior ? inSign(m.prior.delta) : '—', note: m.prior ? 'לעומת ' + inDate(m.prior.date) + ' (N=' + m.prior.n + ')' : 'אין השוואה זמינה', accent: m.prior && m.prior.delta < 0 ? R : T }, { label: 'דורש טיפול', value: String(m.attention.length), note: m.attention.length ? 'ראו מטה' : 'אין פריטים', accent: m.attention.length ? R : T }]);
    d.h2('ממצאים עיקריים'); d.bullets(m.findings);
    d.h2('מטריצת יחידות'); var rowsU = (m.departments || []).concat(m.teams || []).map(function (u, i) { return [(i < (m.departments || []).length ? 'מחלקה · ' : 'צוות · ') + u.name, String(u.n), u.hidden ? 'מוסתר' : inFmt(u.mean), u.hidden ? '—' : inFmt(u.median), u.delta !== undefined ? inSign(u.delta) : '—', u.hidden ? u.reason : '']; });
    if (rowsU.length) d.table(['יחידה', 'N', 'ממוצע', 'חציון', 'שינוי', 'הערה'], rowsU); else d.p('אין נתוני יחידות להצגה (אין מספיק נתונים).');
    d.h2('התפלגות ציון סופי');
    if (m.score.hidden) d.p(m.score.reason + '.'); else { d.histogram({ title: 'מספר חניכים בכל טווח ציון', note: 'N=' + m.score.n + ' · ציר מספרי משמאל לימין', bins: m.score.bins }); d.table(['טווח', 'חניכים'], m.score.bins.map(function (b) { return [b.label, String(b.n)]; })); }
    if (m.components) { d.h2('רכיבי הציון (ממוצע)'); var cp = m.components; d.hbars({ title: 'תכנון · תחקיר · נקודות', note: 'כל רכיב בסולם שלו; בלי משקלים מומצאים', max: 5, rows: [{ label: 'תכנון (0–5)', value: cp.plan.hidden ? null : cp.plan.mean, text: cp.plan.hidden ? 'N<' + IN_MIN_N : inFmt(cp.plan.mean) }, { label: 'תחקיר (0–5)', value: cp.debrief.hidden ? null : cp.debrief.mean, text: cp.debrief.hidden ? 'N<' + IN_MIN_N : inFmt(cp.debrief.mean) }] });
      d.hbars({ title: 'נקודות שנדקרו (% מסך הנקודות)', max: 100, rows: [{ label: 'נקודות', value: cp.points.hidden ? null : cp.points.mean, text: cp.points.hidden ? 'N<' + IN_MIN_N : inFmt(cp.points.mean) + '%' }] }); }
    d.h2('שינוי לעומת הניווט הקודם');
    var dv = (m.departments || []).concat(m.teams || []).filter(function (u) { return u.delta !== undefined || u.hidden; }); if (m.prior && dv.length) d.diverging({ title: 'שינוי בממוצע לפי יחידה (נקודות)', note: 'אדום = ירידה, טורקיז = שיפור · רק יחידות עם N≥' + IN_MIN_N + ' בשני האירועים', rows: dv.map(function (u) { return { label: u.name, value: u.delta !== undefined ? u.delta : null, text: u.delta !== undefined ? inSign(u.delta) : 'מוסתר' }; }) }); else d.p('אין השוואה זמינה (נדרש ניווט קודם מאותו סוג עם N≥' + IN_MIN_N + ').');
    var tr = m.trend.filter(function (t) { return !t.hidden; }); d.h2('מגמה — אותו סוג ניווט');
    if (tr.length >= 2) { var seq = tr.slice(-6), vals = seq.map(function (t) { return t.mean; }), lo = Math.max(0, Math.floor(Math.min.apply(null, vals) / 10) * 10 - 10), hi = Math.min(100, Math.ceil(Math.max.apply(null, vals) / 10) * 10 + 10); d.lines({ title: 'ממוצע ציון סופי לפי תאריך', note: 'מהישן (ימין) לחדש (שמאל) · רק אירועים עם N≥' + IN_MIN_N, labels: seq.map(function (t) { return inDate(t.date).slice(0, 5); }), series: [{ values: vals }], yMin: lo, yMax: hi }); d.table(['תאריך', 'N', 'ממוצע'], tr.slice(-6).reverse().map(function (t) { return [inDate(t.date), String(t.n), inFmt(t.mean)]; })); } else d.p('אין מספיק אירועים בני-השוואה להצגת מגמה (נדרשים לפחות שניים עם N≥' + IN_MIN_N + ').');
    d.h2('איכות הנתונים וחוסרים'); d.table(['פריט', 'ערך'], [['חניכים פעילים בהיקף', String(c.eligible)], ['חניכים עם רשומה פעילה', String(c.recorded)], ['חניכים ללא תוצאה', String(Math.max(0, c.eligible - c.recorded))], ['רשומות ללא ציון סופי', String(c.noScore)], ['רשומות כפולות לאותו חניך', String(c.dup)], ['רשומות מבוטלות (לא נספרו)', String(c.cancelled)], ['היעדרות / פטור', c.absentExempt]]);
    if (m.attention.length) { d.h2('מה דורש טיפול'); d.bullets(m.attention.map(function (a) { return a.text; })); }
    d.h2('מילון מדדים ושיטה'); d.table(['מדד', 'יחידה', 'מקור', 'שיטת חישוב ומכנה', 'כיוון'], ['nav.coverage', 'nav.final', 'nav.plan', 'nav.debrief', 'nav.points'].map(function (k) { var x = MD[k]; return [x.label, x.unit, x.source, x.numerator + ' · מכנה: ' + x.denominator + ' · ' + x.nulls, x.direction]; }));
    d.p('כל המספרים בדוח זה נגזרים מאותו מודל נתונים כמו המסך באפליקציה. אין בדוח פרטי חניכים. אין ספי עמידה: לא הוגדרו על ידי בעל המוצר. מידע סינתטי בלבד בסביבת בדיקה.', { size: 8.5 });
    return d.build();
  }
  function inNavXlsx(m) {
    var c = m.coverage, sh = [];
    sh.push({ name: 'סיכום', header: ['מדד', 'ערך', 'הערה'], rows: [['סוג ניווט', m.typeName, ''], ['תאריך', m.date, ''], ['קורס', m.course, ''], ['חניכים פעילים בהיקף', c.eligible, ''], ['חניכים עם רשומה', c.recorded, ''], ['כיסוי %', c.pct === null ? '' : c.pct, ''], ['ציון סופי ממוצע', m.score.hidden ? 'אין מספיק נתונים' : inR1(m.score.mean), 'N=' + m.score.n], ['חציון', m.score.hidden ? '' : inR1(m.score.median), ''], ['שינוי מהניווט הקודם', m.prior ? inR1(m.prior.delta) : '', m.prior ? 'לעומת ' + m.prior.date + ' (N=' + m.prior.n + ')' : 'אין השוואה'], ['נוצר (UTC)', m.generatedAt, 'מקור: ' + m.source + ' · גרסה ' + m.version]] });
    sh.push({ name: 'התפלגות', header: ['טווח ציון', 'חניכים'], rows: m.score.hidden ? [['אין מספיק נתונים', '']] : m.score.bins.map(function (b) { return [b.label, b.n]; }) });
    sh.push({ name: 'יחידות', header: ['רמה', 'יחידה', 'N', 'ממוצע', 'חציון', 'שינוי', 'הערה'], rows: (m.departments || []).map(function (u) { return ['מחלקה', u.name, u.n, u.hidden ? 'מוסתר' : inR1(u.mean), u.hidden ? '' : inR1(u.median), u.delta !== undefined ? inR1(u.delta) : '', u.reason]; }).concat((m.teams || []).map(function (u) { return ['צוות', u.name, u.n, u.hidden ? 'מוסתר' : inR1(u.mean), u.hidden ? '' : inR1(u.median), u.delta !== undefined ? inR1(u.delta) : '', u.reason]; })) });
    sh.push({ name: 'מגמה', header: ['תאריך', 'N', 'ממוצע', 'הערה'], rows: m.trend.map(function (t) { return [t.date, t.n, t.hidden ? 'מוסתר' : inR1(t.mean), t.hidden ? 'N<' + IN_MIN_N : '']; }) });
    sh.push({ name: 'איכות נתונים', header: ['פריט', 'ערך'], rows: [['חניכים ללא תוצאה', Math.max(0, c.eligible - c.recorded)], ['רשומות ללא ציון סופי', c.noScore], ['רשומות כפולות', c.dup], ['רשומות מבוטלות', c.cancelled], ['היעדרות / פטור', c.absentExempt]] });
    sh.push({ name: 'מילון מדדים', header: ['מזהה', 'מדד', 'יחידה', 'מקור', 'מונה', 'מכנה', 'כיוון', 'ערכים חסרים', 'השוואה', 'גרסה'], rows: Object.keys(MD).map(function (k) { var x = MD[k]; return [k, x.label, x.unit, x.source, x.numerator, x.denominator, x.direction, x.nulls, x.compare, x.version]; }) });
    return RK.xlsx({ sheets: sh });
  }
  /* a download is announced ONLY after the bytes were checked */
  function inCheck(bytes, kind) { if (!bytes || bytes.length < 1000) return false; var h = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]); if (kind === 'pdf') return h === '%PDF-' && String.fromCharCode.apply(null, bytes.slice(bytes.length - 6)).indexOf('%%EOF') !== -1; return h.slice(0, 2) === 'PK'; }
  function inSave(bytes, name, mime) { var b = new Blob([bytes], { type: mime }), u = URL.createObjectURL(b), a = h('a', { href: u, download: name, rel: 'noopener', style: 'display:none' }); document.body.append(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(u); }, 4000); window.__lastDownload = { name: name, size: bytes.length, type: mime }; }
  function inFileName(m, ext) { return 'maslul-navigation_' + m.date + '_' + String(m.typeId).replace(/[^A-Za-z0-9-]/g, '') + '_v1.' + ext; }
  function inDownload(m, kind) {
    var pdf = kind === 'pdf', bytes; try { bytes = pdf ? inNavPdf(m) : inNavXlsx(m); } catch (e) { toast('יצירת הקובץ נכשלה: ' + e.message, 'err'); return false; }
    if (!inCheck(bytes, pdf ? 'pdf' : 'xlsx')) { toast('הקובץ שנוצר לא עבר בדיקת תקינות — לא הורד.', 'err'); return false; }
    inSave(bytes, inFileName(m, pdf ? 'pdf' : 'xlsx'), pdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast(pdf ? 'דוח ה-PDF הורד' : 'קובץ ה-Excel הורד'); return true;
  }
  /* fresh read → model (one read for the event AND its same-type history) */
  function inLoad(typeId, date) {
    return ensureSoldiers().then(function () { return api('nav.list', { courseId: S.course.id, typeId: typeId }, 'fresh'); }).then(function (r) {
      if (!r.ok) return r; var rows = Array.isArray(r.data) ? r.data : (r.data && (r.data.rows || r.data.items)) || [];
      return { ok: true, model: inBuildModel(rows, cache.soldiers || [], typeId, date, { course: S.course && S.course.name }), allRows: rows };
    });
  }
  /* ---- charts: SVG, keyboard-focusable, each with a data-table alternative ---- */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, kids) { var e = document.createElementNS(SVGNS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); (kids || []).forEach(function (x) { e.append(x); }); return e; }
  function stext(x, y, t, o) { var e = sv('text', Object.assign({ x: x, y: y, 'text-anchor': 'middle', class: 'in-t' }, o || {})); e.textContent = t; return e; }
  function chartFigure(id, title, svg, summary, tableHead, tableRows) {
    var tbl = h('table', { class: 'in-table', id: id + 'Tbl', hidden: 'true' }, [h('thead', {}, [h('tr', {}, tableHead.map(function (x) { return h('th', { scope: 'col', text: x }); }))]), h('tbody', {}, tableRows.map(function (r) { return h('tr', {}, r.map(function (c) { return h('td', { text: String(c) }); })); }))]);
    var tg = h('button', { class: 'in-link', type: 'button', id: id + 'Tg', 'aria-expanded': 'false', 'aria-controls': id + 'Tbl', text: 'תצוגת טבלה', onclick: function () { var on = tbl.hidden; tbl.hidden = !on; svg.parentNode.hidden = on; tg.setAttribute('aria-expanded', on ? 'true' : 'false'); tg.textContent = on ? 'תצוגת גרף' : 'תצוגת טבלה'; } });
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', summary);
    return h('figure', { class: 'in-fig', id: id }, [h('figcaption', { text: title }), h('div', { class: 'in-svgwrap' }, [svg]), tbl, tg]);
  }
  function histChart(m, onPick, picked) {
    var bins = m.score.bins, n = bins.length, W = 320, H = 150, bw = 44, gap = 8, x0 = (W - (n * bw + (n - 1) * gap)) / 2, max = Math.max.apply(null, bins.map(function (b) { return b.n; }).concat([1])), g = [];
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'in-svg' }); svg.append(sv('line', { x1: 10, x2: W - 10, y1: 120, y2: 120, class: 'in-axis' }));
    bins.forEach(function (b, i) { var x = x0 + i * (bw + gap), hh = Math.max(b.n ? 3 : 0, 90 * b.n / max), on = picked === i;
      var bar = sv('rect', { x: x, y: 120 - hh, width: bw, height: hh, rx: 4, class: 'in-bar' + (on ? ' on' : ''), tabindex: 0, role: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': 'טווח ' + b.label + ': ' + b.n + ' חניכים. הקשה מסננת את רשימת החניכים', 'data-bin': i });
      bar.addEventListener('click', function () { onPick(on ? -1 : i); }); bar.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(on ? -1 : i); } });
      svg.append(bar, stext(x + bw / 2, 120 - hh - 5, String(b.n), { class: 'in-t in-tv' }), stext(x + bw / 2, 137, b.label)); });
    return svg;
  }
  function lineChart(m) {
    var pts = m.trend.filter(function (t) { return !t.hidden; }).slice(-6), W = 320, H = 150, svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'in-svg' }); if (pts.length < 2) return null;
    var vals = pts.map(function (t) { return t.mean; }), lo = Math.max(0, Math.floor(Math.min.apply(null, vals) / 10) * 10 - 10), hi = Math.min(100, Math.ceil(Math.max.apply(null, vals) / 10) * 10 + 10), x = function (i) { return W - 36 - i * ((W - 72) / (pts.length - 1)); }, y = function (v) { return 118 - 88 * (v - lo) / (hi - lo || 1); };
    svg.append(sv('line', { x1: 24, x2: W - 10, y1: 118, y2: 118, class: 'in-axis' }), stext(14, 122, String(lo), { class: 'in-t in-ty' }), stext(14, 34, String(hi), { class: 'in-t in-ty' }));
    var rev = pts.slice(); svg.append(sv('polyline', { points: rev.map(function (t, i) { return x(i) + ',' + y(t.mean); }).join(' '), class: 'in-line', fill: 'none' }));
    rev.forEach(function (t, i) { var cur = t.date === m.date, pt = sv('circle', { cx: x(i), cy: y(t.mean), r: cur ? 6 : 5, class: 'in-pt' + (cur ? ' on' : ''), tabindex: 0, role: 'link', 'aria-label': 'ניווט ' + inDate(t.date) + ': ממוצע ' + inFmt(t.mean) + ', N=' + t.n + '. מעבר לאירוע', 'data-date': t.date });
      var jump = function () { go('insight/nav/' + m.typeId + '/' + t.date); }; pt.addEventListener('click', jump); pt.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); } });
      svg.append(pt, stext(x(i), y(t.mean) - 9, inFmt(t.mean), { class: 'in-t in-tv' }), stext(x(i), 135, inDate(t.date).slice(0, 5))); }); return svg;
  }
  function kpi(label, value, note, id, tone) { return h('div', { class: 'in-kpi' + (tone ? ' ' + tone : ''), id: id }, [h('small', { text: label }), h('b', { text: value }), h('span', { text: note || '' })]); }
  /* ---- screens ---- */
  function NavInsight(typeId, date, savedId) {
    var body = h('div', { 'aria-live': 'polite' }, [skeleton(3)]), picked = -1;
    mount('more', [h('button', { class: 'back', type: 'button', id: 'inBack', onclick: function () { go('insight'); }, text: '→ חזרה לתובנות ודוחות' }), h('h1', { class: 'page', text: 'ניתוח הניווט' }), body], 'ניתוח הניווט');
    function draw() {
      body.replaceChildren(skeleton(3)); inLoad(typeId, date).then(function (r) {
        body.replaceChildren(); if (!r.ok) { body.append(errBox(r, draw), h('p', { class: 'muted', text: 'לא מוצגים נתונים או תובנות כשהקריאה מהשרת נכשלה.' })); return; }
        var m = r.model, c = m.coverage; window.__insight.model = m;
        body.append(h('p', { class: 'in-sub', id: 'inSub', text: m.typeName + ' · ' + inDate(m.date) + ' · ' + (m.course || '') }));
        if (savedId) { var found = m.rows.some(function (x) { return x.id === savedId; }); body.append(h('div', { class: 'msg ' + (found ? 'ok' : 'err'), id: 'inVerified', role: found ? 'status' : 'alert', text: found ? 'נשמר ואומת בשרת: הרשומה נקראה מחדש ונמצאה (' + c.recorded + ' רשומות באירוע).' : 'הרשומה לא נמצאה בקריאה החוזרת מהשרת — השמירה לא אומתה, ולכן לא מוצגת הצלחה. בדקו ברשימת הניווטים ונסו שוב.' })); }
        body.append(h('p', { class: 'muted', id: 'inStamp', text: 'נקרא מהשרת ' + new Date(m.generatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + ' · מקור: ' + m.source + ' · מכנה: חניכים פעילים בהיקף (' + c.eligible + ')' }));
        if (!c.recorded) { body.append(emptyBox('אין רשומות פעילות לאירוע זה — אין מה לנתח.')); return; }
        body.append(h('div', { class: 'in-kpis' }, [kpi('כיסוי', c.recorded + '/' + c.eligible, c.pct !== null ? c.pct + '%' : '', 'inK1'), kpi('ממוצע ציון סופי', m.score.hidden ? 'אין מספיק נתונים' : inFmt(m.score.mean), m.score.hidden ? 'N<' + IN_MIN_N : 'חציון ' + inFmt(m.score.median) + ' · N=' + m.score.n, 'inK2'), kpi('שינוי מהקודם', m.prior ? inSign(m.prior.delta) : '—', m.prior ? 'לעומת ' + inDate(m.prior.date).slice(0, 5) : 'אין השוואה', 'inK3', m.prior && m.prior.delta < 0 ? 'neg' : ''), kpi('דורש טיפול', String(m.attention.length), m.attention.length ? 'ראו למטה' : 'אין פריטים', 'inK4', m.attention.length ? 'neg' : '')]));
        var act = h('div', { class: 'btns in-act' }); if (isAdmin()) { act.append(h('button', { class: 'primary', type: 'button', id: 'inPdf', text: 'יצירת דוח PDF', onclick: function (ev) { var b = ev.currentTarget; busy(b, true); setTimeout(function () { inDownload(m, 'pdf'); busy(b, false); }, 30); } }), h('button', { class: 'secondary', type: 'button', id: 'inXlsx', text: 'ייצוא נתונים (Excel)', onclick: function (ev) { var b = ev.currentTarget; busy(b, true); setTimeout(function () { inDownload(m, 'xlsx'); busy(b, false); }, 30); } })); } else act.append(h('p', { class: 'muted', id: 'inNoExport', text: 'הורדת דוח PDF/Excel זמינה למנהל בלבד (מדיניות קיימת). ההרשאה לא הורחבה.' }));
        act.append(h('button', { class: 'secondary', type: 'button', id: 'inRefresh', text: 'רענון', onclick: draw })); body.append(act);
        body.append(sectionHead('ממצאים', null), h('ul', { class: 'in-find', id: 'inFind' }, m.findings.map(function (t) { return h('li', { text: t }); })));
        if (m.attention.length) { body.append(sectionHead('מה דורש טיפול', String(m.attention.length))); m.attention.forEach(function (a) { body.append(card(a.text, 'פתיחת המסך הרלוונטי', null, function () { go(a.go); })); }); }
        if (m.score.hidden) body.append(h('div', { class: 'msg', id: 'inInsufficient', role: 'status', text: m.score.reason + '.' }));
        else {
          var histBox = h('div', { id: 'inHistBox' }), listBox = h('div', { id: 'inList' });
          var drawList = function () { var b = picked >= 0 ? m.score.bins[picked] : null, rows = m.rows.filter(function (x) { return !b || (inNum(x.final_score) && x.final_score >= b.lo && x.final_score <= b.hi); }).sort(function (x, y) { return (y.final_score || 0) - (x.final_score || 0); });
            listBox.replaceChildren(h('p', { class: 'muted', id: 'inListInfo', text: (b ? 'מסונן: ' + b.label + ' · ' : '') + rows.length + ' חניכים · תצוגה מבצעית (מידע אישי — לא נכלל בקבצים)' })); rows.slice(0, 80).forEach(function (x) { listBox.append(card(x.soldier_name || x.soldier_id, 'ציון סופי: ' + inFmt(x.final_score) + ' · תכנון ' + inFmt(x.plan_score) + ' · תחקיר ' + inFmt(x.debrief_score), null, function () { go('soldier/' + x.soldier_id); })); }); };
          var drawHist = function () { histBox.replaceChildren(chartFigure('inHist', 'התפלגות ציון סופי · N=' + m.score.n, histChart(m, function (i) { picked = i; drawHist(); drawList(); }, picked), 'התפלגות ציון סופי: ' + m.score.bins.map(function (b) { return b.label + ' — ' + b.n; }).join('; '), ['טווח', 'חניכים'], m.score.bins.map(function (b) { return [b.label, b.n]; }))); };
          body.append(sectionHead('התפלגות', null), histBox); drawHist();
          if (m.components) { var cp = m.components, cr = function (k, l, u) { var x = cp[k]; return [l, x.hidden ? 'N<' + IN_MIN_N : inFmt(x.mean) + u, x.n]; }; body.append(sectionHead('רכיבי הציון', null), h('table', { class: 'in-table', id: 'inComp' }, [h('thead', {}, [h('tr', {}, ['רכיב', 'ממוצע', 'N'].map(function (x) { return h('th', { scope: 'col', text: x }); }))]), h('tbody', {}, [cr('plan', 'תכנון (0–5)', ''), cr('debrief', 'תחקיר (0–5)', ''), cr('points', 'נקודות שנדקרו', '%')].map(function (r) { return h('tr', {}, r.map(function (v) { return h('td', { text: String(v) }); })); }))])); }
          var us = (m.departments || []).concat(m.teams || []); if (us.length) body.append(sectionHead('יחידות', 'N≥' + IN_MIN_N), h('table', { class: 'in-table', id: 'inUnits' }, [h('thead', {}, [h('tr', {}, ['יחידה', 'N', 'ממוצע', 'שינוי'].map(function (x) { return h('th', { scope: 'col', text: x }); }))]), h('tbody', {}, us.map(function (u) { return h('tr', {}, [h('td', { text: u.name }), h('td', { text: String(u.n) }), h('td', { text: u.hidden ? 'מוסתר' : inFmt(u.mean) }), h('td', { text: u.hidden ? u.reason : u.delta !== undefined ? inSign(u.delta) : '—' })]); }))]));
          var lc = lineChart(m); body.append(sectionHead('מגמה — אותו סוג ניווט', null)); if (lc) body.append(chartFigure('inTrend', 'ממוצע ציון סופי לפי תאריך (הישן מימין, החדש משמאל)', lc, 'מגמת ממוצע: ' + m.trend.filter(function (t) { return !t.hidden; }).slice(-6).map(function (t) { return inDate(t.date) + ' ' + inFmt(t.mean); }).join('; '), ['תאריך', 'N', 'ממוצע'], m.trend.map(function (t) { return [inDate(t.date), t.n, t.hidden ? 'מוסתר' : inFmt(t.mean)]; }))); else body.append(h('p', { class: 'muted', id: 'inNoTrend', text: 'אין מספיק אירועים בני-השוואה (נדרשים לפחות שניים מאותו סוג עם N≥' + IN_MIN_N + ').' }));
          body.append(h('details', { class: 'in-det' }, [h('summary', { text: 'רשימת חניכים (תצוגה מבצעית)' }), listBox])); drawList();
        }
        body.append(h('details', { class: 'in-det', id: 'inMethod' }, [h('summary', { text: 'הגדרות ושיטה' })].concat(['nav.coverage', 'nav.final', 'nav.plan', 'nav.debrief', 'nav.points'].map(function (k) { var x = MD[k]; return h('p', { class: 'muted', text: x.label + ' (' + x.unit + '): ' + x.numerator + '. מכנה: ' + x.denominator + '. ' + x.nulls + '. מקור: ' + x.source + '. גרסה ' + x.version + '.' }); }))));
      });
    }
    draw();
  }
  function InsightHub() {
    var body = h('div', { 'aria-live': 'polite' }, [skeleton(3)]);
    mount('more', [h('button', { class: 'back', type: 'button', onclick: function () { go('more'); }, text: '→ חזרה ל"עוד"' }), sectionHead('תובנות ודוחות', null), body], 'תובנות ודוחות');
    function draw() {
      body.replaceChildren(skeleton(3)); api('nav.list', { courseId: S.course.id }, 'fresh').then(function (r) {
        body.replaceChildren(); if (!r.ok) { body.append(errBox(r, draw)); return; } var rows = Array.isArray(r.data) ? r.data : (r.data && (r.data.rows || r.data.items)) || [], ev = {};
        rows.forEach(function (x) { if (x.record_status === 'cancelled') return; var k = x.navigation_type_id + '|' + String(x.test_date).slice(0, 10); (ev[k] = ev[k] || { typeId: x.navigation_type_id, date: String(x.test_date).slice(0, 10), name: x.type_name || x.navigation_type_name || 'ניווט', n: 0 }).n++; });
        var list = Object.keys(ev).map(function (k) { return ev[k]; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
        body.append(sectionHead('דוחות לפי תבנית', null));
        body.append(card('דוח ניווט', list.length ? 'ניתוח אירוע, מגמה, PDF ו-Excel · ' + list.length + ' אירועים' : 'אין עדיין אירועי ניווט', h('span', { class: 'arrow', text: '←' }), list.length ? function () { go('insight/nav/' + list[0].typeId + '/' + list[0].date); } : null));
        [['תמונת מצב קורס', 'דשבורד קורס: מה השתנה, מה דורש טיפול, איכות נתונים'], ['דוח כש״ג', 'מגמות כושר ודוח'], ['מבחנים', 'ציונים ומגמות'], ['קליעה', 'תוצאות ומגמות'], ['נוכחות / מסעות', 'כיסוי והשתתפות']].forEach(function (t) { var b = card(t[0], t[1] + ' · חסום: טרם נבנה (שלב הבא)', h('span', { class: 'badge', text: 'חסום' }), null); b.classList.add('off'); b.setAttribute('aria-disabled', 'true'); body.append(b); });
        body.append(sectionHead('אירועי ניווט', String(list.length))); if (!list.length) body.append(emptyBox('אין אירועי ניווט להצגה.'));
        list.slice(0, 40).forEach(function (e) { body.append(card(e.name + ' · ' + inDate(e.date), e.n + ' רשומות', null, function () { go('insight/nav/' + e.typeId + '/' + e.date); })); });
      });
    }
    draw();
  }
  /* shown after a VERIFIED navigation save (bulk): direct, working actions for this event */
  function NavAfterSave(box, typeId, date) {
    var row = h('div', { class: 'btns in-after', id: 'beInsightRow' }, [h('button', { class: 'primary', type: 'button', id: 'beInsight', text: 'ניתוח הניווט', onclick: function () { go('insight/nav/' + typeId + '/' + date); } })]);
    if (isAdmin()) row.append(h('button', { class: 'secondary', type: 'button', id: 'beInsightPdf', text: 'יצירת דוח PDF', onclick: function (ev) { var b = ev.currentTarget; busy(b, true); inLoad(typeId, date).then(function (r) { busy(b, false); if (!r.ok) { toast(msgOf(r), 'err'); return; } inDownload(r.model, 'pdf'); }); } }), h('button', { class: 'secondary', type: 'button', id: 'beInsightXlsx', text: 'ייצוא נתונים (Excel)', onclick: function (ev) { var b = ev.currentTarget; busy(b, true); inLoad(typeId, date).then(function (r) { busy(b, false); if (!r.ok) { toast(msgOf(r), 'err'); return; } inDownload(r.model, 'xlsx'); }); } }));
    box.append(row);
  }

  /* ONE soldier ("תמונת התקדמות"): verified, descriptive time series per discipline from the account's own authorized read. No score, ranking, prediction or personal judgement. Only navigation is built in this slice; the others are visibly blocked. */
  function soldierProgress(s, box) {
    var title = h('h3', { text: 'תמונת התקדמות', style: 'margin:16px 0 4px;font-size:15px' }); box.replaceChildren(title, skeleton(1));
    api('nav.list', { courseId: S.course.id, soldierId: s.id }, 'fresh').then(function (r) {
      box.replaceChildren(title); if (!r.ok) { box.append(h('p', { class: 'muted', id: 'progNo', text: 'אין הרשאה או שהנתונים אינם זמינים כרגע — לא מוצגת תמונת התקדמות.' })); return; }
      var rows = (Array.isArray(r.data) ? r.data : (r.data && (r.data.rows || r.data.items)) || []).filter(function (x) { return x.soldier_id === s.id && x.record_status !== 'cancelled'; }), by = {};
      rows.forEach(function (x) { (by[x.navigation_type_id] = by[x.navigation_type_id] || { name: x.type_name || x.navigation_type_name || 'ניווט', list: [] }).list.push(x); });
      var ks = Object.keys(by); if (!ks.length) box.append(h('p', { class: 'muted', id: 'progNav', text: 'ניווט: אין מדידות עדיין.' }));
      ks.forEach(function (k) {
        var g = by[k], l = g.list.slice().sort(function (a, b) { return String(a.test_date) < String(b.test_date) ? -1 : 1; }), sc = l.filter(function (x) { return inNum(x.final_score); }), last = sc[sc.length - 1], prev = sc[sc.length - 2], miss = l.length - sc.length;
        var line = last ? 'מדידה אחרונה ' + inDate(last.test_date) + ': ' + inFmt(last.final_score) + (prev ? ' · שינוי מהמדידה הקודמת מאותו סוג (' + inDate(prev.test_date) + '): ' + inSign(last.final_score - prev.final_score) : ' · אין מדידה קודמת להשוואה') : 'אין ציון סופי במדידות';
        var el = card('ניווט — ' + g.name, line + ' · ' + sc.length + ' מדידות' + (miss ? ' · ' + miss + ' ללא ציון סופי' : ''), null, function () { go('d/nav'); }); el.id = 'progNav'; box.append(el);
        var hist = sc.slice(-5).reverse().map(function (x) { return inDate(x.test_date) + ': ' + inFmt(x.final_score); }).join(' · '); if (hist) box.append(h('p', { class: 'muted', id: 'progHist', text: 'מדידות אחרונות (מהחדשה לישנה): ' + hist }));
      });
      [['כש״ג', 'כושר גופני'], ['מבחנים עיוניים', ''], ['קליעה', ''], ['נוכחות ומסעות', '']].forEach(function (t) { var b = card(t[0], 'סדרת זמן: חסום — טרם נבנה (שלב הבא)', h('span', { class: 'badge', text: 'חסום' }), null); b.classList.add('off'); b.setAttribute('aria-disabled', 'true'); box.append(b); });
      box.append(h('p', { class: 'muted', text: 'תיאור עובדתי בלבד — אין ציון אישי מחושב, דירוג או חיזוי.' }));
    });
  }
  window.__insight = { build: inBuildModel, pdf: inNavPdf, xlsx: inNavXlsx, load: inLoad, min: IN_MIN_N, model: null };
