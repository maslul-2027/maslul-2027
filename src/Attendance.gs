/**
 * Attendance (נוכחות) and Marches (מסעות).
 * Approved rules: everyone in scope is PRESENT by default; only absentees are marked; a record is stored for EVERY soldier in scope.
 * No distinction between justified/unjustified absence; "absence_approved" (justified) is admin-only; early exit is optional and secondary.
 * Scope (course / department / team): a commander may only open an activity whose whole scope is inside his assignments.
 * Soldiers: not cancelled and ACTIVE at the time of the activity. Percentages are computed from Snapshot rows only.
 */
const Attendance = {

  eventType: {
    editable: ['event_date', 'activity_type_id', 'description'],
    prepare(courseId, data, existing) {
      const date = Util.isoDate(Util.cellToIsoDate(data.event_date), 'תאריך פעילות');
      const t = Db.get('ActivityTypes', Util.str(data.activity_type_id));
      if (!t || t.course_id !== courseId || (!Util.isTrue(t.active) && !(existing && existing.activity_type_id === t.id))) throw new AppError('VALIDATION', 'סוג פעילות לא תקין.');
      const scope = existing ? { scope_type: existing.scope_type, scope_id: existing.scope_id } : Mods.checkScope_(courseId, data.scope_type, data.scope_id);
      return { event_date: date, activity_type_id: t.id, scope_type: scope.scope_type, scope_id: scope.scope_id, description: Mods.note_(data.description, 300) };
    }
  },
  recordType: {
    editable: ['present', 'early_exit', 'absence_approved', 'notes'],
    prepare(courseId, data, existing) {
      if (!existing) throw new AppError('VALIDATION', 'רשומות נוכחות נוצרות עם הפעילות.');
      return { event_id: existing.event_id, soldier_id: existing.soldier_id, present: Mods.bool_(data.present, 'נוכח'),
        early_exit: data.early_exit === '' || data.early_exit === undefined ? false : Mods.bool_(data.early_exit, 'יציאה מוקדמת'),
        absence_approved: data.absence_approved === '' || data.absence_approved === undefined ? false : Mods.bool_(data.absence_approved, 'היעדרות מאושרת'), notes: Mods.note_(data.notes) };
    }
  },

  /**
   * data: {request_id, event_date, activity_type_id, scope_type, scope_id, description, absent: [{soldier_id, early_exit?, notes?}], early_exit: [soldier_id]}
   * absence_approved is NOT accepted here (admin-only, via record edit). Atomic: event + all rows under the lock; on failure the event is cancelled.
   */
  createEvent(ctx, courseId, data) {
    data = data || {};
    Records.guardCourse_(ctx, 'result.create', courseId);
    const scope = Mods.checkScope_(courseId, data.scope_type, data.scope_id);
    if (!Mods.scopeAllowed_(ctx, courseId, scope.scope_type, scope.scope_id)) throw new AppError('VALIDATION', 'התחולה שנבחרה חורגת מתחום האחריות שלך.');
    const absent = Array.isArray(data.absent) ? data.absent : (data.absent === undefined ? [] : null);
    const early = Array.isArray(data.early_exit) ? data.early_exit : (data.early_exit === undefined ? [] : null);
    if (absent === null || early === null) throw new AppError('VALIDATION', 'רשימת נעדרים לא תקינה.');
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'result.create', courseId);
      if (!Mods.scopeAllowed_(ctx, courseId, scope.scope_type, scope.scope_id)) throw new AppError('VALIDATION', 'התחולה שנבחרה חורגת מתחום האחריות שלך.');
      const inScope = Mods.scopeSoldiers_(ctx, courseId, scope.scope_type, scope.scope_id), byId = Object.create(null); inScope.forEach(function (s) { byId[s.id] = s; });
      const abs = Object.create(null), ear = Object.create(null);
      absent.forEach(function (a) {
        const o = typeof a === 'string' ? { soldier_id: a } : a; Soldiers.scalar_(o && o.soldier_id, 'soldier_id');
        const id = Util.str(o.soldier_id); if (!byId[id]) throw new AppError('VALIDATION', 'חייל שסומן כנעדר אינו בתחום הפעילות.');
        abs[id] = { notes: Mods.note_(o.notes), early_exit: o.early_exit === true };
      });
      early.forEach(function (id0) { Soldiers.scalar_(id0, 'soldier_id'); const id = Util.str(id0); if (!byId[id]) throw new AppError('VALIDATION', 'חייל עם יציאה מוקדמת אינו בתחום הפעילות.'); ear[id] = true; });
      const res = Records.create(ctx, 'AttendanceEvents', courseId, Object.assign({}, data, { scope_type: scope.scope_type, scope_id: scope.scope_id }));
      if (res.duplicate) return { event: res.record, duplicate: true, records: Db.where('AttendanceRecords', function (r) { return r.event_id === res.record.id; }).length };
      const ev = res.record; let n = 0;
      try {
        inScope.forEach(function (s) {
          const a = abs[s.id], now = Util.nowIso();
          Db.insert('AttendanceRecords', { id: Util.uuid(), course_id: courseId, event_id: ev.id, soldier_id: s.id, present: !a, early_exit: !!(ear[s.id] || (a && a.early_exit)), absence_approved: false, notes: a ? a.notes : '',
            created_at: now, created_by: ctx.email, record_status: RECORD_STATUS.ACTIVE, version: 1, request_id: ev.request_id + ':' + s.id, updated_at: now, updated_by: ctx.email });
          n++;
        });
      } catch (e) {
        try { Db.update('AttendanceEvents', ev.id, { record_status: RECORD_STATUS.CANCELLED, cancelled_at: Util.nowIso(), cancelled_by: 'system', cancel_reason: 'יצירת הרשומות נכשלה' }); } catch (e2) { /* surfaced below */ }
        throw e;
      }
      Audit.log(ctx, { courseId: courseId, action: 'ATTENDANCE_RECORDS_CREATED', table: 'AttendanceEvents', recordId: ev.id, after: { records: n, absent: Object.keys(abs).length, scope_type: scope.scope_type } });
      return { event: ev, duplicate: false, records: n };
    });
  },

  /**
   * Returns one row per event: {id, event_date, activity_type_id, type_name, scope_type, scope_id, description, present, absent, early_exits, total, record_status?}.
   * product-dev6.2: counts are computed ONLY over records of soldiers the caller may see (a commander on a course-wide event no longer receives course-wide totals);
   * `absent` = total - present and `early_exits` are server-computed so the UI never derives them from other keys (API<->UI contract: tests/uxqa_contracts.js).
   */
  eventsList(ctx, courseId, opts) {
    opts = opts || {}; Records.guardCourse_(ctx, 'result.read', courseId);
    const types = Object.create(null); Db.where('ActivityTypes', function (t) { return t.course_id === courseId; }).forEach(function (t) { types[t.id] = t.name; });
    const sol = Mods.soldierMap_(courseId), vis = Soldiers.visibleFn_(ctx, courseId), isAdmin = ctx.role === ROLES.ADMIN;
    const sum = Object.create(null); Db.where('AttendanceRecords', function (r) { return r.course_id === courseId && r.record_status === RECORD_STATUS.ACTIVE; }).forEach(function (r) {
      if (!isAdmin && !(sol[r.soldier_id] && vis(sol[r.soldier_id]))) return; (sum[r.event_id] = sum[r.event_id] || []).push(r); });
    return Db.where('AttendanceEvents', function (e) { return e.course_id === courseId && (opts.includeCancelled === true && ctx.role === ROLES.ADMIN ? true : e.record_status === RECORD_STATUS.ACTIVE); })
      .filter(function (e) { return Mods.scopeAllowed_(ctx, courseId, e.scope_type, e.scope_id) || ctx.role === ROLES.ADMIN || Attendance.overlaps_(ctx, courseId, e); })
      .map(function (e) {
        const rs = sum[e.id] || [], present = rs.filter(function (r) { return Util.isTrue(r.present); }).length, early = rs.filter(function (r) { return Util.isTrue(r.early_exit); }).length;
        // D2 sub-cohort rule (REV4): the present / absent split and the early-exit / other split of ONE event (counted inside the caller's scope) are shown only if each side is 0 or >= MIN_GROUP soldiers; otherwise
        // the figures are null + counts_suppressed (generic). The exact per-soldier facts stay in the explicit operational roll (`attendance.roll`, authorised, names).
        const okP = Analytics.splitOk_(present, rs.length - present), okE = Analytics.splitOk_(early, rs.length - early);
        return { id: e.id, event_date: Util.cellToIsoDate(e.event_date), activity_type_id: e.activity_type_id, type_name: types[e.activity_type_id] || '', scope_type: e.scope_type, scope_id: e.scope_id, description: e.description || '',
          present: okP ? present : null, absent: okP ? rs.length - present : null, early_exits: okE ? early : null, total: rs.length, counts_suppressed: okP && okE ? undefined : true, record_status: ctx.role === ROLES.ADMIN ? e.record_status : undefined };
      }).sort(function (a, b) { return a.event_date < b.event_date ? 1 : (a.event_date > b.event_date ? -1 : 0); });
  },
  /** A commander sees an event if it contains at least one soldier he can see (so a course-wide event is visible to everyone assigned, but never lists others' soldiers). */
  overlaps_(ctx, courseId, e) { return Mods.scopeSoldiers_(ctx, courseId, e.scope_type, e.scope_id).length > 0; },

  /** Roll of an event: rows only for soldiers the caller may see (admin: all, incl. inactive). */
  eventRoll(ctx, courseId, eventId) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const e = Db.get('AttendanceEvents', Util.str(eventId));
    if (!e || e.course_id !== courseId || (e.record_status !== RECORD_STATUS.ACTIVE && ctx.role !== ROLES.ADMIN)) throw new AppError('NOT_FOUND', 'הפעילות לא נמצאה.');
    const sol = Mods.soldierMap_(courseId), vis = Soldiers.visibleFn_(ctx, courseId);
    return Db.where('AttendanceRecords', function (r) { return r.event_id === e.id && (ctx.role === ROLES.ADMIN || (r.record_status === RECORD_STATUS.ACTIVE && !!sol[r.soldier_id] && vis(sol[r.soldier_id]))); })
      .map(function (r) { const s = sol[r.soldier_id]; return { id: r.id, soldier_id: r.soldier_id, soldier_name: s ? s.full_name : '', present: Util.isTrue(r.present), early_exit: Util.isTrue(r.early_exit),
        absence_approved: Util.isTrue(r.absence_approved), notes: r.notes || '', own: String(r.created_by).toLowerCase() === ctx.email }; })
      .sort(function (a, b) { return String(a.soldier_name).localeCompare(String(b.soldier_name), 'he'); });
  },

  /** Cumulative attendance % from Snapshot rows (cancelled soldiers / events / records excluded). */
  aggregate_(rows) {
    const a = Calc.attendancePercent(rows);
    return a ? { present: a.present, absent: a.absent, total: a.total, percent: a.percent, percent_display: Util.display1(a.percent), early_exits: rows.filter(function (r) { return Util.isTrue(r.early_exit); }).length, note: '' }
             : { present: 0, absent: 0, total: 0, percent: null, percent_display: null, early_exits: 0, note: 'אין מספיק נתונים' };
  },
  summary(ctx, courseId, soldierId, f) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const rows = Snapshot.rows(ctx, 'AttendanceRecords', courseId, Object.assign({ soldierId: Util.str(soldierId) || undefined }, f || {}));
    return Util.str(soldierId) ? Attendance.aggregate_(rows) : Analytics.groupAttendance_(rows, Snapshot.soldiers(ctx, courseId, (f && (f.departmentId || f.teamId)) ? { departmentId: f.departmentId, teamId: f.teamId } : {}).length);   // D2: no soldierId => group figure, cohort-gated
  },
  /** Soldier timeline entries (date, present?) newest first — history, includes cancelled only for admin. */
  soldierLog(ctx, courseId, soldierId) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const ev = Object.create(null); Db.where('AttendanceEvents', function (e) { return e.course_id === courseId; }).forEach(function (e) { ev[e.id] = e; });
    return Records.list(ctx, 'AttendanceRecords', courseId, { soldierId: Util.str(soldierId) }).filter(function (r) { return ev[r.event_id] && ev[r.event_id].record_status === RECORD_STATUS.ACTIVE; })
      .map(function (r) { return { id: r.id, event_id: r.event_id, date: Util.cellToIsoDate(ev[r.event_id].event_date), present: Util.isTrue(r.present), early_exit: Util.isTrue(r.early_exit) }; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
};

const Marches = {
  recordType: {
    editable: ['march_date', 'location', 'km_no_stretcher', 'km_stretcher'],
    prepare(courseId, data, existing) {
      const date = Util.isoDate(Util.cellToIsoDate(data.march_date), 'תאריך מסע');
      Soldiers.scalar_(data.location, 'location'); const loc = Util.str(data.location); if (!loc || loc.length > 100) throw new AppError('VALIDATION', 'מיקום/מסלול חובה (עד 100 תווים).');
      const km = Calc.marchNormalize(data);
      const scope = existing ? { scope_type: existing.scope_type, scope_id: existing.scope_id } : Mods.checkScope_(courseId, data.scope_type || 'course', data.scope_id || courseId);
      return Object.assign({ march_date: date, location: loc, scope_type: scope.scope_type, scope_id: scope.scope_id }, km);
    }
  },
  attendanceType: {
    editable: ['present', 'notes'],
    prepare(courseId, data, existing) {
      if (!existing) throw new AppError('VALIDATION', 'רשומות נוכחות במסע נוצרות עם המסע.');
      return { march_id: existing.march_id, soldier_id: existing.soldier_id, present: Mods.bool_(data.present, 'נוכח'), notes: Mods.note_(data.notes) };
    }
  },
  /** data: {request_id, march_date, location, km_no_stretcher, km_stretcher, scope_type?, scope_id?, absent: [soldier_id | {soldier_id, notes}]}  (no "completion march" exists). */
  create(ctx, courseId, data) {
    data = data || {}; Records.guardCourse_(ctx, 'result.create', courseId);
    const scope = Mods.checkScope_(courseId, data.scope_type || 'course', data.scope_id || courseId);
    if (!Mods.scopeAllowed_(ctx, courseId, scope.scope_type, scope.scope_id)) throw new AppError('VALIDATION', 'התחולה שנבחרה חורגת מתחום האחריות שלך.');
    const absent = Array.isArray(data.absent) ? data.absent : (data.absent === undefined ? [] : null); if (absent === null) throw new AppError('VALIDATION', 'רשימת נעדרים לא תקינה.');
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'result.create', courseId);
      if (!Mods.scopeAllowed_(ctx, courseId, scope.scope_type, scope.scope_id)) throw new AppError('VALIDATION', 'התחולה שנבחרה חורגת מתחום האחריות שלך.');
      const inScope = Mods.scopeSoldiers_(ctx, courseId, scope.scope_type, scope.scope_id), byId = Object.create(null); inScope.forEach(function (s) { byId[s.id] = s; });
      const abs = Object.create(null);
      absent.forEach(function (a) { const o = typeof a === 'string' ? { soldier_id: a } : a; Soldiers.scalar_(o && o.soldier_id, 'soldier_id'); const id = Util.str(o.soldier_id); if (!byId[id]) throw new AppError('VALIDATION', 'חייל שסומן כנעדר אינו בתחום המסע.'); abs[id] = { notes: Mods.note_(o.notes) }; });
      const res = Records.create(ctx, 'Marches', courseId, Object.assign({}, data, { scope_type: scope.scope_type, scope_id: scope.scope_id }));
      if (res.duplicate) return { march: res.record, duplicate: true };
      const m = res.record; let n = 0;
      try {
        inScope.forEach(function (s) {
          const a = abs[s.id], now = Util.nowIso();
          Db.insert('MarchAttendance', { id: Util.uuid(), course_id: courseId, march_id: m.id, soldier_id: s.id, present: !a, notes: a ? a.notes : '', created_at: now, created_by: ctx.email,
            record_status: RECORD_STATUS.ACTIVE, version: 1, request_id: m.request_id + ':' + s.id, updated_at: now, updated_by: ctx.email });
          n++;
        });
      } catch (e) { try { Db.update('Marches', m.id, { record_status: RECORD_STATUS.CANCELLED, cancelled_at: Util.nowIso(), cancelled_by: 'system', cancel_reason: 'יצירת הרשומות נכשלה' }); } catch (e2) { /* ignore */ } throw e; }
      Audit.log(ctx, { courseId: courseId, action: 'MARCH_ATTENDANCE_CREATED', table: 'Marches', recordId: m.id, after: { records: n, absent: Object.keys(abs).length } });
      return { march: m, duplicate: false, records: n };
    });
  },
  /** March records and optional scoped operational roster. A foreign team may not see a march or its raw counts.
   *  `includeRoster` requires a specific marchId and returns ONLY visible trainees; never used by group analytics.
   */
  list(ctx, courseId, opts) {
    opts = opts || {}; Records.guardCourse_(ctx, 'result.read', courseId);
    const admin = ctx.role === ROLES.ADMIN, bySoldier = Mods.soldierMap_(courseId), visible = Soldiers.visibleFn_(ctx, courseId);
    const attendance = Object.create(null);
    Db.where('MarchAttendance', function (r) { return r.course_id === courseId && r.record_status === RECORD_STATUS.ACTIVE; })
      .forEach(function (r) {
        if (!admin && !(bySoldier[r.soldier_id] && visible(bySoldier[r.soldier_id]))) return;
        (attendance[r.march_id] = attendance[r.march_id] || []).push(r);
      });
    return Db.where('Marches', function (m) {
      return m.course_id === courseId && (opts.includeCancelled === true && admin ? true : m.record_status === RECORD_STATUS.ACTIVE)
        && (!opts.marchId || String(m.id) === String(opts.marchId));
    }).filter(function (m) {
      return admin || Mods.scopeAllowed_(ctx, courseId, m.scope_type, m.scope_id) || Marches.overlaps_(ctx, courseId, m);
    }).map(function (m) {
      const rs = attendance[m.id] || [], present = rs.filter(function (r) { return Util.isTrue(r.present); }).length;
      const splitOk = admin || Analytics.splitOk_(present, rs.length - present);   // admin = exact operational view; D2 suppression protects scoped commanders
      const row = { id: m.id, march_date: Util.cellToIsoDate(m.march_date), location: m.location,
        km_no_stretcher: Number(m.km_no_stretcher), km_stretcher: Number(m.km_stretcher), total_km: Number(m.total_km),
        scope_type: m.scope_type, scope_id: m.scope_id, participants: splitOk ? present : null,
        absent: splitOk ? rs.length - present : null, total: rs.length, counts_suppressed: !splitOk,
        record_status: admin ? m.record_status : undefined };
      // Named attendance is an explicitly requested operational roster, not an analytics aggregate.
      if (opts.includeRoster === true && opts.marchId && String(opts.marchId) === String(m.id)) {
        row.roster = rs.map(function (r) {
          const soldier = bySoldier[r.soldier_id];
          return { id: r.id, soldier_id: r.soldier_id, soldier_name: soldier ? soldier.full_name : '',
            present: Util.isTrue(r.present), version: Number(r.version || 1),
            own: String(r.created_by || '').toLowerCase() === String(ctx.email || '').toLowerCase() };
        }).sort(function (a, b) { return String(a.soldier_name).localeCompare(String(b.soldier_name), 'he'); });
      }
      return row;
    }).sort(function (a, b) { return a.march_date < b.march_date ? 1 : -1; });
  },
  overlaps_(ctx, courseId, m) { return Mods.scopeSoldiers_(ctx, courseId, m.scope_type, m.scope_id).length > 0; },
  /** Operational roll of ONE march: a row per soldier the caller may see (admin: all incl. inactive) — explicit present/absent, never aggregate. Corrections go through correction.request (audited, reviewed). */
  roll(ctx, courseId, marchId) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const m = Db.get('Marches', Util.str(marchId));
    if (!m || m.course_id !== courseId || (m.record_status !== RECORD_STATUS.ACTIVE && ctx.role !== ROLES.ADMIN)) throw new AppError('NOT_FOUND', 'המסע לא נמצא.');
    if (ctx.role !== ROLES.ADMIN && !Mods.scopeAllowed_(ctx, courseId, m.scope_type, m.scope_id) && !Marches.overlaps_(ctx, courseId, m)) throw new AppError('NOT_FOUND', 'המסע לא נמצא.');
    const sol = Mods.soldierMap_(courseId), vis = Soldiers.visibleFn_(ctx, courseId);
    const rows = Db.where('MarchAttendance', function (r) { return r.march_id === m.id && (ctx.role === ROLES.ADMIN || (r.record_status === RECORD_STATUS.ACTIVE && !!sol[r.soldier_id] && vis(sol[r.soldier_id]))); })
      .map(function (r) { const s = sol[r.soldier_id]; return { id: r.id, soldier_id: r.soldier_id, soldier_name: s ? s.full_name : '', present: Util.isTrue(r.present), notes: r.notes || '', own: String(r.created_by).toLowerCase() === ctx.email }; })
      .sort(function (a, b) { return String(a.soldier_name).localeCompare(String(b.soldier_name), 'he'); });
    return rows;
  },
  /** Soldier totals from Snapshot rows: km only for marches he attended; participation count; absences. Sums, not averages. */
  aggregate_(rows) {
    let no = 0, st = 0, n = 0, absent = 0;
    rows.forEach(function (r) { if (Util.isTrue(r.present)) { n++; no += Number(r._parent.km_no_stretcher); st += Number(r._parent.km_stretcher); } else absent++; });
    const r6 = function (x) { return Math.round(x * 1e6) / 1e6; };
    return { marches_attended: n, marches_absent: absent, marches_total: rows.length, km_no_stretcher: r6(no), km_stretcher: r6(st), total_km: r6(no + st), note: rows.length ? '' : 'אין מספיק נתונים' };
  },
  summary(ctx, courseId, soldierId, f) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const rows = Snapshot.rows(ctx, 'MarchAttendance', courseId, Object.assign({ soldierId: Util.str(soldierId) || undefined }, f || {}));
    return Util.str(soldierId) ? Marches.aggregate_(rows) : Analytics.groupMarches_(rows, Snapshot.soldiers(ctx, courseId, (f && (f.departmentId || f.teamId)) ? { departmentId: f.departmentId, teamId: f.teamId } : {}).length);   // D2: no soldierId => group figure, cohort-gated
  },
  soldierLog(ctx, courseId, soldierId) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const m = Object.create(null); Db.where('Marches', function (x) { return x.course_id === courseId; }).forEach(function (x) { m[x.id] = x; });
    return Records.list(ctx, 'MarchAttendance', courseId, { soldierId: Util.str(soldierId) }).filter(function (r) { return m[r.march_id] && m[r.march_id].record_status === RECORD_STATUS.ACTIVE; })
      .map(function (r) { return { id: r.id, march_id: r.march_id, date: Util.cellToIsoDate(m[r.march_id].march_date), location: m[r.march_id].location, present: Util.isTrue(r.present), total_km: Number(m[r.march_id].total_km) }; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
};
