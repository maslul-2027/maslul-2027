/* MASLUL native client — CLOUDFLARE shared TEST (Workers Free + D1). Same data layer as the private TEST client, NEW sign-in: admin approval -> one-time enrolment link -> access code + authenticator app (no PIN). All data/logic is on the authenticated server; identity is the HttpOnly session cookie. SYNTHETIC DATA ONLY.
   Same evidence recording as the preview client (UI vs direct vs gesture) so the 174-route ledger logic applies; no data is stored in the browser except the CSRF token (sessionStorage). */
(function () {
  var WRITE = /__WRITE_SRC__/i, CSRF = '', ME = null, calls = {}, live = {}, IDEM = {}, SK = 'maslul_srv_csrf';
  try { CSRF = sessionStorage.getItem(SK) || ''; calls = JSON.parse(sessionStorage.getItem('maslul_calls') || '{}') || {}; } catch (e) {}
  var lastGesture = 0; ['click', 'change', 'input', 'submit', 'keydown', 'pointerup'].forEach(function (ev) { document.addEventListener(ev, function (e) { if (e.isTrusted) lastGesture = Date.now(); }, true); });
  function rec(m, r, src, gest) { var c = calls[m] || (calls[m] = { ok: 0, ui_ok: 0, direct_ok: 0, gesture_ok: 0, codes: {} }); if (r && r.ok) { c.ok++; if (src === 'direct') c.direct_ok = (c.direct_ok || 0) + 1; else { c.ui_ok = (c.ui_ok || 0) + 1; if (gest) c.gesture_ok = (c.gesture_ok || 0) + 1; } } else { var k = (r && r.code) || 'ERR'; c.codes[k] = (c.codes[k] || 0) + 1; } try { sessionStorage.setItem('maslul_calls', JSON.stringify(calls)); } catch (e) {} }
  function idem(rk) { var n = Date.now(), e = IDEM[rk]; if (e && n - e.t < (e.u ? 240000 : 60000)) return e.k; var k = 'i' + n.toString(36) + Math.random().toString(36).slice(2, 12); IDEM[rk] = { k: k, t: n }; return k; }
  /* A write whose answer never arrived (network drop, Cloudflare 5xx/429 page, non-JSON reply) may or may not have been saved on the server: say so honestly, never "nothing happened". The idempotency key is KEPT, so pressing the same action again is replayed by the server instead of saving twice. */
  var UNKNOWN = { ok: false, code: 'UNKNOWN_OUTCOME', message: 'לא ניתן לאשר אם הפעולה נשמרה. רעננו את המסך ובדקו אם השינוי מופיע; אם לא — נסו שוב (שליחה חוזרת אינה יוצרת כפילות).' };
  function http(method, path, body, isWrite) {
    var h = { 'content-type': 'application/json' }; if (CSRF && method !== 'GET') h['x-csrf-token'] = CSRF;
    function fail(code, readMsg) { return isWrite ? Object.assign({}, UNKNOWN) : { ok: false, code: code, message: readMsg }; }
    return fetch(path, { method: method, credentials: 'same-origin', headers: h, body: method === 'GET' ? undefined : JSON.stringify(body || {}) }).then(function (r) { return r.json().catch(function () { return r.status >= 500 || r.status === 429 ? fail('PLATFORM_LIMIT', 'השרת החינמי לא הצליח לעבד את הבקשה (מגבלת עיבוד או עומס של הפלטפורמה). נסו שוב בעוד רגע, או פתחו מסך קל יותר. אין צורך בשדרוג או תשלום.') : fail('NETWORK', 'תשובה לא תקינה מהשרת.'); }); }).catch(function () { return fail('NETWORK', 'אין תקשורת עם השרת. נסו שוב.'); });
  }
  function expired(r) { if (r && r.code === 'UNAUTHENTICATED' && ME) { try { sessionStorage.removeItem(SK); } catch (e) {} location.reload(); } return r; }
  var client = { mode: 'server', cf: true, calls: calls,
    api: function (method, args, src) {
      var gest = (Date.now() - lastGesture) < 1500, a = args || {}, wr = WRITE.test(String(method)), rk = null, key = null;
      if (wr && ME && ME.role === 'viewer') { var d = { ok: false, code: 'FORBIDDEN', message: 'חשבון צפייה בלבד — אי אפשר לבצע שינויים.' }; rec(method, d, src, gest); return Promise.resolve(d); }
      try { rk = method + '\u0001' + JSON.stringify(a); if (!wr) key = rk; } catch (e) {}
      if (key && live[key]) return live[key]; var send = a; if (wr && rk && typeof a === 'object' && !Array.isArray(a)) { send = Object.assign({}, a); send.idem_ = idem(rk); }
      var p = http('POST', '/api', { method: method, args: send }, wr).then(function (r) { if (wr && rk) { if (r && r.ok === false && r.code === 'UNKNOWN_OUTCOME') { if (IDEM[rk]) { IDEM[rk].u = true; IDEM[rk].t = Date.now(); } } else if (r && r.ok === false && r.code !== 'BUSY') delete IDEM[rk]; else if (IDEM[rk]) IDEM[rk].t = Date.now() - 55000; } rec(method, r, src, gest); return expired(r); });
      if (key) { live[key] = p; var fin = function () { if (live[key] === p) delete live[key]; }; p.then(fin, fin); } return p;
    },
    /* REAL file download (generated report): authenticated GET → binary → browser download. The server re-checks role/scope; nothing is fabricated client-side. Records evidence for reports.download like any other call. */
    download: function (id, kind) {
      var gest = (Date.now() - lastGesture) < 1500, K = kind === 'document' ? ['document', 'docs.download'] : ['report', 'reports.download'];
      return fetch('/api/download/' + K[0] + '/' + encodeURIComponent(String(id)), { method: 'GET', credentials: 'same-origin', headers: {} }).then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { var d = { ok: false, code: (j && j.code) || 'ERR', message: (j && j.message) || 'ההורדה נכשלה.' }; rec(K[1], d, 'ui', gest); return expired(d); });
        var cd = r.headers.get('content-disposition') || '', m = /filename="([^"]+)"/.exec(cd), name = m ? m[1] : 'maslul-report', type = r.headers.get('content-type') || 'application/octet-stream';
        return r.blob().then(function (b) {
          if (!b.size) { var e = { ok: false, code: 'EMPTY', message: 'הקובץ ריק.' }; rec(K[1], e, 'ui', gest); return e; }
          var u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = name; a.rel = 'noopener'; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(u); }, 4000);
          var ok = { ok: true, filename: name, type: type, bytes: b.size }; rec(K[1], ok, 'ui', gest); return ok; });
      }).catch(function () { return { ok: false, code: 'NETWORK', message: 'אין תקשורת עם השרת. נסו שוב.' }; });
    },
    /* gateway (auth/admin) calls: not part of the 174 engine routes */
    gw: function (method, path, body) { return http(method, path, body).then(expired); },
    logout: function () { return http('POST', '/auth/logout', {}).then(function () { try { sessionStorage.clear(); } catch (e) {} location.reload(); }); },
    get role() { return ME ? ME.role : ''; }, get me() { return ME; } };
  function el(t, a, kids) { var n = document.createElement(t); Object.keys(a || {}).forEach(function (k) { if (k === 'text') n.textContent = a[k]; else if (k === 'onclick') n.onclick = a[k]; else n.setAttribute(k, a[k]); }); (kids || []).forEach(function (c) { if (c) n.append(c); }); return n; }
  function field(label, input) { input.id = input.id || 'au' + Math.random().toString(36).slice(2, 7); return el('div', { class: 'field' }, [el('label', { for: input.id, text: label }), input]); }
  function mkInput(id, type, label, extra) { var i = el('input', Object.assign({ id: id, type: type, autocomplete: 'off', dir: 'ltr' }, extra || {})); return { i: i, f: field(label, i) }; }
  function screen(children) { var root = el('main', { id: 'auth', style: 'position:fixed;inset:0;background:#fff;overflow:auto;padding:28px 18px;z-index:50' }, children); ['.app', 'nav.nav'].forEach(function (q) { var x = document.querySelector(q); if (x) x.style.display = 'none'; }); var old = document.getElementById('auth'); if (old) old.remove(); document.body.append(root); return root; }
  function banner() { return [el('h1', { class: 'page', text: 'MASLUL 2027' }), el('p', { class: 'muted', text: 'סביבת בדיקה משותפת — נתונים סינתטיים בלבד. כניסה באמצעות קוד גישה אישי ואפליקציית אימות בטלפון.' })]; }
  function note(msg, ok) { msg.textContent = ''; msg.className = ''; return function (t) { msg.textContent = t; msg.className = ok ? 'msg ok' : 'msg err'; }; }
  function loginUI(needsSetup) {
    var msg = el('div', { role: 'alert', id: 'auMsg', 'aria-live': 'assertive' }), mode = 'login';
    var em = mkInput('auEmail', 'email', 'אימייל', { autocomplete: 'username', inputmode: 'email' }), ac = mkInput('auCode', 'password', 'קוד אישי (PIN) בן 4 ספרות', { autocomplete: 'current-password', maxlength: '4', inputmode: 'numeric', pattern: '[0-9]*' }), tp = mkInput('auTotp', 'text', 'קוד בן 6 ספרות מאפליקציית האימות', { inputmode: 'numeric', pattern: '[0-9]*', maxlength: '8', autocomplete: 'one-time-code' });
    var nm = mkInput('auName', 'text', 'שם מלא', { dir: 'rtl', autocomplete: 'name' }), bt = mkInput('auBoot', 'password', 'אסימון התקנה (BOOTSTRAP_TOKEN)', { autocomplete: 'off' });
    var go = el('button', { class: 'primary', type: 'submit', id: 'auGo', text: 'כניסה' }), tabs = [['login', 'כניסה'], ['register', 'בקשת גישה']].concat(needsSetup ? [['setup', 'הגדרה ראשונית']] : []), tb = {};
    var form = el('form', { novalidate: 'true' }, [nm.f, em.f, ac.f, tp.f, bt.f, go]), bar = el('div', { class: 'row2', role: 'group', 'aria-label': 'מצב' }, tabs.map(function (t) { var b = el('button', { type: 'button', class: 'secondary', id: 'auTab_' + t[0], text: t[1], 'aria-pressed': 'false' }); b.onclick = function () { setMode(t[0]); }; tb[t[0]] = b; return b; }));
    function setMode(m) { mode = m; nm.f.hidden = m === 'login'; ac.f.hidden = tp.f.hidden = m !== 'login'; bt.f.hidden = m !== 'setup'; go.textContent = m === 'login' ? 'כניסה' : m === 'register' ? 'שליחת בקשת גישה' : 'יצירת מנהל ראשון'; Object.keys(tb).forEach(function (k) { tb[k].setAttribute('aria-pressed', String(k === m)); }); msg.textContent = ''; msg.className = ''; }
    setMode('login');
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var say = note(msg); go.disabled = true; go.setAttribute('aria-busy', 'true');
      var req = mode === 'login' ? http('POST', '/auth/login', { email: em.i.value, pin: ac.i.value, code: tp.i.value }) : mode === 'register' ? http('POST', '/auth/register', { fullName: nm.i.value, email: em.i.value }) : http('POST', '/auth/bootstrap', { token: bt.i.value, fullName: nm.i.value, email: em.i.value });
      req.then(function (r) { go.disabled = false; go.removeAttribute('aria-busy'); ac.i.value = ''; tp.i.value = ''; bt.i.value = '';
        if (!r.ok) { say(r.message || 'הפעולה נכשלה.'); msg.className = 'msg err'; return; }
        if (mode === 'register') { msg.textContent = 'הבקשה נשלחה. המנהל יאשר אותה וישלח לכם קישור הצטרפות.'; msg.className = 'msg ok'; return; }
        if (mode === 'setup') { enrollUI(r.enrollToken); return; }
        CSRF = r.csrf || ''; try { sessionStorage.setItem(SK, CSRF); } catch (x) {} location.reload(); });
    });
    screen(banner().concat([bar, form, msg, el('p', { class: 'muted', text: 'עדיין אין לכם חשבון? בקשו גישה מהמנהל — הוא ישלח קישור הצטרפות חד־פעמי.' })])); setTimeout(function () { em.i.focus(); }, 50);
  }
  function enrollUI(token) {
    var msg = el('div', { role: 'alert', id: 'enMsg', 'aria-live': 'assertive' }), box = el('div', {});
    http('POST', '/auth/enroll/start', { token: token }).then(function (s) {
      if (!s.ok) { msg.textContent = s.message || 'הקישור אינו תקף.'; msg.className = 'msg err'; box.append(el('button', { class: 'secondary', type: 'button', text: 'חזרה לכניסה', onclick: function () { location.hash = ''; location.reload(); } })); return; }
      var pn = mkInput('enPin', 'password', 'בחרו קוד אישי (PIN) בן 4 ספרות', { inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', autocomplete: 'new-password' }), pn2 = mkInput('enPin2', 'password', 'הקלידו שוב את ה-PIN', { inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', autocomplete: 'new-password' }), cd = mkInput('enCode', 'text', 'קוד בן 6 ספרות מהאפליקציה', { inputmode: 'numeric', pattern: '[0-9]*', maxlength: '8', autocomplete: 'one-time-code' }), ok = el('button', { class: 'primary', type: 'submit', id: 'enGo', text: 'אימות והפעלת החשבון' });
      var otp = el('a', { id: 'enOtp', href: s.otpauth, text: 'פתיחה באפליקציית האימות (בטלפון)' });
      var form = el('form', { novalidate: 'true' }, [pn.f, pn2.f, cd.f, ok]);
      form.addEventListener('submit', function (e) { e.preventDefault(); if (!/^\d{4}$/.test(pn.i.value)) { msg.textContent = 'ה-PIN חייב להיות בדיוק 4 ספרות.'; msg.className = 'msg err'; return; } if (pn.i.value !== pn2.i.value) { msg.textContent = 'שני ה-PIN אינם זהים.'; msg.className = 'msg err'; return; } ok.disabled = true; http('POST', '/auth/enroll/confirm', { token: token, pin: pn.i.value, code: cd.i.value }).then(function (r) { ok.disabled = false; if (!r.ok) { msg.textContent = r.message || 'הקוד שגוי.'; msg.className = 'msg err'; return; } try { history.replaceState(null, '', location.pathname); } catch (x) {} box.replaceChildren(el('p', { class: 'msg ok', role: 'status', text: 'החשבון הופעל. בכל כניסה תזינו את ה-PIN שבחרתם וקוד בן 6 ספרות מאפליקציית האימות.' }), el('button', { class: 'primary', id: 'enLogin', type: 'button', text: 'מעבר לכניסה', onclick: function () { loginUI(false); } })); }); });
      box.append(el('p', { text: 'שלום ' + s.name + ' (' + s.email + ')' }), el('h2', { text: '1. הגדרת אפליקציית אימות' }), el('p', {}, [otp]), el('p', { class: 'muted', text: 'או הוסיפו ידנית באפליקציית אימות (Google/Microsoft Authenticator, סיסמאות iOS) את המפתח:' }), el('p', { id: 'enSecret', dir: 'ltr', style: 'font-family:monospace;word-break:break-all;user-select:all', text: s.totpSecret }), el('h2', { text: '2. בחירת PIN ואימות' }), form);
    });
    screen(banner().concat([box, msg]));
  }
  window.addEventListener('hashchange', function () { if (/^#enroll=/.test(location.hash)) route(); });   // a link opened in an already-open tab
  function route() { var m = /^#enroll=([A-Za-z0-9_-]{20,80})$/.exec(location.hash || ''); if (m) { var t = m[1]; try { history.replaceState(null, '', location.pathname); } catch (e) {} enrollUI(t); return true; } return false; }
  client.ready = http('GET', '/auth/me').then(function (r) {
    if (!r.ok) { if (route()) return new Promise(function () {}); return http('GET', '/auth/status').then(function (st) { loginUI(!!(st && st.needsSetup)); if (st && st.configured === false) { var mm = document.getElementById('auMsg'); if (mm) { mm.className = 'msg err'; mm.textContent = 'השרת נפרס אך עדיין לא הוגדר (חסרים סודות אבטחה ב-Cloudflare). כניסה והרשמה חסומות עד שהבעלים משלים את ההגדרה.'; } var gb = document.getElementById('auGo'); if (gb) gb.disabled = true; } return new Promise(function () {}); }); }
    CSRF = r.csrf || CSRF; try { sessionStorage.setItem(SK, CSRF); } catch (e) {} ME = r; return http('POST', '/api', { method: 'whoAmI', args: {} }).then(function (w) { if (w && w.ok) ME = Object.assign({}, r, { name: w.data.displayName, readOnly: !!w.data.readOnly }); });
  });
  window.appClient = client;
})();
