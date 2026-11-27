/**
 * NavigationEvents (Issue #97 PR-A) — a DURABLE, shared definition of ONE navigation event: course, type, date, distance, total control points, label,
 * explicit lifecycle (DRAFT / IN_PROGRESS / COMPLETE), version, creator, audit. Results (NavigationTests) keep their own approved per-record values
 * and the approved formula is untouched; a result only POINTS to its event through the optional `event_id`.
 *
 * Non-destructive transition (no existing row is rewritten):
 *   - the table is new; `event_id` is an optional appended column (legacy rows read '');
 *   - legacy results are grouped by canonical type+date by `legacy()` (read-only preview). A group whose results disagree on distance / total points is a CONFLICT and is
 *     never auto-adopted (the first divergent row is never chosen); the admin resolves it explicitly with `adopt({resolve})`;
 *   - completeness is DERIVED and shown ("N entered / N eligible"); COMPLETE is an explicit action, never inferred from the date.
 * Server-authoritative: scope, role, cross-course, 409 CONFLICT on a stale version (never last-write-wins), idempotent create by request_id.
 */
const NavEvents = {
  STATUSES: ['DRAFT', 'IN_PROGRESS', 'COMPLETE'],

  clean_(courseId, d) {
    d = d || {};
    const typeId = Util.str(d.navigation_type_id), type = Db.get('NavigationTypes', typeId);
    if (!type || type.course_id !== courseId || !Util.isTrue(type.active)) throw new AppError('VALIDATION', 'סוג ניווט לא תקין.');
    const date = Util.isoDate(Util.cellToIsoDate(d.test_date), 'תאריך ניווט');
    const n = Calc.navNormalize({ distance_km: d.distance_km, plan_score: 0, debrief_score: 0, points_completed: 0, points_total: d.points_total });
    const label = Util.str(d.label); if (label.length > 60) throw new AppError('VALIDATION', 'שם האירוע ארוך מדי (עד 60 תווים).');
    const notes = Util.str(d.notes); if (notes.length > 1000) throw new AppError('VALIDATION', 'הערות ארוכות מדי.');
    return { navigation_type_id: typeId, test_date: date, distance_km: n.distance_km, points_total: n.points_total, label: label, notes: notes };
  },
  key_(e) { return e.navigation_type_id + '|' + Util.cellToIsoDate(e.test_date) + '|' + Util.str(e.label).toLowerCase(); },
  activeEvents_(courseId) { return Db.where('NavigationEvents', function (e) { return e.course_id === courseId && e.record_status === RECORD_STATUS.ACTIVE; }); },

  /** Results that belong to the event: explicit event_id, or legacy (no event_id) rows of the same type+date when exactly ONE active event owns that type+date. */
  recordsOf_(courseId, ev, all) {
    const date = Util.cellToIsoDate(ev.test_date), sameKey = all.filter(function (x) { return x.navigation_type_id === ev.navigation_type_id && Util.cellToIsoDate(x.test_date) === date; }).length;
    return Db.where('NavigationTests', function (r) {
      if (r.course_id !== courseId || r.record_status !== RECORD_STATUS.ACTIVE) return false;
      if (Util.str(r.event_id)) return r.event_id === ev.id;
      return sameKey === 1 && r.navigation_type_id === ev.navigation_type_id && Util.cellToIsoDate(r.test_date) === date;
    });
  },

  view_(ctx, courseId, ev, all, visible, types) {
    const recs = NavEvents.recordsOf_(courseId, ev, all).filter(function (r) { return visible(Db.get('Soldiers', r.soldier_id)); });
    const eligible = Db.where('Soldiers', function (s) { return s.course_id === courseId && s.record_status === RECORD_STATUS.ACTIVE && Util.isTrue(s.active) && visible(s); });
    const entered = {}; recs.forEach(function (r) { entered[r.soldier_id] = true; });
    const enteredN = Object.keys(entered).length, mism = recs.filter(function (r) { return Number(r.distance_km) !== Number(ev.distance_km) || Number(r.points_total) !== Number(ev.points_total); }).length;
    return { id: ev.id, course_id: courseId, navigation_type_id: ev.navigation_type_id, type_name: types[ev.navigation_type_id] || '', test_date: Util.cellToIsoDate(ev.test_date), label: ev.label || '',
      distance_km: Number(ev.distance_km), points_total: Number(ev.points_total), notes: ev.notes || '', status: ev.status, version: Number(ev.version), created_by: ev.created_by, updated_at: ev.updated_at, completed_at: ev.completed_at || '',
      entered: enteredN, eligible: eligible.length, missing: Math.max(0, eligible.length - Object.keys(entered).filter(function (id) { return eligible.some(function (s) { return s.id === id; }); }).length),
      progress: enteredN === 0 ? 'EMPTY' : (enteredN >= eligible.length ? 'FULL' : 'PARTIAL'), settings_mismatch: mism, scope_note: 'ספירות בהיקף ההרשאה של המבקש (תצוגה מבצעית, לא נתון קבוצתי)' };
  },
  typesMap_(courseId) { const m = Object.create(null); Db.where('NavigationTypes', function (t) { return t.course_id === courseId; }).forEach(function (t) { m[t.id] = t.name; }); return m; },

  list(ctx, courseId, opts) {
    opts = opts || {}; Records.guardCourse_(ctx, 'result.read', courseId);
    const all = NavEvents.activeEvents_(courseId), visible = Soldiers.visibleFn_(ctx, courseId), types = NavEvents.typesMap_(courseId);
    return all.filter(function (e) { return (!opts.typeId || e.navigation_type_id === Util.str(opts.typeId)) && (!opts.date || Util.cellToIsoDate(e.test_date) === Util.str(opts.date)); })
      .map(function (e) { return NavEvents.view_(ctx, courseId, e, all, visible, types); })
      .sort(function (a, b) { return String(b.test_date).localeCompare(String(a.test_date)) || String(b.updated_at).localeCompare(String(a.updated_at)); });
  },
  get(ctx, id) {
    const ev = Db.get('NavigationEvents', Util.str(id)); if (!ev || !Policy.inScope(ctx, ev.course_id) || ev.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('NOT_FOUND', 'אירוע הניווט לא נמצא.');
    Records.guardCourse_(ctx, 'result.read', ev.course_id);
    const all = NavEvents.activeEvents_(ev.course_id), visible = Soldiers.visibleFn_(ctx, ev.course_id), view = NavEvents.view_(ctx, ev.course_id, ev, all, visible, NavEvents.typesMap_(ev.course_id));
    const entered = {}; NavEvents.recordsOf_(ev.course_id, ev, all).forEach(function (r) { entered[r.soldier_id] = r.id; });
    view.roster = Db.where('Soldiers', function (s) { return s.course_id === ev.course_id && s.record_status === RECORD_STATUS.ACTIVE && Util.isTrue(s.active) && visible(s); })
      .map(function (s) { return { soldier_id: s.id, entered: !!entered[s.id] }; });   // operational roster (names come from soldiers.list under the same scope); never part of an aggregate/export
    return view;
  },

  create(ctx, courseId, data) {
    data = data || {}; Records.guardCourse_(ctx, 'result.create', courseId);
    const requestId = Util.str(data.request_id); if (!requestId) throw new AppError('VALIDATION', 'חסר מזהה בקשה (למניעת שליחה כפולה).');
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'result.create', courseId);
      const dup = Db.where('NavigationEvents', function (e) { return e.course_id === courseId && e.request_id === requestId; })[0];
      if (dup) { if (String(dup.created_by).toLowerCase() !== ctx.email) throw new AppError('VALIDATION', 'מזהה בקשה כבר בשימוש.'); return { event: NavEvents.get(ctx, dup.id), duplicate: true }; }
      const f = NavEvents.clean_(courseId, data), clash = NavEvents.activeEvents_(courseId).filter(function (e) { return NavEvents.key_(e) === NavEvents.key_(f); })[0];
      if (clash) throw new AppError('CONFLICT', 'כבר קיים אירוע ניווט מאותו סוג ותאריך' + (f.label ? ' ובאותו שם' : '') + '. לפתיחה של אירוע נוסף באותו יום הוסיפו שם (למשל "לילה").', { existing_id: clash.id });
      const now = Util.nowIso(), row = Object.assign({ id: Util.uuid(), course_id: courseId }, f, { status: 'IN_PROGRESS', record_status: RECORD_STATUS.ACTIVE, version: 1, request_id: requestId, completed_at: '', completed_by: '', created_at: now, created_by: ctx.email, updated_at: now, updated_by: ctx.email });
      Db.insert('NavigationEvents', row); Audit.log(ctx, { courseId: courseId, action: 'NAVEVENT_CREATE', table: 'NavigationEvents', recordId: row.id, after: f });
      return { event: NavEvents.get(ctx, row.id), duplicate: false };
    });
  },

  /** Shared settings / label / notes. expected_version is REQUIRED: a stale writer gets 409 CONFLICT, nothing is overwritten. Existing results are NEVER rewritten; divergence is reported (settings_mismatch). */
  update(ctx, id, patch, expectedVersion, reason) {
    patch = patch || {}; const pre = Db.get('NavigationEvents', Util.str(id)); if (!pre || !Policy.inScope(ctx, pre.course_id) || pre.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('NOT_FOUND', 'אירוע הניווט לא נמצא.');
    Records.guardCourse_(ctx, 'result.create', pre.course_id); if (expectedVersion === undefined || expectedVersion === null) throw new AppError('VALIDATION', 'חסרה גרסה צפויה (expected_version).');
    return Locks.run(function () {
      const cur = Db.get('NavigationEvents', pre.id); Records.guardCourse_(ctx, 'result.create', cur.course_id);
      if (Number(expectedVersion) !== Number(cur.version)) throw new AppError('CONFLICT', 'האירוע עודכן בינתיים על ידי משתמש אחר. טענו מחדש ובדקו לפני שמירה.', { current_version: Number(cur.version) });
      const merged = Object.assign({ navigation_type_id: cur.navigation_type_id, test_date: Util.cellToIsoDate(cur.test_date), distance_km: cur.distance_km, points_total: cur.points_total, label: cur.label, notes: cur.notes }, patch), f = NavEvents.clean_(cur.course_id, merged);
      const changed = Object.keys(f).filter(function (k) { return String(f[k]) !== String(k === 'test_date' ? Util.cellToIsoDate(cur[k]) : cur[k]); }); if (!changed.length) throw new AppError('VALIDATION', 'לא בוצע שינוי.');
      const hasRecs = NavEvents.recordsOf_(cur.course_id, cur, NavEvents.activeEvents_(cur.course_id)).length > 0;
      if (hasRecs && (changed.indexOf('navigation_type_id') >= 0 || changed.indexOf('test_date') >= 0)) throw new AppError('VALIDATION', 'לא ניתן לשנות סוג או תאריך של אירוע שכבר יש בו תוצאות.');
      if (hasRecs && !Util.str(reason)) throw new AppError('VALIDATION', 'שינוי הגדרות באירוע עם תוצאות דורש נימוק.');
      const clash = NavEvents.activeEvents_(cur.course_id).filter(function (e) { return e.id !== cur.id && NavEvents.key_(e) === NavEvents.key_(f); })[0]; if (clash) throw new AppError('CONFLICT', 'כבר קיים אירוע אחר מאותו סוג, תאריך ושם.', { existing_id: clash.id });
      const before = {}; changed.forEach(function (k) { before[k] = cur[k]; });
      Db.update('NavigationEvents', cur.id, Object.assign({}, f, { version: Number(cur.version) + 1, updated_at: Util.nowIso(), updated_by: ctx.email }));
      Audit.log(ctx, { courseId: cur.course_id, action: 'NAVEVENT_UPDATE', table: 'NavigationEvents', recordId: cur.id, before: before, after: f, reason: Util.str(reason) });
      return NavEvents.get(ctx, cur.id);
    });
  },

  /** Explicit lifecycle. COMPLETE with missing entries needs acknowledge_missing=true and a reason; reopening (COMPLETE → IN_PROGRESS) needs a reason. Never derived from the date. */
  setStatus(ctx, id, status, expectedVersion, opts) {
    opts = opts || {}; const st = Util.str(status); if (NavEvents.STATUSES.indexOf(st) < 0) throw new AppError('VALIDATION', 'סטטוס אירוע לא תקין.');
    const pre = Db.get('NavigationEvents', Util.str(id)); if (!pre || !Policy.inScope(ctx, pre.course_id) || pre.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('NOT_FOUND', 'אירוע הניווט לא נמצא.');
    Records.guardCourse_(ctx, 'result.create', pre.course_id); if (expectedVersion === undefined || expectedVersion === null) throw new AppError('VALIDATION', 'חסרה גרסה צפויה (expected_version).');
    return Locks.run(function () {
      const cur = Db.get('NavigationEvents', pre.id); Records.guardCourse_(ctx, 'result.create', cur.course_id);
      if (Number(expectedVersion) !== Number(cur.version)) throw new AppError('CONFLICT', 'האירוע עודכן בינתיים על ידי משתמש אחר. טענו מחדש ובדקו לפני שמירה.', { current_version: Number(cur.version) });
      if (cur.status === st) throw new AppError('VALIDATION', 'הסטטוס לא השתנה.');
      if (st === 'COMPLETE') { const v = NavEvents.view_(ctx, cur.course_id, cur, NavEvents.activeEvents_(cur.course_id), Soldiers.visibleFn_(ctx, cur.course_id), NavEvents.typesMap_(cur.course_id)); if (v.missing > 0 && !(opts.acknowledge_missing === true && Util.str(opts.reason))) throw new AppError('VALIDATION', 'חסרות תוצאות ל-' + v.missing + ' חניכים. לסימון כהושלם יש לאשר חוסר ולציין נימוק.', { missing: v.missing }); }
      if (cur.status === 'COMPLETE' && !Util.str(opts.reason)) throw new AppError('VALIDATION', 'פתיחה מחדש של אירוע שהושלם דורשת נימוק.');
      const now = Util.nowIso(); Db.update('NavigationEvents', cur.id, { status: st, version: Number(cur.version) + 1, updated_at: now, updated_by: ctx.email, completed_at: st === 'COMPLETE' ? now : '', completed_by: st === 'COMPLETE' ? ctx.email : '' });
      Audit.log(ctx, { courseId: cur.course_id, action: 'NAVEVENT_STATUS', table: 'NavigationEvents', recordId: cur.id, before: { status: cur.status }, after: { status: st }, reason: Util.str(opts.reason) });
      return NavEvents.get(ctx, cur.id);
    });
  },

  /** READ-ONLY preview of legacy results (no event_id) grouped by canonical type+date, with explicit conflict signals. Admin only (it spans the whole course). */
  legacy(ctx, courseId) {
    Records.guardCourse_(ctx, 'config.edit', courseId);
    const events = NavEvents.activeEvents_(courseId), groups = Object.create(null), types = NavEvents.typesMap_(courseId);
    Db.where('NavigationTests', function (r) { return r.course_id === courseId && r.record_status === RECORD_STATUS.ACTIVE && !Util.str(r.event_id); }).forEach(function (r) {
      const k = r.navigation_type_id + '|' + Util.cellToIsoDate(r.test_date), g = groups[k] = groups[k] || { navigation_type_id: r.navigation_type_id, type_name: types[r.navigation_type_id] || '', test_date: Util.cellToIsoDate(r.test_date), records: 0, distances: [], points_totals: [] };
      g.records++; const d = Number(r.distance_km), p = Number(r.points_total); if (g.distances.indexOf(d) < 0) g.distances.push(d); if (g.points_totals.indexOf(p) < 0) g.points_totals.push(p);
    });
    return Object.keys(groups).sort().map(function (k) { const g = groups[k], has = events.some(function (e) { return e.navigation_type_id === g.navigation_type_id && Util.cellToIsoDate(e.test_date) === g.test_date; });
      return Object.assign(g, { conflict: g.distances.length > 1 || g.points_totals.length > 1, already_has_event: has, adoptable: !has && g.distances.length === 1 && g.points_totals.length === 1 }); });
  },
  /** Adopt legacy groups. apply:false = dry run. Clean groups are adopted as-is; conflicts need resolve[type|date] = {distance_km, points_total} chosen by the admin. Results are linked (event_id) but their values are never edited. */
  adopt(ctx, courseId, apply, resolve) {
    Records.guardCourse_(ctx, 'config.edit', courseId); resolve = resolve || {};
    const plan = NavEvents.legacy(ctx, courseId).filter(function (g) { return !g.already_has_event; }), out = { apply: apply === true, adopted: [], skipped_conflicts: [] };
    plan.forEach(function (g) { const k = g.navigation_type_id + '|' + g.test_date, rs = resolve[k]; if (g.conflict && !rs) { out.skipped_conflicts.push({ key: k, distances: g.distances, points_totals: g.points_totals }); return; }
      out.adopted.push({ key: k, distance_km: rs ? rs.distance_km : g.distances[0], points_total: rs ? rs.points_total : g.points_totals[0], records: g.records }); });
    if (apply !== true || !out.adopted.length) return out;
    return Locks.run(function () {
      out.adopted.forEach(function (a) { const parts = a.key.split('|'); const f = NavEvents.clean_(courseId, { navigation_type_id: parts[0], test_date: parts[1], distance_km: a.distance_km, points_total: a.points_total }), now = Util.nowIso();
        const row = Object.assign({ id: Util.uuid(), course_id: courseId }, f, { status: 'IN_PROGRESS', record_status: RECORD_STATUS.ACTIVE, version: 1, request_id: 'legacy-' + a.key, completed_at: '', completed_by: '', created_at: now, created_by: ctx.email, updated_at: now, updated_by: ctx.email });
        if (Db.where('NavigationEvents', function (e) { return e.course_id === courseId && e.request_id === row.request_id; })[0]) return;
        Db.insert('NavigationEvents', row); Audit.log(ctx, { courseId: courseId, action: 'NAVEVENT_ADOPT_LEGACY', table: 'NavigationEvents', recordId: row.id, after: { key: a.key, records: a.records } });
        Db.where('NavigationTests', function (r) { return r.course_id === courseId && !Util.str(r.event_id) && r.navigation_type_id === parts[0] && Util.cellToIsoDate(r.test_date) === parts[1]; }).forEach(function (r) { Db.update('NavigationTests', r.id, { event_id: row.id }); }); });
      return out;
    });
  }
};
