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
  /* connectivity: a saved-state is only ever shown after a real server answer; while offline say so, plainly */
  (function () { function sync() { var b = document.getElementById('offBar'); if (navigator.onLine === false) { if (!b) { b = document.createElement('div'); b.id = 'offBar'; b.setAttribute('role', 'status'); b.style.cssText = 'position:sticky;top:0;z-index:30;background:#9d202b;color:#fff;padding:8px 14px;text-align:center;font-size:14px'; b.textContent = 'אין חיבור — שינויים לא יישמרו עד שהחיבור יחזור'; document.body.prepend(b); } } else if (b) b.remove(); } window.addEventListener('offline', sync); window.addEventListener('online', sync); })();
  function toast(msg, kind) { var o = $('.toast'); if (o) o.remove(); var t = h('div', { class: 'toast', role: kind === 'err' ? 'alert' : 'status', text: msg }); if (kind === 'err') t.style.background = '#9d202b'; document.body.append(t); clearTimeout(toastT); toastT = setTimeout(function () { t.remove(); }, 3200); }
  var GW = { pending: ['GET', '/admin/pending', 'pending'], users: ['GET', '/admin/users', 'users'], approve: ['POST', '/admin/approve'], reject: ['POST', '/admin/reject'], revoke: ['POST', '/admin/revoke'], 'set-scope': ['POST', '/admin/set-scope'], 'set-active': ['POST', '/admin/set-active'], reset: ['POST', '/admin/reset'], seed: ['POST', '/admin/seed-synthetic'] };
  function api(m, a, src) { if (m.indexOf('gw:') === 0) { var g = GW[m.slice(3)]; return C.gw(g[0], g[1], a).then(function (r) { if (r && r.ok && g[2]) return { ok: true, data: r[g[2]] || [] }; return r; }); }
    return C.api(m, a, src).catch(function () { return { ok: false, code: 'NETWORK', message: 'אין תקשורת. נסו שוב.' }; }); }
  function msgOf(r) { return (r && r.message) || 'הפעולה נכשלה.'; }
  function isAdmin() { return S.who && S.who.role === 'admin'; }
  function skeleton(n) { var w = h('div', { 'aria-busy': 'true', 'aria-label': 'טוען' }); for (var i = 0; i < (n || 3); i++) w.append(h('div', { class: 'skeleton' })); return w; }
  function sectionHead(title, aside, id) { return h('div', { class: 'section' }, [h('h2', { text: title, id: id }), aside ? h('span', { class: 'count', text: aside }) : null]); }
  function card(title, sub, right, onclick) { var d = h('div', {}, [h('h3', { text: title }), sub ? h('p', { text: sub }) : null]); var b = h(onclick ? 'button' : 'div', { class: 'card', type: onclick ? 'button' : null, onclick: onclick }, [d, right]); return b; }
  function status(text, warn) { return h('span', { class: 'status' + (warn ? ' warn' : ''), text: text }); }
  function emptyBox(t) { return h('div', { class: 'empty', text: t }); }
  function errBox(r, retry) { return h('div', {}, [h('div', { class: 'msg err', role: 'alert', text: msgOf(r) }), retry ? h('button', { class: 'secondary', type: 'button', onclick: retry, text: 'נסו שוב' }) : null]); }
  function go(route) { if (bulkLeave && bulkLeave.dirty()) { leaveAsk(function () { bulkLeave = null; go(route); }); return; } if (location.hash !== '#/' + route) location.hash = '#/' + route; else { forceTop = true; render(); } }
  function leaveAsk(cont) { dialog('שינויים שלא נשמרו', [h('p', { text: 'הוזנו נתונים שעדיין לא נשמרו. לעזוב את המסך בלי לשמור?' })], function () { cont(); return true; }, 'עזיבה בלי לשמור', true); }
  window.addEventListener('beforeunload', function (e) { if (bulkLeave && bulkLeave.dirty()) { e.preventDefault(); e.returnValue = ''; } });
  function setTab(name) { document.querySelectorAll('.tab').forEach(function (b) { if (b.dataset.go === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); }
  /* gentle scroll reveal for content BELOW the fold only (never hides what is already visible; fail-safe un-hides everything after 1.5 s; none under reduced motion) */
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, rvIO = null, rvT = null;
  function reveal() { if (REDUCED || !('IntersectionObserver' in window)) return; if (!rvIO) rvIO = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('rv-in'); rvIO.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    [].slice.call(view.querySelectorAll('.card,.stat,.section,dl.kv')).forEach(function (el) { if (el.dataset.rv || el.getBoundingClientRect().top < innerHeight) return; el.dataset.rv = '1'; el.classList.add('rv-init'); rvIO.observe(el); });
    clearTimeout(rvT); rvT = setTimeout(function () { [].slice.call(view.querySelectorAll('.rv-init')).forEach(function (el) { el.classList.add('rv-in'); }); }, 1500); }
  /* Navigation feel: per-route scroll memory (back / tab return restore, a new screen starts at the top), route-enter only for deeper screens, reveal wired once per mount (no observers on every DOM change). */
  var scrollMem = Object.create(null), curKey = null, navPop = false, forceTop = false, userScrolled = false, ROOTS = /^#\/(home|soldiers|entry|followups|tasks|more)?$/;
  var navSeq = 0, riT = null, wasMounted = false;   // a fragment navigation also fires popstate, so traversal (Back/Forward) is detected from history.state: entries we have already rendered carry {mv}, a freshly pushed one has none
  ['wheel', 'touchmove', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { userScrolled = true; }, { passive: true }); });
  function restoreScroll(y) { userScrolled = false; var n = 0; (function step() { if (userScrolled) return; window.scrollTo(0, y); if (++n < 5 && Math.abs(window.scrollY - y) > 2) setTimeout(step, n * 120); })(); }
  function mount(tab, nodes, title) {
    var key = location.hash || '#/home', changed = key !== curKey, deeper = /^#\/(soldier|d)\//.test(key), pop = navPop, top = forceTop, keep = window.scrollY; navPop = false; forceTop = false;
    bulkLeave = null;   // a group-entry screen re-arms its own guard right after mounting
    document.querySelectorAll('dialog.closing').forEach(function (x) { if (x._rawClose) x._rawClose(); });   // a sheet that was closing for a route change must not keep the page inert (modal) after the new screen is in
    view.replaceChildren.apply(view, nodes.filter(Boolean)); setTab(tab); document.title = (title ? title + ' · ' : '') + 'MASLUL 2027'; var hd = view.querySelector('h1,h2'); if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); }
    if (changed || top) { var y = !top && (pop || ROOTS.test(key)) ? scrollMem[key] || 0 : 0; window.scrollTo(0, 0); if (y > 0) restoreScroll(y); }
    else if (keep > 0) restoreScroll(keep);   // same route re-rendered in place (reload after a save / a filter): keep the position while the async content grows back
    curKey = key;
    view.classList.remove('route-in', 'rt-push', 'rt-pop', 'rt-tab'); clearTimeout(riT);
    /* ONE uniform, direction-aware route motion (transform-only, never a blank/translucent frame): push into a deeper screen / back out of it / switch tab. The first paint and an in-place re-render (same route) never animate. */
    if (changed && !top && wasMounted && !REDUCED) { void view.offsetWidth; view.classList.add('route-in', pop ? 'rt-pop' : deeper ? 'rt-push' : 'rt-tab'); riT = setTimeout(function () { view.classList.remove('route-in', 'rt-push', 'rt-pop', 'rt-tab'); }, 280); }
    wasMounted = true;
    if (!REDUCED) requestAnimationFrame(reveal);
  }
  function field(label, input, hint) { var id = input.id || (input.id = 'f' + Math.random().toString(36).slice(2, 8)); return h('div', { class: 'field' }, [h('label', { for: id, text: label }), input, hint ? h('div', { class: 'hint', text: hint }) : null]); }
  function fieldErr(f, text) { f.classList.add('err'); var e = f.querySelector('.errmsg'); if (!e) { e = h('div', { class: 'errmsg', role: 'alert' }); f.append(e); } e.textContent = text; }
  function clearErr(form) { form.querySelectorAll('.field.err').forEach(function (f) { f.classList.remove('err'); var e = f.querySelector('.errmsg'); if (e) e.remove(); }); }
  function busy(btn, on, label) { btn.disabled = on; if (label) btn.textContent = on ? 'שומר…' : label; btn.setAttribute('aria-busy', on ? 'true' : 'false'); }
  /* ---------- sheets / dialogs: ONE close contract for every popup (X, backdrop, Esc, device Back, Cancel; unsaved-change guard; scroll position untouched) ---------- */
  var dlgSeq = 0;
  function dlgHead(h2, d) { return h('div', { class: 'dlg-head' }, [h2, h('button', { class: 'dlg-x', type: 'button', 'aria-label': 'סגירת החלון', text: '✕', onclick: function () { d._req(); } })]); }
  function dlgKit(d, f, lockBtn) {
    var edited = false, asking = false, downOut = false, bar = null;
    function fields() { return [].slice.call(f.elements).filter(function (el) { return /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.type !== 'hidden' && el.type !== 'button' && el.type !== 'submit'; }); }
    function snap() { return fields().map(function (el) { return el.type === 'checkbox' || el.type === 'radio' ? (el.checked ? 1 : 0) : el.value; }).join('\u0001'); }
    var base = snap();
    ['pointerdown', 'focusin', 'keydown'].forEach(function (ev) { f.addEventListener(ev, function () { if (!edited) base = snap(); }, true); });   // the baseline is the state just before the person's first edit (fields may arrive asynchronously)
    ['input', 'change'].forEach(function (ev) { f.addEventListener(ev, function () { edited = true; }, true); });
    function dirty() { return edited && snap() !== base; }
    d._clean = function () { edited = false; base = snap(); };
    function out(e) { var r = d.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; }
    function ask() {
      if (asking) return; asking = true; var keep = h('button', { type: 'button', class: 'primary', text: 'המשך עריכה' }), drop = h('button', { type: 'button', class: 'secondary', text: 'סגירה בלי לשמור' });
      bar = h('div', { class: 'dlg-confirm', role: 'alertdialog', 'aria-label': 'שינויים שלא נשמרו' }, [h('p', { text: 'יש שינויים שלא נשמרו. לסגור בלי לשמור?' }), h('div', { class: 'btns' }, [keep, drop])]);
      var btns = f.querySelector(':scope > .btns'); if (btns) f.insertBefore(bar, btns); else f.append(bar);
      keep.onclick = function () { asking = false; bar.remove(); bar = null; var first = fields()[0]; if (first) first.focus({ preventScroll: true }); };
      drop.onclick = function () { asking = false; if (bar) bar.remove(); bar = null; d._edited = false; d.close(); };
      try { bar.scrollIntoView({ block: 'nearest' }); } catch (e) {} keep.focus({ preventScroll: true });
    }
    d._req = function () { if (lockBtn && lockBtn.disabled) return; if (asking) return; if (dirty()) ask(); else d.close(); };
    d.addEventListener('cancel', function (e) { e.preventDefault(); d._req(); });   // Escape
    d.addEventListener('pointerdown', function (e) { downOut = e.target === d && out(e); });
    d.addEventListener('click', function (e) { if (e.target === d && downOut && out(e)) d._req(); downOut = false; });   // backdrop only; a click inside never closes
    d._hash = location.hash;
  }
  /* device Back while a sheet is open: no extra history entry is ever added (so no race with programmatic navigation). Back lands on the previous entry; we put the person straight back
     (forward) without re-rendering the route, then close the sheet or ask about unsaved changes. */
  var dlgGuard = { skip: 0, rev: false, idx: null, mv: 0 };
  function entryIdx() { try { return window.navigation && navigation.currentEntry ? navigation.currentEntry.index : null; } catch (e) { return null; } }
  window.addEventListener('popstate', function () {
    var d = document.querySelector('dialog[open]'), now = entryIdx(), was = dlgGuard.idx, st = history.state; dlgGuard.idx = now;
    if (dlgGuard.rev) { dlgGuard.rev = false; return; }
    var back0 = now !== null && was !== null ? now < was : !!(st && st.mv && st.mv < dlgGuard.mv);
    if (!d && bulkLeave && bulkLeave.dirty() && back0) { var target = location.hash; dlgGuard.skip = 2; dlgGuard.rev = true; setTimeout(function () { dlgGuard.skip = 0; dlgGuard.rev = false; }, 700); try { history.forward(); } catch (e) { dlgGuard.skip = 0; dlgGuard.rev = false; } leaveAsk(function () { bulkLeave = null; location.hash = target; }); return; }
    if (!d || !d._req) return;
    var back = now !== null && was !== null ? now < was : !!(st && st.mv && st.mv < dlgGuard.mv);   // a fragment navigation (link / go()) also fires popstate: only a real step BACK is the device Back button
    if (!back) return;
    if (location.hash !== d._hash) { dlgGuard.skip = 2; dlgGuard.rev = true; setTimeout(function () { dlgGuard.skip = 0; dlgGuard.rev = false; }, 700); try { history.forward(); } catch (e) { dlgGuard.skip = 0; dlgGuard.rev = false; } }
    d._req();
  });
  function dialog(title, bodyNodes, onOk, okLabel, danger) {
    var opener = document.activeElement, d = h('dialog', { 'aria-labelledby': 'dlgT' }), f = h('form', { method: 'dialog' }), msg = h('div', { role: 'alert' });
    var ok = h('button', { class: danger ? 'danger' : 'primary', type: 'submit', text: okLabel || 'אישור' }), cancel = h('button', { class: 'secondary', type: 'button', text: 'ביטול', onclick: function () { d._req(); } });
    f.append(dlgHead(h('h2', { id: 'dlgT', text: title }), d), h('div', {}, bodyNodes), msg, h('div', { class: 'btns' }, [ok, cancel])); d.append(f); document.body.append(d);
    var rawClose = d.close.bind(d); d._rawClose = rawClose; d.close = function () { if (REDUCED || !d.open || d.classList.contains('closing')) return rawClose(); d.classList.add('closing'); setTimeout(rawClose, 110); };
    dlgKit(d, f, ok);
    f.addEventListener('submit', function (e) { e.preventDefault(); msg.textContent = ''; msg.className = ''; busy(ok, true); Promise.resolve(onOk(msg)).then(function (done) { if (done === false) busy(ok, false); else d.close(); }); });
    d.addEventListener('close', function () { d.remove(); if (opener && opener.isConnected && typeof opener.focus === 'function') { try { opener.focus({ preventScroll: true }); } catch (e) {} } }); d.showModal(); return d;
  }

  /* ---------- context ---------- */
  function loadContext() {
    return Promise.all([api('whoAmI'), api('courses.list', {})]).then(function (r) {
      if (!r[0].ok) throw r[0]; S.who = r[0].data; S.courses = r[1].ok ? r[1].data : [];
      if (!S.course || !S.courses.some(function (c) { return c.id === S.course.id; })) S.course = S.courses[0] || null;
      if (!S.course) return null; return api('courses.org', { courseId: S.course.id }).then(function (o) { S.org = o.ok ? o.data : { departments: [], teams: [] }; return api('assignments.mine', { courseId: S.course.id }).then(function (m) { S.mine = m.ok ? m.data : null; }); });
    });
  }
  function ctxLine() { if (C.mode === 'server') return 'מסלול 2027 · סביבת בדיקה פרטית · נתונים סינתטיים' + (C.me && C.me.role === 'viewer' ? ' · צפייה בלבד' : ''); return 'פיילוט מסלול 2027 · סביבת תצוגה בלבד'; }
  function depName(id) { var d = ((S.org || {}).departments || []).filter(function (x) { return x.id === id; })[0]; return d ? d.name.replace(/\s*\(זמני\)/, '') : ''; }

  /* ---------- HOME (smart) ---------- */
  /* insightProvider: replaceable generative layer — OFF by default. When enabled it may receive ONLY groupSafePayload(items) (titles/text/N/window of
     group-level insights already filtered by the server's N>=5 rules): no names, IDs, free-text notes or operational records. No external provider is connected. */
  var SRC = { NavigationTests: 'ניווט', MarksmanshipTests: 'קליעה', FitnessTests: 'כש״ג', TheoreticalExamAttempts: 'מבחנים', Soldiers: 'חניכים', AttendanceEvents: 'אירועי נוכחות', AttendanceRecords: 'נוכחות', Marches: 'מסעות' };
  var INSIGHT = { enabled: false, name: null };
  function groupSafePayload(items) { return (items || []).map(function (i) { return { kind: i.kind, title: i.title, text: i.text, n: i.n, window: i.window }; }); }
  function hhmm(iso) { try { var d = new Date(iso); return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function parseTrend(it) { var m = /הוא ([\d.\-]+) לעומת ([\d.\-]+) בחודש ([\d-]+) \(([+\-]?[\d.]+)\)/.exec(it.text || ''); return m ? { b: +m[1], a: +m[2], delta: m[4], from: m[3] } : null; }
  function miniChart(t) { var mx = Math.max(t.a, t.b, 1), W = 120, H = 34, svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="ממוצע קודם ' + t.a + ', נוכחי ' + t.b + '"><rect x="4" y="' + (H - 4 - (t.a / mx) * (H - 8)) + '" width="40" height="' + ((t.a / mx) * (H - 8)) + '" rx="4" fill="#cce5e4"/><rect x="64" y="' + (H - 4 - (t.b / mx) * (H - 8)) + '" width="40" height="' + ((t.b / mx) * (H - 8)) + '" rx="4" fill="#007f83"/></svg>', w = document.createElement('span'); w.innerHTML = svg; return w; }
  var CTA = { followups: ['d/none', 'followups', 'למעקבים'], coverage: 'd/insights', trend: 'd/insights', attendance: 'd/attendance', group_gap: 'd/insights', distribution: 'd/insights' };
  function insightCard(o) { var b = h('div', { class: 'card', style: 'display:block' }, [h('h3', { text: o.title }), h('p', { text: o.text, style: 'line-height:1.6;margin:6px 0' }), o.chart || null, h('p', { class: 'muted', text: o.meta || '', style: 'margin:6px 0 8px' }), h('button', { class: 'secondary', type: 'button', text: o.cta + ' ←', onclick: function () { go(o.go); } })]); return b; }
  function Home() {
    var kp = [h('div', { class: 'stat' }, [h('strong', { text: '…', id: 'k1' }), h('small', { text: 'חניכים' })]), h('div', { class: 'stat' }, [h('strong', { text: '…', id: 'k2' }), h('small', { text: 'מעקבים פתוחים' })]), h('div', { class: 'stat' }, [h('strong', { text: '…', id: 'k3' }), h('small', { text: 'התראות פתוחות' })])];
    var today = h('div', { id: 'today', 'aria-busy': 'true' }, skeleton(2)), brief = h('div', { id: 'brief', 'aria-busy': 'true' }, skeleton(1)), more = h('div', { id: 'deep' }), ask = h('div', { id: 'askbox' }), upd = h('span', { class: 'count', id: 'upd', text: 'נתוני הדגמה' });
    mount('home', [
      h('div', { class: 'hero' }, [h('small', { text: 'בוקר טוב 👋' }), h('h1', { text: 'הכול ברור. אפשר להתקדם.' }), h('p', { id: 'heroWhy', text: 'מסך בית שמציג את הפעולה החשובה הבאה, בלי לחפש בין עשרות תפריטים.' }), h('button', { class: 'primary', id: 'heroCta', type: 'button', onclick: function () { go('soldiers'); }, text: 'מעבר לרשימת החניכים ←' })]),
      sectionHead('תמונת מצב', 'נתוני הדגמה'), h('div', { class: 'stats' }, kp),
      h('div', { id: 'lastAct', 'aria-live': 'polite', style: 'min-height:88px' }),
      h('div', { class: 'section' }, [h('h2', { text: 'מה חשוב לדעת היום' }), upd]), today,
      sectionHead('תמונת מצב פיקודית', null), brief, more, ask,
      sectionHead('גישה מהירה', 'הכי שימושי'),
      card('חיפוש חניך', 'מוצאים אדם בשניות', h('span', { class: 'arrow', text: '←' }), function () { go('soldiers'); }),
      card('מעקבים לטיפול', 'מה צריך לעשות היום?', h('span', { class: 'arrow', text: '←' }), function () { go('followups'); }),
      (C.mode === 'server' && C.role === 'viewer') ? null : card('אירוע נוכחות חדש', 'בחרו סוג פעילות וסמנו רק את החניכים שחסרים', h('span', { class: 'arrow', text: '←' }), function () { go('d/attendance/0'); }),
      (C.mode === 'server' && C.role === 'viewer') ? null : card('מסע חדש', 'מזינים פרטי מסע ובוחרים מי חסר', h('span', { class: 'arrow', text: '←' }), function () { go('d/marches/0'); }),
      (C.mode === 'server' && !isAdmin()) ? null : card('הוספת חניך', 'כרטיס חדש בכמה שניות', h('span', { class: 'arrow', text: '←' }), function () { go('soldier-new'); })
    ].filter(Boolean), 'בית');
    if (!S.course) return;
    var cid = S.course.id, st = { soldiers: null, follow: 0, tasks: 0, overdue: 0, alerts: null };
    function setK(sel, t) { var e = $(sel); if (e) e.textContent = t; }   // the home view may already be gone when a slow answer arrives (user navigated / logged out)
    var pS = api('soldiers.list', { courseId: cid, opts: { active: true } }).then(function (r) { st.soldiers = r.ok ? r.data.length : null; setK('#k1', r.ok ? String(r.data.length) : '—'); });
    var pF = Promise.all([api('followups.list', { courseId: cid, opts: {} }), api('tasks.indicators', { courseId: cid })]).then(function (r) { st.follow = r[0].ok ? r[0].data.filter(function (x) { return x.status === 'open'; }).length : 0; st.tasks = r[1].ok ? (r[1].data.my_open || 0) : 0; st.overdue = r[1].ok ? (r[1].data.my_overdue || r[1].data.overdue || 0) : 0; setK('#k2', (r[0].ok || r[1].ok) ? String(st.follow + st.tasks) : '—'); });
    var pA = api('alerts.counts', { courseId: cid }).then(function (r) { st.alerts = r.ok ? r.data.open : null; var k = $('#k3'); if (!k) return; k.textContent = r.ok ? String(r.data.open) : '—'; if (r.ok && r.data.red > 0) k.style.color = '#c52d36'; });
    /* live strip: the newest event / march as saved on the server (counts only inside the caller's scope; suppressed small groups stay hidden) */
    Promise.all([api('attendance.events', { courseId: cid, opts: {} }), api('marches.list', { courseId: cid })]).then(function (r) {
      var box = $('#lastAct'); if (!box) return; var line = function (t, x, date) { return x.counts_suppressed ? t + ' · ' + fmtD(date) + ' · מוסתר (קבוצה קטנה)' : t + ' · ' + fmtD(date) + ' · נוכחים ' + (x.present !== undefined ? x.present : x.participants) + ' מתוך ' + x.total; };
      var ev = r[0].ok && r[0].data[0], mr = r[1].ok && r[1].data[0], rows = [];
      if (ev) rows.push(line('אירוע נוכחות אחרון: ' + (ev.type_name || ''), ev, ev.event_date)); if (mr) rows.push(line('מסע אחרון: ' + (mr.location || ''), mr, mr.march_date));
      if (!rows.length) rows.push('אין עדיין אירוע נוכחות או מסע להצגה.'); box.replaceChildren(h('div', { class: 'card', role: 'group', 'aria-label': 'פעילות אחרונה', style: 'display:block;margin:8px 0;min-height:72px;box-sizing:border-box' }, rows.map(function (t) { return h('p', { class: 'muted', style: 'margin:3px 0', text: t }); })));
    });
    var pI = api('analytics.insights', { courseId: cid, f: {} });
    Promise.all([pS, pF, pA, pI]).then(function (all) {
      var ins = all[3], items = [], reason = '', gen = '';
      if (ins.ok) { items = ins.data.items || []; gen = ins.data.generated_at; if (ins.data.small_group) reason = 'אין עדיין מספיק נתונים לניתוח (קבוצה קטנה מ-5 — מוסתר מטעמי פרטיות).'; } else reason = ins.code === 'FORBIDDEN' ? 'אין הרשאה לתובנות.' : 'התובנות אינן זמינות כרגע. ' + msgOf(ins);
      if (gen) upd.textContent = 'עודכן ' + hhmm(gen);
      /* ONE contextual next action (counts are the same group/role-scoped numbers shown in the tiles above; no names, no per-person data) */
      (function () { var b = $('#heroCta'), w = $('#heroWhy'); if (!b) return; var t = null;
        if (st.overdue > 0) t = { why: st.overdue + ' משימות באיחור דורשות טיפול.', text: 'לטיפול במשימות באיחור ←', go: 'mgmt' };
        else if (st.follow + st.tasks > 0) t = { why: 'יש ' + (st.follow + st.tasks) + ' מעקבים/משימות פתוחים.', text: 'לטיפול במעקבים הפתוחים ←', go: 'followups' };
        else if (st.alerts > 0) t = { why: st.alerts + ' התראות פתוחות.', text: 'לצפייה בהתראות ←', go: 'd/alerts' };
        if (!t) return; b.textContent = t.text; b.onclick = function () { go(t.go); }; if (w) w.textContent = t.why; })();
      var by = function (k) { return items.filter(function (i) { return i.kind === k; }); };
      var cards = [];
      if (st.follow + st.tasks + st.overdue > 0) cards.push({ title: 'יש מעקבים פתוחים', text: st.follow + ' מעקבים אישיים' + (st.tasks ? ' ו-' + st.tasks + ' משימות פתוחות' : '') + (st.overdue ? ' (' + st.overdue + ' באיחור)' : '') + ' ממתינים לטיפול.', meta: 'מקור: מעקבים ומשימות · עודכן עכשיו', cta: 'למעקבים', go: 'followups' });
      by('coverage').slice(0, 1).forEach(function (i) { cards.push({ title: i.title, text: i.text.length > 150 ? i.text.slice(0, 147) + '…' : i.text, meta: 'N=' + i.n + ' · ' + (gen ? 'עודכן ' + hhmm(gen) : ''), cta: 'להשלמת נתונים', go: 'more' }); });
      by('trend').sort(function (x, y) { var a = parseTrend(x), b = parseTrend(y); return Math.abs(b ? +b.delta : 0) - Math.abs(a ? +a.delta : 0); }).slice(0, 1).forEach(function (i) { var t = parseTrend(i); cards.push({ title: i.title, text: i.text, chart: t ? miniChart(t) : null, meta: 'חלון ' + (i.window.from || '') + '–' + (i.window.to || '') + ' · N=' + i.n + ' · פרשנות תיאורית, לא סיבתית', cta: 'לכל התובנות', go: 'd/insights' }); });
      if (cards.length < 3) by('attendance').slice(0, 1).forEach(function (i) { cards.push({ title: i.title, text: i.text, meta: 'N=' + i.n, cta: 'לנוכחות', go: 'd/attendance' }); });
      today.replaceChildren(); today.setAttribute('aria-busy', 'false');
      if (!cards.length) today.append(emptyBox(reason || 'אין כרגע פריטים הדורשים תשומת לב.')); else { cards.slice(0, 3).forEach(function (c) { today.append(insightCard(c)); }); if (reason) today.append(h('p', { class: 'muted', role: 'status', text: reason })); }
      /* command summary — fixed, verified templates only */
      brief.replaceChildren(); brief.setAttribute('aria-busy', 'false');
      if (!items.length) { brief.append(emptyBox(reason || 'אין עדיין מספיק נתונים לניתוח.')); }
      else {
        var parts = [(st.soldiers !== null ? 'בקורס ' + st.soldiers + ' חניכים פעילים. ' : '')];
        by('trend').forEach(function (i) { parts.push(i.text + ' '); }); by('attendance').slice(0, 1).forEach(function (i) { parts.push(i.text + ' '); });
        parts.push('פתוחים כעת: ' + (st.follow + st.tasks) + ' מעקבים/משימות' + (st.alerts !== null ? ' ו-' + st.alerts + ' התראות' : '') + '.');
        var cov = by('coverage')[0]; if (cov) parts.push(' כדאי לבדוק היום: ' + cov.title + '.');
        var from = items.map(function (i) { return i.window && i.window.from; }).filter(Boolean).sort()[0], to = items.map(function (i) { return i.window && i.window.to; }).filter(Boolean).sort().pop(), nmin = Math.min.apply(null, items.map(function (i) { return i.n || 0; }).filter(Boolean));
        brief.append(h('div', { class: 'card', style: 'display:block' }, [h('p', { text: parts.join('').trim(), style: 'line-height:1.7;margin:0 0 8px' }), h('p', { class: 'muted', style: 'margin:0', text: 'חלון: ' + (from || '—') + '–' + (to || '—') + ' · N≥' + (isFinite(nmin) ? nmin : '—') + ' · מקור: ' + Array.from(new Set([].concat.apply([], items.map(function (i) { return (i.source || []).map(function (x) { return SRC[x] || x; }); })))).join(', ') + ' · נבנה מתבניות וכללים קבועים (לא AI גנרטיבי). זו פרשנות תיאורית; אינה קובעת סיבה ואינה הערכה אישית.' })]));
      }
      /* all insights (expandable) */
      var det = h('details', { class: 'card', style: 'display:block' }, [h('summary', { text: 'מגמות וניתוח — לכל התובנות (' + items.length + ')', style: 'font-weight:800;min-height:44px;display:flex;align-items:center;cursor:pointer' })]);
      if (!items.length) det.append(h('p', { class: 'muted', text: reason || 'אין תובנות להצגה.' }));
      items.forEach(function (i) { var t = i.kind === 'trend' ? parseTrend(i) : null; det.append(h('div', { style: 'border-top:1px solid #e6e9eb;padding:10px 0' }, [h('h3', { text: i.title, style: 'margin:0 0 4px;font-size:14px' }), h('p', { text: i.text, style: 'margin:0 0 4px;font-size:13px;line-height:1.6' }), t ? miniChart(t) : null, h('p', { class: 'muted', style: 'margin:4px 0 0;font-size:12px', text: 'N=' + i.n + ' · מקור: ' + (i.source || []).map(function (x) { return SRC[x] || x; }).join(', ') + (i.caveat ? ' · הסתייגות: ' + i.caveat : '') + (i.formula ? ' · נוסחה: ' + i.formula : '') })])); });
      var sup = ins.ok ? (ins.data.suppressed || []) : []; if (sup.length) det.append(h('p', { class: 'muted', style: 'font-size:12px', text: 'לא מוצג (' + sup.length + '): ' + sup.slice(0, 4).map(function (x) { return x.reason; }).join(' | ') }));
      more.replaceChildren(det);
    });
    /* ask the system — rule-based assistant, not generative AI */
    ask.append(sectionHead('שאל את המערכת', 'עוזר תובנות מבוסס נתונים'));
    var qi = h('input', { class: 'search', id: 'askq', type: 'search', placeholder: 'למשל: מה נוכחות?', 'aria-label': 'שאלה לעוזר התובנות', maxlength: '500' }), out = h('div', { 'aria-live': 'polite', id: 'askout' }), chips = h('div', { class: 'filters' });
    function doAsk(q) { if (!q.trim()) return; out.replaceChildren(skeleton(1)); api('ai.ask', { courseId: cid, question: q, include_private: false }).then(function (r) { out.replaceChildren(); if (!r.ok) { out.append(errBox(r)); return; } var d = r.data, box = h('div', { class: 'card', style: 'display:block' }); (d.facts || []).forEach(function (f) { box.append(h('p', { text: f.text, style: 'margin:0 0 6px' })); }); if (!(d.facts || []).length) box.append(h('p', { text: d.note || 'לא נמצאה תשובה.', style: 'margin:0 0 6px' })); box.append(h('p', { class: 'muted', style: 'margin:6px 0 0;font-size:12px', text: 'מקור: ' + ((d.sources || []).join(', ') || '—') + ' · עודכן ' + hhmm(new Date().toISOString()) + ' · עוזר מבוסס כללים; אין בו מודל שפה.' })); out.append(box); }); }
    ['כמה חיילים בקורס?', 'מה נוכחות?', 'מה מצב ההתראות?'].forEach(function (q) { chips.append(h('button', { class: 'chip', type: 'button', text: q, onclick: function () { qi.value = q; doAsk(q); } })); });
    var af = h('form', { novalidate: 'true' }, [qi, h('button', { class: 'secondary', type: 'submit', text: 'שאלו', style: 'margin-top:8px' })]); af.addEventListener('submit', function (e) { e.preventDefault(); doAsk(qi.value); });
    ask.append(chips, af, out);
  }

  /* ---------- TRAINEES ---------- */
  var cache = { soldiers: null };
  function Soldiers() {
    var q = h('input', { class: 'search', id: 'q', type: 'search', placeholder: 'חיפוש לפי שם, מספר אישי או מחלקה…', 'aria-label': 'חיפוש חניכים', autocomplete: 'off', value: S.q }), list = h('div', { id: 'people', 'aria-live': 'polite' }), count = h('span', { class: 'count', id: 'count', text: '' });
    var chips = h('div', { class: 'filters', role: 'group', 'aria-label': 'סינון לפי מחלקה' });
    function chip(label, val) { return h('button', { class: 'chip' + (S.filter === val ? ' active' : ''), type: 'button', 'aria-pressed': S.filter === val ? 'true' : 'false', onclick: function () { S.filter = val; chips.replaceChildren.apply(chips, mk()); draw(); } , text: label }); }
    function mk() { return [chip('הכול', 'all')].concat(((S.org || {}).departments || []).map(function (d) { return chip(d.name.replace(/\s*\(זמני\)/, ''), d.id); })); }
    chips.replaceChildren.apply(chips, mk());
    var head = h('div', { class: 'section' }, [h('h2', { text: 'חניכים' }), count]);
    mount('soldiers', [head, (C.mode === 'server' && !isAdmin()) ? null : h('div', { class: 'btns', style: 'margin:0 0 10px' }, [h('button', { class: 'primary', type: 'button', text: '+ הוספת חניך', onclick: function () { go('soldier-new'); } })]), (C.mode === 'server' && !isAdmin()) ? null : h('div', { class: 'btns', style: 'margin:0 0 10px' }, [h('button', { class: 'secondary', type: 'button', id: 'fuLink', text: '☑ מעקבים אישיים', onclick: function () { go('followups'); } })]), q, chips, list], 'חניכים');
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
      var priv = h('div', { id: 'priv' }, skeleton(1)), progBox = h('div', { id: 'progBox' }, skeleton(1)), emBox = h('div', { id: 'emBox' }), fuBox = (C.mode === 'server' && !isAdmin()) ? null : h('div', { id: 'fuCardBox' }, skeleton(1)); mount('soldiers', [h('button', { class: 'back', type: 'button', onclick: function () { go('soldiers'); }, text: '→ חזרה לרשימה' }), h('div', { class: 'section' }, [h('h2', { text: s.full_name }), cancelled ? status('מבוטל', true) : status(s.active ? 'פעיל' : 'לא פעיל', !s.active)]), h('div', { class: 'card', style: 'display:block' }, [kv]), isAdmin() ? emBox : null, btns, progBox].filter(Boolean).concat(extra, [fuBox, priv]).filter(Boolean), s.full_name); if (isAdmin()) emergencyBlock(s, emBox); SoldierExtras(s, priv, cancelled); soldierProgress(s, progBox); if (fuBox) soldierFollowups(s, fuBox, cancelled);
    });
  }
  /* ---------- soldier card extras (batch 4): reassign / active, private notes, assessments, favourite, emergency contact ---------- */
  /* personal follow-ups of ONE soldier, inside his card (same followups.* API; the global list is under חניכים ← מעקבים אישיים) */
  function soldierFollowups(s, box, cancelled) {
    function load() {
      box.replaceChildren(sectionHead('מעקבים אישיים', null), skeleton(1));
      api('followups.list', { courseId: S.course.id, opts: {} }).then(function (r) {
        box.replaceChildren(sectionHead('מעקבים אישיים', null));
        if (!r.ok) { box.append(r.code === 'FORBIDDEN' ? emptyBox('אין הרשאה לצפות במעקבים אישיים.') : errBox(r, load)); return; }
        var mine = (r.data || []).filter(function (f) { return f.soldier_id === s.id; });
        if (!cancelled) box.append(h('div', { class: 'btns', style: 'margin-top:0' }, [h('button', { class: 'secondary', type: 'button', id: 'fuCardAdd', text: '+ מעקב חדש לחניך', onclick: function () { go('followup-new/' + s.id); } })]));
        if (!mine.length) { box.append(emptyBox('אין מעקבים אישיים לחניך זה.')); return; }
        mine.forEach(function (f) { box.append(card(f.what_to_check, f.due_date ? 'עד ' + f.due_date : null, f.status === 'open' ? status('פתוח', true) : status(f.status === 'done' ? 'הושלם' : 'בוטל'), null)); });
      });
    }
    load();
  }
  function SoldierExtras(s, box, cancelled) {
    var cid = S.course.id, reload = function () { SoldierCard(s.id); };
    box.replaceChildren(sectionHead('פעולות נוספות', null));
    var bar = h('div', { class: 'btns', style: 'margin-top:0' }); box.append(bar);
    if (isAdmin()) bar.append(h('button', { class: 'secondary', type: 'button', id: 'favBtn', text: '☆ מועדף', onclick: function (e) { var b = e.currentTarget; busy(b, true); api('favorites.toggle', { courseId: cid, soldierId: s.id }).then(function (r) { busy(b, false); if (!r.ok) { toast(msgOf(r), 'err'); return; } toast(r.data && r.data.favorite ? 'נוסף למועדפים' : 'הוסר מהמועדפים'); b.textContent = (r.data && r.data.favorite ? '★' : '☆') + ' מועדף'; }); } }));
    if (isAdmin()) api('favorites.list', { courseId: cid }).then(function (r) { if (r.ok && (r.data || []).some(function (f) { return f.soldier_id === s.id; })) $('#favBtn').textContent = '★ מועדף'; });
    if (!cancelled) {
      bar.append(h('button', { class: 'secondary', type: 'button', text: 'שינוי שיוך', onclick: function () {
        var dep = h('select', { id: 'rsDep' }, ((S.org || {}).departments || []).map(function (d) { return h('option', { value: d.id, text: d.name.replace(/\s*\(זמני\)/, '') }); })), team = h('select', { id: 'rsTeam' }), rs = h('input', { id: 'rsWhy' }), ex = h('input', { id: 'rsEx', type: 'checkbox', style: 'width:auto;min-height:24px' });
        function teams() { team.replaceChildren.apply(team, (S.org.teams || []).filter(function (t) { return t.department_id === dep.value; }).map(function (t) { return h('option', { value: t.id, text: t.name.replace(/\s*\(זמני\)/, '') }); })); } dep.value = s.department_id; dep.addEventListener('change', teams); teams(); team.value = s.team_id;
        dialog('שינוי שיוך חניך', [field('מחלקה', dep), field('צוות', team), field('סיבה (חובה)', rs), field('חריג מאושר (אחרי תחילת הקורס)', ex)], function (msg) { if (!rs.value.trim()) { msg.textContent = 'יש לציין סיבה.'; msg.className = 'msg err'; return false; } return api('soldiers.reassign', { id: s.id, target: { department_id: dep.value, team_id: team.value, approved_exception: ex.checked }, expected_updated_at: s.updated_at, reason: rs.value.trim() }).then(function (x) { if (!x.ok) { msg.textContent = msgOf(x) + (x.code === 'CONFLICT' ? ' — רעננו את הכרטיס.' : ''); msg.className = 'msg err'; return false; } cache.soldiers = null; toast('השיוך עודכן'); reload(); }); }, 'שמירה'); } }));
    }
    bar.append(h('button', { class: 'secondary', type: 'button', text: s.active ? 'סימון כלא פעיל' : 'סימון כפעיל', onclick: function () { var rs = h('input', { id: 'saWhy' }); dialog(s.active ? 'סימון כלא פעיל' : 'סימון כפעיל', [field('סיבה (חובה)', rs)], function (msg) { if (!rs.value.trim()) { msg.textContent = 'יש לציין סיבה.'; msg.className = 'msg err'; return false; } return api('soldiers.setActive', { id: s.id, active: !s.active, expected_updated_at: s.updated_at, reason: rs.value.trim() }).then(function (x) { if (!x.ok) { msg.textContent = msgOf(x) + (x.code === 'CONFLICT' ? ' — רעננו את הכרטיס.' : ''); msg.className = 'msg err'; return false; } cache.soldiers = null; toast('הסטטוס עודכן'); reload(); }); }, 'שמירה', !s.active ? false : true); } }));
    /* private notes */
    var nb = h('div', { id: 'notesBox' }), ab = h('div', { id: 'assessBox' }); if (isAdmin()) box.append(sectionHead('הערות פרטיות', null), nb); box.append(sectionHead('הערכות מפקד', null), ab);
    function loadNotes() { api('notes.list', { courseId: cid, soldierId: s.id }).then(function (r) { nb.replaceChildren(h('button', { class: 'secondary', type: 'button', text: '+ הערה פרטית', onclick: function () { var ta = h('textarea', { id: 'pnTxt' }); dialog('הערה פרטית', [field('הערה', ta)], function (msg) { if (!ta.value.trim()) { msg.textContent = 'הערה ריקה.'; msg.className = 'msg err'; return false; } return api('notes.save', { courseId: cid, data: { soldier_id: s.id, note_text: ta.value.trim() } }).then(function (x) { if (!x.ok) { msg.textContent = msgOf(x); msg.className = 'msg err'; return false; } toast('נשמר'); loadNotes(); }); }, 'שמירה'); } })); if (!r.ok) { nb.append(errBox(r)); return; } if (!(r.data || []).length) nb.append(emptyBox('אין הערות.')); (r.data || []).forEach(function (n) { nb.append(card(n.note_text, fmtD(n.created_at) + (n.revision > 1 ? ' · גרסה ' + n.revision : ''), null)); }); }); }
    function loadAssess() { api('assess.list', { courseId: cid, soldierId: s.id }).then(function (r) { ab.replaceChildren(h('button', { class: 'secondary', type: 'button', text: '+ הערכה', onclick: function () { var st = h('textarea', { id: 'asSt' }), im = h('textarea', { id: 'asIm' }), dm = h('input', { id: 'asDm' }); dialog('הערכת מפקד', [field('חוזקות', st), field('נקודות לשיפור', im), field('תחום', dm)], function (msg) { if (!st.value.trim() && !im.value.trim()) { msg.textContent = 'נדרשת חוזקה או נקודה לשיפור.'; msg.className = 'msg err'; return false; } return api('assess.add', { courseId: cid, data: { soldier_id: s.id, strengths: st.value.trim(), improvement_areas: im.value.trim(), domain: dm.value.trim() } }).then(function (x) { if (!x.ok) { msg.textContent = msgOf(x); msg.className = 'msg err'; return false; } toast('נשמר'); loadAssess(); }); }, 'שמירה'); } })); if (!r.ok) { ab.append(errBox(r)); return; } if (!(r.data || []).length) ab.append(emptyBox('אין הערכות.')); (r.data || []).forEach(function (a) { ab.append(card((a.domain || 'הערכה') + ' · ' + fmtD(a.assessment_date), [a.strengths && 'חוזקות: ' + a.strengths, a.improvement_areas && 'לשיפור: ' + a.improvement_areas].filter(Boolean).join(' | '), null)); }); }); }
    if (isAdmin()) loadNotes(); loadAssess();
    bar.append(h('button', { class: 'secondary', type: 'button', id: 'privFile', text: 'תיק פרטי מאוחד', onclick: function () { var out = h('div', { 'aria-live': 'polite' }, [skeleton(2)]); dialog('תיק פרטי — ' + s.full_name, [out], function () { }, 'סגירה'); api('soldiers.private', { courseId: cid, soldierId: s.id }).then(function (r) { out.replaceChildren(); if (!r.ok) { out.append(errBox(r)); return; } var d = r.data || {}; out.append(h('p', { class: 'muted', text: 'מידע אישי — מוצג רק כאן, אינו נכלל בסיכומים קבוצתיים.' }), h('h3', { text: 'מועדף: ' + (d.favorite ? 'כן' : 'לא') }), h('h3', { text: 'הערות פרטיות (' + (d.notes || []).length + ')' })); (d.notes || []).forEach(function (n) { out.append(h('p', { text: (n.created_at ? String(n.created_at).slice(0, 10) + ' · ' : '') + (n.text || n.note || '') })); }); out.append(h('h3', { text: 'מעקבים אישיים (' + (d.follow_ups || []).length + ')' })); (d.follow_ups || []).forEach(function (f) { out.append(h('p', { text: f.what_to_check + (f.due_date ? ' · עד ' + String(f.due_date).slice(0, 10) : '') + ' · ' + ({ open: 'פתוח', done: 'הושלם', cancelled: 'בוטל' }[f.status] || f.status) })); }); out.append(h('h3', { text: 'הערכות מפקד (' + (d.assessments || []).length + ')' })); (d.assessments || []).forEach(function (a) { out.append(h('p', { text: (a.text || a.note || a.assessment || '') })); }); }); } }));
  }
  /* Emergency contact — top of the soldier card, admin only (the server's emergency.get is private.read; nothing here widens access). A valid number gets a real tel: link: the phone's dialer opens on tap and the person confirms the call — nothing ever dials by itself. */
  function telHref(raw) { var d = String(raw || '').replace(/[\s\-().]/g, ''); return /^\+?\d{8,15}$/.test(d) ? 'tel:' + d : null; }
  window.__telHref = telHref;   // test hook (pure function)
  function emergencyBlock(s, host) {
    var cid = S.course.id;
    function load() { host.replaceChildren(h('div', { class: 'skeleton', style: 'height:56px' })); api('emergency.get', { courseId: cid, soldierId: s.id }).then(function (r) {
      host.replaceChildren(); if (!r.ok) { host.append(errBox(r, load)); return; } var d = r.data, tel = d.present ? telHref(d.phone) : null;
      var edit = function () { var nm = h('input', { id: 'emN', value: d.name }), rl = h('input', { id: 'emR', value: d.relation }), ph = h('input', { id: 'emP', value: d.phone, inputmode: 'tel', dir: 'ltr' }); dialog('איש קשר לחירום', [field('שם', nm), field('קרבה', rl), field('טלפון', ph)], function (msg) { return api('emergency.set', { courseId: cid, soldierId: s.id, contact: { name: nm.value.trim(), relation: rl.value.trim(), phone: ph.value.trim() } }).then(function (x) { if (!x.ok) { msg.textContent = msgOf(x); msg.className = 'msg err'; return false; } toast('נשמר'); load(); }); }, 'שמירה'); };
      host.append(h('div', { class: 'section' }, [h('h2', { text: 'איש קשר לחירום' }), h('span', { class: 'count', text: 'מנהל בלבד' })]));
      host.append(h('button', { class: 'card', type: 'button', onclick: edit }, [h('div', {}, [h('h3', { text: d.present ? d.name + ' · ' + d.relation : 'לא הוזן איש קשר' }), h('p', { text: d.present ? '' : 'ניתן להזין שם, קרבה וטלפון', dir: 'auto' }), d.present ? h('p', { class: 'em-phone', dir: 'ltr', style: 'text-align:start;font-weight:700;color:#161b20', text: d.phone_display || d.phone }) : null]), h('span', { class: 'arrow', text: d.present ? '✎' : '+' })]));
      if (d.present && tel) host.append(h('div', { class: 'btns', style: 'margin:6px 0 0' }, [h('a', { class: 'primary em-call', id: 'emCall', href: tel, role: 'button', 'aria-label': 'התקשרות אל ' + d.name + ' (' + d.relation + ')', text: '📞 התקשרות' })]));
      else if (d.present) host.append(h('p', { class: 'notice', role: 'status', id: 'emBad', text: 'מספר הטלפון שהוזן אינו תקין — אי אפשר לחייג. אפשר לתקן בעריכה.' }));
    }); }
    load();
  }
  function reasonDialog(title, required, run) {
    var ta = h('textarea', { id: 'reason', 'aria-required': required ? 'true' : 'false' });
    dialog(title, [field(required ? 'סיבה (חובה)' : 'סיבה (לא חובה)', ta)], function (msg) { if (required && !ta.value.trim()) { msg.textContent = 'יש לציין סיבה.'; msg.className = 'msg err'; return false; } return run(ta.value.trim(), msg); }, 'אישור', required);
  }
  function SoldierForm(s) {
    var edit = !!s, f = h('form', { novalidate: 'true' }), msg = h('div', { role: 'alert' });
    var name = h('input', { id: 'fName', value: s ? s.full_name : '', autocomplete: 'off' }), pn = h('input', { id: 'fPn', inputmode: 'numeric', dir: 'ltr', value: s ? s.personal_number : '', maxlength: '12' }), gender = h('select', { id: 'fGender' }, [h('option', { value: 'M', text: 'זכר' }), h('option', { value: 'F', text: 'נקבה' })]);
    if (s) gender.value = s.gender; var pakal = h('input', { id: 'fPakal', value: s ? s.pakal : '' }), reason = h('input', { id: 'fReason' });
    var dep = h('select', { id: 'fDep' }, ((S.org || {}).departments || []).map(function (d) { return h('option', { value: d.id, text: d.name.replace(/\s*\(זמני\)/, '') }); })), team = h('select', { id: 'fTeam' });
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
    /* The "מעקבים" tab shows ONLY trainee follow-ups. Management tasks live in "ניהול וישיבות" (#/mgmt) and never mix with trainee data. */
    var body = h('div', { 'aria-live': 'polite', id: 'fuBody' });
    mount('soldiers', [h('button', { class: 'back', type: 'button', id: 'fuBack', onclick: function () { go('soldiers'); }, text: '→ חזרה לחניכים' }), sectionHead('מעקבים אישיים', 'מעקבי חניכים · נתונים סינתטיים'), body], 'מעקבים אישיים'); S.reloadTasks = function () { load(); };
    function load() {
      body.replaceChildren(skeleton(3));
      Promise.all([api('followups.list', { courseId: S.course.id, opts: {} }), cache.soldiers ? Promise.resolve({ ok: true, data: cache.soldiers }) : api('soldiers.list', { courseId: S.course.id, opts: {} })]).then(function (r) {
        if (!r[0].ok) { if (r[0].code === 'FORBIDDEN') { body.replaceChildren(emptyBox('מעקבי חניכים זמינים לבעלי הרשאה מתאימה בלבד. המשימות שלך מופיעות ב״ניהול וישיבות״.'), h('div', { class: 'btns' }, [h('button', { class: 'primary', type: 'button', id: 'fuToMgmt', text: 'מעבר ל״ניהול וישיבות״', onclick: function () { go('mgmt'); } })])); return; } body.replaceChildren(errBox(r[0], load)); return; } if (r[1].ok) cache.soldiers = r[1].data; var by = {}; (cache.soldiers || []).forEach(function (x) { by[x.id] = x; });
        var add = h('button', { class: 'primary', type: 'button', id: 'fuAdd', text: '+ מעקב חדש', onclick: function () { FollowForm(); } }), rows = r[0].data;
        body.replaceChildren(h('div', { class: 'btns', style: 'margin-top:0' }, [add]));
        if (!rows.length) { body.append(emptyBox('אין מעקבים אישיים. אפשר ליצור את הראשון.')); return; }
        rows.forEach(function (f) { var who = by[f.soldier_id], st = f.status === 'open' ? status('פתוח', true) : status(f.status === 'done' ? 'הושלם' : 'בוטל');
            body.append(card(f.what_to_check, (who ? who.full_name : 'חניך') + (f.due_date ? ' · עד ' + f.due_date : ''), st, f.status === 'open' ? function () { dialog('עדכון מעקב', [h('p', { text: f.what_to_check, class: 'muted' })], function (msg) { return api('followups.update', { id: f.id, patch: { status: 'done' } }).then(function (x) { if (!x.ok) { msg.textContent = msgOf(x); msg.className = 'msg err'; return false; } toast('המעקב סומן כהושלם'); load(); }); }, 'סימון כהושלם'); } : null)); });
        });
    }
    load();
  }
  function taskLabel(s) { return { open: 'פתוחה', in_progress: 'בטיפול', waiting: 'ממתינה', completed: 'הושלמה', cancelled: 'בוטלה' }[s] || s; }
  function TaskStatus(t) {
    var sel = h('select', { id: 'tsel' }, ['open', 'in_progress', 'waiting', 'completed', 'cancelled'].map(function (v) { return h('option', { value: v, text: taskLabel(v) }); })); sel.value = t.status; var note = h('textarea', { id: 'tnote' });
    var det = h('div', { 'aria-live': 'polite' }); api('tasks.get', { id: t.id }).then(function (r) { if (!r.ok) return; var d = r.data || {}; det.append(h('p', { class: 'muted', text: (d.assignee_email || t.assignee_email || '') + (d.due_date ? ' · עד ' + String(d.due_date).slice(0, 10) : '') + (d.notes ? ' · ' + d.notes : '') })); (d.history || []).slice(0, 5).forEach(function (e) { det.append(h('p', { class: 'muted', text: (e.at ? String(e.at).slice(0, 10) + ' · ' : '') + (e.to_status || e.status || '') + (e.note ? ' — ' + e.note : '') })); }); });
    if (t.meeting_id && D.meetings) det.append(h('button', { class: 'secondary', type: 'button', id: 'taskMeeting', text: 'פתיחת סיכום הישיבה' + (t.meeting_subject ? ': ' + t.meeting_subject : ''), onclick: function () { document.querySelectorAll('dialog').forEach(function (x) { x.close(); }); D.meetings.lists[0].click({ id: t.meeting_id, subject: t.meeting_subject || 'סיכום', meeting_at: '' }); } }));
    dialog(t.title, [det, field('סטטוס', sel), field('הערה', note)], function (msg) { return api('tasks.setStatus', { id: t.id, status: sel.value, note: note.value, expected_version: t.version }).then(function (x) { if (!x.ok) { msg.textContent = msgOf(x); msg.className = 'msg err'; return false; } toast('הסטטוס עודכן'); Tasks(); }); }, 'עדכון');
  }
  function FollowForm(presetSoldier) {
    var f = h('form', { novalidate: 'true' }), msg = h('div', { role: 'alert' }), sol = h('select', { id: 'fuS' }, [h('option', { value: '', text: 'בחרו חניך…' })].concat((cache.soldiers || []).filter(function (x) { return x.active; }).map(function (x) { return h('option', { value: x.id, text: x.full_name }); })));
    if (presetSoldier) sol.value = presetSoldier; var what = h('input', { id: 'fuW' }), due = h('input', { id: 'fuD', type: 'date' }), save = h('button', { class: 'primary', type: 'submit', text: 'שמירה' }); var a = field('חניך', sol), b = field('מה לבדוק', what), c = field('תאריך', due);
    f.append(a, b, c, msg, h('div', { class: 'btns' }, [save, h('button', { class: 'secondary', type: 'button', text: 'ביטול', onclick: function () { history.length > 1 ? history.back() : go('followups'); } })]));
    f.addEventListener('submit', function (e) { e.preventDefault(); clearErr(f); var bad = false; if (!sol.value) { fieldErr(a, 'יש לבחור חניך.'); bad = true; } if (!what.value.trim()) { fieldErr(b, 'יש לציין מה לבדוק.'); bad = true; } if (bad) return; busy(save, true, 'שמירה');
      var data = { soldier_id: sol.value, what_to_check: what.value.trim() }; if (due.value) data.due_date = due.value;
      api('followups.create', { courseId: S.course.id, data: data }).then(function (r) { busy(save, false, 'שמירה'); if (!r.ok) { msg.textContent = msgOf(r); msg.className = 'msg err'; return; } toast('המעקב נשמר'); S.seg = 'follow'; go(presetSoldier ? 'soldier/' + presetSoldier : 'followups'); }); });
    mount('soldiers', [h('button', { class: 'back', type: 'button', onclick: function () { history.length > 1 ? history.back() : go('followups'); }, text: '→ חזרה' }), h('h1', { class: 'page', text: 'מעקב חדש' }), f], 'מעקב חדש');
  }

  /* ---------- MORE ---------- */
  var DOMAINS = [
    ['ביצוע ומעקב', [['👥', 'חניכים', 'כרטיסים, הוספה, עריכה, ביטול ושחזור', 'soldiers', true], ['☑', 'מעקבי חניכים', 'מעקבים אישיים של חניכים', 'followups', true], ['📅', 'נוכחות ואירועים', 'אירועים, היעדרויות, יציאות מוקדמות', 'd/attendance', true], ['⚠', 'התראות', 'התראות פתוחות וטיפול בהן', 'd/alerts', true], ['🗓', 'ניהול וישיבות', 'סיכומי ישיבות, כל המשימות ומשימות באחריותי', 'mgmt', true], ['📊', 'לוח קורס', 'סקירה קבוצתית, מחלקות/צוותים והשוואת קורסים', 'd/dash', true], ['🧠', 'תמונת מצב קבוצתית', 'מדדים ותובנות ברמת קבוצה בלבד', 'd/insights', true], ['🏃', 'כשירות גופנית', 'הזנת מבחן וציונים', 'd/fitness', true], ['🧭', 'ניווט', 'מבחני ניווט', 'd/nav', true], ['🎯', 'קליעה', 'תוצאות קליעה', 'd/mk', true], ['📝', 'מבחנים עיוניים', 'ניסיונות ותוצאות', 'd/exams', true], ['🥾', 'מסעות', 'מסעות ותוצאות', 'd/marches', true], ['🩺', 'כשירות מבצעית', 'סטטוס כשירות ומגבלות', 'd/readiness', true], ['🏅', 'אירועים והישגים', 'אירועים והישגים לחניך', 'd/events', true], ['🎖', 'הסמכות', 'הגדרת הסמכות ויעדים', 'd/qual', true], ['🗒', 'הערות פרטיות', 'הערות מפקד', 'd/notes', true]]],
    ['דוחות ונתונים', [['📊', 'תובנות ודוחות', 'ניתוח אירוע ניווט, מגמות, PDF ו-Excel', 'insight', true], ['📄', 'דוחות וייצוא', 'תצוגה קבוצתית בלבד (N≥5); ייצוא חסום', 'd/reports', true], ['📎', 'ייבוא ומסמכים', 'ייבוא CSV עם תצוגה מקדימה, אישור וביטול', 'd/imports', true], ['📑', 'מסמכים וקישורים', 'בקשות קישור, אישורן וראיות להסמכות', 'd/docs', true], ['ℹ️', 'אודות / מידע מקצועי', 'טבלאות ניקוד כש״ג — לקריאה בלבד', 'd/fitref', true], ['🔎', 'OCR לבדיקה', 'טיוטות חילוץ ואישור שורה-שורה (מנהל)', 'd/ocr', true], ['✉', 'טפסי חיילים', 'קישורי טפסים ואישור עדכונים', 'd/forms', true], ['✔', 'תיקונים', 'בקשות תיקון ואישורן', 'd/corrections', true]]],
    ['ניהול', [['🏫', 'קורסים', 'יצירה, ארכוב, פתיחה מחדש', null, false], ['🔐', 'משתמשים וקורסים', 'משתמשים, תפקידים וקורס חדש', 'd/admin', true], ['🧩', 'שיוך מפקדים', 'שיוך מפקד לקורס, מחלקה או צוות', 'd/assign', true], ['🏷', 'שמות מחלקות וצוותים', 'שינוי שמות יחידות', 'd/org', true], ['⚙', 'הגדרות', 'פרמטרים מקצועיים והיסטוריה', 'd/settings', true], ['💾', 'גיבוי ובדיקות מערכת', 'גיבוי, Preflight', 'd/backup', true], ['📜', 'יומן פעולות', 'Audit', 'd/audit', true], ['📈', 'סיכומי תחומים', 'סיכומים קבוצתיים לכל תחום', 'd/summaries', true], ['🧮', 'גרסאות ניקוד כש״ג', 'טיוטה, אימות ואישור טבלאות', 'd/fitadmin', true], ['📥', 'ייבוא ו-OCR', 'ייבוא קבצים וטיוטות OCR', null, false]]]
  ];
  function More() {
    var nodes = [sectionHead('עוד', null)], q = h('input', { class: 'search', type: 'search', placeholder: 'חיפוש תחום…', 'aria-label': 'חיפוש תחום', autocomplete: 'off' }), out = h('div', { 'aria-live': 'polite' });
    if (S.courses.length > 1) { var sel = h('select', { id: 'courseSel', 'aria-label': 'קורס' }, S.courses.map(function (c) { return h('option', { value: c.id, text: c.name }); })); sel.value = S.course.id; sel.addEventListener('change', function () { S.course = S.courses.filter(function (c) { return c.id === sel.value; })[0]; cache.soldiers = null; loadContext().then(function () { toast('הקורס הוחלף'); More(); }); }); nodes.push(field('קורס פעיל', sel)); }
    nodes.push(q, out);
    function draw() {
      var t = q.value.trim(); out.replaceChildren();
      DOMAINS.forEach(function (g) { var items = g[1].filter(function (i) { return (i[3] !== 'd/access' || (C.mode === 'server' && isAdmin())) && (!t || (i[1] + ' ' + i[2]).includes(t)); }); if (!items.length) return; out.append(sectionHead(g[0], null));
        items.forEach(function (i) { var right = i[4] ? h('span', { class: 'arrow', text: '←' }) : h('span', { class: 'badge', text: 'בהכנה' });
          var d = h('div', { class: 'tile' }, [h('i', { text: i[0], 'aria-hidden': 'true' }), h('div', {}, [h('h3', { text: i[1] }), h('p', { text: i[4] ? i[2] : i[2] + ' · טרם הועבר למסך מובנה' })])]);
          var b = h('button', { class: 'card' + (i[4] ? '' : ' off'), type: 'button', 'aria-disabled': i[4] ? null : 'true', onclick: function () { if (i[4]) go(i[3]); else toast('המסך הזה עדיין בהכנה', 'err'); } }, [d, right]); out.append(b); }); });
      if (!out.children.length) out.append(emptyBox('לא נמצא תחום תואם.'));
    }
    q.addEventListener('input', draw); draw();
    if (C.mode === 'server') { var me = C.me || {}, RN = { admin: 'מנהל', commander: 'מפקד', viewer: 'צפייה בלבד', user: 'מפקד' };
      mount('more', nodes.concat([h('div', {}, [sectionHead('חשבון', null), card(me.name || 'משתמש', 'תפקיד: ' + (RN[me.role] || me.role) + (me.role === 'viewer' ? ' · אי אפשר לבצע שינויים' : ''), h('span', { text: '👤' })), card('סביבת בדיקה פרטית', 'נתונים סינתטיים בלבד · אין אימות בעלות על מספר הטלפון · לא לשימוש מבצעי', h('span', { text: '🛡️' })),
        h('div', { class: 'btns' }, [h('button', { class: 'secondary', id: 'logout', type: 'button', text: 'התנתקות', onclick: function () { C.logout(); } })])])]), 'עוד'); return; }
    var foot = h('div', {}, [sectionHead('מידע', null), card('התקנה במסך הבית', 'Safari ← שיתוף ← הוסף למסך הבית', h('span', { text: '📱' })), card('סביבת הדגמה', 'ללא התחברות, ללא שרת, ללא נתוני אמת — הנתונים נשמרים במכשיר הזה בלבד', h('span', { text: '🛡️' })),
      h('div', { class: 'btns' }, [h('button', { class: 'secondary', type: 'button', text: 'איפוס הדגמה', onclick: function () { dialog('איפוס נתוני הדגמה', [h('p', { text: 'כל הנתונים שהוזנו בדפדפן הזה יוחלפו בנתוני הדגמה מקוריים. לפני כן נשמר עותק אחד של המצב הנוכחי באותו דפדפן בלבד (לא בשרת ולא במכשיר אחר), וניתן לשחזר אותו מהמסך הזה. הגיבוי הוא תא יחיד: איפוס נוסף ידרוס אותו.' }), (C.hasPrev && C.hasPrev()) ? h('p', { class: 'msg err', role: 'alert', text: 'שימו לב: כבר קיים עותק קודם מהאיפוס האחרון, והאיפוס הזה יחליף אותו. כדי לשמור אותו, שחזרו אותו קודם או ייצאו לקובץ ממסך זה.' }) : null, h('p', { class: 'muted', text: 'לשמירה לטווח ארוך השתמשו ב"ייצוא נתוני הדגמה לקובץ" לפני האיפוס.' })], function () { C.reset(); }, 'איפוס (עם גיבוי)', true); } }), (C.hasPrev && C.hasPrev()) ? h('button', { class: 'secondary', type: 'button', id: 'demoRestore', text: 'שחזור לפני האיפוס האחרון', onclick: function () { C.restorePrev(); } }) : null, (C.exportData && C.mode !== 'server') ? h('button', { class: 'secondary', type: 'button', id: 'demoExport', text: 'ייצוא נתוני הדגמה לקובץ', onclick: function () { var d = C.exportData(); if (!d) { toast('אין נתונים לייצוא', 'err'); return; } var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([d], { type: 'application/json' })); a.download = 'maslul-demo-state.json'; a.rel = 'noopener'; document.body.append(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('הקובץ יורד'); } }) : null, h('button', { class: 'secondary', id: 'role-switch', type: 'button', text: 'תפקיד הדגמה: ' + (C.role === 'commander' ? 'מפקד' : 'מנהל') + ' — החלפה', onclick: function () { C.as(C.role === 'commander' ? 'admin' : 'commander'); } }), h('button', { class: 'secondary', id: 'refresh-app', type: 'button', text: 'בדיקת עדכון', onclick: function () { if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(function (registration) { return registration?.update(); }).finally(function () { var url = new URL(location.href); url.searchParams.set('v', String(Date.now())); location.replace(url); }); else location.reload(); } })]),
      h('p', { class: 'muted', text: 'הגרסה המחוברת תדרוש הרשמה ואישור מנהל, הרשאות צד שרת ואבטחת PIN. אלה אינם חלק מהדגמה זו.' })]);
    mount('more', nodes.concat([foot]), 'עוד');
  }

  /* ---------- ATTENDANCE (read) & ALERTS (read) ---------- */
  function Attendance() {
    /* One canonical attendance screen: the domain view already supports creating an event
       with a missing-trainee roster; never strand navigation in the old read-only prototype. */
    return Domain('attendance');
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
    if (curKey) scrollMem[curKey] = window.scrollY;
    navPop = !!(history.state && history.state.mv); try { history.replaceState({ mv: ++navSeq }, ''); } catch (e) {} dlgGuard.mv = navSeq; dlgGuard.idx = entryIdx();
    var r = (location.hash || '#/home').replace(/^#\//, ''), top = $('#ctx'); if (top) top.textContent = ctxLine();
    if (!S.course) { var adm = C.cf && isAdmin(), emp = [h('div', { class: 'hero' }, [h('small', { text: adm ? 'שלב ראשון' : 'ממתינים להגדרה' }), h('h1', { text: adm ? 'הסביבה מוכנה — חסר רק קורס' : 'עדיין אין קורס זמין עבורכם' }),
        h('p', { id: 'heroWhy', text: adm ? 'אין עדיין נתונים בסביבת הבדיקה המשותפת. טענו קורס סינתטי כדי שכל ארבע הלשוניות יתמלאו בנתונים מומצאים, ואז אפשר להזמין מפקדים.' : 'החשבון שלכם פעיל, אך המנהל טרם שייך אתכם לקורס. פנו אליו; לא נדרשת פעולה נוספת מצדכם.' })])];
      if (adm) { emp[0].append(h('button', { class: 'primary', id: 'seedBtn', type: 'button', text: 'טעינת קורס סינתטי (נתונים מומצאים בלבד)', onclick: function () { this.disabled = true; this.setAttribute('aria-busy', 'true'); var b = this; api('gw:seed', {}).then(function (x) { if (!x.ok) { b.disabled = false; b.removeAttribute('aria-busy'); toast(msgOf(x), 'err'); return; } toast('הקורס הסינתטי נטען'); location.reload(); }); } }));
        emp.push(sectionHead('מה יקרה אחרי הטעינה', null), card('חניכים וצוותים', 'רשימה, חיפוש וסינון לפי מחלקה', null), card('מעקבים ומסעות', 'משימות, מסע עם חסרים ועריכת משתתפים אחרי שמירה', null), card('הזמנת מפקדים', 'בלשונית "עוד" → אישור בקשות; כל מפקד רואה רק את הצוות שלו', null)); }
      mount('home', emp); return; }
    var m = /^soldier\/(.+)$/.exec(r); if (m) return SoldierCard(m[1]); var mt = /^meeting\/(.+)$/.exec(r); if (mt) return MeetingView(mt[1]); if (r === 'mgmt') return Mgmt(); if (r === 'entry') return EntryHub(); if (r === 'insight') return InsightHub(); var ie = /^insight\/exam\/([A-Za-z0-9-]+)$/.exec(r); if (ie) return ExamInsight(ie[1]); var ci = /^insight\/course(?:\/([a-z]+))?$/.exec(r); if (ci) return CourseInsight(ci[1] || 'all'); var ni = /^insight\/nav\/([^\/]+)\/(\d{4}-\d{2}-\d{2})(?:\/([^\/]+))?$/.exec(r); if (ni) return NavInsight(ni[1], ni[2], ni[3]); if (r === 'followups' || r === 'tasks') return Tasks(); var fn = /^followup-new\/(.+)$/.exec(r); if (fn) return FollowForm(fn[1]); var dm = /^d\/([a-z]+)(?:\/(\d+))?$/.exec(r); if (dm) return dm[2] === undefined ? Domain(dm[1]) : DomainForm(dm[1], +dm[2]); (ROUTES[r] || Home)();
  }
  /* Read warm-up (server mode only): the data a tab needs is requested on touch-down (before the click completes) and once when the app is ready; the client's short read memo hands it over, so the screen paints real content instead of a skeleton. Reads only, same arguments as the screens use. */
  var WARM = { soldiers: [['soldiers.list', { opts: {} }]], tasks: [['followups.list', { opts: {} }], ['tasks.list', { opts: {} }], ['soldiers.list', { opts: {} }]] };
  function warm(tab) { if (C.mode !== 'server' || !S.course || !WARM[tab]) return; WARM[tab].forEach(function (w) { var a = { courseId: S.course.id, opts: w[1].opts }; api(w[0], a, 'direct'); }); }
  document.querySelectorAll('.tab').forEach(function (b) { b.addEventListener('pointerdown', function () { warm(b.dataset.go); }, { passive: true }); b.addEventListener('click', function () { go(b.dataset.go); }); });
  window.addEventListener('hashchange', function () { if (dlgGuard.skip > 0) { dlgGuard.skip--; return; } render(); });
  window.__app = { api: function (m, a) { return api(m, a, 'direct'); },   /* test hook: calls through it are recorded as DIRECT (not UI) in the evidence ledger */ state: S, insightProvider: INSIGHT, groupSafePayload: groupSafePayload };
  view.replaceChildren(skeleton(3));
  C.ready.then(loadContext).then(function () { $('#ctx').textContent = ctxLine(); render(); setTimeout(function () { warm('soldiers'); warm('tasks'); }, 400); }).catch(function (e) { view.replaceChildren(errBox(e && e.message ? e : { message: 'לא ניתן לטעון את האפליקציה.' }, function () { location.reload(); })); });
})();
