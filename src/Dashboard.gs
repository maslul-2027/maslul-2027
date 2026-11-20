/**
 * Dashboard — course overview, cross-course home, group comparison, course comparison, trends, data completeness, strengths/gaps, health index — v1.0.0.
 * Every figure is taken from the modules' Snapshot-based summaries, so the caller's visibility (commander assignments), cancelled soldiers and inactive soldiers are applied ONCE, in Snapshot.
 * A commander therefore sees figures for his own scope only. "Missing data" is null / "אין מספיק נתונים" — never 0.
 * Colour levels, "strength/gap" labels and the health index exist ONLY when the admin configured the thresholds/weights (Settings) — nothing is guessed.
 */
const Dashboard = {
  domainValues_(o) {
    return { fitness: o.fitness.mean, marksmanship: o.marksmanship.regular.mean, navigation: o.navigation.mean,
      exams: o.exams.exams.length ? Snapshot.mean_(o.exams.exams.map(function (e) { return { v: e.pass_rate }; }), 'v') : null,
      attendance: o.attendance.percent, qualifications: o.qualifications.length ? Snapshot.mean_(o.qualifications.map(function (q) { return { v: q.completion_percent }; }), 'v') : null,
      readiness: o.readiness.total && o.readiness.counts.fit !== null && o.readiness.counts.fit !== undefined ? 100 * o.readiness.counts.fit / o.readiness.total : null };
  },
  overview(ctx, courseId, f) {
    f = f || {}; Records.guardCourse_(ctx, 'dashboard.view', courseId);
    ['departmentId', 'teamId'].forEach(function (k) { Soldiers.scalar_(f[k], k); });
    const flt = { departmentId: Util.str(f.departmentId) || undefined, teamId: Util.str(f.teamId) || undefined, onlyActive: true }, today = Util.todayIso();   // owner decision D4: soldiers with active=false are not part of current figures
    const soldiers = Snapshot.soldiers(ctx, courseId, flt);
    // owner decision D2: no group figure for fewer than 5 soldiers — nothing about the group is computed or returned (no totals, counts, names, metadata)
    if (soldiers.length < Analytics.MIN_GROUP) return { suppressed: true, small_group: true, reason: Analytics.smallReason_() };
    const o = {
      soldiers: soldiers.length, active_soldiers: soldiers.filter(function (s) { return Util.isTrue(s.active); }).length,
      // D2 sub-cohort rule: every domain figure goes through Analytics.group*_ (cohort-gated, no per-soldier element, suppressed metrics carry { suppressed:true, reason } and null values)
      fitness: Analytics.groupFitness_(Snapshot.rows(ctx, 'FitnessTests', courseId, flt), soldiers.length),
      marksmanship: Analytics.groupMarksmanship_(Snapshot.rows(ctx, 'MarksmanshipTests', courseId, flt), soldiers.length),
      navigation: Analytics.groupNavigation_(Snapshot.navigationRows(ctx, courseId, flt), soldiers.length),
      exams: Analytics.groupExams_(courseId, Snapshot.rows(ctx, 'TheoreticalExamAttempts', courseId, flt), Snapshot.rows(ctx, 'ExamMeetings', courseId, flt), soldiers.length),
      attendance: Analytics.groupAttendance_(Snapshot.rows(ctx, 'AttendanceRecords', courseId, flt), soldiers.length),
      marches: Analytics.groupMarches_(Snapshot.rows(ctx, 'MarchAttendance', courseId, flt), soldiers.length),
      qualifications: Qualifications.summary(ctx, courseId, flt), readiness: Readiness.groupSummary_(ctx, courseId, flt),
      alerts: Alerts.counts(ctx, courseId) };
    o.levels = {}; const v = Dashboard.domainValues_(o);
    ['nav:navigation', 'fitness:fitness', 'exams:exams', 'attendance:attendance'].forEach(function (p) { const kv = p.split(':'); o.levels[kv[1]] = Settings.level(courseId, kv[0], v[kv[1]], today); });
    o.health = Dashboard.health_(courseId, v, today); o.completeness = Dashboard.completeness_(ctx, courseId, flt, soldiers);
    o.thresholds_configured = Settings.KEYS && Object.keys(o.levels).some(function (k) { return o.levels[k] !== null; });
    return o;
  },
  /** Health index = weighted mean of domain values, ONLY when weights are configured AND every weighted domain has data. Otherwise null + the reason. */
  health_(courseId, v, today) {
    const w = Settings.opt(courseId, 'health.weights', today); if (!w) return { index: null, reason: 'לא הוגדרו משקולות מדד (הגדרות)' };
    const missing = Object.keys(w).filter(function (d) { return w[d] > 0 && (v[d] === null || v[d] === undefined); });
    if (missing.length) return { index: null, reason: 'חסרים נתונים בתחומים: ' + missing.join(', '), missing_domains: missing };
    let sum = 0, tot = 0; Object.keys(w).forEach(function (d) { sum += w[d] * v[d]; tot += w[d]; });
    return { index: tot ? Math.round(sum / tot * 10) / 10 : null, reason: '', weights: w };
  },
  /** Completeness = how many of the visible soldiers have at least one record per domain (counts, never a percent of nothing). */
  completeness_(ctx, courseId, flt, soldiers) {
    // D2 sub-cohort rule: have / missing of N soldiers is shown only if EACH side is 0 or >= MIN_GROUP distinct soldiers; otherwise BOTH counts are replaced by { suppressed:true, reason } (never the complement).
    // Score availability (with / without a score) is gated the same way, against the soldiers that have data AND against the whole scope, so R - S cannot be derived either.
    const T = { fitness: 'FitnessTests', marksmanship: 'MarksmanshipTests', navigation: 'NavigationTests', exams: 'TheoreticalExamAttempts', readiness: 'ReadinessRecords', attendance: 'AttendanceRecords' }, out = { soldiers: soldiers.length }, N = soldiers.length;
    Object.keys(T).forEach(function (d) {
      const rows = Snapshot.rows(ctx, T[d], courseId, flt), R = Analytics.distinct_(rows), cov = Analytics.coverage_(R, N);
      out[d] = cov.suppressed ? { with_data: null, missing: null, suppressed: true, reason: cov.reason } : { with_data: cov.with_data, missing: cov.missing };
      const SC = { fitness: 'weighted_score', marksmanship: 'examiner_score', navigation: 'final_score' }[d];
      if (SC) {
        const S = Analytics.distinct_(rows, function (r) { return Calc.hasScore(r[SC]); });
        if (Analytics.splitOk_(S, N - S) && Analytics.splitOk_(S, R - S)) { out[d].with_score = S; out[d].missing_score = N - S; }
        else { out[d].with_score = null; out[d].missing_score = null; out[d].score_suppressed = true; out[d].score_reason = Analytics.cohortReason_(); }
      }
    });
    return out;
  },

  /** Cross-course home: one card per course in the caller's scope. Archived courses are listed separately and flagged. */
  home(ctx) {
    const list = Courses.list(ctx), cards = list.map(function (c) {
      const ov = Dashboard.overview(ctx, c.id, {});
      if (ov.suppressed) return { course_id: c.id, name: c.name, status: c.status, start_date: c.start_date, suppressed: true, reason: ov.reason, soldiers: null, readiness: null, alerts: null, fitness_mean: null, navigation_mean: null, attendance_percent: null, qualifications: [], health: null };
      return { course_id: c.id, name: c.name, status: c.status, start_date: c.start_date, soldiers: ov.soldiers, readiness: ov.readiness.counts, alerts: ov.alerts, fitness_mean: ov.fitness.mean_display, navigation_mean: ov.navigation.mean_display, attendance_percent: ov.attendance.percent_display,
        qualifications: ov.qualifications.map(function (q) { return { name: q.name, completion_percent: q.completion_percent }; }), health: ov.health };
    });
    return { courses: cards, totals: { courses: cards.length, soldiers: cards.reduce(function (a, c) { return a + (c.soldiers || 0); }, 0), open_alerts: cards.reduce(function (a, c) { return a + (c.alerts && c.alerts.open !== null && c.alerts.open !== undefined ? c.alerts.open : 0); }, 0), open_alerts_complete: cards.every(function (c) { return !c.alerts || !c.alerts.suppressed; }) } };
  },

  /** Group comparison inside a course (department / team). BOTH methods are returned because the group-mean rule is still an OPEN decision: by results vs by soldier. */
  groupsRaw_(ctx, courseId, by, opts) {
    Records.guardCourse_(ctx, 'dashboard.view', courseId); if (by !== 'department' && by !== 'team') throw new AppError('VALIDATION', 'השוואה לפי מחלקה או צוות.');
    const org = Courses.org(ctx, courseId), AF = { onlyActive: true }, soldiers = Snapshot.soldiers(ctx, courseId, AF), rows = { nav: Snapshot.navigationRows(ctx, courseId, AF), fit: Snapshot.rows(ctx, 'FitnessTests', courseId, AF), mk: Snapshot.rows(ctx, 'MarksmanshipTests', courseId, AF), att: Snapshot.rows(ctx, 'AttendanceRecords', courseId, AF) };
    const units = by === 'department' ? org.departments : org.teams, key = by === 'department' ? 'department_id' : 'team_id';
    const perSoldierMean = function (rs, field, ids) { const m = {}; rs.forEach(function (r) { if (ids[r.soldier_id] && Calc.hasScore(r[field])) (m[r.soldier_id] = m[r.soldier_id] || []).push({ v: Calc.validNumber(r[field]) }); }); const vals = Object.keys(m).map(function (k) { return { v: Snapshot.mean_(m[k], 'v') }; }); return Snapshot.mean_(vals, 'v'); };
    return units.filter(function (u) { return soldiers.some(function (s) { return s[key] === u.id; }); }).map(function (u) {
      const ids = {}; soldiers.filter(function (s) { return s[key] === u.id; }).forEach(function (s) { ids[s.id] = true; });
      const mine = function (rs) { return rs.filter(function (r) { return ids[r.soldier_id]; }); };
      const m = function (rs, f) { return Snapshot.mean_(mine(rs), f); };
      const nv = function (rs, field) { const w = {}; mine(rs).forEach(function (r) { if (Calc.hasScore(r[field])) w[r.soldier_id] = true; }); return Object.keys(w).length; };
      return { id: u.id, name: u.name, soldiers: Object.keys(ids).length, n_values: { navigation: nv(rows.nav, 'final_score'), fitness: nv(rows.fit, 'weighted_score'), marksmanship: nv(rows.mk, 'examiner_score') },
        navigation: { by_results: m(rows.nav, 'final_score'), by_soldier: perSoldierMean(rows.nav, 'final_score', ids), results: mine(rows.nav).length },
        fitness: { by_results: m(rows.fit, 'weighted_score'), by_soldier: perSoldierMean(rows.fit, 'weighted_score', ids), results: mine(rows.fit).length },
        marksmanship: { by_results: m(rows.mk, 'examiner_score'), by_soldier: perSoldierMean(rows.mk, 'examiner_score', ids), results: mine(rows.mk).length },
        attendance: Analytics.groupAttendance_(mine(rows.att), Object.keys(ids).length).percent };
    });
  },

  /**
   * Group comparison (department / team) with the owner's privacy rule D2: a group (or a group metric) backed by fewer than 5 soldiers is NEVER returned — it is replaced by one anonymous
   * "small groups" row (no name, no counts); with exactly one hidden group the smallest visible group is hidden too (complementary suppression), so totals cannot reveal it.
   */
  groups(ctx, courseId, by, opts) {
    const raw = Dashboard.groupsRaw_(ctx, courseId, by, opts), min = Analytics.MIN_GROUP;
    const hidden = raw.filter(function (g) { return g.soldiers < min; }).length, shown = Analytics.shownGroups_(raw.map(function (g) { return { n: g.soldiers, g: g }; }), hidden).map(function (x) { return x.g; });
    const K = ['navigation', 'fitness', 'marksmanship'], gone = function () { return { by_results: null, by_soldier: null, results: null, suppressed: true }; };
    // D2 sub-cohort rule: a group metric is shown only if the group's with-a-value / without-a-value split (distinct soldiers) is legal: each side 0 or >= MIN (5 of 6 hides, 5 of 10 / 10 of 10 / 5 of 5 show).
    const out = shown.map(function (g) { const o = { id: g.id, name: g.name, soldiers: g.soldiers, attendance: g.attendance, _nv: {} };
      K.forEach(function (k) { const nv = g.n_values[k]; o._nv[k] = nv; o[k] = nv >= min && Analytics.splitOk_(nv, g.soldiers - nv) ? g[k] : gone(); }); return o; });
    // Complementary suppression per metric (and for attendance): if exactly ONE shown group lost its figure while others keep theirs, hide the smallest remaining group's figure too (a lone hidden group is otherwise "course figure minus the others").
    K.forEach(function (k) {
      const lost = out.filter(function (o) { return o[k].suppressed && o._nv[k] > 0; }), keep = out.filter(function (o) { return !o[k].suppressed; });
      if ((lost.length + (raw.length - out.length) === 1) && keep.length) { const m = keep.reduce(function (a, o) { return o._nv[k] < a._nv[k] ? o : a; }, keep[0]); m[k] = gone(); }
    });
    const lostA = out.filter(function (o) { return o.attendance === null; }), keepA = out.filter(function (o) { return o.attendance !== null; });
    // needed only when the course-level attendance figure is itself visible (otherwise the lone hidden group is not derivable)
    const AFx = { onlyActive: true }, courseAtt = Analytics.groupAttendance_(Snapshot.rows(ctx, 'AttendanceRecords', courseId, AFx), Snapshot.soldiers(ctx, courseId, AFx).length).percent;
    if (courseAtt !== null && courseAtt !== undefined && (lostA.length + (raw.length - out.length)) === 1 && keepA.length) keepA.reduce(function (a, o) { return o.soldiers < a.soldiers ? o : a; }, keepA[0]).attendance = null;
    out.forEach(function (o) { delete o._nv; });
    if (out.length < raw.length) out.push({ id: null, name: 'קבוצות קטנות מ-' + min + ' חיילים (מוסתרות)', suppressed: true, soldiers: null, navigation: null, fitness: null, marksmanship: null, attendance: null });
    return out;
  },

  /** Compare courses the caller may see (each through its own Snapshot). Only domains that exist in the course are shown; no ranking is produced. */
  compareCourses(ctx, courseIds) {
    if (!Array.isArray(courseIds) || courseIds.length < 2 || courseIds.length > 10) throw new AppError('VALIDATION', 'בחרו 2–10 קורסים להשוואה.');
    const ids = Array.from(new Set(courseIds.map(function (i) { Soldiers.scalar_(i, 'courseId'); return Util.str(i); })));
    return ids.map(function (id) {
      if (!Policy.inScope(ctx, id) || !Db.get('Courses', id)) throw new AppError('NOT_FOUND', 'קורס לא נמצא.');
      const ov = Dashboard.overview(ctx, id, {}), c = Db.get('Courses', id);
      if (ov.suppressed) return { course_id: id, name: c.name, status: c.status, suppressed: true, reason: ov.reason };
      return { course_id: id, name: c.name, status: c.status, soldiers: ov.soldiers, fitness: ov.fitness.mean, navigation: ov.navigation.mean, marksmanship: ov.marksmanship.regular.mean, ylm: ov.marksmanship.ylm.mean, attendance: ov.attendance.percent,
        exams_pass_rate: Dashboard.domainValues_(ov).exams, qualifications: Dashboard.domainValues_(ov).qualifications, readiness_fit_percent: Dashboard.domainValues_(ov).readiness };
    });
  },

  /** Time series of one soldier per domain (current-state rows only). Needs >=2 points to call it a trend. */
  trends(ctx, courseId, soldierId) {
    Records.guardCourse_(ctx, 'dashboard.view', courseId); Soldiers.scalar_(soldierId, 'soldier_id'); const f = { soldierId: Util.str(soldierId) };
    const series = function (table, field, dateCol) { return Snapshot.rows(ctx, table, courseId, f).filter(function (r) { return Calc.hasScore(r[field]); }).map(function (r) { return { date: Util.cellToIsoDate(r[dateCol]), value: Calc.validNumber(r[field]) }; }).sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); }); };
    const S = { navigation: series('NavigationTests', 'final_score', 'test_date'), fitness: series('FitnessTests', 'weighted_score', 'test_date'), marksmanship: series('MarksmanshipTests', 'examiner_score', 'test_date') };
    const out = {}; Object.keys(S).forEach(function (k) { const p = S[k]; out[k] = { points: p, trend_available: p.length >= 2, change: p.length >= 2 ? p[p.length - 1].value - p[p.length - 2].value : null }; });
    return out;
  },

  /** Strengths / gaps — ONLY with configured evidence minimum and thresholds; each item carries its evidence (count + mean). Otherwise {available:false, reason}. */
  strengthsGaps(ctx, courseId, soldierId) {
    Records.guardCourse_(ctx, 'dashboard.view', courseId); Soldiers.scalar_(soldierId, 'soldier_id'); const today = Util.todayIso(), minRec = Settings.opt(courseId, 'evidence.min_records', today);
    if (minRec === null) return { available: false, reason: 'לא הוגדר מינימום מדידות כראיה (הגדרות)', strengths: [], gaps: [] };
    const sid = Util.str(soldierId), f = { soldierId: sid }, D = { navigation: ['NavigationTests', 'final_score', 'nav'], fitness: ['FitnessTests', 'weighted_score', 'fitness'], marksmanship: ['MarksmanshipTests', 'examiner_score', 'marksmanship'] };
    const strengths = [], gaps = []; let anyThreshold = false;
    Object.keys(D).forEach(function (d) {
      const rs = Snapshot.rows(ctx, D[d][0], courseId, f).filter(function (r) { return Calc.hasScore(r[D[d][1]]); }); if (rs.length < minRec) return;
      const mean = Snapshot.mean_(rs, D[d][1]), lvl = Settings.level(courseId, D[d][2], mean, today), low = Settings.opt(courseId, 'low.' + D[d][2], today); if (lvl !== null || low !== null) anyThreshold = true;
      const item = { domain: d, count: rs.length, mean: mean };
      if (lvl === 'green') strengths.push(item); else if (lvl === 'red' || (low !== null && mean < low)) gaps.push(item);
    });
    return { available: anyThreshold, reason: anyThreshold ? '' : 'לא הוגדרו ספי מדידה', strengths: strengths, gaps: gaps, min_records: minRec };
  }
};
