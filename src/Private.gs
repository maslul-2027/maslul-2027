/**
 * Private area of the company commander (מ״פ) + shared notes — v1.0.0.
 * ABSOLUTE RULE: PrivateNotes, PersonalFollowUps, FollowUpHistory, Favorites are admin-only (private.read / private.write). A commander gets NOTHING from them —
 * not in lists, not in the soldier card, not in exports, not in the assistant. Their content is never written to the audit log (field names only; Favorites log the soldier id only).
 * Commander assessments: a commander may ADD an assessment for a soldier he can see and read only HIS OWN; the admin reads all. Append-only: a correction is a new row pointing at the old one.
 * Shared result notes: visible wherever the result is visible; never private.
 */
const Private = {
  /** Soldier must exist in the course and (for the admin) may be inactive/cancelled: history is kept, but new private entries need an available soldier. */
  soldier_(ctx, courseId, id, needAvailable) {
    Soldiers.scalar_(id, 'soldier_id'); const s = Db.get('Soldiers', Util.str(id));
    if (!s || s.course_id !== courseId) throw new AppError('NOT_FOUND', 'החייל לא נמצא.');
    if (needAvailable && s.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE);
    return s;
  },
  guard_(ctx, action, courseId) { Records.guardCourse_(ctx, action, courseId); },

  // ---------------- assessments ----------------
  addAssessment(ctx, courseId, p) {
    p = p || {}; Private.guard_(ctx, 'assessment.create', courseId);
    ['strengths', 'improvement_areas', 'domain', 'assessment_date', 'corrects_id'].forEach(function (k) { Soldiers.scalar_(p[k], k); });
    const sol = Private.soldier_(ctx, courseId, p.soldier_id, true); if (!Soldiers.visibleFn_(ctx, courseId)(sol)) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE);
    const st = Mods.note_(p.strengths, 1000), imp = Mods.note_(p.improvement_areas, 1000); if (!st && !imp) throw new AppError('VALIDATION', 'נדרשת הערכה: חוזקות או נקודות לשיפור.');
    const date = Util.isBlank(p.assessment_date) ? Util.nowIso().slice(0, 10) : Util.isoDate(p.assessment_date, 'תאריך');
    return Locks.run(function () {
      Private.guard_(ctx, 'assessment.create', courseId);
      if (!Soldiers.visibleFn_(ctx, courseId)(Db.get('Soldiers', sol.id))) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE);
      let corrects = ''; if (!Util.isBlank(p.corrects_id)) { const old = Db.get('CommanderAssessments', Util.str(p.corrects_id)); if (!old || old.soldier_id !== sol.id || (ctx.role !== ROLES.ADMIN && String(old.author_email).toLowerCase() !== ctx.email)) throw new AppError('NOT_FOUND', 'ההערכה לתיקון לא נמצאה.'); corrects = old.id; }
      const row = { id: Util.uuid(), course_id: courseId, soldier_id: sol.id, assessment_date: date, author_email: ctx.email, strengths: st, improvement_areas: imp, domain: Mods.note_(p.domain, 60), corrects_id: corrects, created_at: Util.nowIso() };
      Db.insert('CommanderAssessments', row); Audit.log(ctx, { courseId: courseId, action: 'ASSESSMENT_ADD', table: 'CommanderAssessments', recordId: row.id, after: row });
      return Private.assessView_(ctx, row, {});
    });
  },
  assessView_(ctx, r, sol) { return { id: r.id, soldier_id: r.soldier_id, assessment_date: Util.cellToIsoDate(r.assessment_date), author: r.author_email, strengths: r.strengths, improvement_areas: r.improvement_areas, domain: r.domain, corrects_id: r.corrects_id, superseded: false, created_at: r.created_at }; },
  listAssessments(ctx, courseId, soldierId) {
    Private.guard_(ctx, 'assessment.create', courseId); Soldiers.scalar_(soldierId, 'soldier_id');
    const vis = Soldiers.visibleFn_(ctx, courseId), sol = Mods.soldierMap_(courseId), mine = ctx.role === ROLES.ADMIN ? null : ctx.email;
    const rows = Db.where('CommanderAssessments', function (r) { return r.course_id === courseId && (!soldierId || r.soldier_id === Util.str(soldierId)) && !!sol[r.soldier_id] && vis(sol[r.soldier_id]) && (!mine || String(r.author_email).toLowerCase() === mine); });
    const sup = Object.create(null); rows.forEach(function (r) { if (r.corrects_id) sup[r.corrects_id] = true; });
    return rows.map(function (r) { const o = Private.assessView_(ctx, r); o.superseded = !!sup[r.id]; o.soldier_name = sol[r.soldier_id].full_name; return o; }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
  },

  // ---------------- private notes (admin) — revisions, never overwritten ----------------
  saveNote(ctx, courseId, p) {
    p = p || {}; Private.guard_(ctx, 'private.write', courseId); Soldiers.scalar_(p.note_group_id, 'note_group_id');
    if (typeof p.note_text !== 'string' || !Util.str(p.note_text) || p.note_text.length > 2000) throw new AppError('VALIDATION', 'טקסט הערה חובה (עד 2000 תווים).');
    const sol = Private.soldier_(ctx, courseId, p.soldier_id, false);
    return Locks.run(function () {
      Private.guard_(ctx, 'private.write', courseId);
      let group = Util.str(p.note_group_id), rev = 1;
      if (group) { const prev = Db.where('PrivateNotes', function (n) { return n.note_group_id === group && n.soldier_id === sol.id && n.course_id === courseId; }); if (!prev.length) throw new AppError('NOT_FOUND', 'ההערה לא נמצאה.'); rev = Math.max.apply(null, prev.map(function (n) { return Number(n.revision); })) + 1; if (Util.str(prev.filter(function (n) { return Number(n.revision) === rev - 1; })[0].note_text) === Util.str(p.note_text)) throw new AppError('VALIDATION', 'לא בוצע שינוי.'); } else group = Util.uuid();
      const row = { id: Util.uuid(), course_id: courseId, soldier_id: sol.id, note_group_id: group, revision: rev, note_text: Util.str(p.note_text), created_at: Util.nowIso(), created_by: ctx.email };
      Db.insert('PrivateNotes', row); Audit.log(ctx, { courseId: courseId, action: 'PRIVNOTE_SAVE', table: 'PrivateNotes', recordId: row.id, after: row });
      return { id: row.id, note_group_id: group, revision: rev };
    });
  },
  listNotes(ctx, courseId, soldierId, allRevisions) {
    Private.guard_(ctx, 'private.read', courseId); Soldiers.scalar_(soldierId, 'soldier_id');
    const rows = Db.where('PrivateNotes', function (n) { return n.course_id === courseId && (!soldierId || n.soldier_id === Util.str(soldierId)); });
    const latest = Object.create(null); rows.forEach(function (n) { if (!latest[n.note_group_id] || Number(n.revision) > Number(latest[n.note_group_id].revision)) latest[n.note_group_id] = n; });
    return (allRevisions === true ? rows : Object.keys(latest).map(function (k) { return latest[k]; })).map(function (n) { return { id: n.id, soldier_id: n.soldier_id, note_group_id: n.note_group_id, revision: Number(n.revision), note_text: n.note_text, created_at: n.created_at, latest: latest[n.note_group_id].id === n.id }; }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
  },

  // ---------------- personal follow-ups (admin) ----------------
  FU_STATUS: ['open', 'done', 'cancelled'],
  createFollowUp(ctx, courseId, p) {
    p = p || {}; Private.guard_(ctx, 'private.write', courseId); ['what_to_check', 'private_note', 'due_date'].forEach(function (k) { Soldiers.scalar_(p[k], k); });
    const sol = Private.soldier_(ctx, courseId, p.soldier_id, true); const what = Mods.note_(p.what_to_check, 300); if (!what) throw new AppError('VALIDATION', 'חובה לציין מה לבדוק.');
    const due = Util.isBlank(p.due_date) ? '' : Util.isoDate(p.due_date, 'מועד');
    return Locks.run(function () {
      Private.guard_(ctx, 'private.write', courseId); const now = Util.nowIso();
      const row = { id: Util.uuid(), course_id: courseId, soldier_id: sol.id, what_to_check: what, due_date: due, private_note: Mods.note_(p.private_note, 1000), status: 'open', created_at: now, created_by: ctx.email, updated_at: now };
      Db.insert('PersonalFollowUps', row); Db.insert('FollowUpHistory', { id: Util.uuid(), followup_id: row.id, from_status: '', to_status: 'open', old_due: '', new_due: due, changed_by: ctx.email, changed_at: now });
      Audit.log(ctx, { courseId: courseId, action: 'FOLLOWUP_CREATE', table: 'PersonalFollowUps', recordId: row.id, after: row }); return Private.fuView_(row);
    });
  },
  fuView_(r) { return { id: r.id, soldier_id: r.soldier_id, what_to_check: r.what_to_check, due_date: Util.cellToIsoDate(r.due_date), private_note: r.private_note, status: r.status, created_at: r.created_at, updated_at: r.updated_at }; },
  updateFollowUp(ctx, id, p) {
    p = p || {}; const pre = Db.get('PersonalFollowUps', Util.str(typeof id === 'string' ? id : '')); if (!pre || !Policy.inScope(ctx, pre.course_id)) throw new AppError('NOT_FOUND', 'המעקב לא נמצא.');
    Private.guard_(ctx, 'private.write', pre.course_id); ['status', 'due_date', 'private_note'].forEach(function (k) { Soldiers.scalar_(p[k], k); });
    if (Object.keys(p).some(function (k) { return ['status', 'due_date', 'private_note'].indexOf(k) === -1; })) throw new AppError('VALIDATION', 'שדה לא ניתן לעדכון.');
    return Locks.run(function () {
      const cur = Db.get('PersonalFollowUps', pre.id); Private.guard_(ctx, 'private.write', cur.course_id);
      const st = p.status === undefined ? cur.status : Util.str(p.status); if (Private.FU_STATUS.indexOf(st) === -1) throw new AppError('VALIDATION', 'סטטוס לא תקין.');
      const due = p.due_date === undefined ? Util.cellToIsoDate(cur.due_date) : (Util.isBlank(p.due_date) ? '' : Util.isoDate(p.due_date, 'מועד'));
      const note = p.private_note === undefined ? cur.private_note : Mods.note_(p.private_note, 1000);
      if (st === cur.status && due === Util.cellToIsoDate(cur.due_date) && note === cur.private_note) throw new AppError('VALIDATION', 'לא בוצע שינוי.');
      const now = Util.nowIso(); Db.update('PersonalFollowUps', cur.id, { status: st, due_date: due, private_note: note, updated_at: now });
      if (st !== cur.status || due !== Util.cellToIsoDate(cur.due_date)) Db.insert('FollowUpHistory', { id: Util.uuid(), followup_id: cur.id, from_status: cur.status, to_status: st, old_due: Util.cellToIsoDate(cur.due_date), new_due: due, changed_by: ctx.email, changed_at: now });
      Audit.log(ctx, { courseId: cur.course_id, action: 'FOLLOWUP_UPDATE', table: 'PersonalFollowUps', recordId: cur.id, before: { status: cur.status, due_date: cur.due_date }, after: { status: st, due_date: due } });
      return Private.fuView_(Db.get('PersonalFollowUps', cur.id));
    });
  },
  listFollowUps(ctx, courseId, opts) {
    opts = opts || {}; Private.guard_(ctx, 'private.read', courseId); Soldiers.scalar_(opts.status, 'status'); Soldiers.scalar_(opts.soldierId, 'soldierId'); const sol = Mods.soldierMap_(courseId);
    return Db.where('PersonalFollowUps', function (f) { return f.course_id === courseId && (!opts.status || f.status === Util.str(opts.status)) && (!opts.soldierId || f.soldier_id === Util.str(opts.soldierId)); })
      .map(function (f) { const o = Private.fuView_(f); o.soldier_name = sol[f.soldier_id] ? sol[f.soldier_id].full_name : ''; o.history = Db.where('FollowUpHistory', function (h) { return h.followup_id === f.id; }).map(function (h) { return { from: h.from_status, to: h.to_status, old_due: Util.cellToIsoDate(h.old_due), new_due: Util.cellToIsoDate(h.new_due), at: h.changed_at }; }); return o; })
      .sort(function (a, b) { return (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1; });
  },
  /** Due items for the alert engine (open follow-ups with a due date <= today). Admin context only. */
  dueFollowUps_(courseId, today) { return Db.where('PersonalFollowUps', function (f) { return f.course_id === courseId && f.status === 'open' && !Util.isBlank(f.due_date) && Util.cellToIsoDate(f.due_date) <= today; }); },

  // ---------------- favorites (admin, personal) ----------------
  toggleFavorite(ctx, courseId, soldierId) {
    Private.guard_(ctx, 'private.write', courseId); const s = Private.soldier_(ctx, courseId, soldierId, false);
    return Locks.run(function () {
      Private.guard_(ctx, 'private.write', courseId);
      const ex = Db.where('Favorites', function (f) { return f.course_id === courseId && f.soldier_id === s.id && String(f.user_email).toLowerCase() === ctx.email; });
      if (ex.length) { Db.update('Favorites', ex[0].id, { user_email: '' }); /* soft removal — no physical deletion */ Audit.log(ctx, { courseId: courseId, action: 'FAVORITE_OFF', table: 'Favorites', recordId: s.id }); return { favorite: false }; }
      Db.insert('Favorites', { id: Util.uuid(), course_id: courseId, soldier_id: s.id, user_email: ctx.email, created_at: Util.nowIso() });
      Audit.log(ctx, { courseId: courseId, action: 'FAVORITE_ON', table: 'Favorites', recordId: s.id }); return { favorite: true };
    });
  },
  listFavorites(ctx, courseId) {
    Private.guard_(ctx, 'private.read', courseId); const sol = Mods.soldierMap_(courseId);
    return Db.where('Favorites', function (f) { return f.course_id === courseId && String(f.user_email).toLowerCase() === ctx.email && !!sol[f.soldier_id]; }).map(function (f) { return { soldier_id: f.soldier_id, soldier_name: sol[f.soldier_id].full_name, cancelled: sol[f.soldier_id].record_status !== RECORD_STATUS.ACTIVE }; });
  },
  isFavorite_(ctx, courseId, soldierId) { return Db.where('Favorites', function (f) { return f.course_id === courseId && f.soldier_id === soldierId && String(f.user_email).toLowerCase() === ctx.email; }).length > 0; },

  /** Everything private about one soldier — for the admin's card. A commander calling this gets FORBIDDEN (never an empty object). */
  soldierPrivate(ctx, courseId, soldierId) {
    Private.guard_(ctx, 'private.read', courseId); Private.soldier_(ctx, courseId, soldierId, false);
    return { notes: Private.listNotes(ctx, courseId, soldierId, false), follow_ups: Private.listFollowUps(ctx, courseId, { soldierId: soldierId }), assessments: Private.listAssessments(ctx, courseId, soldierId), favorite: Private.isFavorite_(ctx, courseId, Util.str(soldierId)) };
  }
};

/** Shared notes on a result record (visible wherever the result is visible). Mentions are plain emails of users who can see the course. */
const SharedNotes = {
  add(ctx, table, recordId, text, mentions) {
    const type = Records.typeFor_(table); if (!type) throw new AppError('VALIDATION', 'טבלה לא נתמכת.');
    const rec = Records.load_(ctx, table, recordId); Records.guardCourse_(ctx, 'note.shared.create', rec.course_id);
    if (typeof text !== 'string' || !Util.str(text) || text.length > 500) throw new AppError('VALIDATION', 'טקסט חובה (עד 500 תווים).');
    let m = []; if (mentions !== undefined && mentions !== null) { if (!Array.isArray(mentions) || mentions.length > 10) throw new AppError('VALIDATION', 'אזכורים לא תקינים.'); m = Array.from(new Set(mentions.map(function (e) { if (typeof e !== 'string') throw new AppError('VALIDATION', 'אזכור לא תקין.'); return e.trim().toLowerCase(); }))); m.forEach(function (e) { const u = Db.where('Users', function (x) { return String(x.email).toLowerCase() === e && Util.isTrue(x.active); })[0]; if (!u || (u.role !== ROLES.ADMIN && String(u.course_scope).split(',').map(function (z) { return z.trim(); }).indexOf(rec.course_id) === -1)) throw new AppError('VALIDATION', 'משתמש מאוזכר לא נמצא בקורס.'); }); }
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'note.shared.create', rec.course_id);
      const row = { id: Util.uuid(), course_id: rec.course_id, table_name: table, record_id: rec.id, author_email: ctx.email, text: Util.str(text), mentions: m.join(','), record_status: RECORD_STATUS.ACTIVE, created_at: Util.nowIso(), cancelled_by: '', cancelled_at: '' };
      Db.insert('SharedResultNotes', row); Audit.log(ctx, { courseId: rec.course_id, action: 'SHARED_NOTE_ADD', table: 'SharedResultNotes', recordId: row.id, after: { table: table, record_id: rec.id } }); return { id: row.id };
    });
  },
  list(ctx, table, recordId) {
    const rec = Records.load_(ctx, table, recordId); Records.guardCourse_(ctx, 'result.read', rec.course_id); const names = Navigation.userNames_();
    return Db.where('SharedResultNotes', function (n) { return n.table_name === table && n.record_id === rec.id && (n.record_status === RECORD_STATUS.ACTIVE || ctx.role === ROLES.ADMIN); })
      .map(function (n) { return { id: n.id, text: n.text, author: names[String(n.author_email).toLowerCase()] || '', mentions: n.mentions ? n.mentions.split(',') : [], cancelled: n.record_status !== RECORD_STATUS.ACTIVE, created_at: n.created_at, own: String(n.author_email).toLowerCase() === ctx.email }; });
  },
  cancel(ctx, noteId) {
    const n = Db.get('SharedResultNotes', Util.str(typeof noteId === 'string' ? noteId : '')); if (!n || !Policy.inScope(ctx, n.course_id)) throw new AppError('NOT_FOUND', 'ההערה לא נמצאה.');
    Records.load_(ctx, n.table_name, n.record_id);   // same visibility as the record
    if (ctx.role !== ROLES.ADMIN && String(n.author_email).toLowerCase() !== ctx.email) throw new AppError('FORBIDDEN', 'אין הרשאה לפעולה זו.');
    Records.guardCourse_(ctx, 'note.shared.create', n.course_id);
    return Locks.run(function () {
      const cur = Db.get('SharedResultNotes', n.id); if (cur.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('VALIDATION', 'ההערה כבר בוטלה.');
      Db.update('SharedResultNotes', cur.id, { record_status: RECORD_STATUS.CANCELLED, cancelled_by: ctx.email, cancelled_at: Util.nowIso() }); Audit.log(ctx, { courseId: cur.course_id, action: 'SHARED_NOTE_CANCEL', table: 'SharedResultNotes', recordId: cur.id }); return { id: cur.id };
    });
  }
};
