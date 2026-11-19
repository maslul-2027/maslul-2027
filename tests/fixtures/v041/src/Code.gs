/**
 * Web App entry + server API. The client NEVER supplies identity: ctx always comes from the Google session.
 * Every callable is listed in API_ (whitelist). Anything else is rejected. Errors are sanitised for the client.
 */

const API_ = {
  'courses.list': function (ctx) { return Courses.list(ctx); },
  'courses.org': function (ctx, a) { return Courses.org(ctx, a.courseId); },
  'courses.create': function (ctx, a) { return Courses.create(ctx, a); },
  'courses.archive': function (ctx, a) { return Courses.archive(ctx, a.courseId); },
  'courses.reopen': function (ctx, a) { return Courses.reopen(ctx, a.courseId, a.reason); },
  'courses.rename': function (ctx, a) { return Courses.rename(ctx, a.courseId, a.kind, a.id, a.name); },
  'users.list': function (ctx) { return Courses.listUsers(ctx); },
  'users.add': function (ctx, a) { return Courses.addUser(ctx, a); },
  'users.set': function (ctx, a) { return Courses.setUser(ctx, a.userId, a.patch || {}); },
  'soldiers.list': function (ctx, a) { return Soldiers.list(ctx, a.courseId, a.opts || {}); },
  'soldiers.card': function (ctx, a) { return Soldiers.card(ctx, a.id); },
  'soldiers.create': function (ctx, a) { return Soldiers.create(ctx, a.courseId, a.data); },
  'soldiers.update': function (ctx, a) { return Soldiers.update(ctx, a.id, a.patch, a.expected_updated_at, a.reason); },
  'soldiers.reassign': function (ctx, a) { return Soldiers.reassign(ctx, a.id, a.target, a.expected_updated_at, a.reason); },
  'soldiers.setActive': function (ctx, a) { return Soldiers.setActive(ctx, a.id, a.active, a.expected_updated_at, a.reason); },
  'soldiers.cancel': function (ctx, a) { return Soldiers.cancel(ctx, a.id, a.reason); },
  'soldiers.restore': function (ctx, a) { return Soldiers.restore(ctx, a.id, a.reason); },
  'nav.create': function (ctx, a) { return Records.create(ctx, 'NavigationTests', a.courseId, a.data); },
  'nav.list': function (ctx, a) { return Navigation.list(ctx, a.courseId, { soldierId: a.soldierId, departmentId: a.departmentId, teamId: a.teamId, typeId: a.typeId, from: a.from, to: a.to, includeCancelled: a.includeCancelled === true }); },
  'nav.groups': function (ctx, a) { return Navigation.groupSummary(ctx, a.courseId, a.opts || {}); },
  'navtypes.list': function (ctx, a) { return Navigation.typesList(ctx, a.courseId); },
  'navtypes.create': function (ctx, a) { return Navigation.typeCreate(ctx, a.courseId, a.name); },
  'navtypes.rename': function (ctx, a) { return Navigation.typeRename(ctx, a.id, a.name); },
  'navtypes.setActive': function (ctx, a) { return Navigation.typeSetActive(ctx, a.id, a.active); },
  'assignments.list': function (ctx, a) { return Assignments.list(ctx, a.courseId, a.opts || {}); },
  'assignments.mine': function (ctx, a) { return Assignments.mine(ctx, a.courseId); },
  'assignments.create': function (ctx, a) { return Assignments.create(ctx, a.data); },
  'assignments.update': function (ctx, a) { return Assignments.update(ctx, a.id, a.patch, a.expected_updated_at, a.reason); },
  'assignments.setActive': function (ctx, a) { return Assignments.setActive(ctx, a.id, a.active, a.expected_updated_at, a.reason); },
  'nav.summary': function (ctx, a) { return Navigation.summary(ctx, a.courseId, a.soldierId); },
  'record.edit': function (ctx, a) { return Records.adminEdit(ctx, a.table, a.id, a.patch, a.reason); },
  'record.cancel': function (ctx, a) { return Records.cancel(ctx, a.table, a.id, a.reason); },
  'record.restore': function (ctx, a) { return Records.restore(ctx, a.table, a.id); },
  'record.history': function (ctx, a) { return Records.history(ctx, a.table, a.id); },
  'correction.request': function (ctx, a) { return Records.requestCorrection(ctx, a.table, a.id, a.changes, a.reason); },
  'correction.list': function (ctx, a) { return Records.listCorrections(ctx, a.courseId, a.status); },
  'correction.review': function (ctx, a) { return Records.reviewCorrection(ctx, a.requestId, a.decision, a.note); },
  'audit.list': function (ctx, a) { return Audit.list(ctx, a || {}); }
};

function doGet() {
  const ctx = Auth.tryContext();
  if (!ctx) return HtmlService.createHtmlOutput('<meta charset="utf-8"><body dir="rtl" style="font-family:Arial;padding:24px"><h2>אין הרשאה למערכת</h2><p>יש לפנות למנהל המערכת.</p></body>').setTitle('אין הרשאה');
  return HtmlService.createTemplateFromFile('Index').evaluate().setTitle('מערכת מעקב קורס')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Single client entry point: google.script.run.api('courses.list', {}) */
function api(method, args) {
  try {
    const fn = Object.prototype.hasOwnProperty.call(API_, method) ? API_[method] : null;
    if (!fn) throw new AppError('NOT_FOUND', 'פעולה לא מוכרת.');
    const ctx = Auth.context();
    return { ok: true, data: fn(ctx, args || {}) };
  } catch (e) {
    if (e instanceof AppError || (e && e.name === 'AppError')) return { ok: false, code: e.code, message: e.message };
    console.error(e && e.stack ? e.stack : String(e));            // details to server log only
    return { ok: false, code: 'INTERNAL', message: 'אירעה שגיאה פנימית. נסו שוב או פנו למנהל המערכת.' };
  }
}

function whoAmI() {
  const ctx = Auth.tryContext();
  return ctx ? { ok: true, data: { email: ctx.email, role: ctx.role, displayName: ctx.displayName, version: APP.VERSION } } : { ok: false, code: 'UNAUTHENTICATED', message: 'אין הרשאה.' };
}
