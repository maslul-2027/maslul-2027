'use strict';
// EXPLICIT, fail-closed classification of every application route (the 174 in src/Code.gs). No regex heuristics: a route that is not listed here is DENIED for everyone.
// tests/route_table.js asserts that this table equals the route list in src/Code.gs exactly (a new/renamed route fails CI until it is classified here, by hand).
//   READ    : never changes data (safe for the viewer; scoped by the engine like any commander read).
//   WRITE   : changes data or triggers an action. Viewer: always denied. Others: engine role/scope rules apply.
//   BLOCKED : owner policy — not callable by ANY role over the API (group-only analytics; no per-soldier AI; no schema-mutating migration).
const READ = ('courses.list courses.org users.list soldiers.list soldiers.card soldiers.private emergency.get emergency.orphans nav.list navevents.list navevents.get navevents.legacy nav.groups nav.summary navtypes.list assignments.list assignments.mine record.history correction.list settings.list ' +
  'fitness.types fitness.preview fitness.reference fitness.draftSource fitness.versions fitness.list fitness.summary fitness.completion fitness.quality mk.list mk.summary exams.defs exams.attempts exams.meetings exams.summary acttypes.list attendance.events attendance.roll attendance.summary ' +
  'marches.list marches.summary readiness.list readiness.summary readiness.notEntered events.list qual.list qual.dueHistory qual.assignments qual.summary assess.list notes.list followups.list favorites.list snote.list alerts.list alerts.counts forms.generalLink forms.list ' +
  'dash.home dash.overview dash.groups dash.compareCourses dash.strengthsGaps analytics.insights reports.preview reports.download reports.jobs import.preview import.jobs docs.list docs.download docs.pendingLinks docs.evidence ocr.rows ai.ask ' +
  'backup.list backup.verify backup.plan preflight.last meetings.list meetings.get meetings.options tasks.list tasks.get tasks.indicators meetings.integrity audit.list').split(' ');
const BLOCKED = ['dash.trends', 'reports.build', 'ai.draft', 'ai.drafts', 'ai.reviewDraft', 'migration.run'];
const WRITE = ('courses.create courses.archive courses.reopen courses.rename users.add users.set emergency.set soldiers.create soldiers.update soldiers.reassign soldiers.setActive soldiers.cancel soldiers.restore nav.create navevents.create navevents.update navevents.setStatus navevents.adopt navtypes.create navtypes.rename navtypes.setActive ' +
  'assignments.create assignments.update assignments.setActive record.edit record.cancel record.restore correction.request correction.review settings.set fitness.typeCreate fitness.typeWeights fitness.typeActive fitness.typeVariant fitness.importDraft fitness.editRow fitness.addTable ' +
  'fitness.approve fitness.create fitness.recompute mk.create exams.defCreate exams.defPass exams.attempt acttypes.create acttypes.rename acttypes.setActive attendance.create marches.create readiness.assess events.create qual.define qual.setActive qual.postpone qual.update ' +
  'qual.requestExclusion qual.reviewExclusion assess.add notes.save followups.create followups.update favorites.toggle snote.add snote.cancel alerts.refresh alerts.handle forms.createLink forms.review reports.generate reports.exportAuthorize reports.exportComplete reports.fullExport import.start import.decide import.commit import.cancel ' +
  'docs.upload docs.requestLink docs.reviewLink docs.attachEvidence ocr.start ocr.editRow ocr.approveRow ocr.rejectRow backup.create backup.restore backup.recover preflight.run backup.prune meetings.save tasks.setStatus meetings.auditRepair').split(' ');
const KIND = {}; READ.forEach(m => { KIND[m] = 'read'; }); WRITE.forEach(m => { KIND[m] = 'write'; }); BLOCKED.forEach(m => { KIND[m] = 'blocked'; });
/** @returns 'read' | 'write' | 'blocked' | 'unknown'  (unknown is denied by the gateway) */
function classify(method) { return Object.prototype.hasOwnProperty.call(KIND, method) ? KIND[method] : (method === 'whoAmI' ? 'read' : 'unknown'); }
module.exports = { classify, READ, WRITE, BLOCKED };
