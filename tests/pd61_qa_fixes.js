// product-dev6.1 — dedicated regression tests for QA-01 (department authorisation of filter/department_ids) and QA-02 (audit/save consistency).
// Node only (in-memory Db, faked identity). NOT Apps Script / Sheets / Google. Synthetic data only.
const { suite } = require('./tlib'); const { t, done, assert } = suite('pd61_qa_fixes.js'); const { world } = require('./world');
function W() {
  const w = world(); const { X, admin, c1, cT, cD, cC, cT2, none } = w;
  w.as = (u, m, a) => { X.Auth._emailProvider = () => u.email; return X.api(m, a); };
  w.ok = r => { assert.strictEqual(r.ok, true, 'expected ok, got ' + JSON.stringify(r)); return r.data; };
  w.err = (r, code) => { assert.strictEqual(r.ok, false, 'expected ' + code + ', got ok'); if (code) assert.strictEqual(r.code, code, JSON.stringify(r)); return r; };
  let n = 0; w.task = o => Object.assign({ client_key: 'k' + (++n), title: 'משימה ' + n, assignee_email: cD.email, due_date: '2026-12-01', due_time: '', priority: 'normal', notes: '' }, o || {});
  w.mt = o => Object.assign({ request_id: 'rq' + (++n), subject: 'ישיבה ' + n, meeting_at: '2026-11-10T09:30', participants: '', summary: 's', decisions: '', tasks: [] }, o || {});
  w.save = (u, d) => w.as(u, 'meetings.save', { courseId: c1, data: d }); w.saveOk = (u, d) => w.ok(w.save(u, d));
  let k = 0; const base = new Date('2026-11-11T08:00:00Z').getTime(); X.Util._clock = () => new Date(base + (++k));
  w.list = (u, opts, c) => w.as(u, 'tasks.list', { courseId: c || c1, opts: opts || {} });
  w.inject = (table, op, nth, mode) => { const st = X.Db._s, orig = st[op]; let i = 0; st[op] = function (tb) { if (tb === table && ++i === nth) { if (mode === 'land') { orig.apply(st, arguments); } throw new Error('injected'); } return orig.apply(st, arguments); }; return () => { st[op] = orig; }; };
  w.auditActs = () => X.Db.all('AuditLog').filter(a => /^MEETING_/.test(a.action)).map(a => a.action);
  w.deps = [w.dep(0), w.dep(1)];
  return w;
}
const kk = (o, a = []) => { if (Array.isArray(o)) o.forEach(x => kk(x, a)); else if (o && typeof o === 'object') Object.keys(o).forEach(key => { a.push(key); kk(o[key], a); }); return a; };

// ============================================================ QA-01
t('hardening', 'QA-01 (1): a commander with ONE department cannot filter by another department — FORBIDDEN; unknown ids get the identical refusal (no probing)', () => {
  const w = W(); const { cD } = w; w.saveOk(w.cC, w.mt({ tasks: [w.task({ title: 'SECRET-A', assignee_email: w.cT2.email }), w.task({ title: 'own', assignee_email: cD.email })] }));
  const own = w.ok(w.list(cD, { departmentId: w.deps[0] })); assert.ok(own.tasks.length >= 1);
  const a = w.list(cD, { departmentId: w.deps[1] }), b = w.list(cD, { departmentId: 'no-such-dept' }), c = w.list(cD, { departmentId: 'x'.repeat(40) });
  [a, b, c].forEach(r => w.err(r, 'FORBIDDEN')); assert.deepStrictEqual([a.message, b.message], [b.message, c.message]); assert.ok(!/SECRET/.test(JSON.stringify([a, b, c])));
  // also for the team-scope commander (dept of his team only) and with other filters combined
  w.err(w.list(w.cT, { departmentId: w.deps[1], status: 'open', priority: 'normal' }), 'FORBIDDEN'); w.err(w.list(w.cT2, { departmentId: w.deps[0] }), 'FORBIDDEN'); assert.strictEqual(w.ok(w.list(w.cT2, { departmentId: w.deps[1] })).tasks.length >= 1, true);
});
t('hardening', 'QA-01 (2): a commander assigned to SEVERAL departments (department + team of another) may filter only by those, nothing else', () => {
  const w = W(); const { X, admin, c1 } = w; const third = 'dep-extra'; X.Db.insert('Departments', { id: third, course_id: c1, name: 'מחלקה ג׳ (דמה)' });
  X.Courses.addUser(admin, { email: 'multi@x.com', role: 'commander', course_ids: [c1], display_name: 'רב-מחלקתי' }); const mu = { email: 'multi@x.com', role: 'commander' };
  X.Assignments.create(admin, { course_id: c1, user_email: mu.email, scope_type: 'department', scope_id: w.deps[0], reason: 'בדיקה' }); X.Assignments.create(admin, { course_id: c1, user_email: mu.email, scope_type: 'team', scope_id: w.team(1, 0), reason: 'בדיקה' });
  w.saveOk(w.cC, w.mt({ tasks: [w.task({ title: 'd0', assignee_email: w.cD.email }), w.task({ title: 'd1', assignee_email: w.cT2.email })] }));
  w.deps.forEach(d => assert.strictEqual(w.ok(w.list(mu, { departmentId: d })).tasks.length, 1, d)); w.err(w.list(mu, { departmentId: third }), 'FORBIDDEN'); w.err(w.list(mu, { departmentId: 'nope' }), 'FORBIDDEN');
  assert.deepStrictEqual(w.ok(w.as(mu, 'meetings.options', { courseId: c1 })).departments.map(d => d.id).sort(), w.deps.slice().sort());
});
t('integration', 'QA-01 (3): the admin can filter by every department; a non-existent department is a validation error, not a leak', () => {
  const w = W(); const { admin } = w; w.saveOk(w.cC, w.mt({ tasks: [w.task({ assignee_email: w.cD.email }), w.task({ assignee_email: w.cT2.email })] }));
  w.deps.forEach(d => assert.strictEqual(w.ok(w.list(admin, { departmentId: d })).tasks.length >= 1, true)); assert.strictEqual(w.ok(w.as(admin, 'meetings.options', { courseId: w.c1 })).departments.length >= 2, true);
  w.err(w.list(admin, { departmentId: 'no-such-dept' }), 'VALIDATION');
});
t('hardening', 'QA-01 (4): no leak through department_ids, counts, KPI, total_matching, pagination or filter options — only departments inside the requester\'s authority ever appear', () => {
  const w = W(); const { cD, cC, admin } = w; const X = w.X;
  // a course-wide assignee touches EVERY department; a commander of dept0 must only ever see dept0
  w.saveOk(cC, w.mt({ tasks: [w.task({ title: 'wide', assignee_email: cC.email }), w.task({ title: 'd0', assignee_email: cD.email }), w.task({ title: 'd1-hidden', assignee_email: w.cT2.email }), w.task({ title: 'd1b-hidden', assignee_email: w.cT2.email })] }));
  const mine = w.ok(w.list(cD)); mine.tasks.forEach(v => v.department_ids.forEach(d => assert.ok(d === w.deps[0], 'foreign department leaked: ' + d)));
  const titles = mine.tasks.map(x => x.title).sort(); assert.ok(!titles.some(x => /hidden/.test(x)) && titles.includes('wide') && titles.includes('d0'));
  assert.strictEqual(mine.counts.total, mine.tasks.length, 'counts are over the visible set only'); assert.strictEqual(mine.total_matching, mine.tasks.length);
  const detail = w.ok(w.as(cD, 'tasks.get', { id: mine.tasks.find(x => x.title === 'wide').id })); assert.deepStrictEqual(detail.department_ids, [w.deps[0]]); const md = w.ok(w.as(cD, 'meetings.get', { id: mine.tasks[0].meeting_id })); md.tasks.forEach(v => v.department_ids.forEach(d => assert.strictEqual(d, w.deps[0])));
  assert.ok(!/hidden/.test(JSON.stringify(w.ok(w.as(cD, 'meetings.options', { courseId: w.c1 })))), 'options expose no foreign department / task');
  // pagination: with a tiny cap total_matching / truncated describe ONLY what the requester may see
  const cap = X.Meetings.LIST_CAP; X.Meetings.LIST_CAP = 1; try { const p = w.ok(w.list(cD)); assert.strictEqual(p.tasks.length, 1); assert.strictEqual(p.total_matching, mine.tasks.length); assert.strictEqual(p.truncated, mine.tasks.length > 1); assert.strictEqual(p.counts.total, mine.tasks.length); const pa = w.ok(w.list(admin)); assert.strictEqual(pa.total_matching, 4); } finally { X.Meetings.LIST_CAP = cap; }
  // same numbers whether or not hidden tasks exist (no inference of their count)
  const w2 = W(); w2.saveOk(w2.cC, w2.mt({ tasks: [w2.task({ title: 'wide', assignee_email: w2.cC.email }), w2.task({ title: 'd0', assignee_email: w2.cD.email })] })); assert.deepStrictEqual(w2.ok(w2.list(w2.cD)).counts, mine.counts);
  assert.ok(!kk(mine).some(key => /team/i.test(key)), 'no team dimension');
});
t('integration', 'QA-01 (5): authorised users keep their behaviour — course-wide commander and admin see every department; department filter matches the assignee\'s departments; other filters unchanged', () => {
  const w = W(); const { cC, admin, cD, cT } = w; w.saveOk(cC, w.mt({ tasks: [w.task({ title: 'a', assignee_email: cD.email, priority: 'urgent' }), w.task({ title: 'b', assignee_email: w.cT2.email }), w.task({ title: 'c', assignee_email: cT.email })] }));
  [cC, admin].forEach(u => { assert.deepStrictEqual(w.ok(w.list(u, { departmentId: w.deps[0] })).tasks.map(x => x.title).sort(), ['a', 'c']); assert.deepStrictEqual(w.ok(w.list(u, { departmentId: w.deps[1] })).tasks.map(x => x.title), ['b']); assert.strictEqual(w.ok(w.list(u)).tasks[0].department_ids.length >= 1, true); });
  assert.deepStrictEqual(w.ok(w.list(cC)).tasks.find(x => x.title === 'a').department_ids, [w.deps[0]]); assert.deepStrictEqual(w.ok(w.list(cD, { priority: 'urgent' })).tasks.map(x => x.title), ['a']); assert.strictEqual(w.ok(w.list(cD, { departmentId: w.deps[0] })).tasks.length, 2);
  assert.deepStrictEqual(w.ok(w.list(cT, { departmentId: w.deps[0] })).tasks.map(x => x.title).sort(), ['a', 'c']);
});
t('hardening', 'QA-01 (6): IDOR / escalation sweep — other course, no assignment, soldier, tampered ids; nothing leaks and nothing changes', () => {
  const w = W(); const { cD, cO, none } = w; const m = w.saveOk(w.cT, w.mt({ tasks: [w.task({ title: 'SECRET-X', assignee_email: cD.email })] })).meeting; const before = JSON.stringify([w.X.Db.all('MeetingTasks'), w.X.Db.all('MeetingMinutes'), w.X.Db.all('MeetingTaskEvents'), w.X.Db.all('AuditLog').length]);
  [cO, none].forEach(u => { w.err(w.list(u, { departmentId: w.deps[0] }), 'FORBIDDEN'); w.err(w.as(u, 'tasks.get', { id: m.tasks[0].id }), 'NOT_FOUND'); w.err(w.as(u, 'tasks.setStatus', { id: m.tasks[0].id, status: 'completed' }), 'NOT_FOUND'); });
  w.err(w.as(cO, 'tasks.list', { courseId: w.c2, opts: { departmentId: w.deps[0] } }), 'FORBIDDEN');   // cO has course 2 but the department belongs to course 1
  w.X.Db.insert('Users', { id: 'u-s', email: 's@x.com', display_name: 's', role: 'soldier', course_scope: w.c1, active: true }); w.err(w.as({ email: 's@x.com' }, 'tasks.list', { courseId: w.c1, opts: { departmentId: w.deps[0] } }), 'UNAUTHENTICATED');
  [{ departmentId: { $ne: 1 } }, { departmentId: ['x'] }, { departmentId: 5 }].forEach(o => w.err(w.list(cD, o), 'VALIDATION'));
  ['tasks.integrity', 'tasks.create'].forEach(r => assert.strictEqual(w.as(w.admin, r, {}).code, 'NOT_FOUND'));
  assert.strictEqual(JSON.stringify([w.X.Db.all('MeetingTasks'), w.X.Db.all('MeetingMinutes'), w.X.Db.all('MeetingTaskEvents'), w.X.Db.all('AuditLog').length]), before);
});

// ============================================================ QA-02
t('integration', 'QA-02 (A): audit write fails AFTER the commit (create) — the save is reported as SUCCESS with an explicit AUDIT_FAILED warning, never SAVE_FAILED; data and history are complete', () => {
  const w = W(); const { cT } = w; const undo = w.inject('AuditLog', 'insert', 1); const r = w.save(cT, w.mt({ request_id: 'A1', tasks: [w.task({ title: 'א' }), w.task({ title: 'ב' })] })); undo();
  const d = w.ok(r); assert.strictEqual(d.replayed, false); assert.strictEqual(d.audit.recorded, false); assert.strictEqual(d.audit.code, 'AUDIT_FAILED'); assert.strictEqual(d.audit.rev, 1); assert.ok(/נשמרו, אך רישום הביקורת נכשל/.test(d.audit.message)); assert.ok(!JSON.stringify(d).includes('injected'));
  assert.strictEqual(d.meeting.tasks.length, 2); assert.strictEqual(w.ok(w.list(cT)).tasks.length, 2); d.meeting.tasks.forEach(x => assert.strictEqual(w.ok(w.as(cT, 'tasks.get', { id: x.id })).history.filter(h => h.action === 'TASK_CREATED' && h.field === 'status').length, 1));
  assert.ok(!w.auditActs().includes('MEETING_CREATE') && !w.auditActs().includes('MEETING_SAVE_FAILED'), 'no success event, no false failure event');
  // the retry is a replay: still exactly one meeting
  const again = w.ok(w.save(cT, w.mt({ request_id: 'A1', tasks: [] }))); assert.strictEqual(again.replayed, true); assert.strictEqual(w.X.Db.all('MeetingMinutes').length, 1);
});
t('integration', 'QA-02 (B): the missing audit event can be FOUND and REPAIRED by an admin (append-only, audited, reason required); nobody else can', () => {
  const w = W(); const { cT, admin, cC } = w; const undo = w.inject('AuditLog', 'insert', 1); const d = w.ok(w.save(cT, w.mt({ request_id: 'B1', tasks: [w.task()] }))); undo(); const id = d.meeting.id;
  const gaps = w.ok(w.as(admin, 'meetings.integrity', { courseId: w.c1 })); assert.deepStrictEqual(gaps.audit_gaps.map(g => [g.meeting_id, g.rev]), [[id, 1]]); assert.strictEqual(gaps.orphan_count, 0);
  [cT, cC, w.cD, w.none, w.cO].forEach(u => { w.err(w.as(u, 'meetings.integrity', { courseId: w.c1 }), 'FORBIDDEN'); w.err(w.as(u, 'meetings.auditRepair', { courseId: w.c1, id, rev: 1, reason: 'x' }), 'FORBIDDEN'); });
  w.err(w.as({ email: 'ghost@x.com' }, 'meetings.integrity', { courseId: w.c1 }), 'UNAUTHENTICATED');
  w.err(w.as(admin, 'meetings.auditRepair', { courseId: w.c1, id, rev: 1, reason: '' }), 'VALIDATION'); w.err(w.as(admin, 'meetings.auditRepair', { courseId: w.c1, id, rev: 2, reason: 'x' }), 'NOT_FOUND'); w.err(w.as(admin, 'meetings.auditRepair', { courseId: w.c1, id, rev: 0, reason: 'x' }), 'VALIDATION');
  const before = w.X.Db.all('AuditLog').length; assert.deepStrictEqual(w.ok(w.as(admin, 'meetings.auditRepair', { courseId: w.c1, id, rev: 1, reason: 'השלמת רישום חסר' })), { repaired: true, meeting_id: id, rev: 1 }); assert.strictEqual(w.X.Db.all('AuditLog').length, before + 1);
  const rep = w.X.Db.all('AuditLog').filter(a => a.action === 'MEETING_AUDIT_REPAIR'); assert.strictEqual(rep.length, 1); assert.strictEqual(rep[0].actor_email, admin.email); assert.strictEqual(rep[0].reason, 'השלמת רישום חסר'); assert.strictEqual(JSON.parse(rep[0].after_json).original_actor, cT.email);
  assert.strictEqual(w.ok(w.as(admin, 'meetings.integrity', { courseId: w.c1 })).audit_gap_count, 0); w.err(w.as(admin, 'meetings.auditRepair', { courseId: w.c1, id, rev: 1, reason: 'שוב' }), 'VALIDATION');
});
t('integration', 'QA-02 (C): audit fails after the commit of an EDIT — success + warning, edit applied once, history intact, gap rev=2 found and repaired', () => {
  const w = W(); const { cT, admin } = w; const m = w.saveOk(cT, w.mt({ tasks: [w.task({ title: 'א', client_key: 'a' })] })).meeting; const id = m.tasks[0].id;
  w.ok(w.as(w.cD, 'tasks.setStatus', { id, status: 'in_progress' }));
  const edit = { id: m.id, subject: 'נושא חדש', meeting_at: m.meeting_at, tasks: [{ id, title: 'א-מעודכן', assignee_email: m.tasks[0].assignee_email, due_date: m.tasks[0].due_date, priority: 'high' }] };
  const undo = w.inject('AuditLog', 'insert', 1); const r = w.save(cT, edit); undo(); const d = w.ok(r); assert.strictEqual(d.audit.recorded, false); assert.strictEqual(d.audit.rev, 2); assert.strictEqual(d.meeting.subject, 'נושא חדש'); assert.strictEqual(d.meeting.tasks[0].title, 'א-מעודכן');
  const h = w.ok(w.as(cT, 'tasks.get', { id })).history; assert.ok(h.some(x => x.action === 'TASK_CREATED') && h.some(x => x.new_value === 'in_progress') && h.filter(x => x.field === 'title').length === 1, 'history intact after audit failure');
  assert.deepStrictEqual(w.ok(w.as(admin, 'meetings.integrity', { courseId: w.c1 })).audit_gaps.map(g => g.rev), [2]); w.ok(w.as(admin, 'meetings.auditRepair', { courseId: w.c1, id: m.id, rev: 2, reason: 'תיקון' })); assert.strictEqual(w.ok(w.as(admin, 'meetings.integrity', { courseId: w.c1 })).audit_gap_count, 0);
  assert.strictEqual(w.ok(w.save(cT, edit)).audit.recorded, true, 'an identical re-save is a clean no-op revision with its audit event');
});
t('integration', 'QA-02 (D): COMMIT write fails (create and edit) — SAVE_FAILED, nothing visible, NO success audit event, only MEETING_SAVE_FAILED; orphan (committed_rev=0) is hidden everywhere, listed for the admin, and reused by the retry', () => {
  const w = W(); const { cT, admin } = w; const data = w.mt({ request_id: 'D1', tasks: [w.task({ title: 'א' }), w.task({ title: 'ב' })] });
  const undo = w.inject('MeetingMinutes', 'updateById', 1); const r = w.save(cT, data); undo(); w.err(r, 'SAVE_FAILED'); assert.ok(/לא נשמר דבר/.test(r.message));
  assert.ok(!w.auditActs().includes('MEETING_CREATE'), 'no success event for a save that did not commit'); assert.ok(w.auditActs().includes('MEETING_SAVE_FAILED'));
  const orphanRow = w.X.Db.all('MeetingMinutes')[0]; assert.strictEqual(Number(orphanRow.committed_rev), 0);
  assert.deepStrictEqual(w.ok(w.as(cT, 'meetings.list', { courseId: w.c1 })), []); assert.strictEqual(w.ok(w.list(admin)).counts.total, 0); w.err(w.as(admin, 'meetings.get', { id: orphanRow.id }), 'NOT_FOUND'); w.err(w.save(cT, Object.assign(w.mt(), { id: orphanRow.id })), 'NOT_FOUND'); w.err(w.save(admin, Object.assign(w.mt(), { id: orphanRow.id })), 'NOT_FOUND');
  assert.ok(!JSON.stringify(w.ok(w.as(cT, 'meetings.options', { courseId: w.c1 }))).includes(orphanRow.id));
  const ig = w.ok(w.as(admin, 'meetings.integrity', { courseId: w.c1 })); assert.strictEqual(ig.orphan_count, 1); assert.deepStrictEqual([ig.orphans[0].meeting_id, ig.orphans[0].staged_tasks], [orphanRow.id, 0]); assert.strictEqual(w.X.Db.all('MeetingTasks').filter(x => x.row_state === 'rolled_back').length, 2, 'staged task rows were neutralised by the rollback'); assert.strictEqual(ig.audit_gap_count, 0, 'an uncommitted rev is not an audit gap');
  const ok = w.ok(w.save(cT, data)); assert.strictEqual(ok.audit.recorded, true); assert.strictEqual(ok.meeting.id, orphanRow.id, 'retry reuses the staged row'); assert.strictEqual(w.X.Db.all('MeetingMinutes').length, 1); assert.strictEqual(ok.meeting.tasks.length, 2); assert.strictEqual(w.ok(w.list(cT)).tasks.length, 2);
  assert.strictEqual(w.auditActs().filter(a => a === 'MEETING_CREATE').length, 1); ig.orphan_count; assert.strictEqual(w.ok(w.as(admin, 'meetings.integrity', { courseId: w.c1 })).orphan_count, 0);
  // edit: commit fails -> old values stay, no MEETING_EDIT
  const e = { id: ok.meeting.id, subject: 'חדש', meeting_at: ok.meeting.meeting_at, tasks: ok.meeting.tasks.map(x => ({ id: x.id, title: x.title + '!', assignee_email: x.assignee_email, due_date: x.due_date, priority: 'high' })) };
  const u2 = w.inject('MeetingMinutes', 'updateById', 1); const r2 = w.save(cT, e); u2(); w.err(r2, 'SAVE_FAILED'); assert.ok(!w.auditActs().includes('MEETING_EDIT')); assert.strictEqual(w.ok(w.as(cT, 'meetings.get', { id: ok.meeting.id })).subject, ok.meeting.subject);
  assert.strictEqual(w.ok(w.save(cT, e)).audit.recorded, true); assert.strictEqual(w.auditActs().filter(a => a === 'MEETING_EDIT').length, 1);
});
t('integration', 'QA-02 (E): meeting INSERT fails (create) — SAVE_FAILED, no rows, no success event; edit: a failure while writing a task restores it and writes no success event', () => {
  const w = W(); const { cT } = w; const u = w.inject('MeetingMinutes', 'insert', 1); const r = w.save(cT, w.mt({ request_id: 'E1', tasks: [w.task()] })); u(); w.err(r, 'SAVE_FAILED'); assert.deepStrictEqual(w.count = [w.X.Db.all('MeetingMinutes').length, w.X.Db.all('MeetingTasks').length], [0, 0]); assert.ok(!w.auditActs().includes('MEETING_CREATE'));
  const m = w.saveOk(cT, w.mt({ request_id: 'E2', tasks: [w.task({ title: 'א' })] })).meeting; const n0 = w.auditActs().filter(a => a === 'MEETING_CREATE').length;
  const u2 = w.inject('MeetingTasks', 'updateById', 1); const r2 = w.save(cT, { id: m.id, subject: m.subject, meeting_at: m.meeting_at, tasks: [{ id: m.tasks[0].id, title: 'חדש', assignee_email: m.tasks[0].assignee_email, due_date: m.tasks[0].due_date, priority: 'normal' }] }); u2(); w.err(r2, 'SAVE_FAILED');
  assert.strictEqual(w.ok(w.as(cT, 'tasks.get', { id: m.tasks[0].id })).title, 'א'); assert.ok(!w.auditActs().includes('MEETING_EDIT')); assert.strictEqual(w.auditActs().filter(a => a === 'MEETING_CREATE').length, n0);
});
t('integration', 'QA-02 (F): a commit write that THROWS BUT LANDED is detected — the data is saved so the answer is success (never SAVE_FAILED), with its audit event', () => {
  const w = W(); const { cT } = w; const u = w.inject('MeetingMinutes', 'updateById', 1, 'land'); const r = w.save(cT, w.mt({ request_id: 'F1', tasks: [w.task({ title: 'א' })] })); u();
  const d = w.ok(r); assert.strictEqual(d.audit.recorded, true); assert.strictEqual(d.meeting.tasks.length, 1); assert.strictEqual(w.ok(w.list(cT)).tasks.length, 1); assert.strictEqual(w.auditActs().filter(a => a === 'MEETING_CREATE').length, 1); assert.ok(!w.auditActs().includes('MEETING_SAVE_FAILED'));
  assert.strictEqual(w.X.Db.all('MeetingTaskEvents').filter(e => e.row_state !== 'rolled_back' && e.action === 'TASK_CREATED' && e.field === 'status').length, 1);
});
t('integration', 'QA-02 (G): when the FAILURE audit itself cannot be written the rollback is still clean (SAVE_FAILED, not SAVE_PARTIAL); a failed rollback is SAVE_PARTIAL and stays hidden', () => {
  const w = W(); const { cT } = w; const st = w.X.Db._s, oi = st.insert, ou = st.updateById; let thrown = 0;
  st.updateById = function (tb) { if (tb === 'MeetingMinutes') throw new Error('commit down'); return ou.apply(st, arguments); }; st.insert = function (tb) { if (tb === 'AuditLog') { thrown++; throw new Error('audit down'); } return oi.apply(st, arguments); };
  const r = w.save(cT, w.mt({ request_id: 'G1', tasks: [w.task()] })); st.insert = oi; st.updateById = ou; w.err(r, 'SAVE_FAILED'); assert.ok(thrown >= 1); assert.strictEqual(w.ok(w.list(cT)).tasks.length, 0);
  const w2 = W(); const s2 = w2.X.Db._s, o2 = s2.updateById; s2.updateById = function (tb) { if (tb === 'MeetingMinutes' || tb === 'MeetingTasks' || tb === 'MeetingTaskEvents') throw new Error('down'); return o2.apply(s2, arguments); };
  const r2 = w2.save(w2.cT, w2.mt({ request_id: 'G2', tasks: [w2.task()] })); s2.updateById = o2; w2.err(r2, 'SAVE_PARTIAL'); assert.strictEqual(w2.ok(w2.list(w2.cT)).tasks.length, 0, 'staged rows stay hidden even if the cleanup failed');
});
t('hardening', 'QA-02 (H): no path writes a success audit event for a save that did not commit — failure-injection matrix over every write point; MEETING_CREATE/EDIT count equals the number of committed revisions', () => {
  [['MeetingMinutes', 'insert', 1], ['MeetingTasks', 'insert', 1], ['MeetingTasks', 'insert', 2], ['MeetingTaskEvents', 'insert', 1], ['MeetingTaskEvents', 'insert', 3], ['MeetingMinutes', 'updateById', 1], ['AuditLog', 'insert', 1]].forEach(([tb, op, nth]) => {
    const w = W(); const { cT, admin } = w; const data = w.mt({ request_id: 'H' + nth, tasks: [w.task({ title: 'א' }), w.task({ title: 'ב' })] });
    const u = w.inject(tb, op, nth); const r = w.save(cT, data); u(); const committed = r.ok; const label = tb + op + nth;
    if (tb === 'AuditLog') { assert.strictEqual(r.ok, true, label); assert.strictEqual(r.data.audit.recorded, false); } else { assert.strictEqual(r.ok, false, label); assert.ok(['SAVE_FAILED', 'SAVE_PARTIAL'].includes(r.code), label); assert.strictEqual(w.ok(w.as(cT, 'meetings.list', { courseId: w.c1 })).length, 0, label); }
    assert.strictEqual(w.auditActs().filter(a => a === 'MEETING_CREATE').length, 0, label + ': nothing logged as success before / without a commit');
    const ok = w.save(cT, data); assert.strictEqual(ok.ok, true, label + ' retry'); const ig = w.ok(w.as(admin, 'meetings.integrity', { courseId: w.c1 }));
    assert.strictEqual(w.X.Db.all('MeetingMinutes').filter(m => Number(m.committed_rev) >= 1).length, 1, label); assert.strictEqual(w.X.Db.all('MeetingMinutes').length, committed ? 1 : 1, label + ' one row, no duplicate meeting');
    assert.strictEqual(w.ok(w.list(cT)).tasks.length, 2, label); assert.strictEqual(ig.orphan_count, 0, label);
    if (tb === 'AuditLog') { assert.strictEqual(ig.audit_gap_count, 1, label + ': replay does not hide the gap'); assert.strictEqual(w.auditActs().filter(a => a === 'MEETING_CREATE').length, 0); } else { assert.strictEqual(w.auditActs().filter(a => a === 'MEETING_CREATE').length, 1, label); assert.strictEqual(ig.audit_gap_count, 0, label); }
  });
});
t('hardening', 'QA-02 (I): ordering is enforced in the source (commit precedes the success audit write) and the module still has NO standalone task-creation path and no destructive store call', () => {
  const src = require('fs').readFileSync(__dirname + '/../src/Meetings.gs', 'utf8'); const commit = src.indexOf("Db.update('MeetingMinutes', m.id, { subject"), logged = src.indexOf('Audit.log(ctx, auditEntry)'); assert.ok(commit > 0 && logged > commit, 'success audit is written after the commit');
  assert.strictEqual((src.match(/Audit\.log\(ctx, auditEntry\)/g) || []).length, 1); assert.ok(!/Db\.(replaceAll)|deleteRow|clearContent|delete(Row|Sheet)/.test(src));
  const w = W(); Object.keys(w.X.API_).filter(k => /task|meeting/i.test(k)).forEach(k => assert.ok(!/create|add|new/i.test(k), k)); assert.ok(!('tasks.create' in w.X.API_));
});
t('integration', 'task history stays complete after meeting edits, a removed task (cancelled) and audit failures; creation events are never duplicated', () => {
  const w = W(); const { cT, cD } = w; const m = w.saveOk(cT, w.mt({ request_id: 'J1', tasks: [w.task({ title: 'א', client_key: 'a' }), w.task({ title: 'ב', client_key: 'b' })] })).meeting; const [a, b] = m.tasks;
  w.ok(w.as(cD, 'tasks.setStatus', { id: a.id, status: 'in_progress', note: 'התחלתי' }));
  const u = w.inject('AuditLog', 'insert', 1); w.ok(w.save(cT, { id: m.id, subject: 'x', meeting_at: m.meeting_at, tasks: [{ id: a.id, title: 'א2', assignee_email: a.assignee_email, due_date: a.due_date, priority: 'normal' }, { id: b.id, remove: true }] })); u();
  const ha = w.ok(w.as(cT, 'tasks.get', { id: a.id })).history, hb = w.ok(w.as(cT, 'tasks.get', { id: b.id })).history;
  assert.ok(ha.some(x => x.action === 'TASK_STATUS' && x.new_value === 'in_progress' && x.note === 'התחלתי') && ha.filter(x => x.action === 'TASK_CREATED' && x.field === 'status').length === 1 && ha.some(x => x.field === 'title' && x.old_value === 'א' && x.new_value === 'א2'));
  assert.ok(hb.some(x => x.action === 'TASK_CANCELLED') && hb.filter(x => x.action === 'TASK_CREATED' && x.field === 'status').length === 1); assert.strictEqual(w.X.Db.all('MeetingTasks').length, 2, 'no physical deletion');
});
done();
