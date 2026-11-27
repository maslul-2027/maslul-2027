/* MASLUL 2027 — "הזנה" tab: the data-entry centre.
   It only LINKS to the entry screens that already exist (D.<domain>.forms — the same API, models, permissions and verification as before); nothing is copied.
   An entry is shown only if it exists in the domain table, the account may write (viewers get a read-only explanation) and the form is not admin-only for this account.
   "Recent" is kept in memory for this page session only (route ids, never data; no browser storage). */
  var EH_RECENT = [];
  var EH_ITEMS = [
    /* group entry — many soldiers, one screen */
    { id: 'nav-g', kind: 'g', dom: 'nav', re: /קבוצתית/, icon: '🧭', name: 'ניווט', desc: 'ציונים לכמה חניכים ברצף' },
    { id: 'fit-g', kind: 'g', dom: 'fitness', re: /קבוצתית/, icon: '🏃', name: 'כשירות גופנית', desc: 'כש״ג רגיל — טבלה אחת' },
    { id: 'exam-g', kind: 'g', dom: 'exams', re: /קבוצתית/, icon: '📝', name: 'מבחנים עיוניים', desc: 'מועד א׳ / ב׳ / ג׳' },
    { id: 'mk-g', kind: 'g', dom: 'mk', re: /קבוצתית — קליעה רגילה|קליעה רגילה/, icon: '🎯', name: 'קליעה רגילה', desc: 'תוצאות לכמה חניכים' },
    { id: 'ylm-g', kind: 'g', dom: 'mk', re: /יל״מ/, icon: '🎯', name: 'קליעה יל״מ', desc: 'מסך נפרד מהקליעה הרגילה' },
    { id: 'rdy-g', kind: 'g', dom: 'readiness', re: /קבוצתי/, icon: '🩺', name: 'כשירות מבצעית', desc: 'עדכון סטטוס לכמה חניכים' },
    { id: 'asm-g', kind: 'g', dom: 'events', re: /מעבר רציף/, icon: '🏅', name: 'הערכות מפקד', desc: 'מעבר רציף בין חניכים' },
    { id: 'qual-g', kind: 'g', dom: 'qual', re: /קבוצתי/, icon: '🎖', name: 'עדכון הסמכות', desc: 'עדכון הסמכה לכמה חניכים' },
    /* personal entry — one soldier / one event */
    { id: 'att-p', kind: 'p', dom: 'attendance', re: /אירוע נוכחות/, icon: '📅', name: 'נוכחות והיעדרות', desc: 'אירוע נוכחות חדש' },
    { id: 'fit-p', kind: 'p', dom: 'fitness', re: /בודד/, icon: '🏃', name: 'כשירות גופנית', desc: 'מבחן אחד לחניך' },
    { id: 'nav-p', kind: 'p', dom: 'nav', re: /בודדת/, icon: '🧭', name: 'ניווט', desc: 'תוצאה אחת לחניך' },
    { id: 'exam-p', kind: 'p', dom: 'exams', re: /הזנת מועד/, icon: '📝', name: 'מבחן עיוני', desc: 'מועד אחד לחניך' },
    { id: 'mk-p', kind: 'p', dom: 'mk', re: /בודד/, icon: '🎯', name: 'קליעה / יל״מ', desc: 'תוצאה אחת לחניך' },
    { id: 'mar-p', kind: 'p', dom: 'marches', re: /מסע חדש/, icon: '🥾', name: 'מסע', desc: 'הוספת מסע' },
    { id: 'rdy-p', kind: 'p', dom: 'readiness', re: /בודד/, icon: '🩺', name: 'כשירות מבצעית', desc: 'עדכון לחניך אחד' },
    { id: 'evt-p', kind: 'p', dom: 'events', re: /אירוע \/ הישג/, icon: '🏅', name: 'אירוע או הישג', desc: 'רישום לחניך' }
  ];
  function ehResolve(it) {
    var d = D[it.dom]; if (!d || !d.forms) return null;
    for (var i = 0; i < d.forms.length; i++) { var f = d.forms[i]; if (it.re.test(f.t || '') && !(f.admin && !isAdmin()) && (it.kind === 'g' ? !!f.screen : !f.screen)) return i; }
    return null;
  }
  function ehOpen(it, idx) { EH_RECENT = [it.id].concat(EH_RECENT.filter(function (x) { return x !== it.id; })).slice(0, 4); go('d/' + it.dom + '/' + idx); }
  function EntryHub() {
    var viewer = C.mode === 'server' && C.role === 'viewer';
    var items = viewer ? [] : EH_ITEMS.map(function (it) { var idx = ehResolve(it); return idx === null ? null : { it: it, idx: idx }; }).filter(Boolean);
    var nodes = [sectionHead('הזנה', 'בחרו מה להזין — הכול נשמר בשרת ומאומת')];
    if (viewer) { nodes.push(emptyBox('לחשבון צפייה אין הרשאת הזנה. אפשר לצפות בנתונים בלשוניות ״חניכים״ ו״עוד״.')); mount('entry', nodes, 'הזנה'); return; }
    if (!items.length) { nodes.push(emptyBox('אין כרגע פעולות הזנה זמינות לחשבון זה.')); mount('entry', nodes, 'הזנה'); return; }
    function tile(x, cls) { return h('button', { class: 'eh-tile ' + cls, type: 'button', id: 'eh_' + x.it.id, 'data-entry': x.it.id, onclick: function () { ehOpen(x.it, x.idx); } }, [h('span', { class: 'eh-ic', 'aria-hidden': 'true', text: x.it.icon }), h('span', { class: 'eh-tx' }, [h('strong', { text: x.it.name }), h('small', { text: x.it.desc })]), h('span', { class: 'arrow', 'aria-hidden': 'true', text: '←' })]); }
    var recent = EH_RECENT.map(function (id) { return items.filter(function (x) { return x.it.id === id; })[0]; }).filter(Boolean);
    if (recent.length) nodes.push(h('section', { 'aria-labelledby': 'ehRecH', class: 'eh-sec' }, [h('h2', { id: 'ehRecH', class: 'eh-h', text: 'נפתחו לאחרונה' }), h('div', { class: 'eh-chips' }, recent.map(function (x) { return h('button', { class: 'chip', type: 'button', 'data-recent': x.it.id, text: (x.it.kind === 'g' ? 'קבוצתית · ' : 'אישית · ') + x.it.name, onclick: function () { ehOpen(x.it, x.idx); } }); }))]));
    var g = items.filter(function (x) { return x.it.kind === 'g'; }), p = items.filter(function (x) { return x.it.kind === 'p'; });
    if (g.length) nodes.push(h('section', { 'aria-labelledby': 'ehGH', class: 'eh-sec' }, [h('h2', { id: 'ehGH', class: 'eh-h', text: 'הזנה קבוצתית' }), h('p', { class: 'muted eh-sub', text: 'כמה חניכים במסך אחד — המהיר ביותר לתוצאות מבחן.' }), h('div', { class: 'eh-grid' }, g.map(function (x) { return tile(x, 'eh-g'); }))]));
    if (p.length) nodes.push(h('section', { 'aria-labelledby': 'ehPH', class: 'eh-sec' }, [h('h2', { id: 'ehPH', class: 'eh-h', text: 'הזנה אישית' }), h('p', { class: 'muted eh-sub', text: 'חניך אחד או אירוע אחד.' }), h('div', { class: 'eh-list' }, p.map(function (x) { return tile(x, 'eh-p'); }))]));
    nodes.push(h('div', { class: 'btns' }, [h('button', { class: 'secondary', type: 'button', id: 'ehMore', text: 'כל המסכים, הרשימות והדוחות ב״עוד״', onclick: function () { go('more'); } })]));
    mount('entry', nodes, 'הזנה');
  }
  window.EntryHub = EntryHub;
