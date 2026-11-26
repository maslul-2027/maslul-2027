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

  /* active, one-per-soldier view of one event; duplicates are counted (no atomic uniqueness in the server yet), the latest record wins.
     Records of CANCELLED soldiers are excluded from every aggregate (counted separately); records of soldiers who are inactive TODAY stay (historical truth). */
  function inEventRows(rows, typeId, date) {
    var by = {}, dup = 0, cancelled = 0, cancelledSoldiers = 0;
    rows.forEach(function (r) { if (r.navigation_type_id !== typeId || String(r.test_date).slice(0, 10) !== date) return; if (r.record_status === 'cancelled') { cancelled++; return; } if (r.soldier_cancelled) { cancelledSoldiers++; return; } var p = by[r.soldier_id]; if (p) { dup++; if (String(r.created_at || '') >= String(p.created_at || '')) by[r.soldier_id] = r; } else by[r.soldier_id] = r; });
    return { rows: Object.keys(by).map(function (k) { return by[k]; }), dup: dup, cancelled: cancelled, cancelledSoldiers: cancelledSoldiers };
  }
  function inScores(list) { return list.map(function (r) { return r.final_score; }).filter(inNum); }
  function inGroupStats(list) { var v = inScores(list); return v.length >= IN_MIN_N ? { n: v.length, mean: inMean(v), median: inMedian(v) } : { n: v.length, hidden: true }; }
  /* SMALL-CELL POLICY (one rule for screen summary, charts, tables, text, PDF and Excel — they all read ONLY the `pub` projection built below):
     1. every count of persons-with-results that is shown is ≥ 5; a smaller non-zero count is never printed ("פחות מ-5");
     2. no min/max (they are single people's scores); 3. histogram buckets are MERGED until each holds ≥ 5 (no singleton bucket can exist);
     4. sibling units: units with n<5 are hidden, and while (parent total − Σ visible n) < 5 the smallest visible sibling is hidden too (complementary suppression, so subtraction cannot recover a small cell or its mean);
     5. a hidden parent hides all its children; 6. event-level: recorded < 5 hides coverage numerators, scores, units, components and counts;
     7. the exact numbers (and the roster) live ONLY in the operational zone of the screen for authorized users — never in a file. */
  function inCell(c) { return c === 0 ? { v: 0, txt: '0' } : c >= IN_MIN_N ? { v: c, txt: String(c) } : { v: null, txt: 'פחות מ-' + IN_MIN_N }; }
  function inMergeBins(scored) {
    var out = [], cur = null, last = IN_BINS.length - 1;   /* the first/last bucket also catch values below 0 / above 100, so the buckets always sum to N */
    IN_BINS.forEach(function (b, i) { var lo = i === 0 ? -Infinity : b[0], hi = i === last ? Infinity : b[1], n = scored.filter(function (x) { return x >= lo && x <= hi; }).length; if (!cur) cur = { lo: b[0], hi: b[1], clo: lo, chi: hi, n: 0 }; cur.hi = b[1]; cur.chi = hi; cur.n += n; if (cur.n >= IN_MIN_N) { out.push(cur); cur = null; } });
    if (cur) { if (out.length) { var pv = out[out.length - 1]; pv.hi = cur.hi; pv.chi = cur.chi; pv.n += cur.n; } else if (cur.n >= IN_MIN_N) out.push(cur); }
    out.forEach(function (b) { b.label = b.lo + '–' + b.hi; }); return out;
  }
  function inSuppressUnits(units, totalN) {
    var vis = units.filter(function (u) { return !u.hidden; });
    for (;;) { var sum = vis.reduce(function (s, u) { return s + u.n; }, 0), anyHidden = units.some(function (u) { return u.hidden; }); if (!(anyHidden && vis.length && totalN - sum < IN_MIN_N)) break; var sm = vis.slice().sort(function (a, b) { return a.n - b.n; })[0]; sm.hidden = true; sm.reason = 'הסתרה משלימה (מונעת חישוב ערך מוסתר)'; vis = vis.filter(function (u) { return u !== sm; }); }
    units.forEach(function (u) { if (u.hidden) { u.n = null; u.mean = u.median = u.delta = undefined; } }); return units;
  }
  function inRawUnits(rows, key, nameKey) { var g = {}; rows.forEach(function (r) { var k = r[key]; if (!k) return; (g[k] = g[k] || { id: k, name: r[nameKey] || k, rows: [] }).rows.push(r); }); return Object.keys(g).map(function (k) { var u = g[k], st = inGroupStats(u.rows); return { id: u.id, name: u.name, n: st.n, hidden: !!st.hidden, reason: st.hidden ? 'קבוצה קטנה מ-' + IN_MIN_N : '', mean: st.mean, median: st.median, rows: u.rows, dep: u.rows[0].department_id }; }); }
  function inUnitsOf(rows, totalN) {
    var deps = inSuppressUnits(inRawUnits(rows, 'department_id', 'department_name'), totalN), teams = [];
    inRawUnits(rows, 'team_id', 'team_name').forEach(function (t) { t._dep = t.dep; teams.push(t); });
    var byDep = {}; teams.forEach(function (t) { (byDep[t._dep] = byDep[t._dep] || []).push(t); });
    Object.keys(byDep).forEach(function (d) { var parent = deps.filter(function (x) { return x.id === d; })[0], rowsN = byDep[d].reduce(function (s, t) { return s + t.rows.length; }, 0), tot = inScores(byDep[d].reduce(function (a, t) { return a.concat(t.rows); }, [])).length;
      if (parent && parent.hidden) byDep[d].forEach(function (t) { t.hidden = true; t.reason = 'יחידת האב מוסתרת'; t.n = null; t.mean = t.median = undefined; }); else inSuppressUnits(byDep[d], tot); });
    var strip = function (u) { delete u.rows; delete u.dep; delete u._dep; return u; };
    return { departments: deps.map(strip).sort(inByName), teams: teams.map(strip).sort(inByName) };
  }
  var inByName = function (a, b) { return String(a.name).localeCompare(String(b.name), 'he'); };
  function inBuildModel(allRows, soldiers, typeId, date, ctx) {
    ctx = ctx || {}; var ev = inEventRows(allRows, typeId, date), rows = ev.rows, scored = inScores(rows), st = inGroupStats(rows);
    var activeIds = {}; (soldiers || []).forEach(function (s) { if (s.active !== false && s.record_status !== 'cancelled') activeIds[s.id] = 1; }); var elig = Object.assign({}, activeIds); rows.forEach(function (r) { elig[r.soldier_id] = 1; }); var eligible = Object.keys(elig).length;
    var typeName = (rows[0] && (rows[0].type_name || rows[0].navigation_type_name)) || ctx.typeName || '', recorded = rows.length, hiddenAll = recorded < IN_MIN_N;
    var m = { v: 2, version: MD['nav.final'].version, typeId: typeId, typeName: typeName, date: date, course: ctx.course || '', generatedAt: ctx.now || new Date().toISOString(), source: 'nav.list · soldiers.list' };
    /* ---- operational zone (exact; roster; screen only) ---- */
    m.ops = { recorded: recorded, eligible: eligible, missing: eligible - recorded, noScore: recorded - scored.length, dup: ev.dup, cancelled: ev.cancelled, cancelledSoldiers: ev.cancelledSoldiers, inactiveWithRecord: rows.filter(function (r) { return !activeIds[r.soldier_id]; }).length, attention: [] };
    if (m.ops.missing > 0) m.ops.attention.push({ id: 'missing', text: m.ops.missing + ' חניכים ללא תוצאה באירוע זה', go: 'd/nav' });
    if (m.ops.noScore) m.ops.attention.push({ id: 'noscore', text: m.ops.noScore + ' רשומות ללא ציון סופי', go: 'd/nav' });
    if (m.ops.dup) m.ops.attention.push({ id: 'dup', text: m.ops.dup + ' רשומות כפולות לאותו חניך (נספרה האחרונה; אין מניעת כפילויות אטומית בשרת)', go: 'd/nav' });
    if (m.ops.cancelledSoldiers) m.ops.attention.push({ id: 'cs', text: m.ops.cancelledSoldiers + ' רשומות של חניכים שבוטלו (לא נכללו בחישובים)', go: 'd/nav' });
    /* ---- group-facing projection ---- */
    var pub = { eligible: eligible, basis: 'חניכים פעילים כיום בהיקף ההרשאה, בתוספת חניכים שיש להם רשומה באירוע (אין תיעוד היסטורי של הרכב הקורס בתאריך האירוע)', hidden: hiddenAll, recorded: hiddenAll ? null : recorded, pct: hiddenAll || !eligible ? null : Math.round(100 * recorded / eligible), absentExempt: 'לא נתמך במודל הנתונים',
      cells: { noScore: hiddenAll ? null : inCell(m.ops.noScore), dup: hiddenAll ? null : inCell(ev.dup), cancelled: hiddenAll ? null : inCell(ev.cancelled), cancelledSoldiers: hiddenAll ? null : inCell(ev.cancelledSoldiers), inactiveWithRecord: hiddenAll ? null : inCell(m.ops.inactiveWithRecord) } };
    pub.score = st.hidden ? { hidden: true, reason: 'פחות מ-' + IN_MIN_N + ' תוצאות — אין מספיק נתונים להצגת ממוצע, חציון או התפלגות' } : { n: st.n, mean: st.mean, median: st.median, bins: inMergeBins(scored) };
    function comp(vals) { return vals.length >= IN_MIN_N ? { n: vals.length, mean: inMean(vals) } : { hidden: true }; }
    pub.components = st.hidden ? null : { plan: comp(rows.map(function (r) { return r.plan_score; }).filter(inNum)), debrief: comp(rows.map(function (r) { return r.debrief_score; }).filter(inNum)), points: comp(rows.filter(function (r) { return inNum(r.points_completed) && inNum(r.points_total) && r.points_total > 0; }).map(function (r) { return 100 * r.points_completed / r.points_total; })) };
    var dates = {}; allRows.forEach(function (r) { if (r.navigation_type_id === typeId && r.record_status !== 'cancelled') dates[String(r.test_date).slice(0, 10)] = 1; });
    pub.trend = Object.keys(dates).sort().map(function (d) { var s = inGroupStats(inEventRows(allRows, typeId, d).rows); return { date: d, n: s.hidden ? null : s.n, mean: s.hidden ? null : s.mean, hidden: !!s.hidden }; });
    var prior = null; for (var i = pub.trend.length - 1; i >= 0; i--) if (pub.trend[i].date < date && !pub.trend[i].hidden) { prior = pub.trend[i]; break; }
    var cur = st.hidden ? { departments: [], teams: [] } : inUnitsOf(rows, st.n); pub.departments = cur.departments; pub.teams = cur.teams; pub.prior = null;
    if (prior && !st.hidden) {
      var pe = inEventRows(allRows, typeId, prior.date), pm = {}; pe.rows.forEach(function (r) { if (inNum(r.final_score)) pm[r.soldier_id] = r.final_score; });
      var both = rows.filter(function (r) { return inNum(r.final_score) && pm[r.soldier_id] !== undefined; }), pdist = {}, cdist = {}; pe.rows.forEach(function (r) { if (inNum(r.distance_km)) pdist[r.distance_km] = 1; }); rows.forEach(function (r) { if (inNum(r.distance_km)) cdist[r.distance_km] = 1; });
      pub.prior = { date: prior.date, n: prior.n, mean: prior.mean, delta: st.mean - prior.mean, matchedN: both.length >= IN_MIN_N ? both.length : null, matchedDelta: both.length >= IN_MIN_N ? inMean(both.map(function (r) { return r.final_score - pm[r.soldier_id]; })) : null, sameDistance: Object.keys(pdist).sort().join() === Object.keys(cdist).sort().join() };
      var pu = inUnitsOf(pe.rows, inGroupStats(pe.rows).n || 0), pmap = {}; pu.departments.concat(pu.teams).forEach(function (u) { if (!u.hidden) pmap[u.id] = u; });
      pub.departments.concat(pub.teams).forEach(function (u) { if (!u.hidden && pmap[u.id]) u.delta = u.mean - pmap[u.id].mean; });
    }
    pub.attention = []; if (!hiddenAll) { var miss = eligible - recorded; if (miss > 0) pub.attention.push({ id: 'missing', text: (miss >= IN_MIN_N ? miss : 'פחות מ-' + IN_MIN_N) + ' חניכים ללא תוצאה באירוע' }); if (m.ops.noScore) pub.attention.push({ id: 'noscore', text: inCell(m.ops.noScore).txt + ' רשומות ללא ציון סופי' }); if (ev.dup) pub.attention.push({ id: 'dup', text: inCell(ev.dup).txt + ' רשומות כפולות לאותו חניך' }); }
    pub.findings = inFindings(pub); m.pub = pub; m.rows = rows; return m;
  }
  function inFindings(p) {
    var f = [];
    if (p.hidden) { f.push('אין מספיק נתונים להצגת תמונת מצב קבוצתית (פחות מ-' + IN_MIN_N + ' תוצאות באירוע).'); return f; }
    f.push('נרשמה תוצאה ל-' + p.recorded + ' מתוך ' + p.eligible + ' חניכים (' + p.pct + '%).');
    if (p.score.hidden) f.push(p.score.reason + '.'); else f.push('הציון הסופי הממוצע ' + inFmt(p.score.mean) + ' (חציון ' + inFmt(p.score.median) + ', N=' + p.score.n + ').');
    if (p.prior) f.push('לעומת הניווט הקודם מאותו סוג (' + p.prior.date + ', N=' + p.prior.n + ') הממוצע ' + (p.prior.delta === 0 ? 'ללא שינוי' : 'השתנה ב-' + inSign(p.prior.delta) + ' נקודות') + (p.prior.matchedDelta !== null ? '; בקבוצה זהה של ' + p.prior.matchedN + ' חניכים השינוי ' + inSign(p.prior.matchedDelta) + '.' : '; אין מספיק חניכים משותפים להשוואה על אותה קבוצה.') + (p.prior.sameDistance ? '' : ' שימו לב: מרחק הניווט שונה בין האירועים.'));
    else if (!p.score.hidden) f.push('אין ניווט קודם מאותו סוג עם מספיק תוצאות — לא מוצגת השוואה.');
    var vis = p.departments.filter(function (u) { return !u.hidden; }); if (vis.length > 1) { var hi = vis.slice().sort(function (a, b) { return b.mean - a.mean; })[0], lo = vis.slice().sort(function (a, b) { return a.mean - b.mean; })[0]; f.push('בין היחידות המוצגות: ממוצע גבוה ביותר ' + hi.name + ' (' + inFmt(hi.mean) + ', N=' + hi.n + '), נמוך ביותר ' + lo.name + ' (' + inFmt(lo.mean) + ', N=' + lo.n + ').'); }
    return f;
  }
  /* ---- the SAME group-facing projection (m.pub) → PDF / XLSX. Nothing here reads m.ops or m.rows. ---- */
  function inStamp(iso) { return String(iso).replace(/[-:T]/g, '').slice(0, 14); }
  function inDate(d) { return String(d).slice(0, 10).split('-').reverse().join('.'); }
  function inMeta(m) { return ['נוצר: ' + String(m.generatedAt).slice(0, 16).replace('T', ' ') + ' (UTC) · גרסת שיטה ' + m.version + ' · מקור: ' + m.source, 'היקף: ' + (m.course || 'קורס') + ' · אירוע: ' + m.typeName + ' ' + inDate(m.date) + ' · כל ספירה קטנה מ-' + IN_MIN_N + ' מוסתרת, ללא שמות חניכים']; }
  function inUnitLine(u) { return u.hidden ? 'מוסתר' : inFmt(u.mean); }
  function inNavPdf(m, logos) {
    var p = m.pub, d = RK.Pdf({ title: 'דוח ניווט — ' + m.typeName + ' ' + inDate(m.date), stamp: inStamp(m.generatedAt), logos: logos || [] }), T = RK.colors.TEAL, R = RK.colors.RED;
    d.header('דוח ניווט — תמונת מצב לאירוע', m.typeName + ' · ' + inDate(m.date) + (m.course ? ' · ' + m.course : ''), inMeta(m));
    d.kpis([{ label: 'כיסוי', value: p.hidden ? 'אין מספיק נתונים' : p.recorded + '/' + p.eligible, note: p.hidden ? 'פחות מ-' + IN_MIN_N + ' תוצאות' : p.pct + '% מהחניכים' }, { label: 'ציון סופי ממוצע', value: p.score.hidden ? '—' : inFmt(p.score.mean), note: p.score.hidden ? 'אין מספיק נתונים' : 'חציון ' + inFmt(p.score.median) + ' · N=' + p.score.n },
      { label: 'שינוי מהניווט הקודם', value: p.prior ? inSign(p.prior.delta) : '—', note: p.prior ? 'לעומת ' + inDate(p.prior.date) + ' (N=' + p.prior.n + ')' : 'אין השוואה זמינה', accent: p.prior && p.prior.delta < 0 ? R : T }, { label: 'דורש טיפול', value: p.hidden ? '—' : String(p.attention.length), note: p.hidden ? '' : p.attention.length ? 'ראו עמוד האיכות' : 'אין פריטים', accent: p.attention.length ? R : T }]);
    d.h2('מסקנות עיקריות'); p.findings.forEach(function (t) { d.callout(t); });
    if (!p.hidden && !p.score.hidden) {
      var vu = p.departments.filter(function (u) { return !u.hidden; }), hu = p.departments.length - vu.length; d.h2('יחידות');
      if (vu.length) { d.hbars({ title: 'ממוצע ציון סופי לפי מחלקה', note: 'רק יחידות עם N≥' + IN_MIN_N + (hu ? ' · ' + hu + ' יחידות הוסתרו (קבוצה קטנה או הסתרה משלימה)' : ''), max: 100, rowH: 20, rows: vu.map(function (u) { return { label: u.name, value: u.mean, text: inFmt(u.mean) + ' · N=' + u.n }; }) }); }
      var tr_ = p.teams.filter(function (u) { return !u.hidden; }); d.table(['יחידה', 'N', 'ממוצע', 'חציון', 'שינוי'], vu.concat(tr_).map(function (u) { return [u.name, String(u.n), inFmt(u.mean), inFmt(u.median), u.delta !== undefined ? inSign(u.delta) : '—']; }));
      var hiddenAll = (p.departments.length - vu.length) + (p.teams.length - tr_.length); if (hiddenAll) d.p(hiddenAll + ' יחידות הוסתרו בטבלה זו (קבוצה קטנה מ-' + IN_MIN_N + ' או הסתרה משלימה) — לא מוצגים להן מספרים.', { size: 8.5, color: RK.colors.GREY });
      d.banner('התפלגות ציון סופי', 'N=' + p.score.n, 'כל עמודה מכילה לפחות ' + IN_MIN_N + ' חניכים (טווחים סמוכים אוחדו)');
      if (p.score.bins.length >= 2) d.histogram({ title: 'מספר חניכים בכל טווח ציון', note: 'ציר מספרי משמאל לימין · טווחים סמוכים אוחדו כדי שכל עמודה תכיל לפחות ' + IN_MIN_N, h: 140, bins: p.score.bins }); else d.callout('מספר החניכים קטן מכדי להציג התפלגות מפורטת: נדרשים לפחות ' + IN_MIN_N + ' חניכים בכל עמודה, ולכן כל הציונים מוצגים כטווח אחד.'); d.table(['טווח ציון', 'חניכים'], p.score.bins.map(function (b) { return [b.label, String(b.n)]; }));
      if (p.components) { var cp = p.components; d.banner('רכיבי הציון', '', 'ממוצע לכל רכיב בסולם שלו · בלי משקלים מומצאים'); d.hbars({ title: 'תכנון ותחקיר (סולם 0–5)', max: 5, rowH: 22, rows: [{ label: 'תכנון', value: cp.plan.hidden ? null : cp.plan.mean, text: cp.plan.hidden ? 'מוסתר' : inFmt(cp.plan.mean) }, { label: 'תחקיר', value: cp.debrief.hidden ? null : cp.debrief.mean, text: cp.debrief.hidden ? 'מוסתר' : inFmt(cp.debrief.mean) }] }); d.hbars({ title: 'נקודות שנדקרו (% מסך הנקודות)', max: 100, rowH: 22, rows: [{ label: 'נקודות', value: cp.points.hidden ? null : cp.points.mean, text: cp.points.hidden ? 'מוסתר' : inFmt(cp.points.mean) + '%' }] }); }
      d.banner('השוואה ומגמה', '', 'אותו סוג ניווט בלבד · רק אירועים עם N≥' + IN_MIN_N);
      var dv = p.departments.concat(p.teams).filter(function (u) { return !u.hidden && u.delta !== undefined; });
      if (p.prior && dv.length) d.diverging({ title: 'שינוי בממוצע לעומת ' + inDate(p.prior.date) + ' (נקודות)', note: 'אדום = ירידה, טורקיז = שיפור · רק יחידות עם N≥' + IN_MIN_N + ' בשני האירועים', rows: dv.map(function (u) { return { label: u.name, value: u.delta, text: inSign(u.delta) }; }) }); else d.p('אין השוואה זמינה ברמת יחידות (נדרש ניווט קודם מאותו סוג עם N≥' + IN_MIN_N + ' ליחידה).');
      var tr = p.trend.filter(function (t) { return !t.hidden; });
      if (tr.length >= 2) { var seq = tr.slice(-6), vals = seq.map(function (t) { return t.mean; }), lo = Math.max(0, Math.floor(Math.min.apply(null, vals) / 10) * 10 - 10), hi = Math.min(100, Math.ceil(Math.max.apply(null, vals) / 10) * 10 + 10); d.lines({ title: 'ממוצע ציון סופי לפי תאריך', note: 'מהישן (ימין) לחדש (שמאל)', h: 110, labels: seq.map(function (t) { return inDate(t.date).slice(0, 5); }), series: [{ values: vals }], yMin: lo, yMax: hi }); d.table(['תאריך', 'N', 'ממוצע'], tr.slice(-4).reverse().map(function (t) { return [inDate(t.date), String(t.n), inFmt(t.mean)]; })); } else d.p('אין מספיק אירועים בני-השוואה להצגת מגמה.');
    }
    d.pageBreak(); d.banner('איכות הנתונים והיקף', '', 'מה נספר, מה חסר ומה הוסתר');
    d.p('בסיס הכיסוי: ' + p.basis + '.', { size: 9 });
    var cl = p.cells, c = function (x) { return x ? x.txt : 'מוסתר'; };
    d.table(['פריט', 'ערך'], [['חניכים בהיקף (מכנה)', String(p.eligible)], ['חניכים עם רשומה פעילה', p.hidden ? 'פחות מ-' + IN_MIN_N : String(p.recorded)], ['רשומות ללא ציון סופי', c(cl.noScore)], ['רשומות כפולות לאותו חניך', c(cl.dup)], ['רשומות מבוטלות (לא נספרו)', c(cl.cancelled)], ['רשומות של חניכים שבוטלו (לא נספרו)', c(cl.cancelledSoldiers)], ['רשומות של חניכים שאינם פעילים כיום (נספרו)', c(cl.inactiveWithRecord)], ['היעדרות / פטור', p.absentExempt]]);
    if (p.attention.length) { d.h2('מה דורש טיפול'); p.attention.forEach(function (a) { d.callout(a.text, { accent: R }); }); }
    d.h2('מילון מדדים ושיטה'); d.table(['מדד', 'יחידה', 'מקור', 'שיטת חישוב ומכנה', 'כיוון'], ['nav.coverage', 'nav.final', 'nav.plan', 'nav.debrief', 'nav.points'].map(function (k) { var x = MD[k]; return [x.label, x.unit, x.source, x.numerator + ' · מכנה: ' + x.denominator + ' · ' + x.nulls, x.direction]; }));
    d.p('כללי הסתרה: ספירה קטנה מ-' + IN_MIN_N + ' אינה מוצגת; אין ערכי מינימום/מקסימום; עמודות התפלגות אוחדו עד לגודל מינימלי; הסתרה משלימה בין יחידות אחיות. כל המספרים נגזרים מאותו מודל כמו המסך. אין ספי עמידה (לא הוגדרו). מידע סינתטי בלבד בסביבת בדיקה.', { size: 8, color: RK.colors.GREY });
    return d.build();
  }
  function inNavXlsx(m) {
    var p = m.pub, c = function (x) { return x ? x.txt : 'מוסתר'; }, sh = [], cl = p.cells;
    sh.push({ name: 'סיכום', header: ['מדד', 'ערך', 'הערה'], rows: [['סוג ניווט', m.typeName, ''], ['תאריך', m.date, ''], ['קורס', m.course, ''], ['חניכים בהיקף (מכנה)', p.eligible, p.basis], ['חניכים עם רשומה', p.hidden ? 'פחות מ-' + IN_MIN_N : p.recorded, ''], ['כיסוי %', p.pct === null ? 'מוסתר' : p.pct, ''], ['ציון סופי ממוצע', p.score.hidden ? 'אין מספיק נתונים' : inR1(p.score.mean), p.score.hidden ? '' : 'N=' + p.score.n], ['חציון', p.score.hidden ? 'אין מספיק נתונים' : inR1(p.score.median), ''], ['שינוי מהניווט הקודם', p.prior ? inR1(p.prior.delta) : '', p.prior ? 'לעומת ' + p.prior.date + ' (N=' + p.prior.n + ')' : 'אין השוואה'], ['נוצר (UTC)', m.generatedAt, 'מקור: ' + m.source + ' · גרסה ' + m.version]] });
    sh.push({ name: 'התפלגות', header: ['טווח ציון', 'חניכים'], rows: p.score.hidden ? [['אין מספיק נתונים', '']] : p.score.bins.map(function (b) { return [b.label, b.n]; }) });
    var urow = function (lvl) { return function (u) { return [lvl, u.name, u.hidden ? 'מוסתר' : u.n, u.hidden ? 'מוסתר' : inR1(u.mean), u.hidden ? 'מוסתר' : inR1(u.median), u.delta !== undefined ? inR1(u.delta) : '', u.reason]; }; };
    sh.push({ name: 'יחידות', header: ['רמה', 'יחידה', 'N', 'ממוצע', 'חציון', 'שינוי', 'הערה'], rows: p.departments.map(urow('מחלקה')).concat(p.teams.map(urow('צוות'))) });
    sh.push({ name: 'מגמה', header: ['תאריך', 'N', 'ממוצע', 'הערה'], rows: p.trend.map(function (t) { return [t.date, t.hidden ? 'מוסתר' : t.n, t.hidden ? 'מוסתר' : inR1(t.mean), t.hidden ? 'פחות מ-' + IN_MIN_N : '']; }) });
    sh.push({ name: 'איכות נתונים', header: ['פריט', 'ערך'], rows: [['חניכים בהיקף (מכנה)', p.eligible], ['רשומות ללא ציון סופי', c(cl.noScore)], ['רשומות כפולות', c(cl.dup)], ['רשומות מבוטלות', c(cl.cancelled)], ['רשומות של חניכים שבוטלו', c(cl.cancelledSoldiers)], ['רשומות של חניכים לא פעילים כיום', c(cl.inactiveWithRecord)], ['היעדרות / פטור', p.absentExempt]] });
    sh.push({ name: 'מילון מדדים', header: ['מזהה', 'מדד', 'יחידה', 'מקור', 'מונה', 'מכנה', 'כיוון', 'ערכים חסרים', 'השוואה', 'גרסה'], rows: Object.keys(MD).map(function (k) { var x = MD[k]; return [k, x.label, x.unit, x.source, x.numerator, x.denominator, x.direction, x.nulls, x.compare, x.version]; }) });
    return RK.xlsx({ sheets: sh });
  }
  /* a download is announced ONLY after the bytes were checked */
  function inCheck(bytes, kind) { if (!bytes || bytes.length < 1000) return false; var h = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]); if (kind === 'pdf') return h === '%PDF-' && String.fromCharCode.apply(null, bytes.slice(bytes.length - 6)).indexOf('%%EOF') !== -1; return h.slice(0, 2) === 'PK'; }
  function inSave(bytes, name, mime) { var b = new Blob([bytes], { type: mime }), u = URL.createObjectURL(b), a = h('a', { href: u, download: name, rel: 'noopener', style: 'display:none' }); document.body.append(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(u); }, 4000); window.__lastDownload = { name: name, size: bytes.length, type: mime }; }
  function inFileName(m, ext) { return 'maslul-navigation_' + m.date + '_' + String(m.typeId).replace(/[^A-Za-z0-9-]/g, '') + '_v1.' + ext; }
  /* SHA-256 of the produced bytes (WebCrypto when the context allows it, small pure-JS fallback otherwise) */
  function inSha(bytes) {
    function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
    if (window.crypto && crypto.subtle && crypto.subtle.digest) return crypto.subtle.digest('SHA-256', bytes).then(hex);
    var K = [], P = 2, n = 0; function isP(c) { for (var i = 2; i * i <= c; i++) if (c % i === 0) return false; return true; }
    function f(x) { return ((x - Math.floor(x)) * 4294967296) | 0; } while (n < 64) { if (isP(P)) { K[n++] = f(Math.pow(P, 1 / 3)); } P++; }
    var H = [], q = 0; P = 2; while (q < 8) { if (isP(P)) { H[q++] = f(Math.pow(P, 1 / 2)); } P++; }
    var l = bytes.length, w = new Uint8Array(((l + 9 + 63) >> 6) << 6); w.set(bytes); w[l] = 128; var dv = new DataView(w.buffer); dv.setUint32(w.length - 4, (l * 8) >>> 0); dv.setUint32(w.length - 8, Math.floor(l / 536870912));
    function R(x, k) { return (x >>> k) | (x << (32 - k)); }
    for (var o = 0; o < w.length; o += 64) { var W = new Array(64), i; for (i = 0; i < 16; i++) W[i] = dv.getInt32(o + i * 4); for (i = 16; i < 64; i++) { var s0 = R(W[i - 15], 7) ^ R(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = R(W[i - 2], 17) ^ R(W[i - 2], 19) ^ (W[i - 2] >>> 10); W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0; }
      var a = H.slice(); for (i = 0; i < 64; i++) { var S1 = R(a[4], 6) ^ R(a[4], 11) ^ R(a[4], 25), ch = (a[4] & a[5]) ^ (~a[4] & a[6]), t1 = (a[7] + S1 + ch + K[i] + W[i]) | 0, S0 = R(a[0], 2) ^ R(a[0], 13) ^ R(a[0], 22), mj = (a[0] & a[1]) ^ (a[0] & a[2]) ^ (a[1] & a[2]), t2 = (S0 + mj) | 0; a = [(t1 + t2) | 0, a[0], a[1], a[2], (a[3] + t1) | 0, a[4], a[5], a[6]]; }
      for (i = 0; i < 8; i++) H[i] = (H[i] + a[i]) | 0; }
    return Promise.resolve(H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join(''));
  }
  window.__inSha = inSha;
  /* The ONLY way a report file reaches the user: (1) the SERVER authorizes (role+course) and records the request, (2) the browser builds + checks the bytes, (3) the server records size+SHA-256 against the single-use ticket, (4) only then the file is saved.
     A refusal at any step means no download and a visible message. Honest limit: the server cannot see the bytes, so this gates and records the sanctioned path (it is not DRM). */
  function inGated(kind, format, scope, build, fileName) {
    var pdf = format === 'pdf', mime = pdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', cid = S.course.id;
    return api('reports.exportAuthorize', { courseId: cid, req: { kind: kind, format: format, scope: String(scope || '').slice(0, 160) } }).then(function (a) {
      if (!a.ok) { toast('ההפקה נחסמה בשרת: ' + msgOf(a), 'err'); return false; }
      var bytes; try { bytes = build(); } catch (e) { toast('יצירת הקובץ נכשלה: ' + e.message, 'err'); return false; }
      if (!inCheck(bytes, format)) { toast('הקובץ שנוצר לא עבר בדיקת תקינות — לא הורד.', 'err'); return false; }
      var pages = 0; if (pdf) { var bin = ''; for (var i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray ? bytes.subarray(i, i + 8192) : bytes.slice(i, i + 8192)); pages = (bin.match(/\/Type\s*\/Page[^s]/g) || []).length; }
      return inSha(bytes).then(function (sha) { return api('reports.exportComplete', { courseId: cid, req: { ticket: a.data.ticket, sha256: sha, bytes: bytes.length, pages: pages } }); }).then(function (c) {
        if (!c.ok) { toast('הקובץ לא הורד: השרת לא אישר את רישום ההפקה (' + msgOf(c) + ')', 'err'); return false; }
        inSave(bytes, fileName, mime); window.__lastDownload.ticket = a.data.ticket; toast('הקובץ נוצר ונבדק, ההפקה נרשמה בשרת — ההורדה החלה (בדקו בתיקיית ההורדות)'); return true; });
    });
  }
  function inDownload(m, kind) {
    var pdf = kind === 'pdf';
    return inGated('navigation', pdf ? 'pdf' : 'xlsx', m.typeId + ' ' + m.date, function () { return pdf ? inNavPdf(m) : inNavXlsx(m); }, inFileName(m, pdf ? 'pdf' : 'xlsx'));
  }
  /* fresh read → model (one read for the event AND its same-type history) */
  function inLoad(typeId, date) {
    return Promise.all([api('soldiers.list', { courseId: S.course.id, opts: {} }, 'fresh'), api('nav.list', { courseId: S.course.id, typeId: typeId }, 'fresh')]).then(function (rr) {
      var sl = rr[0], r = rr[1]; if (!sl.ok) return sl; if (!r.ok) return r; var rows = Array.isArray(r.data) ? r.data : (r.data && (r.data.rows || r.data.items)) || [];
      return { ok: true, model: inBuildModel(rows, sl.data || [], typeId, date, { course: S.course && S.course.name }), allRows: rows };
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
  function histChart(p, onPick, picked) {
    var bins = p.score.bins, n = bins.length, W = 320, H = 160, gap = 10, bw = Math.min(70, (W - 40 - gap * (n - 1)) / n), x0 = (W - (n * bw + (n - 1) * gap)) / 2, max = Math.max.apply(null, bins.map(function (b) { return b.n; }).concat([1]));
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'in-svg' }); svg.append(sv('line', { x1: 10, x2: W - 10, y1: 126, y2: 126, class: 'in-axis' }));
    bins.forEach(function (b, i) { var x = x0 + i * (bw + gap), hh = Math.max(3, 96 * b.n / max), on = picked === i;
      var bar = sv('rect', { x: x, y: 126 - hh, width: bw, height: hh, rx: 4, class: 'in-bar' + (on ? ' on' : ''), tabindex: 0, role: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': 'טווח ' + b.label + ': ' + b.n + ' חניכים. הקשה מסננת את הרשימה המבצעית', 'data-bin': i });
      bar.addEventListener('click', function () { onPick(on ? -1 : i); }); bar.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(on ? -1 : i); } });
      svg.append(bar, stext(x + bw / 2, 126 - hh - 5, String(b.n), { class: 'in-t in-tv' }), stext(x + bw / 2, 143, b.label)); });
    return svg;
  }
  function lineChart(m) {
    var pts = m.pub.trend.filter(function (t) { return !t.hidden; }).slice(-6), W = 320, H = 160, svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'in-svg' }); if (pts.length < 2) return null;
    var vals = pts.map(function (t) { return t.mean; }), lo = Math.max(0, Math.floor(Math.min.apply(null, vals) / 10) * 10 - 10), hi = Math.min(100, Math.ceil(Math.max.apply(null, vals) / 10) * 10 + 10), x = function (i) { return W - 36 - i * ((W - 72) / (pts.length - 1)); }, y = function (v) { return 124 - 92 * (v - lo) / (hi - lo || 1); };
    svg.append(sv('line', { x1: 24, x2: W - 10, y1: 124, y2: 124, class: 'in-axis' }), stext(14, 128, String(lo), { class: 'in-t in-ty' }), stext(14, 36, String(hi), { class: 'in-t in-ty' }));
    svg.append(sv('polyline', { points: pts.map(function (t, i) { return x(i) + ',' + y(t.mean); }).join(' '), class: 'in-line', fill: 'none' }));
    pts.forEach(function (t, i) { var cur = t.date === m.date, pt = sv('circle', { cx: x(i), cy: y(t.mean), r: cur ? 6 : 5, class: 'in-pt' + (cur ? ' on' : ''), tabindex: 0, role: 'link', 'aria-label': 'ניווט ' + inDate(t.date) + ': ממוצע ' + inFmt(t.mean) + ', N=' + t.n + '. מעבר לאירוע', 'data-date': t.date });
      var jump = function () { go('insight/nav/' + m.typeId + '/' + t.date); }; pt.addEventListener('click', jump); pt.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); } });
      svg.append(pt, stext(x(i), y(t.mean) - 9, inFmt(t.mean), { class: 'in-t in-tv' }), stext(x(i), 141, inDate(t.date).slice(0, 5))); }); return svg;
  }
  function kpi(label, value, note, id, tone, pct) { return h('div', { class: 'in-kpi' + (tone ? ' ' + tone : ''), id: id }, [h('small', { text: label }), h('b', { text: value }), h('span', { text: note || '' })].concat(typeof pct === 'number' ? [h('span', { class: 'in-prog', 'aria-hidden': 'true' }, [h('i', { style: 'width:' + Math.max(2, Math.min(100, pct)) + '%' })])] : []));  }
  function unitBars(units) { var vis = units.filter(function (u) { return !u.hidden; }); return h('div', { class: 'in-bars', id: 'inUnitBars' }, vis.map(function (u) { return h('div', { class: 'in-barrow' }, [h('span', { class: 'in-bl', text: u.name }), h('span', { class: 'in-bt', role: 'img', 'aria-label': u.name + ': ממוצע ' + inFmt(u.mean) + ', N=' + u.n }, [h('i', { style: 'width:' + Math.max(2, Math.min(100, u.mean)) + '%' })]), h('b', { text: inFmt(u.mean) })]); })); }
  /* ---- screens ---- */
  function NavInsight(typeId, date, savedId) {
    var body = h('div', { 'aria-live': 'polite' }, [skeleton(3)]), picked = -1;
    mount('more', [h('button', { class: 'back', type: 'button', id: 'inBack', onclick: function () { go('insight'); }, text: '→ חזרה לתובנות ודוחות' }), h('h1', { class: 'page', text: 'ניתוח הניווט' }), body], 'ניתוח הניווט');
    function draw() {
      body.replaceChildren(skeleton(3)); inLoad(typeId, date).then(function (r) {
        body.replaceChildren(); if (!r.ok) { body.append(errBox(r, draw), h('p', { class: 'muted', text: 'לא מוצגים נתונים או תובנות כשהקריאה מהשרת נכשלה.' })); return; }
        var m = r.model, P = m.pub, O = m.ops; window.__insight.model = m;
        body.append(h('p', { class: 'in-sub', id: 'inSub', text: m.typeName + ' · ' + inDate(m.date) + ' · ' + (m.course || '') }));
        if (savedId) { var found = m.rows.some(function (x) { return x.id === savedId; }); body.append(h('div', { class: 'msg ' + (found ? 'ok' : 'err'), id: 'inVerified', role: found ? 'status' : 'alert', text: found ? 'נשמר ואומת בשרת: הרשומה נקראה מחדש ונמצאה.' : 'הרשומה לא נמצאה בקריאה החוזרת מהשרת — השמירה לא אומתה, ולכן לא מוצגת הצלחה. בדקו ברשימת הניווטים ונסו שוב.' })); }
        body.append(h('details', { class: 'in-meta', id: 'inStamp' }, [h('summary', { text: 'נקרא מהשרת ' + new Date(m.generatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + ' · מקור ומכנה' }), h('p', { text: 'נקרא מהשרת ' + new Date(m.generatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + ' · מקור: ' + m.source + ' · מכנה: ' + P.eligible + ' חניכים (פעילים כיום + בעלי רשומה באירוע; אין תיעוד היסטורי של הרכב הקורס)'  })]));
        if (!O.recorded) { body.append(emptyBox('אין רשומות פעילות לאירוע זה — אין מה לנתח.')); return; }
        /* ---- GROUP zone: the same suppressed projection that the PDF/Excel use ---- */
        body.append(h('div', { class: 'in-kpis' }, [kpi('כיסוי', P.hidden ? 'אין מספיק נתונים' : P.recorded + '/' + P.eligible, P.hidden ? 'פחות מ-' + IN_MIN_N + ' תוצאות' : P.pct + '%', 'inK1', '', P.hidden ? undefined : P.pct), kpi('ממוצע ציון סופי', P.score.hidden ? 'אין מספיק נתונים' : inFmt(P.score.mean), P.score.hidden ? 'פחות מ-' + IN_MIN_N : 'חציון ' + inFmt(P.score.median) + ' · N=' + P.score.n, 'inK2'), kpi('שינוי מהקודם', P.prior ? inSign(P.prior.delta) : '—', P.prior ? 'לעומת ' + inDate(P.prior.date).slice(0, 5) : 'אין השוואה', 'inK3', P.prior && P.prior.delta < 0 ? 'neg' : ''), kpi('דורש טיפול', P.hidden ? '—' : String(P.attention.length), P.hidden ? '' : P.attention.length ? 'ראו למטה' : 'אין פריטים', 'inK4', !P.hidden && P.attention.length ? 'neg' : '')]));
        var act = h('div', { class: 'btns in-act' }); if (isAdmin()) { act.append(h('button', { class: 'primary', type: 'button', id: 'inPdf', text: 'יצירת דוח PDF', onclick: function (ev) { var b = ev.currentTarget; busy(b, true); setTimeout(function () { inDownload(m, 'pdf').then(function () { busy(b, false); }); }, 30); } }), h('button', { class: 'secondary', type: 'button', id: 'inXlsx', text: 'ייצוא נתונים (Excel)', onclick: function (ev) { var b = ev.currentTarget; busy(b, true); setTimeout(function () { inDownload(m, 'xlsx').then(function () { busy(b, false); }); }, 30); } })); } else act.append(h('p', { class: 'muted', id: 'inNoExport', text: 'הפקת קבצים מותרת למנהל בלבד. הכפתורים מוסתרים כאן, וההרשאה נבדקת ונרשמת גם בשרת בכל הפקה.' }));
        act.append(h('button', { class: 'secondary', type: 'button', id: 'inRefresh', text: 'רענון', onclick: draw })); body.append(act);
        body.append(sectionHead('ממצאים', null), h('ul', { class: 'in-find', id: 'inFind' }, P.findings.map(function (t) { return h('li', { text: t }); })));
        if (P.hidden || P.score.hidden) body.append(h('div', { class: 'msg', id: 'inInsufficient', role: 'status', text: (P.score.reason || 'אין מספיק נתונים') + '. כל הספירות והמדדים הקבוצתיים מוסתרים; הרשימה המבצעית למטה מיועדת למורשים בלבד.' }));
        else {
          var histBox = h('div', { id: 'inHistBox' }), listBox = h('div', { id: 'inList' });
          var drawList = function () { var b = picked >= 0 ? P.score.bins[picked] : null, rows = m.rows.filter(function (x) { return !b || (inNum(x.final_score) && x.final_score >= b.clo && x.final_score <= b.chi); }).sort(function (x, y) { return (y.final_score || 0) - (x.final_score || 0); });
            listBox.replaceChildren(h('p', { class: 'muted', id: 'inListInfo', text: (b ? 'מסונן: ' + b.label + ' · ' : '') + rows.length + ' חניכים · תצוגה מבצעית (מידע אישי — לא נכלל בקבצים)' })); rows.slice(0, 80).forEach(function (x) { listBox.append(card(x.soldier_name || x.soldier_id, 'ציון סופי: ' + inFmt(x.final_score) + ' · תכנון ' + inFmt(x.plan_score) + ' · תחקיר ' + inFmt(x.debrief_score), null, function () { go('soldier/' + x.soldier_id); })); }); };
          var drawHist = function () { histBox.replaceChildren(chartFigure('inHist', 'התפלגות ציון סופי · N=' + P.score.n, histChart(P, function (i) { picked = i; drawHist(); drawList(); }, picked), 'התפלגות ציון סופי: ' + P.score.bins.map(function (b) { return b.label + ' — ' + b.n; }).join('; '), ['טווח', 'חניכים'], P.score.bins.map(function (b) { return [b.label, b.n]; }))); };
          body.append(sectionHead('התפלגות', 'כל עמודה ≥ ' + IN_MIN_N), histBox); drawHist();
          if (P.components) { var cp = P.components, cr = function (k, l, u) { var x = cp[k]; return [l, x.hidden ? 'מוסתר' : inFmt(x.mean) + u, x.hidden ? 'מוסתר' : x.n]; }; body.append(sectionHead('רכיבי הציון', null), h('table', { class: 'in-table', id: 'inComp' }, [h('thead', {}, [h('tr', {}, ['רכיב', 'ממוצע', 'N'].map(function (x) { return h('th', { scope: 'col', text: x }); }))]), h('tbody', {}, [cr('plan', 'תכנון (0–5)', ''), cr('debrief', 'תחקיר (0–5)', ''), cr('points', 'נקודות שנדקרו', '%')].map(function (r) { return h('tr', {}, r.map(function (v) { return h('td', { text: String(v) }); })); }))])); }
          var us = P.departments.concat(P.teams); if (us.length) { body.append(sectionHead('יחידות', 'N≥' + IN_MIN_N)); if (P.departments.some(function (u) { return !u.hidden; })) body.append(unitBars(P.departments)); body.append(h('table', { class: 'in-table', id: 'inUnits' }, [h('thead', {}, [h('tr', {}, ['יחידה', 'N', 'ממוצע', 'שינוי'].map(function (x) { return h('th', { scope: 'col', text: x }); }))]), h('tbody', {}, us.map(function (u) { return h('tr', {}, [h('td', { text: u.name }), h('td', { text: u.hidden ? 'מוסתר' : String(u.n) }), h('td', { text: u.hidden ? 'מוסתר' : inFmt(u.mean) }), h('td', { text: u.hidden ? u.reason : u.delta !== undefined ? inSign(u.delta) : '—' })]); }))])); }
          var lc = lineChart(m); body.append(sectionHead('מגמה — אותו סוג ניווט', null)); if (lc) body.append(chartFigure('inTrend', 'ממוצע ציון סופי לפי תאריך (הישן מימין, החדש משמאל)', lc, 'מגמת ממוצע: ' + P.trend.filter(function (t) { return !t.hidden; }).slice(-6).map(function (t) { return inDate(t.date) + ' ' + inFmt(t.mean); }).join('; '), ['תאריך', 'N', 'ממוצע'], P.trend.map(function (t) { return [inDate(t.date), t.hidden ? 'מוסתר' : t.n, t.hidden ? 'מוסתר' : inFmt(t.mean)]; }))); else body.append(h('p', { class: 'muted', id: 'inNoTrend', text: 'אין מספיק אירועים בני-השוואה (נדרשים לפחות שניים מאותו סוג עם N≥' + IN_MIN_N + ').' }));
          body.append(h('details', { class: 'in-det' }, [h('summary', { text: 'רשימת חניכים (תצוגה מבצעית)' }), listBox])); drawList();
        }
        /* ---- OPERATIONAL zone: exact numbers for authorized users; never exported ---- */
        var opBox = h('section', { class: 'in-op', id: 'inOps', 'aria-label': 'תצוגה מבצעית' }, [h('h3', { text: 'תצוגה מבצעית — מספרים מדויקים (לא נכללים בקבצים)' }), h('p', { class: 'muted', id: 'inOpsLine', text: O.recorded + ' רשומות · ' + O.eligible + ' חניכים בהיקף · ' + O.missing + ' ללא תוצאה' + (O.inactiveWithRecord ? ' · ' + O.inactiveWithRecord + ' מחניכים שאינם פעילים כיום' : '') })]);
        if (O.attention.length) { opBox.append(h('h4', { text: 'מה דורש טיפול' })); O.attention.forEach(function (a) { opBox.append(card(a.text, 'פתיחת המסך הרלוונטי', null, function () { go(a.go); })); }); }
        if (P.hidden) { var rl = h('div', {}); m.rows.forEach(function (x) { rl.append(card(x.soldier_name || x.soldier_id, 'ציון סופי: ' + inFmt(x.final_score), null, function () { go('soldier/' + x.soldier_id); })); }); opBox.append(h('h4', { text: 'רשימת חניכים' }), rl); }
        body.append(opBox);
        body.append(h('details', { class: 'in-det', id: 'inMethod' }, [h('summary', { text: 'הגדרות ושיטה' }), h('p', { class: 'muted', text: 'כללי הסתרה: ספירה קטנה מ-' + IN_MIN_N + ' אינה מוצגת; אין מינימום/מקסימום; עמודות התפלגות מאוחדות עד ' + IN_MIN_N + ' לפחות; הסתרה משלימה בין יחידות אחיות.' })].concat(['nav.coverage', 'nav.final', 'nav.plan', 'nav.debrief', 'nav.points'].map(function (k) { var x = MD[k]; return h('p', { class: 'muted', text: x.label + ' (' + x.unit + '): ' + x.numerator + '. מכנה: ' + x.denominator + '. ' + x.nulls + '. מקור: ' + x.source + '. גרסה ' + x.version + '.' }); }))));
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
        rows.forEach(function (x) { if (x.record_status === 'cancelled' || x.soldier_cancelled) return; var k = x.navigation_type_id + '|' + String(x.test_date).slice(0, 10); (ev[k] = ev[k] || { typeId: x.navigation_type_id, date: String(x.test_date).slice(0, 10), name: x.type_name || x.navigation_type_name || 'ניווט', n: 0 }).n++; });
        var list = Object.keys(ev).map(function (k) { return ev[k]; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
        body.append(sectionHead('דוחות לפי תבנית', null));
        body.append(card('תמונת מצב קורס', 'מה השתנה, מה דורש טיפול, איכות נתונים וכל התחומים · סיכומים קבוצתיים מוגנים', h('span', { class: 'arrow', text: '←' }), function () { go('insight/course'); }));
        body.append(card('דוח ניווט', list.length ? 'ניתוח אירוע, מגמה, PDF ו-Excel · ' + list.length + ' אירועים' : 'אין עדיין אירועי ניווט', h('span', { class: 'arrow', text: '←' }), list.length ? function () { go('insight/nav/' + list[0].typeId + '/' + list[0].date); } : null));
        [['דוח כש״ג', 'fitness'], ['נוכחות / מסעות', 'attendance']].forEach(function (t) { body.append(card(t[0], 'סיכום קבוצתי של התחום בדשבורד הקורס, כולל PDF ו-Excel', h('span', { class: 'arrow', text: '←' }), function () { go('insight/course/' + t[1]); })); });
        body.append(card('דוח קליעה', 'קליעה רגילה ויל״מ בנפרד, התפלגות, נשק מאופס, סוגי נשק ויחידות · PDF ו-Excel', h('span', { class: 'arrow', text: '←' }), function () { go('insight/shoot'); }));
        var exBox = h('div', { id: 'inExamCards' }); body.append(sectionHead('דוחות מבחנים', null), exBox);
        api('exams.defs', { courseId: S.course.id, opts: {} }, 'fresh').then(function (dr) { if (!dr.ok) { exBox.append(h('p', { class: 'muted', text: 'רשימת המבחנים לא נטענה.' })); return; } var defs = dr.data || []; if (!defs.length) exBox.append(emptyBox('אין מבחנים מוגדרים.')); defs.forEach(function (d) { exBox.append(card('דוח מבחן — ' + d.name, 'מסלול עמידה א׳/ב׳/ג׳, התפלגות, יחידות, PDF ו-Excel', h('span', { class: 'arrow', text: '←' }), function () { go('insight/exam/' + d.id); })); }); });
        body.append(sectionHead('אירועי ניווט', String(list.length))); if (!list.length) body.append(emptyBox('אין אירועי ניווט להצגה.'));
        list.slice(0, 40).forEach(function (e) { body.append(card(e.name + ' · ' + inDate(e.date), e.n >= IN_MIN_N ? e.n + ' רשומות' : 'פחות מ-' + IN_MIN_N + ' רשומות', null, function () { go('insight/nav/' + e.typeId + '/' + e.date); })); });
      });
    }
    draw();
  }
  /* ===== COURSE dashboard ("תמונת מצב קורס") + domain views: composed ONLY from the engine's existing group-safe routes (their own N≥5 suppression applies; person-counts 1–4 are additionally shown as "פחות מ-5").
     Same model → screen, PDF, Excel. Individual rows are never requested here. ===== */
  var CI_CATS = [['all', 'הכול'], ['navigation', 'ניווט'], ['fitness', 'כש״ג'], ['exams', 'מבחנים'], ['shooting', 'קליעה'], ['attendance', 'נוכחות'], ['marches', 'מסעות'], ['readiness', 'כשירות מבצעית']];
  /* Partition suppression for counts that add up to a total that is ALSO shown: a hidden small cell must not be recoverable by subtraction.
     Rule: cells 1..4 are hidden; while 0 < (total − Σ visible cells) < 5 the smallest visible positive cell is hidden too (label "מוסתר (מניעת הסקה)"). Returns {key: display}. */
  function inPart(cells, total) {
    var out = {}, vis = {}, sum = 0; if (typeof total === 'number' && total < IN_MIN_N) { Object.keys(cells).forEach(function (k) { out[k] = cells[k] === null || cells[k] === undefined ? '—' : 'פחות מ-' + IN_MIN_N; }); return out; }
    Object.keys(cells).forEach(function (k) { var v = cells[k]; if (v === null || v === undefined) { out[k] = '—'; return; } if (v > 0 && v < IN_MIN_N) { out[k] = 'פחות מ-' + IN_MIN_N; return; } vis[k] = v; });
    if (typeof total === 'number') { var rem = function () { var t = 0; Object.keys(vis).forEach(function (k) { t += vis[k]; }); return total - t; };
      while (rem() > 0 && rem() < IN_MIN_N) { var ks = Object.keys(vis).filter(function (k) { return vis[k] > 0; }).sort(function (a, b) { return vis[a] - vis[b]; }); if (!ks.length) break; out[ks[0]] = 'מוסתר (מניעת הסקה)'; delete vis[ks[0]]; } }
    Object.keys(vis).forEach(function (k) { out[k] = String(vis[k]); }); return out;
  }
  var inP = function (c) { return c === null || c === undefined ? '—' : (typeof c === 'number' && c > 0 && c < IN_MIN_N) ? 'פחות מ-' + IN_MIN_N : String(c); };   // person-counts only
  var inMean1 = function (v) { return v === null || v === undefined || v === '' ? '—' : String(v); };
  function inCourseModel(R, ctx) {
    var g = function (k) { return R[k] && R[k].ok ? R[k].data : null; }, S_ = [];
    var nav = g('nav.summary'), fit = g('fitness.summary'), fc = g('fitness.completion'), mk = g('mk.summary'), ex = g('exams.summary'), at = g('attendance.summary'), ma = g('marches.summary'), rd = g('readiness.summary'), al = g('alerts.counts'), ng = g('nav.groups');
    var sec = function (key, title, src, rows, note, go_) { S_.push({ key: key, title: title, source: src, rows: rows, note: note || '', go: go_ || '' }); };
    if (nav) sec('navigation', 'ניווט', 'nav.summary', [['תוצאות שנרשמו', nav.count], ['ממוצע ציון סופי', inMean1(nav.mean_display)]].concat(ng && ng.data !== undefined ? [] : []), nav.note, 'insight');
    if (ng) { var c = ng.course || (ng.data && ng.data.course); if (c) sec('navigation', 'ניווט — כיסוי', 'nav.groups', [['חניכים בקורס', typeof c.soldiers === 'number' ? inP(c.soldiers) : '—'], ['חניכים עם תוצאה', c.soldiers_with_results === undefined ? '—' : inPart({ w: c.soldiers_with_results }, typeof c.soldiers === 'number' ? c.soldiers : undefined).w]], c.note, 'insight'); }
    var fcp = fc && fc.counts ? inPart({ c: fc.counts.complete, i: fc.counts.incomplete }, typeof fc.counts.soldiers === 'number' ? fc.counts.soldiers : undefined) : null;
    if (fit) sec('fitness', 'כושר גופני (כש״ג)', 'fitness.summary · fitness.completion', [['תוצאות', fit.count], ['ממוצע', fit.mean_display || 'ממתין לגרסת ניקוד מאושרת'], ['נתונים מלאים', fcp ? fcp.c : '—'], ['חסרי נתונים', fcp ? fcp.i : '—']].concat(Object.keys(fit.by_component || {}).map(function (k) { var x = fit.by_component[k]; return [x.label, x.count ? 'ממוצע ' + inMean1(x.mean_display) : 'אין נתונים']; })), fit.note, 'd/fitness');
    if (ex) sec('exams', 'מבחנים עיוניים', 'exams.summary', (ex.exams || []).map(function (e) { return [e.exam_name, e.suppressed ? 'מוסתר (קבוצה קטנה)' : (e.pass_rate_display !== null && e.pass_rate_display !== undefined ? 'אחוז עוברים ' + e.pass_rate_display + '%' : 'אין נתונים')]; }), ex.note, 'd/exams');
    if (mk) sec('shooting', 'קליעה', 'mk.summary', [['תוצאות רגילה', mk.regular ? mk.regular.count : '—'], ['ממוצע רגילה', mk.regular ? inMean1(mk.regular.mean_display) : '—'], ['תוצאות יל״מ', mk.ylm ? mk.ylm.count : '—'], ['ממוצע יל״מ', mk.ylm ? inMean1(mk.ylm.mean_display) : '—']], mk.note, 'd/mk');
    if (at) sec('attendance', 'נוכחות', 'attendance.summary', [['נוכחות מצטברת', at.percent_display ? at.percent_display + '%' : '—'], ['סה״כ רישומים', at.total], ['יציאות מוקדמות', at.early_exits_suppressed ? 'מוסתר' : inP(at.early_exits)]], at.note, 'd/attendance');
    if (ma) sec('marches', 'מסעות', 'marches.summary', [['מסעות', ma.marches_total], ['סה״כ ק״מ', ma.total_km]], ma.note, 'd/marches');
    var rdp = rd && rd.counts ? inPart({ f: rd.counts.fit, r: rd.counts.fit_with_restrictions, u: rd.counts.unfit, n: rd.counts.not_entered }, typeof rd.total === 'number' ? rd.total : undefined) : null;
    if (rd && rd.counts) sec('readiness', 'כשירות מבצעית', 'readiness.summary', [['כשירים', rdp.f], ['כשירים עם מגבלות', rdp.r], ['לא כשירים', rdp.u], ['טרם הוזנו', rdp.n]], '', 'd/readiness');
    var ins = (g('analytics.insights') || {}).items || [], att = [];
    if (al && al.open) att.push({ text: al.open + ' התראות פתוחות (' + (al.red || 0) + ' אדומות)', go: 'd/alerts' });
    if (rd && rd.counts && rdp && /^\d+$/.test(rdp.n) && rd.counts.not_entered >= IN_MIN_N) att.push({ text: rd.counts.not_entered + ' חניכים ללא סטטוס כשירות מבצעית', go: 'd/readiness' });
    if (fc && fc.counts && fcp && /^\d+$/.test(fcp.i) && fc.counts.incomplete >= IN_MIN_N) att.push({ text: fc.counts.incomplete + ' חניכים עם נתוני כש״ג חסרים', go: 'd/fitness' });
    var cs = ng && (ng.course || (ng.data && ng.data.course)); if (cs && cs.soldiers && cs.soldiers_with_results !== undefined && cs.soldiers - cs.soldiers_with_results >= IN_MIN_N) att.push({ text: (cs.soldiers - cs.soldiers_with_results) + ' חניכים ללא תוצאת ניווט כלל', go: 'd/nav' });
    var soldiers = (g('dash.overview') || {}).active_soldiers;
    return { v: 1, version: 'insight-1', generatedAt: ctx.now || new Date().toISOString(), course: ctx.course || '', soldiers: (soldiers === undefined || (typeof soldiers === 'number' && soldiers < IN_MIN_N)) ? null : soldiers, sections: S_, insights: ins.map(function (x) { return { title: x.title, text: x.text, n: x.n, window: x.window, source: (x.source || []).join(', '), caveat: x.caveat }; }), attention: att, failed: Object.keys(R).filter(function (k) { return !R[k].ok; }) };
  }
  var CI_ROUTES = ['nav.summary', 'nav.groups', 'fitness.summary', 'fitness.completion', 'mk.summary', 'exams.summary', 'attendance.summary', 'marches.summary', 'readiness.summary', 'alerts.counts', 'analytics.insights', 'dash.overview'];
  function inCourseLoad() {
    var a = { courseId: S.course.id, opts: {} }; return Promise.all(CI_ROUTES.map(function (m) { return api(m, a, 'fresh').then(function (r) { return [m, r]; }, function (e) { return [m, { ok: false, message: String(e && e.message || e) }]; }); })).then(function (rr) { var R = {}; rr.forEach(function (x) { R[x[0]] = x[1]; }); return inCourseModel(R, { course: S.course && S.course.name }); });
  }
  function inCoursePick(m, cat) { return cat === 'all' ? m.sections : m.sections.filter(function (s) { return s.key === cat; }); }
  function inCoursePdf(m, cat, logos) {
    var secs = inCoursePick(m, cat), lbl = (CI_CATS.filter(function (c) { return c[0] === cat; })[0] || [0, 'הכול'])[1], d = RK.Pdf({ title: 'תמונת מצב קורס — ' + lbl, stamp: inStamp(m.generatedAt), logos: logos || [] }), T = RK.colors.TEAL, R = RK.colors.RED;
    d.header('תמונת מצב קורס' + (cat === 'all' ? '' : ' — ' + lbl), (m.course || 'קורס') + ' · ' + inDate(m.generatedAt), ['נוצר: ' + String(m.generatedAt).slice(0, 16).replace('T', ' ') + ' (UTC) · גרסת שיטה ' + m.version + ' · מקורות: סיכומים קבוצתיים מוגנים של המערכת', 'ספירות קטנות מ-' + IN_MIN_N + ' מוסתרות · ללא שמות חניכים']);
    d.kpis([{ label: 'חניכים פעילים', value: m.soldiers === null ? '—' : String(m.soldiers), note: 'בהיקף ההרשאה' }, { label: 'תחומים עם נתונים', value: String(m.sections.length), note: 'מתוך 7' }, { label: 'דורש טיפול', value: String(m.attention.length), note: m.attention.length ? 'ראו למטה' : 'אין פריטים', accent: m.attention.length ? R : T }, { label: 'תובנות מגמה', value: String(m.insights.length), note: 'תיאוריות, עם הסתייגויות' }]);
    if (m.attention.length) { d.h2('מה דורש טיפול'); m.attention.forEach(function (a) { d.callout(a.text, { accent: R }); }); }
    if (m.insights.length && cat === 'all') { d.h2('מה השתנה'); m.insights.slice(0, 4).forEach(function (x) { d.callout(x.text + (x.n ? ' (N=' + x.n + ')' : '') + (x.caveat ? ' — ' + x.caveat : ''), { size: 9 }); }); }
    secs.forEach(function (s, i) { if (i === 2 || i === 5) d.pageBreak(); d.h2(s.title); d.table(['מדד', 'ערך'], s.rows.map(function (r) { return [String(r[0]), String(r[1])]; })); if (s.note) d.p(s.note, { size: 8.5, color: RK.colors.GREY }); });
    if (!secs.length) d.p('אין נתונים זמינים לתחום זה.');
    d.pageBreak(); d.banner('איכות נתונים ושיטה', '', 'מה מוצג, מאיפה ומה הוסתר'); d.table(['תחום', 'מקור', 'הערה'], m.sections.map(function (s) { return [s.title, s.source, s.note || '—']; }));
    d.p('כל הערכים הם סיכומים קבוצתיים שהשרת מחשב ומסנן (N≥' + IN_MIN_N + '). ספירות אנשים קטנות מ-' + IN_MIN_N + ' מוצגות כ"פחות מ-' + IN_MIN_N + '". אין ספי עמידה (לא הוגדרו), אין דירוג אישי ואין חיזוי. תחומים שאין להם נתונים או שנכשלה קריאתם: ' + (m.failed.length ? m.failed.join(', ') : 'אין') + '. מידע סינתטי בלבד בסביבת בדיקה.', { size: 8.5, color: RK.colors.GREY });
    return d.build();
  }
  function inCourseXlsx(m, cat) {
    var secs = inCoursePick(m, cat), sh = [{ name: 'סיכום', header: ['פריט', 'ערך'], rows: [['קורס', m.course], ['חניכים פעילים', m.soldiers === null ? '' : m.soldiers], ['נוצר (UTC)', m.generatedAt], ['גרסה', m.version], ['כלל הסתרה', 'ספירה קטנה מ-' + IN_MIN_N + ' אינה מוצגת']] }];
    secs.forEach(function (s) { sh.push({ name: s.title, header: ['מדד', 'ערך'], rows: s.rows.map(function (r) { return [String(r[0]), typeof r[1] === 'number' ? r[1] : String(r[1])]; }) }); });
    sh.push({ name: 'דורש טיפול', header: ['פריט'], rows: m.attention.length ? m.attention.map(function (a) { return [a.text]; }) : [['אין פריטים']] }); sh.push({ name: 'מגמות', header: ['תובנה', 'N', 'מקור', 'הסתייגות'], rows: m.insights.map(function (x) { return [x.text, x.n === undefined ? '' : x.n, x.source, x.caveat || '']; }) });
    return RK.xlsx({ sheets: sh });
  }
  function inCourseFile(m, cat, kind) {
    var pdf = kind === 'pdf';
    return inGated('course', pdf ? 'pdf' : 'xlsx', cat, function () { return pdf ? inCoursePdf(m, cat) : inCourseXlsx(m, cat); }, 'maslul-course-' + cat + '_' + String(m.generatedAt).slice(0, 10) + '_v1.' + (pdf ? 'pdf' : 'xlsx'));
  }
  function CourseInsight(cat0) {
    var cat = CI_CATS.some(function (c) { return c[0] === cat0; }) ? cat0 : 'all', body = h('div', { 'aria-live': 'polite' }, [skeleton(3)]), model = null;
    mount('more', [h('button', { class: 'back', type: 'button', onclick: function () { go('insight'); }, text: '→ חזרה לתובנות ודוחות' }), h('h1', { class: 'page', text: 'תמונת מצב קורס' }), body], 'תמונת מצב קורס');
    function paint() {
      body.replaceChildren(); var m = model; window.__insight.course = m;
      body.append(h('p', { class: 'muted', id: 'ciStamp', text: 'נקרא מהשרת ' + new Date(m.generatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + ' · סיכומים קבוצתיים מוגנים (N≥' + IN_MIN_N + ') · ' + (m.course || '') }));
      var chips = h('div', { class: 'in-chips', role: 'group', 'aria-label': 'סינון לפי תחום' }, CI_CATS.map(function (c) { return h('button', { class: 'in-chip', type: 'button', id: 'ciChip_' + c[0], 'aria-pressed': c[0] === cat ? 'true' : 'false', text: c[1], onclick: function () { cat = c[0]; try { history.replaceState(history.state, '', '#/insight/course' + (cat === 'all' ? '' : '/' + cat)); } catch (e) {} paint(); } }); })); body.append(chips);
      body.append(h('div', { class: 'in-kpis' }, [kpi('חניכים פעילים', m.soldiers === null ? '—' : String(m.soldiers), 'בהיקף ההרשאה', 'ciK1'), kpi('תחומים עם נתונים', String(m.sections.length), 'מתוך 7', 'ciK2'), kpi('דורש טיפול', String(m.attention.length), m.attention.length ? 'ראו למטה' : 'אין פריטים', 'ciK3', m.attention.length ? 'neg' : ''), kpi('תובנות מגמה', String(m.insights.length), 'תיאוריות', 'ciK4')]));
      var act = h('div', { class: 'btns in-act' }); if (isAdmin()) act.append(h('button', { class: 'primary', type: 'button', id: 'ciPdf', text: 'יצירת דוח PDF', onclick: function () { inCourseFile(m, cat, 'pdf'); } }), h('button', { class: 'secondary', type: 'button', id: 'ciXlsx', text: 'ייצוא נתונים (Excel)', onclick: function () { inCourseFile(m, cat, 'xlsx'); } })); else act.append(h('p', { class: 'muted', id: 'ciNoExport', text: 'כפתורי ההורדה מוצגים למנהל בלבד (הסתרה בממשק; הקריאות מוגבלות בשרת להיקף ההרשאה).' }));
      act.append(h('button', { class: 'secondary', type: 'button', id: 'ciRefresh', text: 'רענון', onclick: load })); body.append(act);
      if (m.failed.length) body.append(h('div', { class: 'msg err', id: 'ciFailed', role: 'alert', text: 'חלק מהנתונים לא נטענו (' + m.failed.join(', ') + ') — התחומים שלהם חסרים ואינם מוצגים כאפס.' }));
      if (cat === 'all') { if (m.attention.length) { body.append(sectionHead('מה דורש טיפול', String(m.attention.length))); m.attention.forEach(function (a) { body.append(card(a.text, 'פתיחת המסך הרלוונטי', null, function () { go(a.go); })); }); } if (m.insights.length) { body.append(sectionHead('מה השתנה', null)); m.insights.slice(0, 4).forEach(function (x) { body.append(card(x.title, x.text + (x.caveat ? ' · ' + x.caveat : ''), null, null)); }); } }
      var secs = inCoursePick(m, cat); if (!secs.length) body.append(emptyBox('אין נתונים זמינים לתחום זה.'));
      secs.forEach(function (s) { body.append(sectionHead(s.title, s.source)); body.append(h('table', { class: 'in-table', id: 'ciT_' + s.key }, [h('thead', {}, [h('tr', {}, ['מדד', 'ערך'].map(function (x) { return h('th', { scope: 'col', text: x }); }))]), h('tbody', {}, s.rows.map(function (r) { return h('tr', {}, [h('td', { text: String(r[0]) }), h('td', { text: String(r[1]) })]); }))])); if (s.note) body.append(h('p', { class: 'muted', text: s.note })); if (s.go) body.append(h('button', { class: 'in-link', type: 'button', text: s.key === 'navigation' ? 'לתובנות הניווט' : 'למסך התחום', onclick: function () { go(s.go); } })); });
      body.append(h('p', { class: 'muted', text: 'כל הערכים הם סיכומים קבוצתיים שהשרת מחשב ומסנן. אין ציון אישי, דירוג או חיזוי.' }));
    }
    function load() { body.replaceChildren(skeleton(3)); inCourseLoad().then(function (m) { model = m; paint(); }, function (e) { body.replaceChildren(errBox({ message: String(e && e.message || e) }, load)); }); }
    load();
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
        if (sc.length >= 2) { var W = 320, H = 90, x0 = 26, xs = function (i) { return W - 20 - i * ((W - 50) / (sc.length - 1)); }, lo = Math.max(0, Math.floor(Math.min.apply(null, sc.map(function (x) { return x.final_score; })) / 10) * 10 - 10), hi = Math.min(100, Math.ceil(Math.max.apply(null, sc.map(function (x) { return x.final_score; })) / 10) * 10 + 10), ys = function (v) { return 70 - 52 * (v - lo) / (hi - lo || 1); }, sp = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'in-svg', role: 'img', 'aria-label': 'סדרת ציוני ניווט ' + g.name + ' (הישן מימין): ' + sc.map(function (x) { return inDate(x.test_date) + ' ' + inFmt(x.final_score); }).join('; ') });
          sp.append(sv('line', { x1: x0, x2: W - 10, y1: 76, y2: 76, class: 'in-axis' }), sv('polyline', { points: sc.map(function (x, i) { return xs(i) + ',' + ys(x.final_score); }).join(' '), class: 'in-line', fill: 'none' })); sc.forEach(function (x, i) { var pt = sv('circle', { cx: xs(i), cy: ys(x.final_score), r: 5, class: 'in-pt' + (i === sc.length - 1 ? ' on' : ''), tabindex: 0, role: 'link', 'aria-label': inDate(x.test_date) + ': ' + inFmt(x.final_score) + '. מעבר לרשומות הניווט' }); pt.addEventListener('click', function () { go('d/nav'); }); pt.addEventListener('keydown', function (e) { if (e.key === 'Enter') go('d/nav'); }); sp.append(pt, stext(xs(i), ys(x.final_score) - 8, inFmt(x.final_score), { class: 'in-t in-tv' }), stext(xs(i), 88, inDate(x.test_date).slice(0, 5))); }); box.append(h('div', { class: 'in-fig', id: 'progChart' }, [h('div', { class: 'in-svgwrap' }, [sp])])); }
        box.append(h('details', { class: 'in-det', id: 'progAll' }, [h('summary', { text: 'כל המדידות (' + l.length + ')' }), h('table', { class: 'in-table' }, [h('thead', {}, [h('tr', {}, ['תאריך', 'ציון', 'שינוי', 'תכנון', 'תחקיר'].map(function (x) { return h('th', { scope: 'col', text: x }); }))]), h('tbody', {}, l.slice().reverse().map(function (x) { var i = sc.indexOf(x), pv = i > 0 ? sc[i - 1] : null; return h('tr', {}, [h('td', { text: inDate(x.test_date) }), h('td', { text: inFmt(x.final_score) }), h('td', { text: pv ? inSign(x.final_score - pv.final_score) : '—' }), h('td', { text: inFmt(x.plan_score) }), h('td', { text: inFmt(x.debrief_score) })]); }))])]));
      });
      [['כש״ג', 'כושר גופני'], ['מבחנים עיוניים', ''], ['קליעה', ''], ['נוכחות ומסעות', '']].forEach(function (t) { var b = card(t[0], 'סדרת זמן: חסום — טרם נבנה (שלב הבא)', h('span', { class: 'badge', text: 'חסום' }), null); b.classList.add('off'); b.setAttribute('aria-disabled', 'true'); box.append(b); });
      box.append(h('p', { class: 'muted', id: 'progStamp', text: 'נקרא מהשרת ' + new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + ' · מקור: nav.list של החניך (בהיקף ההרשאה)' }), h('p', { class: 'muted', text: 'תיאור עובדתי בלבד — אין ציון אישי מחושב, דירוג או חיזוי.' }));
    });
  }
  window.__insight = { courseModel: inCourseModel, coursePdf: inCoursePdf, courseXlsx: inCourseXlsx, build: inBuildModel, pdf: inNavPdf, xlsx: inNavXlsx, load: inLoad, min: IN_MIN_N, model: null };
