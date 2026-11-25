  /* ============ SMART ENTRY — one shared "enter a whole group at once" screen (a dedicated work screen inside the existing navigation, never a popup per soldier) ============
     Config-driven: each module supplies its shared fields, per-soldier columns, validation and the EXISTING API calls (create / record.edit / correction.request). No new routes, no schema change.
     Honest limits: the server has no optimistic-lock or uniqueness rule, so before every save the screen re-reads the saved results (reconcile) and refuses to overwrite a result somebody else
     changed meanwhile; the writes are one request per record (NOT atomic) — the screen reports exactly which records were saved and which failed, and retries only the failed ones.
     Nothing sensitive is kept in browser storage: drafts live in memory only (a reload warns first). */
  var BULK = {};
  var bulkLeave = null;   // { dirty: fn } while a group-entry screen holds unsaved input
  function numParse(v) { var t = String(v === null || v === undefined ? '' : v).trim().replace(',', '.'); if (t === '') return { blank: true }; if (!/^-?\d+(\.\d+)?$/.test(t)) return { bad: true }; return { n: Number(t) }; }
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
    function cellErr(r, c, o) { var p = numParse(colVal(r, c)); if (p.blank) return ''; if (p.bad) return 'ערך לא תקין'; var min = c.min, max = typeof c.max === 'string' ? numParse(o[c.max]).n : c.max; if (min !== undefined && p.n < min) return 'מינימום ' + min; if (max !== undefined && max !== null && !isNaN(max) && p.n > max) return 'מקסימום ' + max; if (c.int && !Number.isInteger(p.n)) return 'מספר שלם'; return ''; }
    /* row status: saved | edited | new | partial | invalid | failed | skip | empty | locked */
    function statusOf(r) {
      var o = shared(), filled = cfg.cols.filter(function (c) { return String(colVal(r, c)).trim() !== ''; }).length, missing = cfg.cols.filter(function (c) { return c.req && String(colVal(r, c)).trim() === ''; }).length;
      if (r.fail) return { k: 'failed', t: 'נכשל: ' + r.fail };
      if (r.pending) return { k: 'pending', t: 'בקשת תיקון נשלחה לאישור' };
      for (var i = 0; i < cfg.cols.length; i++) { var e = cellErr(r, cfg.cols[i], o); if (e) return { k: 'invalid', t: cfg.cols[i].l + ': ' + e }; }
      if (r.rec) { var same = cfg.cols.every(function (c) { return numParse(colVal(r, c)).n === numParse(r.orig[c.n]).n && numParse(colVal(r, c)).blank === numParse(r.orig[c.n]).blank; }) && sharedSame(r, o);
        if (!r.editable) return { k: 'locked', t: 'נשמר · של מפקד אחר (לא ניתן לעריכה כאן)' }; if (same) return { k: 'saved', t: 'נשמר ✓' }; if (missing) return { k: 'partial', t: 'חסר ' + cfg.cols.filter(function (c) { return c.req && String(colVal(r, c)).trim() === ''; })[0].l }; return { k: 'edited', t: isAdmin() ? 'שונה — יישמר כתיקון' : 'שונה — תישלח בקשת תיקון' }; }
      if (r.state) return { k: 'skip', t: r.state === 'absent' ? 'נעדר — לא נבחן, אין ציון' : 'פטור — לא נבחן, אין ציון' };
      if (!filled) return { k: 'empty', t: 'לא הוזן' };
      if (missing) return { k: 'partial', t: 'חסר ' + cfg.cols.filter(function (c) { return c.req && String(colVal(r, c)).trim() === ''; })[0].l };
      return { k: 'new', t: 'מוכן לשמירה' };
    }
    function sharedSame(r, o) { return (cfg.sharedEdit || []).every(function (n) { return numParse(o[n]).n === numParse(r.orig[n]).n; }); }
    function pctLine() {
      var cnt = { saved: 0, edited: 0, new: 0, partial: 0, invalid: 0, failed: 0, skip: 0, empty: 0, locked: 0, pending: 0 }; rows.forEach(function (r) { cnt[statusOf(r).k]++; });
      var entered = cnt.saved + cnt.edited + cnt.new + cnt.locked + cnt.pending, prob = cnt.partial + cnt.invalid + cnt.failed;
      return { cnt: cnt, entered: entered, prob: prob, text: 'הוזנו ' + entered + ' מתוך ' + rows.length + ' · חסרים ' + cnt.empty + (cnt.skip ? ' · נעדרים/פטורים ' + cnt.skip : '') + ' · לשמירה ' + (cnt.new + cnt.edited) + (prob ? ' · דורשים תיקון ' + prob : '') };
    }
    function refreshAll() { rows.forEach(paintRow); paintProgress(); }
    function paintProgress() { var p = pctLine(); progress.replaceChildren(h('strong', { text: p.text }), h('div', { class: 'be-bar', 'aria-hidden': 'true' }, [h('span', { style: 'width:' + Math.round(100 * p.entered / Math.max(1, rows.length)) + '%' })])); var sv = $('#beSave'); if (sv) { var n = p.cnt.new + p.cnt.edited, rf = p.cnt.failed; sv.disabled = saving || (n === 0 && rf === 0); sv.textContent = saving ? 'שומר…' : rf > 0 ? 'ניסיון חוזר ל-' + rf + ' שנכשלו' + (n ? ' + שמירת ' + n : '') : n ? 'שמירה (' + n + ' רשומות)' : 'אין שינויים לשמירה'; } }
    function paintRow(r) { var st = statusOf(r); r.node.className = 'be-row be-' + st.k; r.msg.textContent = st.t; r.msg.className = 'be-msg' + (st.k === 'invalid' || st.k === 'partial' || st.k === 'failed' ? ' err' : st.k === 'saved' ? ' ok' : ''); r.cells.forEach(function (x) { var e = cellErr(r, x.c, shared()); x.inp.setAttribute('aria-invalid', e ? 'true' : 'false'); x.inp.disabled = !!r.state || (r.rec && !r.editable) || saving; }); r.sel.disabled = !!r.rec || saving; }
    function visible(r) { var s = r.s, t = filt.q.trim().toLowerCase(); if (filt.dep && s.department_id !== filt.dep) return false; if (filt.team && s.team_id !== filt.team) return false; if (t && !((s.full_name || '').toLowerCase().includes(t) || String(s.personal_number).includes(t))) return false; var k = statusOf(r).k; if (filt.st === 'missing') return k === 'empty'; if (filt.st === 'entered') return k === 'saved' || k === 'edited' || k === 'new' || k === 'locked' || k === 'pending'; if (filt.st === 'fix') return k === 'partial' || k === 'invalid' || k === 'failed'; return true; }
    function applyFilter() { var shown = 0; rows.forEach(function (r) { var v = visible(r); r.node.hidden = !v; if (v) shown++; }); var em = $('#beEmpty'); if (em) em.hidden = shown > 0; }
    function focusCell(r, ci) { if (!r) return; var x = r.cells[ci]; if (x && !x.inp.disabled) { x.inp.focus(); try { x.inp.select(); } catch (e) {} } }
    function nextVisible(i, dir) { for (var j = i + dir; j >= 0 && j < rows.length; j += dir) if (!rows[j].node.hidden) return rows[j]; return null; }
    function makeRow(s) {
      var r = { s: s, vals: {}, state: '', rec: null, orig: null, cells: [], touched: false, fail: '', pending: false, editable: true };
      var nm = h('button', { class: 'be-name linkbtn', type: 'button', text: s.full_name, title: 'פתיחת כרטיס החניך', onclick: function () { go('soldier/' + s.id); } });
      var cells = cfg.cols.map(function (c, ci) { var inp = h('input', { class: 'be-in', id: 'be_' + s.id + '_' + c.n, inputmode: c.int ? 'numeric' : 'decimal', autocomplete: 'off', enterkeyhint: 'next', maxlength: '8', 'aria-label': s.full_name + ' — ' + c.l, dir: 'ltr' });
        inp.addEventListener('input', function () { r.vals[c.n] = inp.value; r.touched = true; r.fail = ''; paintRow(r); paintProgress(); if (filt.st !== 'all') applyFilter(); });
        inp.addEventListener('keydown', function (e) { var i = rows.indexOf(r); if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); var n = nextVisible(i, 1); if (n) focusCell(n, ci); else if (e.key === 'Enter' && ci + 1 < cfg.cols.length) { var f = rows.filter(function (x) { return !x.node.hidden; })[0]; focusCell(f, ci + 1); } else { var sv = $('#beSave'); if (sv && !sv.disabled) sv.focus(); } } else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(nextVisible(i, -1), ci); } });
        var lab = h('label', { class: 'be-cell', for: inp.id }, [h('span', { class: 'be-lab', text: c.l }), inp]); r.cells.push({ c: c, inp: inp }); return lab; });
      var sel = h('select', { class: 'be-state', 'aria-label': s.full_name + ' — מצב' }, [['', 'מצב: להזנה'], ['absent', 'נעדר'], ['exempt', 'פטור']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      sel.addEventListener('change', function () { r.state = sel.value; r.touched = true; if (r.state) { cfg.cols.forEach(function (c) { r.vals[c.n] = ''; }); r.cells.forEach(function (x) { x.inp.value = ''; }); } paintRow(r); paintProgress(); });
      r.sel = sel; r.msg = h('div', { class: 'be-msg', 'aria-live': 'polite' });
      r.node = h('div', { class: 'be-row be-empty', 'data-sid': s.id }, [h('div', { class: 'be-who' }, [nm, h('small', { class: 'muted', text: (s.team_name || s.department_name || '').replace(/\s*\(זמני\)/g, '') })]), h('div', { class: 'be-cells' }, cells), sel, r.msg]);
      return r;
    }
    function overlay() {   // put the saved results of the chosen test onto the rows (rows the person already touched keep their own typing)
      var by = {}; (existing || []).forEach(function (x) { if (x.record_status === 'cancelled') return; (by[x.soldier_id] = by[x.soldier_id] || []).push(x); });
      rows.forEach(function (r) { var ex = by[r.s.id] && by[r.s.id][0]; if (!ex) { if (r.rec) { r.rec = null; r.orig = null; } return; } r.rec = ex; r.orig = cfg.recVals(ex); r.editable = isAdmin() || ex.own === true || C.mode !== 'server'; r.state = ''; r.sel.value = ''; if (!r.touched || sameVals(r)) { cfg.cols.forEach(function (c) { r.vals[c.n] = r.orig[c.n] === undefined || r.orig[c.n] === null ? '' : String(r.orig[c.n]); }); r.cells.forEach(function (x) { x.inp.value = r.vals[x.c.n]; }); r.touched = false; } r.dup = by[r.s.id].length > 1; });
    }
    function sameVals(r) { return cfg.cols.every(function (c) { return String(colVal(r, c)) === String(r.orig[c.n] === undefined || r.orig[c.n] === null ? '' : r.orig[c.n]); }); }
    function loadExisting() { var o = shared(); if (!cfg.existingKey(o)) { existing = []; overlay(); refreshAll(); return Promise.resolve(); } return cfg.existing(o).then(function (r) { if (!r.ok) { toast(msgOf(r), 'err'); return; } existing = r.data || []; (cfg.sharedEdit || []).forEach(function (n) { var el = $('#be_' + n), ex = existing.filter(function (x) { return x.record_status !== 'cancelled'; })[0]; if (el && String(el.value).trim() === '' && ex && ex[n] !== undefined && ex[n] !== null) el.value = String(ex[n]); }); overlay(); refreshAll(); applyFilter(); }); }
    function build() {
      holder.replaceChildren();
      if (!sols().length) { holder.append(emptyBox('אין חניכים פעילים בהרשאה שלכם.')); return; }
      var cfgShared = cfg.shared.map(function (f) { var inp; if (f.t === 'select') inp = h('select', { id: 'be_' + f.n }, [h('option', { value: '', text: 'בחרו…' })].concat(f.o(P).map(function (x) { return h('option', { value: x[0], text: x[1] }); }))); else { inp = h('input', { id: 'be_' + f.n, type: f.t === 'date' ? 'date' : 'text', inputmode: f.t === 'number' ? (f.int ? 'numeric' : 'decimal') : null, autocomplete: 'off', value: f.def === 'today' ? today() : (f.def || '') }); }
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
          var fresh = by[r.s.id] && by[r.s.id][0], vals = {}; cfg.cols.forEach(function (c) { vals[c.n] = numParse(colVal(r, c)).n; });
          if (!r.rec && fresh) {   // somebody (or an earlier lost reply) already saved this soldier for this test: never create a second record
            var fv = cfg.recVals(fresh), same = cfg.cols.every(function (c) { return Number(fv[c.n]) === vals[c.n]; });
            if (same) { r.rec = fresh; r.orig = fv; r.editable = isAdmin() || fresh.own === true || C.mode !== 'server'; r.fail = ''; ok.push(r); return Promise.resolve(); }
            r.fail = 'כבר קיימת תוצאה שנשמרה בינתיים (' + cfg.cols.map(function (c) { return fv[c.n]; }).join(' / ') + ') — רעננו כדי לערוך אותה'; fail.push(r); return Promise.resolve(); }
          if (r.rec) { var fr = fresh && fresh.id === r.rec.id ? fresh : null; if (!fr) { r.fail = 'התוצאה השמורה לא נמצאה/בוטלה — רעננו'; fail.push(r); return Promise.resolve(); } var fv2 = cfg.recVals(fr); if (!cfg.cols.every(function (c) { return Number(fv2[c.n]) === Number(r.orig[c.n]); })) { r.fail = 'התוצאה עודכנה בינתיים על ידי משתמש אחר (' + cfg.cols.map(function (c) { return fv2[c.n]; }).join(' / ') + ') — לא נדרסה. רעננו ונסו שוב'; fail.push(r); return Promise.resolve(); } }
          var call;
          if (r.rec) { var patch = {}, chg = {}; cfg.cols.forEach(function (c) { if (Number(r.orig[c.n]) !== vals[c.n]) patch[c.n] = vals[c.n]; }); (cfg.sharedEdit || []).forEach(function (n) { var v = numParse(o[n]).n; if (Number(r.orig[n]) !== v) patch[n] = v; });
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
