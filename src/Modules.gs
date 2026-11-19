/**
 * Mods — small shared helpers for the tracking modules (v1.0.0): history lists with soldier join, named configurable types, scope helpers.
 * Nothing here relaxes visibility: every soldier-bound list goes through Records.list / Snapshot, which apply assignments and cancelled/inactive rules.
 */
const Mods = {
  soldierMap_(courseId) { const m = Object.create(null); Db.where('Soldiers', function (s) { return s.course_id === courseId; }).forEach(function (s) { m[s.id] = s; }); return m; },

  /** HISTORY list (not a snapshot): rows of a result table with soldier name; team/department filters; newest first by dateKey. */
  history(ctx, table, courseId, opts, dateKey, mapFn) {
    opts = opts || {};
    ['soldierId', 'departmentId', 'teamId'].forEach(function (k) { Soldiers.scalar_(opts[k], k); });
    const rows = Records.list(ctx, table, courseId, { soldierId: Util.str(opts.soldierId) || undefined, includeCancelled: opts.includeCancelled === true });
    const sol = Mods.soldierMap_(courseId), names = Navigation.userNames_();
    return rows.filter(function (r) {
      const s = sol[r.soldier_id];
      if (opts.teamId && (!s || s.team_id !== Util.str(opts.teamId))) return false;
      if (opts.departmentId && (!s || s.department_id !== Util.str(opts.departmentId))) return false;
      return true;
    }).map(function (r) {
      const s = sol[r.soldier_id];
      const o = mapFn(r, s);
      o.id = r.id; o.soldier_id = r.soldier_id; o.soldier_name = s ? s.full_name : '';
      o.created_by_name = names[String(r.created_by).toLowerCase()] || (r.created_by === 'system' ? 'מערכת' : '');
      o.own = String(r.created_by).toLowerCase() === ctx.email;
      if (ctx.role === ROLES.ADMIN) { o.created_by = r.created_by; o.record_status = r.record_status; o.updated_at = r.updated_at; o.soldier_cancelled = !!s && s.record_status !== RECORD_STATUS.ACTIVE; }
      return o;
    }).sort(function (a, b) { const x = String(a[dateKey] || ''), y = String(b[dateKey] || ''); return x < y ? 1 : (x > y ? -1 : 0); });
  },

  /** Does one of the commander's active assignments cover this whole scope (course / department / team)? Admin: always. */
  scopeAllowed_(ctx, courseId, scopeType, scopeId) {
    if (ctx.role === ROLES.ADMIN) return true;
    const list = Assignments.activeFor_(ctx.email, courseId);
    return list.some(function (a) {
      if (a.scope_type === 'course') return true;
      if (scopeType === 'course') return false;
      if (scopeType === 'department') return a.scope_type === 'department' && a.scope_id === scopeId;
      const t = Db.get('Teams', scopeId);
      return (a.scope_type === 'team' && a.scope_id === scopeId) || (a.scope_type === 'department' && !!t && a.scope_id === t.department_id);
    });
  },

  /** Soldiers of a scope that take part in an activity: not cancelled, ACTIVE, visible to the caller. */
  scopeSoldiers_(ctx, courseId, scopeType, scopeId) {
    const vis = Soldiers.visibleFn_(ctx, courseId);
    return Db.where('Soldiers', function (s) {
      if (s.course_id !== courseId || s.record_status !== RECORD_STATUS.ACTIVE || !Util.isTrue(s.active) || !vis(s)) return false;
      if (scopeType === 'department') return s.department_id === scopeId;
      if (scopeType === 'team') return s.team_id === scopeId;
      return true;
    });
  },

  checkScope_(courseId, scopeType, scopeId) {
    Soldiers.scalar_(scopeType, 'scope_type'); Soldiers.scalar_(scopeId, 'scope_id');
    const t = Util.str(scopeType), id = Util.str(scopeId);
    if (['course', 'department', 'team'].indexOf(t) === -1) throw new AppError('VALIDATION', 'תחולה לא תקינה (קורס / מחלקה / צוות).');
    if (t === 'course') { if (id !== courseId) throw new AppError('VALIDATION', 'תחולה ברמת קורס חייבת להצביע על הקורס.'); }
    else { const x = Db.get(t === 'team' ? 'Teams' : 'Departments', id); if (!x || x.course_id !== courseId || !Util.isTrue(x.active)) throw new AppError('VALIDATION', 'יעד התחולה לא תקין.'); }
    return { scope_type: t, scope_id: id };
  },

  /** Generic named, admin-configurable list (activity types, ...). table needs: id, course_id, name, active, created_at, created_by. */
  named(table, label, auditPrefix) {
    const clean = function (courseId, name, exceptId) {
      Soldiers.scalar_(name, 'name'); const v = Util.str(name);
      if (!v || v.length > 50) throw new AppError('VALIDATION', 'שם ' + label + ' חובה (עד 50 תווים).');
      if (Db.where(table, function (t) { return t.course_id === courseId && t.id !== exceptId && String(t.name).trim().toLowerCase() === v.toLowerCase(); }).length) throw new AppError('DUPLICATE', label + ' בשם זה כבר קיים בקורס.');
      return v;
    };
    const mutate = function (ctx, id, build) {
      const pre = Db.get(table, Util.str(id)); if (!pre || !Policy.inScope(ctx, pre.course_id)) throw new AppError('NOT_FOUND', label + ' לא נמצא.');
      Records.guardCourse_(ctx, 'config.edit', pre.course_id);
      return Locks.run(function () {
        const cur = Db.get(table, pre.id); Records.guardCourse_(ctx, 'config.edit', cur.course_id);
        const plan = build(cur); Db.update(table, cur.id, plan.patch);
        Audit.log(ctx, { courseId: cur.course_id, action: plan.action, table: table, recordId: cur.id, before: plan.before, after: plan.after });
        const t = Db.get(table, cur.id); return { id: t.id, name: t.name, active: Util.isTrue(t.active) };
      });
    };
    return {
      list(ctx, courseId) {
        Records.guardCourse_(ctx, 'course.read', courseId);
        return Db.where(table, function (t) { return t.course_id === courseId && (ctx.role === ROLES.ADMIN || Util.isTrue(t.active)); })
          .map(function (t) { return { id: t.id, name: t.name, active: Util.isTrue(t.active) }; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'he'); });
      },
      create(ctx, courseId, name) {
        Records.guardCourse_(ctx, 'config.edit', courseId); const v0 = clean(courseId, name, null);
        return Locks.run(function () {
          Records.guardCourse_(ctx, 'config.edit', courseId); const v = clean(courseId, v0, null);
          const row = { id: Util.uuid(), course_id: courseId, name: v, active: true, created_at: Util.nowIso(), created_by: ctx.email };
          Db.insert(table, row); Audit.log(ctx, { courseId: courseId, action: auditPrefix + '_CREATE', table: table, recordId: row.id, after: { name: v, active: true } });
          return { id: row.id, name: v, active: true };
        });
      },
      rename(ctx, id, name) { return mutate(ctx, id, function (cur) { const v = clean(cur.course_id, name, cur.id); if (v === cur.name) throw new AppError('VALIDATION', 'השם לא השתנה.'); return { patch: { name: v }, action: auditPrefix + '_RENAME', before: { name: cur.name }, after: { name: v } }; }); },
      setActive(ctx, id, active) {
        if (typeof active !== 'boolean') throw new AppError('VALIDATION', 'סטטוס לא תקין.');
        return mutate(ctx, id, function (cur) { if (Util.isTrue(cur.active) === active) throw new AppError('VALIDATION', 'הסטטוס לא השתנה.'); return { patch: { active: active }, action: auditPrefix + '_ACTIVITY', before: { active: Util.isTrue(cur.active) }, after: { active: active } }; });
      }
    };
  },

  /** Reasons / notes must be real strings (a number or array is type confusion, not a reason). Returns trimmed text. */
  reason_(v, required) { if (v !== undefined && v !== null && typeof v !== 'string') throw new AppError('VALIDATION', 'סיבה חייבת להיות טקסט.'); const r = Util.str(v); if (required && !r) throw new AppError('VALIDATION', 'חובה לציין סיבה.'); if (r.length > 500) throw new AppError('VALIDATION', 'הסיבה ארוכה מדי.'); return r; },
  bool_(v, label) {
    if (v === true || v === 'true' || v === 'TRUE') return true;
    if (v === false || v === 'false' || v === 'FALSE') return false;
    throw new AppError('VALIDATION', 'נדרש כן/לא: ' + label);
  },
  note_(v, max) { const s = Util.str(v); if (s.length > (max || 1000)) throw new AppError('VALIDATION', 'טקסט ארוך מדי.'); return s; },
  availableSoldier_(courseId, id) {
    const s = Db.get('Soldiers', Util.str(id));
    if (!s || s.course_id !== courseId || s.record_status !== RECORD_STATUS.ACTIVE || !Util.isTrue(s.active)) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE);
    return s;
  }
};
const ActivityTypes = Mods.named('ActivityTypes', 'סוג פעילות', 'ACTTYPE');
