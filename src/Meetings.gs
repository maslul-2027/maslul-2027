/**
 * Meetings — meeting minutes + linked tasks (product-dev6). Commander / admin only. Dashboard-only (no outbound notification channel exists in this module).
 *
 * Binding rules implemented here (see docs/product_dev6/*):
 *  - There is NO standalone task-creation entry point: tasks are created/edited only inside Meetings.save (the meeting-minutes form).
 *  - Identity, course and creator ALWAYS come from the server (ctx / stored rows). Payload keys that try to set them are rejected (FORBIDDEN_KEYS).
 *  - Module access (every action): Policy (role + course scope + archived-course write block) AND, for a commander, at least one ACTIVE assignment in that course.
 *  - Visibility (commander): a task is visible if he is its assignee, or the author of its meeting, or his assigned departments overlap the assignee's.
 *    A meeting is visible if he authored it or can see at least one of its tasks. Anything not visible answers NOT_FOUND (no existence inference).
 *  - Save is staged: new rows carry rev = committed_rev + 1 and stay INVISIBLE until a single write on the meeting row sets committed_rev (the commit).
 *    A failure before the commit is compensated (updated tasks restored, new rows marked rolled_back) and reported as a failure — never as success.
 *  - History is append-only (MeetingTaskEvents + AuditLog). There is no delete and no edit API for either.
 *  - Overdue is derived (never stored): status open/in_progress/waiting and due date/time passed in APP.TZ (Asia/Jerusalem).
 *  - No team dimension anywhere (no team filter / KPI / grouping). Department = the departments covered by the assignee's active assignments.
 */
const Meetings = {
  STATUSES: ['open', 'in_progress', 'waiting', 'completed', 'cancelled'],
  LABELS: { open: 'פתוחה', in_progress: 'בטיפול', waiting: 'ממתינה', completed: 'הושלמה', cancelled: 'בוטלה' },
  PRIORITIES: ['low', 'normal', 'high', 'urgent'],
  PRIORITY_LABELS: { low: 'נמוכה', normal: 'רגילה', high: 'גבוהה', urgent: 'דחופה' },
  OPEN_STATES: ['open', 'in_progress', 'waiting'],
  TRANSITIONS: {
    open: ['in_progress', 'waiting', 'completed', 'cancelled'],
    in_progress: ['open', 'waiting', 'completed', 'cancelled'],
    waiting: ['open', 'in_progress', 'completed', 'cancelled'],
    completed: ['open', 'in_progress'],
    cancelled: ['open']
  },
  FORBIDDEN_KEYS: ['created_by', 'creator_id', 'creator', 'author', 'author_email', 'course_id', 'role', 'rev', 'committed_rev', 'row_state', 'created_at', 'updated_by', 'updated_at', 'meeting_id', 'completed_by', 'cancelled_by', 'version', 'status'],
  MAX_TASKS: 50, LIST_CAP: 500, MEETING_CAP: 200,

  // ------------------------------------------------------------------ access
  hasAssignment_(email, courseId) { return Assignments.activeFor_(email, courseId).length > 0; },

  /** Policy + module gate. Scope is checked BEFORE the course is loaded so an out-of-scope caller cannot learn whether a course id exists. */
  access_(ctx, action, courseId) {
    Soldiers.scalar_(courseId, 'courseId');
    Policy.require(ctx, action, { courseId: courseId });
    const course = Courses.mustGet_(courseId);
    Policy.require(ctx, action, { courseId: courseId, courseStatus: course.status });
    if (ctx.role === ROLES.COMMANDER && !Meetings.hasAssignment_(ctx.email, courseId)) throw new AppError('FORBIDDEN', 'אין לך שיוך פעיל בקורס זה.');
    return course;
  },

  /** Scope units an active user covers in a course, as the EXISTING assignment model defines them: {all} (course-wide), {depts:[...]}, {teams:[...]}. Empty = no assignment. */
  scopeOf_(email, courseId) {
    const out = { all: false, depts: [], teams: [] };
    Assignments.activeFor_(email, courseId).forEach(function (a) {
      if (a.scope_type === 'course') out.all = true;
      else if (a.scope_type === 'department') out.depts.push(a.scope_id);
      else if (a.scope_type === 'team') out.teams.push(a.scope_id);
    });
    return out;
  },
  hasScope_(a) { return a.all || a.depts.length > 0 || a.teams.length > 0; },
  /** Two scopes overlap if either is course-wide, they share a department / team, or a team of one lies inside a department of the other. */
  overlap_(a, b, teamsById) {
    if (!Meetings.hasScope_(a) || !Meetings.hasScope_(b)) return false;
    if (a.all || b.all) return true;
    if (a.depts.some(function (d) { return b.depts.indexOf(d) !== -1; })) return true;
    if (a.teams.some(function (t) { return b.teams.indexOf(t) !== -1; })) return true;
    if (a.teams.some(function (t) { return teamsById[t] && b.depts.indexOf(teamsById[t].department_id) !== -1; })) return true;
    if (b.teams.some(function (t) { return teamsById[t] && a.depts.indexOf(teamsById[t].department_id) !== -1; })) return true;
    return false;
  },
  /** Departments a scope touches (course-wide => all departments of the course). */
  deptIds_(sc, L) {
    if (sc.all) return Object.keys(L.depts);
    const set = {}; sc.depts.forEach(function (d) { set[d] = 1; }); sc.teams.forEach(function (t) { if (L.teams[t]) set[L.teams[t].department_id] = 1; });
    return Object.keys(set);
  },

  /** Departments the REQUESTER has authority over (admin: every department of the course; commander: the departments his own assignments touch). Cached on L. */
  authDepts_(L) {
    if (!L.authSet) { const ids = L.admin ? Object.keys(L.depts) : Meetings.deptIds_(L.scopeFor(L.me), L); L.authSet = {}; ids.forEach(function (d) { L.authSet[d] = 1; }); }
    return L.authSet;
  },

  /** One consistent read of everything a caller may see in a course (no N+1). Used by every read path. */
  load_(ctx, courseId) {
    const admin = ctx.role === ROLES.ADMIN, me = ctx.email;
    const teams = {}; Db.where('Teams', function (t) { return t.course_id === courseId; }).forEach(function (t) { teams[t.id] = t; });
    const depts = {}; Db.where('Departments', function (d) { return d.course_id === courseId; }).forEach(function (d) { depts[d.id] = d; });
    const users = {}; Db.all('Users').forEach(function (u) { users[String(u.email).trim().toLowerCase()] = u; });
    const scopeCache = {}, scopeFor = function (email) { const e = String(email).toLowerCase(); if (!scopeCache[e]) { const u = users[e]; scopeCache[e] = u && u.role === ROLES.ADMIN ? { all: true, depts: [], teams: [] } : Meetings.scopeOf_(e, courseId); } return scopeCache[e]; };
    const mine = admin ? null : scopeFor(me);
    const meetings = {}; Db.where('MeetingMinutes', function (m) { return m.course_id === courseId && Number(m.committed_rev) >= 1; }).forEach(function (m) { meetings[m.id] = m; });
    const tasks = Db.where('MeetingTasks', function (t) { const m = meetings[t.meeting_id]; return t.course_id === courseId && m && t.row_state !== 'rolled_back' && Number(t.rev) <= Number(m.committed_rev); });
    const visTask = function (t) {
      if (admin) return true;
      if (String(t.assignee_email).toLowerCase() === me) return true;
      if (String(meetings[t.meeting_id].created_by).toLowerCase() === me) return true;
      return Meetings.overlap_(mine, scopeFor(t.assignee_email), teams);
    };
    const vTasks = tasks.filter(visTask), vMeetingIds = {};
    vTasks.forEach(function (t) { vMeetingIds[t.meeting_id] = true; });
    Object.keys(meetings).forEach(function (id) { if (admin || String(meetings[id].created_by).toLowerCase() === me) vMeetingIds[id] = true; });
    return { admin: admin, me: me, teams: teams, depts: depts, users: users, scopeFor: scopeFor, meetings: meetings, tasks: vTasks, meetingIds: vMeetingIds };
  },

  name_(L, email) { const u = L.users[String(email).toLowerCase()]; return u ? (u.display_name || u.email) : String(email); },

  // ------------------------------------------------------------------ time (APP.TZ)
  /** Local date/time in APP.TZ. Utilities.formatDate on Apps Script; Intl in Node tests (same zone, DST-aware). */
  nowLocal_() {
    const d = Util.now();
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) return { date: Utilities.formatDate(d, APP.TZ, 'yyyy-MM-dd'), time: Utilities.formatDate(d, APP.TZ, 'HH:mm') };
    const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: APP.TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
  },
  /** Overdue = open/in_progress/waiting AND due moment passed. No time => due at the end of due_date (overdue from the next local day). With time => overdue strictly after HH:mm. */
  isOverdue_(t, now) {
    if (Meetings.OPEN_STATES.indexOf(t.status) === -1) return false;
    const dd = Util.cellToIsoDate(t.due_date), tm = Util.str(t.due_time);
    if (now.date > dd) return true;
    if (now.date < dd) return false;
    return tm ? now.time > tm : false;
  },

  // ------------------------------------------------------------------ validation
  rejectForbidden_(o, where) {
    Meetings.FORBIDDEN_KEYS.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(o || {}, k)) throw new AppError('VALIDATION', 'שדה לא מורשה בבקשה (' + where + '): ' + k); });
  },
  text_(v, label, max, required) {
    if (v !== undefined && v !== null && typeof v !== 'string') throw new AppError('VALIDATION', label + ': נדרש טקסט.');
    const s = Util.str(v).trim();
    if (required && !s) throw new AppError('VALIDATION', 'חובה למלא: ' + label + '.');
    if (s.length > max) throw new AppError('VALIDATION', label + ' ארוך מדי (מקסימום ' + max + ' תווים).');
    return s;
  },
  key_(v, label) {
    const s = Util.str(v).trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(s)) throw new AppError('VALIDATION', label + ' לא תקין.');
    return s;
  },
  dateTime_(v, label) {
    const s = Util.str(v).trim(), m = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
    if (!m) throw new AppError('VALIDATION', label + ' לא תקין (תאריך ושעה).');
    Util.isoDate(m[1], label); return s;
  },
  task_(raw, idx) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new AppError('VALIDATION', 'משימה ' + (idx + 1) + ': מבנה לא תקין.');
    Meetings.rejectForbidden_(raw, 'משימה ' + (idx + 1));
    const label = 'משימה ' + (idx + 1) + ' — ';
    const o = {
      id: Util.str(raw.id).trim(), client_key: Util.str(raw.client_key).trim(), remove: raw.remove === true,
      title: Meetings.text_(raw.title, label + 'כותרת', 300, true), assignee_email: Meetings.text_(raw.assignee_email, label + 'אחראי', 200, true).toLowerCase(),
      due_date: Util.isoDate(Util.str(raw.due_date).trim(), label + 'תאריך יעד'), due_time: Util.str(raw.due_time).trim(),
      priority: Util.str(raw.priority).trim() || 'normal', notes: Meetings.text_(raw.notes, label + 'הערות', 2000, false)
    };
    if (!o.id) o.client_key = Meetings.key_(o.client_key, label + 'מזהה טיוטה');
    if (o.due_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(o.due_time)) throw new AppError('VALIDATION', label + 'שעת יעד לא תקינה (HH:MM).');
    if (Meetings.PRIORITIES.indexOf(o.priority) === -1) throw new AppError('VALIDATION', label + 'עדיפות לא תקינה.');
    return o;
  },
  /** Removal drafts only need the id (they are not validated as full tasks). */
  taskOrRemoval_(raw, idx) {
    if (raw && typeof raw === 'object' && raw.remove === true) {
      Meetings.rejectForbidden_(raw, 'משימה ' + (idx + 1));
      return { id: Util.str(raw.id).trim(), client_key: Util.str(raw.client_key).trim(), remove: true };
    }
    return Meetings.task_(raw, idx);
  },

  /** Active, eligible assignees for the caller: admins + commanders of the course with an active assignment; a commander may only pick people in his own scope (or himself / admins). */
  eligible_(ctx, courseId, L) {
    L = L || Meetings.load_(ctx, courseId);
    const out = [];
    Object.keys(L.users).forEach(function (e) {
      const u = L.users[e];
      if (!Util.isTrue(u.active)) return;
      let ok = false;
      if (u.role === ROLES.ADMIN) ok = true;
      else if (u.role === ROLES.COMMANDER) {
        const inCourse = Util.str(u.course_scope).split(',').map(function (s) { return s.trim(); }).indexOf(courseId) !== -1;
        const sc = L.scopeFor(e);
        ok = inCourse && Meetings.hasScope_(sc);
        if (ok && !L.admin && e !== L.me) ok = Meetings.overlap_(L.scopeFor(L.me), sc, L.teams);
      }
      if (ok) out.push({ email: e, name: u.display_name || u.email, role: u.role });
    });
    out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'he'); });
    return out;
  },

  // ------------------------------------------------------------------ views
  taskView_(L, t, now, ctx) {
    const m = L.meetings[t.meeting_id], dep = L.scopeFor(t.assignee_email);
    const isAssignee = String(t.assignee_email).toLowerCase() === L.me, isAuthor = String(m.created_by).toLowerCase() === L.me, open = Meetings.OPEN_STATES.indexOf(t.status) !== -1;
    return {
      id: t.id, meeting_id: t.meeting_id, meeting_subject: m.subject, title: t.title, assignee_email: t.assignee_email, assignee_name: Meetings.name_(L, t.assignee_email),
      creator_email: m.created_by, creator_name: Meetings.name_(L, m.created_by),
      due_date: Util.cellToIsoDate(t.due_date), due_time: Util.str(t.due_time), priority: t.priority, priority_label: Meetings.PRIORITY_LABELS[t.priority] || t.priority,
      notes: t.notes, status: t.status, status_label: Meetings.LABELS[t.status], overdue: Meetings.isOverdue_(t, now), version: Number(t.version) || 1,
      department_ids: (function () { const A = Meetings.authDepts_(L); return Meetings.deptIds_(dep, L).filter(function (d) { return A[d] === 1; }); })(),   // never reveals departments outside the requester's authority (QA-01)
      created_at: t.created_at, updated_at: t.updated_at, completed_at: t.completed_at || '', cancelled_at: t.cancelled_at || '',
      can: {
        set_status: (L.admin || isAssignee) ? true : false, complete: (L.admin || isAssignee) && open, cancel: (L.admin || isAuthor) && t.status !== 'cancelled',
        reopen: L.admin && !open, edit: (L.admin || isAuthor) && open
      }
    };
  },

  // ------------------------------------------------------------------ history helpers
  event_(ctx, courseId, meetingId, taskId, rev, action, field, oldV, newV, note) {
    return { id: Util.uuid(), course_id: courseId, meeting_id: meetingId, task_id: taskId, rev: rev, row_state: 'active', actor_email: ctx.email, action: action, field: field || '', old_value: oldV === undefined || oldV === null ? '' : String(oldV), new_value: newV === undefined || newV === null ? '' : String(newV), note: note || '', timestamp: Util.nowIso() };
  },
  diffFields_: ['title', 'assignee_email', 'due_date', 'due_time', 'priority', 'notes'],

  // ------------------------------------------------------------------ SAVE (meeting + tasks) — the ONLY place where tasks are created
  save(ctx, courseId, p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new AppError('VALIDATION', 'בקשה לא תקינה.');
    const course = Meetings.access_(ctx, 'meeting.write', courseId);
    Meetings.rejectForbidden_((function () { const q = Object.assign({}, p); delete q.expected_version; delete q.version; return q; })(), 'סיכום');
    if (Object.prototype.hasOwnProperty.call(p, 'version')) throw new AppError('VALIDATION', 'שדה לא מורשה בבקשה (סיכום): version');
    const meetingId = Util.str(p.id).trim();
    const subject = Meetings.text_(p.subject, 'נושא הישיבה', 200, true), meetingAt = Meetings.dateTime_(p.meeting_at, 'תאריך ושעת הישיבה');
    const participants = Meetings.text_(p.participants, 'משתתפים', 500, false), summary = Meetings.text_(p.summary, 'סיכום', 8000, false), decisions = Meetings.text_(p.decisions, 'החלטות', 4000, false);
    const requestId = meetingId ? '' : Meetings.key_(p.request_id, 'מזהה בקשה');
    if (p.tasks !== undefined && !Array.isArray(p.tasks)) throw new AppError('VALIDATION', 'רשימת המשימות לא תקינה.');
    const rawTasks = p.tasks || [];
    if (rawTasks.length > Meetings.MAX_TASKS) throw new AppError('VALIDATION', 'יותר מדי משימות בסיכום (מקסימום ' + Meetings.MAX_TASKS + ').');
    const tasks = rawTasks.map(function (r, i) { return Meetings.taskOrRemoval_(r, i); });
    const seen = {}; tasks.forEach(function (t) { const k = t.id ? 'id:' + t.id : 'ck:' + t.client_key; if (seen[k]) throw new AppError('VALIDATION', 'משימה מופיעה פעמיים בבקשה.'); seen[k] = 1; });

    return Locks.run(function () {
      const L = Meetings.load_(ctx, courseId), elig = {}; Meetings.eligible_(ctx, courseId, L).forEach(function (e) { elig[e.email] = e; });
      let m = null, isNew = !meetingId;
      if (meetingId) {
        m = Db.get('MeetingMinutes', meetingId);
        if (!m || m.course_id !== courseId || Number(m.committed_rev) < 1 || !L.meetingIds[m.id]) throw new AppError('NOT_FOUND', 'הסיכום לא נמצא.');
        if (ctx.role !== ROLES.ADMIN && String(m.created_by).toLowerCase() !== ctx.email) throw new AppError('FORBIDDEN', 'עריכת סיכום מותרת לכותב הסיכום או למנהל מערכת בלבד.');
        if (p.expected_version !== undefined && Number(p.expected_version) !== Number(m.version)) throw new AppError('CONFLICT', 'הסיכום עודכן בינתיים. רעננו ונסו שוב.');
      } else {
        m = Db.where('MeetingMinutes', function (r) { return r.course_id === courseId && r.request_id === requestId && String(r.created_by).toLowerCase() === ctx.email; })[0] || null;
        if (m && Number(m.committed_rev) >= 1) return { replayed: true, meeting: Meetings.meetingView_(ctx, courseId, m.id) };   // duplicate submit / retry: nothing is written again
      }
      const R = (m ? Number(m.committed_rev) || 0 : 0) + 1;
      const existing = m ? Db.where('MeetingTasks', function (t) { return t.meeting_id === m.id && t.row_state !== 'rolled_back'; }) : [];
      const byId = {}, byKey = {}; existing.forEach(function (t) { byId[t.id] = t; if (t.client_key) byKey[t.client_key] = t; });
      // ---- plan (validation only; nothing is written yet)
      const plan = [];
      tasks.forEach(function (t, i) {
        let cur = t.id ? byId[t.id] : (byKey[t.client_key] || null);
        if (t.id && !cur) throw new AppError('NOT_FOUND', 'משימה ' + (i + 1) + ' אינה שייכת לסיכום זה.');
        if (cur && !(Number(cur.rev) <= (m ? Number(m.committed_rev) : 0)) && t.id) throw new AppError('NOT_FOUND', 'משימה ' + (i + 1) + ' אינה שייכת לסיכום זה.');
        const visible = cur && Number(cur.rev) <= (m ? Number(m.committed_rev) : 0);
        if (t.remove) {
          if (!cur || !visible) return;                                       // unsaved draft removed: nothing to do
          if (cur.status === 'cancelled') return;
          plan.push({ kind: 'cancel', cur: cur }); return;
        }
        if (elig[t.assignee_email] === undefined && (!visible || t.assignee_email !== String(cur.assignee_email).toLowerCase())) throw new AppError('VALIDATION', 'משימה ' + (i + 1) + ': האחראי אינו מפקד מורשה בהיקף שלך.');
        if (visible) {
          const ch = {}; Meetings.diffFields_.forEach(function (f) { const nv = t[f]; if (String(nv) !== String(f === 'due_date' ? Util.cellToIsoDate(cur[f]) : Util.str(cur[f]))) ch[f] = nv; });
          if (Object.keys(ch).length) {
            if (Meetings.OPEN_STATES.indexOf(cur.status) === -1) throw new AppError('VALIDATION', 'משימה ' + (i + 1) + ': משימה שהושלמה או בוטלה אינה ניתנת לעריכה.');
            plan.push({ kind: 'edit', cur: cur, ch: ch });
          }
        } else plan.push({ kind: 'new', t: t, reuse: cur || null });
      });
      // ---- staged write
      const now = Util.nowIso(), undo = { restore: [], insertedTasks: [], insertedEvents: [] };
      let committed = false, meetingInserted = false, auditEntry = null;
      try {
        if (!m) {
          m = { id: Util.uuid(), course_id: courseId, subject: subject, meeting_at: meetingAt, participants: participants, summary: summary, decisions: decisions, request_id: requestId, committed_rev: 0, version: 0, created_at: now, created_by: ctx.email, updated_at: now, updated_by: ctx.email };
          Db.insert('MeetingMinutes', m); meetingInserted = true;
        } else if (Number(m.committed_rev) < R) {
          // neutralise events left by a failed earlier attempt at the same revision (so a retry can never double them)
          Db.where('MeetingTaskEvents', function (e) { return e.meeting_id === m.id && Number(e.rev) === R && e.row_state !== 'rolled_back'; }).forEach(function (e) { Db.update('MeetingTaskEvents', e.id, { row_state: 'rolled_back' }); });
        }
        let seq = existing.reduce(function (a, t) { return Math.max(a, Number(t.seq) || 0); }, 0);
        const evs = [];
        plan.forEach(function (op) {
          if (op.kind === 'new') {
            const t = op.t, row = { id: op.reuse ? op.reuse.id : Util.uuid(), course_id: courseId, meeting_id: m.id, client_key: t.client_key, seq: op.reuse ? op.reuse.seq : ++seq, title: t.title, assignee_email: t.assignee_email, due_date: t.due_date, due_time: t.due_time, priority: t.priority, notes: t.notes, status: 'open', rev: R, row_state: 'active', version: 1, created_at: now, created_by: ctx.email, updated_at: now, updated_by: ctx.email, completed_at: '', completed_by: '', cancelled_at: '', cancelled_by: '' };
            if (op.reuse) Db.update('MeetingTasks', row.id, row); else { Db.insert('MeetingTasks', row); undo.insertedTasks.push(row.id); }
            evs.push(Meetings.event_(ctx, courseId, m.id, row.id, R, 'TASK_CREATED', 'status', '', 'open', t.title));
            ['assignee_email', 'due_date', 'due_time', 'priority'].forEach(function (f) { evs.push(Meetings.event_(ctx, courseId, m.id, row.id, R, 'TASK_CREATED', f, '', row[f], '')); });
          } else if (op.kind === 'edit') {
            const patch = Object.assign({}, op.ch, { version: (Number(op.cur.version) || 1) + 1, updated_at: now, updated_by: ctx.email }), old = {};
            Object.keys(patch).forEach(function (k) { old[k] = op.cur[k]; });
            Db.update('MeetingTasks', op.cur.id, patch); undo.restore.push({ id: op.cur.id, old: old });
            Object.keys(op.ch).forEach(function (f) { evs.push(Meetings.event_(ctx, courseId, m.id, op.cur.id, R, f === 'assignee_email' ? 'TASK_REASSIGNED' : 'TASK_EDITED', f, f === 'due_date' ? Util.cellToIsoDate(op.cur[f]) : op.cur[f], op.ch[f], '')); });
          } else if (op.kind === 'cancel') {
            const patch = { status: 'cancelled', cancelled_at: now, cancelled_by: ctx.email, version: (Number(op.cur.version) || 1) + 1, updated_at: now, updated_by: ctx.email }, old = {};
            Object.keys(patch).forEach(function (k) { old[k] = op.cur[k]; });
            Db.update('MeetingTasks', op.cur.id, patch); undo.restore.push({ id: op.cur.id, old: old });
            evs.push(Meetings.event_(ctx, courseId, m.id, op.cur.id, R, 'TASK_CANCELLED', 'status', op.cur.status, 'cancelled', 'הוסרה מסיכום הישיבה'));
          }
        });
        evs.forEach(function (e) { Db.insert('MeetingTaskEvents', e); undo.insertedEvents.push(e.id); });
        const metaChanged = isNew || subject !== m.subject || meetingAt !== Util.str(m.meeting_at) || participants !== Util.str(m.participants) || summary !== Util.str(m.summary) || decisions !== Util.str(m.decisions);
        auditEntry = { courseId: courseId, action: isNew ? 'MEETING_CREATE' : 'MEETING_EDIT', table: 'MeetingMinutes', recordId: m.id, before: isNew ? null : { subject: m.subject, meeting_at: m.meeting_at, version: m.version }, after: { subject: subject, meeting_at: meetingAt, tasks_created: plan.filter(function (o) { return o.kind === 'new'; }).length, tasks_edited: plan.filter(function (o) { return o.kind === 'edit'; }).length, tasks_cancelled: plan.filter(function (o) { return o.kind === 'cancel'; }).length, rev: R } };   // built BEFORE the commit (old values), written AFTER it
        // ---- COMMIT: one write on the meeting row. The success audit event is written ONLY AFTER it (QA-02). Before it nothing new is visible; after it everything is.
        Db.update('MeetingMinutes', m.id, { subject: subject, meeting_at: meetingAt, participants: participants, summary: summary, decisions: decisions, committed_rev: R, version: (Number(m.version) || 0) + (metaChanged || plan.length ? 1 : 0), updated_at: now, updated_by: ctx.email });
        committed = true;
      } catch (err) {
        if (!committed && Meetings.commitLanded_(m, R)) committed = true;   // the commit write threw but did land: the data IS saved, never answer SAVE_FAILED
        if (committed) { /* fall through to the post-commit audit */ } else {
        let clean = true;
        undo.restore.slice().reverse().forEach(function (r) { try { Db.update('MeetingTasks', r.id, r.old); } catch (e2) { clean = false; } });
        undo.insertedTasks.forEach(function (id) { try { Db.update('MeetingTasks', id, { row_state: 'rolled_back' }); } catch (e2) { clean = false; } });
        undo.insertedEvents.forEach(function (id) { try { Db.update('MeetingTaskEvents', id, { row_state: 'rolled_back' }); } catch (e2) { clean = false; } });
        try { Audit.log(ctx, { courseId: courseId, action: 'MEETING_SAVE_FAILED', table: 'MeetingMinutes', recordId: m ? m.id : '', after: { rev: R, rollback_clean: clean } }); } catch (e3) { /* best effort: a failed failure-log never turns a clean rollback into SAVE_PARTIAL */ }
        throw new AppError(clean ? 'SAVE_FAILED' : 'SAVE_PARTIAL', clean ? 'השמירה נכשלה ולא נשמר דבר. אפשר לנסות שוב.' : 'השמירה נכשלה וייתכן שנשמר מידע חלקי. פנו למנהל המערכת לפני ניסיון נוסף.');
        }
      }
      // ---- POST-COMMIT: the data is saved. A failure of the audit record is reported as a WARNING, never as SAVE_FAILED.
      let audit = { recorded: true };
      try {
        Audit.log(ctx, auditEntry);
      } catch (ea) {
        audit = { recorded: false, code: 'AUDIT_FAILED', meeting_id: m.id, rev: R, message: 'הסיכום והמשימות נשמרו, אך רישום הביקורת נכשל. מנהל המערכת יכול לאתר ולהשלים את הרישום החסר (מסך בדיקת שלמות / meetings.integrity).' };
      }
      return { replayed: false, meeting: Meetings.meetingView_(ctx, courseId, m.id), audit: audit };
    });
  },

  /** True when the meeting row already holds committed_rev === R (a commit write that threw may still have landed). */
  commitLanded_(m, R) { try { const cur = Db.get('MeetingMinutes', m.id); return !!cur && Number(cur.committed_rev) === R; } catch (e) { return false; } },

  /** Audit events (create/edit/repair) present per "meetingId:rev". */
  auditedRevs_(courseId) {
    const have = {};
    Db.where('AuditLog', function (r) { return r.course_id === courseId && r.table_name === 'MeetingMinutes' && (r.action === 'MEETING_CREATE' || r.action === 'MEETING_EDIT' || r.action === 'MEETING_AUDIT_REPAIR'); }).forEach(function (r) {
      let a = null; try { a = JSON.parse(r.after_json); } catch (e) { a = null; } if (a && a.rev !== undefined) have[r.record_id + ':' + Number(a.rev)] = 1;
    });
    return have;
  },
  /** ADMIN ONLY. Finds (1) committed revisions with NO audit event (save succeeded, audit write failed) and (2) orphan staged meetings (committed_rev = 0: a save that never committed; hidden from every reader, reused by a retry with the same request_id, never deleted). */
  integrity(ctx, courseId) {
    Soldiers.scalar_(courseId, 'courseId'); Policy.require(ctx, 'meeting.audit', { courseId: courseId }); Courses.mustGet_(courseId);
    const have = Meetings.auditedRevs_(courseId), gaps = [], orphans = [];
    Db.where('MeetingMinutes', function (m) { return m.course_id === courseId; }).forEach(function (m) {
      const c = Number(m.committed_rev) || 0;
      if (c < 1) { orphans.push({ meeting_id: m.id, subject: m.subject, created_at: m.created_at, created_by: m.created_by, staged_tasks: Db.where('MeetingTasks', function (t) { return t.meeting_id === m.id && t.row_state !== 'rolled_back'; }).length }); return; }
      for (let r = 1; r <= c; r++) if (!have[m.id + ':' + r]) gaps.push({ meeting_id: m.id, subject: m.subject, rev: r, committed: true });
    });
    return { audit_gaps: gaps.slice(0, 200), orphans: orphans.slice(0, 200), audit_gap_count: gaps.length, orphan_count: orphans.length };
  },
  /** ADMIN ONLY. Writes the missing audit event for one (meeting, rev) gap; append-only, itself audited as MEETING_AUDIT_REPAIR with the repairing admin and a mandatory reason. */
  auditRepair(ctx, courseId, id, rev, reason) {
    Soldiers.scalar_(courseId, 'courseId'); Soldiers.scalar_(id, 'id'); Policy.require(ctx, 'meeting.audit', { courseId: courseId }); Courses.mustGet_(courseId);
    const why = Meetings.text_(reason, 'סיבה', 300, true), r = Number(rev);
    if (!(r >= 1) || Math.floor(r) !== r) throw new AppError('VALIDATION', 'מספר גרסה לא תקין.');
    return Locks.run(function () {
      const m = Db.get('MeetingMinutes', id);
      if (!m || m.course_id !== courseId || Number(m.committed_rev) < r) throw new AppError('NOT_FOUND', 'הסיכום לא נמצא.');
      if (Meetings.auditedRevs_(courseId)[id + ':' + r]) throw new AppError('VALIDATION', 'אין פער ביקורת לגרסה זו.');
      Audit.log(ctx, { courseId: courseId, action: 'MEETING_AUDIT_REPAIR', table: 'MeetingMinutes', recordId: id, after: { rev: r, repaired: true, original_actor: r === 1 ? m.created_by : m.updated_by, subject: m.subject }, reason: why });
      return { repaired: true, meeting_id: id, rev: r };
    });
  },

  // ------------------------------------------------------------------ reads
  meetingView_(ctx, courseId, id) {
    const L = Meetings.load_(ctx, courseId), m = L.meetings[id];
    if (!m || !L.meetingIds[id]) throw new AppError('NOT_FOUND', 'הסיכום לא נמצא.');
    const now = Meetings.nowLocal_(), tasks = L.tasks.filter(function (t) { return t.meeting_id === id; }).sort(function (a, b) { return (Number(a.seq) || 0) - (Number(b.seq) || 0); }).map(function (t) { return Meetings.taskView_(L, t, now, ctx); });
    const isAuthor = String(m.created_by).toLowerCase() === L.me;
    return { id: m.id, course_id: m.course_id, subject: m.subject, meeting_at: Util.str(m.meeting_at), participants: m.participants, summary: m.summary, decisions: m.decisions,
      author_email: m.created_by, author_name: Meetings.name_(L, m.created_by), created_at: m.created_at, updated_at: m.updated_at, version: Number(m.version) || 1, tasks: tasks, can_edit: L.admin || isAuthor };
  },

  list(ctx, courseId) {
    Meetings.access_(ctx, 'meeting.read', courseId);
    const L = Meetings.load_(ctx, courseId), count = {};
    L.tasks.forEach(function (t) { count[t.meeting_id] = (count[t.meeting_id] || 0) + 1; });
    const rows = Object.keys(L.meetingIds).map(function (id) { const m = L.meetings[id]; return { id: m.id, subject: m.subject, meeting_at: Util.str(m.meeting_at), author_email: m.created_by, author_name: Meetings.name_(L, m.created_by), task_count: count[id] || 0, version: Number(m.version) || 1 }; });
    rows.sort(function (a, b) { return a.meeting_at < b.meeting_at ? 1 : a.meeting_at > b.meeting_at ? -1 : 0; });
    return rows.slice(0, Meetings.MEETING_CAP);
  },

  /** Meeting by id — the course comes from the STORED row (never from the client); scope is then checked for that course. */
  get(ctx, id) {
    Soldiers.scalar_(id, 'id');
    const m = Db.get('MeetingMinutes', id);
    if (!m || Number(m.committed_rev) < 1) throw new AppError('NOT_FOUND', 'הסיכום לא נמצא.');
    try { Meetings.access_(ctx, 'meeting.read', m.course_id); } catch (e) { throw new AppError('NOT_FOUND', 'הסיכום לא נמצא.'); }
    return Meetings.meetingView_(ctx, m.course_id, id);
  },

  /** Form context: eligible assignees + constants + default time. */
  options(ctx, courseId) {
    Meetings.access_(ctx, 'meeting.read', courseId);
    const L = Meetings.load_(ctx, courseId), now = Meetings.nowLocal_();
    return { assignees: Meetings.eligible_(ctx, courseId, L), statuses: Meetings.STATUSES.map(function (s) { return { id: s, label: Meetings.LABELS[s] }; }), priorities: Meetings.PRIORITIES.map(function (s) { return { id: s, label: Meetings.PRIORITY_LABELS[s] }; }),
      departments: L.admin ? Object.keys(L.depts).map(function (d) { return { id: d, name: L.depts[d].name }; }) : Meetings.deptIds_(L.scopeFor(L.me), L).map(function (d) { return { id: d, name: L.depts[d].name }; }),
      now_local: now.date + 'T' + now.time, tz: APP.TZ };
  },

  list_(ctx, courseId, opts) {
    opts = opts || {};
    ['assignee', 'departmentId', 'from', 'to', 'status', 'meetingId', 'priority'].forEach(function (k) { if (opts[k] !== undefined && opts[k] !== null && typeof opts[k] !== 'string') throw new AppError('VALIDATION', 'מסנן לא תקין: ' + k); });
    const L = Meetings.load_(ctx, courseId), now = Meetings.nowLocal_();
    const from = Util.str(opts.from) ? Util.isoDate(opts.from, 'מתאריך') : '', to = Util.str(opts.to) ? Util.isoDate(opts.to, 'עד תאריך') : '';
    const st = Util.str(opts.status), pr = Util.str(opts.priority), as = Util.str(opts.assignee).toLowerCase(), dep = Util.str(opts.departmentId), mt = Util.str(opts.meetingId);
    if (st && st !== 'overdue' && Meetings.STATUSES.indexOf(st) === -1) throw new AppError('VALIDATION', 'סטטוס לא תקין.');
    if (pr && Meetings.PRIORITIES.indexOf(pr) === -1) throw new AppError('VALIDATION', 'עדיפות לא תקינה.');
    if (dep) {   // QA-01: the department filter is authorised on the server; an out-of-authority (or unknown) id is refused with the same answer for a commander
      if (Meetings.authDepts_(L)[dep] !== 1) throw L.admin ? new AppError('VALIDATION', 'מחלקה לא קיימת בקורס.') : new AppError('FORBIDDEN', 'אין לך הרשאה לסנן לפי מחלקה זו.');
    }
    const views = L.tasks.map(function (t) { return Meetings.taskView_(L, t, now, ctx); });
    const base = views.filter(function (v) {
      if (as && v.assignee_email !== as) return false;
      if (dep && v.department_ids.indexOf(dep) === -1) return false;
      if (from && v.due_date < from) return false;
      if (to && v.due_date > to) return false;
      if (mt && v.meeting_id !== mt) return false;
      if (pr && v.priority !== pr) return false;
      return true;
    });
    const counts = { total: base.length, open: 0, in_progress: 0, waiting: 0, completed: 0, overdue: 0 };
    base.forEach(function (v) { if (counts[v.status] !== undefined) counts[v.status]++; if (v.overdue) counts.overdue++; });
    const rows = base.filter(function (v) { return !st || (st === 'overdue' ? v.overdue : v.status === st); });
    rows.sort(function (a, b) { const ka = a.due_date + (a.due_time || '99:99'), kb = b.due_date + (b.due_time || '99:99'); return ka < kb ? -1 : ka > kb ? 1 : 0; });
    return { counts: counts, tasks: rows.slice(0, Meetings.LIST_CAP), truncated: rows.length > Meetings.LIST_CAP, total_matching: rows.length };
  },
  tasks(ctx, courseId, opts) { Meetings.access_(ctx, 'task.read', courseId); return Meetings.list_(ctx, courseId, opts); },

  /** Dashboard indicators only (no outbound channel). */
  indicators(ctx, courseId) {
    Meetings.access_(ctx, 'task.read', courseId);
    const L = Meetings.load_(ctx, courseId), now = Meetings.nowLocal_(), out = { my_open: 0, my_overdue: 0, overdue_visible: 0 };
    L.tasks.forEach(function (t) { const o = Meetings.isOverdue_(t, now), mine = String(t.assignee_email).toLowerCase() === L.me, open = Meetings.OPEN_STATES.indexOf(t.status) !== -1; if (o) out.overdue_visible++; if (mine && open) out.my_open++; if (mine && o) out.my_overdue++; });
    return out;
  },

  /** Task detail + FULL history. Course from the stored row; invisible => NOT_FOUND. */
  taskGet(ctx, id) {
    Soldiers.scalar_(id, 'id');
    const t0 = Db.get('MeetingTasks', id);
    if (!t0) throw new AppError('NOT_FOUND', 'המשימה לא נמצאה.');
    try { Meetings.access_(ctx, 'task.read', t0.course_id); } catch (e) { throw new AppError('NOT_FOUND', 'המשימה לא נמצאה.'); }
    const L = Meetings.load_(ctx, t0.course_id), t = L.tasks.filter(function (x) { return x.id === id; })[0];
    if (!t) throw new AppError('NOT_FOUND', 'המשימה לא נמצאה.');
    const m = L.meetings[t.meeting_id], now = Meetings.nowLocal_(), view = Meetings.taskView_(L, t, now, ctx);
    const hist = Db.where('MeetingTaskEvents', function (e) { return e.task_id === id && e.row_state !== 'rolled_back' && Number(e.rev) <= Number(m.committed_rev); })
      .sort(function (a, b) { return a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0; })
      .map(function (e) { return { id: e.id, action: e.action, field: e.field, old_value: e.old_value, new_value: e.new_value, note: e.note, actor_email: e.actor_email, actor_name: Meetings.name_(L, e.actor_email), timestamp: e.timestamp }; });
    view.history = hist; view.meeting = { id: m.id, subject: m.subject, meeting_at: Util.str(m.meeting_at) };
    return view;
  },

  // ------------------------------------------------------------------ status / progress (assignee, author, admin) — never creates tasks
  setStatus(ctx, id, status, note, expectedVersion) {
    Soldiers.scalar_(id, 'id');
    if (typeof status !== 'string' || Meetings.STATUSES.indexOf(status) === -1) throw new AppError('VALIDATION', 'סטטוס לא תקין.');
    const nt = Meetings.text_(note, 'הערת התקדמות', 500, false);
    const t0 = Db.get('MeetingTasks', id);
    if (!t0) throw new AppError('NOT_FOUND', 'המשימה לא נמצאה.');
    try { Meetings.access_(ctx, 'task.update', t0.course_id); } catch (e) { if (e.code === 'COURSE_ARCHIVED') throw e; throw new AppError('NOT_FOUND', 'המשימה לא נמצאה.'); }
    return Locks.run(function () {
      const L = Meetings.load_(ctx, t0.course_id), t = L.tasks.filter(function (x) { return x.id === id; })[0];
      if (!t) throw new AppError('NOT_FOUND', 'המשימה לא נמצאה.');
      const m = L.meetings[t.meeting_id], isAssignee = String(t.assignee_email).toLowerCase() === ctx.email, isAuthor = String(m.created_by).toLowerCase() === ctx.email, admin = ctx.role === ROLES.ADMIN;
      if (expectedVersion !== undefined && expectedVersion !== null && Number(expectedVersion) !== Number(t.version)) throw new AppError('CONFLICT', 'המשימה עודכנה בינתיים. רעננו ונסו שוב.');
      if (status === t.status) return Meetings.taskGet(ctx, id);                                   // idempotent: same status again changes nothing
      if (Meetings.TRANSITIONS[t.status].indexOf(status) === -1) throw new AppError('VALIDATION', 'מעבר סטטוס לא מותר: ' + Meetings.LABELS[t.status] + ' ← ' + Meetings.LABELS[status] + '.');
      const wasOpen = Meetings.OPEN_STATES.indexOf(t.status) !== -1;
      let allowed;
      if (status === 'cancelled') allowed = admin || isAuthor;
      else if (!wasOpen) allowed = admin;                                                          // reopening a completed / cancelled task: admin only
      else allowed = admin || isAssignee;                                                         // progress + completion: assignee or admin
      if (!allowed) throw new AppError('FORBIDDEN', 'אין הרשאה לשנות סטטוס של משימה זו.');
      const now = Util.nowIso(), patch = { status: status, version: (Number(t.version) || 1) + 1, updated_at: now, updated_by: ctx.email };
      if (status === 'completed') { patch.completed_at = now; patch.completed_by = ctx.email; }
      if (status === 'cancelled') { patch.cancelled_at = now; patch.cancelled_by = ctx.email; }
      if (!wasOpen) { patch.completed_at = ''; patch.completed_by = ''; if (t.status === 'cancelled') { patch.cancelled_at = ''; patch.cancelled_by = ''; } }
      const act = status === 'completed' ? 'TASK_COMPLETED' : status === 'cancelled' ? 'TASK_CANCELLED' : !wasOpen ? 'TASK_REOPENED' : 'TASK_STATUS';
      const old = {}; Object.keys(patch).forEach(function (k) { old[k] = t[k]; });
      const ev = Meetings.event_(ctx, t.course_id, t.meeting_id, t.id, Number(m.committed_rev), act, 'status', t.status, status, nt);
      Db.update('MeetingTasks', t.id, patch);
      try { Db.insert('MeetingTaskEvents', ev); Audit.log(ctx, { courseId: t.course_id, action: act, table: 'MeetingTasks', recordId: t.id, before: { status: t.status }, after: { status: status }, reason: nt }); }
      catch (e) { try { Db.update('MeetingTasks', t.id, old); } catch (e2) { throw new AppError('SAVE_PARTIAL', 'העדכון נכשל וייתכן שנשמר מידע חלקי. פנו למנהל המערכת.'); } try { Db.update('MeetingTaskEvents', ev.id, { row_state: 'rolled_back' }); } catch (e3) { /* event may not exist */ } throw new AppError('SAVE_FAILED', 'העדכון נכשל ולא נשמר. אפשר לנסות שוב.'); }
      return Meetings.taskGet(ctx, id);
    });
  }
};
