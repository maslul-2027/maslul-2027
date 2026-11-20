/**
 * Readiness (כשירות ומגבלות) and soldier events/achievements.
 * Readiness: fit / fit_with_restrictions / unfit; restrictions are operational free text; NO medical diagnoses and NO severity score (spec).
 * Every re-assessment is stored (ReadinessRecords) + logged (ReadinessReviews). Missing = "not entered" — never treated as fit.
 */
const Readiness = {
  STATUSES: ['fit', 'fit_with_restrictions', 'unfit'],
  LABELS: { fit: 'כשיר', fit_with_restrictions: 'כשיר עם מגבלות', unfit: 'לא כשיר' },

  recordType: {
    editable: ['soldier_id', 'status', 'restrictions', 'start_date', 'next_review_date'],
    prepare(courseId, data, existing) {
      const s = Mods.availableSoldier_(courseId, data.soldier_id);
      Soldiers.scalar_(data.status, 'status'); const st = Util.str(data.status);
      if (Readiness.STATUSES.indexOf(st) === -1) throw new AppError('VALIDATION', 'סטטוס כשירות לא תקין.');
      const restr = Mods.note_(data.restrictions, 300);
      if (st === 'fit_with_restrictions' && !restr) throw new AppError('VALIDATION', 'כשיר עם מגבלות מחייב תיאור מגבלות פעילות.');
      if (st === 'fit' && restr) throw new AppError('VALIDATION', 'כשיר אינו כולל מגבלות — יש לבחור "כשיר עם מגבלות".');
      const start = Util.isoDate(Util.cellToIsoDate(data.start_date), 'תאריך התחלה');
      let next = ''; if (!Util.isBlank(data.next_review_date)) { next = Util.isoDate(Util.cellToIsoDate(data.next_review_date), 'מועד בדיקה הבא'); if (next < start) throw new AppError('VALIDATION', 'מועד הבדיקה הבא קודם לתאריך ההתחלה.'); }
      return { soldier_id: s.id, status: st, restrictions: restr, start_date: start, next_review_date: next };
    }
  },

  /** New assessment = new record + review log row (atomic under the lock). Idempotent by request_id. */
  assess(ctx, courseId, data) {
    return Locks.run(function () {
      const res = Records.create(ctx, 'ReadinessRecords', courseId, data);
      if (!res.duplicate) {
        const r = res.record;
        Db.insert('ReadinessReviews', { id: Util.uuid(), course_id: courseId, soldier_id: r.soldier_id, review_date: Util.cellToIsoDate(r.start_date), decision: r.status, changed_restrictions: r.restrictions, next_review_date: Util.cellToIsoDate(r.next_review_date), created_at: Util.nowIso(), created_by: ctx.email });
      }
      return res;
    });
  },

  list(ctx, courseId, opts) { return Mods.history(ctx, 'ReadinessRecords', courseId, opts, 'start_date', function (r) { return { status: r.status, status_label: Readiness.LABELS[r.status] || '', restrictions: r.restrictions || '', start_date: Util.cellToIsoDate(r.start_date), next_review_date: Util.cellToIsoDate(r.next_review_date) }; }); },

  /** Current status per soldier from Snapshot rows (latest start_date, then creation). soldiers without a record => status null ("לא הוזן"). */
  current_(rows) {
    const cur = {}; rows.slice().sort(function (a, b) { const x = Util.cellToIsoDate(a.start_date), y = Util.cellToIsoDate(b.start_date); return x === y ? String(a.created_at).localeCompare(String(b.created_at)) : (x < y ? -1 : 1); })
      .forEach(function (r) { cur[r.soldier_id] = r; });
    return cur;
  },
  /**
   * GROUP summary (route readiness.summary, Dashboard, Assistant, Reports): status counts only, cohort-gated (D2 sub-cohort rule: every part 0 or >= MIN_GROUP soldiers, else ALL parts hidden) and
   * NO per-soldier element of any kind. The per-soldier operational list lives in `notEntered` (explicit operational route, never reached from a group screen's data).
   */
  summary(ctx, courseId, f) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const soldiers = Snapshot.soldiers(ctx, courseId, f || {}), cur = Readiness.current_(Snapshot.rows(ctx, 'ReadinessRecords', courseId, f || {}));
    const counts = { fit: 0, fit_with_restrictions: 0, unfit: 0, not_entered: 0 };
    soldiers.forEach(function (s) { const r = cur[s.id]; if (r) counts[r.status]++; else counts.not_entered++; });
    const okC = Analytics.catOk_([counts.fit, counts.fit_with_restrictions, counts.unfit, counts.not_entered]);
    return { total: soldiers.length, counts: okC ? counts : { fit: null, fit_with_restrictions: null, unfit: null, not_entered: null }, counts_suppressed: okC ? undefined : true, reason: okC ? undefined : Analytics.cohortReason_() };
  },
  groupSummary_(ctx, courseId, f) { return Readiness.summary(ctx, courseId, f); },
  /** OPERATIONAL (category B): the soldiers of the caller's scope that have no readiness status yet — an action queue (ids only; the names come from the authorised soldiers.list). Same result.read scope as readiness.list. */
  notEntered(ctx, courseId, f) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const soldiers = Snapshot.soldiers(ctx, courseId, f || {}), cur = Readiness.current_(Snapshot.rows(ctx, 'ReadinessRecords', courseId, f || {}));
    return soldiers.filter(function (s) { return !cur[s.id]; }).map(function (s) { return { soldier_id: s.id }; });
  },
  soldierCurrent(ctx, courseId, soldierId) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const r = Readiness.current_(Snapshot.rows(ctx, 'ReadinessRecords', courseId, { soldierId: Util.str(soldierId) }))[Util.str(soldierId)];
    return r ? { status: r.status, label: Readiness.LABELS[r.status], restrictions: r.restrictions, start_date: Util.cellToIsoDate(r.start_date), next_review_date: Util.cellToIsoDate(r.next_review_date) } : { status: null, label: 'לא הוזן', restrictions: '', note: 'אין מספיק נתונים' };
  }
};

const SoldierEvents = {
  TYPES: ['event', 'achievement'], LABELS: { event: 'אירוע', achievement: 'הישג' },
  recordType: {
    editable: ['soldier_id', 'event_date', 'event_type', 'description'],
    prepare(courseId, data, existing) {
      const s = Mods.availableSoldier_(courseId, data.soldier_id);
      Soldiers.scalar_(data.event_type, 'event_type'); const t = Util.str(data.event_type);
      if (SoldierEvents.TYPES.indexOf(t) === -1) throw new AppError('VALIDATION', 'סוג חייב להיות אירוע או הישג.');
      const d = Mods.note_(data.description, 500); if (!d) throw new AppError('VALIDATION', 'תיאור חובה.');
      return { soldier_id: s.id, event_date: Util.isoDate(Util.cellToIsoDate(data.event_date), 'תאריך'), event_type: t, description: d };
    }
  },
  list(ctx, courseId, opts) { return Mods.history(ctx, 'SoldierEvents', courseId, opts, 'event_date', function (r) { return { event_date: Util.cellToIsoDate(r.event_date), event_type: r.event_type, type_label: SoldierEvents.LABELS[r.event_type] || '', description: r.description }; }); }
};
