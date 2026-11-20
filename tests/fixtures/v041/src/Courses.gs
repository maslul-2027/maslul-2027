/**
 * Courses — create / archive / reopen / clone, org structure (2 departments x 2 teams), user scope.
 */
const Courses = {
  mustGet_(courseId) {
    const c = Db.get('Courses', courseId);
    if (!c) throw new AppError('NOT_FOUND', 'הקורס לא נמצא.');
    return c;
  },

  list(ctx) {
    Policy.require(ctx, 'course.list', {});
    return Db.all('Courses').filter(function (c) { return Policy.inScope(ctx, c.id); })
      .map(function (c) { return Util.pick(c, ['id', 'name', 'start_date', 'status']); });
  },

  org(ctx, courseId) {
    Records.guardCourse_(ctx, 'course.read', courseId);
    const deps = Db.where('Departments', function (d) { return d.course_id === courseId && Util.isTrue(d.active); })
      .sort(function (a, b) { return a.sort_order - b.sort_order; });
    const teams = Db.where('Teams', function (t) { return t.course_id === courseId && Util.isTrue(t.active); })
      .sort(function (a, b) { return a.sort_order - b.sort_order; });
    return {
      departments: deps.map(function (d) { return { id: d.id, name: d.name }; }),
      teams: teams.map(function (t) { return { id: t.id, name: t.name, department_id: t.department_id }; })
    };
  },

  seedOrg_(ctx, courseId, structure) {
    structure.forEach(function (dep, i) {
      const did = Util.uuid();
      Db.insert('Departments', { id: did, course_id: courseId, name: dep.name, sort_order: i + 1, active: true, created_at: Util.nowIso(), created_by: ctx.email });
      dep.teams.forEach(function (tn, j) {
        Db.insert('Teams', { id: Util.uuid(), course_id: courseId, department_id: did, name: tn, sort_order: i * 10 + j + 1, active: true, created_at: Util.nowIso(), created_by: ctx.email });
      });
    });
  },

  create(ctx, p) {
    Policy.require(ctx, 'course.create', {});
    const name = Util.str(p && p.name);
    if (!name || name.length > 80) throw new AppError('VALIDATION', 'שם קורס חובה (עד 80 תווים).');
    const start = Util.isoDate(p.start_date, 'תאריך תחילת קורס');
    return Locks.run(function () {
      const id = Util.uuid();
      const src = p.clone_from ? Courses.mustGet_(p.clone_from) : null;
      if (src && !Policy.inScope(ctx, src.id)) throw new AppError('FORBIDDEN', 'אין הרשאה לקורס המקור.');
      Db.insert('Courses', { id: id, name: name, start_date: start, status: COURSE_STATUS.ACTIVE, created_at: Util.nowIso(), created_by: ctx.email, cloned_from: src ? src.id : '' });
      if (src) Courses.cloneStructure_(ctx, src.id, id, p.clone_permissions === true); else Courses.seedOrg_(ctx, id, DEFAULT_ORG);
      Audit.log(ctx, { courseId: id, action: src ? 'COURSE_CLONE' : 'COURSE_CREATE', table: 'Courses', recordId: id, after: { name: name, start_date: start, cloned_from: src ? src.id : null, clone_permissions: !!(src && p.clone_permissions === true) } });
      return { id: id };
    });
  },

  /** Clones structure and configuration ONLY. Never soldiers, results, notes, assessments, events or history. */
  cloneStructure_(ctx, srcId, newId, clonePermissions) {
    const depMap = {};
    CLONEABLE.forEach(function (table) {
      Db.where(table, function (r) { return r.course_id === srcId; }).forEach(function (r) {
        const copy = Object.assign({}, r, { id: Util.uuid(), course_id: newId, created_at: Util.nowIso(), created_by: ctx.email });
        if (table === 'Departments') depMap[r.id] = copy.id;
        if (table === 'Teams') copy.department_id = depMap[r.department_id] || '';
        if (table === 'ThresholdSettings') { copy.updated_by = ctx.email; copy.updated_at = Util.nowIso(); delete copy.created_at; delete copy.created_by; }
        Db.insert(table, copy);
      });
    });
    // permissions are copied ONLY when the admin explicitly asks (clone_permissions === true). Default: none.
    if (clonePermissions) Db.where('Users', function (u) { return u.role === ROLES.COMMANDER && Util.str(u.course_scope).split(',').map(function (s) { return s.trim(); }).indexOf(srcId) !== -1; })
      .forEach(function (u) {
        Db.update('Users', u.id, { course_scope: Util.str(u.course_scope) + ',' + newId, updated_at: Util.nowIso(), updated_by: ctx.email });
      });
  },

  archive(ctx, courseId) {
    const c = Courses.mustGet_(courseId);
    Policy.require(ctx, 'course.archive', { courseId: courseId, courseStatus: c.status });
    return Locks.run(function () {
      Db.update('Courses', courseId, { status: COURSE_STATUS.ARCHIVED, archived_at: Util.nowIso(), archived_by: ctx.email });
      Audit.log(ctx, { courseId: courseId, action: 'COURSE_ARCHIVE', table: 'Courses', recordId: courseId, before: { status: c.status }, after: { status: COURSE_STATUS.ARCHIVED } });
      return { status: COURSE_STATUS.ARCHIVED };
    });
  },

  reopen(ctx, courseId, reason) {
    const c = Courses.mustGet_(courseId);
    Policy.require(ctx, 'course.reopen', { courseId: courseId, courseStatus: c.status });
    return Locks.run(function () {
      Db.update('Courses', courseId, { status: COURSE_STATUS.ACTIVE, reopened_at: Util.nowIso(), reopened_by: ctx.email });
      Audit.log(ctx, { courseId: courseId, action: 'COURSE_REOPEN', table: 'Courses', recordId: courseId, before: { status: c.status }, after: { status: COURSE_STATUS.ACTIVE }, reason: reason });
      return { status: COURSE_STATUS.ACTIVE };
    });
  },

  rename(ctx, courseId, kind, id, name) {
    const c = Records.guardCourse_(ctx, 'org.rename', courseId);
    const table = kind === 'team' ? 'Teams' : (kind === 'department' ? 'Departments' : null);
    if (!table) throw new AppError('VALIDATION', 'סוג יחידה לא תקין.');
    const nm = Util.str(name);
    if (!nm || nm.length > 60) throw new AppError('VALIDATION', 'שם חובה (עד 60 תווים).');
    const row = Db.get(table, id);
    if (!row || row.course_id !== courseId) throw new AppError('NOT_FOUND', 'היחידה לא נמצאה.');
    return Locks.run(function () {
      Db.update(table, id, { name: nm });
      Audit.log(ctx, { courseId: courseId, action: 'ORG_RENAME', table: table, recordId: id, before: { name: row.name }, after: { name: nm } });
      return { id: id, name: nm };
    });
  },

  // ---------------- users (admin) ----------------
  addUser(ctx, p) {
    Policy.require(ctx, 'user.manage', {});
    const email = Util.str(p && p.email).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AppError('VALIDATION', 'כתובת דוא״ל לא תקינה.');
    const role = p.role;
    if (role !== ROLES.ADMIN && role !== ROLES.COMMANDER) throw new AppError('VALIDATION', 'תפקיד לא תקין.');
    const scope = role === ROLES.COMMANDER ? (p.course_ids || []) : [];
    scope.forEach(function (cid) { Courses.mustGet_(cid); });
    return Locks.run(function () {
      if (Db.where('Users', function (u) { return String(u.email).toLowerCase() === email; }).length) throw new AppError('DUPLICATE', 'משתמש עם דוא״ל זה כבר קיים.');
      const row = { id: Util.uuid(), email: email, display_name: Util.str(p.display_name) || email, role: role, course_scope: scope.join(','),
        active: true, created_at: Util.nowIso(), created_by: ctx.email };
      Db.insert('Users', row);
      Audit.log(ctx, { action: 'USER_ADD', table: 'Users', recordId: row.id, after: Util.pick(row, ['email', 'role', 'course_scope']) });
      return { id: row.id };
    });
  },

  setUser(ctx, userId, patch) {
    Policy.require(ctx, 'user.manage', {});
    const u = Db.get('Users', userId);
    if (!u) throw new AppError('NOT_FOUND', 'המשתמש לא נמצא.');
    const upd = {};
    if ('active' in patch) upd.active = !!patch.active;
    if ('course_ids' in patch && u.role === ROLES.COMMANDER) {
      patch.course_ids.forEach(function (cid) { Courses.mustGet_(cid); });
      upd.course_scope = patch.course_ids.join(',');
    }
    if (String(u.email).toLowerCase() === ctx.email && upd.active === false) throw new AppError('VALIDATION', 'לא ניתן להשבית את המשתמש שלך.');
    if (!Object.keys(upd).length) throw new AppError('VALIDATION', 'אין שינויים.');
    upd.updated_at = Util.nowIso(); upd.updated_by = ctx.email;
    return Locks.run(function () {
      Db.update('Users', userId, upd);
      Audit.log(ctx, { action: 'USER_UPDATE', table: 'Users', recordId: userId, before: Util.pick(u, Object.keys(upd)), after: upd });
      return { ok: true };
    });
  },

  listUsers(ctx) {
    Policy.require(ctx, 'user.manage', {});
    return Db.all('Users').map(function (u) { return Util.pick(u, ['id', 'email', 'display_name', 'role', 'course_scope', 'active']); });
  }
};
