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
  'soldiers.card': function (ctx, a) { return Card.build(ctx, a.id); },
  'soldiers.private': function (ctx, a) { return Private.soldierPrivate(ctx, a.courseId, a.soldierId); },
  'emergency.get': function (ctx, a) { return EmergencyContact.get(ctx, a.courseId, a.soldierId); },        // product-dev6.2 — admin only (private.read), audited without values
  'emergency.set': function (ctx, a) { return EmergencyContact.set(ctx, a.courseId, a.soldierId, a.contact); },   // admin only (private.write)
  'emergency.orphans': function (ctx, a) { return EmergencyContact.reconcileOrphans(ctx, a.courseId, a.apply === true); }, // admin-only preview / explicit cleanup; never returns contact values
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
  'nav.summary': function (ctx, a) { return Analytics.scopeGate_(ctx, a, function () { return Navigation.summary(ctx, a.courseId, a.soldierId); }); },
  'record.edit': function (ctx, a) { return Records.adminEdit(ctx, a.table, a.id, a.patch, a.reason); },
  'record.cancel': function (ctx, a) { return Records.cancel(ctx, a.table, a.id, a.reason); },
  'record.restore': function (ctx, a) { return Records.restore(ctx, a.table, a.id); },
  'record.history': function (ctx, a) { return Records.history(ctx, a.table, a.id); },
  'correction.request': function (ctx, a) { return Records.requestCorrection(ctx, a.table, a.id, a.changes, a.reason); },
  'correction.list': function (ctx, a) { return Records.listCorrections(ctx, a.courseId, a.status); },
  'correction.review': function (ctx, a) { return Records.reviewCorrection(ctx, a.requestId, a.decision, a.note); },
  // ---- v1.0.0 ----
  'settings.list': function (ctx, a) { return Settings.list(ctx, a.courseId); },
  'settings.set': function (ctx, a) { return Settings.set(ctx, a.courseId, a.key, a.value, a.effective_from, a.reason); },
  'fitness.types': function (ctx, a) { return Fitness.typesList(ctx, a.courseId); },
  'fitness.typeCreate': function (ctx, a) { return Fitness.typeCreate(ctx, a.courseId, a.data); },
  'fitness.typeWeights': function (ctx, a) { return Fitness.typeSetWeights(ctx, a.id, a.weights, a.reason); },
  'fitness.typeActive': function (ctx, a) { return Fitness.typeSetActive(ctx, a.id, a.active, a.reason); },
  'fitness.typeVariant': function (ctx, a) { return Fitness.typeSetVariant(ctx, a.id, a.component, a.variant, a.reason); },
  'fitness.draftSource': function (ctx, a) { return Fitness.draftSource(ctx); },
  'fitness.versions': function (ctx, a) { return Fitness.versionsList(ctx, a.courseId); },
  'fitness.importDraft': function (ctx, a) { return Fitness.importDraft(ctx, a.courseId, a.data); },
  'fitness.editRow': function (ctx, a) { return Fitness.editRow(ctx, a.versionId, a.rowId, a.patch, a.reason); },
  'fitness.addTable': function (ctx, a) { return Fitness.addTable(ctx, a.versionId, a.data); },
  'fitness.approve': function (ctx, a) { return Fitness.approve(ctx, a.versionId, a.data); },
  'fitness.create': function (ctx, a) { return Records.create(ctx, 'FitnessTests', a.courseId, a.data); },
  'fitness.list': function (ctx, a) { return Fitness.list(ctx, a.courseId, a.opts || {}); },
  'fitness.summary': function (ctx, a) { return Analytics.scopeGate_(ctx, a, function () { return Fitness.summary(ctx, a.courseId, a.soldierId); }); },
  'fitness.completion': function (ctx, a) { return Fitness.completion(ctx, a.courseId, a.opts || {}); },
  'fitness.quality': function (ctx, a) { return Fitness.dataQuality(ctx, a.courseId); },
  'fitness.recompute': function (ctx, a) { return Fitness.recompute(ctx, a.id, a.reason); },
  'mk.create': function (ctx, a) { return Records.create(ctx, 'MarksmanshipTests', a.courseId, a.data); },
  'mk.list': function (ctx, a) { return Marksmanship.list(ctx, a.courseId, a.opts || {}); },
  'mk.summary': function (ctx, a) { return Analytics.scopeGate_(ctx, a, function () { return Marksmanship.summary(ctx, a.courseId, a.soldierId); }); },
  'exams.defs': function (ctx, a) { return Exams.defsList(ctx, a.courseId); },
  'exams.defCreate': function (ctx, a) { return Exams.defCreate(ctx, a.courseId, a.data); },
  'exams.defPass': function (ctx, a) { return Exams.defSetPass(ctx, a.id, a.pass, a.reason); },
  'exams.attempt': function (ctx, a) { return Exams.addAttempt(ctx, a.courseId, a.data); },
  'exams.attempts': function (ctx, a) { return Exams.attemptsList(ctx, a.courseId, a.opts || {}); },
  'exams.meetings': function (ctx, a) { return Exams.meetingsList(ctx, a.courseId, a.opts || {}); },
  'exams.summary': function (ctx, a) { return Analytics.scopeGate_(ctx, a, function () { return Exams.summary(ctx, a.courseId, a.soldierId); }); },
  'acttypes.list': function (ctx, a) { return ActivityTypes.list(ctx, a.courseId); },
  'acttypes.create': function (ctx, a) { return ActivityTypes.create(ctx, a.courseId, a.name); },
  'acttypes.rename': function (ctx, a) { return ActivityTypes.rename(ctx, a.id, a.name); },
  'acttypes.setActive': function (ctx, a) { return ActivityTypes.setActive(ctx, a.id, a.active); },
  'attendance.create': function (ctx, a) { return Attendance.createEvent(ctx, a.courseId, a.data); },
  'attendance.events': function (ctx, a) { return Attendance.eventsList(ctx, a.courseId, a.opts || {}); },
  'attendance.roll': function (ctx, a) { return Attendance.eventRoll(ctx, a.courseId, a.eventId); },
  'attendance.summary': function (ctx, a) { return Analytics.scopeGate_(ctx, a, function () { return Attendance.summary(ctx, a.courseId, a.soldierId, a.opts || {}); }); },
  'marches.create': function (ctx, a) { return Marches.create(ctx, a.courseId, a.data); },
  'marches.list': function (ctx, a) { return Marches.list(ctx, a.courseId, a.opts || {}); },
  'marches.summary': function (ctx, a) { return Analytics.scopeGate_(ctx, a, function () { return Marches.summary(ctx, a.courseId, a.soldierId, a.opts || {}); }); },
  'readiness.assess': function (ctx, a) { return Readiness.assess(ctx, a.courseId, a.data); },
  'readiness.list': function (ctx, a) { return Readiness.list(ctx, a.courseId, a.opts || {}); },
  'readiness.summary': function (ctx, a) { return Readiness.summary(ctx, a.courseId, a.opts || {}); },
  'readiness.notEntered': function (ctx, a) { return Readiness.notEntered(ctx, a.courseId, a.opts || {}); },   // operational action queue (ids only)
  'events.create': function (ctx, a) { return Records.create(ctx, 'SoldierEvents', a.courseId, a.data); },
  'events.list': function (ctx, a) { return SoldierEvents.list(ctx, a.courseId, a.opts || {}); },
  'qual.define': function (ctx, a) { return Qualifications.define(ctx, a.courseId, a.data); },
  'qual.list': function (ctx, a) { return Qualifications.list(ctx, a.courseId); },
  'qual.setActive': function (ctx, a) { return Qualifications.setActive(ctx, a.id, a.active, a.reason); },
  'qual.postpone': function (ctx, a) { return Qualifications.postpone(ctx, a.id, a.date, a.reason); },
  'qual.dueHistory': function (ctx, a) { return Qualifications.dueHistory(ctx, a.id); },
  'qual.assignments': function (ctx, a) { return Qualifications.assignments(ctx, a.courseId, a.opts || {}); },
  'qual.update': function (ctx, a) { return Qualifications.update(ctx, a.id, a.patch, a.expected_updated_at, a.reason); },
  'qual.requestExclusion': function (ctx, a) { return Qualifications.requestExclusion(ctx, a.id, a.reason); },
  'qual.reviewExclusion': function (ctx, a) { return Qualifications.reviewExclusion(ctx, a.id, a.decision, a.note); },
  'qual.summary': function (ctx, a) { return Qualifications.summary(ctx, a.courseId, a.opts || {}); },
  'assess.add': function (ctx, a) { return Private.addAssessment(ctx, a.courseId, a.data); },
  'assess.list': function (ctx, a) { return Private.listAssessments(ctx, a.courseId, a.soldierId); },
  'notes.save': function (ctx, a) { return Private.saveNote(ctx, a.courseId, a.data); },
  'notes.list': function (ctx, a) { return Private.listNotes(ctx, a.courseId, a.soldierId, a.all === true); },
  'followups.create': function (ctx, a) { return Private.createFollowUp(ctx, a.courseId, a.data); },
  'followups.update': function (ctx, a) { return Private.updateFollowUp(ctx, a.id, a.patch); },
  'followups.list': function (ctx, a) { return Private.listFollowUps(ctx, a.courseId, a.opts || {}); },
  'favorites.toggle': function (ctx, a) { return Private.toggleFavorite(ctx, a.courseId, a.soldierId); },
  'favorites.list': function (ctx, a) { return Private.listFavorites(ctx, a.courseId); },
  'snote.add': function (ctx, a) { return SharedNotes.add(ctx, a.table, a.id, a.text, a.mentions); },
  'snote.list': function (ctx, a) { return SharedNotes.list(ctx, a.table, a.id); },
  'snote.cancel': function (ctx, a) { return SharedNotes.cancel(ctx, a.id); },
  'alerts.refresh': function (ctx, a) { return Alerts.refresh(ctx, a.courseId, a.today); },
  'alerts.list': function (ctx, a) { return Alerts.list(ctx, a.courseId, a.opts || {}); },
  'alerts.handle': function (ctx, a) { return Alerts.handle(ctx, a.id, a.to, a.note); },
  'alerts.counts': function (ctx, a) { return Alerts.counts(ctx, a.courseId); },
  'forms.generalLink': function (ctx, a) { return Forms.generalLink(ctx, a.courseId); },
  'forms.createLink': function (ctx, a) { return Forms.createLink(ctx, a.courseId, a.soldierId, a.days); },
  'forms.list': function (ctx, a) { return Forms.list(ctx, a.courseId, a.status); },
  'forms.review': function (ctx, a) { return Forms.review(ctx, a.id, a.decision, a.note); },
  'dash.home': function (ctx, a) { return Dashboard.home(ctx); },
  'dash.overview': function (ctx, a) { return Dashboard.overview(ctx, a.courseId, a.opts || {}); },
  'dash.groups': function (ctx, a) { return Dashboard.groups(ctx, a.courseId, a.by, a.opts || {}); },
  'dash.compareCourses': function (ctx, a) { return Dashboard.compareCourses(ctx, a.courseIds); },
  'dash.trends': function (ctx, a) { return Dashboard.trends(ctx, a.courseId, a.soldierId); },
  'dash.strengthsGaps': function (ctx, a) { return Dashboard.strengthsGaps(ctx, a.courseId, a.soldierId); },
  'analytics.insights': function (ctx, a) { return Analytics.insights(ctx, a.courseId, a.f || {}); },   // product-dev6.2 — local, explainable, aggregate only
  'reports.build': function (ctx, a) { return Reports.build(ctx, a.courseId, a.spec); },
  'reports.preview': function (ctx, a) { return Reports.preview(ctx, a.courseId, a.spec); },
  'reports.generate': function (ctx, a) { return Reports.generate(ctx, a.courseId, a.spec, a.format); },
  'reports.fullExport': function (ctx, a) { return Reports.fullExport(ctx, a.courseId, a.include_private === true); },
  'reports.download': function (ctx, a) { return Reports.download(ctx, a.id); },
  'reports.jobs': function (ctx, a) { return Reports.jobs(ctx, a.courseId); },
  'import.start': function (ctx, a) { return Import.start(ctx, a.courseId, a.data); },
  'import.preview': function (ctx, a) { return Import.preview(ctx, a.id, a.page); },
  'import.decide': function (ctx, a) { return Import.decide(ctx, a.id, a.rowNo, a.decision); },
  'import.commit': function (ctx, a) { return Import.commit(ctx, a.id, a.confirm); },
  'import.cancel': function (ctx, a) { return Import.cancel(ctx, a.id, a.reason); },
  'import.jobs': function (ctx, a) { return Import.jobs(ctx, a.courseId); },
  'docs.upload': function (ctx, a) { return Documents.upload(ctx, a.courseId, a.data); },
  'docs.list': function (ctx, a) { return Documents.list(ctx, a.courseId, a.soldierId); },
  'docs.download': function (ctx, a) { return Documents.download(ctx, a.id); },
  'docs.requestLink': function (ctx, a) { return Documents.requestLink(ctx, a.id, a.table, a.recordId); },
  'docs.reviewLink': function (ctx, a) { return Documents.reviewLink(ctx, a.id, a.decision, a.note); },
  'docs.pendingLinks': function (ctx, a) { return Documents.pendingLinks(ctx, a.courseId); },
  'docs.attachEvidence': function (ctx, a) { return Documents.attachEvidence(ctx, a.assignmentId, a.documentId); },
  'docs.evidence': function (ctx, a) { return Documents.evidenceFor(ctx, a.assignmentId); },
  'ocr.start': function (ctx, a) { return Ocr.start(ctx, a.courseId, a.data); },
  'ocr.rows': function (ctx, a) { return Ocr.rows(ctx, a.id); },
  'ocr.editRow': function (ctx, a) { return Ocr.editRow(ctx, a.id, a.data); },
  'ocr.approveRow': function (ctx, a) { return Ocr.approveRow(ctx, a.id, a.confirm_uncertain === true); },
  'ocr.rejectRow': function (ctx, a) { return Ocr.rejectRow(ctx, a.id, a.note); },
  'ai.ask': function (ctx, a) { return Assistant.ask(ctx, a.courseId, a.question, { include_private: a.include_private }); },
  'ai.draft': function (ctx, a) { return Assistant.draft(ctx, a.courseId, a.soldierId); },
  'ai.drafts': function (ctx, a) { return Assistant.drafts(ctx, a.courseId); },
  'ai.reviewDraft': function (ctx, a) { return Assistant.reviewDraft(ctx, a.id, a.decision, a.note); },
  'backup.create': function (ctx, a) { return Backup.create(ctx, a.kind || 'manual'); },
  'backup.list': function (ctx, a) { return Backup.list(ctx); },
  'backup.verify': function (ctx, a) { return Backup.verify(ctx, a.id); },
  'backup.plan': function (ctx, a) { return Backup.plan(ctx, a.id); },
  'backup.restore': function (ctx, a) { return Backup.restore(ctx, a.id, a.data); },
  'backup.recover': function (ctx, a) { return Backup.recover(ctx, a.id, a.data); },
  'preflight.run': function (ctx, a) { return Preflight.run(ctx); },
  'preflight.last': function (ctx, a) { return Preflight.last(ctx); },
  'backup.prune': function (ctx, a) { return Backup.prune(ctx, a.keep); },
  'migration.run': function (ctx, a) { return Migration.run(ctx); },
  // ---- product-dev6: meeting minutes + linked tasks (commander/admin only; server-enforced). There is deliberately NO 'tasks.create'.
  'meetings.list': function (ctx, a) { return Meetings.list(ctx, a.courseId); },
  'meetings.get': function (ctx, a) { return Meetings.get(ctx, a.id); },
  'meetings.options': function (ctx, a) { return Meetings.options(ctx, a.courseId); },
  'meetings.save': function (ctx, a) { return Meetings.save(ctx, a.courseId, a.data); },
  'tasks.list': function (ctx, a) { return Meetings.tasks(ctx, a.courseId, a.opts || {}); },
  'tasks.get': function (ctx, a) { return Meetings.taskGet(ctx, a.id); },
  'tasks.setStatus': function (ctx, a) { return Meetings.setStatus(ctx, a.id, a.status, a.note, a.expected_version); },
  'tasks.indicators': function (ctx, a) { return Meetings.indicators(ctx, a.courseId); },
  'meetings.integrity': function (ctx, a) { return Meetings.integrity(ctx, a.courseId); },
  'meetings.auditRepair': function (ctx, a) { return Meetings.auditRepair(ctx, a.courseId, a.id, a.rev, a.reason); },
  'audit.list': function (ctx, a) { return Audit.list(ctx, a || {}); }
};

function doGet(e) {
  /* Soldier update form: the one-time token IS the credential (no login). Serves ONLY the form page — never Index — so an anonymous deployment cannot reach the app. */
  if (e && e.parameter && typeof e.parameter.form === 'string') {
    return HtmlService.createHtmlOutputFromFile('FormPage').setTitle('עדכון פרטים').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
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
    // Durable double-submit protection (issue #9 review): a WRITE that carries a client idempotency key (idem_) is executed at most once per
    // (user, route, key) within the cache window; a retry with the same key (second tap, lost response) gets the ORIGINAL result. Reads and keyless calls are unchanged.
    let a = args || {}, cacheKey = null, cache = null;
    if (Object.prototype.hasOwnProperty.call(a, 'idem_')) {
      const k = a.idem_; a = Object.assign({}, a); delete a.idem_;
      if (typeof k === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(k) && !/\.(list|get|mine|summary|overview|home|counts|events|org|insights|trends|strengthsGaps|notEntered)$/.test(method) && typeof CacheService !== 'undefined') {
        try { cache = CacheService.getScriptCache(); cacheKey = 'idem:' + String(ctx.email || '').toLowerCase() + ':' + method + ':' + k; const hit = cache.get(cacheKey); if (hit) return JSON.parse(hit); } catch (e2) { cache = null; cacheKey = null; }
      }
    }
    const out = { ok: true, data: fn(ctx, a) };
    if (cache && cacheKey) { try { const j = JSON.stringify(out); if (j.length < 90000) cache.put(cacheKey, j, 300); } catch (e3) { /* best effort */ } }
    return out;
  } catch (e) {
    if (e instanceof AppError || (e && e.name === 'AppError')) return { ok: false, code: e.code, message: e.message };
    console.error(e && e.stack ? e.stack : String(e));            // details to server log only
    return { ok: false, code: 'INTERNAL', message: 'אירעה שגיאה פנימית. נסו שוב או פנו למנהל המערכת.' };
  }
}

/**
 * Time-driven trigger target (daily): backup + alert refresh + retention. Installed by installDailyTrigger().
 * F-2: the name ENDS WITH AN UNDERSCORE on purpose. Documented Apps Script rule (HTML Service > "Private functions"): server functions whose names
 * end with "_" "cannot be called by google.script.run and their names are never sent to the client". It takes no argument and trusts no event object.
 * NOT documented (=> must be verified on real Google, AT-D07): that a time-driven trigger may use such a function as its handler.
 */
function dailyJob_() { try { return Backup.daily(); } catch (e) { console.error(e && e.stack ? e.stack : String(e)); throw e; } }

/** Manual run of the daily job from the Apps Script editor (the editor's Run menu does not list private functions). Admin only, fails closed (same guard as F-1). */
function runDailyJobNow() { Auth.assertAdminCaller_(); return dailyJob_(); }

/** PUBLIC entry for the soldier update form (token = credential, no login). Deploying it for anonymous access is a DEPLOYMENT DECISION — see DECISIONS_NEEDED. */
function formOpen(token) { try { return { ok: true, data: Forms.open(token) }; } catch (e) { return { ok: false, code: e.code || 'INTERNAL', message: e.code ? e.message : 'אירעה שגיאה.' }; } }
function formSubmit(token, payload) { try { return { ok: true, data: Forms.submit(token, payload) }; } catch (e) { return { ok: false, code: e.code || 'INTERNAL', message: e.code ? e.message : 'אירעה שגיאה.' }; } }

function whoAmI() {
  const ctx = Auth.tryContext();
  return ctx ? { ok: true, data: { email: ctx.email, role: ctx.role, displayName: ctx.displayName, version: APP.VERSION } } : { ok: false, code: 'UNAUTHENTICATED', message: 'אין הרשאה.' };
}
