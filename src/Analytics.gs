/**
 * Analytics — LOCAL, EXPLAINABLE course/group-level insights and the data model of the analytic report — product-dev6.2.
 *
 * Boundaries (owner direction, final brief §11.3 — read before changing anything here):
 *  - NO external model, NO network call, NO new scope. Everything is computed from the caller's own Snapshot rows (visibility + cancelled/inactive rules applied ONCE, in Snapshot),
 *    so a commander only ever gets figures for his own scope. The assistant stays rule-based; nothing here is presented as a language model.
 *  - Aggregate insights only. NO individual classification, ranking, risk label, suitability/leadership/medical inference, pass/fail or recommendation about a person.
 *    GROUP ONLY (D6): the analytic report and analytics outputs carry NO per-soldier element — no achievements table, no scatter points, no radar profile, no names / ids / personal measures.
 *  - Every insight carries: time window, N, source tables, formula/baseline, generated_at (freshness), caveat and the reason it was produced. Too little data => suppressed with an explicit reason.
 *  - Correlation is never stated as causation; no thresholds, colours-of-status or "good/bad" labels are invented (levels come only from Settings elsewhere).
 *  - The emergency contact, private (מ״פ) data and personal details are NOT read here.
 *  - Privacy threshold — APPROVED owner decision D2 (docs/DECISIONS_RECORD_uxqa1.md): MIN_GROUP = 5 soldiers. Below it NOTHING is produced for the scope (no insight, comparison, count, name, title or metadata), and one hidden group never
 *    becomes derivable from totals (complementary suppression). On top of that there are LOGICAL minimums (a change/trend needs >= 2 periods; a monthly point needs >= MIN_GROUP soldiers).
 *  - Soldiers with active=false are excluded from every current figure (approved decision D4); no model, network call or third-party service is used (approved decision D5).
 */
const Analytics = {
  /** Owner decision (D2): NO group-level insight, comparison or figure for a group of fewer than 5 soldiers — not even through totals, titles, tooltips, metadata or complements. */
  MIN_GROUP: 5,
  smallReason_() { return 'קבוצה קטנה מ-' + Analytics.MIN_GROUP + ' חיילים — לא מוצגים נתונים, תובנות או השוואות קבוצתיות.'; },
  /** Complementary suppression: when exactly one group is hidden but totals are visible, hide the smallest visible group too (else hidden = total − shown). @param {Array} groups [{n, ...}] with n = soldiers @return {Array} shown groups */
  /** Owner decision D2 for the per-soldier summary routes: with a soldierId the answer is that soldier's own recorded result (unchanged); WITHOUT one the route aggregates the whole caller scope,
   *  which is group data — suppressed when the scope (after the same department/team filters) holds fewer than MIN_GROUP current soldiers. The permission guard runs first, so the refusal for an unauthorised caller is unchanged. */
  scopeGate_(ctx, a, fn) {
    if (Util.str(a.soldierId)) return fn();
    Records.guardCourse_(ctx, 'result.read', a.courseId);
    const o = a.opts || {}, n = Snapshot.soldiers(ctx, a.courseId, { departmentId: Util.str(o.departmentId) || undefined, teamId: Util.str(o.teamId) || undefined }).length;
    return n < Analytics.MIN_GROUP ? { suppressed: true, small_group: true, reason: Analytics.smallReason_() } : fn();
  },
  shownGroups_(groups, hiddenCount) {
    let shown = groups.filter(function (g) { return g.n >= Analytics.MIN_GROUP; });
    if (hiddenCount === 1 && shown.length) { const min = Math.min.apply(null, shown.map(function (g) { return g.n; })); let dropped = false; shown = shown.filter(function (g) { if (!dropped && g.n === min) { dropped = true; return false; } return true; }); }
    return shown;
  },
  // ---------------- D2 sub-cohort rule (REV3): a figure is never backed by 1-4 distinct soldiers ----------------
  /** Binary split of soldiers (have / missing, present / absent, scored / unscored...): shown only if EACH side is 0 or >= MIN_GROUP. Either side 1-4 => hide BOTH counts (never the complement). Distinct soldiers, never result rows. */
  splitOk_(a, b) { const ok = function (x) { return x === 0 || x >= Analytics.MIN_GROUP; }; return ok(a) && ok(b); },
  /** Multi-way split (e.g. readiness statuses): every part must be 0 or >= MIN_GROUP, otherwise ALL parts are hidden (a hidden part would be total minus the others). */
  catOk_(counts) { return counts.every(function (x) { return x === 0 || x >= Analytics.MIN_GROUP; }); },
  /** Generic reason: names neither the small side nor its size. */
  cohortReason_() { return 'נתון מדוכא מטעמי פרטיות: מספר החיילים שמאחורי הנתון קטן מדי להצגה.'; },
  /** Number of DISTINCT soldiers in rows (optionally only rows matching pred). */
  distinct_(rows, pred) { const s = Object.create(null); rows.forEach(function (r) { if (!pred || pred(r)) s[r.soldier_id] = true; }); return Object.keys(s).length; },
  /** Have/missing coverage of `total` soldiers. @return {with_data, missing} or {suppressed:true, reason, with_data:null, missing:null} */
  coverage_(have, total) { return Analytics.splitOk_(have, total - have) ? { with_data: have, missing: total - have } : { suppressed: true, reason: Analytics.cohortReason_(), with_data: null, missing: null }; },
  /**
   * Group attendance / march participation from Snapshot rows (present flag). Cohorts are DISTINCT soldiers: ever absent vs never absent, ever present vs never present (and, for attendance, early exit vs none).
   * If either binary split has a side of 1-4 soldiers the whole figure (percent, present, absent, total, early exits) is suppressed with a generic reason; early exits alone are dropped when only that split is small.
   * @return {ok:boolean, present, absent, total, percent, percent_display, early_exits, early_exits_suppressed, suppressed?, reason?, note}
   */
  presenceGroup_(rows, withEarly, N) {
    const W = Analytics.distinct_(rows), A = Analytics.distinct_(rows, function (r) { return !Util.isTrue(r.present); }), P = Analytics.distinct_(rows, function (r) { return Util.isTrue(r.present); });
    if (!rows.length) return { ok: true, present: 0, absent: 0, total: 0, percent: null, percent_display: null, early_exits: 0, early_exits_suppressed: false, note: 'אין מספיק נתונים' };
    if (!(Analytics.splitOk_(A, W - A) && Analytics.splitOk_(P, W - P)) || (N !== undefined && !Analytics.splitOk_(W, N - W))) return { ok: false, suppressed: true, reason: Analytics.cohortReason_(), present: null, absent: null, total: null, percent: null, percent_display: null, early_exits: null, early_exits_suppressed: true, note: Analytics.cohortReason_() };
    const a = Attendance.aggregate_(rows);
    let ee = a.early_exits, eeSup = false;
    if (withEarly) { const E = Analytics.distinct_(rows, function (r) { return Util.isTrue(r.early_exit); }); if (!Analytics.splitOk_(E, W - E)) { ee = null; eeSup = true; } }
    return { ok: true, present: a.present, absent: a.absent, total: a.total, percent: a.percent, percent_display: a.percent_display, early_exits: withEarly ? ee : null, early_exits_suppressed: eeSup, note: '' };
  },
  /** Group score availability for one score field: distinct soldiers with rows (R) vs with a score (S). Hidden unless S and R-S are each 0 or >= MIN_GROUP. */
  scoreOk_(rows, field) { const R = Analytics.distinct_(rows), S = Analytics.distinct_(rows, function (r) { return Calc.hasScore(r[field]); }); return Analytics.splitOk_(S, R - S); },
  // ---------------- group-level wrappers (NO soldierId). Per-soldier calls keep using the modules' own aggregate_ unchanged. ----------------
  /** Group fitness: hidden unless scored / unscored soldiers are each 0 or >= MIN; components likewise; `last/previous/progress` are one soldier's results, so they are never part of a group figure. */
  groupFitness_(rows, N) {
    const agg = Fitness.aggregate_(rows), why = Analytics.cohortReason_();
    if (!Analytics.scoreOk_(rows, 'weighted_score')) return { count: null, complete_count: null, mean: null, mean_display: null, last: null, previous: null, progress: null, by_component: {}, suppressed: true, reason: why, note: why };
    const R = Analytics.distinct_(rows), cov = N === undefined || Analytics.splitOk_(R, N - R);   // result-row counts could reveal the with / without split of the scope (one result per soldier) => hidden unless that split is itself shown
    Object.keys(agg.by_component).forEach(function (c) {
      const cs = Analytics.distinct_(rows, function (r) { const x = Util.parseJson(r.component_scores_json, {})[c]; return !!x && x.score !== null && x.score !== undefined; });
      if (!Analytics.splitOk_(cs, R - cs)) agg.by_component[c] = { label: agg.by_component[c].label, count: null, mean: null, mean_display: null, suppressed: true };
      else if (!cov) agg.by_component[c].count = null;
    });
    if (!cov) { agg.count = null; agg.complete_count = null; }
    agg.last = null; agg.previous = null; agg.progress = null;
    return agg;
  },
  groupMarksmanship_(rows, N) {
    const agg = Marksmanship.aggregate_(rows), why = Analytics.cohortReason_(), R = Analytics.distinct_(rows), cov = N === undefined || Analytics.splitOk_(R, N - R), okR = Analytics.scoreOk_(rows, 'examiner_score'), okY = Analytics.scoreOk_(rows, 'ylm_score');
    const sup = function () { return { count: null, mean: null, mean_display: null, suppressed: true }; };
    const out = { count: okR && okY && cov ? agg.count : null, regular: okR ? { count: cov ? agg.regular.count : null, mean: agg.regular.mean, mean_display: agg.regular.mean_display, last: null } : Object.assign(sup(), { last: null }), ylm: okY ? { count: cov ? agg.ylm.count : null, mean: agg.ylm.mean, mean_display: agg.ylm.mean_display } : sup(), zeroed_last: null, note: agg.note };
    if (!okR || !okY) { out.suppressed = true; out.reason = why; if (!okR && !okY) out.note = why; }
    return out;
  },
  groupNavigation_(rows, N) {
    const agg = Navigation.aggregate_(rows), why = Analytics.cohortReason_();
    if (!Analytics.scoreOk_(rows, 'final_score')) return { count: null, mean: null, mean_display: null, by_type: [], suppressed: true, reason: why, note: why };
    let hid = false;
    agg.by_type = agg.by_type.map(function (t) {
      const ts = Analytics.distinct_(rows, function (r) { return r.navigation_type_id === t.type_id && Calc.hasScore(r.final_score); });
      if (ts === 0 || ts >= Analytics.MIN_GROUP) return t;
      hid = true; return { type_id: t.type_id, type_name: t.type_name, count: null, mean: null, mean_display: null, suppressed: true };
    });
    const R = Analytics.distinct_(rows);
    if (N !== undefined && !Analytics.splitOk_(R, N - R)) { agg.count = null; agg.by_type = agg.by_type.map(function (t) { return t.suppressed ? t : Object.assign({}, t, { count: null }); }); }
    if (hid) agg.count = null;   // complementary: with a type hidden the overall result count would reveal it
    return agg;
  },
  groupExams_(courseId, rows, meetings, N) {
    const agg = Exams.aggregate_(courseId, rows, meetings), why = Analytics.cohortReason_();
    agg.exams = agg.exams.map(function (e) {
      if (!Analytics.catOk_([e.passed, e.failed, e.pending]) || (N !== undefined && !Analytics.splitOk_(e.statuses.length, N - e.statuses.length))) return { exam_id: e.exam_id, exam_name: e.exam_name, soldiers: null, passed: null, failed: null, pending: null, pass_rate: null, pass_rate_display: null, mean_effective: null, mean_display: null, statuses: [], suppressed: true, reason: why };
      const sc = e.statuses.filter(function (x) { return Calc.hasScore(x.effective_score); }).length, okS = Analytics.splitOk_(sc, e.statuses.length - sc);
      return { exam_id: e.exam_id, exam_name: e.exam_name, soldiers: e.soldiers, passed: e.passed, failed: e.failed, pending: e.pending, pass_rate: e.pass_rate, pass_rate_display: e.pass_rate_display, mean_effective: okS ? e.mean_effective : null, mean_display: okS ? e.mean_display : null, statuses: [] };   // statuses = one entry per soldier: never part of a group figure
    });
    const req = meetings.filter(function (m) { return Util.isTrue(m.required); }), T = Analytics.distinct_(req), O = Analytics.distinct_(req, function (m) { return !Util.isTrue(m.done); });
    if (!Analytics.splitOk_(O, T - O)) agg.meetings_open = null;
    return agg;
  },
  groupQualifications_(courseId, rows, quals, N) {
    const why = Analytics.cohortReason_();
    return Qualifications.aggregate_(courseId, rows, quals).map(function (q) {
      if (Analytics.catOk_([q.completed, q.in_progress, q.pending, q.excluded, q.assigned - q.completed - q.in_progress - q.pending]) && (N === undefined || Analytics.splitOk_(q.assigned + q.excluded, N - q.assigned - q.excluded))) return q;
      return { qualification_id: q.qualification_id, name: q.name, assigned: null, completed: null, in_progress: null, pending: null, excluded: null, completion_percent: null, suppressed: true, reason: why };
    });
  },
  groupAttendance_(rows, N) {
    const p = Analytics.presenceGroup_(rows, true, N);
    return { present: p.present, absent: p.absent, total: p.total, percent: p.percent, percent_display: p.percent_display, early_exits: p.early_exits, early_exits_suppressed: p.early_exits_suppressed, note: p.note, suppressed: p.ok ? undefined : true, reason: p.ok ? undefined : p.reason };
  },
  groupMarches_(rows, N) {
    const p = Analytics.presenceGroup_(rows, false, N);
    if (!p.ok) return { marches_attended: null, marches_absent: null, marches_total: null, km_no_stretcher: null, km_stretcher: null, total_km: null, suppressed: true, reason: p.reason, note: p.reason };
    return Marches.aggregate_(rows);
  },
  DOMAINS: [
    { key: 'fitness', label: 'כש״ג', table: 'FitnessTests', field: 'weighted_score', date: 'test_date' },
    { key: 'navigation', label: 'ניווט', table: 'NavigationTests', field: 'final_score', date: 'test_date' },
    { key: 'marksmanship', label: 'קליעה', table: 'MarksmanshipTests', field: 'examiner_score', date: 'test_date' },
    { key: 'exams', label: 'מבחנים עיוניים', table: 'TheoreticalExamAttempts', field: 'score', date: 'attempt_date' }
  ],

  // ---------------- pure helpers ----------------
  r1_(x) { return x === null || x === undefined ? null : Math.round(x * 10) / 10; },
  vals_(rows, field) { const out = []; rows.forEach(function (r) { const v = Calc.validNumber(r[field]); if (v !== null) out.push(v); }); return out; },
  mean_(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; },
  quantile_(sorted, q) { if (!sorted.length) return null; const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos); return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo); },
  /** Mean of each soldier's recorded values (same definition as Dashboard.groups "by soldier"). @return {soldierId: mean} */
  perSoldier_(rows, field) {
    const m = Object.create(null); rows.forEach(function (r) { const v = Calc.validNumber(r[field]); if (v !== null) (m[r.soldier_id] = m[r.soldier_id] || []).push(v); });
    const out = Object.create(null); Object.keys(m).forEach(function (k) { out[k] = Analytics.mean_(m[k]); }); return out;
  },
  /** Calendar-month series of a domain: [{period:'YYYY-MM', n, mean}] ascending. By results (every recorded value counts once). */
  monthly_(rows, field, dateCol, N) {
    const g = Object.create(null), who = Object.create(null); rows.forEach(function (r) { const v = Calc.validNumber(r[field]), d = Util.cellToIsoDate(r._parent ? r._parent[dateCol] : r[dateCol]); if (v === null || !d) return; const p = d.slice(0, 7); (g[p] = g[p] || []).push(v); (who[p] = who[p] || Object.create(null))[r.soldier_id] = true; });
    return Object.keys(g).sort().filter(function (p) { const w = Object.keys(who[p]).length; return w >= Analytics.MIN_GROUP && (N === undefined || Analytics.splitOk_(w, N - w)); }).map(function (p) { return { period: p, n: g[p].length, soldiers: Object.keys(who[p]).length, mean: Analytics.r1_(Analytics.mean_(g[p])) }; });
    // D2 sub-cohort (REV4): a month point exists only if its soldiers-with-a-value / soldiers-without split of the scope is legal (each side 0 or >= MIN_GROUP). Otherwise the WHOLE point (n, mean, soldiers) is absent,
    // so neither the result count, the mean, a month-to-month change nor a trend can reveal the size of a 1-4 soldier cohort. (`N` = active soldiers of the caller's scope after the same filters; without N the caller is unsafe and must pass it.)
  },
  window_(rows, dateCol) {
    const ds = rows.map(function (r) { return Util.cellToIsoDate(r._parent ? r._parent[dateCol] : r[dateCol]); }).filter(Boolean).sort();
    return ds.length ? { from: ds[0], to: ds[ds.length - 1] } : { from: null, to: null };
  },
  item_(o) {
    return Object.assign({ id: '', kind: '', title: '', text: '', n: 0, window: { from: null, to: null }, source: [], formula: '', generated_at: '', caveat: '', reason: '', question: '' }, o);
  },

  // ---------------- insights (dashboard panel) ----------------
  /** @return {generated_at, scope, items:[insight], suppressed:[{id,reason}], notice} — course/group level only. f: {departmentId, teamId}. */
  insights(ctx, courseId, f) {
    f = f || {}; Records.guardCourse_(ctx, 'dashboard.view', courseId); ['departmentId', 'teamId'].forEach(function (k) { Soldiers.scalar_(f[k], k); });
    const flt = { departmentId: Util.str(f.departmentId) || undefined, teamId: Util.str(f.teamId) || undefined, onlyActive: true }, now = Util.nowIso(), items = [], suppressed = [];
    const soldiers = Snapshot.soldiers(ctx, courseId, flt), N = soldiers.length;
    if (N < Analytics.MIN_GROUP) return { generated_at: now, small_group: true, scope: { soldiers: null, department_id: '', team_id: '' }, items: [], suppressed: [{ id: 'all', reason: Analytics.smallReason_() }], notice: Analytics.smallReason_() };
    const rowsOf = {}; Analytics.DOMAINS.forEach(function (d) { rowsOf[d.key] = Snapshot.rows(ctx, d.table, courseId, flt); });
    const attRows = Snapshot.rows(ctx, 'AttendanceRecords', courseId, flt);
    const base = { generated_at: now };

    // 1. trend per domain (needs >= 2 calendar months)
    Analytics.DOMAINS.forEach(function (d) {
      const rows = rowsOf[d.key], ser = Analytics.monthly_(rows, d.field, d.date, N);
      if (ser.length < 2) { suppressed.push({ id: 'trend_' + d.key, reason: ser.length ? 'נתוני ' + d.label + ' קיימים בחודש אחד בלבד — אין מספיק נתונים למגמה.' : 'אין נתוני ' + d.label + '.' }); return; }
      const a = ser[ser.length - 2], b = ser[ser.length - 1], diff = Analytics.r1_(b.mean - a.mean);
      items.push(Analytics.item_(Object.assign({ id: 'trend_' + d.key, kind: 'trend', title: 'מגמת ממוצע ' + d.label, n: a.n + b.n, window: { from: a.period, to: b.period }, source: [d.table],
        text: 'ממוצע ' + d.label + ' בחודש ' + b.period + ' הוא ' + b.mean + ' לעומת ' + a.mean + ' בחודש ' + a.period + ' (' + (diff > 0 ? '+' : '') + diff + ').',
        formula: 'ממוצע התוצאות שנרשמו בכל חודש קלנדרי (כל תוצאה נספרת פעם אחת); ההפרש = ממוצע החודש האחרון פחות ממוצע החודש הקודם לו.',
        caveat: 'אוכלוסיית הנבחנים והמדידות עשויה להשתנות בין החודשים (אין התאמה אישית); ההפרש אינו מסביר סיבה. N = ' + a.n + ' + ' + b.n + ' תוצאות.',
        reason: 'קיימים נתונים בלפחות שני חודשים עוקבים.', question: 'האם יש מקום לבדוק אם ההרכב או התנאים בשני המועדים היו דומים?' }, base)));
    });

    // 2. gap between configured groups (department) — only groups with >= MIN_GROUP soldiers AND >= MIN_GROUP soldiers having a fitness value; complementary suppression
    try {
      const all = Dashboard.groupsRaw_(ctx, courseId, 'department', {}), eligible = all.filter(function (g) { return g.n_values.fitness >= Analytics.MIN_GROUP && Analytics.splitOk_(g.n_values.fitness, g.soldiers - g.n_values.fitness) && g.fitness.by_results !== null; }).map(function (g) { return { n: g.soldiers, g: g }; });
      const hidden = all.length - eligible.length, shown = Analytics.shownGroups_(eligible, hidden).map(function (x) { return x.g; });
      if (!flt.departmentId && !flt.teamId && shown.length >= 2) {
        const sorted = shown.slice().sort(function (x, y) { return y.fitness.by_results - x.fitness.by_results; }), hi = sorted[0], lo = sorted[sorted.length - 1], gap = Analytics.r1_(hi.fitness.by_results - lo.fitness.by_results);
        items.push(Analytics.item_(Object.assign({ id: 'group_gap_fitness', kind: 'group_gap', title: 'פער בין מחלקות בכש״ג', n: hi.soldiers + lo.soldiers, source: ['FitnessTests', 'Soldiers'], window: Analytics.window_(rowsOf.fitness, 'test_date'),
          text: 'ממוצע כש״ג — ' + hi.name + ': ' + Analytics.r1_(hi.fitness.by_results) + ', ' + lo.name + ': ' + Analytics.r1_(lo.fitness.by_results) + '; פער ' + gap + '.',
          formula: 'ממוצע תוצאות כש״ג לפי מחלקה (שיטת "לפי תוצאות"); פער = הגבוה פחות הנמוך מבין המחלקות המוצגות. אין ספי עובר/נכשל. מחלקות עם פחות מ-' + Analytics.MIN_GROUP + ' חיילים אינן נכללות (וייתכן שמחלקה נוספת מושמטת כדי למנוע חישוב עקיף).',
          caveat: 'הפער תיאורי בלבד: אינו מציין סיבה ואינו שיפוט על המחלקות.', reason: 'לפחות שתי מחלקות בהיקף שלך עומדות בסף הפרטיות.',
          question: 'האם ההבדל בין המחלקות משקף הבדלי הרכב או תנאי מדידה?' }, base)));
      } else suppressed.push({ id: 'group_gap_fitness', reason: flt.departmentId || flt.teamId ? 'סינון לקבוצה אחת — אין השוואה בין קבוצות.' : 'פחות משתי מחלקות עומדות בסף ' + Analytics.MIN_GROUP + ' חיילים.' });
    } catch (e) { suppressed.push({ id: 'group_gap_fitness', reason: 'ההשוואה אינה זמינה בהיקף שלך.' }); }

    // 3. coverage: soldiers with no recorded value per domain. D2 sub-cohort rule: a domain is shown only if BOTH sides (with / without a result) are 0 or >= MIN_GROUP soldiers; otherwise it is replaced by one generic line
    //    (no counts, no domain name, no hint which side is small). A domain with 0 missing is simply not listed.
    if (N > 0) {
      const gaps = []; let anyHidden = false;
      Analytics.DOMAINS.forEach(function (d) {
        const have = Analytics.perSoldier_(rowsOf[d.key], d.field), haveN = Object.keys(have).filter(function (id) { return soldiers.some(function (s) { return s.id === id; }); }).length;
        if (!Analytics.splitOk_(haveN, N - haveN)) { anyHidden = true; return; }
        gaps.push({ d: d, missing: N - haveN });
      });
      const worst = gaps.filter(function (g) { return g.missing > 0; }).sort(function (a, b) { return b.missing - a.missing; });
      if (worst.length || anyHidden) items.push(Analytics.item_(Object.assign({ id: 'coverage', kind: 'coverage', title: 'פערי השלמה בנתונים', n: N, source: Analytics.DOMAINS.map(function (d) { return d.table; }).concat(['Soldiers']), window: { from: null, to: null },
        text: worst.map(function (g) { return g.d.label + ': ' + g.missing + ' מתוך ' + N + ' חיילים ללא תוצאה רשומה'; }).concat(anyHidden ? ['בתחומים נוספים הנתון מדוכא מטעמי פרטיות'] : []).join(' · ') + '.',
        formula: 'מספר החיילים בהיקף שלך (אותם כללי כלילות כמו בלוח המחוונים) פחות מספר החיילים שיש להם לפחות תוצאה אחת בתחום. חסר אינו נחשב 0. תחום מוצג רק אם מספר החיילים משני הצדדים (עם תוצאה / בלי) הוא 0 או לפחות ' + Analytics.MIN_GROUP + '; אחרת הוא מדוכא ללא ספירה משלימה.', caveat: 'אינו מעיד על ביצוע — ייתכן שהמדידה טרם נערכה.', reason: 'קיימים חיילים ללא תוצאות בתחום אחד לפחות.',
        question: 'האם יש מדידות שטרם בוצעו ומתוכננות להשלמה?' }, base)));
      else suppressed.push({ id: 'coverage', reason: 'לכל החיילים בהיקף יש תוצאה לפחות בכל התחומים.' });
    } else suppressed.push({ id: 'coverage', reason: 'אין חיילים בהיקף.' });

    // 4. attendance summary — D2 sub-cohort rule: suppressed (generic reason, no counts) when ever-absent / never-absent, ever-present / never-present has a side of 1-4 soldiers; early exits dropped alone when that cohort is small
    const att = Analytics.presenceGroup_(attRows, true, N);
    if (att.ok && att.total > 0) {
      const events = Object.create(null); attRows.forEach(function (r) { if (r._parent) events[r._parent.id] = true; });
      items.push(Analytics.item_(Object.assign({ id: 'attendance', kind: 'attendance', title: 'נוכחות מצטברת', n: att.total, window: Analytics.window_(attRows, 'event_date'), source: ['AttendanceEvents', 'AttendanceRecords'],
        text: 'אחוז נוכחות מצטבר ' + att.percent_display + '% (' + att.present + ' נוכחים מתוך ' + att.total + ' רישומים ב-' + Object.keys(events).length + ' אירועים' + (att.early_exits_suppressed ? '' : '; ' + att.early_exits + ' יציאות מוקדמות') + ').',
        formula: 'נוכחים ÷ סך הרישומים של חיילים פעילים באירועים פעילים. ברירת המחדל באירוע: כולם נוכחים; מסומנים רק החסרים.', caveat: 'אינו מבחין בין היעדרות מוצדקת ללא מוצדקת (לפי הכלל המאושר).', reason: 'קיימים אירועי נוכחות בהיקף שלך.' }, base)));
    } else suppressed.push({ id: 'attendance', reason: att.ok ? 'אין אירועי נוכחות בהיקף.' : Analytics.cohortReason_() });

    // 5. distribution of per-soldier fitness means (median + inter-quartile range)
    const per = Analytics.perSoldier_(rowsOf.fitness, 'weighted_score'), pv = Object.keys(per).map(function (k) { return per[k]; }).sort(function (a, b) { return a - b; });
    if (pv.length >= Analytics.MIN_GROUP) items.push(Analytics.item_(Object.assign({ id: 'distribution_fitness', kind: 'distribution', title: 'פיזור ציוני כש״ג', n: Analytics.splitOk_(pv.length, N - pv.length) ? pv.length : null, window: Analytics.window_(rowsOf.fitness, 'test_date'), source: ['FitnessTests'],
      text: 'חציון ממוצעי החיילים: ' + Analytics.r1_(Analytics.quantile_(pv, 0.5)) + '; טווח בין־רבעוני ' + Analytics.r1_(Analytics.quantile_(pv, 0.25)) + '–' + Analytics.r1_(Analytics.quantile_(pv, 0.75)) + '.',
      formula: 'לכל חייל: ממוצע תוצאות הכש״ג שלו; מהן חציון ורבעונים (אינטרפולציה לינארית). לא מוצגים מינימום ומקסימום (עשויים להיות ציון של חייל יחיד).', caveat: 'תיאור סטטיסטי בלבד; אינו סיווג חיילים ואינו מגדיר "חלש" או "חזק".', reason: 'לפחות ' + Analytics.MIN_GROUP + ' חיילים עם תוצאת כש״ג.' }, base)));
    else suppressed.push({ id: 'distribution_fitness', reason: 'פחות מ-' + Analytics.MIN_GROUP + ' חיילים עם תוצאת כש״ג — מספר קטן מכדי לתאר פיזור.' });

    return { generated_at: now, scope: { soldiers: N, department_id: flt.departmentId || '', team_id: flt.teamId || '' }, items: items, suppressed: suppressed,
      notice: 'תובנות סטטיסטיות מקומיות ברמת קורס/קבוצה, מחושבות מהנתונים המורשים בלבד. אינן מודל שפה, אינן שיפוט על חיילים ואינן החלטה — שאלות הבדיקה אינן מחייבות.' };
  },

  // ---------------- report data model ----------------
  /**
   * Data of the analytic report. Only recorded measures; no composite score, no ranking, no invented thresholds. Owner decisions: active=false soldiers are excluded (D4);
   * a scope of fewer than 5 soldiers produces NO data at all (D2); every group chart/table needs >= 5 soldiers behind each shown figure, with complementary suppression.
   */
  reportData(ctx, courseId, f) {
    f = f || {}; Records.guardCourse_(ctx, 'dashboard.view', courseId); ['departmentId', 'teamId', 'from', 'to'].forEach(function (k) { Soldiers.scalar_(f[k], k); });
    const flt = { departmentId: f.departmentId || undefined, teamId: f.teamId || undefined, from: f.from || undefined, to: f.to || undefined, onlyActive: true }, now = Util.nowIso(), MIN = Analytics.MIN_GROUP;
    const soldiers = Snapshot.soldiers(ctx, courseId, flt).slice().sort(function (a, b) { return String(a.full_name).localeCompare(String(b.full_name), 'he'); }), N = soldiers.length;
    const filters = { departmentId: flt.departmentId || '', teamId: flt.teamId || '', from: flt.from || '', to: flt.to || '' };
    if (N < MIN) return { generated_at: now, small_group: true, reason: Analytics.smallReason_(), soldiers: null, filters: filters, kpis: [], summary: [], insights: [], suppressed: [{ id: 'all', reason: Analytics.smallReason_() }], achievements: [], bars: [], scatter: { available: false, reason: Analytics.smallReason_(), points: [] }, radar: [], trends: [], completeness: [], definitions: [] };
    const org = Courses.org(ctx, courseId), dn = {}; org.departments.forEach(function (d) { dn[d.id] = d.name; });
    const rowsOf = {}; Analytics.DOMAINS.forEach(function (d) { rowsOf[d.key] = Snapshot.rows(ctx, d.table, courseId, flt); });
    const attRows = Snapshot.rows(ctx, 'AttendanceRecords', courseId, flt), marchRows = Snapshot.rows(ctx, 'MarchAttendance', courseId, flt);
    const per = {}; Analytics.DOMAINS.forEach(function (d) { per[d.key] = Analytics.perSoldier_(rowsOf[d.key], d.field); });
    const attBy = {}, marchBy = {}; attRows.forEach(function (r) { (attBy[r.soldier_id] = attBy[r.soldier_id] || []).push(r); }); marchRows.forEach(function (r) { (marchBy[r.soldier_id] = marchBy[r.soldier_id] || []).push(r); });
    const pct = function (rs) { return rs && rs.length ? Analytics.r1_(100 * rs.filter(function (r) { return Util.isTrue(r.present); }).length / rs.length) : null; };

    // internal per-soldier means (NEVER returned; used only for aggregates)
    const rows = soldiers.map(function (s, i) {
      return { id: s.id, department: dn[s.department_id] || '', fitness: Analytics.r1_(per.fitness[s.id]), navigation: Analytics.r1_(per.navigation[s.id]), marksmanship: Analytics.r1_(per.marksmanship[s.id]),
        exams: Analytics.r1_(per.exams[s.id]), attendance: pct(attBy[s.id]), marches: pct(marchBy[s.id]), absences: (attBy[s.id] || []).filter(function (r) { return !Util.isTrue(r.present); }).length, early_exits: (attBy[s.id] || []).filter(function (r) { return Util.isTrue(r.early_exit); }).length };
    });
    const dm = function (k) { const v = rows.map(function (r) { return r[k]; }).filter(function (x) { return x !== null; }); return v.length >= MIN ? { n: Analytics.splitOk_(v.length, N - v.length) ? v.length : null, mean: Analytics.r1_(Analytics.mean_(v)) } : { n: null, mean: null }; };
    const att = Analytics.presenceGroup_(attRows, true, N), attOk = att.ok && att.total > 0;
    const small = 'פחות מ-' + MIN + ' חיילים עם תוצאה — לא מוצג';
    const kpis = [
      { key: 'soldiers', label: 'חיילים בהיקף', value: N, n: N },
      { key: 'fitness', label: 'ממוצע כש״ג', value: dm('fitness').mean, n: dm('fitness').n, note: dm('fitness').mean === null ? small : (dm('fitness').n === null ? 'ממוצע ממוצעי החיילים · מספר החיילים מדוכא מטעמי פרטיות' : 'ממוצע ממוצעי החיילים') },
      { key: 'navigation', label: 'ממוצע ניווטים', value: dm('navigation').mean, n: dm('navigation').n, note: dm('navigation').mean === null ? small : (dm('navigation').n === null ? 'ממוצע ממוצעי החיילים · מספר החיילים מדוכא מטעמי פרטיות' : 'ממוצע ממוצעי החיילים') },
      { key: 'marksmanship', label: 'ממוצע קליעה', value: dm('marksmanship').mean, n: dm('marksmanship').n, note: dm('marksmanship').mean === null ? small : (dm('marksmanship').n === null ? 'ממוצע ממוצעי החיילים · מספר החיילים מדוכא מטעמי פרטיות' : 'ממוצע ממוצעי החיילים') },
      { key: 'attendance', label: 'נוכחות מצטברת', value: attOk ? att.percent_display + '%' : null, n: attOk ? att.total : null, note: attOk ? att.present + ' מתוך ' + att.total + ' רישומים' : (att.ok ? small : Analytics.cohortReason_()), suppressed: att.ok ? undefined : true }
    ];

    // bars: per department mean by domain (by soldier) — a department is shown only with >= MIN soldiers in scope AND >= MIN soldiers having a value; one hidden => the smallest shown is hidden too
    const depOf = Object.create(null), depSize = Object.create(null); soldiers.forEach(function (s) { depOf[s.id] = s.department_id || ''; if (s.department_id) depSize[s.department_id] = (depSize[s.department_id] || 0) + 1; });
    const bars = []; [['fitness', 'כש״ג'], ['navigation', 'ניווט'], ['marksmanship', 'קליעה']].forEach(function (p) {
      const all = Object.keys(depSize).map(function (did) { const v = rows.filter(function (r) { return depOf[r.id] === did && r[p[0]] !== null; }).map(function (r) { return r[p[0]]; }); return { n: Math.min(depSize[did], v.length), label: dn[did] || '', value: Analytics.r1_(Analytics.mean_(v)), nv: v.length, dsize: depSize[did] }; });
      const elig = all.filter(function (x) { return x.nv >= MIN && Analytics.splitOk_(x.nv, x.dsize - x.nv); }), hidden = all.length - elig.length, items = Analytics.shownGroups_(elig, hidden).map(function (x) { return { label: x.label, value: x.value, n: x.nv }; }).slice(0, 12);
      bars.push({ key: p[0], title: 'ממוצע ' + p[1] + ' לפי מחלקה', available: items.length >= 1, reason: items.length ? '' : 'אין מחלקה עם לפחות ' + MIN + ' חיילים בעלי תוצאת ' + p[1] + ' — אין מספיק נתונים.', hidden_note: all.length > items.length ? 'מחלקות קטנות מ-' + MIN + ' חיילים אינן מוצגות.' : '', items: items });
    });

    // GROUP ONLY (owner requirement, D5 final privacy fix): the analytic report carries NO per-soldier element. Scatter points, radar profiles and the achievements table are intentionally empty;
    // the individual per-soldier values exist only inside this function (as `rows`) to build department/course aggregates under the N>=MIN rule and are never returned.
    const GROUP_ONLY = 'דוח קבוצתי בלבד — לא מוצגים נתונים אישיים (טבלת הישגים, נקודות פיזור ופרופילי רדאר הוסרו)';
    const scatter = { available: false, group_only: true, reason: GROUP_ONLY, x: 'ממוצע ניווט', y: 'ממוצע כש״ג', n: null, points: [] };
    const radar = [];

    // trends: monthly means (by results) per domain, plus attendance % per month — a month point needs >= MIN soldiers
    const trends = Analytics.DOMAINS.slice(0, 3).map(function (d) { const ser = Analytics.monthly_(rowsOf[d.key], d.field, d.date, N); return { key: d.key, label: d.label, available: ser.length >= 2, reason: ser.length >= 2 ? '' : 'נתונים בחודש אחד בלבד, או פחות מ-' + MIN + ' חיילים בחודש — אין מגמה.', points: ser }; });
    const am = Object.create(null), amw = Object.create(null); attRows.forEach(function (r) { const d = r._parent && Util.cellToIsoDate(r._parent.event_date); if (!d) return; const p = d.slice(0, 7); (am[p] = am[p] || []).push(r); (amw[p] = amw[p] || Object.create(null))[r.soldier_id] = true; });
    const aser = Object.keys(am).sort().filter(function (p) { return Object.keys(amw[p]).length >= MIN && Analytics.presenceGroup_(am[p], false, N).ok; }).map(function (p) { const w = Object.keys(amw[p]).length; return { period: p, n: am[p].length, soldiers: Analytics.splitOk_(w, N - w) ? w : null, mean: pct(am[p]) }; });
    trends.push({ key: 'attendance', label: 'נוכחות %', available: aser.length >= 2, reason: aser.length >= 2 ? '' : 'אירועי נוכחות בחודש אחד בלבד, או פחות מ-' + MIN + ' חיילים בחודש — אין מגמה.', points: aser });

    const completeness = [['כש״ג', 'fitness'], ['ניווט', 'navigation'], ['קליעה', 'marksmanship'], ['מבחנים', 'exams']].map(function (p) { const have = rows.filter(function (r) { return r[p[1]] !== null; }).length, c = Analytics.coverage_(have, N); return c.suppressed ? { label: p[0], have: null, total: null, missing: null, suppressed: true, reason: c.reason } : { label: p[0], have: c.with_data, total: N, missing: c.missing }; });
    const ins = Analytics.insights(ctx, courseId, { departmentId: flt.departmentId, teamId: flt.teamId });
    return { generated_at: now, soldiers: N, filters: filters, kpis: kpis, summary: ins.items.map(function (i) { return i.text; }), insights: ins.items, suppressed: ins.suppressed, achievements: [], bars: bars, scatter: scatter, radar: radar, trends: trends, completeness: completeness,
      definitions: ['ממוצע חייל = ממוצע התוצאות שנרשמו לו בתחום; ממוצע קורס/מחלקה = ממוצע ממוצעי החיילים.', 'חסר אינו נחשב 0: חייל ללא תוצאה בתחום אינו נכלל בממוצע התחום.', 'חיילים שאינם פעילים אינם נכללים בדוח. קבוצות וממוצעים של פחות מ-' + MIN + ' חיילים אינם מוצגים.', 'אין ציון מרוכב, אין דירוג ואין ספי עובר/נכשל — לא הוגדרו מדיניות מקצועית.', 'הנתונים מוצגים בהתאם להרשאות המשתמש ולהיקף האחריות שלו.'] };
  }
};
