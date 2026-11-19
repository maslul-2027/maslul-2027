// A realistic synthetic WORLD for permission tests: two courses, six commanders with real assignments, active / inactive / cancelled soldiers, and REAL records of every kind
// (results, qualification assignments, documents by different uploaders, shared notes, private data, jobs, backup, alerts...). Synthetic data only.
const { setup } = require('./fixture'); const fk = require('./fakes');
const PRIV = 'סודי-פרטי-77', ADM = 'SECRET', NAME_INACTIVE = 'SOLINACT77', NAME_CANCELLED = 'SOLCANC77';
function world() {
  const S = setup(); const { X, admin, c1, c2, dep, team, S: sol } = S;
  // extra commanders: cT2 = other department/team in course 1; cO = commander of course 2 only (real assignment there)
  const mkC = (email, courses) => { X.Courses.addUser(admin, { email, role: 'commander', course_ids: courses, display_name: 'שם-' + email.split('@')[0] }); return { email, role: 'commander', courseScope: courses }; };
  const cT2 = mkC('team2@x.com', [c1]); X.Assignments.create(admin, { course_id: c1, user_email: cT2.email, scope_type: 'team', scope_id: team(1, 0), reason: 'בדיקה' });
  const cO = mkC('other@x.com', [c2]); X.Assignments.create(admin, { course_id: c2, user_email: cO.email, scope_type: 'course', scope_id: c2, reason: 'בדיקה' });
  // unique ASCII name tokens so leak scans can search for them without Hebrew substring collisions
  const TOK = { a: 'SOLA77', a2: 'SOLA277', b: 'SOLB77', c: 'SOLC77', d: 'SOLD77', f: 'SOLF77' }; Object.keys(TOK).forEach(k => X.Db.update('Soldiers', sol[k].id, { full_name: TOK[k] }));
  // soldiers inside cT's team (dept0/team0) that are inactive / cancelled
  const inactive = X.Soldiers.create(admin, c1, { full_name: NAME_INACTIVE, personal_number: '501', gender: 'M', department_id: dep(0), team_id: team(0, 0), commander_note: ADM });
  const cancelled = X.Soldiers.create(admin, c1, { full_name: NAME_CANCELLED, personal_number: '502', gender: 'M', department_id: dep(0), team_id: team(0, 0), commander_note: ADM });
  // data on every soldier (admin enters) so the hidden ones have real records
  const nt = X.Navigation.typeCreate(admin, c1, 'ניווט א'), ex = X.Exams.defCreate(admin, c1, { name: 'מבחן א' }), ty = X.ActivityTypes.create(admin, c1, 'מטווח').id;
  const nav = {}, mk = {}; [sol.a, sol.b, sol.c, sol.d, inactive, cancelled].forEach((s, i) => {
    nav[s.id] = X.Records.create(admin, 'NavigationTests', c1, { request_id: S.rid(), soldier_id: s.id, test_date: '2026-03-0' + (i + 1), navigation_type_id: nt.id, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 }).record.id;
    mk[s.id] = X.Records.create(admin, 'MarksmanshipTests', c1, { request_id: S.rid(), soldier_id: s.id, test_date: '2026-03-0' + (i + 1), weapon_type: 'M16', distance_m: 100, examiner_score: 70 + i, weapon_zeroed: true }).id;
    X.Exams.addAttempt(admin, c1, { request_id: S.rid(), soldier_id: s.id, exam_id: ex.id, attempt: 'A', attempt_date: '2026-03-03', score: 60 + i });
    X.Readiness.assess(admin, c1, { request_id: S.rid(), soldier_id: s.id, status: 'fit', start_date: '2026-03-06' });
    X.Records.create(admin, 'SoldierEvents', c1, { request_id: S.rid(), soldier_id: s.id, event_date: '2026-03-07', event_type: 'achievement', description: 'הישג של ' + s.full_name }); });
  X.Attendance.createEvent(admin, c1, { request_id: S.rid(), event_date: '2026-03-04', activity_type_id: ty, scope_type: 'course', scope_id: c1, absent: [{ soldier_id: inactive.id }, { soldier_id: cancelled.id }] });
  X.Marches.create(admin, c1, { request_id: S.rid(), march_date: '2026-03-05', location: 'מסלול', km_no_stretcher: 10, km_stretcher: 2, scope_type: 'course', scope_id: c1 });
  const q = X.Qualifications.define(admin, c1, { name: 'הסמכה א', completion_terms: 'תנאי', scope_type: 'course' }); const qa = {}; X.Qualifications.assignments(admin, c1, {}).forEach(r => { qa[r.soldier_id] = r.id; });
  const pdf = fk.PDF; const up = (ctx, s, nm) => X.Documents.upload(ctx, c1, { soldier_id: s.id, document_type: 'תעודה', file_name: nm, mime_type: 'application/pdf', content_base64: pdf }).id;
  const doc = { byT_a: up(S.cT, sol.a, 't-a.pdf'), byD_a: up(S.cD, sol.a, 'd-a.pdf'), byAdmin_a: up(admin, sol.a, 'adm-a.pdf'), byAdmin_c: up(admin, sol.c, 'adm-c.pdf'), byAdmin_inactive: up(admin, inactive, 'adm-i.pdf'), byAdmin_cancelled: up(admin, cancelled, 'adm-x.pdf') };
  const doc2 = X.Documents.upload(admin, c2, { soldier_id: sol.f.id, document_type: 'תעודה', file_name: 'c2.pdf', mime_type: 'application/pdf', content_base64: pdf }).id;
  const note = { byT: X.SharedNotes.add(S.cT, 'NavigationTests', nav[sol.a.id], 'הערה של מפקד צוות').id, byD: X.SharedNotes.add(S.cD, 'NavigationTests', nav[sol.b.id], 'הערה של מפקד מחלקה').id, byAdmin: X.SharedNotes.add(admin, 'NavigationTests', nav[sol.a.id], 'הערה של מנהל').id };
  // private data
  X.Private.saveNote(admin, c1, { soldier_id: sol.a.id, note_text: PRIV }); X.Private.createFollowUp(admin, c1, { soldier_id: sol.a.id, what_to_check: PRIV }); X.Private.addAssessment(admin, c1, { soldier_id: sol.a.id, strengths: PRIV }); X.Private.toggleFavorite(admin, c1, sol.a.id);
  // course-2 data + jobs
  const o2 = S.o2, nt2 = X.Navigation.typeCreate(admin, c2, 'ניווט ב'); const nav2 = X.Records.create(admin, 'NavigationTests', c2, { request_id: S.rid(), soldier_id: sol.f.id, test_date: '2026-03-01', navigation_type_id: nt2.id, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 }).record.id;
  const rep1 = X.Reports.generate(admin, c1, { sections: ['soldiers', 'navigation'] }, 'xlsx').id, rep2 = X.Reports.generate(admin, c2, { sections: ['soldiers'] }, 'xlsx').id, bk = X.Backup.create(admin, 'manual').id;
  X.Exams.addAttempt(admin, c1, { request_id: S.rid(), soldier_id: sol.a.id, exam_id: ex.id, attempt: 'B', attempt_date: '2026-03-10', score: 50 }); X.Exams.addAttempt(admin, c1, { request_id: S.rid(), soldier_id: inactive.id, exam_id: ex.id, attempt: 'B', attempt_date: '2026-03-10', score: 50 });
  const ownNav = X.Records.create(S.cT, 'NavigationTests', c1, { request_id: S.rid(), soldier_id: sol.a.id, test_date: '2026-03-09', navigation_type_id: nt.id, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 }).record.id; X.Records.requestCorrection(S.cT, 'NavigationTests', ownNav, { plan_score: 3 }, 'תיקון');
  // inactive / cancelled AFTER all data exists
  X.Soldiers.setActive(admin, inactive.id, false, X.Db.get('Soldiers', inactive.id).updated_at, 'שחרור'); X.Soldiers.cancel(admin, cancelled.id, 'ביטול'); X.Alerts.refresh(admin, c1, '2099-06-01');
  const alerts = X.Db.all('Alerts').map(a => a.id), fup = X.Db.all('PersonalFollowUps').map(f => f.id), corr = X.Db.all('CorrectionRequests').map(c => c.id);
  const ids = { soldier: [sol.a.id, sol.b.id, sol.c.id, sol.d.id, inactive.id, cancelled.id, sol.f.id], nav: Object.values(nav).concat([nav2, ownNav]), mk: Object.values(mk), qa: Object.values(qa), doc: Object.values(doc).concat([doc2]), note: Object.values(note), rep: [rep1, rep2], bk: [bk], alert: alerts, fup, qdef: [q.id], exam: [ex.id], navtype: [nt.id, nt2.id], assignments: X.Db.all('CommanderAssignments').map(a => a.id), users: X.Db.all('Users').map(u => u.id), corr };
  return Object.assign(S, { ownNav, cT2, cO, inactive, cancelled, nt, ex, ty, nav, mkIds: mk, qa, doc, doc2, note, rep1, rep2, bk, nav2, ids, PRIV, ADM, NAME_INACTIVE, NAME_CANCELLED, q, TOK });
}
module.exports = { world, PRIV, ADM, NAME_INACTIVE, NAME_CANCELLED };
