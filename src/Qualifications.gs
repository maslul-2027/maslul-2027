/**
 * Qualifications (הכשרות והסמכות) — v1.0.0.
 * Approved rules: definition of "completed" is the admin's own text (never invented); a course-wide qualification is assigned to every soldier of the
 * course (including soldiers added later); individual scope = chosen soldiers only; a commander may REQUEST an exclusion (reason) and the admin decides;
 * target date postponement is admin-only with a reason and keeps the full date history; every status change is kept in the assignment's history.
 * NO ranking and NO expiry tracking. Completion % is computed from Snapshot rows (cancelled soldiers excluded, excluded-by-approval not counted).
 */
const Qualifications = {
  STATUSES: ['pending', 'in_progress', 'completed'],
  LABELS: { pending: 'טרם החל', in_progress: 'בתהליך', completed: 'הושלם' },

  view_(q) { return { id: q.id, name: q.name, completion_terms: q.completion_terms, scope_type: q.scope_type, target_date: Util.cellToIsoDate(q.target_date), early_alert_days: q.early_alert_days === '' ? null : Number(q.early_alert_days), active: Util.isTrue(q.active) }; },

  define(ctx, courseId, p) {
    p = p || {}; Records.guardCourse_(ctx, 'qual.define', courseId);
    const mk = function () {
      ['name', 'completion_terms', 'scope_type', 'target_date', 'soldier_ids'].forEach(function (k) { if (k !== 'soldier_ids') Soldiers.scalar_(p[k], k); });
      const name = Util.str(p.name); if (!name || name.length > 80) throw new AppError('VALIDATION', 'שם הכשרה חובה (עד 80 תווים).');
      const terms = Mods.note_(p.completion_terms, 300); if (!terms) throw new AppError('VALIDATION', 'חובה להגדיר מהו תנאי ההשלמה (הטקסט נקבע על ידי מנהל המערכת).');
      const scope = Util.str(p.scope_type) || 'course'; if (['course', 'individual'].indexOf(scope) === -1) throw new AppError('VALIDATION', 'תחולה: קורס מלא או אישית.');
      const target = Util.isBlank(p.target_date) ? '' : Util.isoDate(p.target_date, 'תאריך יעד');
      let early = ''; if (!Util.isBlank(p.early_alert_days)) { early = Util.numOrNull(p.early_alert_days, 'ימי התראה'); if (!Number.isInteger(early) || early < 0 || early > 365) throw new AppError('VALIDATION', 'ימי התראה: מספר שלם 0–365.'); }
      let ids = [];
      if (scope === 'individual') {
        if (!Array.isArray(p.soldier_ids) || !p.soldier_ids.length) throw new AppError('VALIDATION', 'הכשרה אישית מחייבת בחירת חיילים.');
        ids = Array.from(new Set(p.soldier_ids.map(function (i) { Soldiers.scalar_(i, 'soldier_id'); return Util.str(i); })));
        ids.forEach(function (i) { Mods.availableSoldier_(courseId, i); });
      } else if (Array.isArray(p.soldier_ids) && p.soldier_ids.length) throw new AppError('VALIDATION', 'הכשרה ברמת קורס אינה מקבלת רשימת חיילים.');
      return { name: name, terms: terms, scope: scope, target: target, early: early, ids: ids };
    };
    const v = mk();
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'qual.define', courseId);
      if (Db.where('Qualifications', function (q) { return q.course_id === courseId && String(q.name).toLowerCase() === v.name.toLowerCase(); }).length) throw new AppError('DUPLICATE', 'הכשרה בשם זה כבר קיימת.');
      const row = { id: Util.uuid(), course_id: courseId, name: v.name, completion_terms: v.terms, scope_type: v.scope, target_date: v.target, early_alert_days: v.early, active: true, created_at: Util.nowIso(), created_by: ctx.email };
      Db.insert('Qualifications', row);
      Audit.log(ctx, { courseId: courseId, action: 'QUAL_DEFINE', table: 'Qualifications', recordId: row.id, after: row });
      const n = v.scope === 'course' ? Qualifications.sync_(ctx, courseId) : Qualifications.assign_(ctx, courseId, row, v.ids);
      return { qualification: Qualifications.view_(row), assigned: n };
    });
  },

  newAssignment_(ctx, courseId, q, soldierId) {
    const now = Util.nowIso();
    const a = { id: Util.uuid(), course_id: courseId, qualification_id: q.id, soldier_id: soldierId, status: 'pending', completion_date: '', score: '', notes: '', exclusion_status: '', exclusion_reason: '', exclusion_requested_by: '', exclusion_reviewed_by: '',
      status_history_json: JSON.stringify([{ status: 'pending', at: now, by: ctx ? ctx.email : 'system' }]), record_status: RECORD_STATUS.ACTIVE, created_at: now, created_by: ctx ? ctx.email : 'system', updated_at: now, updated_by: ctx ? ctx.email : 'system', version: 1 };
    Db.insert('QualificationAssignments', a); return a;
  },
  assign_(ctx, courseId, q, ids) {
    let n = 0; const have = Object.create(null); Db.where('QualificationAssignments', function (a) { return a.qualification_id === q.id; }).forEach(function (a) { have[a.soldier_id] = true; });
    ids.forEach(function (i) { if (!have[i]) { Qualifications.newAssignment_(ctx, courseId, q, i); n++; } });
    return n;
  },
  /** Idempotent: makes sure every non-cancelled soldier of the course has an assignment for every ACTIVE course-wide qualification. Called on create / restore of a soldier. */
  sync_(ctx, courseId) {
    let n = 0;
    const sols = Db.where('Soldiers', function (s) { return s.course_id === courseId && s.record_status === RECORD_STATUS.ACTIVE; });
    Db.where('Qualifications', function (q) { return q.course_id === courseId && q.scope_type === 'course' && Util.isTrue(q.active); }).forEach(function (q) { n += Qualifications.assign_(ctx, courseId, q, sols.map(function (s) { return s.id; })); });
    return n;
  },

  list(ctx, courseId) {
    Records.guardCourse_(ctx, 'course.read', courseId);
    return Db.where('Qualifications', function (q) { return q.course_id === courseId && (ctx.role === ROLES.ADMIN || Util.isTrue(q.active)); }).map(Qualifications.view_).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'he'); });
  },
  setActive(ctx, id, active, reason) {
    const q = Db.get('Qualifications', Util.str(id)); if (!q || !Policy.inScope(ctx, q.course_id)) throw new AppError('NOT_FOUND', 'הכשרה לא נמצאה.');
    Records.guardCourse_(ctx, 'qual.define', q.course_id); if (typeof active !== 'boolean') throw new AppError('VALIDATION', 'סטטוס לא תקין.'); reason = Mods.reason_(reason, true);
    return Locks.run(function () {
      const cur = Db.get('Qualifications', q.id); Records.guardCourse_(ctx, 'qual.define', cur.course_id);
      Db.update('Qualifications', cur.id, { active: active }); Audit.log(ctx, { courseId: cur.course_id, action: 'QUAL_ACTIVITY', table: 'Qualifications', recordId: cur.id, before: { active: Util.isTrue(cur.active) }, after: { active: active }, reason: reason });
      if (active) Qualifications.sync_(ctx, cur.course_id);
      return Qualifications.view_(Db.get('Qualifications', cur.id));
    });
  },

  /** Admin: move the target date. Reason required; every change kept in QualificationDueDateHistory (original -> new). */
  postpone(ctx, id, newDate, reason) {
    const q = Db.get('Qualifications', Util.str(id)); if (!q || !Policy.inScope(ctx, q.course_id)) throw new AppError('NOT_FOUND', 'הכשרה לא נמצאה.');
    Records.guardCourse_(ctx, 'qual.postpone', q.course_id); reason = Mods.reason_(reason, true);
    Soldiers.scalar_(newDate, 'target_date'); const nd = Util.isoDate(newDate, 'תאריך יעד חדש');
    return Locks.run(function () {
      const cur = Db.get('Qualifications', q.id); Records.guardCourse_(ctx, 'qual.postpone', cur.course_id);
      const old = Util.cellToIsoDate(cur.target_date); if (old === nd) throw new AppError('VALIDATION', 'התאריך לא השתנה.');
      Db.update('Qualifications', cur.id, { target_date: nd });
      Db.insert('QualificationDueDateHistory', { id: Util.uuid(), course_id: cur.course_id, qualification_id: cur.id, original_date: old, new_date: nd, reason: String(reason), changed_by: ctx.email, changed_at: Util.nowIso() });
      Audit.log(ctx, { courseId: cur.course_id, action: 'QUAL_POSTPONE', table: 'Qualifications', recordId: cur.id, before: { target_date: old }, after: { target_date: nd }, reason: reason });
      return Qualifications.view_(Db.get('Qualifications', cur.id));
    });
  },
  dueHistory(ctx, id) {
    const q = Db.get('Qualifications', Util.str(id)); if (!q || !Policy.inScope(ctx, q.course_id)) throw new AppError('NOT_FOUND', 'הכשרה לא נמצאה.');
    Records.guardCourse_(ctx, 'course.read', q.course_id);
    return Db.where('QualificationDueDateHistory', function (h) { return h.qualification_id === q.id; }).map(function (h) { return { original_date: Util.cellToIsoDate(h.original_date), new_date: Util.cellToIsoDate(h.new_date), reason: h.reason, changed_by: h.changed_by, changed_at: h.changed_at }; });
  },

  /** Assignment visible to the caller? (same visibility as the soldier). Uniform NOT_FOUND otherwise. */
  load_(ctx, id) {
    const a = Db.get('QualificationAssignments', Util.str(typeof id === 'string' ? id : ''));
    const s = a ? Db.get('Soldiers', a.soldier_id) : null;
    if (!a || !Policy.inScope(ctx, a.course_id) || !s || !Soldiers.visibleFn_(ctx, a.course_id)(s)) throw new AppError('NOT_FOUND', 'השיוך לא נמצא.');
    return a;
  },
  rowView_(ctx, a, s, q) {
    const o = { id: a.id, qualification_id: a.qualification_id, qualification_name: q ? q.name : '', soldier_id: a.soldier_id, soldier_name: s ? s.full_name : '', status: a.status, status_label: Qualifications.LABELS[a.status] || '',
      completion_date: Util.cellToIsoDate(a.completion_date), notes: a.notes, exclusion_status: a.exclusion_status || '', excluded: a.exclusion_status === 'approved', exclusion_reason: a.exclusion_reason || '', target_date: q ? Util.cellToIsoDate(q.target_date) : '', updated_at: a.updated_at,
      history: Util.parseJson(a.status_history_json, []), record_status: a.record_status };
    return o;
  },

  /** Update status / completion date / notes. Commander only inside his visibility. Concurrency: expected_updated_at. Every change appended to the status history. */
  update(ctx, id, patch, expected, reason) {
    patch = patch || {}; reason = Mods.reason_(reason, false); const pre = Qualifications.load_(ctx, id); Records.guardCourse_(ctx, 'qual.update', pre.course_id);
    Soldiers.scalar_(patch.status, 'status'); Soldiers.scalar_(patch.completion_date, 'completion_date'); Soldiers.scalar_(patch.notes, 'notes');
    if (Object.keys(patch).some(function (k) { return ['status', 'completion_date', 'notes'].indexOf(k) === -1; })) throw new AppError('VALIDATION', 'שדה לא ניתן לעדכון.');
    return Locks.run(function () {
      const cur = Qualifications.load_(ctx, pre.id); Records.guardCourse_(ctx, 'qual.update', cur.course_id);
      if (cur.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('NOT_FOUND', 'השיוך לא נמצא.');
      if (!Util.isBlank(expected) && String(expected) !== String(cur.updated_at)) throw new AppError('CONFLICT', 'הרשומה עודכנה בינתיים — רעננו ונסו שוב.');
      if (cur.exclusion_status === 'approved') throw new AppError('VALIDATION', 'החייל הוחרג מהכשרה זו באישור מנהל.');
      const st = patch.status === undefined ? cur.status : Util.str(patch.status);
      if (Qualifications.STATUSES.indexOf(st) === -1) throw new AppError('VALIDATION', 'סטטוס לא תקין.');
      let cd = patch.completion_date === undefined ? (st === 'completed' ? Util.cellToIsoDate(cur.completion_date) : '') : (Util.isBlank(patch.completion_date) ? '' : Util.isoDate(patch.completion_date, 'תאריך השלמה'));
      if (st === 'completed' && !cd) throw new AppError('VALIDATION', 'הושלם מחייב תאריך השלמה.');
      if (st !== 'completed' && cd) throw new AppError('VALIDATION', 'תאריך השלמה אפשרי רק בסטטוס הושלם.');
      const notes = patch.notes === undefined ? cur.notes : Mods.note_(patch.notes, 300);
      if (st === cur.status && cd === Util.cellToIsoDate(cur.completion_date) && notes === cur.notes) throw new AppError('VALIDATION', 'לא בוצע שינוי.');
      if (cur.status === 'completed' && st !== 'completed' && Util.isBlank(reason)) throw new AppError('VALIDATION', 'ביטול השלמה מחייב סיבה.');
      const now = Util.nowIso(), hist = Util.parseJson(cur.status_history_json, []); if (st !== cur.status || cd !== Util.cellToIsoDate(cur.completion_date)) hist.push({ status: st, completion_date: cd, at: now, by: ctx.email, reason: Util.str(reason) });
      Db.update('QualificationAssignments', cur.id, { status: st, completion_date: cd, notes: notes, status_history_json: JSON.stringify(hist), updated_at: now, updated_by: ctx.email, version: Number(cur.version || 1) + 1 });
      Audit.log(ctx, { courseId: cur.course_id, action: 'QUAL_UPDATE', table: 'QualificationAssignments', recordId: cur.id, before: { status: cur.status, completion_date: cur.completion_date, notes: cur.notes }, after: { status: st, completion_date: cd, notes: notes }, reason: reason });
      return Qualifications.rowView_(ctx, Db.get('QualificationAssignments', cur.id), Db.get('Soldiers', cur.soldier_id), Db.get('Qualifications', cur.qualification_id));
    });
  },

  /** Commander requests an exclusion (with a reason); admin approves/rejects. */
  requestExclusion(ctx, id, reason) {
    const pre = Qualifications.load_(ctx, id); Records.guardCourse_(ctx, 'qual.exclusion.request', pre.course_id);
    reason = Mods.reason_(reason, true);
    return Locks.run(function () {
      const cur = Qualifications.load_(ctx, pre.id); Records.guardCourse_(ctx, 'qual.exclusion.request', cur.course_id);
      if (cur.exclusion_status === 'requested' || cur.exclusion_status === 'approved') throw new AppError('DUPLICATE', 'כבר קיימת בקשת הוצאה או שההוצאה אושרה.');
      Db.update('QualificationAssignments', cur.id, { exclusion_status: 'requested', exclusion_reason: Mods.note_(reason, 300), exclusion_requested_by: ctx.email, updated_at: Util.nowIso(), updated_by: ctx.email, version: Number(cur.version || 1) + 1 });
      Audit.log(ctx, { courseId: cur.course_id, action: 'QUAL_EXCL_REQUEST', table: 'QualificationAssignments', recordId: cur.id, before: { exclusion_status: cur.exclusion_status }, after: { exclusion_status: 'requested' }, reason: reason });
      return { id: cur.id, exclusion_status: 'requested' };
    });
  },
  reviewExclusion(ctx, id, decision, note) {
    const a = Db.get('QualificationAssignments', Util.str(typeof id === 'string' ? id : '')); if (!a || !Policy.inScope(ctx, a.course_id)) throw new AppError('NOT_FOUND', 'השיוך לא נמצא.');
    Records.guardCourse_(ctx, 'qual.exclusion.review', a.course_id); if (decision !== 'approve' && decision !== 'reject') throw new AppError('VALIDATION', 'החלטה לא תקינה.');
    return Locks.run(function () {
      const cur = Db.get('QualificationAssignments', a.id); Records.guardCourse_(ctx, 'qual.exclusion.review', cur.course_id);
      if (cur.exclusion_status !== 'requested') throw new AppError('VALIDATION', 'אין בקשת הוצאה ממתינה.');
      const to = decision === 'approve' ? 'approved' : 'rejected';
      Db.update('QualificationAssignments', cur.id, { exclusion_status: to, exclusion_reviewed_by: ctx.email, updated_at: Util.nowIso(), updated_by: ctx.email, version: Number(cur.version || 1) + 1 });
      Audit.log(ctx, { courseId: cur.course_id, action: 'QUAL_EXCL_REVIEW', table: 'QualificationAssignments', recordId: cur.id, before: { exclusion_status: 'requested' }, after: { exclusion_status: to }, reason: Util.str(note) });
      return { id: cur.id, exclusion_status: to };
    });
  },

  /** Assignment list (visibility applied). opts: qualificationId, soldierId, exclusionStatus, includeCancelled(admin). */
  assignments(ctx, courseId, opts) {
    opts = opts || {}; Records.guardCourse_(ctx, 'result.read', courseId);
    ['qualificationId', 'soldierId', 'exclusionStatus'].forEach(function (k) { Soldiers.scalar_(opts[k], k); });
    const vis = Soldiers.visibleFn_(ctx, courseId), sol = Mods.soldierMap_(courseId), qs = {}; Db.where('Qualifications', function (q) { return q.course_id === courseId; }).forEach(function (q) { qs[q.id] = q; });
    return Db.where('QualificationAssignments', function (a) {
      if (a.course_id !== courseId || !sol[a.soldier_id] || !vis(sol[a.soldier_id])) return false;
      if (a.record_status !== RECORD_STATUS.ACTIVE) return false;
      if (opts.qualificationId && a.qualification_id !== Util.str(opts.qualificationId)) return false;
      if (opts.soldierId && a.soldier_id !== Util.str(opts.soldierId)) return false;
      if (opts.exclusionStatus && a.exclusion_status !== Util.str(opts.exclusionStatus)) return false;
      return true;
    }).map(function (a) { return Qualifications.rowView_(ctx, a, sol[a.soldier_id], qs[a.qualification_id]); });
  },

  /** Current-state aggregate from Snapshot rows. Excluded-by-approval soldiers are not counted. No ranking. */
  aggregate_(courseId, rows, quals) {
    return quals.map(function (q) {
      const mine = rows.filter(function (r) { return r.qualification_id === q.id && r.exclusion_status !== 'approved'; });
      const done = mine.filter(function (r) { return r.status === 'completed'; }).length;
      return { qualification_id: q.id, name: q.name, assigned: mine.length, completed: done, in_progress: mine.filter(function (r) { return r.status === 'in_progress'; }).length, pending: mine.filter(function (r) { return r.status === 'pending'; }).length,
        excluded: rows.filter(function (r) { return r.qualification_id === q.id && r.exclusion_status === 'approved'; }).length, completion_percent: mine.length ? Math.round(done / mine.length * 1000) / 10 : null };
    });
  },
  summary(ctx, courseId, f) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const quals = Db.where('Qualifications', function (q) { return q.course_id === courseId && Util.isTrue(q.active); });
    return Analytics.groupQualifications_(courseId, Snapshot.rows(ctx, 'QualificationAssignments', courseId, f || {}), quals, Snapshot.soldiers(ctx, courseId, f || {}).length);   // D2: group figure, cohort-gated
  },
  soldierSummary(ctx, courseId, soldierId) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const rows = Snapshot.rows(ctx, 'QualificationAssignments', courseId, { soldierId: Util.str(soldierId) }), qs = {}; Db.where('Qualifications', function (q) { return q.course_id === courseId; }).forEach(function (q) { qs[q.id] = q; });
    const counted = rows.filter(function (r) { return r.exclusion_status !== 'approved' && qs[r.qualification_id] && Util.isTrue(qs[r.qualification_id].active); });
    const done = counted.filter(function (r) { return r.status === 'completed'; }).length;
    return { assigned: counted.length, completed: done, percent: counted.length ? Math.round(done / counted.length * 1000) / 10 : null, items: rows.map(function (r) { return Qualifications.rowView_(null, r, r._soldier, qs[r.qualification_id]); }), note: counted.length ? '' : 'אין הכשרות משויכות' };
  },

  /** Items for the alert engine: open assignments with a target date (yellow within early_alert_days, red when overdue). */
  dueItems_(courseId, today) {
    const out = [], qs = Db.where('Qualifications', function (q) { return q.course_id === courseId && Util.isTrue(q.active) && !Util.isBlank(q.target_date); });
    const early = Settings.get(courseId, 'qual.early_alert_days', today);
    qs.forEach(function (q) {
      const td = Util.cellToIsoDate(q.target_date), days = q.early_alert_days === '' ? early : Number(q.early_alert_days);
      const limit = new Date(Date.parse(td + 'T00:00:00Z') - days * 86400000).toISOString().slice(0, 10);
      Db.where('QualificationAssignments', function (a) { return a.qualification_id === q.id && a.record_status === RECORD_STATUS.ACTIVE && a.status !== 'completed' && a.exclusion_status !== 'approved'; }).forEach(function (a) {
        const s = Db.get('Soldiers', a.soldier_id); if (!s || s.record_status !== RECORD_STATUS.ACTIVE) return;
        if (today > td) out.push({ assignment: a, qualification: q, soldier: s, urgency: 'red', due_date: td });
        else if (today >= limit) out.push({ assignment: a, qualification: q, soldier: s, urgency: 'yellow', due_date: td });
      });
    });
    return out;
  }
};
