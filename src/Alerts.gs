/**
 * Alerts (התראות ותהליכי טיפול) — v1.0.0.
 * Rules ONLY from approved facts or configured thresholds (an unset threshold keeps its rule OFF — never a guessed value):
 *   exam.meeting_required  : failed attempt B => a documented meeting is required and not done yet
 *   qual.due_soon (yellow) / qual.overdue (red) : by the qualification target date and the early-alert window (default 7 days)
 *   readiness.review_due   : next review date reached (default 0 days before)
 *   low.<domain>           : soldier mean below the configured "low" threshold   (OFF until set)
 *   trend.drop.<domain>    : last vs previous measurement dropped by >= configured points (OFF until set)
 *   followup.due           : admin's personal follow-up reached its date — ADMIN ONLY, contains no private content
 * Lifecycle: open -> handled (with note) | archived (condition ended / admin). Every transition is kept in AlertHistory. A handled alert is not re-opened for the same dedupe key.
 */
const Alerts = {
  STATUSES: ['open', 'handled', 'archived'],
  DOMAINS: { nav: ['NavigationTests', 'final_score', 'ניווט'], fitness: ['FitnessTests', 'weighted_score', 'כש״ג'], marksmanship: ['MarksmanshipTests', 'examiner_score', 'קליעה'] },

  candidates_(adminCtx, courseId, today) {
    const out = [], add = function (rule, s, ref, urgency, reason, due, topic) { out.push({ rule_key: rule, soldier_id: s ? s.id : '', ref_id: ref || '', urgency: urgency, reason: reason, due_date: due || '', topic: topic, dedupe_key: [rule, s ? s.id : '', ref || '', due || ''].join('|') }); };
    const live = Object.create(null); Snapshot.soldiers(adminCtx, courseId, {}).forEach(function (s) { live[s.id] = s; });
    // exams
    Db.where('ExamMeetings', function (m) { return m.course_id === courseId && m.record_status === RECORD_STATUS.ACTIVE && !Util.isTrue(m.done) && live[m.soldier_id]; }).forEach(function (m) { add('exam.meeting_required', live[m.soldier_id], m.id, 'red', 'נדרשת שיחה/פגישה מתועדת בעקבות כישלון במועד ב׳', '', 'exam'); });
    // qualifications
    Qualifications.dueItems_(courseId, today).forEach(function (i) { if (live[i.soldier.id]) add(i.urgency === 'red' ? 'qual.overdue' : 'qual.due_soon', i.soldier, i.assignment.id, i.urgency, (i.urgency === 'red' ? 'הכשרה באיחור: ' : 'הכשרה מתקרבת למועד: ') + i.qualification.name, i.due_date, 'qualification'); });
    // readiness
    const before = Settings.get(courseId, 'readiness.alert_days_before', today), cur = Readiness.current_(Snapshot.rows(adminCtx, 'ReadinessRecords', courseId, {}));
    Object.keys(cur).forEach(function (sid) { const nr = Util.cellToIsoDate(cur[sid].next_review_date); if (!nr) return; const lim = new Date(Date.parse(nr + 'T00:00:00Z') - before * 86400000).toISOString().slice(0, 10); if (today >= lim && live[sid]) add('readiness.review_due', live[sid], cur[sid].id, today > nr ? 'red' : 'yellow', 'הגיע מועד בדיקת כשירות', nr, 'readiness'); });
    // thresholds
    Object.keys(Alerts.DOMAINS).forEach(function (d) {
      const spec = Alerts.DOMAINS[d], low = Settings.opt(courseId, 'low.' + (d === 'nav' ? 'nav' : d), today), drop = Settings.opt(courseId, 'trend.drop_points', today);
      if (low === null && drop === null) return;
      const rows = Snapshot.rows(adminCtx, spec[0], courseId, {}).filter(function (r) { return Calc.hasScore(r[spec[1]]); }), by = {};
      rows.forEach(function (r) { (by[r.soldier_id] = by[r.soldier_id] || []).push(r); });
      Object.keys(by).forEach(function (sid) {
        const list = by[sid].sort(function (a, b) { const x = Util.cellToIsoDate(a[Snapshot.DATE_COL[spec[0]]]) + a.created_at, y = Util.cellToIsoDate(b[Snapshot.DATE_COL[spec[0]]]) + b.created_at; return x < y ? -1 : 1; });
        const mean = Snapshot.mean_(list, spec[1]);
        if (low !== null && mean !== null && mean < low) add('low.' + d, live[sid], d, 'yellow', 'ממוצע ' + spec[2] + ' מתחת לסף שהוגדר', '', d);
        if (drop !== null && list.length >= 2) { const l = Calc.validNumber(list[list.length - 1][spec[1]]), p = Calc.validNumber(list[list.length - 2][spec[1]]); if (p - l >= drop) add('trend.drop.' + d, live[sid], list[list.length - 1].id, 'yellow', 'ירידה משמעותית ב' + spec[2] + ' בין שתי המדידות האחרונות', '', d); }
      });
    });
    // admin-only personal follow-ups (no private content in the alert)
    Private.dueFollowUps_(courseId, today).forEach(function (f) { if (live[f.soldier_id]) add('followup.due', live[f.soldier_id], f.id, 'yellow', 'הגיע מועד מעקב אישי', Util.cellToIsoDate(f.due_date), 'followup'); });
    return out;
  },

  /** Admin (or the daily job): reconcile stored alerts with the current conditions. Inserts new, archives alerts whose condition ended. Returns counts. */
  refresh(ctx, courseId, today) {
    Records.guardCourse_(ctx, 'alert.handle', courseId); today = Util.isBlank(today) ? Util.nowIso().slice(0, 10) : Util.isoDate(today, 'today');
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'alert.handle', courseId);
      const cand = Alerts.candidates_(ctx, courseId, today), keys = {}; cand.forEach(function (c) { keys[c.dedupe_key] = c; });
      const existing = Db.where('Alerts', function (a) { return a.course_id === courseId; }), byKey = {}; existing.forEach(function (a) { (byKey[a.dedupe_key] = byKey[a.dedupe_key] || []).push(a); });
      let created = 0, archived = 0; const now = Util.nowIso();
      cand.forEach(function (c) {
        if (byKey[c.dedupe_key] && byKey[c.dedupe_key].some(function (a) { return true; })) { const a = byKey[c.dedupe_key][0]; if (a.status === 'archived' && a.handled_by === 'system') { Alerts.transition_(ctx, a, 'open', 'התנאי חזר', now); created++; } if (a.status === 'open' && a.urgency !== c.urgency) { Db.update('Alerts', a.id, { urgency: c.urgency, reason: c.reason }); Db.insert('AlertHistory', { id: Util.uuid(), course_id: courseId, alert_id: a.id, from_status: 'open', to_status: 'open', changed_by: 'system', changed_at: now, note: 'דחיפות עודכנה ל-' + c.urgency }); } return; }
        const row = { id: Util.uuid(), course_id: courseId, soldier_id: c.soldier_id, topic: c.topic, rule_key: c.rule_key, reason: c.reason, urgency: c.urgency, status: 'open', opened_at: now, handled_by: '', handled_at: '', dedupe_key: c.dedupe_key, ref_id: c.ref_id, due_date: c.due_date };
        Db.insert('Alerts', row); Db.insert('AlertHistory', { id: Util.uuid(), course_id: courseId, alert_id: row.id, from_status: '', to_status: 'open', changed_by: 'system', changed_at: now, note: c.reason }); created++;
      });
      existing.forEach(function (a) { if (a.status === 'open' && !keys[a.dedupe_key]) { const cur = Db.get('Alerts', a.id); Alerts.transition_({ email: 'system' }, cur, 'archived', 'התנאי הסתיים', now); Db.update('Alerts', cur.id, { handled_by: 'system' }); archived++; } });
      // urgency may change for the same key (yellow -> red keeps the same key only when rule differs, so nothing to do here)
      return { created: created, archived: archived, open: Db.where('Alerts', function (a) { return a.course_id === courseId && a.status === 'open'; }).length };
    });
  },
  transition_(ctx, a, to, note, now) {
    Db.update('Alerts', a.id, { status: to, handled_by: to === 'open' ? '' : ctx.email, handled_at: to === 'open' ? '' : now });
    Db.insert('AlertHistory', { id: Util.uuid(), course_id: a.course_id, alert_id: a.id, from_status: a.status, to_status: to, changed_by: ctx.email, changed_at: now, note: note || '' });
  },
  /** Admin: handle / archive / reopen an alert. Note required for handled. */
  handle(ctx, alertId, to, note) {
    const pre = Db.get('Alerts', Util.str(typeof alertId === 'string' ? alertId : '')); if (!pre || !Policy.inScope(ctx, pre.course_id)) throw new AppError('NOT_FOUND', 'ההתראה לא נמצאה.');
    Records.guardCourse_(ctx, 'alert.handle', pre.course_id); if (Alerts.STATUSES.indexOf(to) === -1) throw new AppError('VALIDATION', 'סטטוס לא תקין.'); note = Mods.reason_(note, to === 'handled');
    return Locks.run(function () {
      const cur = Db.get('Alerts', pre.id); Records.guardCourse_(ctx, 'alert.handle', cur.course_id); if (cur.status === to) throw new AppError('VALIDATION', 'הסטטוס לא השתנה.');
      Alerts.transition_(ctx, cur, to, note, Util.nowIso()); Audit.log(ctx, { courseId: cur.course_id, action: 'ALERT_' + to.toUpperCase(), table: 'Alerts', recordId: cur.id, before: { status: cur.status }, after: { status: to }, reason: note }); return { id: cur.id, status: to };
    });
  },
  /** Commanders: only alerts of soldiers they can see; never follow-up alerts; never handled by them. Admin: all. */
  list(ctx, courseId, opts) {
    opts = opts || {}; Records.guardCourse_(ctx, 'alert.read', courseId); Soldiers.scalar_(opts.status, 'status'); Soldiers.scalar_(opts.soldierId, 'soldierId'); Soldiers.scalar_(opts.topic, 'topic');
    const vis = Soldiers.visibleFn_(ctx, courseId), sol = Mods.soldierMap_(courseId), admin = ctx.role === ROLES.ADMIN;
    return Db.where('Alerts', function (a) {
      if (a.course_id !== courseId) return false; const s = sol[a.soldier_id];
      if (!admin && (a.topic === 'followup' || !s || !vis(s))) return false;
      if (!admin && s.record_status !== RECORD_STATUS.ACTIVE) return false;
      if (opts.status && a.status !== Util.str(opts.status)) return false; if (opts.soldierId && a.soldier_id !== Util.str(opts.soldierId)) return false; if (opts.topic && a.topic !== Util.str(opts.topic)) return false; return true;
    }).map(function (a) {
      const o = { id: a.id, soldier_id: a.soldier_id, soldier_name: sol[a.soldier_id] ? sol[a.soldier_id].full_name : '', topic: a.topic, rule_key: a.rule_key, reason: a.reason, urgency: a.urgency, status: a.status, opened_at: a.opened_at, due_date: Util.cellToIsoDate(a.due_date) };
      if (admin) { o.handled_by = a.handled_by; o.handled_at = a.handled_at; o.history = Db.where('AlertHistory', function (h) { return h.alert_id === a.id; }).map(function (h) { return { from: h.from_status, to: h.to_status, by: h.changed_by, at: h.changed_at, note: h.note }; }); }
      return o;
    }).sort(function (a, b) { return (a.urgency === b.urgency ? 0 : (a.urgency === 'red' ? -1 : 1)) || (a.opened_at < b.opened_at ? 1 : -1); });
  },
  /**
   * GROUP alert counts (route alerts.counts, Dashboard, Assistant): D2 sub-cohort rule on the DISTINCT soldiers behind the alerts — red and yellow must each be backed by 0 or >= MIN_GROUP soldiers,
   * otherwise the three numbers are hidden and only the existence flag `has_open` is returned (a pointer to the operational alert list `alerts.list`, which is per-soldier and authorised separately).
   */
  counts(ctx, courseId) {
    const l = Alerts.list(ctx, courseId, { status: 'open' }), red = l.filter(function (a) { return a.urgency === 'red'; }), yel = l.filter(function (a) { return a.urgency === 'yellow'; });
    const who = function (x) { const s = Object.create(null); x.forEach(function (a) { s[a.soldier_id || ('~' + a.id)] = true; }); return Object.keys(s).length; };
    if (!Analytics.catOk_([who(red), who(yel)])) return { open: null, red: null, yellow: null, suppressed: true, reason: Analytics.cohortReason_(), has_open: l.length > 0 };
    return { open: l.length, red: red.length, yellow: yel.length, has_open: l.length > 0 };
  }
};
