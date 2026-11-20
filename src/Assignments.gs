/**
 * Assignments — CommanderAssignments: which soldiers a commander may see (Stage 3, v0.4.0).
 *
 * Model (admin-managed, server-enforced):
 *  - A commander must first be in the course (Users.course_scope, unchanged). Inside the course he sees ONLY the soldiers covered by his ACTIVE assignments.
 *  - scope_type 'course'     : every soldier of the course.
 *  - scope_type 'department' : every soldier of that department (BOTH of its teams).
 *  - scope_type 'team'       : only the soldiers of that single team.
 *  - Several assignments are a UNION. No active assignment => NO soldiers (fail closed). Admin is never restricted.
 *  - Visibility = Soldiers.isVisible_ (cancelled/inactive hidden) AND covered by an assignment. Every read path goes through it.
 *  - Only the admin creates / edits / cancels assignments; blocked on an archived course; always audited with before/after.
 *  - Assignments are NOT cloned with a course (a new course starts with nobody assigned).
 */
const Assignments = {
  TYPES: ['course', 'department', 'team'],

  /** Fresh read every call (no cache): an assignment change is effective on the very next check. */
  activeFor_(email, courseId) {
    const e = String(email || '').trim().toLowerCase();
    return Db.where('CommanderAssignments', function (a) { return a.course_id === courseId && String(a.user_email).trim().toLowerCase() === e && Util.isTrue(a.active); });
  },

  covers_(list, s) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.scope_type === 'course' && a.scope_id === s.course_id) return true;
      if (a.scope_type === 'department' && a.scope_id === s.department_id) return true;
      if (a.scope_type === 'team' && a.scope_id === s.team_id) return true;
    }
    return false;
  },

  /** Validates an assignment target inside the course. Returns the normalised pair. */
  checkScope_(courseId, type, scopeId) {
    Soldiers.scalar_(type, 'scope_type'); Soldiers.scalar_(scopeId, 'scope_id');
    const t = Util.str(type), id = Util.str(scopeId);
    if (Assignments.TYPES.indexOf(t) === -1) throw new AppError('VALIDATION', 'סוג שיוך לא תקין (קורס / מחלקה / צוות).');
    if (t === 'course') { if (id !== courseId) throw new AppError('VALIDATION', 'שיוך ברמת קורס חייב להצביע על הקורס עצמו.'); }
    else if (t === 'department') {
      const d = Db.get('Departments', id); if (!d || d.course_id !== courseId || !Util.isTrue(d.active)) throw new AppError('VALIDATION', 'מחלקה לא תקינה.');
    } else {
      const tm = Db.get('Teams', id); if (!tm || tm.course_id !== courseId || !Util.isTrue(tm.active)) throw new AppError('VALIDATION', 'צוות לא תקין.');
    }
    return { scope_type: t, scope_id: id };
  },

  /** The user must be a commander of this course. requireActive (create / re-activate): a disabled user cannot receive or regain an assignment. */
  checkUser_(courseId, email, requireActive) {
    Soldiers.scalar_(email, 'user_email');
    const e = Util.str(email).toLowerCase();
    const u = Db.where('Users', function (x) { return String(x.email).trim().toLowerCase() === e; })[0];
    if (!u || u.role !== ROLES.COMMANDER) throw new AppError('VALIDATION', 'השיוך אפשרי רק למפקד רשום.');
    if (requireActive && !Util.isTrue(u.active)) throw new AppError('VALIDATION', 'המפקד מושבת — לא ניתן לשייך אותו.');
    if (Util.str(u.course_scope).split(',').map(function (s) { return s.trim(); }).indexOf(courseId) === -1) throw new AppError('VALIDATION', 'המפקד אינו משויך לקורס זה. יש להוסיף אותו לקורס קודם.');
    return e;
  },

  assertNoActiveDuplicate_(row, exceptId) {
    const dup = Db.where('CommanderAssignments', function (a) {
      return a.id !== exceptId && Util.isTrue(a.active) && a.course_id === row.course_id && String(a.user_email).toLowerCase() === row.user_email && a.scope_type === row.scope_type && a.scope_id === row.scope_id;
    })[0];
    if (dup) throw new AppError('DUPLICATE', 'שיוך זהה כבר קיים ופעיל.');
  },

  load_(ctx, id) {
    const a = Db.get('CommanderAssignments', Util.str(id));
    if (!a || !Policy.inScope(ctx, a.course_id)) throw new AppError('NOT_FOUND', 'השיוך לא נמצא.');
    return a;
  },

  create(ctx, p) {
    p = p || {};
    Soldiers.scalar_(p.course_id, 'course_id');
    const courseId = Util.str(p.course_id);
    if (!courseId) throw new AppError('VALIDATION', 'חסר קורס.');
    Records.guardCourse_(ctx, 'assignment.manage', courseId);
    if (typeof p.reason !== 'string' || Util.isBlank(p.reason)) throw new AppError('VALIDATION', 'חובה לציין סיבה.');
    const reason = Util.str(p.reason);
    const scope = Assignments.checkScope_(courseId, p.scope_type, p.scope_id);
    const email = Assignments.checkUser_(courseId, p.user_email, true);
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'assignment.manage', courseId);
      Assignments.checkScope_(courseId, scope.scope_type, scope.scope_id); const e2 = Assignments.checkUser_(courseId, email, true);
      const now = Util.nowIso();
      const row = { id: Util.uuid(), course_id: courseId, user_email: e2, scope_type: scope.scope_type, scope_id: scope.scope_id, active: true, created_at: now, created_by: ctx.email, updated_at: now, updated_by: ctx.email };
      Assignments.assertNoActiveDuplicate_(row, null);
      Db.insert('CommanderAssignments', row);
      Audit.log(ctx, { courseId: courseId, action: 'ASSIGNMENT_CREATE', table: 'CommanderAssignments', recordId: row.id, after: Util.pick(row, ['user_email', 'scope_type', 'scope_id', 'active']), reason: reason });
      return row;
    });
  },

  /** Shared skeleton: pre-check, lock, reload, re-authorise, stale check, apply, audit (before/after + reason). */
  mutate_(ctx, id, expected, reason, build) {
    if (Util.isBlank(reason)) throw new AppError('VALIDATION', 'חובה לציין סיבה.');
    const pre = Assignments.load_(ctx, id);
    Records.guardCourse_(ctx, 'assignment.manage', pre.course_id);
    return Locks.run(function () {
      const cur = Assignments.load_(ctx, id);
      Records.guardCourse_(ctx, 'assignment.manage', cur.course_id);
      Soldiers.checkStale_(cur, expected);
      const plan = build(cur);
      let now = Util.nowIso(); if (now <= String(cur.updated_at)) now = new Date(Date.parse(cur.updated_at) + 1).toISOString();
      Db.update('CommanderAssignments', cur.id, Object.assign({}, plan.patch, { updated_at: now, updated_by: ctx.email }));
      Audit.log(ctx, { courseId: cur.course_id, action: plan.action, table: 'CommanderAssignments', recordId: cur.id, before: plan.before, after: plan.after, reason: Util.str(reason) });
      return Db.get('CommanderAssignments', cur.id);
    });
  },

  /** Change the scope (type + target) of an existing assignment. */
  update(ctx, id, patch, expectedUpdatedAt, reason) {
    patch = patch || {};
    Object.keys(patch).forEach(function (k) { if (k !== 'scope_type' && k !== 'scope_id') throw new AppError('VALIDATION', 'השדה אינו ניתן לעריכה: ' + k); });
    return Assignments.mutate_(ctx, id, expectedUpdatedAt, reason, function (cur) {
      const scope = Assignments.checkScope_(cur.course_id, patch.scope_type === undefined ? cur.scope_type : patch.scope_type, patch.scope_id === undefined ? cur.scope_id : patch.scope_id);
      if (scope.scope_type === cur.scope_type && scope.scope_id === cur.scope_id) throw new AppError('VALIDATION', 'לא בוצע שינוי.');
      Assignments.checkUser_(cur.course_id, cur.user_email);
      if (Util.isTrue(cur.active)) Assignments.assertNoActiveDuplicate_(Object.assign({}, cur, scope), cur.id);
      return { patch: scope, action: 'ASSIGNMENT_UPDATE', before: { scope_type: cur.scope_type, scope_id: cur.scope_id }, after: scope };
    });
  },

  /** Soft cancel (active=false) / re-activate. Nothing is deleted. */
  setActive(ctx, id, active, expectedUpdatedAt, reason) {
    if (typeof active !== 'boolean') throw new AppError('VALIDATION', 'סטטוס לא תקין.');
    return Assignments.mutate_(ctx, id, expectedUpdatedAt, reason, function (cur) {
      if (Util.isTrue(cur.active) === active) throw new AppError('VALIDATION', 'הסטטוס לא השתנה.');
      if (active) { Assignments.checkScope_(cur.course_id, cur.scope_type, cur.scope_id); Assignments.checkUser_(cur.course_id, cur.user_email, true); Assignments.assertNoActiveDuplicate_(cur, cur.id); }
      return { patch: { active: active }, action: active ? 'ASSIGNMENT_RESTORE' : 'ASSIGNMENT_CANCEL', before: { active: Util.isTrue(cur.active) }, after: { active: active } };
    });
  },

  /** Admin: all assignments of a course (optionally of one commander), with readable names. */
  list(ctx, courseId, opts) {
    opts = opts || {};
    Records.guardCourse_(ctx, 'assignment.manage', courseId);       // admin only
    const org = Courses.org(ctx, courseId); const names = {};
    org.departments.forEach(function (d) { names[d.id] = d.name; }); org.teams.forEach(function (t) { names[t.id] = t.name; });
    const email = Util.str(opts.userEmail).toLowerCase();
    return Db.where('CommanderAssignments', function (a) { return a.course_id === courseId && (!email || String(a.user_email).toLowerCase() === email); })
      .map(function (a) { return Object.assign({}, a, { active: Util.isTrue(a.active), scope_name: a.scope_type === 'course' ? 'כל הקורס' : (names[a.scope_id] || '') }); });
  },

  /** What the CURRENT user may see in this course (drives the UI filters; the server enforces independently). */
  mine(ctx, courseId) {
    Records.guardCourse_(ctx, 'course.read', courseId);
    if (ctx.role === ROLES.ADMIN) return { course_wide: true, has_assignment: true, department_ids: [], team_ids: [] };
    const list = Assignments.activeFor_(ctx.email, courseId);
    const org = Courses.org(ctx, courseId);
    const courseWide = list.some(function (a) { return a.scope_type === 'course' && a.scope_id === courseId; });
    const depIds = list.filter(function (a) { return a.scope_type === 'department'; }).map(function (a) { return a.scope_id; });
    const teamIds = list.filter(function (a) { return a.scope_type === 'team'; }).map(function (a) { return a.scope_id; });
    const teams = org.teams.filter(function (t) { return courseWide || depIds.indexOf(t.department_id) !== -1 || teamIds.indexOf(t.id) !== -1; }).map(function (t) { return t.id; });
    const deps = org.departments.filter(function (d) { return courseWide || depIds.indexOf(d.id) !== -1 || org.teams.some(function (t) { return t.department_id === d.id && teamIds.indexOf(t.id) !== -1; }); }).map(function (d) { return d.id; });
    return { course_wide: courseWide, has_assignment: list.length > 0, department_ids: deps, team_ids: teams };
  }
};
