/**
 * Records — generic lifecycle for result tables (append-only philosophy):
 *   commander: create only; after submission no edit/delete; may request a correction (reason required, author only)
 *   admin: direct edit (before/after logged), cancel (soft), restore (no duplicate), review corrections
 * Only tables registered in typeFor_ can be reached through the generic API (whitelist).
 * Each type supplies prepare(courseId, mergedData, existing) => normalised stored fields (validation + derived values).
 */
const Records = {
  typeFor_(table) {
    const types = { NavigationTests: Navigation.recordType, FitnessTests: Fitness.recordType, MarksmanshipTests: Marksmanship.recordType,
      TheoreticalExamAttempts: Exams.attemptType, ExamMeetings: Exams.meetingType, SoldierEvents: SoldierEvents.recordType,
      ReadinessRecords: Readiness.recordType, AttendanceEvents: Attendance.eventType, Marches: Marches.recordType,
      AttendanceRecords: Attendance.recordType, MarchAttendance: Marches.attendanceType };
    const t = Object.prototype.hasOwnProperty.call(types, table) ? types[table] : null;
    if (!t) throw new AppError('VALIDATION', 'סוג רשומה לא נתמך.');
    return t;
  },

  guardCourse_(ctx, action, courseId, extra) {
    if (!Policy.inScope(ctx, courseId)) throw new AppError('FORBIDDEN', 'אין הרשאה לקורס זה.');
    const course = Courses.mustGet_(courseId);
    Policy.require(ctx, action, Object.assign({ courseId: courseId, courseStatus: course.status }, extra || {}));
    return course;
  },

  /** Uniform NOT_FOUND for missing and out-of-scope (no existence leak). */
  load_(ctx, table, id) {
    const rec = Db.get(table, id);
    if (!rec || !Policy.inScope(ctx, rec.course_id)) throw new AppError('NOT_FOUND', 'הרשומה לא נמצאה.');
    // v0.2.2: a cancelled record is indistinguishable from a missing one for non-admins (no existence leak).
    if (rec.record_status !== RECORD_STATUS.ACTIVE && ctx.role !== ROLES.ADMIN) throw new AppError('NOT_FOUND', 'הרשומה לא נמצאה.');
    if (!Records.soldierVisible_(ctx, rec)) throw new AppError('NOT_FOUND', 'הרשומה לא נמצאה.');   // v0.3.1: results of a hidden (inactive/cancelled) soldier are hidden too
    return rec;
  },

  /** Non-admin may only enter results for a soldier he can see (assignment scope, not cancelled, active). Same message as every other 'unavailable' case. */
  assertSoldierAvailable_(ctx, courseId, data) {
    if (ctx.role === ROLES.ADMIN || !data || Util.isBlank(data.soldier_id)) return;
    const s = Db.get('Soldiers', Util.str(data.soldier_id));
    if (!s || s.course_id !== courseId || !Soldiers.visibleFn_(ctx, courseId)(s)) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE);
  },

  SOLDIER_UNAVAILABLE: 'החייל אינו זמין להזנה בקורס זה.',

  /** Non-admins must not reach results of a soldier they cannot see (inactive / cancelled). */
  soldierVisible_(ctx, rec) {
    if (ctx.role === ROLES.ADMIN || !rec.soldier_id) return true;
    return Soldiers.isVisible_(ctx, Db.get('Soldiers', rec.soldier_id));
  },

  activeOnly(rows) { return rows.filter(function (r) { return r.record_status === RECORD_STATUS.ACTIVE; }); },

  create(ctx, table, courseId, data) {
    const type = Records.typeFor_(table);
    Records.guardCourse_(ctx, 'result.create', courseId);
    const requestId = Util.str(data && data.request_id);
    if (!requestId) throw new AppError('VALIDATION', 'חסר מזהה בקשה (למניעת שליחה כפולה).');
    Records.assertSoldierAvailable_(ctx, courseId, data);
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'result.create', courseId);   // re-check inside the lock: course may have been archived meanwhile
      Records.assertSoldierAvailable_(ctx, courseId, data);   // v0.4.0: and the soldier must (still) be inside the commander's assignments
      const dup = Db.where(table, function (r) { return r.course_id === courseId && r.request_id === requestId; })[0];
      if (dup) {
        // v0.3.2: the idempotent replay must not be a side door. Re-check visibility NOW (inside the lock, fresh data) for non-admins.
        if (ctx.role !== ROLES.ADMIN) {
          if (!Records.soldierVisible_(ctx, dup)) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE);   // identical to a fresh request for a hidden soldier
          if (dup.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('VALIDATION', 'מזהה בקשה כבר בשימוש.'); // cancelled record: do not hand it back
        }
        if (String(dup.created_by).toLowerCase() !== ctx.email) throw new AppError('VALIDATION', 'מזהה בקשה כבר בשימוש.');
        return { record: dup, duplicate: true };
      }
      const fields = type.prepare(courseId, data, null);
      const now = Util.nowIso();
      const row = Object.assign({ id: Util.uuid(), course_id: courseId }, fields, {
        record_status: RECORD_STATUS.ACTIVE, version: 1, request_id: requestId,
        created_at: now, created_by: ctx.email, updated_at: now, updated_by: ctx.email
      });
      Db.insert(table, row);
      Audit.log(ctx, { courseId: courseId, action: 'CREATE', table: table, recordId: row.id, after: row });
      return { record: row, duplicate: false };
    });
  },

  list(ctx, table, courseId, opts) {
    Records.typeFor_(table);
    opts = opts || {};
    Records.guardCourse_(ctx, 'result.read', courseId);
    let rows = Db.where(table, function (r) {
      return r.course_id === courseId && (!opts.soldierId || r.soldier_id === opts.soldierId);
    });
    if (!(opts.includeCancelled && ctx.role === ROLES.ADMIN)) rows = Records.activeOnly(rows);
    if (ctx.role !== ROLES.ADMIN) {
      // v0.4.0: one bulk visibility pass (assignments + cancelled/inactive); results of a soldier the caller cannot see are never returned
      const vis = Soldiers.visibleFn_(ctx, courseId), byId = {};
      Db.where('Soldiers', function (s) { return s.course_id === courseId; }).forEach(function (s) { byId[s.id] = s; });
      rows = rows.filter(function (r) { return !r.soldier_id || (!!byId[r.soldier_id] && vis(byId[r.soldier_id])); });
    }
    return rows;
  },

  adminEdit(ctx, table, id, patch, reason) {
    const type = Records.typeFor_(table);
    const rec = Records.load_(ctx, table, id);
    Records.guardCourse_(ctx, 'result.edit', rec.course_id);
    return Locks.run(function () {
      const cur = Records.load_(ctx, table, id);              // reload + re-authorise inside the lock
      Records.guardCourse_(ctx, 'result.edit', cur.course_id);
      return Records.applyEdit_(ctx, type, table, cur, patch, 'EDIT', reason);
    });
  },

  /** Shared by adminEdit and approved corrections. Caller holds the lock and has authorised. */
  applyEdit_(ctx, type, table, existing, patch, action, reason) {
    if (existing.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('RECORD_CANCELLED', 'הרשומה מבוטלת — יש לשחזר אותה לפני עריכה.');
    const keys = Object.keys(patch || {});
    if (!keys.length) throw new AppError('VALIDATION', 'לא התקבלו שינויים.');
    keys.forEach(function (k) {
      if (type.editable.indexOf(k) === -1) throw new AppError('VALIDATION', 'השדה אינו ניתן לעריכה: ' + k);
    });
    const merged = Object.assign({}, existing, patch);
    const fields = type.prepare(existing.course_id, merged, existing);
    const changed = Util.changedKeys(existing, Object.assign({}, existing, fields)).filter(function (k) { return k in fields; });
    if (!changed.length) return { record: existing, changed: [] };
    const upd = Util.pick(fields, changed);
    upd.version = Number(existing.version || 1) + 1;
    upd.updated_at = Util.nowIso();
    upd.updated_by = ctx.email;
    Db.update(table, existing.id, upd);
    Audit.log(ctx, { courseId: existing.course_id, action: action, table: table, recordId: existing.id,
      before: Util.pick(existing, changed), after: Util.pick(upd, changed), reason: reason });
    return { record: Db.get(table, existing.id), changed: changed };
  },

  cancel(ctx, table, id, reason) {
    Records.typeFor_(table);
    const rec = Records.load_(ctx, table, id);
    Records.guardCourse_(ctx, 'result.cancel', rec.course_id);
    return Locks.run(function () {
      const cur = Records.load_(ctx, table, id);
      Records.guardCourse_(ctx, 'result.cancel', cur.course_id);
      if (cur.record_status === RECORD_STATUS.CANCELLED) return { record: cur, changed: false };
      const upd = { record_status: RECORD_STATUS.CANCELLED, cancelled_at: Util.nowIso(), cancelled_by: ctx.email,
        cancel_reason: Util.str(reason), version: Number(cur.version || 1) + 1, updated_at: Util.nowIso(), updated_by: ctx.email };
      Db.update(table, id, upd);
      Audit.log(ctx, { courseId: cur.course_id, action: 'CANCEL', table: table, recordId: id,
        before: { record_status: cur.record_status }, after: { record_status: upd.record_status }, reason: reason });
      return { record: Db.get(table, id), changed: true };
    });
  },

  restore(ctx, table, id) {
    Records.typeFor_(table);
    const rec = Records.load_(ctx, table, id);
    Records.guardCourse_(ctx, 'result.restore', rec.course_id);
    return Locks.run(function () {
      const cur = Records.load_(ctx, table, id);
      Records.guardCourse_(ctx, 'result.restore', cur.course_id);
      if (cur.record_status === RECORD_STATUS.ACTIVE) return { record: cur, changed: false };   // same record, no duplicate
      const upd = { record_status: RECORD_STATUS.ACTIVE, cancelled_at: '', cancelled_by: '', cancel_reason: '',
        version: Number(cur.version || 1) + 1, updated_at: Util.nowIso(), updated_by: ctx.email };
      Db.update(table, id, upd);
      Audit.log(ctx, { courseId: cur.course_id, action: 'RESTORE', table: table, recordId: id,
        before: { record_status: cur.record_status }, after: { record_status: upd.record_status } });
      return { record: Db.get(table, id), changed: true };
    });
  },

  // ---------------- corrections ----------------
  requestCorrection(ctx, table, id, changes, reason) {
    const type = Records.typeFor_(table);
    const rec = Records.load_(ctx, table, id);
    Records.guardCourse_(ctx, 'correction.request', rec.course_id, { ownerEmail: rec.created_by });
    if (Util.isBlank(reason)) throw new AppError('VALIDATION', 'חובה לציין סיבה לבקשת התיקון.');
    const keys = Object.keys(changes || {});
    if (!keys.length) throw new AppError('VALIDATION', 'לא צוינו שינויים מבוקשים.');
    keys.forEach(function (k) {
      if (type.editable.indexOf(k) === -1) throw new AppError('VALIDATION', 'השדה אינו ניתן לתיקון: ' + k);
    });
    if (rec.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('RECORD_CANCELLED', 'הרשומה מבוטלת.');
    type.prepare(rec.course_id, Object.assign({}, rec, changes), rec); // dry-run validation, throws on invalid
    return Locks.run(function () {
      const fresh = Records.load_(ctx, table, id);            // reload inside the lock and re-verify everything
      Records.guardCourse_(ctx, 'correction.request', fresh.course_id, { ownerEmail: fresh.created_by });
      if (fresh.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('RECORD_CANCELLED', 'הרשומה מבוטלת.');
      type.prepare(fresh.course_id, Object.assign({}, fresh, changes), fresh);
      const pending = Db.where('CorrectionRequests', function (q) {
        return q.table_name === table && q.record_id === id && q.status === 'pending';
      })[0];
      if (pending) throw new AppError('PENDING_EXISTS', 'כבר קיימת בקשת תיקון ממתינה לרשומה זו.');
      const snapSrc = typeof type.snapshotSource === 'function' ? type.snapshotSource(fresh) : fresh;   // v product-dev5 (F-1): types whose editable fields are not columns (FitnessTests components live in raw_values_json) supply the readable source
      const before = {}; keys.forEach(function (k) { before[k] = snapSrc[k] === undefined || snapSrc[k] === null ? '' : snapSrc[k]; });   // v product-dev2: snapshot of the previous values AT REQUEST TIME (never recomputed later)
      const row = { id: Util.uuid(), course_id: rec.course_id, table_name: table, record_id: id, changes_json: Util.jsonCell(changes), before_json: Util.jsonCell(before),
        reason: Util.str(reason), requested_by: ctx.email, requested_at: Util.nowIso(), status: 'pending' };
      Db.insert('CorrectionRequests', row);
      Audit.log(ctx, { courseId: rec.course_id, action: 'CORRECTION_REQUEST', table: table, recordId: id, after: changes, reason: reason });
      return row;
    });
  },

  listCorrections(ctx, courseId, status) {
    Records.guardCourse_(ctx, ctx.role === ROLES.ADMIN ? 'correction.review' : 'correction.history', courseId);
    const rows = Db.where('CorrectionRequests', function (q) {
      if (q.course_id !== courseId) return false;
      if (status && q.status !== status) return false;
      if (ctx.role === ROLES.ADMIN) return true;
      if (q.requested_by !== ctx.email) return false;
      // v0.2.2: commanders never see requests (changes_json / reason) of records that are cancelled or gone.
      const orig = Db.get(q.table_name, q.record_id);
      return !!orig && orig.course_id === courseId && orig.record_status === RECORD_STATUS.ACTIVE && Records.soldierVisible_(ctx, orig);
    });
    // product-dev2: every row carries the stored snapshot (before: object | null for old requests without one) and the soldier of the record (only rows the caller may already see).
    return rows.map(function (q) {
      const orig = Db.get(q.table_name, q.record_id), sol = orig && orig.soldier_id ? Db.get('Soldiers', orig.soldier_id) : null;
      const hasSnap = !Util.isBlank(q.before_json);
      return Object.assign({}, q, { before: hasSnap ? Util.parseJson(q.before_json, null) : null, has_snapshot: hasSnap && Util.parseJson(q.before_json, null) !== null,
        soldier_id: sol ? sol.id : '', soldier_name: sol ? sol.full_name : '' });
    });
  },

  reviewCorrection(ctx, requestId, decision, note) {
    const req = Db.get('CorrectionRequests', requestId);
    if (!req || !Policy.inScope(ctx, req.course_id)) throw new AppError('NOT_FOUND', 'הבקשה לא נמצאה.');
    Records.guardCourse_(ctx, 'correction.review', req.course_id);
    if (decision !== 'approve' && decision !== 'reject') throw new AppError('VALIDATION', 'החלטה לא תקינה.');
    return Locks.run(function () {
      const cur = Db.get('CorrectionRequests', requestId);
      if (cur.status !== 'pending') throw new AppError('VALIDATION', 'הבקשה כבר טופלה.');
      Records.guardCourse_(ctx, 'correction.review', cur.course_id);   // course may have been archived since the pre-check
      if (decision === 'approve') {
        const type = Records.typeFor_(cur.table_name);
        const existing = Db.get(cur.table_name, cur.record_id);
        if (!existing || existing.course_id !== cur.course_id) throw new AppError('NOT_FOUND', 'הרשומה לא נמצאה.');
        Records.applyEdit_(ctx, type, cur.table_name, existing, Util.parseJson(cur.changes_json, {}), 'CORRECTION_APPLIED', cur.reason);
      }
      Db.update('CorrectionRequests', requestId, { status: decision === 'approve' ? 'approved' : 'rejected',
        reviewed_by: ctx.email, reviewed_at: Util.nowIso(), review_note: Util.str(note) });
      Audit.log(ctx, { courseId: cur.course_id, action: decision === 'approve' ? 'CORRECTION_APPROVED' : 'CORRECTION_REJECTED',
        table: cur.table_name, recordId: cur.record_id, reason: note });
      return Db.get('CorrectionRequests', requestId);
    });
  },

  /** Correction history visible to commanders (previous/new values) — read only. */
  history(ctx, table, id) {
    Records.typeFor_(table);
    const rec = Records.load_(ctx, table, id);
    if (rec.record_status !== RECORD_STATUS.ACTIVE && ctx.role !== ROLES.ADMIN) throw new AppError('NOT_FOUND', 'הרשומה לא נמצאה.');  // cancelled records are invisible to commanders
    Records.guardCourse_(ctx, 'correction.history', rec.course_id);
    const keep = ['CREATE', 'EDIT', 'CANCEL', 'RESTORE', 'CORRECTION_REQUEST', 'CORRECTION_APPLIED', 'CORRECTION_APPROVED', 'CORRECTION_REJECTED'];
    const names = Navigation.userNames_();   // v0.4.0: commanders see display names, never other users' e-mail addresses
    return Db.where('AuditLog', function (a) { return a.table_name === table && a.record_id === id && keep.indexOf(a.action) !== -1; })
      .map(function (a) {
        return { action: a.action, actor: ctx.role === ROLES.ADMIN ? a.actor_email : (names[String(a.actor_email).toLowerCase()] || ''), at: a.timestamp, reason: a.reason,
          before: Util.parseJson(a.before_json, null), after: a.action === 'CREATE' ? null : Util.parseJson(a.after_json, null) };
      });
  }
};
