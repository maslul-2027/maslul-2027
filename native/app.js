'use strict';
/* MASLUL 2027 — native mobile app shell (PR #10 design tokens) over ONE data/logic layer: window.appClient.api(method,args).
   No iframe, no second store, no legacy DOM. Every number on screen comes from appClient. */
(function () {
  var C = window.appClient, $ = function (s, r) { return (r || document).querySelector(s); };
  var S = { course: null, courses: [], org: null, who: null, route: 'home', filter: 'all', q: '', seg: 'tasks' };
  function h(tag, props, kids) {
    var e = document.createElement(tag); props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k]; if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else if (k === 'value') e.value = v; else e.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids || []).forEach(function (c) { if (c === null || c === undefined || c === false) return; e.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return e;
  }
  var view = $('#view'), toastT;
  function toast(msg, kind) { var o = $('.toast'); if (o) o.remove(); var t = h('div', { class: 'toast', role: kind === 'err' ? 'alert' : 'status', text: msg }); if (kind === 'err') t.style.background = '#9d202b'; document.body.append(t); clearTimeout(toastT); toastT = setTimeout(function () { t.remove(); }, 3200); }
  function api(m, a) { return C.api(m, a).catch(function () { return { ok: false, code: 'NETWORK', message: 'אין תקשורת. נסו שוב.' }; }); }
  function msgOf(r) { return (r && r.message) || 'הפעולה נכשלה.'; }
  function isAdmin() { return S.who && S.who.role === 'admin'; }
  function skeleton(n) { var w = h('div', { 'aria-busy': 'true', 'aria-label': 'טוען' }); for (var i = 0; i < (n || 3); i++) w.append(h('div', { class: 'skeleton' })); return w; }
  function sectionHead(title, aside, id) { return h('div', { class: 'section' }, [h('h2', { text: title, id: id }), aside ? h('span', { class: 'count', text: aside }) : null]); }
  function card(title, sub, right, onclick) { var d = h('div', {}, [h('h3', { text: title }), sub ? h('p', { text: sub }) : null]); var b = h(onclick ? 'button' : 'div', { class: 'card', type: onclick ? 'button' : null, onclick: onclick }, [d, right]); return b; }
  function status(text, warn) { return h('span', { class: 'status' + (warn ? ' warn' : ''), text: text }); }
  function emptyBox(t) { return h('div', { class: 'empty', text: t }); }
  function errBox(r, retry) { return h('div', {}, [h('div', { class: 'msg err', role: 'alert', text: msgOf(r) }), retry ? h('button', { class: 'secondary', type: 'button', onclick: retry, text: 'נסו שוב' }) : null]); }
  function go(route) { if (location.hash !== '#/' + route) location.hash = '#/' + route; else render(); }
  function setTab(name) { document.querySelectorAll('.tab').forEach(function (b) { if (b.dataset.go === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); }
  function mount(tab, nodes, title) { view.replaceChildren.apply(view, nodes); setTab(tab); document.title = (title ? title + ' · ' : '') + 'MASLUL 2027'; var hd = view.querySelector('h1,h2'); if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); } window.scrollTo(0, 0); }
  function field(label, input, hint) { var id = input.id || (input.id = 'f' + Math.random().toString(36).slice(2, 8)); return h('div', { class: 'field' }, [h('label', { for: id, text: label }), input, hint ? h('div', { class: 'hint', text: hint }) : null]); }
  function fieldErr(f, text) { f.classList.add('err'); var e = f.querySelector('.errmsg'); if (!e) { e = h('div', { class: 'errmsg', role: 'alert' }); f.append(e); } e.textContent = text; }
  function clearErr(form) { form.querySelectorAll('.field.err').forEach(function (f) { f.classList.remove('err'); var e = f.querySelector('.errmsg'); if (e) e.remove(); }); }
  function busy(btn, on, label) { btn.disabled = on; if (label) btn.textContent = on ? 'שומר…' : label; btn.setAttribute('aria-busy', on ? 'true' : 'false'); }
  function dialog(title, bodyNodes, onOk, okLabel, danger) {
    var d = h('dialog', { 'aria-labelledby': 'dlgT' }), f = h('form', { method: 'dialog' }), msg = h('div', { role: 'alert' });
    var ok = h('button', { class: danger ? 'danger' : 'primary', type: 'submit', text: okLabel || 'אישור' }), cancel = h('button', { class: 'secondary', type: 'button', text: 'ביטול', onclick: function () { d.close(); } });
    f.append(h('h2', { id: 'dlgT', text: title }), h('div', {}, bodyNodes), msg, h('div', { class: 'btns' }, [ok, cancel])); d.append(f); document.body.append(d);
    f.addEventListener('submit', function (e) { e.preventDefault(); busy(ok, true); Promise.resolve(onOk(msg)).then(function (done) { if (done === false) busy(ok, false); else d.close(); }); });
    d.addEventListener('close', function () { d.remove(); }); d.showModal(); return d;
  }

  /* ---------- context ---------- */
  function loadContext() {
    return Promise.all([api('whoAmI'), api('courses.list', {})]).then(function (r) {
      if (!r[0].ok) throw r[0]; S.who = r[0].data; S.courses = r[1].ok ? r[1].data : [];
      if (!S.course || !S.courses.some(function (c) { return c.id === S.course.id; })) S.course = S.courses[0] || null;
      if (!S.course) return null; return api('courses.org', { courseId: S.course.id }).then(function (o) { S.org = o.ok ? o.data : { departments: [], teams: [] }; });
    });
  }
  function ctxLine() { return 'פיילוט מסלול 2027 · סביבת תצוגה בלבד'; }
  function depName(id) { var d = (S.org.departments || []).filter(function (x) { return x.id === id; })[0]; return d ? d.name.replace(/\s*\(זמני\)/, '') : ''; }

  /* ---------- HOME ---------- */
  function Home() {
    var kp = [h('div', { class: 'stat' }, [h('strong', { text: '…', id: 'k1' }), h('small', { text: 'חניכים' })]), h('div', { class: 'stat' }, [h('strong', { text: '…', id: 'k2' }), h('small', { text: 'מעקבים פתוחים' })]), h('div', { class: 'stat' }, [h('strong', { text: '…', id: 'k3' }), h('small', { text: 'התראות פתוחות' })])];
    mount('home', [
      h('div', { class: 'hero' }, [h('small', { text: 'בוקר טוב 👋' }), h('h1', { text: 'הכול ברור. אפשר להתקדם.' }), h('p', { text: 'מסך בית שמציג את הפעולה החשובה הבאה, בלי לחפש בין עשרות תפריטים.' }), h('button', { class: 'primary', type: 'button', onclick: function () { go('soldiers'); }, text: 'מעבר לרשימת החניכים ←' })]),
      sectionHead('תמונת מצב', 'נתוני הדגמה'), h('div', { class: 'stats' }, kp),
      sectionHead('גישה מהירה', 'הכי שימושי'),
      card('חיפוש חניך', 'מוצאים אדם בשניות', h('span', { class: 'arrow', text: '←' }), function () { go('soldiers'); }),
      card('מעקבים לטיפול', 'מה צריך לעשות היום?', h('span', { class: 'arrow', text: '←' }), function () { go('tasks'); }),
      card('הוספת חניך', 'כרטיס חדש בכמה שניות', h('span', { class: 'arrow', text: '←' }), function () { go('soldier-new'); })
    ], 'בית');
    if (!S.course) return;
    api('soldiers.list', { courseId: S.course.id, opts: { active: true } }).then(function (r) { $('#k1').textContent = r.ok ? String(r.data.length) : '—'; });
    Promise.all([api('followups.list', { courseId: S.course.id, opts: {} }), api('tasks.indicators', { courseId: S.course.id })]).then(function (r) {
      var f = r[0].ok ? r[0].data.filter(function (x) { return x.status === 'open'; }).length : 0, t = r[1].ok ? (r[1].data.my_open || 0) : 0; $('#k2').textContent = (r[0].ok || r[1].ok) ? String(f + t) : '—';
    });
    api('alerts.counts', { courseId: S.course.id }).then(function (r) { $('#k3').textContent = r.ok ? String(r.data.open) : '—'; var k = $('#k3'); if (r.ok && r.data.red > 0) k.style.color = '#c52d36'; });
  }

  /* ---------- TRAINEES ---------- */
  var cache = { soldiers: null };
  function Soldiers() {
    var q = h('input', { class: 'search', id: 'q', type: 'search', placeholder: 'חיפוש לפי שם, מספר אישי או מחלקה…', 'aria-label': 'חיפוש חניכים', autocomplete: 'off', value: S.q }), list = h('div', { id: 'people', 'aria-live': 'polite' }), count = h('span', { class: 'count', id: 'count', text: '' });
    var chips = h('div', { class: 'filters', role: 'group', 'aria-label': 'סינון לפי מחלקה' });
    function chip(label, val) { return h('button', { class: 'chip' + (S.filter === val ? ' active' : ''), type: 'button', 'aria-pressed': S.filter === val ? 'true' : 'false', onclick: function () { S.filter = val; chips.replaceChildren.apply(chips, mk()); draw(); } , text: label }); }
    function mk() { return [chip('הכול', 'all')].concat((S.org.departments || []).map(function (d) { return chip(d.name.replace(/\s*\(זמני\)/, ''), d.id); })); }
    chips.replaceChildren.apply(chips, mk());
    var head = h('div', { class: 'section' }, [h('h2', { text: 'חניכים' }), count]);
    mount('soldiers', [head, h('div', { class: 'btns', style: 'margin:0 0 10px' }, [h('button', { class: 'primary', type: 'button', text: '+ הוספת חניך', onclick: function () { go('soldier-new'); } })]), q, chips, list], 'חניכים');
    list.append(skeleton(4));
    function draw() {
      var all = cache.soldiers || [], t = q.value.trim().toLowerCase(); S.q = q.value;
      var rows = all.filter(function (s) { return (S.filter === 'all' || s.department_id === S.filter) && (!t || (s.full_name || '').toLowerCase().includes(t) || String(s.personal_number).includes(t) || (s.department_name || '').toLowerCase().includes(t) || (s.team_name || '').toLowerCase().includes(t)); });
      count.textContent = rows.length + ' חניכים'; list.replaceChildren();
      if (!rows.length) { list.append(emptyBox(all.length ? 'לא נמצאו חניכים. אפשר לנסות חיפוש אחר.' : 'עדיין אין חניכים בקורס. אפשר להוסיף את הראשון.')); return; }
      rows.slice(0, 200).forEach(function (s) {
        var cancelled = s.record_status === 'cancelled';
        list.append(card(s.full_name, (s.department_name || '').replace(/\s*\(זמני\)/, '') + ' · ' + (s.team_name || '').replace(/\s*\(זמני\)/, ''), cancelled ? status('מבוטל', true) : status(s.active ? 'פעיל' : 'לא פעיל', !s.active), function () { go('soldier/' + s.id); }));
      });
      if (rows.length > 200) list.append(h('p', { class: 'muted', text: 'מוצגים 200 ראשונים. צמצמו עם חיפוש.' }));
    }
    function load() { list.replaceChildren(skeleton(4)); api('soldiers.list', { courseId: S.course.id, opts: {} }).then(function (r) { if (!r.ok) { list.replaceChildren(errBox(r, load)); return; } cache.soldiers = r.data; draw(); }); }
    q.addEventListener('input', draw); load();
  }

  function SoldierCard(id) {
    mount('soldiers', [h('button', { class: 'back', type: 'button', onclick: function () { go('soldiers'); }, text: '→ חזרה לרשימה' }), skeleton(2)], 'כרטיס חניך');
    api('soldiers.card', { id: id }).then(function (r) {
      if (!r.ok) { mount('soldiers', [h('button', { class: 'back', type: 'button', onclick: function () { go('soldiers'); }, text: '→ חזרה לרשימה' }), errBox(r, function () { SoldierCard(id); })], 'כרטיס חניך'); return; }
      var c = r.data, s = c.soldier, cancelled = s.record_status === 'cancelled';
      var kv = h('dl', { class: 'kv' }); [['מספר אישי', s.personal_number], ['קורס', c.course.name], ['מחלקה', (c.department_name || '').replace(/\s*\(זמני\)/, '')], ['צוות', (c.team_name || '').replace(/\s*\(זמני\)/, '')], ['מגדר', s.gender === 'F' ? 'נקבה' : 'זכר'], ['פק״ל', s.pakal || '—'], ['תאריך גיוס', s.enlistment_date || '—']].forEach(function (p) { kv.append(h('dt', { text: p[0] }), h('dd', { text: p[1] || '—', dir: p[0] === 'מספר אישי' ? 'ltr' : null })); });
      var btns = h('div', { class: 'btns' });
      btns.append(h('button', { class: 'primary', type: 'button', disabled: cancelled, text: 'עריכה', onclick: function () { SoldierForm(s); } }));
      if (cancelled) btns.append(h('button', { class: 'secondary', type: 'button', text: 'שחזור', onclick: function () { reasonDialog('שחזור חניך', false, function (reason, msg) { return api('soldiers.restore', { id: s.id, reason: reason }).then(function (x) { if (!x.ok) { msg.textContent = msgOf(x); msg.className = 'msg err'; return false; } toast('החניך שוחזר'); SoldierCard(s.id); }); }); } }));
      else btns.append(h('button', { class: 'danger', type: 'button', text: 'ביטול חניך', onclick: function () { reasonDialog('ביטול חניך', true, function (reason, msg) { return api('soldiers.cancel', { id: s.id, reason: reason }).then(function (x) { if (!x.ok) { msg.textContent = msgOf(x); msg.className = 'msg err'; return false; } toast('החניך בוטל'); SoldierCard(s.id); }); }); } }));
      var nav = c.navigation, extra = [];
      if (nav && nav.count !== undefined) extra.push(h('div', { class: 'card' }, [h('div', {}, [h('h3', { text: 'ניווט' }), h('p', { text: nav.count ? ('ממוצע ' + (nav.mean_display || '—') + ' · ' + nav.count + ' מבחנים') : 'עדיין אין מבחני ניווט' })])]));
      mount('soldiers', [h('button', { class: 'back', type: 'button', onclick: function () { go('soldiers'); }, text: '→ חזרה לרשימה' }), h('div', { class: 'section' }, [h('h2', { text: s.full_name }), cancelled ? status('מבוטל', true) : status(s.active ? 'פעיל' : 'לא פעיל', !s.active)]), h('div', { class: 'card', style: 'display:block' }, [kv]), btns].concat(extra), s.full_name);
    });
  }
  function reasonDialog(title, required, run) {
    var ta = h('textarea', { id: 'reason', 'aria-required': required ? 'true' : 'false' });
    dialog(title, [field(required ? 'סיבה (חובה)' : 'סיבה (לא חובה)', ta)], function (msg) { if (required && !ta.value.trim()) { msg.textContent = 'יש לציין סיבה.'; msg.className = 'msg err'; return false; } return run(ta.value.trim(), msg); }, 'אישור', required);
  }
  function SoldierForm(s) {
    var edit = !!s, f = h('form', { novalidate: 'true' }), msg = h('div', { role: 'alert' });
    var name = h('input', { id: 'fName', value: s ? s.full_name : '', autocomplete: 'off' }), pn = h('input', { id: 'fPn', inputmode: 'numeric', dir: 'ltr', value: s ? s.personal_number : '', maxlength: '12' }), gender = h('select', { id: 'fGender' }, [h('option', { value: 'M', text: 'זכר' }), h('option', { value: 'F', text: 'נקבה' })]);
    if (s) gender.value = s.gender; var pakal = h('input', { id: 'fPakal', value: s ? s.pakal : '' }), reason = h('input', { id: 'fReason' });
    var dep = h('select', { id: 'fDep' }, (S.org.departments || []).map(function (d) { return h('option', { value: d.id, text: d.name.replace(/\s*\(זמני\)/, '') }); })), team = h('select', { id: 'fTeam' });
    function teams() { team.replaceChildren.apply(team, (S.org.teams || []).filter(function (t) { return t.department_id === dep.value; }).map(function (t) { return h('option', { value: t.id, text: t.name.replace(/\s*\(זמני\)/, '') }); })); } dep.addEventListener('change', teams); teams();
    var fN = field('שם מלא', name), fP = field('מספר אישי', pn, 'ספרות בלבד, עד 12'), fG = field('מגדר', gender);
    f.append(fN, fP, h('div', { class: 'row2' }, [fG, field('פק״ל', pakal)]));
    if (!edit) f.append(h('div', { class: 'row2' }, [field('מחלקה', dep), field('צוות', team)])); else f.append(field('סיבת העריכה', reason, 'חובה'));
    var save = h('button', { class: 'primary', type: 'submit', text: 'שמירה' }), cancel = h('button', { class: 'secondary', type: 'button', text: 'ביטול', onclick: function () { edit ? go('soldier/' + s.id) : go('soldiers'); } });
    f.append(msg, h('div', { class: 'btns' }, [save, cancel]));
    f.addEventListener('submit', function (e) {
      e.preventDefault(); clearErr(f); msg.className = ''; msg.textContent = ''; var bad = false;
      if (!name.value.trim()) { fieldErr(fN, 'שם מלא הוא שדה חובה.'); bad = true; } if (!/^\d{1,12}$/.test(pn.value.trim())) { fieldErr(fP, 'מספר אישי: ספרות בלבד (עד 12).'); bad = true; }
      if (edit && !reason.value.trim()) { fieldErr(reason.parentNode, 'יש לציין סיבה.'); bad = true; } if (bad) return; busy(save, true, 'שמירה');
      var data = { full_name: name.value.trim(), personal_number: pn.value.trim(), gender: gender.value, pakal: pakal.value.trim() }, p;
      if (edit) { var patch = {}; ['full_name', 'personal_number', 'gender', 'pakal'].forEach(function (k) { if (String(data[k]) !== String(s[k] || '')) patch[k] = data[k]; }); p = api('soldiers.update', { id: s.id, patch: patch, expected_updated_at: s.updated_at, reason: reason.value.trim() }); }
      else { data.department_id = dep.value; data.team_id = team.value; p = api('soldiers.create', { courseId: S.course.id, data: data }); }
      p.then(function (r) { busy(save, false, 'שמירה'); if (!r.ok) { msg.textContent = msgOf(r) + (r.code === 'CONFLICT' ? ' (חזרו לכרטיס לרענון)' : ''); msg.className = 'msg err'; return; } cache.soldiers = null; toast(edit ? 'נשמר' : 'החניך נוסף'); go('soldier/' + (r.data.id || s.id)); });
    });
    mount('soldiers', [h('button', { class: 'back', type: 'button', onclick: function () { cancel.click(); }, text: '→ חזרה' }), h('h1', { class: 'page', text: edit ? 'עריכת חניך' : 'הוספת חניך' }), f], edit ? 'עריכת חניך' : 'הוספת חניך');
  }

  /* ---------- FOLLOW-UPS & TASKS ---------- */
  function Tasks() {
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'סוג מעקב' }), body = h('div', { 'aria-live': 'polite' });
    function setSeg(v) { S.seg = v; seg.replaceChildren.apply(seg, segBtns()); load(); }
    function segBtns() { return [['tasks', 'משימות מישיבות'], ['follow', 'מעקבים אישיים']].map(function (p) { return h('button', { type: 'button', 'aria-pressed': S.seg === p[0] ? 'true' : 'false', text: p[1], onclick: function () { setSeg(p[0]); } }); }); }
    seg.replaceChildren.apply(seg, segBtns());
    mount('tasks', [sectionHead('מעקבים', 'נתונים סינתטיים'), seg, body], 'מעקבים');
    function load() {
      body.replaceChildren(skeleton(3));
      if (S.seg === 'follow') {
        Promise.all([api('followups.list', { courseId: S.course.id, opts: {} }), cache.soldiers ? Promise.resolve({ ok: true, data: cache.soldiers }) : api('soldiers.list', { courseId: S.course.id, opts: {} })]).then(function (r) {
          if (!r[0].ok) { body.replaceChildren(errBox(r[0], load)); return; } if (r[1].ok) cache.soldiers = r[1].data; var by = {}; (cache.soldiers || []).forEach(function (x) { by[x.id] = x; });
          var add = h('button', { class: 'primary', type: 'button', text: '+ מעקב חדש', onclick: function () { FollowForm(); } }), rows = r[0].data;
          body.replaceChildren(h('div', { class: 'btns', style: 'margin-top:0' }, [add]));
          if (!rows.length) { body.append(emptyBox('אין מעקבים אישיים. אפשר ליצור את הראשון.')); return; }
          rows.forEach(function (f) { var who = by[f.soldier_id], st = f.status === 'open' ? status('פתוח', true) : status(f.status === 'done' ? 'הושלם' : 'בוטל');
            body.append(card(f.what_to_check, (who ? who.full_name : 'חניך') + (f.due_date ? ' · עד ' + f.due_date : ''), st, f.status === 'open' ? function () { dialog('עדכון מעקב', [h('p', { text: f.what_to_check, class: 'muted' })], function (msg) { return api('followups.update', { id: f.id, patch: { status: 'done' } }).then(function (x) { if (!x.ok) { msg.textContent = msgOf(x); msg.className = 'msg err'; return false; } toast('המעקב סומן כהושלם'); load(); }); }, 'סימון כהושלם'); } : null)); });
        });
      } else {
        api('tasks.list', { courseId: S.course.id, opts: {} }).then(function (r) {
          if (!r.ok) { body.replaceChildren(errBox(r, load)); return; } var rows = r.data.tasks || []; body.replaceChildren();
          body.append(h('p', { class: 'muted', text: 'פתוחות ' + r.data.counts.open + ' · בטיפול ' + r.data.counts.in_progress + ' · באיחור ' + r.data.counts.overdue }));
          if (!rows.length) { body.append(emptyBox('אין משימות. משימות נוצרות בסיכום ישיבה.')); return; }
          rows.forEach(function (t) { body.append(card(t.title, (t.assignee_name || t.assignee_email || '') + (t.due_date ? ' · ' + t.due_date : ''), status(taskLabel(t.status), t.status === 'open' || t.overdue), function () { TaskStatus(t); })); });
        });
      }
    }
    load();
  }
  function taskLabel(s) { return { open: 'פתוחה', in_progress: 'בטיפול', waiting: 'ממתינה', completed: 'הושלמה', cancelled: 'בוטלה' }[s] || s; }
  function TaskStatus(t) {
    var sel = h('select', { id: 'tsel' }, ['open', 'in_progress', 'waiting', 'completed', 'cancelled'].map(function (v) { return h('option', { value: v, text: taskLabel(v) }); })); sel.value = t.status; var note = h('textarea', { id: 'tnote' });
    dialog(t.title, [field('סטטוס', sel), field('הערה', note)], function (msg) { return api('tasks.setStatus', { id: t.id, status: sel.value, note: note.value, expected_version: t.version }).then(function (x) { if (!x.ok) { msg.textContent = msgOf(x); msg.className = 'msg err'; return false; } toast('הסטטוס עודכן'); Tasks(); }); }, 'עדכון');
  }
  function FollowForm() {
    var f = h('form', { novalidate: 'true' }), msg = h('div', { role: 'alert' }), sol = h('select', { id: 'fuS' }, [h('option', { value: '', text: 'בחרו חניך…' })].concat((cache.soldiers || []).filter(function (x) { return x.active; }).map(function (x) { return h('option', { value: x.id, text: x.full_name }); })));
    var what = h('input', { id: 'fuW' }), due = h('input', { id: 'fuD', type: 'date' }), save = h('button', { class: 'primary', type: 'submit', text: 'שמירה' }); var a = field('חניך', sol), b = field('מה לבדוק', what), c = field('תאריך', due);
    f.append(a, b, c, msg, h('div', { class: 'btns' }, [save, h('button', { class: 'secondary', type: 'button', text: 'ביטול', onclick: function () { go('tasks'); } })]));
    f.addEventListener('submit', function (e) { e.preventDefault(); clearErr(f); var bad = false; if (!sol.value) { fieldErr(a, 'יש לבחור חניך.'); bad = true; } if (!what.value.trim()) { fieldErr(b, 'יש לציין מה לבדוק.'); bad = true; } if (bad) return; busy(save, true, 'שמירה');
      var data = { soldier_id: sol.value, what_to_check: what.value.trim() }; if (due.value) data.due_date = due.value;
      api('followups.create', { courseId: S.course.id, data: data }).then(function (r) { busy(save, false, 'שמירה'); if (!r.ok) { msg.textContent = msgOf(r); msg.className = 'msg err'; return; } toast('המעקב נשמר'); S.seg = 'follow'; go('tasks'); }); });
    mount('tasks', [h('button', { class: 'back', type: 'button', onclick: function () { go('tasks'); }, text: '→ חזרה' }), h('h1', { class: 'page', text: 'מעקב חדש' }), f], 'מעקב חדש');
  }

  /* ---------- MORE ---------- */
  var DOMAINS = [
    ['ביצוע ומעקב', [['👥', 'חניכים', 'כרטיסים, הוספה, עריכה, ביטול ושחזור', 'soldiers', true], ['☑', 'מעקבים ומשימות', 'מעקבים אישיים, משימות מישיבות', 'tasks', true], ['📅', 'נוכחות ואירועים', 'אירועים, היעדרויות, יציאות מוקדמות', 'd/attendance', true], ['⚠', 'התראות', 'התראות פתוחות וטיפול בהן', 'alerts', true], ['🏃', 'כשירות גופנית', 'הזנת מבחן וציונים', 'd/fitness', true], ['🧭', 'ניווט', 'מבחני ניווט', 'd/nav', true], ['🎯', 'קליעה', 'תוצאות קליעה', 'd/mk', true], ['📝', 'מבחנים עיוניים', 'ניסיונות ותוצאות', 'd/exams', true], ['🥾', 'מסעות', 'מסעות ותוצאות', 'd/marches', true], ['🩺', 'כשירות מבצעית', 'סטטוס כשירות ומגבלות', 'd/readiness', true], ['🏅', 'אירועים והישגים', 'אירועים והישגים לחניך', 'd/events', true], ['🎖', 'הסמכות', 'הגדרת הסמכות ויעדים', 'd/qual', true], ['🗒', 'הערות פרטיות', 'הערות מפקד', 'd/notes', true]]],
    ['דוחות ונתונים', [['📊', 'תמונת מצב קבוצתית', 'מדדים ברמת קבוצה בלבד', null, false], ['📄', 'דוחות וייצוא', 'תצוגה מקדימה וייצוא למנהל', null, false], ['📎', 'מסמכים וראיות', 'העלאה, קישור ואישור', null, false], ['✉', 'טפסי חיילים', 'קישורי טפסים ואישור עדכונים', null, false]]],
    ['ניהול', [['🏫', 'קורסים', 'יצירה, ארכוב, פתיחה מחדש', null, false], ['🔐', 'משתמשים וקורסים', 'משתמשים, תפקידים וקורס חדש', 'd/admin', true], ['🧩', 'מחלקות, צוותים ושיוך מפקדים', 'מבנה ארגוני והרשאות', null, false], ['⚙', 'הגדרות', 'פרמטרים מקצועיים והיסטוריה', null, false], ['💾', 'גיבוי ושחזור', 'גיבוי, אימות ושחזור', null, false], ['📥', 'ייבוא ו-OCR', 'ייבוא קבצים וטיוטות OCR', null, false]]]
  ];
  function More() {
    var nodes = [sectionHead('עוד', null)], q = h('input', { class: 'search', type: 'search', placeholder: 'חיפוש תחום…', 'aria-label': 'חיפוש תחום', autocomplete: 'off' }), out = h('div', { 'aria-live': 'polite' });
    if (S.courses.length > 1) { var sel = h('select', { id: 'courseSel', 'aria-label': 'קורס' }, S.courses.map(function (c) { return h('option', { value: c.id, text: c.name }); })); sel.value = S.course.id; sel.addEventListener('change', function () { S.course = S.courses.filter(function (c) { return c.id === sel.value; })[0]; cache.soldiers = null; loadContext().then(function () { toast('הקורס הוחלף'); More(); }); }); nodes.push(field('קורס פעיל', sel)); }
    nodes.push(q, out);
    function draw() {
      var t = q.value.trim(); out.replaceChildren();
      DOMAINS.forEach(function (g) { var items = g[1].filter(function (i) { return !t || (i[1] + ' ' + i[2]).includes(t); }); if (!items.length) return; out.append(sectionHead(g[0], null));
        items.forEach(function (i) { var right = i[4] ? h('span', { class: 'arrow', text: '←' }) : h('span', { class: 'badge', text: 'בהכנה' });
          var d = h('div', { class: 'tile' }, [h('i', { text: i[0], 'aria-hidden': 'true' }), h('div', {}, [h('h3', { text: i[1] }), h('p', { text: i[4] ? i[2] : i[2] + ' · טרם הועבר למסך מובנה' })])]);
          var b = h('button', { class: 'card' + (i[4] ? '' : ' off'), type: 'button', 'aria-disabled': i[4] ? null : 'true', onclick: function () { if (i[4]) go(i[3]); else toast('המסך הזה עדיין בהכנה', 'err'); } }, [d, right]); out.append(b); }); });
      if (!out.children.length) out.append(emptyBox('לא נמצא תחום תואם.'));
    }
    q.addEventListener('input', draw); draw();
    var foot = h('div', {}, [sectionHead('מידע', null), card('התקנה במסך הבית', 'Safari ← שיתוף ← הוסף למסך הבית', h('span', { text: '📱' })), card('סביבת הדגמה', 'ללא התחברות, ללא שרת, ללא נתוני אמת — הנתונים נשמרים במכשיר הזה בלבד', h('span', { text: '🛡️' })),
      h('div', { class: 'btns' }, [h('button', { class: 'secondary', type: 'button', text: 'איפוס הדגמה', onclick: function () { dialog('איפוס נתוני הדגמה', [h('p', { text: 'כל הנתונים שהוזנו במכשיר הזה יימחקו ויוחזרו נתוני הדגמה מקוריים.' })], function () { C.reset(); }, 'איפוס', true); } }), h('button', { class: 'secondary', id: 'refresh-app', type: 'button', text: 'בדיקת עדכון', onclick: function () { if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(function (registration) { return registration?.update(); }).finally(function () { var url = new URL(location.href); url.searchParams.set('v', String(Date.now())); location.replace(url); }); else location.reload(); } })]),
      h('p', { class: 'muted', text: 'הגרסה המחוברת תדרוש הרשמה ואישור מנהל, הרשאות צד שרת ואבטחת PIN. אלה אינם חלק מהדגמה זו.' })]);
    mount('more', nodes.concat([foot]), 'עוד');
  }

  /* ---------- ATTENDANCE (read) & ALERTS (read) ---------- */
  function Attendance() {
    var body = h('div', { 'aria-live': 'polite' }); mount('more', [h('button', { class: 'back', type: 'button', onclick: function () { go('more'); }, text: '→ חזרה ל"עוד"' }), sectionHead('נוכחות ואירועים', null), body], 'נוכחות');
    body.append(skeleton(3)); api('attendance.events', { courseId: S.course.id }).then(function (r) {
      if (!r.ok) { body.replaceChildren(errBox(r, Attendance)); return; } body.replaceChildren(); if (!r.data.length) { body.append(emptyBox('אין אירועי נוכחות. יצירת אירוע ורישום היעדרויות יועברו בשלב הבא.')); return; }
      r.data.slice(0, 50).forEach(function (e) { body.append(card(e.title || e.type || 'אירוע', (e.date || e.event_date || '') + (e.start_time ? ' · ' + e.start_time : ''), null)); });
    });
  }
  function Alerts() {
    var body = h('div', { 'aria-live': 'polite' }); mount('more', [h('button', { class: 'back', type: 'button', onclick: function () { go('more'); }, text: '→ חזרה ל"עוד"' }), sectionHead('התראות', null), body], 'התראות');
    body.append(skeleton(3)); api('alerts.list', { courseId: S.course.id, opts: {} }).then(function (r) {
      if (!r.ok) { body.replaceChildren(errBox(r, Alerts)); return; } var rows = r.data.alerts || r.data || []; body.replaceChildren(); if (!rows.length) { body.append(emptyBox('אין התראות פתוחות.')); return; }
      rows.slice(0, 50).forEach(function (a) { body.append(card(a.title || a.message || a.type || 'התראה', a.detail || a.soldier_name || '', status(a.severity === 'red' ? 'אדום' : 'צהוב', a.severity === 'red'))); });
    });
  }

/*DOMAINS*/
  /* ---------- router ---------- */
  var ROUTES = { home: Home, soldiers: Soldiers, tasks: Tasks, more: More, attendance: Attendance, alerts: Alerts, 'soldier-new': function () { SoldierForm(null); } };
  function render() {
    var r = (location.hash || '#/home').replace(/^#\//, ''), top = $('#ctx'); if (top) top.textContent = ctxLine();
    if (!S.course) { mount('home', [h('div', { class: 'empty', text: 'אין קורס. יש ליצור קורס במסך הניהול.' })]); return; }
    var m = /^soldier\/(.+)$/.exec(r); if (m) return SoldierCard(m[1]); var dm = /^d\/([a-z]+)(?:\/(\d+))?$/.exec(r); if (dm) return dm[2] === undefined ? Domain(dm[1]) : DomainForm(dm[1], +dm[2]); (ROUTES[r] || Home)();
  }
  document.querySelectorAll('.tab').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.go); }); });
  window.addEventListener('hashchange', render);
  window.__app = { api: api, state: S };
  view.replaceChildren(skeleton(3));
  C.ready.then(loadContext).then(function () { $('#ctx').textContent = ctxLine(); render(); }).catch(function (e) { view.replaceChildren(errBox(e && e.message ? e : { message: 'לא ניתן לטעון את האפליקציה.' }, function () { location.reload(); })); });
})();
