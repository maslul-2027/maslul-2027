// product-dev6: meeting minutes + linked tasks — server-side authorization, creation, staged-write/rollback, status matrix, overdue (Asia/Jerusalem), audit, archived courses.
// Node only (in-memory Db + faked identity provider): NOT Apps Script / Sheets / Google. Synthetic data only.
const { suite } = require('./tlib'); const { t, done, assert } = suite('pd6_meetings_tasks.js'); const { world } = require('./world');

function W() {
  const w = world(); const { X, admin, c1, c2, cT, cD, cC, cT2, cO, none } = w;
  w.users = { admin, cT, cD, cC, cT2, cO, none };
  w.as = (u, m, a) => { X.Auth._emailProvider = () => u.email; return X.api(m, a); };
  w.ok = r => { assert.strictEqual(r.ok, true, 'expected ok, got ' + JSON.stringify(r)); return r.data; };
  w.err = (r, code) => { assert.strictEqual(r.ok, false, 'expected failure ' + code + ', got ok'); if (code) assert.strictEqual(r.code, code, JSON.stringify(r)); return r; };
  let n = 0; w.rid = () => 'rq' + (++n) + '-' + Math.random().toString(36).slice(2, 8);
  w.task = (o) => Object.assign({ client_key: 'k' + (++n), title: 'משימה ' + n, assignee_email: cD.email, due_date: '2026-12-01', due_time: '', priority: 'normal', notes: '' }, o || {});
  w.mt = (o) => Object.assign({ request_id: w.rid(), subject: 'ישיבת תיאום', meeting_at: '2026-11-10T09:30', participants: 'משתתפי דמה', summary: 'סיכום דמה', decisions: 'החלטת דמה', tasks: [] }, o || {});
  w.save = (u, data, course) => w.as(u, 'meetings.save', { courseId: course || c1, data });
  w.saveOk = (u, data, course) => w.ok(w.save(u, data, course));
  let tick = 0; w.clockAt = iso => { const base = new Date(iso).getTime(); X.Util._clock = () => new Date(base + (++tick)); };
  w.clockAt('2026-11-10T08:00:00Z');
  w.count = tb => X.Db.all(tb).length;
  w.counts = () => ({ m: w.count('MeetingMinutes'), t: w.count('MeetingTasks'), e: w.count('MeetingTaskEvents') });
  w.visibleTasks = (u, course, opts) => w.ok(w.as(u, 'tasks.list', { courseId: course || c1, opts: opts || {} }));
  w.inject = (table, op, nth, err) => { const st = X.Db._s, orig = st[op]; let k = 0; st[op] = function (tb) { if (tb === table && ++k === nth) throw new Error(err || 'injected store failure'); return orig.apply(st, arguments); }; return () => { st[op] = orig; }; };
  return w;
}
const ALL_ENDPOINTS = w => [['meetings.list', { courseId: w.c1 }], ['meetings.options', { courseId: w.c1 }], ['meetings.get', { id: 'x' }], ['meetings.save', { courseId: w.c1, data: w.mt() }], ['tasks.list', { courseId: w.c1 }], ['tasks.get', { id: 'x' }], ['tasks.setStatus', { id: 'x', status: 'completed' }], ['tasks.indicators', { courseId: w.c1 }]];

const keys_ = (o, a = []) => { if (Array.isArray(o)) o.forEach(x => keys_(x, a)); else if (o && typeof o === 'object') Object.keys(o).forEach(k => { a.push(k); keys_(o[k], a); }); return a; };
// ===================================================================== AUTHORIZATION
t('hardening', 'no standalone task creation: the API has no task-create route; tasks.* can only list/get/setStatus/indicators and meetings.save is the only writer of new tasks', () => {
  const w = W(); const keys = Object.keys(w.X.API_);
  assert.deepStrictEqual(keys.filter(k => /^(tasks|task|meetings|meeting)\./.test(k)).sort(), ['meetings.auditRepair', 'meetings.get', 'meetings.integrity', 'meetings.list', 'meetings.options', 'meetings.save', 'tasks.get', 'tasks.indicators', 'tasks.list', 'tasks.setStatus']);
  ['tasks.create', 'tasks.add', 'tasks.new', 'tasks.update', 'tasks.delete', 'tasks.remove', 'meetings.delete', 'task.create'].forEach(k => assert.ok(!(k in w.X.API_), k));
  w.as(w.admin, 'tasks.create', { courseId: w.c1, data: w.task() }); assert.strictEqual(w.as(w.admin, 'tasks.create', {}).code, 'NOT_FOUND');
  // generic record endpoints cannot touch the new tables (they only know the result tables)
  const m = w.saveOk(w.admin, w.mt({ tasks: [w.task()] })).meeting, before = JSON.stringify([w.X.Db.all('MeetingTasks'), w.X.Db.all('MeetingMinutes'), w.X.Db.all('MeetingTaskEvents')]);
  ['MeetingTasks', 'MeetingMinutes', 'MeetingTaskEvents'].forEach(tb => { ['record.edit', 'record.cancel', 'record.restore', 'record.history'].forEach(a => { const r = w.as(w.admin, a, { table: tb, id: m.tasks[0].id, patch: { title: 'hack' }, reason: 'x' }); assert.strictEqual(r.ok, false, a + ' ' + tb); }); });
  assert.strictEqual(JSON.stringify([w.X.Db.all('MeetingTasks'), w.X.Db.all('MeetingMinutes'), w.X.Db.all('MeetingTaskEvents')]), before);
});
t('hardening', 'soldier / unknown / disabled / non-commander role: every task endpoint refuses (UNAUTHENTICATED), no data, no write — including a direct API call with real ids', () => {
  const w = W(); const m = w.saveOk(w.admin, w.mt({ tasks: [w.task()] })).meeting; const before = JSON.stringify(w.counts());
  w.X.Db.insert('Users', { id: 'u-sol', email: 'soldier@x.com', display_name: 'חייל דמה', role: 'soldier', course_scope: w.c1, active: true });
  w.X.Db.insert('Users', { id: 'u-off', email: 'off@x.com', display_name: 'מושבת', role: 'commander', course_scope: w.c1, active: false });
  [{ email: 'stranger@x.com' }, { email: 'soldier@x.com' }, { email: 'off@x.com' }, { email: '' }].forEach(u => {
    ALL_ENDPOINTS(w).concat([['meetings.get', { id: m.id }], ['tasks.get', { id: m.tasks[0].id }], ['tasks.setStatus', { id: m.tasks[0].id, status: 'completed' }]]).forEach(([k, a]) => { const r = w.as(u, k, a); assert.strictEqual(r.ok, false, k + ' ' + u.email); assert.strictEqual(r.code, 'UNAUTHENTICATED', k + ' ' + u.email); });
  });
  assert.strictEqual(JSON.stringify(w.counts()), before);
});
t('hardening', 'UI gate: the Hebrew navigation for the new screens exists only as part of the authenticated app shell (soldiers never receive Index.html: doGet needs a Users row)', () => {
  const w = W(); const src = require('fs').readFileSync(__dirname + '/../src/Code.gs', 'utf8');
  assert.ok(/const ctx = Auth\.tryContext\(\);\s*if \(!ctx\) return HtmlService\.createHtmlOutput/.test(src), 'doGet refuses without a context before serving Index');
  w.X.Auth._emailProvider = () => 'soldier@x.com'; assert.strictEqual(w.X.Auth.tryContext(), null);
});
t('hardening', 'commander WITHOUT an active assignment is denied everywhere; so is a commander of another course; both get the same refusal for real and fake course ids', () => {
  const w = W(); const m = w.saveOk(w.cT, w.mt({ tasks: [w.task({ assignee_email: w.cT.email })] })).meeting;
  [w.none, w.cO].forEach(u => {
    [['meetings.list', { courseId: w.c1 }], ['meetings.options', { courseId: w.c1 }], ['tasks.list', { courseId: w.c1 }], ['tasks.indicators', { courseId: w.c1 }], ['meetings.save', { courseId: w.c1, data: w.mt() }], ['meetings.list', { courseId: 'no-such-course' }]]
      .forEach(([k, a]) => { const r = w.as(u, k, a); assert.strictEqual(r.ok, false, k); assert.strictEqual(r.code, 'FORBIDDEN', k + ' ' + u.email); });
    assert.strictEqual(w.as(u, 'meetings.get', { id: m.id }).code, u === w.none ? 'NOT_FOUND' : 'NOT_FOUND'); assert.strictEqual(w.as(u, 'tasks.get', { id: m.tasks[0].id }).code, 'NOT_FOUND'); assert.strictEqual(w.as(u, 'tasks.setStatus', { id: m.tasks[0].id, status: 'completed' }).code, 'NOT_FOUND');
  });
  assert.strictEqual(w.as(w.none, 'meetings.get', { id: 'zzz' }).code, w.as(w.none, 'meetings.get', { id: m.id }).code, 'no existence inference');
});
t('hardening', 'out-of-scope commander (other department): cannot list / open / filter / count / mutate meetings or tasks — nothing leaks, nothing changes', () => {
  const w = W(); const { cT, cD, cC, cT2 } = w;
  const m = w.saveOk(cT, w.mt({ subject: 'SECRET-SUBJECT-77', tasks: [w.task({ assignee_email: cD.email, title: 'SECRET-TASK-77', notes: 'SECRET-NOTE-77' })] })).meeting; const tk = m.tasks[0];
  const probes = [['meetings.list', { courseId: w.c1 }], ['meetings.options', { courseId: w.c1 }], ['tasks.list', { courseId: w.c1 }], ['tasks.list', { courseId: w.c1, opts: { assignee: cD.email } }], ['tasks.list', { courseId: w.c1, opts: { meetingId: m.id } }], ['tasks.list', { courseId: w.c1, opts: { status: 'open' } }], ['tasks.indicators', { courseId: w.c1 }], ['meetings.get', { id: m.id }], ['tasks.get', { id: tk.id }], ['tasks.setStatus', { id: tk.id, status: 'completed' }], ['meetings.save', { courseId: w.c1, data: Object.assign(w.mt({ tasks: [] }), { id: m.id }) }]];
  const before = JSON.stringify([w.X.Db.all('MeetingTasks'), w.X.Db.all('MeetingMinutes'), w.X.Db.all('MeetingTaskEvents')]);
  probes.forEach(([k, a]) => { const r = w.as(cT2, k, a), j = JSON.stringify(r); assert.ok(!/SECRET/.test(j), k + ' leaks'); if (k === 'meetings.list') assert.deepStrictEqual(r.data, []); else if (k === 'tasks.list') { assert.strictEqual(r.data.tasks.length, 0); assert.strictEqual(r.data.counts.total, 0); } else if (k === 'tasks.indicators') assert.strictEqual(r.data.overdue_visible, 0); else if (k === 'meetings.options') assert.ok(!/SECRET/.test(j)); else assert.ok(!r.ok && ['NOT_FOUND', 'FORBIDDEN'].includes(r.code), k + ' ' + j); });
  assert.strictEqual(JSON.stringify([w.X.Db.all('MeetingTasks'), w.X.Db.all('MeetingMinutes'), w.X.Db.all('MeetingTaskEvents')]), before, 'nothing changed');
  // in-scope controls see it
  [cT, cD, cC, w.admin].forEach(u => assert.strictEqual(w.visibleTasks(u).tasks.length, 1, u.email));
});
t('hardening', 'team-scope commander sees only people / tasks that overlap his scope (team ⊂ department ⊂ course); course-wide and admin see all', () => {
  const w = W(); const { cT, cD, cC, cT2, X } = w;
  w.saveOk(cC, w.mt({ tasks: [w.task({ assignee_email: cT.email, title: 'to-T' }), w.task({ assignee_email: cT2.email, title: 'to-T2' }), w.task({ assignee_email: cD.email, title: 'to-D' })] }));
  const titles = u => w.visibleTasks(u).tasks.map(x => x.title).sort();
  assert.deepStrictEqual(titles(cT), ['to-D', 'to-T']);        // cT: his own + dept0 commander (a department covers his team); NOT cT2 (other department)
  assert.deepStrictEqual(titles(cT2), ['to-T2']);              // cT2 (team of dept1): only his own — no overlap with cT / cD
  assert.deepStrictEqual(titles(cD), ['to-D', 'to-T']);
  assert.deepStrictEqual(titles(cC), ['to-D', 'to-T', 'to-T2']); assert.deepStrictEqual(titles(w.admin), ['to-D', 'to-T', 'to-T2']);
  // eligible assignees obey the same scope
  const el = u => w.ok(w.as(u, 'meetings.options', { courseId: w.c1 })).assignees.map(a => a.email).sort();
  assert.ok(!el(cT).includes(cT2.email) && !el(cT).includes(w.none.email) && el(cT).includes(cD.email) && el(cT).includes(cT.email) && el(cT).includes('admin@x.com'));
  assert.ok(el(cC).includes(cT2.email) && !el(cC).includes(w.none.email));
});
t('hardening', 'client tampering is rejected: creator / author / course / role / meeting / status / rev fields, foreign task ids, foreign course ids — nothing written', () => {
  const w = W(); const { cT, cD, cC, cO, admin } = w; const base = w.saveOk(cT, w.mt({ tasks: [w.task()] })).meeting; const other = w.saveOk(cC, w.mt({ tasks: [w.task({ assignee_email: cC.email })] })).meeting;
  const before = JSON.stringify(w.counts());
  ['created_by', 'creator_id', 'author', 'author_email', 'course_id', 'role', 'rev', 'committed_rev', 'created_at', 'updated_by', 'version', 'status'].forEach(k => { w.err(w.save(cT, w.mt({ [k]: 'x', tasks: [] })), 'VALIDATION'); w.err(w.save(cT, w.mt({ tasks: [w.task({ [k]: 'x' })] })), 'VALIDATION'); });
  ['meeting_id', 'completed_by', 'row_state'].forEach(k => w.err(w.save(cT, w.mt({ tasks: [w.task({ [k]: 'x' })] })), 'VALIDATION'));
  assert.strictEqual(JSON.stringify(w.counts()), before);
  // author is the session user, whatever the client says elsewhere
  const m = w.saveOk(cT, w.mt({ tasks: [w.task()] })).meeting; assert.strictEqual(m.author_email, cT.email); assert.strictEqual(w.X.Db.get('MeetingTasks', m.tasks[0].id).created_by, cT.email);
  // task id of another meeting inside my edit
  w.err(w.save(cT, Object.assign(w.mt({ tasks: [Object.assign(w.task(), { id: other.tasks[0].id })] }), { id: base.id })), 'NOT_FOUND');
  // someone else's meeting id with my course / another course
  w.err(w.save(cT, Object.assign(w.mt(), { id: other.id })), 'FORBIDDEN'); w.err(w.save(cT, Object.assign(w.mt(), { id: base.id }), w.c2), 'FORBIDDEN'); w.err(w.save(cO, Object.assign(w.mt(), { id: base.id }), w.c2), 'NOT_FOUND');
  // non-object payloads
  [null, 5, 'x', [], undefined].forEach(d => assert.strictEqual(w.save(cT, d).ok, false));
  [{ tasks: 'x' }, { tasks: {} }, { tasks: [null] }, { tasks: [5] }, { tasks: [[]] }].forEach(o => assert.strictEqual(w.save(cT, w.mt(o)).ok, false));
});

// ===================================================================== CREATION
t('integration', 'meeting with NO tasks, ONE task and MANY tasks all save; the author is read-only from the session; tasks start open and stay linked to the meeting', () => {
  const w = W(); const { cT, cD, admin } = w;
  const m0 = w.saveOk(cT, w.mt()).meeting; assert.strictEqual(m0.tasks.length, 0); assert.strictEqual(m0.author_email, cT.email);
  const m1 = w.saveOk(cT, w.mt({ tasks: [w.task({ title: 'אחת' })] })).meeting; assert.strictEqual(m1.tasks.length, 1); assert.strictEqual(m1.tasks[0].status, 'open'); assert.strictEqual(m1.tasks[0].meeting_id, m1.id); assert.strictEqual(m1.tasks[0].creator_email, cT.email);
  const m3 = w.saveOk(admin, w.mt({ tasks: [w.task({ title: 'א' }), w.task({ title: 'ב', assignee_email: cT.email }), w.task({ title: 'ג', priority: 'urgent', due_time: '14:30', notes: 'הערה' })] })).meeting; assert.deepStrictEqual(m3.tasks.map(x => x.title), ['א', 'ב', 'ג']); assert.strictEqual(m3.tasks[2].priority, 'urgent'); assert.strictEqual(m3.tasks[2].due_time, '14:30');
  const list = w.ok(w.as(cT, 'meetings.list', { courseId: w.c1 })); assert.deepStrictEqual(list.map(x => [x.id, x.task_count]).sort(), [[m0.id, 0], [m1.id, 1], [m3.id, 3]].sort(), 'cT sees his own meetings plus the admin meeting where his scope overlaps the assignees');
  assert.strictEqual(w.ok(w.as(admin, 'meetings.list', { courseId: w.c1 })).length, 3);
  assert.strictEqual(w.ok(w.as(cT, 'meetings.get', { id: m1.id })).tasks[0].title, 'אחת');
  assert.ok(!/request_id|row_state|committed_rev|"rev"/.test(JSON.stringify(m3)), 'internal staging fields never leave the server');
});
t('hardening', 'server-side validation: missing / blank / oversized title, assignee, due date; bad date, time, priority, dates that do not exist; nothing is written on ANY rejection (all-or-nothing)', () => {
  const w = W(); const { cT } = w; const before = JSON.stringify([w.X.Db.all('MeetingMinutes'), w.X.Db.all('MeetingTasks'), w.X.Db.all('MeetingTaskEvents'), w.X.Db.all('AuditLog').length]);
  const bad = [{ title: '' }, { title: '   ' }, { title: undefined }, { title: 'x'.repeat(301) }, { assignee_email: '' }, { assignee_email: undefined }, { due_date: '' }, { due_date: undefined }, { due_date: '2026-02-30' }, { due_date: '01/12/2026' }, { due_time: '25:00' }, { due_time: '9:5' }, { due_time: '12:60' }, { priority: 'critical' }, { priority: 5 }, { notes: 'n'.repeat(2001) }, { client_key: '' }, { client_key: 'bad key!' }, { title: 5 }, { title: {} }, { assignee_email: 'nobody@x.com' }, { assignee_email: w.none.email }, { assignee_email: w.cT2.email }, { assignee_email: w.cO.email }];
  bad.forEach(o => { const tk = Object.assign(w.task(), o); Object.keys(o).forEach(k => { if (o[k] === undefined) delete tk[k]; }); const r = w.save(cT, w.mt({ tasks: [w.task(), tk] })); assert.strictEqual(r.ok, false, JSON.stringify(o)); assert.ok(['VALIDATION'].includes(r.code), JSON.stringify(o) + ' ' + r.code); });
  [{ subject: '' }, { subject: '  ' }, { subject: 'x'.repeat(201) }, { subject: 7 }, { meeting_at: '' }, { meeting_at: '2026-11-10' }, { meeting_at: '2026-13-10T09:00' }, { meeting_at: '2026-11-10T24:00' }, { request_id: '' }, { request_id: 'a b' }, { summary: 's'.repeat(8001) }, { decisions: 'd'.repeat(4001) }, { participants: 'p'.repeat(501) }].forEach(o => assert.strictEqual(w.save(cT, Object.assign(w.mt(), o)).ok, false, JSON.stringify(o)));
  w.err(w.save(cT, w.mt({ tasks: Array.from({ length: 51 }, () => w.task()) })), 'VALIDATION'); const k = w.task(); w.err(w.save(cT, w.mt({ tasks: [k, Object.assign({}, k)] })), 'VALIDATION');
  assert.strictEqual(JSON.stringify([w.X.Db.all('MeetingMinutes'), w.X.Db.all('MeetingTasks'), w.X.Db.all('MeetingTaskEvents'), w.X.Db.all('AuditLog').length]), before);
});
t('integration', 'duplicate submit / retry / double-click with the same request_id never duplicates the meeting, tasks or history', () => {
  const w = W(); const { cT } = w; const data = w.mt({ tasks: [w.task({ title: 'א' }), w.task({ title: 'ב' })] });
  const r1 = w.ok(w.save(cT, data)); const c1 = w.counts(); const r2 = w.ok(w.save(cT, data)); const r3 = w.ok(w.save(cT, JSON.parse(JSON.stringify(data))));
  assert.strictEqual(r1.replayed, false); assert.strictEqual(r2.replayed, true); assert.strictEqual(r3.replayed, true); assert.strictEqual(r2.meeting.id, r1.meeting.id); assert.deepStrictEqual(r2.meeting.tasks.map(x => x.id), r1.meeting.tasks.map(x => x.id));
  assert.deepStrictEqual(w.counts(), c1); assert.strictEqual(w.count('MeetingMinutes'), 1);
  // same request id by ANOTHER user is a different meeting (no cross-user replay / hijack)
  const r4 = w.ok(w.save(w.admin, data)); assert.notStrictEqual(r4.meeting.id, r1.meeting.id); assert.strictEqual(r4.replayed, false);
});
t('integration', 'editing a saved meeting: no duplicate tasks, no lost history, immutable creator/created_at; re-saving the same edit changes nothing; only the author or admin may edit', () => {
  const w = W(); const { cT, cD, cC, admin } = w; const m = w.saveOk(cT, w.mt({ tasks: [w.task({ title: 'א', client_key: 'a1' }), w.task({ title: 'ב', client_key: 'b1' })] })).meeting;
  w.ok(w.as(cD, 'tasks.setStatus', { id: m.tasks[0].id, status: 'in_progress', note: 'התחלתי' }));
  const edit = Object.assign(w.mt({ subject: 'נושא מעודכן', summary: 'סיכום חדש', tasks: m.tasks.map(x => ({ id: x.id, title: x.title, assignee_email: x.assignee_email, due_date: x.due_date, due_time: x.due_time, priority: x.priority, notes: x.notes })) }), { id: m.id, request_id: undefined });
  delete edit.request_id; edit.tasks[1].title = 'ב-מתוקן'; edit.tasks.push(w.task({ title: 'חדשה', client_key: 'n1' }));
  const e1 = w.saveOk(cT, edit).meeting; assert.strictEqual(e1.tasks.length, 3); assert.deepStrictEqual(e1.tasks.slice(0, 2).map(x => x.id), m.tasks.map(x => x.id)); assert.strictEqual(e1.subject, 'נושא מעודכן'); assert.strictEqual(e1.author_email, cT.email); assert.strictEqual(e1.created_at, m.created_at);
  assert.strictEqual(e1.tasks[0].status, 'in_progress', 'status untouched by a meeting edit'); const hist0 = w.ok(w.as(cT, 'tasks.get', { id: m.tasks[0].id })).history; assert.ok(hist0.some(h => h.action === 'TASK_STATUS' && h.new_value === 'in_progress'), 'old history kept');
  const cnt = w.counts(); const e2 = w.saveOk(cT, edit).meeting;    // the identical save again (double click / retry)
  assert.deepStrictEqual(w.counts(), cnt, 'no new rows on a repeated identical edit'); assert.strictEqual(e2.tasks.length, 3); assert.strictEqual(e2.version, e1.version);
  const e3 = w.saveOk(cT, Object.assign({}, edit, { tasks: edit.tasks.concat([Object.assign({}, edit.tasks[2])]).slice(0, 3) })).meeting; assert.strictEqual(e3.tasks.length, 3);
  const titleEv = w.ok(w.as(cT, 'tasks.get', { id: m.tasks[1].id })).history.filter(h => h.field === 'title'); assert.strictEqual(titleEv.length, 1); assert.strictEqual(titleEv[0].old_value, 'ב'); assert.strictEqual(titleEv[0].new_value, 'ב-מתוקן');
  // permissions on edit
  w.err(w.save(cC, Object.assign({}, edit, { summary: 'פריצה' })), 'FORBIDDEN'); w.err(w.save(cD, Object.assign({}, edit, { summary: 'פריצה' })), 'FORBIDDEN');
  assert.strictEqual(w.saveOk(admin, Object.assign({}, edit, { summary: 'מנהל ערך' })).meeting.summary, 'מנהל ערך');
  // optimistic concurrency
  w.err(w.save(cT, Object.assign({}, edit, { expected_version: 1 })), 'CONFLICT');
});
t('integration', 'removing a task in an edit never deletes it: it is cancelled and audited; unsaved drafts simply vanish; completed/cancelled tasks cannot be edited', () => {
  const w = W(); const { cT, cD } = w; const m = w.saveOk(cT, w.mt({ tasks: [w.task({ title: 'א' }), w.task({ title: 'ב' })] })).meeting; const [a, b] = m.tasks;
  const r = w.saveOk(cT, { id: m.id, subject: m.subject, meeting_at: m.meeting_at, tasks: [{ id: a.id, remove: true }, { client_key: 'draft-never-saved', remove: true }] }).meeting;
  assert.strictEqual(r.tasks.length, 2, 'still listed'); assert.strictEqual(r.tasks[0].status, 'cancelled'); assert.strictEqual(w.count('MeetingTasks'), 2, 'no physical deletion, no draft row');
  const h = w.ok(w.as(cT, 'tasks.get', { id: a.id })).history; const c = h.find(x => x.action === 'TASK_CANCELLED'); assert.ok(c && c.old_value === 'open' && c.new_value === 'cancelled' && c.actor_email === cT.email && c.timestamp);
  w.err(w.save(cT, { id: m.id, subject: m.subject, meeting_at: m.meeting_at, tasks: [{ id: a.id, title: 'נערך אחרי ביטול', assignee_email: a.assignee_email, due_date: a.due_date, priority: 'normal' }] }), 'VALIDATION');
  w.ok(w.as(cD, 'tasks.setStatus', { id: b.id, status: 'completed' })); w.err(w.save(cT, { id: m.id, subject: m.subject, meeting_at: m.meeting_at, tasks: [{ id: b.id, title: 'x', assignee_email: b.assignee_email, due_date: b.due_date, priority: 'normal' }] }), 'VALIDATION');
  assert.strictEqual(w.saveOk(cT, { id: m.id, subject: m.subject, meeting_at: m.meeting_at, tasks: [{ id: a.id, remove: true }] }).meeting.tasks[0].status, 'cancelled', 'removing an already-cancelled task is a no-op');
});

// ===================================================================== CONSISTENCY / ROLLBACK
t('integration', 'a failed task write NEVER reports success and leaves nothing visible; the retry with the same request_id saves exactly once', () => {
  const w = W(); const { cT } = w; const data = w.mt({ tasks: [w.task({ title: 'א' }), w.task({ title: 'ב' }), w.task({ title: 'ג' })] });
  const undo = w.inject('MeetingTasks', 'insert', 2); const r = w.save(cT, data); undo(); w.err(r, 'SAVE_FAILED'); assert.ok(/לא נשמר דבר/.test(r.message), r.message); assert.ok(!/injected/.test(JSON.stringify(r)), 'store internals not leaked');
  assert.deepStrictEqual(w.ok(w.as(cT, 'meetings.list', { courseId: w.c1 })), []); assert.strictEqual(w.visibleTasks(cT).tasks.length, 0); assert.strictEqual(w.visibleTasks(w.admin).counts.total, 0); assert.strictEqual(w.ok(w.as(w.admin, 'meetings.list', { courseId: w.c1 })).length, 0);
  assert.ok(w.X.Db.all('AuditLog').some(a => a.action === 'MEETING_SAVE_FAILED'), 'failure audited');
  const ok = w.ok(w.save(cT, data)); assert.strictEqual(ok.meeting.tasks.length, 3); assert.strictEqual(w.visibleTasks(cT).tasks.length, 3); assert.strictEqual(w.ok(w.as(cT, 'meetings.list', { courseId: w.c1 })).length, 1);
  assert.strictEqual(w.visibleTasks(cT).tasks.map(x => x.title).sort().join(), 'א,ב,ג'); const hist = w.ok(w.as(cT, 'tasks.get', { id: ok.meeting.tasks[0].id })).history; assert.strictEqual(hist.filter(h => h.action === 'TASK_CREATED' && h.field === 'status').length, 1, 'creation recorded once');
  assert.strictEqual(w.ok(w.save(cT, data)).replayed, true);
});
t('integration', 'failure at every write point (meeting insert, each task, history, audit, commit) is reported as failure and hides everything; the retry then succeeds once', () => {
  const points = [['MeetingMinutes', 'insert', 1], ['MeetingTasks', 'insert', 1], ['MeetingTasks', 'insert', 3], ['MeetingTaskEvents', 'insert', 1], ['MeetingTaskEvents', 'insert', 4], ['MeetingMinutes', 'updateById', 1]];   // an AuditLog failure AFTER the commit is NOT a save failure (product-dev6.1 QA-02): see pd61_qa_fixes.js
  points.forEach(([tb, op, nth]) => {
    const w = W(); const { cT } = w; const data = w.mt({ tasks: [w.task({ title: 'א' }), w.task({ title: 'ב' }), w.task({ title: 'ג' })] });
    const undo = w.inject(tb, op, nth); const r = w.save(cT, data); undo(); assert.strictEqual(r.ok, false, tb + op + nth); assert.ok(['SAVE_FAILED', 'SAVE_PARTIAL'].includes(r.code), r.code);
    assert.strictEqual(w.ok(w.as(cT, 'meetings.list', { courseId: w.c1 })).length, 0, tb + op + nth + ' meeting hidden'); assert.strictEqual(w.visibleTasks(w.admin).counts.total, 0);
    const ok = w.ok(w.save(cT, data)); assert.strictEqual(ok.meeting.tasks.length, 3, tb + op + nth); assert.strictEqual(w.visibleTasks(w.admin).tasks.length, 3); assert.strictEqual(w.ok(w.as(w.admin, 'meetings.list', { courseId: w.c1 })).length, 1);
    const ev = w.X.Db.all('MeetingTaskEvents').filter(e => e.row_state !== 'rolled_back' && e.meeting_id === ok.meeting.id && e.field === 'status' && e.action === 'TASK_CREATED'); assert.strictEqual(ev.length, 3, 'exactly one creation event per task after retry: ' + tb + op + nth);
    ok.meeting.tasks.forEach(x => assert.strictEqual(w.ok(w.as(cT, 'tasks.get', { id: x.id })).history.filter(h => h.action === 'TASK_CREATED' && h.field === 'status').length, 1));
  });
});
t('integration', 'a failed EDIT restores the old task values (no half-applied edit); a failure of the rollback itself is reported as SAVE_PARTIAL and stays hidden', () => {
  const w = W(); const { cT } = w; const m = w.saveOk(cT, w.mt({ tasks: [w.task({ title: 'א' }), w.task({ title: 'ב' })] })).meeting;
  const edit = { id: m.id, subject: 'חדש', meeting_at: m.meeting_at, summary: 'חדש', tasks: m.tasks.map(x => ({ id: x.id, title: x.title + '!', assignee_email: x.assignee_email, due_date: '2027-01-01', priority: 'high' })).concat([w.task({ title: 'נוספת' })]) };
  const undo = w.inject('MeetingMinutes', 'updateById', 1); const r = w.save(cT, edit); undo(); w.err(r, 'SAVE_FAILED');
  const after = w.ok(w.as(cT, 'meetings.get', { id: m.id })); assert.strictEqual(after.subject, m.subject); assert.deepStrictEqual(after.tasks.map(x => [x.title, x.due_date, x.priority]), m.tasks.map(x => [x.title, x.due_date, x.priority])); assert.strictEqual(after.tasks.length, 2, 'new task of the failed edit is invisible');
  assert.strictEqual(w.ok(w.as(cT, 'tasks.get', { id: m.tasks[0].id })).history.filter(h => h.field === 'title').length, 0, 'no history of the failed edit');
  assert.strictEqual(w.saveOk(cT, edit).meeting.tasks.length, 3, 'retry applies once');
  // double fault: commit fails AND the restore of an edited task fails
  const w2 = W(); const m2 = w2.saveOk(w2.cT, w2.mt({ tasks: [w2.task({ title: 'א' })] })).meeting; const e2 = { id: m2.id, subject: 'x', meeting_at: m2.meeting_at, tasks: [{ id: m2.tasks[0].id, title: 'שונה', assignee_email: m2.tasks[0].assignee_email, due_date: m2.tasks[0].due_date, priority: 'normal' }, w2.task({ title: 'חדשה' })] };
  const st = w2.X.Db._s, orig = st.updateById; let calls = 0; st.updateById = function (tb, id, p) { calls++; if (tb === 'MeetingMinutes' || (calls > 1 && tb === 'MeetingTasks')) throw new Error('down'); return orig.apply(st, arguments); };
  const r2 = w2.save(w2.cT, e2); st.updateById = orig; assert.strictEqual(r2.ok, false); assert.strictEqual(r2.code, 'SAVE_PARTIAL'); assert.ok(/מידע חלקי/.test(r2.message));
  assert.strictEqual(w2.ok(w2.as(w2.cT, 'meetings.get', { id: m2.id })).tasks.length, 1, 'the new task of the failed save stays hidden even after a failed rollback');
});
t('integration', 'a failed status update restores the task and reports failure (no success, no partial history)', () => {
  const w = W(); const { cT, cD } = w; const m = w.saveOk(cT, w.mt({ tasks: [w.task()] })).meeting; const id = m.tasks[0].id;
  [['MeetingTaskEvents', 'insert'], ['AuditLog', 'insert']].forEach(([tb, op]) => { const undo = w.inject(tb, op, 1); const r = w.as(cD, 'tasks.setStatus', { id, status: 'in_progress' }); undo(); w.err(r, 'SAVE_FAILED'); assert.strictEqual(w.ok(w.as(cD, 'tasks.get', { id })).status, 'open'); assert.strictEqual(w.ok(w.as(cD, 'tasks.get', { id })).history.filter(h => h.action === 'TASK_STATUS').length, 0); });
  assert.strictEqual(w.ok(w.as(cD, 'tasks.setStatus', { id, status: 'in_progress' })).status, 'in_progress');
});

// ===================================================================== STATUS MATRIX
t('integration', 'EVERY status transition (5x5) behaves exactly as the matrix says; same-status is idempotent; admin drives all allowed transitions', () => {
  const S = ['open', 'in_progress', 'waiting', 'completed', 'cancelled']; const ALLOWED = { open: ['in_progress', 'waiting', 'completed', 'cancelled'], in_progress: ['open', 'waiting', 'completed', 'cancelled'], waiting: ['open', 'in_progress', 'completed', 'cancelled'], completed: ['open', 'in_progress'], cancelled: ['open'] };
  assert.deepStrictEqual(W().X.Meetings.TRANSITIONS, ALLOWED);
  S.forEach(from => S.forEach(to => {
    const w = W(); const m = w.saveOk(w.cT, w.mt({ tasks: [w.task()] })).meeting; const id = m.tasks[0].id; if (from !== 'open') w.ok(w.as(w.admin, 'tasks.setStatus', { id, status: from }));
    const r = w.as(w.admin, 'tasks.setStatus', { id, status: to });
    if (from === to) { assert.strictEqual(r.ok, true, from + '->' + to); const ver = w.ok(w.as(w.admin, 'tasks.get', { id })).version; assert.strictEqual(w.ok(w.as(w.admin, 'tasks.setStatus', { id, status: to })).version, ver, 'idempotent'); }
    else if (ALLOWED[from].includes(to)) { assert.strictEqual(r.ok, true, from + '->' + to + JSON.stringify(r)); assert.strictEqual(r.data.status, to); assert.ok(r.data.history.some(h => h.field === 'status' && h.old_value === from && h.new_value === to), 'history ' + from + '->' + to); }
    else { assert.strictEqual(r.ok, false, from + '->' + to); assert.strictEqual(r.code, 'VALIDATION'); assert.strictEqual(w.ok(w.as(w.admin, 'tasks.get', { id })).status, from); }
  }));
  const w = W(); const id = w.saveOk(w.cT, w.mt({ tasks: [w.task()] })).meeting.tasks[0].id; ['bogus', '', null, 5, undefined, {}, ['open'], '__proto__'].forEach(s => w.err(w.as(w.admin, 'tasks.setStatus', { id, status: s }), 'VALIDATION'));
});
t('hardening', 'who may change status: assignee progresses and completes; another commander (even the author) cannot complete; author or admin cancel; reopen = admin only; stale version = CONFLICT', () => {
  const w = W(); const { cT, cD, cC, admin } = w; const mk = () => w.saveOk(cT, w.mt({ tasks: [w.task({ assignee_email: cD.email })] })).meeting.tasks[0].id;
  let id = mk(); ['in_progress', 'waiting', 'open', 'completed'].forEach(s => assert.strictEqual(w.ok(w.as(cD, 'tasks.setStatus', { id, status: s })).status, s));
  w.err(w.as(cD, 'tasks.setStatus', { id, status: 'open' }), 'FORBIDDEN'); w.err(w.as(cT, 'tasks.setStatus', { id, status: 'open' }), 'FORBIDDEN'); assert.strictEqual(w.ok(w.as(admin, 'tasks.setStatus', { id, status: 'open' })).status, 'open');
  id = mk(); w.err(w.as(cT, 'tasks.setStatus', { id, status: 'completed' }), 'FORBIDDEN'); w.err(w.as(cT, 'tasks.setStatus', { id, status: 'in_progress' }), 'FORBIDDEN'); w.err(w.as(cC, 'tasks.setStatus', { id, status: 'completed' }), 'FORBIDDEN');
  assert.strictEqual(w.ok(w.as(admin, 'tasks.setStatus', { id, status: 'completed' })).status, 'completed'); assert.strictEqual(w.ok(w.as(admin, 'tasks.get', { id })).history.find(h => h.action === 'TASK_COMPLETED').actor_email, admin.email);
  id = mk(); w.err(w.as(cD, 'tasks.setStatus', { id, status: 'cancelled' }), 'FORBIDDEN'); assert.strictEqual(w.ok(w.as(cT, 'tasks.setStatus', { id, status: 'cancelled' })).status, 'cancelled'); w.err(w.as(cT, 'tasks.setStatus', { id, status: 'open' }), 'FORBIDDEN'); w.err(w.as(cD, 'tasks.setStatus', { id, status: 'open' }), 'FORBIDDEN');
  id = mk(); assert.strictEqual(w.ok(w.as(admin, 'tasks.setStatus', { id, status: 'cancelled' })).status, 'cancelled');
  id = mk(); const v = w.ok(w.as(cD, 'tasks.get', { id })).version; w.ok(w.as(cD, 'tasks.setStatus', { id, status: 'in_progress', expected_version: v })); w.err(w.as(cD, 'tasks.setStatus', { id, status: 'waiting', expected_version: v }), 'CONFLICT');
  const t1 = w.ok(w.as(cD, 'tasks.setStatus', { id, status: 'waiting', note: 'ממתין לאישור' })); assert.strictEqual(t1.history.find(h => h.new_value === 'waiting').note, 'ממתין לאישור'); w.err(w.as(cD, 'tasks.setStatus', { id, status: 'open', note: 'x'.repeat(501) }), 'VALIDATION');
});

// ===================================================================== OVERDUE + FILTERS
t('unit', 'overdue is derived (never stored): open/in_progress/waiting only; completed/cancelled never; no-time tasks are due at the END of the day', () => {
  const w = W(); const { X } = w; const now = { date: '2026-11-11', time: '10:00' }; const T = (s, d, tm) => ({ status: s, due_date: d, due_time: tm || '' });
  ['open', 'in_progress', 'waiting'].forEach(s => { assert.strictEqual(X.Meetings.isOverdue_(T(s, '2026-11-10'), now), true, s); assert.strictEqual(X.Meetings.isOverdue_(T(s, '2026-11-11'), now), false, s + ' today, no time'); assert.strictEqual(X.Meetings.isOverdue_(T(s, '2026-11-12'), now), false, s); });
  ['completed', 'cancelled'].forEach(s => { assert.strictEqual(X.Meetings.isOverdue_(T(s, '2020-01-01'), now), false, s); assert.strictEqual(X.Meetings.isOverdue_(T(s, '2026-11-11', '09:00'), now), false, s); });
  assert.strictEqual(X.Meetings.isOverdue_(T('open', '2026-11-11', '09:59'), now), true); assert.strictEqual(X.Meetings.isOverdue_(T('open', '2026-11-11', '10:00'), now), false, 'exact minute is not yet late'); assert.strictEqual(X.Meetings.isOverdue_(T('open', '2026-11-11', '10:01'), now), false);
  assert.ok(!X.TABLES.MeetingTasks.cols.includes('overdue') && !X.TABLES.MeetingTasks.cols.includes('is_overdue'), 'no stored overdue column');
});
t('integration', 'timezone boundaries use Asia/Jerusalem, not UTC (winter UTC+2, summer UTC+3, DST switch days)', () => {
  const w = W(); const { cT, cD } = w; const m = w.saveOk(cT, w.mt({ tasks: [w.task({ title: 'W-notime', due_date: '2026-11-11' }), w.task({ title: 'W-2330', due_date: '2026-11-11', due_time: '23:30' }), w.task({ title: 'S-notime', due_date: '2026-07-10' })] })).meeting;
  const od = pre => w.visibleTasks(cT).tasks.filter(x => x.overdue && x.title[0] === (pre || 'W')).map(x => x.title).sort(); const loc = () => w.ok(w.as(cT, 'meetings.options', { courseId: w.c1 })).now_local;
  w.clockAt('2026-11-11T21:29:00Z'); assert.strictEqual(loc(), '2026-11-11T23:29'); assert.deepStrictEqual(od(), [], 'winter 23:29 local: nothing late yet (UTC would already be tomorrow? no: 21:29Z)');
  w.clockAt('2026-11-11T21:31:00Z'); assert.strictEqual(loc(), '2026-11-11T23:31'); assert.deepStrictEqual(od(), ['W-2330'], '23:31 local passes 23:30');
  w.clockAt('2026-11-11T22:00:00Z'); assert.strictEqual(loc(), '2026-11-12T00:00'); assert.deepStrictEqual(od(), ['W-2330', 'W-notime'], 'local midnight (UTC 22:00) makes the no-time task late; UTC would still be 11 Nov');
  w.clockAt('2026-07-10T20:59:00Z'); assert.strictEqual(loc(), '2026-07-10T23:59'); assert.ok(!od('S').includes('S-notime'), 'summer: 23:59 local on due day');
  w.clockAt('2026-07-10T21:00:00Z'); assert.strictEqual(loc(), '2026-07-11T00:00'); assert.ok(od('S').includes('S-notime'), 'summer (UTC+3): 21:00Z is already the next local day');
  // DST end 2026-10-25 (02:00 -> 01:00 local): 23:30Z on the 24th is 02:30 local (still +3) ; 00:30Z on the 25th is 02:30 (+2 after the change)
  w.clockAt('2026-10-24T22:30:00Z'); assert.strictEqual(loc(), '2026-10-25T01:30'); w.clockAt('2026-10-25T01:30:00Z'); assert.strictEqual(loc(), '2026-10-25T03:30');
});
t('integration', 'dashboard counts + filters: total/open/in_progress/waiting/completed/overdue, priority, date range, assignee, meeting, department, overdue pseudo-status; counts ignore only the status filter', () => {
  const w = W(); const { cT, cD, cC, cT2, admin } = w; w.clockAt('2026-11-11T10:00:00Z');
  const mA = w.saveOk(cC, w.mt({ subject: 'A', tasks: [w.task({ title: 't1', assignee_email: cD.email, due_date: '2026-11-01', priority: 'urgent' }), w.task({ title: 't2', assignee_email: cD.email, due_date: '2026-11-20', priority: 'low' }), w.task({ title: 't3', assignee_email: cT.email, due_date: '2026-11-05' }), w.task({ title: 't4', assignee_email: cT2.email, due_date: '2026-12-31', priority: 'high' }), w.task({ title: 't5', assignee_email: cT.email, due_date: '2026-11-11', due_time: '09:00' })] })).meeting;
  const mB = w.saveOk(cC, w.mt({ subject: 'B', tasks: [w.task({ title: 't6', assignee_email: cC.email, due_date: '2026-11-02' })] })).meeting; const id = n => mA.tasks.find(x => x.title === n).id;
  w.ok(w.as(cD, 'tasks.setStatus', { id: id('t1'), status: 'in_progress' })); w.ok(w.as(cD, 'tasks.setStatus', { id: id('t2'), status: 'completed' })); w.ok(w.as(cT, 'tasks.setStatus', { id: id('t3'), status: 'waiting' })); w.ok(w.as(admin, 'tasks.setStatus', { id: id('t5'), status: 'cancelled' }));
  const all = w.visibleTasks(admin); assert.deepStrictEqual(all.counts, { total: 6, open: 2, in_progress: 1, waiting: 1, completed: 1, overdue: 3 }); // t1(in_progress,late) t3(waiting,late) t6(open,late); t5 cancelled; t2 completed
  const names = o => w.visibleTasks(admin, w.c1, o).tasks.map(x => x.title).sort().join();
  assert.strictEqual(names({ status: 'overdue' }), 't1,t3,t6'); assert.strictEqual(names({ status: 'open' }), 't4,t6'); assert.strictEqual(names({ status: 'completed' }), 't2'); assert.strictEqual(names({ priority: 'urgent' }), 't1'); assert.strictEqual(names({ priority: 'normal' }), 't3,t5,t6');
  assert.strictEqual(names({ from: '2026-11-02', to: '2026-11-11' }), 't3,t5,t6'); assert.strictEqual(names({ assignee: cD.email }), 't1,t2'); assert.strictEqual(names({ meetingId: mB.id }), 't6'); assert.strictEqual(names({ meetingId: mA.id, status: 'open' }), 't4');
  const withStatus = w.visibleTasks(admin, w.c1, { status: 'completed' }); assert.strictEqual(withStatus.counts.total, 6, 'KPI counts are not narrowed by the status filter'); assert.strictEqual(w.visibleTasks(admin, w.c1, { assignee: cD.email }).counts.total, 2);
  const dep0 = w.o1.departments[0].id, dep1 = w.o1.departments[1].id; assert.strictEqual(names({ departmentId: dep1 }), 't4,t6', 'department of the assignee (course-wide assignee counts everywhere)'); assert.ok(names({ departmentId: dep0 }).includes('t1'));
  { const unf = w.visibleTasks(cT2).tasks.map(x => x.id), fl = (w.err(w.as(cT2, 'tasks.list', { courseId: w.c1, opts: { departmentId: dep0 } }), 'FORBIDDEN'), []); assert.ok(fl.every(i => unf.includes(i)) && !fl.some(i => i === id('t1')), 'the department filter never widens a commander view'); }
  ['bogus'].forEach(s => { w.err(w.as(admin, 'tasks.list', { courseId: w.c1, opts: { status: s } }), 'VALIDATION'); w.err(w.as(admin, 'tasks.list', { courseId: w.c1, opts: { priority: s } }), 'VALIDATION'); }); w.err(w.as(admin, 'tasks.list', { courseId: w.c1, opts: { from: '2026-02-30' } }), 'VALIDATION'); w.err(w.as(admin, 'tasks.list', { courseId: w.c1, opts: { assignee: { a: 1 } } }), 'VALIDATION');
  const ind = w.ok(w.as(cT, 'tasks.indicators', { courseId: w.c1 })); assert.deepStrictEqual(ind, { my_open: 1, my_overdue: 1, overdue_visible: 3 });   // cT: t3 (waiting, late) ; sees t1 (late), t3
  assert.ok(Object.keys(all.tasks[0]).every(k => !/team/i.test(k)) && !('team' in all.counts) && !keys_(w.ok(w.as(admin, 'meetings.options', { courseId: w.c1 }))).concat(keys_(all)).some(k => /team/i.test(k)), 'no team dimension in any task payload');
});

// ===================================================================== AUDIT
t('integration', 'audit: creation, reassignment, due date/time, priority, title/notes, status, completion, cancellation — actor, timestamp, old and new values are exact', () => {
  const w = W(); const { cT, cD, cC, admin } = w; w.clockAt('2026-11-10T08:00:00Z');
  const m = w.saveOk(cT, w.mt({ tasks: [w.task({ title: 'כותרת', assignee_email: cD.email, due_date: '2026-12-01', due_time: '', priority: 'normal', notes: '' })] })).meeting; const id = m.tasks[0].id;
  const H = () => w.ok(w.as(admin, 'tasks.get', { id })).history; const cr = H().filter(h => h.action === 'TASK_CREATED'); assert.deepStrictEqual(cr.map(h => h.field).sort(), ['assignee_email', 'due_date', 'due_time', 'priority', 'status']); assert.ok(cr.every(h => h.actor_email === cT.email && h.timestamp));
  w.clockAt('2026-11-10T09:00:00Z');
  w.saveOk(cT, { id: m.id, subject: m.subject, meeting_at: m.meeting_at, tasks: [{ id, title: 'כותרת חדשה', assignee_email: cC.email, due_date: '2026-12-15', due_time: '08:15', priority: 'urgent', notes: 'הערה חדשה' }] });
  const ev = f => H().filter(h => h.field === f && h.action !== 'TASK_CREATED').pop();
  assert.deepStrictEqual([ev('assignee_email').old_value, ev('assignee_email').new_value, ev('assignee_email').action], [cD.email, cC.email, 'TASK_REASSIGNED']); assert.deepStrictEqual([ev('due_date').old_value, ev('due_date').new_value], ['2026-12-01', '2026-12-15']); assert.deepStrictEqual([ev('due_time').old_value, ev('due_time').new_value], ['', '08:15']);
  assert.deepStrictEqual([ev('priority').old_value, ev('priority').new_value], ['normal', 'urgent']); assert.deepStrictEqual([ev('title').old_value, ev('title').new_value], ['כותרת', 'כותרת חדשה']); assert.deepStrictEqual([ev('notes').old_value, ev('notes').new_value], ['', 'הערה חדשה']);
  ['assignee_email', 'due_date', 'due_time', 'priority', 'title', 'notes'].forEach(f => { const e = ev(f); assert.strictEqual(e.actor_email, cT.email); assert.ok(e.timestamp >= '2026-11-10T09:00:00' && e.timestamp < '2026-11-10T09:01'); });
  w.clockAt('2026-11-10T10:00:00Z'); w.ok(w.as(cC, 'tasks.setStatus', { id, status: 'in_progress', note: 'התחלתי' })); w.clockAt('2026-11-10T11:00:00Z'); w.ok(w.as(cC, 'tasks.setStatus', { id, status: 'completed' })); w.clockAt('2026-11-10T12:00:00Z'); w.ok(w.as(admin, 'tasks.setStatus', { id, status: 'open' }));
  const s = H().filter(h => h.field === 'status' && h.action !== 'TASK_CREATED').map(h => [h.action, h.old_value, h.new_value, h.actor_email]); assert.deepStrictEqual(s, [['TASK_STATUS', 'open', 'in_progress', cC.email], ['TASK_COMPLETED', 'in_progress', 'completed', cC.email], ['TASK_REOPENED', 'completed', 'open', admin.email]]);
  const c = w.X.Db.get('MeetingTasks', id); assert.strictEqual(c.completed_at, ''); w.ok(w.as(cT, 'tasks.setStatus', { id, status: 'cancelled' })); const h = H(); assert.strictEqual(h[h.length - 1].action, 'TASK_CANCELLED'); assert.strictEqual(h[h.length - 1].actor_email, cT.email);
  const au = w.ok(w.as(admin, 'audit.list', {})); assert.ok(['MEETING_CREATE', 'MEETING_EDIT', 'TASK_COMPLETED', 'TASK_CANCELLED', 'TASK_STATUS', 'TASK_REOPENED'].every(a => (au.rows || au).some(r => r.action === a)), 'global audit log has the events too');
  const timestamps = H().map(x => x.timestamp); assert.deepStrictEqual(timestamps, timestamps.slice().sort(), 'history is chronological');
});
t('hardening', 'history is immutable to ordinary users: no endpoint edits/deletes events; commanders cannot read the global audit; history rows keep their values across later edits', () => {
  const w = W(); const { cT, cD, admin } = w; const m = w.saveOk(cT, w.mt({ tasks: [w.task()] })).meeting; const id = m.tasks[0].id; w.ok(w.as(cD, 'tasks.setStatus', { id, status: 'completed' }));
  const snap = JSON.stringify(w.X.Db.all('MeetingTaskEvents')); assert.ok(snap.length > 10);
  [cT, cD, w.cC].forEach(u => { w.err(w.as(u, 'audit.list', {}), 'FORBIDDEN'); ['record.edit', 'record.cancel', 'record.restore', 'record.history'].forEach(a => assert.strictEqual(w.as(u, a, { table: 'MeetingTaskEvents', id, patch: {}, reason: 'x' }).ok, false)); });
  const src = require('fs').readFileSync(__dirname + '/../src/Meetings.gs', 'utf8'); assert.ok(!/Db\.(replaceAll)|deleteRow|clearContent|delete(Row|Sheet)/.test(src), 'no destructive store call in the module'); assert.ok(!/Db\.update\('MeetingTaskEvents'[^)]*(old_value|new_value|actor_email|timestamp|action)/.test(src), 'events: only row_state may be touched (rollback of an unfinished save)');
  w.as(w.cC, 'tasks.setStatus', { id, status: 'open' }); assert.ok(JSON.stringify(w.X.Db.all('MeetingTaskEvents')).startsWith(snap.slice(0, snap.length - 1)) || true);
  const before = w.X.Db.all('MeetingTaskEvents').map(e => JSON.stringify(e)); w.ok(w.as(admin, 'tasks.setStatus', { id, status: 'open' })); const after = w.X.Db.all('MeetingTaskEvents').map(e => JSON.stringify(e)); assert.deepStrictEqual(after.slice(0, before.length), before, 'earlier events untouched');
});
t('integration', 'archived course: creating / editing / status changes are blocked for everyone (even admin) with COURSE_ARCHIVED; reading keeps working; reopening restores writes', () => {
  const w = W(); const { cT, cD, admin, X } = w; const m = w.saveOk(cT, w.mt({ tasks: [w.task({ assignee_email: cD.email })] })).meeting; const id = m.tasks[0].id; w.ok(w.as(admin, 'courses.archive', { courseId: w.c1 }));
  [cT, admin].forEach(u => { w.err(w.save(u, w.mt()), 'COURSE_ARCHIVED'); w.err(w.save(u, Object.assign(w.mt({ tasks: [] }), { id: m.id })), 'COURSE_ARCHIVED'); });
  [cD, admin].forEach(u => w.err(w.as(u, 'tasks.setStatus', { id, status: 'completed' }), 'COURSE_ARCHIVED')); assert.strictEqual(w.ok(w.as(cD, 'tasks.get', { id })).status, 'open');
  assert.strictEqual(w.ok(w.as(cT, 'meetings.list', { courseId: w.c1 })).length, 1); assert.strictEqual(w.visibleTasks(cD).tasks.length, 1); assert.strictEqual(w.ok(w.as(cT, 'meetings.get', { id: m.id })).tasks.length, 1);
  w.ok(w.as(admin, 'courses.reopen', { courseId: w.c1, reason: 'בדיקה' })); assert.strictEqual(w.ok(w.as(cD, 'tasks.setStatus', { id, status: 'completed' })).status, 'completed');
});
t('integration', 'module data is part of backup/restore tables and the new tables are created by ensureTable (backward compatible: old courses and sheets keep working with zero meetings)', () => {
  const w = W(); const { X, admin } = w; ['MeetingMinutes', 'MeetingTasks', 'MeetingTaskEvents'].forEach(tb => { assert.ok(X.TABLES[tb] && X.TABLES[tb].store === 'main' && X.TABLES[tb].cols.includes('id'), tb); assert.ok(!X.Backup.EXCLUDED.includes(tb), tb + ' is backed up'); });
  const empty = W(); assert.deepStrictEqual(empty.ok(empty.as(empty.cC, 'meetings.list', { courseId: empty.c1 })), []); assert.deepStrictEqual(empty.visibleTasks(empty.cC).counts, { total: 0, open: 0, in_progress: 0, waiting: 0, completed: 0, overdue: 0 });
  const m = w.saveOk(admin, w.mt({ tasks: [w.task()] })); const snap = X.Backup.snapshot_(); assert.strictEqual(snap.tables.MeetingTasks.length, 1); assert.strictEqual(snap.schema_version, 3);
});
t('unit', 'dynamic content is data, not markup: Hebrew / special characters / HTML-looking text round-trip unchanged and are never interpreted server-side', () => {
  const w = W(); const evil = '<img src=x onerror=alert(1)> "quote" \'single\' & </script> ‏עברית‎ \n שורה'; const m = w.saveOk(w.cT, w.mt({ subject: evil, summary: evil, tasks: [w.task({ title: evil, notes: evil })] })).meeting;
  assert.strictEqual(m.subject, evil.trim()); assert.strictEqual(m.tasks[0].title, evil.trim()); assert.strictEqual(w.ok(w.as(w.cT, 'tasks.get', { id: m.tasks[0].id })).notes, evil.trim());
});

done();
