/* MASLUL 2027 — "ניהול וישיבות" module: meeting summaries (reading screen), all tasks, tasks I own — SEPARATE from the trainee follow-ups tab.
   Management tasks never enter the trainee data, reports or progress indicators (they live in MeetingTasks, not in trainee tables). Uses only the existing meetings.* / tasks.* API.
   Every change is confirmed by the server: after a write the meeting is re-read and re-drawn from the server state; an error never shows success; a task changed by someone else meanwhile is reported (CONFLICT) and refreshed. */
  var MG = { seg: 'meetings' };
  function mgLabelPri(p) { return { low: 'נמוכה', normal: 'רגילה', high: 'גבוהה', urgent: 'דחופה' }[p] || p; }
  function mgCopyErr(r) { return r && r.code === 'CONFLICT' ? 'המשימה עודכנה בינתיים על ידי משתמש אחר — הנתונים רועננו, בדקו ונסו שוב.' : msgOf(r); }

  /* ----- the module screen: #/mgmt ----- */
  function Mgmt() {
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'תצוגה' }), body = h('div', { 'aria-live': 'polite', id: 'mgBody' });
    var fab = canCreateTasks() ? h('button', { class: 'fab', type: 'button', id: 'taskFab', 'aria-label': 'הוספת משימה חדשה', 'aria-haspopup': 'dialog', text: '+', onclick: function (e) { openQuickTask(e.currentTarget); } }) : null;
    function segBtns() { return [['meetings', 'סיכומי ישיבות'], ['all', 'כל המשימות'], ['mine', 'באחריותי']].map(function (p) { return h('button', { type: 'button', 'aria-pressed': MG.seg === p[0] ? 'true' : 'false', id: 'mgSeg_' + p[0], text: p[1], onclick: function () { MG.seg = p[0]; seg.replaceChildren.apply(seg, segBtns()); load(); } }); }); }
    seg.replaceChildren.apply(seg, segBtns());
    mount('more', [h('button', { class: 'back', type: 'button', onclick: function () { go('more'); }, text: '→ חזרה ל״עוד״' }), sectionHead('ניהול וישיבות', 'נתונים סינתטיים'), h('p', { class: 'muted', text: 'משימות ניהוליות נפרדות ממעקבי החניכים ואינן נכנסות לנתוני החניכים, לדוחות או למדדי ההתקדמות שלהם.' }), seg, body].concat(fab ? [fab] : []), 'ניהול וישיבות');
    document.getElementById('view').classList.toggle('has-fab', !!fab); S.reloadTasks = function () { load(); };
    function load() {
      body.replaceChildren(skeleton(3));
      if (MG.seg === 'meetings') {
        api('meetings.list', CID()).then(function (r) {
          if (!r.ok) { body.replaceChildren(errBox(r, load)); return; } var rows = (r.data || []), nw = canCreateTasks() ? h('div', { class: 'btns', style: 'margin-top:0' }, [h('button', { class: 'primary', type: 'button', id: 'mgNew', text: '+ סיכום ישיבה חדש', onclick: function () { go('d/meetings/0'); } })]) : null; body.replaceChildren(); if (nw) body.append(nw);
          if (!rows.length) { body.append(emptyBox('אין סיכומי ישיבות עדיין.')); return; }
          rows.forEach(function (m) { body.append(card(m.subject, fmtD(m.meeting_at) + (m.author_name ? ' · ' + m.author_name : '') + (m.task_count !== undefined ? ' · ' + m.task_count + ' משימות' : ''), null, function () { go('meeting/' + m.id); })); });
        });
        return;
      }
      api('tasks.list', { courseId: S.course.id, opts: {} }).then(function (r) {
        if (!r.ok) { body.replaceChildren(errBox(r, load)); return; } var rows = r.data.tasks || [], me = String((S.who || {}).email || '').toLowerCase(); body.replaceChildren();
        body.append(h('p', { class: 'muted', id: 'mgCounts', text: 'פתוחות ' + r.data.counts.open + ' · בטיפול ' + r.data.counts.in_progress + ' · באיחור ' + r.data.counts.overdue }));
        var all = rows; if (MG.seg === 'mine') rows = rows.filter(function (t) { return String(t.assignee_email).toLowerCase() === me; });
        if (!rows.length) { body.append(emptyBox(MG.seg === 'mine' ? (all.length ? 'אין משימות באחריותך.' : 'אין משימות עדיין.') : 'אין משימות עדיין. הוסיפו משימה עם כפתור ה־+ או בסיכום ישיבה.')); return; }
        rows.forEach(function (t) { body.append(card(t.title, (t.assignee_name || t.assignee_email || '') + (t.due_date ? ' · עד ' + t.due_date : '') + (t.meeting_subject ? ' · ' + t.meeting_subject : ''), status(taskLabel(t.status), t.status === 'open' || t.overdue), function () { TaskStatus(t); })); });
      });
    }
    load();
  }

  /* ----- the meeting reading screen: #/meeting/<id> ----- */
  function MeetingView(id) {
    var holder = h('div', { id: 'mvBody' }, skeleton(3)), opts = null;
    mount('more', [h('button', { class: 'back', type: 'button', onclick: function () { go('mgmt'); }, text: '→ חזרה לניהול וישיבות' }), holder], 'סיכום ישיבה');
    function load(keepScroll) { var y = window.scrollY; return Promise.all([api('meetings.get', { id: id }, 'fresh'), api('meetings.options', CID())]).then(function (r) { if (!r[0].ok) { holder.replaceChildren(errBox(r[0], function () { load(); })); return; } opts = r[1].ok ? r[1].data : { assignees: [] }; draw(r[0].data); if (keepScroll) window.scrollTo(0, y); }); }
    function sec(t, body, idn) { return h('section', { class: 'mv-sec', 'aria-labelledby': idn }, [h('h2', { id: idn, text: t }), body]); }
    function para(t) { return t && String(t).trim() ? h('p', { class: 'mv-text', text: t }) : h('p', { class: 'muted', text: '—' }); }
    function draw(d) {
      var tasks = (d.tasks || []).filter(function (t) { return t.status !== 'cancelled'; }), open = tasks.filter(function (t) { return t.status !== 'completed'; }), head = [h('h1', { class: 'page', id: 'mvTitle', text: d.subject }), h('p', { class: 'muted', text: fmtD(d.meeting_at) + (d.meeting_at && String(d.meeting_at).length > 10 ? ' · ' + String(d.meeting_at).slice(11, 16) : '') })];
      var out = [].concat(head);
      out.push(sec('פרטי הישיבה והמשתתפים', h('dl', { class: 'kv' }, [h('dt', { text: 'כותב הסיכום' }), h('dd', { text: d.author_name || d.created_by || '—' }), h('dt', { text: 'משתתפים' }), h('dd', { text: d.participants || '—' })]), 'mvH1'));
      out.push(sec('עיקרי הדברים', para(d.summary), 'mvH2'));
      out.push(sec('קווים מנחים', para(d.decisions), 'mvH3'));
      var list = h('div', { id: 'mvTasks', role: 'list' }); tasks.forEach(function (t) { list.append(taskCard(d, t)); }); if (!tasks.length) list.append(emptyBox('אין משימות בסיכום זה.'));
      out.push(sec('משימות לביצוע (' + tasks.length + ')', list, 'mvH4'));
      out.push(sec('נושאים פתוחים להמשך', h('p', { id: 'mvOpen', class: open.length ? '' : 'muted', text: open.length ? 'עדיין פתוחות מסיכום זה: ' + open.length + ' משימות.' : 'כל המשימות בסיכום זה הושלמו.' }), 'mvH5'));
      if (d.can_edit && canCreateTasks()) out.push(h('div', { class: 'btns' }, [h('button', { class: 'secondary', type: 'button', id: 'mvEdit', text: 'עריכת הסיכום', onclick: function () { S.meetingEdit = d.id; go('d/meetings/0'); } })]));
      holder.replaceChildren.apply(holder, out);
    }
    function taskCard(d, t) {
      var done = t.status === 'completed', can = t.can || {}, msg = h('div', { class: 'mv-msg', role: 'alert', 'aria-live': 'polite' });
      var meta = (t.assignee_name || t.assignee_email || '—') + ' · יעד ' + (t.due_date ? fmtD(t.due_date) : '—') + ' · עדיפות ' + (t.priority_label || mgLabelPri(t.priority));
      var btns = [];
      if (can.complete) btns.push(h('button', { class: 'primary', type: 'button', 'data-act': 'done', text: 'סימון כבוצעה', onclick: function (e) { setSt(t, 'completed', msg, e.currentTarget); } }));
      if (can.reopen) btns.push(h('button', { class: 'secondary', type: 'button', 'data-act': 'reopen', text: 'פתיחה מחדש', onclick: function (e) { setSt(t, 'open', msg, e.currentTarget); } }));
      if (can.edit) btns.push(h('button', { class: 'secondary', type: 'button', 'data-act': 'edit', text: 'עריכה', onclick: function () { editTask(d, t); } }));
      return h('article', { class: 'card mv-task' + (done ? ' is-done' : ''), role: 'listitem', 'data-tid': t.id }, [h('div', {}, [h('h3', { text: t.title }), h('p', { text: meta }), t.notes ? h('p', { class: 'muted', text: t.notes }) : null]), h('div', { class: 'mv-side' }, [status(taskLabel(t.status), t.status === 'open' || t.overdue)]), btns.length ? h('div', { class: 'btns mv-btns' }, btns) : null, msg]);
    }
    function setSt(t, to, msg, btn) {
      busy(btn, true); msg.textContent = ''; msg.className = 'mv-msg';
      api('tasks.setStatus', { id: t.id, status: to, note: '', expected_version: t.version }).then(function (x) {
        if (x && x.ok) { return load(true).then(function () { toast(to === 'completed' ? 'המשימה סומנה כבוצעה' : 'המשימה נפתחה מחדש'); }); }
        busy(btn, false); var text = mgCopyErr(x); if (x && x.code === 'CONFLICT') { load(true).then(function () { var c = holder.querySelector('[data-tid="' + t.id + '"] .mv-msg'); if (c) { c.className = 'mv-msg msg err'; c.textContent = text; } }); return; } msg.className = 'mv-msg msg err'; msg.textContent = text;
      });
    }
    function editTask(d, t) {
      var as = assigneeSelect('mvAs', opts || { assignees: [] }, t.assignee_email); if (!Array.prototype.some.call(as.options, function (o) { return o.value === t.assignee_email; })) as.append(h('option', { value: t.assignee_email, text: t.assignee_name || t.assignee_email })), as.value = t.assignee_email;
      var du = h('input', { id: 'mvDu', type: 'date', value: fmtD(t.due_date) }), pr = h('select', { id: 'mvPr' }, PRI.map(function (p) { return h('option', { value: p[0], text: p[1] }); })), nt = h('textarea', { id: 'mvNt', maxlength: '2000' }); pr.value = t.priority; nt.value = t.notes || '';
      dialog('עריכת משימה', [h('p', { class: 'muted', text: t.title }), field('אחראי', as), field('תאריך יעד', du), field('עדיפות', pr), field('הערות', nt)], function (msg) {
        if (!du.value) { msg.textContent = 'יש לבחור תאריך יעד.'; msg.className = 'msg err'; return false; }
        function attempt(meeting, retry) {
          var tk = { id: t.id, title: t.title, assignee_email: as.value, due_date: du.value, due_time: t.due_time || '', priority: pr.value, notes: nt.value }, dd = Object.assign({ id: meeting.id, expected_version: meeting.version, tasks: [tk] }, metaOf(meeting));
          return api('meetings.save', { courseId: S.course.id, data: dd }).then(function (x) { if (!x.ok && x.code === 'CONFLICT' && !retry) return api('meetings.get', { id: id }, 'fresh').then(function (g) { if (!g.ok) return g; var cur = (g.data.tasks || []).filter(function (z) { return z.id === t.id; })[0]; if (cur && (cur.assignee_email !== t.assignee_email || fmtD(cur.due_date) !== fmtD(t.due_date) || cur.priority !== t.priority || (cur.notes || '') !== (t.notes || '') || cur.status !== t.status)) return { ok: false, code: 'CONFLICT', message: 'המשימה עודכנה בינתיים על ידי משתמש אחר — לא נדרסה. הנתונים רועננו.' }; return attempt(g.data, true); }); return x; });
        }
        return api('meetings.get', { id: id }, 'fresh').then(function (g) { if (!g.ok) return g; return attempt(g.data, false); }).then(function (x) { if (!x.ok) { msg.textContent = mgCopyErr(x); msg.className = 'msg err'; if (x.code === 'CONFLICT') load(true); return false; } return load(true).then(function () { toast('נשמר'); return true; }); });
      }, 'שמירה');
    }
    load();
  }
  window.Mgmt = Mgmt; window.MeetingView = MeetingView;
