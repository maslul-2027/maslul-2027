/**
 * Auth — builds the caller context from the verified Google session. The client never supplies identity.
 * Fail-closed: unknown / inactive / blank email => no context.
 * Audit — append-only log. There is intentionally no update/delete API for AuditLog.
 */

const Auth = {
  _emailProvider: null, // tests inject

  email_() {
    if (Auth._emailProvider) return Auth._emailProvider();
    return Session.getActiveUser().getEmail();
  },

  adminEmail_() {
    if (typeof PropertiesService === 'undefined') return '';
    return String(PropertiesService.getScriptProperties().getProperty(APP.PROP.ADMIN_EMAIL) || '').trim().toLowerCase();
  },

  /** @return ctx or null */
  tryContext() {
    const email = String(Auth.email_() || '').trim().toLowerCase();
    if (!email) return null;
    let user = null;
    try {
      user = Db.where('Users', function (u) { return String(u.email).trim().toLowerCase() === email; })[0] || null;
    } catch (e) {
      user = null;
    }
    const bootstrapAdmin = Auth.adminEmail_() && Auth.adminEmail_() === email;
    if (user && !Util.isTrue(user.active) && !bootstrapAdmin) return null;
    if (!user && !bootstrapAdmin) return null;
    const role = bootstrapAdmin ? ROLES.ADMIN : String(user.role);
    if (role !== ROLES.ADMIN && role !== ROLES.COMMANDER) return null;
    let scope = [];
    if (role === ROLES.COMMANDER) scope = Util.str(user.course_scope) ? Util.str(user.course_scope).split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
    return { email: email, role: role, displayName: user ? user.display_name : email, courseScope: role === ROLES.ADMIN ? '*' : scope };
  },

  context() {
    const ctx = Auth.tryContext();
    if (!ctx) throw new AppError('UNAUTHENTICATED', 'אין הרשאה למערכת.');
    return ctx;
  }
};

const Audit = {
  /**
   * Private tables never put their content in the log: only the changed field NAMES are recorded.
   * Everything else logs before/after (admin-only readable).
   */
  sanitize_(table, obj) {
    if (obj === null || obj === undefined) return '';
    if (PRIVATE_TABLES.indexOf(table) !== -1) return Util.jsonCell({ _private: true, fields: Object.keys(obj) });
    return Util.jsonCell(obj);
  },

  log(ctx, entry) {
    const row = {
      id: Util.uuid(),
      course_id: entry.courseId || '',
      actor_email: ctx ? ctx.email : 'system',
      action: entry.action,
      table_name: entry.table || '',
      record_id: entry.recordId || '',
      before_json: Audit.sanitize_(entry.table, entry.before),
      after_json: Audit.sanitize_(entry.table, entry.after),
      reason: entry.reason || '',
      timestamp: Util.nowIso()
    };
    Db.insert('AuditLog', row);
    return row.id;
  },

  /** Admin-only full read. */
  list(ctx, filter) {
    Policy.require(ctx, 'audit.read', {});
    filter = filter || {};
    return Db.where('AuditLog', function (r) {
      return (!filter.courseId || r.course_id === filter.courseId) && (!filter.recordId || r.record_id === filter.recordId) &&
             (!filter.action || r.action === filter.action);
    });
  }
};
