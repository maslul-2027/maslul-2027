/**
 * Policy — single source of truth for who may do what. Pure function of (ctx, action, resource).
 * Enforced server-side by every service; the UI hiding buttons is cosmetic only.
 */
const Policy = {
  ADMIN_ONLY: [
    'course.create', 'course.archive', 'course.reopen', 'course.clone', 'org.rename', 'user.manage', 'config.edit',
    'soldier.create', 'soldier.edit', 'soldier.reassign', 'soldier.import', 'soldier.cancel', 'soldier.restore', 'soldier.activity', 'assignment.manage',
    'result.edit', 'result.cancel', 'result.restore', 'correction.review', 'meeting.audit',
    'private.read', 'private.write', 'document.read_any', 'audit.read', 'backup.run', 'backup.restore',
    'report.generate', 'alert.handle',
    'qual.define', 'qual.exclusion.review', 'qual.postpone', 'settings.edit', 'form.manage', 'import.run', 'ocr.review', 'document.link.review', 'ai.private.optin'
  ],
  COMMANDER: [
    'course.list', 'course.read', 'soldier.read', 'result.read', 'result.create',
    'correction.request', 'correction.history', 'note.shared.create', 'document.upload', 'document.read_own', 'dashboard.view',
    'qual.update', 'qual.exclusion.request', 'settings.read', 'alert.read', 'ai.ask', 'document.list', 'assessment.create',
    'meeting.read', 'meeting.write', 'task.read', 'task.update'     // product-dev6 (module access additionally requires an active assignment: see Meetings.access_)
  ],
  /** Actions that change data. Blocked on archived courses for EVERYONE (even admin) until course.reopen. */
  WRITE: [
    'course.archive', 'course.clone', 'org.rename', 'config.edit',
    'soldier.create', 'soldier.edit', 'soldier.reassign', 'soldier.import', 'soldier.cancel', 'soldier.restore', 'soldier.activity', 'assignment.manage',
    'result.create', 'result.edit', 'result.cancel', 'result.restore',
    'correction.request', 'correction.review', 'note.shared.create', 'private.write', 'document.upload', 'alert.handle',
    'qual.define', 'qual.exclusion.review', 'qual.postpone', 'qual.update', 'qual.exclusion.request', 'settings.edit', 'form.manage', 'import.run', 'ocr.review', 'document.link.review', 'assessment.create', 'meeting.write', 'task.update'
  ],
  /** Actions that need no course (global). */
  GLOBAL: ['course.list', 'course.create', 'user.manage', 'audit.read', 'backup.run', 'backup.restore'],

  inScope(ctx, courseId) {
    if (!ctx || !ctx.role) return false;
    if (ctx.role === ROLES.ADMIN) return true;
    return Array.isArray(ctx.courseScope) && ctx.courseScope.indexOf(courseId) !== -1;
  },

  /** @return {ok:boolean, code?:string, message?:string} */
  check(ctx, action, resource) {
    resource = resource || {};
    if (!ctx || !ctx.email || !ctx.role) return { ok: false, code: 'UNAUTHENTICATED', message: 'נדרשת הזדהות.' };
    const allowed = ctx.role === ROLES.ADMIN
      ? true
      : (ctx.role === ROLES.COMMANDER ? Policy.COMMANDER.indexOf(action) !== -1 : false);
    if (!allowed) return { ok: false, code: 'FORBIDDEN', message: 'אין הרשאה לפעולה זו.' };
    if (Policy.GLOBAL.indexOf(action) === -1) {
      if (!resource.courseId) return { ok: false, code: 'FORBIDDEN', message: 'חסר קורס.' };
      if (!Policy.inScope(ctx, resource.courseId)) return { ok: false, code: 'FORBIDDEN', message: 'אין הרשאה לקורס זה.' };
    }
    if (resource.courseStatus === COURSE_STATUS.ARCHIVED && Policy.WRITE.indexOf(action) !== -1) {
      return { ok: false, code: 'COURSE_ARCHIVED', message: 'הקורס בארכיון ונעול לעריכה. רק מנהל המערכת יכול לפתוח אותו מחדש.' };
    }
    if (action === 'correction.request') {
      if (ctx.role !== ROLES.COMMANDER || !resource.ownerEmail || String(resource.ownerEmail).toLowerCase() !== ctx.email) {
        return { ok: false, code: 'FORBIDDEN', message: 'בקשת תיקון אפשרית רק למי שהזין את הרשומה.' };
      }
    }
    if (action === 'course.list' || action === 'course.read') return { ok: true };
    return { ok: true };
  },

  require(ctx, action, resource) {
    const r = Policy.check(ctx, action, resource);
    if (!r.ok) throw new AppError(r.code, r.message);
    return true;
  }
};
