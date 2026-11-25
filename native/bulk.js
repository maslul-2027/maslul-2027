  /* ============ SMART ENTRY — one shared "enter a whole group at once" screen (a dedicated work screen inside the existing navigation, never a popup per soldier) ============
     Config-driven: each module supplies its shared fields, per-soldier columns, validation and the EXISTING API calls (create / record.edit / correction.request). No new routes, no schema change.
     Honest limits: the server has no optimistic-lock or uniqueness rule, so before every save the screen re-reads the saved results (reconcile) and refuses to overwrite a result somebody else
     changed meanwhile; the writes are one request per record (NOT atomic) — the screen reports exactly which records were saved and which failed, and retries only the failed ones.
     Nothing sensitive is kept in browser storage: drafts live in memory only (a reload warns first). */
  var BULK = {};
  var bulkLeave = null;   // { dirty: fn } while a group-entry screen holds unsaved input
  function numParse(v) { var t = String(v === null || v === undefined ? '' : v).trim().replace(',', '.'); if (t === '') return { blank: true }; if (!/^-?\d+(\.\d+)?$/.test(t)) return { bad: true }; return { n: Number(t) }; }
  function cv(c, raw) { var t = String(raw === null || raw === undefined ? '' : raw).trim(); if (t === '') return null; if (c.t === 'sel' || c.t === 'txt') return t; if (c.t === 'time') return /^\d{1,3}:[0-5]\d$/.test(t) ? t : undefined; var p = numParse(t); return p.bad ? undefined : p.n; }   // null = empty, undefined = invalid
  function eqv(a, b) { return a === b || (a === null && b === null); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function BulkEntry(cfg) {
    if (C.mode === 'server' && C.role === 'viewer') return Domain(cfg.domain);
    var cid = S.course.id, sh = {}, rows = [], P = {}, existing = null, saving = false, filt = { q: '', dep: '', team: '', st: 'all' }, reason = '';
    var progress = h('div', { class: 'be-progress', id: 'beProgress', role: 'status', 'aria-live': 'polite' }), list = h('div', { class: 'be-list', id: 'beList' }), summary = h('div', { id: 'beSummary', 'aria-live': 'polite' });
    var shHost = h('div', { class: 'be-shared', id: 'beShared' }), holder = h('div', {}, skeleton(3));
    mount('more', [h('button', { class: 'back', type: 'button', onclick: function () { go(cfg.back); }, text: '→ חזרה' }), h('h1', { class: 'page', text: cfg.title }), holder], cfg.title);
    Promise.all([ensureSoldiers()].concat((cfg.pre || []).map(function (m) { return api(m, CID()).then(function (r) { P[m] = r.ok ? r.data : []; }); }))).then(build);
    function sols() { return (cache.soldiers || []).filter(function (x) { return x.active && x.record_status !== 'cancelled'; }); }
    function dirty() { if (saving) return false; return rows.some(function (r) { var k = statusOf(r).k; return k === 'new' || k === 'edited' || k === 'partial' || k === 'invalid' || k === 'failed' || (k === 'skip' && !r.rec); }); }
    function colVal(r, c) { return r.vals[c.n] === undefined ? '' : r.vals[c.n]; }
    function shared() { var o = {}; cfg.shared.forEach(function (f) { var el = $('#be_' + f.n); o[f.n] = el ? el.value : (sh[f.n] || ''); }); return o; }
    function sharedErr(o) { var e = ''; cfg.shared.forEach(function (f) { if (e) return; var v = o[f.n]; if (f.req && String(v).trim() === '') { e = 'יש למלא: ' + f.l; return; } if (f.t === 'number' && String(v).trim() !== '') { var p = numParse(v); if (p.bad) { e = f.l + ': ערך לא תקין'; return; } if (f.min !== undefined && p.n < f.min) e = f.l + ': מינימום ' + f.min; else if (f.max !== undefined && p.n > f.max) e = f.l + ': מקסימום ' + f.max; else if (f.int && !Number.isInteger(p.n)) e = f.l + ': מספר שלם'; else if (f.step && Math.abs(p.n / f.step - Math.round(p.n / f.step)) > 1e-9) e = f.l + ': בקפיצות של ' + f.step; } }); return e; }
    /* per-cell validation → message or '' */
    function cellErr(r, c, o) { var raw = colVal(r, c), v = cv(c, raw); if (v === null) return ''; if (c.t === 'txt') return c.max_len && v.length > c.max_len ? 'עד ' + c.max_len + ' תווים' : ''; if (c.t === 'sel') return c.o.some(function (x) { return x[0] === v; }) ? '' : 'ערך לא תקין'; if (v === undefined) return c.t === 'time' ? 'פורמט דק׳:שנ׳ (למשל 13:05)' : 'ערך לא תקין'; if (c.t === 'time') return ''; var min = c.min, max = typeof c.max === 'string' ? numParse(o[c.max]).n : c.max; if (min !== undefined && v < min) return 'מינימום ' + min; if (max !== undefined && max !== null && !isNaN(max) && v > max) return 'מקסימום ' + max; if (c.int && !Number.isInteger(v)) return 'מספר שלם'; return ''; }
    /* row status: saved | edited | new | partial | invalid | failed | skip | empty | locked */
    function statusOf(r) {
      var o = shared(), reqCols = cfg.cols.filter(function (c) { return c.req; }), filled = cfg.cols.filter(function (c) { return String(colVal(r, c)).trim() !== ''; }).length, need = cfg.minFilled || reqCols.length || 1;
      function lack() { var m = reqCols.filter(function (c) { return String(colVal(r, c)).trim() === ''; })[0]; return m ? 'חסר ' + m.l : 'יש להזין לפחות ' + need + ' שדות'; }
      var missing = reqCols.some(function (c) { return String(colVal(r, c)).trim() === ''; }) || (!reqCols.length && filled < need);
      if (r.fail) return { k: 'failed', t: 'נכשל: ' + r.fail };
      if (r.pending) return { k: 'pending', t: 'בקשת תיקון נשלחה לאישור' };
      for (var i = 0; i < cfg.cols.length; i++) { var e = cellErr(r, cfg.cols[i], o); if (e) return { k: 'invalid', t: cfg.cols[i].l + ': ' + e }; }
      if (cfg.rowErr && !r.state) { var re = cfg.rowErr(function (n) { var cc = cfg.cols.filter(function (x) { return x.n === n; })[0]; return cc ? cv(cc, colVal(r, cc)) : null; }); if (re) return { k: 'invalid', t: re }; }
      if (r.rec) { var same = cfg.cols.every(function (c) { return eqv(cv(c, colVal(r, c)), cv(c, r.orig[c.n])); }) && sharedSame(r, o);
        if (!r.editable) return { k: 'locked', t: 'נשמר · של מפקד אחר (לא ניתן לעריכה כאן)' }; if (same) return { k: 'saved', t: 'נשמר ✓' }; if (missing) return { k: 'partial', t: lack() }; return { k: 'edited', t: isAdmin() ? 'שונה — יישמר כתיקון' : 'שונה — תישלח בקשת תיקון' }; }
      if (r.state) return { k: 'skip', t: r.state === 'absent' ? 'נעדר — לא נבחן, אין ציון' : 'פטור — לא נבחן, אין ציון' };
      if (!filled) return { k: 'empty', t: 'לא הוזן' };
      if (missing) return { k: 'partial', t: lack() };
      return { k: 'new', t: 'מוכן לשמירה' };
    }
    function sharedSame(r, o) { return (cfg.sharedEdit || []).every(function (n) { var f = cfg.shared.filter(function (x) { return x.n === n; })[0] || {}; return String(o[n]).trim() === '' || (f.t === 'number' ? numParse(o[n]).n === numParse(r.orig[n]).n : String(o[n]) === String(r.orig[n])); }); }
    function pctLine() {
      var cnt = { saved: 0, edited: 0, new: 0, partial: 0, invalid: 0, failed: 0, skip: 0, empty: 0, locked: 0, pending: 0 }; rows.forEach(function (r) { cnt[statusOf(r).k]++; });
      var entered = cnt.saved + cnt.edited + cnt.new + cnt.locked + cnt.pending, prob = cnt.partial + cnt.invalid + cnt.failed;
      return { cnt: cnt, entered: entered, prob: prob, text: 'הוזנו ' + entered + ' מתוך ' + rows.length + ' · חסרים ' + cnt.empty + (cnt.skip ? ' · נעדרים/פטורים ' + cnt.skip : '') + ' · לשמירה ' + (cnt.new + cnt.edited) + (prob ? ' · דורשים תיקון ' + prob : '') };
    }
    function refreshAll() { rows.forEach(paintRow); paintProgress(); }
    function paintProgress() { var p = pctLine(); progress.replaceChildren(h('strong', { text: p.text }), h('div', { class: 'be-bar', 'aria-hidden': 'true' }, [h('span', { style: 'width:' + Math.round(100 * p.entered / Math.max(1, rows.length)) + '%' })])); var sv = $('#beSave'); if (sv) { var n = p.cnt.new + p.cnt.edited, rf = p.cnt.failed; sv.disabled = saving || (n === 0 && rf === 0); sv.textContent = saving ? 'שומר…' : rf > 0 ? 'ניסיון חוזר ל-' + rf + ' שנכשלו' + (n ? ' + שמירת ' + n : '') : n ? 'שמירה (' + n + ' רשומות)' : 'אין שינויים לשמירה'; } }
    function paintRow(r) { var st = statusOf(r); r.node.className = 'be-row be-' + st.k; r.msg.textContent = st.t; r.msg.className = 'be-msg' + (st.k === 'invalid' || st.k === 'partial' || st.k === 'failed' ? ' err' : st.k === 'saved' ? ' ok' : ''); r.cells.forEach(function (x) { var e = cellErr(r, x.c, shared()); x.inp.setAttribute('aria-invalid', e ? 'true' : 'false'); var ap = !cfg.colApplies || cfg.colApplies(x.c, shared(), P); if (!ap && x.inp.value) { x.inp.value = ''; r.vals[x.c.n] = ''; } x.inp.disabled = !!r.state || (r.rec && !r.editable) || saving || !ap; x.inp.title = ap ? '' : 'הרכיב אינו חלק מסוג המבחן שנבחר'; }); r.sel.disabled = !!r.rec || saving; }
    function visible(r) { var s = r.s, t = filt.q.trim().toLowerCase(); if (filt.dep && s.department_id !== filt.dep) return false; if (filt.team && s.team_id !== filt.team) return false; if (t && !((s.full_name || '').toLowerCase().includes(t) || String(s.personal_number).includes(t))) return false; var k = statusOf(r).k; if (filt.st === 'missing') return k === 'empty'; if (filt.st === 'entered') return k === 'saved' || k === 'edited' || k === 'new' || k === 'locked' || k === 'pending'; if (filt.st === 'fix') return k === 'partial' || k === 'invalid' || k === 'failed'; return true; }
    function applyFilter() { var shown = 0; rows.forEach(function (r) { var v = visible(r); r.node.hidden = !v; if (v) shown++; }); var em = $('#beEmpty'); if (em) em.hidden = shown > 0; }
    function focusCell(r, ci) { if (!r) return; var x = r.cells[ci]; if (x && !x.inp.disabled) { x.inp.focus(); try { x.inp.select(); } catch (e) {} } }
    function nextVisible(i, dir) { for (var j = i + dir; j >= 0 && j < rows.length; j += dir) if (!rows[j].node.hidden) return rows[j]; return null; }
    function makeRow(s) {
      var r = { s: s, vals: {}, state: '', rec: null, orig: null, cells: [], touched: false, fail: '', pending: false, editable: true };
      var nm = h('button', { class: 'be-name linkbtn', type: 'button', text: s.full_name, title: 'פתיחת כרטיס החניך', onclick: function () { go('soldier/' + s.id); } });
      var cells = cfg.cols.map(function (c, ci) { var inp = c.t === 'sel' ? h('select', { class: 'be-in', id: 'be_' + s.id + '_' + c.n, 'aria-label': s.full_name + ' — ' + c.l }, [['', '—']].concat(c.o).map(function (o) { return h('option', { value: o[0], text: o[1] }); })) : c.t === 'txt' ? h('input', { class: 'be-in', id: 'be_' + s.id + '_' + c.n, autocomplete: 'off', enterkeyhint: 'next', maxlength: String(c.max_len || 300), 'aria-label': s.full_name + ' — ' + c.l, placeholder: c.l }) : h('input', { class: 'be-in', id: 'be_' + s.id + '_' + c.n, inputmode: c.t === 'time' ? 'numeric' : c.int ? 'numeric' : 'decimal', autocomplete: 'off', enterkeyhint: 'next', maxlength: '8', placeholder: c.t === 'time' ? 'ד:שש' : null, 'aria-label': s.full_name + ' — ' + c.l, dir: 'ltr' });
        inp.addEventListener(c.t === 'sel' ? 'change' : 'input', function () { r.vals[c.n] = inp.value; r.touched = true; r.fail = ''; paintRow(r); paintProgress(); if (filt.st !== 'all') applyFilter(); });
        inp.addEventListener('keydown', function (e) { var i = rows.indexOf(r); if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); var n = nextVisible(i, 1); if (n) focusCell(n, ci); else if (e.key === 'Enter' && ci + 1 < cfg.cols.length) { var f = rows.filter(function (x) { return !x.node.hidden; })[0]; focusCell(f, ci + 1); } else { var sv = $('#beSave'); if (sv && !sv.disabled) sv.focus(); } } else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(nextVisible(i, -1), ci); } });
        var lab = h('label', { class: 'be-cell', for: inp.id }, [h('span', { class: 'be-lab', text: c.l }), inp]); r.cells.push({ c: c, inp: inp }); return lab; });
      var sel = h('select', { class: 'be-state', 'aria-label': s.full_name + ' — מצב' }, [['', 'מצב: להזנה'], ['absent', 'נעדר'], ['exempt', 'פטור']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      sel.addEventListener('change', function () { r.state = sel.value; r.touched = true; if (r.state) { cfg.cols.forEach(function (c) { r.vals[c.n] = ''; }); r.cells.forEach(function (x) { x.inp.value = ''; }); } paintRow(r); paintProgress(); });
      if (cfg.noState) sel.hidden = true; r.sel = sel; r.msg = h('div', { class: 'be-msg', 'aria-live': 'polite' });
      r.node = h('div', { class: 'be-row be-empty', 'data-sid': s.id }, [h('div', { class: 'be-who' }, [nm, h('small', { class: 'muted', text: (s.team_name || s.department_name || '').replace(/\s*\(זמני\)/g, '') })]), h('div', { class: 'be-cells' }, cells), sel, r.msg]);
      return r;
    }
    function overlay() {   // put the saved results of the chosen test onto the rows (rows the person already touched keep their own typing)
      var by = {}; (existing || []).forEach(function (x) { if (x.record_status === 'cancelled') return; (by[x.soldier_id] = by[x.soldier_id] || []).push(x); });
      rows.forEach(function (r) { var ex = by[r.s.id] && by[r.s.id][0]; if (!ex) { if (r.rec) { var same = !r.touched || sameVals(r); r.rec = null; r.orig = null; if (same) { cfg.cols.forEach(function (c) { r.vals[c.n] = ''; }); r.cells.forEach(function (x) { x.inp.value = ''; }); r.touched = false; } } return; } r.rec = ex; r.orig = cfg.recVals(ex); r.editable = isAdmin() || ex.own === true || C.mode !== 'server'; r.state = ''; r.sel.value = ''; if (!r.touched || sameVals(r)) { cfg.cols.forEach(function (c) { r.vals[c.n] = r.orig[c.n] === undefined || r.orig[c.n] === null ? '' : String(r.orig[c.n]); }); r.cells.forEach(function (x) { x.inp.value = r.vals[x.c.n]; }); r.touched = false; } r.dup = by[r.s.id].length > 1; });
    }
    function sameVals(r) { return cfg.cols.every(function (c) { return eqv(cv(c, colVal(r, c)), cv(c, r.orig[c.n])); }); }
    function loadExisting() { var o = shared(); if (!cfg.existingKey(o)) { existing = []; overlay(); refreshAll(); return Promise.resolve(); } return cfg.existing(o).then(function (r) { if (!r.ok) { toast(msgOf(r), 'err'); return; } existing = r.data || []; (cfg.sharedEdit || []).forEach(function (n) { var el = $('#be_' + n), ex = existing.filter(function (x) { return x.record_status !== 'cancelled'; })[0]; if (el && String(el.value).trim() === '' && ex && ex[n] !== undefined && ex[n] !== null) el.value = String(ex[n]); }); overlay(); refreshAll(); applyFilter(); }); }
    function build() {
      holder.replaceChildren();
      if (!sols().length) { holder.append(emptyBox('אין חניכים פעילים בהרשאה שלכם.')); return; }
      var cfgShared = cfg.shared.map(function (f) { var inp; if (f.t === 'select') inp = h('select', { id: 'be_' + f.n }, [h('option', { value: '', text: 'בחרו…' })].concat(f.o(P).map(function (x) { return h('option', { value: x[0], text: x[1] }); }))); else { inp = h('input', { id: 'be_' + f.n, type: f.t === 'date' ? 'date' : 'text', maxlength: f.max_len || null, inputmode: f.t === 'number' ? (f.int ? 'numeric' : 'decimal') : null, autocomplete: 'off', value: f.def === 'today' ? today() : (f.def || '') }); }
        if (f.t === 'select' && P[cfg.pre && cfg.pre[0]] && f.first) { var opts = f.o(P); if (opts.length === 1) inp.value = opts[0][0]; }
        inp.addEventListener('change', function () { loadExisting().then(function () { refreshAll(); }); }); inp.addEventListener('input', function () { refreshAll(); }); return field(f.l + (f.req ? ' *' : ''), inp, f.hint); });
      shHost.replaceChildren.apply(shHost, cfgShared);
      var org = S.org || { departments: [], teams: [] };
      var q = h('input', { class: 'search', id: 'beQ', type: 'search', placeholder: 'חיפוש שם / מספר אישי', 'aria-label': 'חיפוש חניך' }), dep = h('select', { id: 'beDep', 'aria-label': 'סינון לפי מחלקה' }, [h('option', { value: '', text: 'כל המחלקות' })].concat(org.departments.map(function (d) { return h('option', { value: d.id, text: d.name.replace(/\s*\(זמני\)/, '') }); }))), team = h('select', { id: 'beTeam', 'aria-label': 'סינון לפי צוות' }, [h('option', { value: '', text: 'כל הצוותות' })].concat(org.teams.map(function (t) { return h('option', { value: t.id, text: t.name.replace(/\s*\(זמני\)/, ''), 'data-dep': t.department_id }); })));
      var chips = h('div', { class: 'filters', role: 'group', 'aria-label': 'סינון לפי מצב הזנה' }, [['all', 'הכול'], ['missing', 'חסרים'], ['entered', 'הוזנו'], ['fix', 'דורשי תיקון']].map(function (c) { return h('button', { class: 'chip' + (c[0] === 'all' ? ' active' : ''), type: 'button', 'data-st': c[0], 'aria-pressed': c[0] === 'all' ? 'true' : 'false', text: c[1], onclick: function (ev) { filt.st = c[0]; [].forEach.call(chips.children, function (b) { b.classList.toggle('active', b === ev.currentTarget); b.setAttribute('aria-pressed', b === ev.currentTarget ? 'true' : 'false'); }); applyFilter(); } }); }));
      q.addEventListener('input', function () { filt.q = q.value; applyFilter(); }); dep.addEventListener('change', function () { filt.dep = dep.value; [].forEach.call(team.options, function (o) { o.hidden = !!(dep.value && o.dataset.dep && o.dataset.dep !== dep.value); }); if (team.selectedOptions[0] && team.selectedOptions[0].hidden) { team.value = ''; filt.team = ''; } applyFilter(); }); team.addEventListener('change', function () { filt.team = team.value; applyFilter(); });
      var head = h('div', { class: 'be-head', 'aria-hidden': 'true' }, [h('span', { text: 'חניך' }), h('div', { class: 'be-cells' }, cfg.cols.map(function (c) { return h('span', { text: c.l }); })), h('span', { text: 'מצב' }), h('span', { text: 'סטטוס' })]); list.style.setProperty('--be-n', cfg.cols.length); list.append(head);
      rows = sols().map(makeRow); rows.forEach(function (r) { list.append(r.node); });
      var why = h('input', { id: 'beReason', maxlength: '300', placeholder: 'סיבת התיקון (נדרשת רק כשמתקנים תוצאות שנשמרו)', autocomplete: 'off', 'aria-label': 'סיבת התיקון' }); why.addEventListener('input', function () { reason = why.value; });
      var save = h('button', { class: 'primary', type: 'button', id: 'beSave', disabled: true, text: 'אין שינויים לשמירה', onclick: doSave });
      holder.append(h('p', { class: 'muted', text: 'מגדירים פעם אחת את פרטי הבוחן, ואז מזינים תוצאות ברשימה. Enter — לחניך הבא. כל השמירות נשלחות בפעולה אחת; כל חניך נשמר בנפרד ואין שמירה אוטומטית.' }), h('div', { class: 'card be-card' }, [shHost]), h('div', { class: 'be-tools' }, [q, h('div', { class: 'be-two' }, [dep, team]), chips]), progress, list, h('div', { class: 'empty', id: 'beEmpty', hidden: true, text: 'לא נמצאו חניכים לפי הסינון.' }), h('div', { class: 'be-reasonrow' }, [field('סיבת תיקון', why)]), summary, h('div', { class: 'stickybar' }, [save]));
      bulkLeave = { dirty: dirty };
      loadExisting().then(function () { refreshAll(); applyFilter(); });
      refreshAll(); applyFilter();
      var firstIn = $('#be_' + cfg.shared[0].n); if (firstIn && !firstIn.value) firstIn.focus({ preventScroll: true });
    }
    function reconcile() { return cfg.existing(shared(), true).then(function (r) { if (r.ok) { existing = r.data || []; } return r.ok; }); }
    function doSave() {
      if (saving) return; var o = shared(), e = sharedErr(o); if (e) { toast(e, 'err'); return; }
      var todo = rows.filter(function (r) { var k = statusOf(r).k; return k === 'new' || k === 'edited' || k === 'failed'; }), bad = rows.filter(function (r) { var k = statusOf(r).k; return k === 'partial' || k === 'invalid'; });
      if (bad.length) { summary.replaceChildren(h('div', { class: 'msg err', role: 'alert', text: 'לא נשמר דבר: ' + bad.length + ' שורות דורשות תיקון (מסומנות באדום). ' + bad.slice(0, 3).map(function (r) { return r.s.full_name + ' — ' + statusOf(r).t; }).join(' · ') })); var f = bad[0]; f.node.scrollIntoView({ block: 'center' }); return; }
      if (!todo.length) return;
      var edits = todo.filter(function (r) { return r.rec; }); if (edits.length && !reason.trim()) { $('#beReason').focus(); summary.replaceChildren(h('div', { class: 'msg err', role: 'alert', text: 'מתקנים ' + edits.length + ' תוצאות שכבר נשמרו — יש לציין סיבת תיקון.' })); return; }
      if (edits.length > 0 && todo.length >= 5) { dialog('אישור שינוי מרוכז', [h('p', { text: 'יישמרו ' + todo.length + ' רשומות, מהן ' + edits.length + ' תיקוני תוצאות קיימות' + (isAdmin() ? '.' : ' (יישלחו לאישור).') })], function () { run(todo, o); return true; }, 'אישור ושמירה'); return; }
      run(todo, o);
    }
    function run(todo, o) {
      saving = true; refreshAll(); summary.replaceChildren(h('p', { class: 'muted', text: 'שומר ' + todo.length + ' רשומות…' }));
      reconcile().then(function (ok) {
        if (!ok) { saving = false; refreshAll(); summary.replaceChildren(h('div', { class: 'msg err', role: 'alert', text: 'לא ניתן היה לוודא את המצב השמור בשרת — דבר לא נשלח. נסו שוב.' })); return; }
        var by = {}; existing.forEach(function (x) { if (x.record_status !== 'cancelled') (by[x.soldier_id] = by[x.soldier_id] || []).push(x); });
        var ok = [], fail = [], q = todo.slice(), active = 0, MAXC = 3;
        function one(r) {
          var fresh = by[r.s.id] && by[r.s.id][0], vals = {}; cfg.cols.forEach(function (c) { vals[c.n] = cv(c, colVal(r, c)); });
          if (!r.rec && fresh) {   // somebody (or an earlier lost reply) already saved this soldier for this test: never create a second record
            var fv = cfg.recVals(fresh), same = cfg.cols.every(function (c) { return eqv(cv(c, fv[c.n]), vals[c.n]); });
            if (same) { r.rec = fresh; r.orig = fv; r.editable = isAdmin() || fresh.own === true || C.mode !== 'server'; r.fail = ''; ok.push(r); return Promise.resolve(); }
            r.fail = 'כבר קיימת תוצאה שנשמרה בינתיים (' + cfg.cols.map(function (c) { return fv[c.n]; }).join(' / ') + ') — רעננו כדי לערוך אותה'; fail.push(r); return Promise.resolve(); }
          if (r.rec) { var fr = fresh && fresh.id === r.rec.id ? fresh : null; if (!fr) { r.fail = 'התוצאה השמורה לא נמצאה/בוטלה — רעננו'; fail.push(r); return Promise.resolve(); } var fv2 = cfg.recVals(fr); if (!cfg.cols.every(function (c) { return eqv(cv(c, fv2[c.n]), cv(c, r.orig[c.n])); })) { r.fail = 'התוצאה עודכנה בינתיים על ידי משתמש אחר (' + cfg.cols.map(function (c) { return fv2[c.n]; }).join(' / ') + ') — לא נדרסה. רעננו ונסו שוב'; fail.push(r); return Promise.resolve(); } }
          var call;
          if (r.rec) { var patch = {}, chg = {}; cfg.cols.forEach(function (c) { if (!eqv(cv(c, r.orig[c.n]), vals[c.n])) patch[c.n] = vals[c.n] === null ? '' : vals[c.n]; }); (cfg.sharedEdit || []).forEach(function (n) { var f = cfg.shared.filter(function (x) { return x.n === n; })[0] || {}; if (String(o[n]).trim() === '') return; var v = f.t === 'number' ? numParse(o[n]).n : o[n]; if (String(r.orig[n]) !== String(v)) patch[n] = v; });
            call = isAdmin() ? api('record.edit', { table: cfg.table, id: r.rec.id, patch: patch, reason: reason.trim() }) : api('correction.request', { table: cfg.table, id: r.rec.id, changes: patch, reason: reason.trim() }); }
          else { var rk = cfg.existingKey(o) + '|' + r.s.id; if (r.reqK !== rk) { r.reqK = rk; r.reqId = rid(); } call = api(cfg.createM, cfg.createArgs(r.s, vals, o, r.reqId)); }   /* one stable request id per soldier+test: the server's own duplicate guard makes a repeated send harmless */
          return call.then(function (x) { if (x && x.ok) { if (r.rec && !isAdmin()) { r.pending = true; } r.fail = ''; ok.push(r); } else { r.fail = (x && x.message) || 'השמירה נכשלה'; fail.push(r); } }, function () { r.fail = 'אין תקשורת'; fail.push(r); });
        }
        function pump() { return new Promise(function (res) { function next() { if (!q.length && active === 0) return res(); while (active < MAXC && q.length) { (function (r) { active++; one(r).then(function () { active--; paintRow(r); paintProgress(); next(); }); })(q.shift()); } } next(); }); }
        pump().then(function () { return reconcile(); }).then(function () {   // trust only what the server now holds
          saving = false; var by2 = {}; (existing || []).forEach(function (x) { if (x.record_status !== 'cancelled') (by2[x.soldier_id] = by2[x.soldier_id] || []).push(x); });
          ok.forEach(function (r) { var ex = by2[r.s.id] && by2[r.s.id][0]; if (ex && !r.pending) { r.rec = ex; r.orig = cfg.recVals(ex); r.touched = false; r.editable = isAdmin() || ex.own === true || C.mode !== 'server'; } });
          var verified = ok.filter(function (r) { return r.pending || (by2[r.s.id] && by2[r.s.id].length); }), unv = ok.length - verified.length;
          refreshAll(); applyFilter();
          var box = [h('div', { class: 'msg ' + (fail.length || unv ? 'err' : 'ok'), role: 'status', text: (fail.length || unv ? 'נשמרו ' + verified.length + ' · לא נשמרו ' + (fail.length + unv) + '.' : 'נשמרו ' + verified.length + ' רשומות ואומתו בשרת.') + (todo.some(function (r) { return r.pending; }) ? ' בקשות תיקון ממתינות לאישור מנהל.' : '') })];
          if (fail.length) box.push(h('ul', { class: 'be-fails' }, fail.map(function (r) { return h('li', { text: r.s.full_name + ' — ' + r.fail }); })), h('p', { class: 'muted', text: 'לחיצה על "ניסיון חוזר" תשלח רק את הרשומות שנכשלו; שאר החניכים לא ישתנו.' }));
          summary.replaceChildren.apply(summary, box); if (!fail.length) toast('נשמר ואומת בשרת'); if (fail[0]) fail[0].node.scrollIntoView({ block: 'center' });
        });
      });
    }
    window.__bulk = { rows: function () { return rows.length; } };
  }

  /* ---- navigation: the first module on the shared screen (approved formula unchanged: points = 90*done/total, final = plan + debrief + points — computed by the server) ---- */
  BULK.nav = {
    domain: 'nav', back: 'd/nav', title: 'הזנה קבוצתית — ניווט', table: 'NavigationTests', createM: 'nav.create', pre: ['navtypes.list'],
    shared: [{ n: 'navigation_type_id', l: 'סוג ניווט', t: 'select', req: 1, o: function (P) { return (P['navtypes.list'] || []).filter(function (t) { return t.active; }).map(function (t) { return [t.id, t.name]; }); } },
      { n: 'test_date', l: 'תאריך', t: 'date', req: 1, def: 'today' },
      { n: 'distance_km', l: 'מרחק משוער (ק״מ)', t: 'number', req: 1, min: 0.5, max: 100, step: 0.5, hint: 'בקפיצות של 0.5' },
      { n: 'points_total', l: 'סך נקודות בניווט (מרבי)', t: 'number', req: 1, int: 1, min: 1 }],
    sharedEdit: ['distance_km', 'points_total'],
    cols: [{ n: 'plan_score', l: 'תכנון (0–5)', min: 0, max: 5, req: 1 }, { n: 'debrief_score', l: 'תחקיר (0–5)', min: 0, max: 5, req: 1 }, { n: 'points_completed', l: 'נקודות שנדקרו', int: 1, min: 0, max: 'points_total', req: 1 }],
    existingKey: function (o) { return o.navigation_type_id && /^\d{4}-\d{2}-\d{2}$/.test(o.test_date) ? o.navigation_type_id + '|' + o.test_date : ''; },
    existing: function (o, fresh) { return api('nav.list', { courseId: S.course.id, typeId: o.navigation_type_id, from: o.test_date, to: o.test_date }, fresh ? 'fresh' : undefined); },
    recVals: function (r) { return { plan_score: r.plan_score, debrief_score: r.debrief_score, points_completed: r.points_completed, distance_km: r.distance_km, points_total: r.points_total }; },
    createArgs: function (s, v, o, req) { return { courseId: S.course.id, data: { request_id: req, soldier_id: s.id, navigation_type_id: o.navigation_type_id, test_date: o.test_date, distance_km: numParse(o.distance_km).n, plan_score: v.plan_score, debrief_score: v.debrief_score, points_completed: v.points_completed, points_total: numParse(o.points_total).n, notes: '' } }; }
  };

  /* ---- fitness (regular כש״ג only; the approved scoring tables are applied by the server — nothing is scored here) ---- */
  var FIT_COLS = [{ n: 'pullups', l: 'מתח (חזרות)', int: 1, min: 0, max: 200 }, { n: 'parallel_bars', l: 'מקבילים (חזרות)', int: 1, min: 0, max: 200 }, { n: 'trap_bar', l: 'Trap Bar (חזרות)', int: 1, min: 0, max: 200 }, { n: 'run150x2', l: 'ריצת 300 מ׳ (ד:שש)', t: 'time' }, { n: 'run3km', l: 'ריצת 3 ק״מ (ד:שש)', t: 'time' }];
  BULK.fitness = {
    domain: 'fitness', back: 'd/fitness', title: 'הזנה קבוצתית — כש״ג רגיל', table: 'FitnessTests', createM: 'fitness.create', pre: ['fitness.types'], minFilled: 1,
    shared: [{ n: 'test_type_id', l: 'סוג מבחן כש״ג', t: 'select', req: 1, o: function (P) { return (P['fitness.types'] || []).filter(function (t) { return t.active !== false && t.selectable !== false && !t.is_opening; }).map(function (t) { return [t.id, t.name]; }); } }, { n: 'test_date', l: 'תאריך', t: 'date', req: 1, def: 'today' }],
    cols: FIT_COLS, sharedEdit: [],
    colApplies: function (c, o, P) { var t = (P['fitness.types'] || []).filter(function (x) { return x.id === o.test_type_id; })[0]; return !t || !t.weights || t.weights[c.n] !== undefined; },
    existingKey: function (o) { return o.test_type_id && /^\d{4}-\d{2}-\d{2}$/.test(o.test_date) ? o.test_type_id + '|' + o.test_date : ''; },
    existing: function (o, fresh) { return api('fitness.list', { courseId: S.course.id, opts: {} }, fresh ? 'fresh' : undefined).then(function (r) { if (r.ok) r = { ok: true, data: (r.data || []).filter(function (x) { return x.test_type_id === o.test_type_id && String(x.test_date).slice(0, 10) === o.test_date; }) }; return r; }); },
    recVals: function (r) { var v = {}; FIT_COLS.forEach(function (c) { v[c.n] = r.raw && r.raw[c.n] !== undefined && r.raw[c.n] !== null ? r.raw[c.n] : ''; }); return v; },
    createArgs: function (s, v, o, req) { var d = { request_id: req, soldier_id: s.id, test_type_id: o.test_type_id, test_date: o.test_date, notes: '' }; FIT_COLS.forEach(function (c) { if (v[c.n] !== null && v[c.n] !== undefined) d[c.n] = v[c.n]; }); return { courseId: S.course.id, data: d }; }
  };
  /* ---- theoretical exams: one moed (A/B/C) of one exam for the whole group; the server keeps the A→B→C order rules and opens the required meeting itself ---- */
  BULK.exams = {
    domain: 'exams', back: 'd/exams', title: 'הזנה קבוצתית — ציוני מבחן', table: 'TheoreticalExamAttempts', createM: 'exams.attempt', pre: ['exams.defs'],
    shared: [{ n: 'exam_id', l: 'מבחן', t: 'select', req: 1, o: function (P) { return (P['exams.defs'] || []).map(function (d) { return [d.id, d.name]; }); } }, { n: 'attempt', l: 'מועד', t: 'select', req: 1, o: function () { return [['A', 'א׳'], ['B', 'ב׳'], ['C', 'ג׳']]; } }, { n: 'attempt_date', l: 'תאריך המבחן', t: 'date', req: 1, def: 'today' }],
    sharedEdit: [], cols: [{ n: 'score', l: 'ציון (0–100)', min: 0, max: 100, req: 1 }],
    existingKey: function (o) { return o.exam_id && o.attempt ? o.exam_id + '|' + o.attempt : ''; },
    existing: function (o, fresh) { return api('exams.attempts', { courseId: S.course.id, opts: {} }, fresh ? 'fresh' : undefined).then(function (r) { if (r.ok) r = { ok: true, data: (r.data || []).filter(function (x) { return x.exam_id === o.exam_id && x.attempt === o.attempt; }) }; return r; }); },
    recVals: function (r) { return { score: r.score }; },
    createArgs: function (s, v, o, req) { return { courseId: S.course.id, data: { request_id: req, soldier_id: s.id, exam_id: o.exam_id, attempt: o.attempt, attempt_date: o.attempt_date, score: v.score } }; }
  };
  /* ---- marksmanship: the regular score and YLM stay two SEPARATE group screens (YLM never enters the regular score) ---- */
  function mkCfg(kind) {
    var col = kind === 'ylm' ? 'ylm_score' : 'examiner_score';
    return { domain: 'mk', back: 'd/mk', title: kind === 'ylm' ? 'הזנה קבוצתית — קליעה יל״מ' : 'הזנה קבוצתית — קליעה רגילה', table: 'MarksmanshipTests', createM: 'mk.create', pre: [],
      shared: [{ n: 'test_date', l: 'תאריך', t: 'date', req: 1, def: 'today' }, { n: 'weapon_type', l: 'סוג נשק', t: 'text', req: 1, max_len: 50 }, { n: 'distance_m', l: 'מרחק ירי (מ׳)', t: 'number', req: 1, min: 1, max: 2000 }, { n: 'weapon_zeroed', l: 'הנשק מאופס', t: 'select', req: 1, o: function () { return [['true', 'כן'], ['false', 'לא']]; } }],
      sharedEdit: [], cols: [{ n: col, l: kind === 'ylm' ? 'ציון יל״מ (0–100)' : 'ציון בוחן (0–100)', min: 0, max: 100, req: 1 }],
      existingKey: function (o) { return /^\d{4}-\d{2}-\d{2}$/.test(o.test_date) && o.weapon_type ? o.test_date + '|' + o.weapon_type.trim().toLowerCase() : ''; },
      existing: function (o, fresh) { return api('mk.list', { courseId: S.course.id, opts: {} }, fresh ? 'fresh' : undefined).then(function (r) { if (r.ok) r = { ok: true, data: (r.data || []).filter(function (x) { return String(x.test_date).slice(0, 10) === o.test_date && String(x.weapon_type).trim().toLowerCase() === o.weapon_type.trim().toLowerCase() && x[col] !== null && x[col] !== undefined && x[col] !== ''; }) }; return r; }); },
      recVals: function (r) { var v = {}; v[col] = r[col]; return v; },
      createArgs: function (s, v, o, req) { var d = { request_id: req, soldier_id: s.id, test_date: o.test_date, weapon_type: o.weapon_type.trim(), distance_m: numParse(o.distance_m).n, weapon_zeroed: o.weapon_zeroed === 'true', notes: '' }; d[col] = v[col]; return { courseId: S.course.id, data: d }; } };
  }
  BULK.mk = mkCfg('regular'); BULK.ylm = mkCfg('ylm');

  /* ---- readiness: group status update (quick marking). A new status is a NEW record (history is kept); the activity-limit text never carries a diagnosis ---- */
  BULK.readiness = {
    domain: 'readiness', back: 'd/readiness', title: 'עדכון כשירות מבצעית — קבוצתי', table: 'ReadinessRecords', createM: 'readiness.assess', pre: [], noState: true, minFilled: 1,
    shared: [{ n: 'start_date', l: 'בתוקף מתאריך', t: 'date', req: 1, def: 'today' }, { n: 'next_review_date', l: 'מועד בדיקה הבא (אופציונלי)', t: 'date' }],
    sharedEdit: [],
    cols: [{ n: 'status', l: 'סטטוס', t: 'sel', req: 1, o: [['fit', 'כשיר'], ['fit_with_restrictions', 'כשיר עם מגבלות'], ['unfit', 'לא כשיר']] }, { n: 'restrictions', l: 'מגבלות פעילות (ללא אבחנה)', t: 'txt', max_len: 300 }],
    rowErr: function (g) { var st = g('status'), rs = g('restrictions'); if (st === 'fit_with_restrictions' && !rs) return 'כשיר עם מגבלות מחייב תיאור מגבלות פעילות'; if (st === 'fit' && rs) return 'כשיר אינו כולל מגבלות'; return ''; },
    existingKey: function (o) { return /^\d{4}-\d{2}-\d{2}$/.test(o.start_date) ? o.start_date : ''; },
    existing: function (o, fresh) { return api('readiness.list', { courseId: S.course.id, opts: {} }, fresh ? 'fresh' : undefined).then(function (r) { if (r.ok) r = { ok: true, data: (r.data || []).filter(function (x) { return String(x.start_date).slice(0, 10) === o.start_date; }) }; return r; }); },
    recVals: function (r) { return { status: r.status, restrictions: r.restrictions || '' }; },
    createArgs: function (s, v, o, req) { var d = { request_id: req, soldier_id: s.id, status: v.status, restrictions: v.restrictions || '', start_date: o.start_date }; if (o.next_review_date) d.next_review_date = o.next_review_date; return { courseId: S.course.id, data: d }; }
  };

  /* ---- assignments: move SEVERAL soldiers to one department/team in one controlled action (admin only). Each soldier keeps the server's own reassign rules: audit entry, mandatory reason,
         optimistic check on the soldier's updated_at (a soldier changed by someone else meanwhile is reported and left untouched), approved-exception flag after the course start. ---- */
  function BulkReassign() {
    if (!isAdmin()) return Domain('org');
    var sel = {}, filt = '', msgBox = h('div', { id: 'brMsg', 'aria-live': 'polite' }), listBox = h('div', { id: 'brList', class: 'be-list' }), saving = false;
    var dep = h('select', { id: 'brDep' }, ((S.org || {}).departments || []).map(function (d) { return h('option', { value: d.id, text: d.name.replace(/\s*\(זמני\)/, '') }); })), team = h('select', { id: 'brTeam' }), why = h('input', { id: 'brWhy', maxlength: '300' }), ex = h('input', { id: 'brEx', type: 'checkbox', style: 'width:auto;min-height:24px' });
    function teams() { team.replaceChildren.apply(team, ((S.org || {}).teams || []).filter(function (t) { return t.department_id === dep.value; }).map(function (t) { return h('option', { value: t.id, text: t.name.replace(/\s*\(זמני\)/, '') }); })); } dep.addEventListener('change', function () { teams(); count(); }); teams(); team.addEventListener('change', count);
    var q = h('input', { id: 'brQ', type: 'search', placeholder: 'חיפוש חניך', 'aria-label': 'חיפוש חניך' }), cnt = h('strong', { id: 'brCount', 'aria-live': 'polite' }), go1 = h('button', { class: 'primary', type: 'button', id: 'brGo', text: 'העברת החניכים שנבחרו', disabled: true });
    mount('more', [h('button', { class: 'back', type: 'button', onclick: function () { go('d/org'); }, text: '→ חזרה' }), h('h1', { class: 'page', text: 'שיוך קבוצתי של חניכים' }), h('p', { class: 'muted', text: 'בוחרים חניכים, יעד אחד וסיבה אחת. כל חניך נשמר בנפרד ונרשם ביומן; חניך שהשתנה בינתיים אצל מישהו אחר לא ישונה ויוצג בשגיאה.' }), field('מחלקה יעד', dep), field('צוות יעד', team), field('סיבה (חובה)', why), h('label', { class: 'be-inline' }, [ex, h('span', { text: ' חריג מאושר (נדרש אחרי תחילת הקורס)' })]), field('חיפוש', q), cnt, listBox, msgBox, go1], 'שיוך קבוצתי');
    function names(s) { return (s.department_name || '') + ' · ' + (s.team_name || ''); }
    var sols = []; ensureSoldiers().then(function () { sols = (cache.soldiers || []).filter(function (x) { return x.active && x.record_status !== 'cancelled'; }); paint(); });
    function same(s) { return s.department_id === dep.value && s.team_id === team.value; }
    function count() { var n = Object.keys(sel).filter(function (id) { var s = sols.filter(function (x) { return x.id === id; })[0]; return s && !same(s); }).length; cnt.textContent = n ? 'נבחרו ' + n + ' חניכים להעברה' : 'לא נבחרו חניכים'; go1.disabled = saving || !n || !why.value.trim(); paint(true); }
    function paint(keep) { var t = q.value.trim().toLowerCase(); listBox.replaceChildren.apply(listBox, sols.filter(function (s) { return !t || (s.full_name || '').toLowerCase().includes(t); }).map(function (s) { var cb = h('input', { type: 'checkbox', id: 'br_' + s.id, style: 'width:auto' }); cb.checked = !!sel[s.id]; cb.disabled = saving || same(s); cb.addEventListener('change', function () { if (cb.checked) sel[s.id] = 1; else delete sel[s.id]; count(); }); return h('label', { class: 'be-row be-pick', for: cb.id }, [cb, h('span', { class: 'be-who' }, [h('strong', { text: s.full_name }), h('small', { class: 'muted', text: names(s) + (same(s) ? ' · כבר ביעד' : '') })])]); })); }
    q.addEventListener('input', function () { paint(); }); why.addEventListener('input', count);
    go1.addEventListener('click', function () {
      var todo = sols.filter(function (s) { return sel[s.id] && !same(s); }); if (!todo.length) return; if (!why.value.trim()) { why.focus(); msgBox.replaceChildren(h('div', { class: 'msg err', role: 'alert', text: 'יש לציין סיבה.' })); return; }
      dialog('אישור שיוך קבוצתי', [h('p', { text: 'יועברו ' + todo.length + ' חניכים אל ' + dep.selectedOptions[0].text + ' / ' + team.selectedOptions[0].text + '. כל חניך נרשם ביומן הפעולות.' })], function () { run(todo); return true; }, 'אישור והעברה');
    });
    function run(todo) {
      saving = true; count(); msgBox.replaceChildren(h('p', { class: 'muted', text: 'מעביר ' + todo.length + ' חניכים…' })); var ok = [], fail = [], i = 0;
      function next() { if (i >= todo.length) return Promise.resolve(); var s = todo[i++]; return api('soldiers.card', { id: s.id }, 'fresh').then(function (cr) { var cur = cr && cr.ok && (cr.data.soldier || cr.data); if (!cur || !cur.updated_at) return { ok: false, message: 'לא ניתן לקרוא את החניך מהשרת' }; if (cur.department_id !== s.department_id || cur.team_id !== s.team_id) return { ok: false, code: 'CONFLICT', message: 'השיוך שונה בינתיים על ידי משתמש אחר — לא שונה' }; return api('soldiers.reassign', { id: s.id, target: { department_id: dep.value, team_id: team.value, approved_exception: ex.checked }, expected_updated_at: cur.updated_at, reason: why.value.trim() }); }).then(function (x) { if (x && x.ok) ok.push(s); else fail.push([s, (x && x.message) || 'נכשל', x && x.code]); }).then(next); }
      next().then(function () { cache.soldiers = null; return ensureSoldiers(); }).then(function () {
        saving = false; sols = (cache.soldiers || []).filter(function (x) { return x.active && x.record_status !== 'cancelled'; }); var moved = ok.filter(function (s) { var n = sols.filter(function (y) { return y.id === s.id; })[0]; return n && n.department_id === dep.value && n.team_id === team.value; }); sel = {}; fail.forEach(function (f) { sel[f[0].id] = 1; });
        msgBox.replaceChildren(h('div', { class: 'msg ' + (fail.length || moved.length !== ok.length ? 'err' : 'ok'), role: 'status', text: 'הועברו ' + moved.length + ' · לא הועברו ' + (fail.length + ok.length - moved.length) + '.' + (moved.length ? ' אומת בשרת.' : '') }), fail.length ? h('ul', { class: 'be-fails' }, fail.map(function (f) { return h('li', { text: f[0].full_name + ' — ' + f[1] + (f[2] === 'CONFLICT' ? ' (רעננו ונסו שוב)' : '') }); })) : h('span')); paint(); count(); if (!fail.length) toast('השיוך עודכן ואומת');
      });
    }
    count();
  }
  window.BulkReassign = BulkReassign;

  /* ---- correction requests: handle several pending requests in one pass (admin only). Nothing is pre-selected; every request shows what would change; each decision is its own server call and is reported separately. ---- */
  function BulkCorrections() {
    if (!isAdmin()) return Domain('corrections');
    var sel = {}, items = [], saving = false, list = h('div', { id: 'bcList', class: 'be-list' }), msgBox = h('div', { id: 'bcMsg', 'aria-live': 'polite' }), cnt = h('strong', { id: 'bcCount', 'aria-live': 'polite' });
    var dec = h('select', { id: 'bcDec' }, [h('option', { value: 'approve', text: 'אישור' }), h('option', { value: 'reject', text: 'דחייה' })]), note = h('input', { id: 'bcNote', maxlength: '300' }), go1 = h('button', { class: 'primary', type: 'button', id: 'bcGo', text: 'החלה על הבקשות שנבחרו', disabled: true });
    mount('more', [h('button', { class: 'back', type: 'button', onclick: function () { go('d/corrections'); }, text: '→ חזרה' }), h('h1', { class: 'page', text: 'טיפול קבוצתי בבקשות תיקון' }), h('p', { class: 'muted', text: 'לא נבחר דבר מראש. כל בקשה מציגה מה ישתנה; ההחלטה נשלחת לכל בקשה בנפרד ומדווחת בנפרד.' }), field('החלטה', dec), field('הערה (אופציונלי)', note), cnt, list, msgBox, go1], 'בקשות תיקון');
    function load() { return api('correction.list', { courseId: S.course.id, status: 'pending' }, 'fresh').then(function (r) { items = r.ok ? (r.data || []) : []; if (!r.ok) msgBox.replaceChildren(errBox(r)); paint(); }); }
    function desc(c) { var ch = c.changes || c.patch || c.proposed || {}; var t = ''; try { t = typeof ch === 'string' ? ch : Object.keys(ch).map(function (k) { return k + ': ' + ch[k]; }).join(' · '); } catch (e) {} return (c.table_name || '') + ' · ' + (c.reason || '') + (t ? ' · ' + t : '') + ' · ' + (c.requested_by || ''); }
    function paint() { cnt.textContent = Object.keys(sel).length ? 'נבחרו ' + Object.keys(sel).length + ' בקשות' : 'לא נבחרו בקשות'; go1.disabled = saving || !Object.keys(sel).length; if (!items.length) { list.replaceChildren(emptyBox('אין בקשות תיקון ממתינות.')); return; } list.replaceChildren.apply(list, items.map(function (c) { var cb = h('input', { type: 'checkbox', id: 'bc_' + c.id, style: 'width:auto' }); cb.checked = !!sel[c.id]; cb.disabled = saving; cb.addEventListener('change', function () { if (cb.checked) sel[c.id] = 1; else delete sel[c.id]; paint(); }); return h('label', { class: 'be-row be-pick', for: cb.id }, [cb, h('span', { class: 'be-who' }, [h('strong', { text: desc(c) })])]); })); }
    go1.addEventListener('click', function () { var todo = items.filter(function (c) { return sel[c.id]; }); if (!todo.length) return; dialog('אישור טיפול קבוצתי', [h('p', { text: (dec.value === 'approve' ? 'יאושרו ' : 'יידחו ') + todo.length + ' בקשות תיקון.' })], function () { run(todo); return true; }, 'אישור', dec.value === 'reject'); });
    function run(todo) { saving = true; paint(); var ok = [], fail = [], i = 0; function next() { if (i >= todo.length) return Promise.resolve(); var c = todo[i++]; return api('correction.review', { requestId: c.id, decision: dec.value, note: note.value.trim() }).then(function (x) { if (x && x.ok) ok.push(c); else fail.push([c, (x && x.message) || 'נכשל']); }).then(next); }
      next().then(function () { sel = {}; fail.forEach(function (f) { sel[f[0].id] = 1; }); return load(); }).then(function () { saving = false; var still = ok.filter(function (c) { return items.some(function (x) { return x.id === c.id; }); }).length; msgBox.replaceChildren(h('div', { class: 'msg ' + (fail.length || still ? 'err' : 'ok'), role: 'status', text: 'טופלו ' + (ok.length - still) + ' · לא טופלו ' + (fail.length + still) + '.' + (ok.length - still ? ' אומת בשרת (הבקשות יצאו מרשימת הממתינות).' : '') }), fail.length ? h('ul', { class: 'be-fails' }, fail.map(function (f) { return h('li', { text: desc(f[0]) + ' — ' + f[1] }); })) : h('span')); paint(); if (!fail.length && !still) toast('הבקשות טופלו ואומתו'); }); }
    load();
  }
  window.BulkCorrections = BulkCorrections;
