/**
 * Assistant — REACTIVE ONLY, rule-based, no external AI service — v1.0.0.
 * It answers a question the user typed, using ONLY data the caller may already see (every figure comes from the same Snapshot/summary services the screens use).
 * It never acts, never writes anything except an explicit DRAFT, never initiates anything, never calls a network service, and never echoes free text stored in the system
 * (notes, restrictions, descriptions) — so text inside the data cannot steer it (prompt-injection safe by construction: output = fixed templates + numbers + names).
 * Facts and assessments are separated: "facts" are numbers from the system; "assessments" appear only when the admin configured thresholds (otherwise none). Missing data is stated as missing.
 * Private (מ״פ) content only for the ADMIN and only with include_private=true (explicit). Official drafts stay 'draft' until the admin approves.
 * Whether to connect a real LLM is an OPEN DECISION (privacy/organisational); this module is the grounded layer such a connection would have to use.
 */
const Assistant = {
  TOPICS: [
    ['soldiers', /כמה חיילים|מספר החיילים|חיילים בקורס/], ['readiness', /כשיר|כשירות|מגבלות/], ['alerts', /התראות|התראה/], ['qualifications', /הסמכ|הכשר/], ['attendance', /נוכחות|היעדר/],
    ['navigation', /ניווט/], ['fitness', /כש״ג|כשג|כושר/], ['marksmanship', /קליעה|יל״מ|ילם/], ['exams', /מבחן|מבחנים|מועד ב/], ['marches', /מסע|מסעות/], ['followups', /מעקב|מעקבים/]
  ],
  fmt_(v) { return v === null || v === undefined ? 'אין מספיק נתונים' : Util.display1(v); },

  ask(ctx, courseId, question, opts) {
    opts = opts || {}; Records.guardCourse_(ctx, 'ai.ask', courseId);
    if (typeof question !== 'string' || !Util.str(question) || question.length > 500) throw new AppError('VALIDATION', 'שאלה חובה (עד 500 תווים).');
    if (opts.include_private !== undefined && typeof opts.include_private !== 'boolean') throw new AppError('VALIDATION', 'include_private חייב להיות כן/לא.');
    const priv = opts.include_private === true; if (priv) { Records.guardCourse_(ctx, 'ai.private.optin', courseId); Records.guardCourse_(ctx, 'private.read', courseId); }
    const q = question.trim(), facts = [], assessments = [], missing = [], used = {}; let soldier = null;
    // OWNER POLICY (group-only analytics, N>=5): the assistant never answers about a named individual. A question that names a trainee (full name or personal number) is refused with no personal fact, for every role.
    const named = Snapshot.soldiers(ctx, courseId, {}).some(function (s) { return (s.full_name && q.indexOf(s.full_name) !== -1) || (s.personal_number && q.indexOf(String(s.personal_number)) !== -1); });
    if (named) {
      Audit.log(ctx, { courseId: courseId, action: 'AI_ASK', table: 'Assistant', recordId: '', after: { topics: [], soldier: true, refused: true, private: false, question_length: q.length } });
      return { facts: [], assessments: [], missing: [], sources: [], private_included: false, refused: true, note: 'השאלה מתייחסת לאדם מסוים. העוזר עונה על שאלות קבוצתיות בלבד (קבוצות של 5 ומעלה) — אפשר לשאול על הקורס, מחלקה או צוות. פרטי חניך נמצאים בכרטיס החניך למורשים.' };
    }
    const topics = Assistant.TOPICS.filter(function (t) { return t[1].test(q); }).map(function (t) { return t[0]; });
    const sid = soldier ? soldier.id : '', f = soldier ? { soldierId: soldier.id } : {}, who = soldier ? ('עבור ' + soldier.full_name + ': ') : (ctx.role === ROLES.ADMIN ? '' : 'בהיקף שלך: ');
    const fact = function (text, source) { facts.push({ text: who + text, source: source }); used[source] = true; };
    const today = Util.todayIso();
    if (soldier && !topics.length) topics.push('navigation', 'fitness', 'marksmanship', 'readiness', 'qualifications', 'attendance');
    topics.forEach(function (tp) {
      if (tp === 'soldiers') { const n = Snapshot.soldiers(ctx, courseId, {}); /* D2: active / inactive is a binary cohort split */ const act = n.filter(function (s) { return Util.isTrue(s.active); }).length; if (Analytics.splitOk_(act, n.length - act)) fact('בקורס ' + n.length + ' חיילים (מהם ' + act + ' פעילים).', 'Snapshot.soldiers'); else if (act >= Analytics.MIN_GROUP) fact('בקורס ' + act + ' חיילים פעילים.', 'Snapshot.soldiers'); else missing.push('מספר החיילים: ' + Analytics.cohortReason_()); }
      if (tp === 'readiness') { const r = soldier ? null : Readiness.summary(ctx, courseId, f); if (soldier) fact('סטטוס כשירות: ' + Readiness.soldierCurrent(ctx, courseId, sid).label + '.', 'Readiness.soldierCurrent'); else if (r.counts_suppressed) missing.push('כשירות: ' + Analytics.cohortReason_()); else fact('כשירות: כשירים ' + r.counts.fit + ', כשירים עם מגבלות ' + r.counts.fit_with_restrictions + ', לא כשירים ' + r.counts.unfit + ', לא הוזן ' + r.counts.not_entered + '.', 'Readiness.summary'); }
      if (tp === 'alerts') { const c = Alerts.counts(ctx, courseId); fact(c.suppressed ? (c.has_open ? 'יש התראות פתוחות; המספרים מדוכאים מטעמי פרטיות.' : 'אין התראות פתוחות.') : 'התראות פתוחות: ' + c.open + ' (אדומות ' + c.red + ', צהובות ' + c.yellow + ').', 'Alerts.counts'); }
      if (tp === 'qualifications') { if (soldier) { const s = Qualifications.soldierSummary(ctx, courseId, sid); if (s.assigned) fact('הכשרות: ' + s.completed + ' מתוך ' + s.assigned + ' הושלמו.', 'Qualifications.soldierSummary'); else missing.push('אין הכשרות משויכות לחייל'); } else Qualifications.summary(ctx, courseId, f).forEach(function (x) { if (x.suppressed) { missing.push('הכשרה "' + x.name + '": ' + Analytics.cohortReason_()); return; } fact('הכשרה "' + x.name + '": ' + (x.completion_percent === null ? 'אין חיילים משויכים' : x.completed + ' מתוך ' + x.assigned + ' (' + Assistant.fmt_(x.completion_percent) + '%)') + '.', 'Qualifications.summary'); }); }
      if (tp === 'attendance') { const a = Attendance.summary(ctx, courseId, sid, {}); if (a.suppressed) missing.push('נוכחות: ' + a.reason); else if (a.percent === null) missing.push('אין נתוני נוכחות'); else fact('נוכחות: ' + Assistant.fmt_(a.percent) + '% (' + a.present + ' מתוך ' + a.total + ').', 'Attendance.summary'); }
      if (tp === 'navigation') { const a = Navigation.summary(ctx, courseId, sid); if (a.suppressed) missing.push('ניווט: ' + a.reason); else if (a.mean === null) missing.push('אין נתוני ניווט'); else fact('ממוצע ניווט: ' + Assistant.fmt_(a.mean) + (a.count === null ? '.' : ' (' + a.count + ' מדידות).'), 'Navigation.aggregate_'); }
      if (tp === 'fitness') { const a = Fitness.summary(ctx, courseId, sid); if (a.suppressed) missing.push('כש״ג: ' + a.reason); else if (a.mean === null) missing.push('אין ציון כש״ג משוקלל (חסרות טבלאות מאושרות או נתונים)'); else fact('ממוצע כש״ג: ' + Assistant.fmt_(a.mean) + ' (' + a.complete_count + ' מדידות מלאות).', 'Fitness.aggregate_'); }
      if (tp === 'marksmanship') { const a = Marksmanship.summary(ctx, courseId, sid); if (a.regular.mean === null && a.ylm.mean === null) missing.push(a.suppressed ? 'קליעה: ' + a.reason : 'אין נתוני קליעה'); else { if (a.regular.mean !== null) fact('ממוצע קליעה רגילה: ' + Assistant.fmt_(a.regular.mean) + '.', 'Marksmanship.aggregate_'); if (a.ylm.mean !== null) fact('ממוצע יל״מ (נפרד מהקליעה הרגילה): ' + Assistant.fmt_(a.ylm.mean) + '.', 'Marksmanship.aggregate_'); } }
      if (tp === 'exams') { const a = Exams.summary(ctx, courseId, sid); if (!a.exams.length) missing.push('אין נתוני מבחנים'); a.exams.forEach(function (e) { if (e.suppressed) { missing.push('מבחן "' + e.exam_name + '": ' + e.reason); return; } if (soldier) fact('מבחן "' + e.exam_name + '": ' + (e.statuses[0] ? e.statuses[0].status : '') + '.', 'Exams.summary'); else fact('מבחן "' + e.exam_name + '": עברו ' + e.passed + ', נכשלו ' + e.failed + ', ממתינים ' + e.pending + '.', 'Exams.aggregate_'); }); }
      if (tp === 'marches') { const a = Marches.summary(ctx, courseId, sid, {}); if (a.suppressed) missing.push('מסעות: ' + a.reason); else if (!a.marches_total) missing.push('אין נתוני מסעות'); else fact('מסעות: ' + a.marches_attended + ' נוכחות, ' + Assistant.fmt_(a.total_km) + ' ק״מ.', 'Marches.summary'); }
      if (tp === 'followups') { if (priv) { const l = Private.listFollowUps(ctx, courseId, { status: 'open', soldierId: sid || undefined }); facts.push({ text: 'מעקבים אישיים פתוחים (מידע פרטי): ' + l.length + '.', source: 'Private.listFollowUps', private: true }); used['Private.listFollowUps'] = true; } else missing.push('מידע פרטי אינו מוצג (נדרשת בקשה מפורשת של מנהל)'); }
    });
    if (soldier && (topics.indexOf('navigation') !== -1)) { const sg = Dashboard.strengthsGaps(ctx, courseId, sid); if (sg.available) { sg.strengths.forEach(function (x) { assessments.push({ text: 'הערכה (לפי הספים שהוגדרו): חוזקה ב' + x.domain + ' על סמך ' + x.count + ' מדידות.', basis: 'Dashboard.strengthsGaps' }); }); sg.gaps.forEach(function (x) { assessments.push({ text: 'הערכה (לפי הספים שהוגדרו): פער ב' + x.domain + ' על סמך ' + x.count + ' מדידות.', basis: 'Dashboard.strengthsGaps' }); }); } }
    Audit.log(ctx, { courseId: courseId, action: 'AI_ASK', table: 'Assistant', recordId: '', after: { topics: topics, soldier: !!soldier, private: priv, question_length: q.length } });
    return { facts: facts, assessments: assessments, missing: missing, sources: Object.keys(used), private_included: priv && facts.some(function (x) { return x.private; }),
      note: topics.length ? 'עובדות = נתונים מהמערכת. הערכות מוצגות רק לפי ספים שהוגדרו על ידי מנהל המערכת; אין בהן ניחוש.' : 'לא זיהיתי נושא. אפשר לשאול על: כמות חיילים, כשירות, התראות, הכשרות, נוכחות, ניווט, כש״ג, קליעה, מבחנים, מסעות — או לציין שם חייל.' };
  },

  /** Draft of an official summary for ONE soldier. Stays 'draft' (not official) until the admin approves. Content = fixed template over system facts only. */
  draft(ctx, courseId, soldierId) {
    Records.guardCourse_(ctx, 'ai.ask', courseId); Soldiers.scalar_(soldierId, 'soldier_id'); const s = Db.get('Soldiers', Util.str(soldierId)); if (!s || s.course_id !== courseId || s.record_status !== RECORD_STATUS.ACTIVE || !Soldiers.visibleFn_(ctx, courseId)(s)) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE);
    const a = Assistant.ask(ctx, courseId, 'סיכום ' + s.full_name, {}), lines = ['טיוטת סיכום — ' + s.full_name, 'עובדות מהמערכת:'].concat(a.facts.map(function (x) { return '• ' + x.text.replace(/^עבור [^:]+: /, ''); })), miss = a.missing.length ? ['נתונים חסרים:'].concat(a.missing.map(function (x) { return '• ' + x; })) : [];
    const content = lines.concat(miss).concat(a.assessments.length ? ['הערכות (לפי ספים שהוגדרו):'].concat(a.assessments.map(function (x) { return '• ' + x.text; })) : []).join('\n');
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'ai.ask', courseId); const row = { id: Util.uuid(), course_id: courseId, soldier_id: s.id, kind: 'soldier_summary', content: content, basis_json: JSON.stringify(a.sources), status: 'draft', created_by: ctx.email, created_at: Util.nowIso(), reviewed_by: '', reviewed_at: '', review_note: '' };
      Db.insert('AssistantDrafts', row); Audit.log(ctx, { courseId: courseId, action: 'AI_DRAFT', table: 'AssistantDrafts', recordId: row.id, after: { soldier_id: s.id } }); return Assistant.draftView_(row);
    });
  },
  draftView_(d) { return { id: d.id, soldier_id: d.soldier_id, kind: d.kind, content: d.content, status: d.status, official: d.status === 'approved', created_by: d.created_by, created_at: d.created_at, review_note: d.review_note }; },
  drafts(ctx, courseId) { Records.guardCourse_(ctx, 'ai.ask', courseId); const vis = Soldiers.visibleFn_(ctx, courseId), sol = Mods.soldierMap_(courseId); return Db.where('AssistantDrafts', function (d) { return d.course_id === courseId && (ctx.role === ROLES.ADMIN || (String(d.created_by).toLowerCase() === ctx.email && !!sol[d.soldier_id] && vis(sol[d.soldier_id]))); }).map(Assistant.draftView_); },
  reviewDraft(ctx, id, decision, note) {
    const pre = Db.get('AssistantDrafts', Util.str(typeof id === 'string' ? id : '')); if (!pre || !Policy.inScope(ctx, pre.course_id)) throw new AppError('NOT_FOUND', 'הטיוטה לא נמצאה.');
    Records.guardCourse_(ctx, 'ocr.review', pre.course_id); if (decision !== 'approve' && decision !== 'reject') throw new AppError('VALIDATION', 'החלטה לא תקינה.'); note = Mods.reason_(note, decision === 'reject');
    return Locks.run(function () { const cur = Db.get('AssistantDrafts', pre.id); Records.guardCourse_(ctx, 'ocr.review', cur.course_id); if (cur.status !== 'draft') throw new AppError('VALIDATION', 'הטיוטה כבר טופלה.'); Db.update('AssistantDrafts', cur.id, { status: decision === 'approve' ? 'approved' : 'rejected', reviewed_by: ctx.email, reviewed_at: Util.nowIso(), review_note: note }); Audit.log(ctx, { courseId: cur.course_id, action: 'AI_DRAFT_' + decision.toUpperCase(), table: 'AssistantDrafts', recordId: cur.id, reason: note }); return Assistant.draftView_(Db.get('AssistantDrafts', cur.id)); });
  }
};
