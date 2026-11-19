/**
 * Soldiers — the soldier registry (Stage 2) and the soldier card.
 *
 * Rules (from the approved spec, §2/§3/§4 of דרישות_והחלטות.md + מודל_נתונים):
 *  - Fixed structure: 2 departments x 2 teams per course. This module only ASSIGNS to existing departments/teams; it never creates any.
 *  - personal_number is the unique business key INSIDE a course (cancelled soldiers keep occupying it, so restore never duplicates).
 *  - Only the admin creates/edits/reassigns/cancels/restores. Commanders READ (course scope), active soldiers only, no admin-only fields.
 *  - Assignment is fixed during the course: moving a soldier after the course start date needs an explicit manager-approved exception
 *    (data model §"Soldier cannot be moved ... unless manager-approved exception"). Before the start date a move is free.
 *  - Nothing is physically deleted. Every change is audited with before/after (admin-readable audit).
 *  - Optimistic concurrency: edits carry expected_updated_at; a stale value => CONFLICT (no silent overwrite).
 *  - Not implemented here on purpose: PZM, eligibility, favourites, personal-details table, uploads, import (no confirmed definition / later stages).
 */
const Soldiers = {
  EDITABLE: ['full_name', 'personal_number', 'gender', 'pakal', 'enlistment_date', 'sociometric_third', 'commander_note'],
  ADMIN_ONLY_FIELDS: ['sociometric_third', 'commander_note'],     // conservative: not exposed to commanders until the spec says otherwise
  LIST_FIELDS: ['id', 'personal_number', 'full_name', 'department_id', 'team_id', 'pakal', 'active'],

  /** v0.3.1: a commander sees ONLY soldiers that are not cancelled AND active. Admin sees everything in scope. Single source of truth for every read path. */
  isVisible_(ctx, s) {
    if (!s) return false;
    if (ctx.role === ROLES.ADMIN) return true;
    return Soldiers.visibleFn_(ctx, s.course_id)(s);
  },

  /**
   * v0.4.0: builds the visibility predicate ONCE per operation (one read of the assignments table).
   * Commander: soldier not cancelled AND active AND covered by one of his ACTIVE assignments in that course. No assignment => nothing. Admin: everything.
   * Every read path (list, card, history, results, corrections, aggregates) goes through this single function.
   */
  visibleFn_(ctx, courseId) {
    if (ctx.role === ROLES.ADMIN) return function () { return true; };
    if (ctx.role !== ROLES.COMMANDER || !Policy.inScope(ctx, courseId)) return function () { return false; };
    const list = Assignments.activeFor_(ctx.email, courseId);
    return function (s) {
      return !!s && s.course_id === courseId && s.record_status === RECORD_STATUS.ACTIVE && Util.isTrue(s.active) && Assignments.covers_(list, s);
    };
  },

  load_(ctx, id) {
    const s = Db.get('Soldiers', Util.str(id));
    if (!s || !Policy.inScope(ctx, s.course_id) || !Soldiers.isVisible_(ctx, s)) throw new AppError('NOT_FOUND', 'החייל לא נמצא.');   // uniform: missing / foreign course / cancelled / inactive
    return s;
  },

  checkStale_(cur, expected) {
    if (Util.isBlank(expected)) throw new AppError('VALIDATION', 'חסר expected_updated_at (מניעת דריסה בעדכונים מקבילים).');
    if (String(cur.updated_at) !== String(expected)) throw new AppError('CONFLICT', 'החייל עודכן בינתיים על ידי משתמש אחר. רעננו ונסו שוב.');
  },

  /** Validates org references: team must belong to the department, both active and in the course. */
  checkOrg_(courseId, departmentId, teamId) {
    Soldiers.scalar_(departmentId, 'department_id'); Soldiers.scalar_(teamId, 'team_id');
    const dep = Db.get('Departments', Util.str(departmentId)), team = Db.get('Teams', Util.str(teamId));
    if (!dep || dep.course_id !== courseId || !Util.isTrue(dep.active)) throw new AppError('VALIDATION', 'מחלקה לא תקינה.');
    if (!team || team.course_id !== courseId || !Util.isTrue(team.active) || team.department_id !== dep.id) throw new AppError('VALIDATION', 'הצוות אינו שייך למחלקה שנבחרה.');
  },

  /** Only plain scalars are accepted from the client (an array like ['M'] must not be coerced to 'M'). */
  scalar_(v, label) {
    if (v !== null && v !== undefined && typeof v !== 'string' && typeof v !== 'number') throw new AppError('VALIDATION', 'ערך לא תקין בשדה: ' + label);
    return v;
  },

  /** Normalises and validates the editable fields present in `d`. Returns only the fields present. */
  clean_(d, requireAll) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new AppError('VALIDATION', 'נתונים לא תקינים.');
    Soldiers.EDITABLE.forEach(function (k) { Soldiers.scalar_(d[k], k); });
    const out = {};
    const has = function (k) { return Object.prototype.hasOwnProperty.call(d, k); };
    if (requireAll || has('full_name')) {
      const v = Util.str(d.full_name);
      if (!v || v.length > 100) throw new AppError('VALIDATION', 'שם מלא חובה (עד 100 תווים).');
      out.full_name = v;
    }
    if (requireAll || has('personal_number')) {
      const v = Util.str(d.personal_number);
      if (!/^[0-9]{1,12}$/.test(v)) throw new AppError('VALIDATION', 'מספר אישי: ספרות בלבד, עד 12 ספרות.');
      out.personal_number = v;
    }
    if (requireAll || has('gender')) {
      const v = Util.str(d.gender);
      if (GENDERS.indexOf(v) === -1) throw new AppError('VALIDATION', 'מגדר חובה (זכר/נקבה).');
      out.gender = v;
    }
    if (has('pakal')) { const v = Util.str(d.pakal); if (v.length > 50) throw new AppError('VALIDATION', 'פק״ל ארוך מדי.'); out.pakal = v; }
    if (has('enlistment_date')) { const v = Util.str(d.enlistment_date); out.enlistment_date = v === '' ? '' : Util.isoDate(v, 'תאריך גיוס'); }
    if (has('sociometric_third')) { const v = Util.str(d.sociometric_third); if (v.length > 20) throw new AppError('VALIDATION', 'שליש סוציומטרי ארוך מדי.'); out.sociometric_third = v; }
    if (has('commander_note')) { const v = Util.str(d.commander_note); if (v.length > 1000) throw new AppError('VALIDATION', 'הערה ארוכה מדי.'); out.commander_note = v; }
    return out;
  },

  /** Unique inside the course across ALL soldiers (cancelled included). */
  assertUniqueNumber_(courseId, number, exceptId) {
    const dup = Db.where('Soldiers', function (s) { return s.course_id === courseId && String(s.personal_number) === number && s.id !== exceptId; })[0];
    if (dup) throw new AppError('DUPLICATE', 'מספר אישי זה כבר קיים בקורס.');
  },

  create(ctx, courseId, data) {
    data = data || {};
    Records.guardCourse_(ctx, 'soldier.create', courseId);
    const f = Soldiers.clean_(data, true);
    Soldiers.checkOrg_(courseId, data.department_id, data.team_id);
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'soldier.create', courseId);
      Soldiers.checkOrg_(courseId, data.department_id, data.team_id);
      Soldiers.assertUniqueNumber_(courseId, f.personal_number, null);
      const now = Util.nowIso();
      const row = Object.assign({ pakal: '', enlistment_date: '', sociometric_third: '', commander_note: '' }, f, {
        id: Util.uuid(), course_id: courseId, department_id: Util.str(data.department_id), team_id: Util.str(data.team_id),
        pzm_value: '', pzm_flag: '', active: true, record_status: RECORD_STATUS.ACTIVE,
        created_at: now, created_by: ctx.email, updated_at: now, updated_by: ctx.email });
      Db.insert('Soldiers', row);
      Audit.log(ctx, { courseId: courseId, action: 'SOLDIER_CREATE', table: 'Soldiers', recordId: row.id, after: row });
      return Soldiers.view_(ctx, row);
    });
  },

  /** Shared skeleton for admin mutations: pre-check, lock, reload, re-authorise, stale check, apply, audit. */
  mutate_(ctx, action, id, expected, reason, needReason, build) {
    if (needReason && Util.isBlank(reason)) throw new AppError('VALIDATION', 'חובה לציין סיבה.');
    const pre = Soldiers.load_(ctx, id);
    Records.guardCourse_(ctx, action, pre.course_id);
    return Locks.run(function () {
      const cur = Soldiers.load_(ctx, id);                          // reload + re-authorise inside the lock
      Records.guardCourse_(ctx, action, cur.course_id);
      if (expected !== undefined) Soldiers.checkStale_(cur, expected);
      const plan = build(cur);                                       // { patch, auditAction, before, after }
      let now = Util.nowIso();
      if (now <= String(cur.updated_at)) now = new Date(Date.parse(cur.updated_at) + 1).toISOString();   // strictly increasing: two writes in the same millisecond must still be distinguishable
      const patch = Object.assign({}, plan.patch, { updated_at: now, updated_by: ctx.email });
      Db.update('Soldiers', cur.id, patch);
      Audit.log(ctx, { courseId: cur.course_id, action: plan.auditAction, table: 'Soldiers', recordId: cur.id, before: plan.before, after: plan.after, reason: Util.str(reason) });
      return Soldiers.view_(ctx, Db.get('Soldiers', cur.id));
    });
  },

  diff_(cur, f) {
    const before = {}, after = {}; let n = 0;
    Object.keys(f).forEach(function (k) { const curV = k === 'enlistment_date' ? Util.cellToIsoDate(cur[k]) : (cur[k] === undefined || cur[k] === null ? '' : cur[k]);
      if (String(curV) !== String(f[k])) { before[k] = cur[k]; after[k] = f[k]; n++; } });
    return { before: before, after: after, changed: n };
  },

  update(ctx, id, patch, expectedUpdatedAt, reason) {
    patch = patch || {};
    Object.keys(patch).forEach(function (k) { if (Soldiers.EDITABLE.indexOf(k) === -1) throw new AppError('VALIDATION', 'השדה אינו ניתן לעריכה כאן: ' + k); });
    const f = Soldiers.clean_(patch, false);
    if (!Object.keys(f).length) throw new AppError('VALIDATION', 'לא צוינו שינויים.');
    return Soldiers.mutate_(ctx, 'soldier.edit', id, expectedUpdatedAt === undefined ? null : expectedUpdatedAt, reason, true, function (cur) {
      const d = Soldiers.diff_(cur, f);
      if (!d.changed) throw new AppError('VALIDATION', 'לא בוצע שינוי בערכים.');
      if (f.personal_number !== undefined) Soldiers.assertUniqueNumber_(cur.course_id, f.personal_number, cur.id);
      if (cur.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('RECORD_CANCELLED', 'החייל מבוטל — יש לשחזר אותו לפני עריכה.');
      return { patch: f, auditAction: 'SOLDIER_EDIT', before: d.before, after: d.after };
    });
  },

  reassign(ctx, id, target, expectedUpdatedAt, reason) {
    target = target || {};
    return Soldiers.mutate_(ctx, 'soldier.reassign', id, expectedUpdatedAt === undefined ? null : expectedUpdatedAt, reason, true, function (cur) {
      if (cur.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('RECORD_CANCELLED', 'החייל מבוטל — יש לשחזר אותו לפני שינוי שיוך.');
      Soldiers.checkOrg_(cur.course_id, target.department_id, target.team_id);
      if (cur.department_id === Util.str(target.department_id) && cur.team_id === Util.str(target.team_id)) throw new AppError('VALIDATION', 'השיוך לא השתנה.');
      const course = Courses.mustGet_(cur.course_id);
      const started = Util.cellToIsoDate(course.start_date) <= Util.todayIso();
      if (started && target.approved_exception !== true) throw new AppError('REASSIGN_AFTER_START', 'הקורס כבר התחיל: שינוי שיוך מותר רק כחריג מאושר במפורש על ידי מנהל המערכת.');
      return { patch: { department_id: Util.str(target.department_id), team_id: Util.str(target.team_id) }, auditAction: 'SOLDIER_REASSIGN',
        before: { department_id: cur.department_id, team_id: cur.team_id },
        after: { department_id: Util.str(target.department_id), team_id: Util.str(target.team_id), after_course_start_exception: started } };
    });
  },

  /** Activity status (active / inactive). Independent from cancel/restore. */
  setActive(ctx, id, active, expectedUpdatedAt, reason) {
    if (typeof active !== 'boolean') throw new AppError('VALIDATION', 'סטטוס פעילות לא תקין.');
    return Soldiers.mutate_(ctx, 'soldier.activity', id, expectedUpdatedAt === undefined ? null : expectedUpdatedAt, reason, true, function (cur) {
      if (cur.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('RECORD_CANCELLED', 'החייל מבוטל — יש לשחזר אותו לפני שינוי סטטוס.');
      if (Util.isTrue(cur.active) === active) throw new AppError('VALIDATION', 'הסטטוס לא השתנה.');
      return { patch: { active: active }, auditAction: 'SOLDIER_ACTIVITY', before: { active: Util.isTrue(cur.active) }, after: { active: active } };
    });
  },

  cancel(ctx, id, reason) {
    return Soldiers.mutate_(ctx, 'soldier.cancel', id, undefined, reason, true, function (cur) {
      if (cur.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('VALIDATION', 'החייל כבר מבוטל.');
      return { patch: { record_status: RECORD_STATUS.CANCELLED }, auditAction: 'SOLDIER_CANCEL', before: { record_status: cur.record_status }, after: { record_status: RECORD_STATUS.CANCELLED } };
    });
  },

  restore(ctx, id, reason) {
    return Soldiers.mutate_(ctx, 'soldier.restore', id, undefined, reason, false, function (cur) {
      if (cur.record_status === RECORD_STATUS.ACTIVE) throw new AppError('VALIDATION', 'החייל אינו מבוטל.');
      return { patch: { record_status: RECORD_STATUS.ACTIVE }, auditAction: 'SOLDIER_RESTORE', before: { record_status: cur.record_status }, after: { record_status: RECORD_STATUS.ACTIVE } };
    });
  },

  /** Role-aware projection of a soldier row. Admin-only fields never leave the server for a commander. */
  view_(ctx, s) {
    const out = { id: s.id, course_id: s.course_id, personal_number: String(s.personal_number), full_name: s.full_name, gender: s.gender,
      department_id: s.department_id, team_id: s.team_id, pakal: s.pakal || '', enlistment_date: Util.cellToIsoDate(s.enlistment_date),
      active: Util.isTrue(s.active), updated_at: s.updated_at };
    if (ctx.role === ROLES.ADMIN) {
      out.record_status = s.record_status; out.sociometric_third = s.sociometric_third || ''; out.commander_note = s.commander_note || '';
      out.created_by = s.created_by; out.updated_by = s.updated_by;
    }
    return out;
  },

  /** Registry list: compact, no sensitive personal fields. opts: q (name / personal number), departmentId, teamId, pakal, active, includeCancelled (admin). */
  list(ctx, courseId, opts) {
    opts = opts || {};
    Records.guardCourse_(ctx, 'soldier.read', courseId);
    const q = Util.str(opts.q).toLowerCase();
    const org = Courses.org(ctx, courseId);
    const depName = {}, teamName = {};
    org.departments.forEach(function (d) { depName[d.id] = d.name; });
    org.teams.forEach(function (t) { teamName[t.id] = t.name; });
    const includeCancelled = opts.includeCancelled === true && ctx.role === ROLES.ADMIN;
    const vis = Soldiers.visibleFn_(ctx, courseId);
    const rows = Db.where('Soldiers', function (s) {
      if (s.course_id !== courseId) return false;
      if (!vis(s)) return false;
      if (s.record_status !== RECORD_STATUS.ACTIVE && !includeCancelled) return false;
      if (opts.departmentId && s.department_id !== opts.departmentId) return false;
      if (opts.teamId && s.team_id !== opts.teamId) return false;
      if (!Util.isBlank(opts.pakal) && String(s.pakal || '') !== Util.str(opts.pakal)) return false;
      if (typeof opts.active === 'boolean' && Util.isTrue(s.active) !== opts.active) return false;
      if (q && String(s.full_name).toLowerCase().indexOf(q) === -1 && String(s.personal_number).indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) { return String(a.full_name).localeCompare(String(b.full_name), 'he'); });
    return rows.map(function (s) {
      const o = Util.pick(Soldiers.view_(ctx, s), Soldiers.LIST_FIELDS.concat(ctx.role === ROLES.ADMIN ? ['record_status'] : []));
      o.department_name = depName[s.department_id] || ''; o.team_name = teamName[s.team_id] || '';
      return o;
    });
  },

  /** The soldier card. Contains ONLY data that really exists in the system today. */
  card(ctx, id) {
    const s = Soldiers.load_(ctx, id);
    Records.guardCourse_(ctx, 'soldier.read', s.course_id);
    const org = Courses.org(ctx, s.course_id);
    const dep = org.departments.filter(function (d) { return d.id === s.department_id; })[0], team = org.teams.filter(function (t) { return t.id === s.team_id; })[0];
    const course = Courses.mustGet_(s.course_id);
    const card = { soldier: Soldiers.view_(ctx, s), course: { id: course.id, name: course.name, status: course.status },
      department_name: dep ? dep.name : '', team_name: team ? team.name : '' };
    // existing real data: navigation (active records only; per existing result.read rules)
    const nav = Navigation.summary(ctx, s.course_id, s.id);                                  // CURRENT snapshot (cancelled soldier => no data)
    const hist = Navigation.list(ctx, s.course_id, { soldierId: s.id });                     // HISTORY (admin sees a cancelled soldier's results too)
    card.navigation = { count: nav.count, mean_display: nav.mean_display, by_type: nav.by_type, excluded_from_snapshot: !Snapshot.eligible_(s), history_count: hist.length,
      records: hist.slice(0, 50).map(function (r) { return { id: r.id, test_date: r.test_date, type_name: r.type_name, final_display: r.final_display, created_by_name: r.created_by_name }; }) };
    card.documents = Soldiers.documents_(ctx, s);
    card.history = Soldiers.history_(ctx, s);
    return card;
  },

  /** Documents attached to the soldier. Admin: all. Commander: full row only for his own uploads; others: existence/uploader/date only. No Drive access is implemented yet. */
  documents_(ctx, s) {
    return Db.where('Documents', function (d) { return d.course_id === s.course_id && d.soldier_id === s.id; }).map(function (d) {
      const own = ctx.role === ROLES.ADMIN || String(d.uploaded_by).toLowerCase() === ctx.email;
      const o = { id: d.id, document_type: d.document_type, uploaded_by: d.uploaded_by, uploaded_at: d.uploaded_at, can_open: own };
      if (own) { o.file_name = d.file_name; o.approval_status = d.approval_status; }
      return o;
    });
  },

  /** Admin: full audit trail with before/after. Commander: event type and time only (no values, no actor). */
  history_(ctx, s) {
    return Db.where('AuditLog', function (a) { return a.table_name === 'Soldiers' && a.record_id === s.id; }).map(function (a) {
      if (ctx.role === ROLES.ADMIN) return { action: a.action, actor: a.actor_email, at: a.timestamp, reason: a.reason, before: Util.parseJson(a.before_json, null), after: a.action === 'SOLDIER_CREATE' ? null : Util.parseJson(a.after_json, null) };
      return { action: a.action, at: a.timestamp };
    }).filter(function (h) { return ctx.role === ROLES.ADMIN || ['SOLDIER_CANCEL', 'SOLDIER_RESTORE'].indexOf(h.action) === -1; });
  }
};
