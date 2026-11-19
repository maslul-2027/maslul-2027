/**
 * Theoretical exams — attempts A / B / C per soldier per exam. Approved rules (spec §5.4):
 *  pass score default 80 (configurable); A<pass => B required; B<pass => C required AND a discipline/commander meeting is required (even if C passes);
 *  weighted = 0.7 * (B or C that passed) + 0.3 * A. Each attempt judged separately; every attempt and its history is kept.
 * Entry order is enforced: B only after a failed A, C only after a failed B (otherwise VALIDATION). Evaluation = Calc.examEvaluate.
 */
const Exams = {
  LETTERS: ['A', 'B', 'C'],

  passFor_(def) { const p = def && def.pass_score !== '' && def.pass_score !== undefined && def.pass_score !== null ? Number(def.pass_score) : undefined; return p !== undefined && Number.isFinite(p) ? p : Settings.get(def.course_id, 'exam.pass_score'); },

  defsList(ctx, courseId) {
    Records.guardCourse_(ctx, 'course.read', courseId);
    return Db.where('ExamDefinitions', function (d) { return d.course_id === courseId; }).map(function (d) { return { id: d.id, name: d.name, exam_type: d.exam_type, pass_score: Exams.passFor_(d), own_pass_score: d.pass_score === '' ? null : Number(d.pass_score) }; })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'he'); });
  },
  defCreate(ctx, courseId, p) {
    Records.guardCourse_(ctx, 'config.edit', courseId); p = p || {}; Soldiers.scalar_(p.name, 'name');
    const name = Util.str(p.name); if (!name || name.length > 60) throw new AppError('VALIDATION', 'שם מבחן חובה (עד 60 תווים).');
    let pass = '';
    if (!Util.isBlank(p.pass_score)) { const n = Util.numOrNull(p.pass_score, 'ציון עובר'); if (n < 0 || n > 100) throw new AppError('VALIDATION', 'ציון עובר בין 0 ל-100.'); pass = n; }
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'config.edit', courseId);
      if (Db.where('ExamDefinitions', function (d) { return d.course_id === courseId && String(d.name).toLowerCase() === name.toLowerCase(); }).length) throw new AppError('DUPLICATE', 'מבחן בשם זה כבר קיים.');
      const row = { id: Util.uuid(), course_id: courseId, name: name, exam_type: Mods.note_(p.exam_type, 50), pass_score: pass, created_at: Util.nowIso(), created_by: ctx.email };
      Db.insert('ExamDefinitions', row); Audit.log(ctx, { courseId: courseId, action: 'EXAMDEF_CREATE', table: 'ExamDefinitions', recordId: row.id, after: { name: name, pass_score: pass } });
      return { id: row.id };
    });
  },

  /** Admin: change an exam's own pass score (appended to the audit log with before/after; affects evaluation from now on). */
  defSetPass(ctx, id, pass, reason) {
    const pre = Db.get('ExamDefinitions', Util.str(id)); if (!pre || !Policy.inScope(ctx, pre.course_id)) throw new AppError('NOT_FOUND', 'המבחן לא נמצא.');
    Records.guardCourse_(ctx, 'config.edit', pre.course_id); if (Util.isBlank(reason)) throw new AppError('VALIDATION', 'חובה לציין סיבה.');
    let v = ''; if (!Util.isBlank(pass)) { v = Util.numOrNull(pass, 'ציון עובר'); if (v < 0 || v > 100) throw new AppError('VALIDATION', 'ציון עובר בין 0 ל-100.'); }
    return Locks.run(function () {
      const cur = Db.get('ExamDefinitions', pre.id); Records.guardCourse_(ctx, 'config.edit', cur.course_id);
      Db.update('ExamDefinitions', cur.id, { pass_score: v });
      Audit.log(ctx, { courseId: cur.course_id, action: 'EXAMDEF_PASS', table: 'ExamDefinitions', recordId: cur.id, before: { pass_score: cur.pass_score }, after: { pass_score: v }, reason: reason });
      return { id: cur.id, pass_score: v };
    });
  },

  activeAttempts_(courseId, soldierId, examId) {
    return Db.where('TheoreticalExamAttempts', function (a) { return a.course_id === courseId && a.soldier_id === soldierId && a.exam_id === examId && a.record_status === RECORD_STATUS.ACTIVE; });
  },
  evaluate_(def, attempts) {
    const m = Object.create(null); attempts.forEach(function (a) { m[a.attempt] = Number(a.score); });
    return Calc.examEvaluate(m, Exams.passFor_(def));
  },

  attemptType: {
    editable: ['soldier_id', 'exam_id', 'attempt', 'attempt_date', 'score'],
    prepare(courseId, data, existing) {
      const s = Mods.availableSoldier_(courseId, data.soldier_id);
      const def = Db.get('ExamDefinitions', Util.str(data.exam_id));
      if (!def || def.course_id !== courseId) throw new AppError('VALIDATION', 'מבחן לא תקין.');
      Soldiers.scalar_(data.attempt, 'attempt'); const att = Util.str(data.attempt);
      if (Exams.LETTERS.indexOf(att) === -1) throw new AppError('VALIDATION', 'ניסיון חייב להיות A, B או C.');
      const date = Util.isoDate(Util.cellToIsoDate(data.attempt_date), 'תאריך מבחן');
      const score = Util.numOrNull(data.score, 'ציון');
      if (score === null || score < 0 || score > 100) throw new AppError('VALIDATION', 'ציון חייב להיות בין 0 ל-100.');
      if (existing && (existing.attempt !== att || existing.soldier_id !== s.id || existing.exam_id !== def.id)) throw new AppError('VALIDATION', 'לא ניתן לשנות חייל/מבחן/ניסיון — יש לבטל וליצור מחדש.');
      // sequence + uniqueness against the OTHER active attempts of the same soldier/exam
      const others = Exams.activeAttempts_(courseId, s.id, def.id).filter(function (a) { return !existing || a.id !== existing.id; });
      if (others.some(function (a) { return a.attempt === att; })) throw new AppError('DUPLICATE', 'כבר קיים ניסיון ' + att + ' פעיל לחייל במבחן זה.');
      const pass = Exams.passFor_(def), get = function (l) { const a = others.filter(function (x) { return x.attempt === l; })[0]; return a ? Number(a.score) : null; };
      if (att === 'B') { const A = get('A'); if (A === null) throw new AppError('VALIDATION', 'ניסיון B דורש ציון A קודם.'); if (A >= pass) throw new AppError('VALIDATION', 'ציון A עובר — אין צורך בניסיון B.'); }
      if (att === 'C') { const B = get('B'); if (B === null) throw new AppError('VALIDATION', 'ניסיון C דורש ציון B קודם.'); if (B >= pass) throw new AppError('VALIDATION', 'ציון B עובר — אין צורך בניסיון C.'); }
      return { soldier_id: s.id, exam_id: def.id, attempt: att, attempt_date: date, score: score };
    }
  },
  meetingType: {
    editable: ['owner_role', 'done', 'meeting_date', 'notes'],
    prepare(courseId, data, existing) {
      if (!existing) throw new AppError('VALIDATION', 'שיחה נוצרת אוטומטית עם כישלון ב-B.');
      Soldiers.scalar_(data.owner_role, 'owner_role'); const role = Util.str(data.owner_role);
      if (role && ['מ״פ', 'מג״ד'].indexOf(role) === -1) throw new AppError('VALIDATION', 'בעל התפקיד חייב להיות מ״פ או מג״ד.');
      const done = Mods.bool_(data.done === '' || data.done === undefined ? false : data.done, 'בוצע');
      let date = ''; if (!Util.isBlank(data.meeting_date)) date = Util.isoDate(Util.cellToIsoDate(data.meeting_date), 'תאריך שיחה');
      if (done && (!role || !date)) throw new AppError('VALIDATION', 'שיחה שבוצעה מחייבת בעל תפקיד ותאריך.');
      return { soldier_id: existing.soldier_id, exam_id: existing.exam_id, required: Util.isTrue(existing.required), owner_role: role, done: done, meeting_date: date, notes: Mods.note_(data.notes) };
    }
  },

  /** Entry: validates order, stores the attempt (idempotent request_id), and opens the required meeting when B failed (system-created). */
  addAttempt(ctx, courseId, data) {
    return Locks.run(function () {
      const res = Records.create(ctx, 'TheoreticalExamAttempts', courseId, data);
      if (!res.duplicate) Exams.syncMeeting_(ctx, courseId, res.record.soldier_id, res.record.exam_id);
      return res;
    });
  },
  /** Ensures exactly one active "required" meeting row exists when (and only while) B is failed; created_by 'system'. */
  syncMeeting_(ctx, courseId, soldierId, examId) {
    const def = Db.get('ExamDefinitions', examId); const ev = Exams.evaluate_(def, Exams.activeAttempts_(courseId, soldierId, examId));
    const existing = Db.where('ExamMeetings', function (m) { return m.course_id === courseId && m.soldier_id === soldierId && m.exam_id === examId && m.record_status === RECORD_STATUS.ACTIVE; })[0];
    if (ev.meeting_required && !existing) {
      const now = Util.nowIso();
      const row = { id: Util.uuid(), course_id: courseId, soldier_id: soldierId, exam_id: examId, required: true, owner_role: '', done: false, meeting_date: '', notes: '', created_at: now, created_by: 'system',
        record_status: RECORD_STATUS.ACTIVE, version: 1, request_id: 'meeting:' + soldierId + ':' + examId, updated_at: now, updated_by: 'system' };
      Db.insert('ExamMeetings', row);
      Audit.log(ctx, { courseId: courseId, action: 'CREATE', table: 'ExamMeetings', recordId: row.id, after: row, reason: 'כישלון בניסיון B — נדרשת שיחה (כלל מאושר)' });
    }
  },

  attemptsList(ctx, courseId, opts) {
    const defs = Object.create(null); Db.where('ExamDefinitions', function (d) { return d.course_id === courseId; }).forEach(function (d) { defs[d.id] = d.name; });
    return Mods.history(ctx, 'TheoreticalExamAttempts', courseId, opts, 'attempt_date', function (r) { return { exam_id: r.exam_id, exam_name: defs[r.exam_id] || '', attempt: r.attempt, attempt_date: Util.cellToIsoDate(r.attempt_date), score: Number(r.score) }; });
  },
  meetingsList(ctx, courseId, opts) {
    const defs = Object.create(null); Db.where('ExamDefinitions', function (d) { return d.course_id === courseId; }).forEach(function (d) { defs[d.id] = d.name; });
    return Mods.history(ctx, 'ExamMeetings', courseId, opts, 'meeting_date', function (r) {
      const o = { exam_id: r.exam_id, exam_name: defs[r.exam_id] || '', required: Util.isTrue(r.required), done: Util.isTrue(r.done), owner_role: r.owner_role, meeting_date: Util.cellToIsoDate(r.meeting_date) };
      if (ctx.role === ROLES.ADMIN) o.notes = r.notes || '';    // discipline conversation notes: admin only
      return o;
    });
  },

  /** Per-exam status for one soldier (current snapshot). */
  summary(ctx, courseId, soldierId) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const rows = Snapshot.rows(ctx, 'TheoreticalExamAttempts', courseId, { soldierId: Util.str(soldierId) });
    const meet = Snapshot.rows(ctx, 'ExamMeetings', courseId, { soldierId: Util.str(soldierId) });
    return Util.str(soldierId) ? Exams.aggregate_(courseId, rows, meet) : Analytics.groupExams_(courseId, rows, meet, Snapshot.soldiers(ctx, courseId, {}).length);   // D2: no soldierId => group figure, cohort-gated
  },
  aggregate_(courseId, rows, meetings) {
    const byExam = Object.create(null); rows.forEach(function (r) { (byExam[r.exam_id] = byExam[r.exam_id] || Object.create(null))[r.soldier_id] = (byExam[r.exam_id][r.soldier_id] || []).concat([r]); });
    const exams = Object.keys(byExam).map(function (eid) {
      const def = Db.get('ExamDefinitions', eid), per = byExam[eid];
      const evs = Object.keys(per).map(function (sid) { const ev = Exams.evaluate_(def, per[sid]); ev.soldier_id = sid; return ev; });
      const passed = evs.filter(function (e) { return e.status === 'passed'; }).length, failed = evs.filter(function (e) { return e.status === 'failed'; }).length;
      const eff = Snapshot.mean_(evs, 'effective_score');
      return { exam_id: eid, exam_name: def ? def.name : '', soldiers: evs.length, passed: passed, failed: failed, pending: evs.length - passed - failed,
        pass_rate: passed + failed ? 100 * passed / (passed + failed) : null, pass_rate_display: passed + failed ? Util.display1(100 * passed / (passed + failed)) : null, mean_effective: eff, mean_display: Util.display1(eff), statuses: evs };
    });
    const open = meetings.filter(function (m) { return Util.isTrue(m.required) && !Util.isTrue(m.done); }).length;
    return { exams: exams, meetings_open: open, note: exams.length ? '' : 'אין מספיק נתונים' };
  }
};
