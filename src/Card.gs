/**
 * Card — the full soldier card — v1.0.0. Wraps Soldiers.card (general data, navigation, documents, change history) and adds every module tab + a timeline.
 * ABSOLUTE separation: the card NEVER contains private (מ״פ) data. Private notes / follow-ups / favourite / assessments are served by a different endpoint
 * (soldiers.private -> Private.soldierPrivate, admin only) and rendered in a visually separate tab. Strengths/gaps and trends appear only when the data/thresholds support them.
 * Current-state blocks come from Snapshot summaries (a cancelled soldier has no current figures); history blocks are visibility-aware lists.
 */
const Card = {
  build(ctx, id) {
    const base = Soldiers.card(ctx, id), sid = base.soldier.id, courseId = base.soldier.course_id || Db.get('Soldiers', sid).course_id;
    base.fitness = Fitness.summary(ctx, courseId, sid); base.fitness.history = Fitness.list(ctx, courseId, { soldierId: sid }).slice(0, 50);
    base.marksmanship = Marksmanship.summary(ctx, courseId, sid); base.marksmanship.history = Marksmanship.list(ctx, courseId, { soldierId: sid }).slice(0, 50);
    base.exams = Exams.summary(ctx, courseId, sid); base.exams.history = Exams.attemptsList(ctx, courseId, { soldierId: sid }).slice(0, 50);
    base.attendance = Attendance.summary(ctx, courseId, sid, {}); base.attendance.log = Attendance.soldierLog(ctx, courseId, sid).slice(0, 100);
    base.marches = Marches.summary(ctx, courseId, sid, {}); base.marches.log = Marches.soldierLog(ctx, courseId, sid).slice(0, 100);
    base.qualifications = Qualifications.soldierSummary(ctx, courseId, sid);
    base.readiness = { current: Readiness.soldierCurrent(ctx, courseId, sid), history: Readiness.list(ctx, courseId, { soldierId: sid }) };
    base.events = SoldierEvents.list(ctx, courseId, { soldierId: sid });
    base.alerts = Alerts.list(ctx, courseId, { soldierId: sid, status: 'open' });
    base.trends = Dashboard.trends(ctx, courseId, sid); base.strengths_gaps = Dashboard.strengthsGaps(ctx, courseId, sid);
    base.timeline = Card.timeline_(base);
    base.private_endpoint_note = ctx.role === ROLES.ADMIN ? 'מידע פרטי של מ״פ נטען בנפרד (soldiers.private).' : undefined;
    return base;
  },
  timeline_(c) {
    const T = [], add = function (date, type, title, detail, id) { if (date) T.push({ date: date, type: type, title: title, detail: detail === undefined || detail === null ? '' : String(detail), record_id: id || '' }); };
    (c.navigation.records || []).forEach(function (r) { add(r.test_date, 'navigation', 'ניווט — ' + (r.type_name || ''), r.final_display, r.id); });
    c.fitness.history.forEach(function (r) { add(r.test_date, 'fitness', 'כש״ג', r.weighted_display, r.id); });
    c.marksmanship.history.forEach(function (r) { add(r.test_date, 'marksmanship', 'קליעה — ' + (r.test_kind === 'ylm' ? 'יל״מ' : 'רגילה'), r.examiner_score !== null && r.examiner_score !== undefined ? r.examiner_score : r.ylm_score, r.id); });
    c.exams.history.forEach(function (r) { add(r.attempt_date, 'exam', 'מבחן ' + r.exam_name + ' — מועד ' + r.attempt, r.score, r.id); });
    c.attendance.log.forEach(function (r) { if (!r.present || r.early_exit) add(r.date || r.event_date, 'attendance', r.present ? 'יציאה מוקדמת' : 'היעדרות', r.activity_type_name || '', r.id); });
    c.marches.log.forEach(function (r) { add(r.march_date || r.date, 'march', 'מסע — ' + (r.location || ''), r.present ? 'נוכח' : 'נעדר', r.id); });
    c.readiness.history.forEach(function (r) { add(r.start_date, 'readiness', 'כשירות: ' + r.status_label, '', r.id); });
    c.events.forEach(function (r) { add(r.event_date, r.event_type === 'achievement' ? 'achievement' : 'event', r.type_label, r.description, r.id); });
    c.qualifications.items.forEach(function (q) { if (q.completion_date) add(q.completion_date, 'qualification', 'הסמכה הושלמה: ' + q.qualification_name, '', q.id); });
    return T.sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
  }
};
