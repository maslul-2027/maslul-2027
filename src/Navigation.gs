/**
 * Navigation module — record type plugged into the generic Records lifecycle.
 * Formula (approved): points_score = 90 * completed / total ; final = plan + debrief + points_score.
 * Stored values are exact (unrounded); rounding is display-only (Util.display1).
 */
const Navigation = {
  recordType: {
    editable: ['soldier_id', 'test_date', 'navigation_type_id', 'distance_km', 'plan_score', 'debrief_score',
               'points_completed', 'points_total', 'notes'],

    /** Validates cross-references inside the course and derives calculated fields. */
    prepare(courseId, data, existing) {
      const soldierId = Util.str(data.soldier_id);
      const soldier = Db.get('Soldiers', soldierId);
      // uniform message: missing / other course / cancelled / inactive are indistinguishable to the caller
      if (!soldier || soldier.course_id !== courseId || soldier.record_status !== RECORD_STATUS.ACTIVE || !Util.isTrue(soldier.active)) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE);
      const typeId = Util.str(data.navigation_type_id);
      const type = Db.get('NavigationTypes', typeId);
      if (!type || type.course_id !== courseId || !Util.isTrue(type.active)) throw new AppError('VALIDATION', 'סוג ניווט לא תקין.');
      const date = Util.isoDate(Util.cellToIsoDate(data.test_date), 'תאריך ניווט');
      /* Issue #97 PR-A: a NEW result may point to a durable navigation event. The event's shared settings are authoritative (blank → taken from it; a different value → 409, never silently chosen). Edits keep the original link. */
      let evId = existing ? Util.str(existing.event_id) : Util.str(data.event_id), src = data;
      if (!existing) {
        if (!evId) { const same = Db.where('NavigationEvents', function (e) { return e.course_id === courseId && e.record_status === RECORD_STATUS.ACTIVE && e.navigation_type_id === typeId && Util.cellToIsoDate(e.test_date) === date; }); if (same.length > 1) throw new AppError('VALIDATION', 'קיימים כמה אירועי ניווט באותו סוג ותאריך — יש לבחור אירוע.'); if (same.length === 1) evId = same[0].id; }
        if (evId) {
          const ev = Db.get('NavigationEvents', evId);
          if (!ev || ev.course_id !== courseId || ev.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('VALIDATION', 'אירוע ניווט לא תקין.');
          if (ev.navigation_type_id !== typeId || Util.cellToIsoDate(ev.test_date) !== date) throw new AppError('VALIDATION', 'סוג או תאריך התוצאה אינם תואמים לאירוע.');
          if (ev.status === 'COMPLETE') throw new AppError('VALIDATION', 'האירוע סומן כהושלם. יש לפתוח אותו מחדש (עם נימוק) לפני הוספת תוצאות.');
          src = Object.assign({}, data);
          ['distance_km', 'points_total'].forEach(function (k) { if (Util.isBlank(src[k])) src[k] = ev[k]; else if (Number(src[k]) !== Number(ev[k])) throw new AppError('CONFLICT', 'ההגדרה "' + (k === 'distance_km' ? 'מרחק' : 'סך נקודות') + '" שונה מהמוגדר באירוע (' + ev[k] + ').', { event_id: ev.id, field: k, event_value: Number(ev[k]) }); });
        }
      }
      const n = Calc.navNormalize(src);
      const c = Calc.navCompute(n);
      const notes = Util.str(data.notes);
      if (notes.length > 1000) throw new AppError('VALIDATION', 'הערות ארוכות מדי.');
      return Object.assign({ soldier_id: soldierId, test_date: date, navigation_type_id: typeId, notes: notes,
        formula_version: Calc.NAV_FORMULA_VERSION }, existing ? {} : { event_id: evId || '' }, n, c);
    }
  },

  /**
   * The ONLY place that averages navigation scores (a structural test enforces it). Input rows MUST come from Snapshot.navigationRows.
   * Simple mean (approved); missing data is "no data", never 0.
   */
  aggregate_(rows) {
    const byType = Object.create(null);
    rows.forEach(function (r) { (byType[r.navigation_type_id] = byType[r.navigation_type_id] || []).push(Calc.validNumber(r.final_score)); });
    const overall = Calc.mean(rows.map(function (r) { return Calc.validNumber(r.final_score); }));
    const types = Object.keys(byType).map(function (t) {
      const ty = Db.get('NavigationTypes', t), m = Calc.mean(byType[t]);
      return { type_id: t, type_name: ty ? ty.name : '', count: byType[t].filter(function (x) { return x !== null; }).length, mean: m, mean_display: Util.display1(m) };
    });
    return { count: rows.length, mean: overall, mean_display: Util.display1(overall), by_type: types, note: rows.length ? '' : 'אין מספיק נתונים' };
  },

  /** CURRENT snapshot of one soldier (visible, not cancelled, non-cancelled results). A cancelled soldier => no data. */
  summary(ctx, courseId, soldierId) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const rows = Snapshot.navigationRows(ctx, courseId, { soldierId: Util.str(soldierId) });
    return Util.str(soldierId) ? Navigation.aggregate_(rows) : Analytics.groupNavigation_(rows, Snapshot.soldiers(ctx, courseId, {}).length);   // D2: no soldierId => group figure, cohort-gated
  },

  userNames_() { const m = Object.create(null); Db.all('Users').forEach(function (u) { m[String(u.email).toLowerCase()] = u.display_name || u.email; }); return m; },

  /**
   * HISTORICAL list of results (not a snapshot): by soldier / team / department / course, newest first.
   * Commander: only results of soldiers inside his assignments; admin: everything incl. cancelled results (includeCancelled) and results of cancelled soldiers (flagged).
   */
  list(ctx, courseId, opts) {
    opts = opts || {};
    Records.guardCourse_(ctx, 'result.read', courseId);
    ['soldierId', 'departmentId', 'teamId', 'typeId'].forEach(function (k) { Soldiers.scalar_(opts[k], k); });
    const raw = Records.list(ctx, 'NavigationTests', courseId, { soldierId: Util.str(opts.soldierId) || undefined, includeCancelled: opts.includeCancelled === true });
    const sMap = Object.create(null); Db.where('Soldiers', function (x) { return x.course_id === courseId; }).forEach(function (x) { sMap[x.id] = x; });
    const org = Courses.org(ctx, courseId), dn = Object.create(null), tn = Object.create(null);
    org.departments.forEach(function (d) { dn[d.id] = d.name; }); org.teams.forEach(function (t) { tn[t.id] = t.name; });
    const types = Object.create(null); Db.where('NavigationTypes', function (t) { return t.course_id === courseId; }).forEach(function (t) { types[t.id] = t.name; });
    const names = Navigation.userNames_(), admin = ctx.role === ROLES.ADMIN;
    const from = Util.str(opts.from) ? Util.isoDate(opts.from, 'מתאריך') : '', to = Util.str(opts.to) ? Util.isoDate(opts.to, 'עד תאריך') : '';
    return raw.map(function (r) { return { r: r, s: sMap[r.soldier_id] }; }).filter(function (x) {
      if (!x.s) return false;
      if (opts.departmentId && x.s.department_id !== opts.departmentId) return false;
      if (opts.teamId && x.s.team_id !== opts.teamId) return false;
      if (opts.typeId && x.r.navigation_type_id !== opts.typeId) return false;
      const d = Util.cellToIsoDate(x.r.test_date);
      return (!from || d >= from) && (!to || d <= to);
    }).sort(function (a, b) { return String(Util.cellToIsoDate(b.r.test_date)).localeCompare(String(Util.cellToIsoDate(a.r.test_date))) || String(b.r.created_at).localeCompare(String(a.r.created_at)); })
      .map(function (x) {
        const r = x.r, s = x.s;
        const o = { id: r.id, soldier_id: s.id, soldier_name: s.full_name, personal_number: String(s.personal_number), department_id: s.department_id, department_name: dn[s.department_id] || '',
          team_id: s.team_id, team_name: tn[s.team_id] || '', test_date: Util.cellToIsoDate(r.test_date), navigation_type_id: r.navigation_type_id, type_name: types[r.navigation_type_id] || '',
          distance_km: r.distance_km, plan_score: r.plan_score, debrief_score: r.debrief_score, points_completed: r.points_completed, points_total: r.points_total,
          points_score_display: Util.display1(Number(r.points_score)), final_score: Number(r.final_score), final_display: Util.display1(Number(r.final_score)), notes: r.notes || '',
          created_by_name: names[String(r.created_by).toLowerCase()] || '', created_at: r.created_at, own: String(r.created_by).toLowerCase() === ctx.email };
        if (admin) { o.created_by = r.created_by; o.record_status = r.record_status; o.soldier_cancelled = s.record_status !== RECORD_STATUS.ACTIVE; o.updated_at = r.updated_at; }
        return o;
      });
  },

  /**
   * CURRENT-STATE figures for the course / each department / each team + a per-soldier coverage table (no ranking: ordered by name / org order).
   * Rows come only from Snapshot (cancelled soldiers excluded, commander assignments applied). opts: typeId, from, to, onlyActive.
   * Group mean = simple mean over all included RESULTS (not a mean of per-soldier means) — open question in DECISIONS_NEEDED.
   */
  /** Unsuppressed computation (internal; used by tests and by groupSummary). NOT an API route. */
  groupSummaryRaw_(ctx, courseId, opts) {
    opts = opts || {};
    Records.guardCourse_(ctx, 'result.read', courseId);
    ['typeId', 'departmentId', 'teamId'].forEach(function (k) { Soldiers.scalar_(opts[k], k); });
    // v0.4.1: department/team filters are APPLIED (they narrow the Snapshot soldiers, hence every group figure). Snapshot already applies the caller's
    // visibility first, so a filter can only narrow, never widen: an id outside the caller's scope (or unknown / foreign course) simply yields an empty report.
    const f = { typeId: Util.str(opts.typeId) || undefined, onlyActive: opts.onlyActive !== false,   // owner decision D4: soldiers with active=false are not part of any current figure (history stays in nav.list)
      departmentId: Util.str(opts.departmentId) || undefined, teamId: Util.str(opts.teamId) || undefined,
      from: Util.str(opts.from) ? Util.isoDate(opts.from, 'מתאריך') : undefined, to: Util.str(opts.to) ? Util.isoDate(opts.to, 'עד תאריך') : undefined };
    const rows = Snapshot.navigationRows(ctx, courseId, f), soldiers = Snapshot.soldiers(ctx, courseId, f);
    const org = Courses.org(ctx, courseId);
    const course = Courses.mustGet_(courseId);
    function group(id, name, sel) {
      const ss = soldiers.filter(sel), ids = {}; ss.forEach(function (x) { ids[x.id] = true; });
      const rs = rows.filter(function (r) { return ids[r.soldier_id]; }), agg = Navigation.aggregate_(rs);
      const withRes = Object.create(null); rs.forEach(function (r) { withRes[r.soldier_id] = true; });
      const scored = Analytics.distinct_(rs, function (r) { return Calc.hasScore(r.final_score); });
      const out = { id: id, name: name, soldiers: ss.length, soldiers_with_results: Object.keys(withRes).length, count: agg.count, mean_display: agg.mean_display, by_type: agg.by_type, note: agg.note };
      // internal helpers for the D2 sub-cohort gate in groupSummary — NON-enumerable, so the raw output (and its JSON) is byte-identical to before
      Object.defineProperty(out, 'soldiers_scored_', { value: scored, enumerable: false, writable: true, configurable: true });
      Object.defineProperty(out, 'types_small_', { value: agg.by_type.filter(function (t) { const ts = Analytics.distinct_(rs, function (r) { return r.navigation_type_id === t.type_id && Calc.hasScore(r.final_score); }); return ts > 0 && ts < Analytics.MIN_GROUP; }).map(function (t) { return t.type_id; }), enumerable: false, writable: true, configurable: true });
      return out;
    }
    const out = { course: group(courseId, course.name, function () { return true; }),
      departments: org.departments.map(function (d) { return group(d.id, d.name, function (x) { return x.department_id === d.id; }); }).filter(function (g) { return g.soldiers > 0; }),
      teams: org.teams.map(function (t) { const g = group(t.id, t.name, function (x) { return x.team_id === t.id; }); g.department_id = t.department_id; return g; }).filter(function (g) { return g.soldiers > 0; }) };
    out.soldiers = soldiers.map(function (x) {
      const rs = rows.filter(function (r) { return r.soldier_id === x.id; }), agg = Navigation.aggregate_(rs);
      const last = rs.map(function (r) { return Util.cellToIsoDate(r.test_date); }).sort().pop() || '';
      return { id: x.id, full_name: x.full_name, personal_number: String(x.personal_number), department_id: x.department_id, team_id: x.team_id, active: Util.isTrue(x.active), count: agg.count, mean_display: agg.mean_display, last_date: last };
    }).sort(function (a, b) { return String(a.full_name).localeCompare(String(b.full_name), 'he'); });
    out.scope_note = ctx.role === ROLES.ADMIN ? '' : 'הנתונים מחושבים על החיילים שבתחום האחריות שלך בלבד.';
    return out;
  },

  /** Public group figures. Owner decision D2: no group figure for a group of fewer than Analytics.MIN_GROUP soldiers (the per-soldier list stays: it is each soldier's own recorded result under the caller's existing result.read scope). */
  groupSummary(ctx, courseId, opts) {
    const out = Navigation.groupSummaryRaw_(ctx, courseId, opts), course = Courses.mustGet_(courseId);
    // D2 sub-cohort rule (a group >= MIN can still hold only 1-4 soldiers with a result / score): figures need scored / unscored soldiers each 0 or >= MIN; `soldiers_with_results` needs with / without each 0 or >= MIN;
    // per-type figures need >= MIN scored soldiers; with a type hidden the overall result count goes too. The internal helper field is never returned.
    const gate = function (g, rows) {
      const R = g.soldiers_with_results, S = g.soldiers_scored_, small = g.types_small_ || []; delete g.soldiers_scored_; delete g.types_small_;
      if (!Analytics.splitOk_(g.soldiers_with_results, g.soldiers - g.soldiers_with_results)) { g.soldiers_with_results = null; g.count = null; if (g.by_type) g.by_type = g.by_type.map(function (t) { return Object.assign({}, t, { count: null }); }); g.cohort_suppressed = true; }   // result-row counts would reveal the same split
      if (!Analytics.splitOk_(S, R - S)) { g.count = null; g.mean_display = null; g.by_type = null; g.note = Analytics.cohortReason_(); g.cohort_suppressed = true; return g; }
      if (small.length) { g.by_type = g.by_type.map(function (t) { return small.indexOf(t.type_id) === -1 ? t : { type_id: t.type_id, type_name: t.type_name, count: null, mean: null, mean_display: null, suppressed: true }; }); g.count = null; }
      return g;
    };
    const fig = function (g) { return g.cohort_suppressed && g.mean_display === null; };
    const MIN = Analytics.MIN_GROUP, hide = function (g) { return { id: null, name: 'קבוצה קטנה מ-' + MIN + ' חיילים (מוסתרת)', suppressed: true, soldiers: null, soldiers_with_results: null, count: null, mean_display: null, by_type: null, note: '' }; };
    const level = function (list) { const hidden = list.filter(function (g) { return g.soldiers < MIN; }).length, keep = Analytics.shownGroups_(list.map(function (g) { return { n: g.soldiers, g: g }; }), hidden).map(function (x) { return x.g; }); if (keep.length < list.length) keep.push(hide()); keep.forEach(function (g) { if (g.id !== null) gate(g); });
      // complementary: exactly one group with hidden figures + others shown => the smallest shown group's figures are hidden too (else hidden = course total - the others)
      const hf = keep.filter(function (g) { return g.id !== null && fig(g); });
      if (hf.length === 1) { const rest = keep.filter(function (g) { return g.id !== null && !fig(g); }); if (rest.length) { const m = rest.reduce(function (a, g) { return g.soldiers < a.soldiers ? g : a; }, rest[0]); m.count = null; m.mean_display = null; m.by_type = null; m.note = Analytics.cohortReason_(); m.cohort_suppressed = true; } }
      return keep; };
    if (out.course.soldiers < MIN) { out.course = hide(); out.course.name = course.name; out.departments = []; out.teams = []; out.small_group = true; } else { gate(out.course); out.departments = level(out.departments); out.teams = level(out.teams); }
    return out;
  },

  // ---------------- navigation types (admin-configurable, spec: "סוגי ניווט ניתנים להגדרה") ----------------
  typesList(ctx, courseId) {
    Records.guardCourse_(ctx, 'course.read', courseId);
    return Db.where('NavigationTypes', function (t) { return t.course_id === courseId && (ctx.role === ROLES.ADMIN || Util.isTrue(t.active)); })
      .map(function (t) { return { id: t.id, name: t.name, active: Util.isTrue(t.active) }; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'he'); });
  },
  cleanTypeName_(courseId, name, exceptId) {
    Soldiers.scalar_(name, 'name'); const v = Util.str(name);
    if (!v || v.length > 50) throw new AppError('VALIDATION', 'שם סוג ניווט חובה (עד 50 תווים).');
    const dup = Db.where('NavigationTypes', function (t) { return t.course_id === courseId && t.id !== exceptId && String(t.name).trim().toLowerCase() === v.toLowerCase(); })[0];
    if (dup) throw new AppError('DUPLICATE', 'סוג ניווט בשם זה כבר קיים בקורס.');
    return v;
  },
  typeCreate(ctx, courseId, name) {
    Records.guardCourse_(ctx, 'config.edit', courseId); const v0 = Navigation.cleanTypeName_(courseId, name, null);
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'config.edit', courseId); const v = Navigation.cleanTypeName_(courseId, v0, null);
      const row = { id: Util.uuid(), course_id: courseId, name: v, active: true, created_at: Util.nowIso(), created_by: ctx.email };
      Db.insert('NavigationTypes', row); Audit.log(ctx, { courseId: courseId, action: 'NAVTYPE_CREATE', table: 'NavigationTypes', recordId: row.id, after: { name: v, active: true } });
      return { id: row.id, name: v, active: true };
    });
  },
  typeMutate_(ctx, id, build) {
    const pre = Db.get('NavigationTypes', Util.str(id)); if (!pre || !Policy.inScope(ctx, pre.course_id)) throw new AppError('NOT_FOUND', 'סוג הניווט לא נמצא.');
    Records.guardCourse_(ctx, 'config.edit', pre.course_id);
    return Locks.run(function () {
      const cur = Db.get('NavigationTypes', pre.id); Records.guardCourse_(ctx, 'config.edit', cur.course_id);
      const plan = build(cur); Db.update('NavigationTypes', cur.id, plan.patch);
      Audit.log(ctx, { courseId: cur.course_id, action: plan.action, table: 'NavigationTypes', recordId: cur.id, before: plan.before, after: plan.after });
      const t = Db.get('NavigationTypes', cur.id); return { id: t.id, name: t.name, active: Util.isTrue(t.active) };
    });
  },
  typeRename(ctx, id, name) {
    return Navigation.typeMutate_(ctx, id, function (cur) { const v = Navigation.cleanTypeName_(cur.course_id, name, cur.id);
      if (v === cur.name) throw new AppError('VALIDATION', 'השם לא השתנה.'); return { patch: { name: v }, action: 'NAVTYPE_RENAME', before: { name: cur.name }, after: { name: v } }; });
  },
  typeSetActive(ctx, id, active) {
    if (typeof active !== 'boolean') throw new AppError('VALIDATION', 'סטטוס לא תקין.');
    return Navigation.typeMutate_(ctx, id, function (cur) { if (Util.isTrue(cur.active) === active) throw new AppError('VALIDATION', 'הסטטוס לא השתנה.');
      return { patch: { active: active }, action: 'NAVTYPE_ACTIVITY', before: { active: Util.isTrue(cur.active) }, after: { active: active } }; });
  }
};
