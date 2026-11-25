/* MASLUL native client — SERVER mode (private TEST). All data/logic is on the authenticated server; identity is the HttpOnly session cookie. SYNTHETIC DATA ONLY.
   Same evidence recording as the preview client (UI vs direct vs gesture) so the 174-route ledger logic applies; no data is stored in the browser except the CSRF token (sessionStorage). */
(function () {
  var WRITE = /__WRITE_SRC__/i, CSRF = '', ME = null, calls = {}, live = {}, IDEM = {}, memo = {}, MEMO_MS = 4000, SK = 'maslul_srv_csrf';
  try { CSRF = sessionStorage.getItem(SK) || ''; calls = JSON.parse(sessionStorage.getItem('maslul_calls') || '{}') || {}; } catch (e) {}
  var lastGesture = 0; ['click', 'change', 'input', 'submit', 'keydown', 'pointerup'].forEach(function (ev) { document.addEventListener(ev, function (e) { if (e.isTrusted) lastGesture = Date.now(); }, true); });
  function rec(m, r, src, gest) { var c = calls[m] || (calls[m] = { ok: 0, ui_ok: 0, direct_ok: 0, gesture_ok: 0, codes: {} }); if (r && r.ok) { c.ok++; if (src === 'direct') c.direct_ok = (c.direct_ok || 0) + 1; else { c.ui_ok = (c.ui_ok || 0) + 1; if (gest) c.gesture_ok = (c.gesture_ok || 0) + 1; } } else { var k = (r && r.code) || 'ERR'; c.codes[k] = (c.codes[k] || 0) + 1; } try { sessionStorage.setItem('maslul_calls', JSON.stringify(calls)); } catch (e) {} }
  function copy(x) { try { return typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)); } catch (e) { return x; } }
  function idem(rk) { var n = Date.now(), e = IDEM[rk]; if (e && n - e.t < 60000) return e.k; var k = 'i' + n.toString(36) + Math.random().toString(36).slice(2, 12); IDEM[rk] = { k: k, t: n }; return k; }
  function http(method, path, body) {
    var h = { 'content-type': 'application/json' }; if (CSRF && method !== 'GET') h['x-csrf-token'] = CSRF;
    return fetch(path, { method: method, credentials: 'same-origin', headers: h, body: method === 'GET' ? undefined : JSON.stringify(body || {}) }).then(function (r) { return r.json().catch(function () { return { ok: false, code: 'NETWORK', message: 'תשובה לא תקינה מהשרת.' }; }); }).catch(function () { return { ok: false, code: 'NETWORK', message: 'אין תקשורת עם השרת. נסו שוב.' }; });
  }
  function expired(r) { if (r && r.code === 'UNAUTHENTICATED' && ME) { try { sessionStorage.removeItem(SK); } catch (e) {} location.reload(); } return r; }
  var client = { mode: 'server', calls: calls,
    api: function (method, args, src) {
      var gest = (Date.now() - lastGesture) < 1500, a = args || {}, wr = WRITE.test(String(method)), rk = null, key = null;
      if (wr && ME && ME.role === 'viewer') { var d = { ok: false, code: 'FORBIDDEN', message: 'חשבון צפייה בלבד — אי אפשר לבצע שינויים.' }; rec(method, d, src, gest); return Promise.resolve(d); }
      try { rk = method + '\u0001' + JSON.stringify(a); if (!wr) key = rk; } catch (e) {}
      if (wr) memo = {};   /* any change made through this client drops every remembered read: a screen opened right after a save always shows the saved state */
      if (key && src !== 'fresh' && gest && src !== 'direct' && memo[key] && Date.now() - memo[key].t < MEMO_MS) { var hit = copy(memo[key].r); rec(method, hit, src, gest); client.api(method, a, 'fresh'); return Promise.resolve(hit); }   /* paint from memory at once (only for screens opened by a real tap or the warm-up; a program call always asks the server) and revalidate in the background, so a revoked session is signed out right away */   /* short-lived read memo: a tab revisited within a few seconds paints at once instead of re-showing a skeleton */
      if (key && live[key]) return live[key]; var send = a; if (wr && rk && typeof a === 'object' && !Array.isArray(a)) { send = Object.assign({}, a); send.idem_ = idem(rk); }
      var p = http('POST', '/api', { method: method, args: send }).then(function (r) { if (wr && rk) { if (r && r.ok === false && r.code !== 'BUSY') delete IDEM[rk]; else if (IDEM[rk]) IDEM[rk].t = Date.now() - 55000; } rec(method, r, src, gest); if (wr) memo = {}; else if (key && r && r.ok === true) memo[key] = { t: Date.now(), r: copy(r) }; return expired(r); });
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
    logout: function () { memo = {}; return http('POST', '/auth/logout', {}).then(function () { try { sessionStorage.clear(); } catch (e) {} location.reload(); }); },
    get role() { return ME ? ME.role : ''; }, get me() { return ME; } };
  function el(t, a, kids) { var n = document.createElement(t); Object.keys(a || {}).forEach(function (k) { if (k === 'text') n.textContent = a[k]; else if (k === 'onclick') n.onclick = a[k]; else n.setAttribute(k, a[k]); }); (kids || []).forEach(function (c) { if (c) n.append(c); }); return n; }
  function field(label, input) { input.id = input.id || 'au' + Math.random().toString(36).slice(2, 7); return el('div', { class: 'field' }, [el('label', { for: input.id, text: label }), input]); }
  function loginUI() {
    var root = el('main', { id: 'auth', style: 'position:fixed;inset:0;background:#fff;overflow:auto;padding:28px 18px;z-index:50' }), msg = el('div', { role: 'alert', id: 'auMsg', 'aria-live': 'assertive' }), mode = 'login';
    var ph = el('input', { id: 'auPhone', type: 'tel', inputmode: 'tel', autocomplete: 'username', placeholder: '05XXXXXXXX', dir: 'ltr' }), pin = el('input', { id: 'auPin', type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', autocomplete: 'current-password', dir: 'ltr', 'aria-describedby': 'auPinH' }), pin2 = el('input', { id: 'auPin2', type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', autocomplete: 'new-password', dir: 'ltr' }), nm = el('input', { id: 'auName', autocomplete: 'name' });
    var go = el('button', { class: 'primary', type: 'submit', id: 'auGo', text: 'כניסה' }), tabL = el('button', { type: 'button', class: 'secondary', id: 'auTabL', text: 'כניסה', 'aria-pressed': 'true' }), tabR = el('button', { type: 'button', class: 'secondary', id: 'auTabR', text: 'בקשת גישה', 'aria-pressed': 'false' });
    var fn = field('שם מלא', nm), fp2 = field('אימות PIN', pin2), form = el('form', { novalidate: 'true' }, [fn, field('טלפון', ph), field('PIN בן 4 ספרות', pin), el('p', { class: 'muted', id: 'auPinH', text: 'PIN לא יכול להיות פשוט (0000, 1234…).' }), fp2, msg, el('div', { class: 'btns' }, [go])]);
    function setMode(m) { mode = m; fn.hidden = fp2.hidden = m === 'login'; go.textContent = m === 'login' ? 'כניסה' : 'שליחת בקשת גישה'; tabL.setAttribute('aria-pressed', String(m === 'login')); tabR.setAttribute('aria-pressed', String(m !== 'login')); msg.textContent = ''; msg.className = ''; pin.autocomplete = m === 'login' ? 'current-password' : 'new-password'; }
    tabL.onclick = function () { setMode('login'); }; tabR.onclick = function () { setMode('register'); }; setMode('login');
    form.addEventListener('submit', function (e) {
      e.preventDefault(); msg.textContent = ''; msg.className = ''; if (!/^\d{4}$/.test(pin.value)) { msg.textContent = 'PIN חייב להיות 4 ספרות.'; msg.className = 'msg err'; return; }
      if (mode === 'register' && pin.value !== pin2.value) { msg.textContent = 'אימות ה-PIN אינו תואם.'; msg.className = 'msg err'; return; }
      go.disabled = true; go.setAttribute('aria-busy', 'true');
      http('POST', mode === 'login' ? '/auth/login' : '/auth/register', mode === 'login' ? { phone: ph.value, pin: pin.value } : { fullName: nm.value, phone: ph.value, pin: pin.value }).then(function (r) {
        go.disabled = false; go.removeAttribute('aria-busy'); pin.value = ''; pin2.value = '';
        if (!r.ok) { msg.textContent = r.message || 'הפעולה נכשלה.'; msg.className = 'msg err'; return; }
        if (mode === 'register') { msg.textContent = 'הבקשה נשלחה. המנהל יאשר אותה — לאחר מכן אפשר להיכנס.'; msg.className = 'msg ok'; setMode('login'); msg.textContent = 'הבקשה נשלחה. המנהל יאשר אותה — לאחר מכן אפשר להיכנס.'; msg.className = 'msg ok'; return; }
        CSRF = r.csrf || ''; try { sessionStorage.setItem(SK, CSRF); } catch (e) {} location.reload();
      });
    });
    root.append(el('h1', { class: 'page', text: 'MASLUL 2027' }), el('p', { class: 'muted', text: 'סביבת בדיקה פרטית — נתונים סינתטיים בלבד. אין אימות בעלות על מספר הטלפון בסביבה זו; אין להזין מידע אמיתי.' }), el('div', { class: 'btns', role: 'group', 'aria-label': 'סוג פעולה' }, [tabL, tabR]), form);
    ['.app', 'nav.nav'].forEach(function (q) { var x = document.querySelector(q); if (x) x.style.display = 'none'; }); document.body.append(root); setTimeout(function () { ph.focus(); }, 50);
  }
  client.ready = http('GET', '/auth/me').then(function (r) {
    if (!r.ok) { loginUI(); return new Promise(function () {}); }
    CSRF = r.csrf || CSRF; try { sessionStorage.setItem(SK, CSRF); } catch (e) {} ME = r; return http('POST', '/api', { method: 'whoAmI', args: {} }).then(function (w) { if (w && w.ok) ME = Object.assign({}, r, { name: w.data.displayName, readOnly: !!w.data.readOnly }); });
  });
  window.appClient = client;
})();
