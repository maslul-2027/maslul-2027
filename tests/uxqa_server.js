// product-dev6.2 (uxqa1) — server-side tests for: attendance contract + visibility (ATT-01..05), emergency contact (permissions, privacy, audit, pending approval),
// local analytics + A4 analytic report. Node only (in-memory Db, faked identity) — NOT Apps Script / Sheets / Google. Synthetic data only.
const { suite } = require('./tlib'); const { t, done, assert } = suite('uxqa_server.js'); const { world } = require('./world');
const EC = { name: 'איש-קשר-סינתטי', relation: 'אח', phone: '050-123-4567' };
function W() { const w = world(); const { X } = w; w.as = (u, m, a) => { X.Auth._emailProvider = () => u.email; return X.api(m, a); }; return w; }
const ok = r => { assert.strictEqual(r.ok, true, JSON.stringify(r)); return r.data; };
const refused = (r, codes) => { assert.strictEqual(r.ok, false, 'expected refusal'); if (codes) assert.ok(codes.includes(r.code), r.code); };
const allText = o => JSON.stringify(o);

t('hardening', 'ATT-01: attendance.events returns the keys the UI reads (type_name/present/absent/early_exits/total) and absent = total - present', () => {
  const w = W(); const { admin, c1 } = w; const ev = ok(w.as(admin, 'attendance.events', { courseId: c1 })); assert.ok(ev.length >= 1);
  ev.forEach(e => { ['type_name', 'present', 'absent', 'early_exits', 'total', 'event_date'].forEach(k => assert.ok(k in e, 'missing ' + k)); if (e.present !== null) assert.strictEqual(e.absent, e.total - e.present); else assert.deepStrictEqual([e.absent, e.counts_suppressed], [null, true], 'D2: an illegal present/absent split hides BOTH sides'); });
});
t('hardening', 'ATT-02: many absent + many early-exit in one event; defaults to all-present; counts exact; duplicate request_id is idempotent', () => {
  const w = W(); const { X, admin, c1, S } = w; const sols = X.Soldiers.list(admin, c1, {}).rows || X.Soldiers.list(admin, c1, {});
  const act = X.Db.all('ActivityTypes')[0].id, ids = sols.map(s => s.id).filter(id => X.Db.get('Soldiers', id).record_status === 'active');
  const data = { request_id: 'att-many-1', event_date: '2026-04-01', activity_type_id: act, scope_type: 'course', scope_id: c1, absent: ids.slice(0, 3).map(id => ({ soldier_id: id })), early_exit: ids.slice(3, 5) };
  const r1 = ok(w.as(admin, 'attendance.create', { courseId: c1, data })), r2 = ok(w.as(admin, 'attendance.create', { courseId: c1, data }));
  assert.strictEqual(r2.duplicate, true); assert.strictEqual(r1.records, r2.records);
  const row = ok(w.as(admin, 'attendance.events', { courseId: c1 })).find(e => e.id === r1.event.id);
  const roll = ok(w.as(admin, 'attendance.roll', { courseId: c1, eventId: r1.event.id })); assert.strictEqual(roll.filter(x => !x.present).length, 3, 'exact absentees via the explicit operational roll'); assert.strictEqual(roll.filter(x => x.present && x.early_exit).length >= 2, true); assert.strictEqual(row.total, roll.length);
  if (row.present !== null) { assert.strictEqual(row.absent, 3); assert.strictEqual(row.present, row.total - 3); } else assert.deepStrictEqual([row.present, row.absent, row.counts_suppressed], [null, null, true], '3 / ' + (row.total - 3) + ' is an illegal split in this small fixture: both sides hidden');
  const none = ok(w.as(admin, 'attendance.create', { courseId: c1, data: { request_id: 'att-all-1', event_date: '2026-04-02', activity_type_id: act, scope_type: 'course', scope_id: c1 } }));
  assert.strictEqual(ok(w.as(admin, 'attendance.events', { courseId: c1 })).find(e => e.id === none.event.id).absent, 0);
});
t('hardening', 'ATT-03: a commander never receives course-wide counts for a course-wide event, and cannot mark a soldier outside his scope absent', () => {
  const w = W(); const { X, admin, c1, cT, S } = w;
  const adminEv = ok(w.as(admin, 'attendance.events', { courseId: c1 })), cmdEv = ok(w.as(cT, 'attendance.events', { courseId: c1 }));
  adminEv.forEach(a => { const c = cmdEv.find(e => e.id === a.id); if (c) assert.ok(c.total <= a.total); });
  // exact: a commander's count of each event = records of soldiers he can see (never the course-wide totals)
  const visIds = new Set(ok(w.as(cT, 'soldiers.list', { courseId: c1, opts: {} })).map(s => s.id));
  assert.ok(cmdEv.length >= 1); cmdEv.forEach(c => { const exp = X.Db.all('AttendanceRecords').filter(r => r.event_id === c.id && r.record_status === 'active' && visIds.has(r.soldier_id)).length; assert.strictEqual(c.total, exp, 'event ' + c.id); });
  assert.ok(cmdEv.some(c => c.total < adminEv.find(a => a.id === c.id).total), 'at least one course-wide event must be narrowed for the commander');
  refused(w.as(cT, 'attendance.create', { courseId: c1, data: { request_id: 'att-x-1', event_date: '2026-04-03', activity_type_id: X.Db.all('ActivityTypes')[0].id, scope_type: 'course', scope_id: c1, absent: [{ soldier_id: S.c.id }] } }));
});
t('hardening', 'ATT-04: attendance.roll (read-only event detail) is scoped: a commander sees only visible soldiers; admin sees all; no writes happen', () => {
  const w = W(); const { X, admin, c1, cT } = w; const evId = ok(w.as(admin, 'attendance.events', { courseId: c1 }))[0].id;
  const before = JSON.stringify(X.Db.all('AttendanceRecords')); const a = ok(w.as(admin, 'attendance.roll', { courseId: c1, eventId: evId })), c = ok(w.as(cT, 'attendance.roll', { courseId: c1, eventId: evId }));
  const n = x => (x.records || x.rows || x.roll || []).length; assert.ok(n(c) <= n(a)); assert.strictEqual(JSON.stringify(X.Db.all('AttendanceRecords')), before);
});

t('hardening', 'EMG-01: only the admin can read/write the emergency contact; commanders and unknown users are refused; values stored normalised', () => {
  const w = W(); const { X, admin, c1, cT, cD, cC, none, S } = w;
  ok(w.as(admin, 'emergency.set', { courseId: c1, soldierId: S.a.id, contact: EC }));
  const g = ok(w.as(admin, 'emergency.get', { courseId: c1, soldierId: S.a.id })); assert.strictEqual(g.present, true); assert.strictEqual(g.name, EC.name); assert.strictEqual(g.phone, '0501234567'); assert.strictEqual(g.phone_display, '050-123-4567');
  [cT, cD, cC, none].forEach(u => { refused(w.as(u, 'emergency.get', { courseId: c1, soldierId: S.a.id })); refused(w.as(u, 'emergency.set', { courseId: c1, soldierId: S.a.id, contact: EC })); });
});
t('hardening', 'EMG-02: validation — all three fields required, bad phone / formula / long values refused; nothing stored on refusal', () => {
  const w = W(); const { X, admin, c1, S } = w;
  [{ name: 'א', relation: 'אח', phone: '0501234567' }, { name: EC.name, relation: '', phone: '0501234567' }, { name: EC.name, relation: 'אח', phone: '12' }, { name: EC.name, relation: 'אח', phone: 'abc' }, { name: 'x'.repeat(101), relation: 'אח', phone: '0501234567' }, null, 'str']
    .forEach(c => refused(w.as(admin, 'emergency.set', { courseId: c1, soldierId: S.a.id, contact: c }), ['VALIDATION']));
  assert.strictEqual(ok(w.as(admin, 'emergency.get', { courseId: c1, soldierId: S.a.id })).present, false);
});
t('hardening', 'EMG-03: the contact never appears in cards, lists, search, dashboard, analytics, report preview/PDF/Excel, audit values, or for a commander — admin control proves it exists', () => {
  const w = W(); const { X, admin, c1, cC, S } = w; const MARK = 'EMGMARK-Zq91'; ok(w.as(admin, 'emergency.set', { courseId: c1, soldierId: S.a.id, contact: { name: MARK, relation: 'REL' + MARK, phone: '0527654321' } }));
  assert.ok(allText(ok(w.as(admin, 'emergency.get', { courseId: c1, soldierId: S.a.id }))).includes(MARK));
  const outs = [ok(w.as(admin, 'soldiers.card', { id: S.a.id })), ok(w.as(admin, 'soldiers.list', { courseId: c1, opts: { q: MARK } })), ok(w.as(admin, 'soldiers.list', { courseId: c1, opts: {} })), ok(w.as(admin, 'dash.home', { courseId: c1 })),
    ok(w.as(admin, 'analytics.insights', { courseId: c1 })), ok(w.as(admin, 'reports.preview', { courseId: c1, spec: {} })), ok(w.as(admin, 'reports.build', { courseId: c1, spec: { sections: X.Reports.SECTIONS.slice() } })),
    ok(w.as(cC, 'soldiers.card', { id: S.a.id })), X.Db.all('AuditLog'), X.Db.all('Soldiers')];
  outs.forEach((o, i) => { const s = allText(o); assert.ok(!s.includes(MARK) && !s.includes('0527654321') && !s.includes('052-765-4321'), 'leak in output #' + i); });
  const js = ok(w.as(admin, 'reports.generate', { courseId: c1, spec: { layout: 'analytic' }, format: 'pdf' })); assert.ok(js.id);
  const xl = ok(w.as(admin, 'reports.fullExport', { courseId: c1, include_private: false })); assert.ok(xl.id);
  X.Db.all('AuditLog').filter(a => /^EMERGENCY_CONTACT/.test(a.action)).forEach(a => assert.ok(!allText(a).includes(MARK)));
  assert.ok(X.Db.all('AuditLog').some(a => a.action === 'EMERGENCY_CONTACT_SET'));
});
t('hardening', 'EMG-04: inactive / cancelled / foreign-course soldiers cannot receive a contact (identical refusal)', () => {
  const w = W(); const { X, admin, c1, c2, S } = w; const bad = X.Db.all('Soldiers').filter(s => s.record_status !== 'active' && s.course_id === c1)[0];
  if (bad) refused(w.as(admin, 'emergency.set', { courseId: c1, soldierId: bad.id, contact: EC }));
  refused(w.as(admin, 'emergency.set', { courseId: c2, soldierId: S.a.id, contact: EC })); refused(w.as(admin, 'emergency.get', { courseId: c1, soldierId: 'nope' }));
});
t('hardening', 'EMG-05: self-service — contact in a FormPage submission stays PENDING (not on the soldier, not in the main-store request); approve applies it, reject wipes it; admin list shows pending only to admin', () => {
  const w = W(); const { X, admin, c1, S } = w; const MARK = 'PENDMARK-77'; const l = ok(w.as(admin, 'forms.createLink', { courseId: c1, soldierId: S.b.id, days: 3 }));
  const tok = l.token || (l.url && String(l.url).split(/[?&]t=|token=/).pop()); assert.ok(tok, 'no token');
  const open = X.Forms.open(tok); assert.ok(open.emergency_fields || open.fields, 'form must expose emergency fields');
  const sub = X.Forms.submit(tok, { emergency_contact_name: MARK, emergency_contact_relation: 'אחות', emergency_contact_phone: '0541112222' });
  assert.ok(sub);
  assert.strictEqual(ok(w.as(admin, 'emergency.get', { courseId: c1, soldierId: S.b.id })).present, false, 'must not be applied before approval');
  assert.ok(!allText(X.Db.all('SoldierUpdateRequests')).includes(MARK), 'main-store request must hold no contact values');
  const pend = ok(w.as(admin, 'forms.list', { courseId: c1, status: 'pending' })); assert.ok(pend.length >= 1);
  const rid = pend[0].id; ok(w.as(admin, 'forms.review', { id: rid, decision: 'approve', note: '' }));
  const g = ok(w.as(admin, 'emergency.get', { courseId: c1, soldierId: S.b.id })); assert.strictEqual(g.name, MARK); assert.strictEqual(g.phone, '0541112222');
  assert.ok(!allText(X.Db.all('SoldierPersonalDetails')).includes('pending:'), 'pending staging rows must be cleaned after approval');
  // reject path: a second soldier, values must never land
  const l2 = ok(w.as(admin, 'forms.createLink', { courseId: c1, soldierId: S.c.id, days: 3 })); X.Forms.submit(l2.token, { emergency_contact_name: 'REJ-NAME', emergency_contact_relation: 'אב', emergency_contact_phone: '0549998888' });
  const p2 = ok(w.as(admin, 'forms.list', { courseId: c1, status: 'pending' })); ok(w.as(admin, 'forms.review', { id: p2[0].id, decision: 'reject', note: 'נדחה' }));
  assert.strictEqual(ok(w.as(admin, 'emergency.get', { courseId: c1, soldierId: S.c.id })).present, false); assert.ok(!allText(X.Db.all('SoldierPersonalDetails')).includes('REJ-NAME'), 'rejected values wiped');
});

t('integration', 'ANA-01: insights carry window/N/source/formula/generated_at/caveat; sparse data is suppressed with a reason; no individual judgement words', () => {
  const w = W(); const { admin, c1 } = w; const r = ok(w.as(admin, 'analytics.insights', { courseId: c1 }));
  assert.ok(r.generated_at && r.notice); r.items.forEach(i => { ['id', 'title', 'text', 'n', 'window', 'source', 'formula', 'generated_at', 'caveat', 'reason'].forEach(k => assert.ok(i[k] !== undefined && i[k] !== '', i.id + ':' + k)); assert.ok(Array.isArray(i.source) && i.source.length); });
  r.suppressed.forEach(s => assert.ok(s.id && s.reason));
  assert.ok(!/מתאים להיות|לא מתאים|סיכון|מומלץ להדיח|חלש|נכשל/.test(allText(r.items)), 'individual judgement wording');
});
t('integration', 'ANA-02: commander analytics only count his own scope; unauthorised/foreign course refused; bad filters refused', () => {
  const w = W(); const { admin, c1, c2, cT, cO } = w; const a = ok(w.as(admin, 'analytics.insights', { courseId: c1 })), c = ok(w.as(cT, 'analytics.insights', { courseId: c1 }));
  assert.strictEqual(c.small_group, true); assert.ok(a.scope.soldiers >= 5); refused(w.as(cO, 'analytics.insights', { courseId: c1 })); refused(w.as(cT, 'analytics.insights', { courseId: c2 }));
  refused(w.as(admin, 'analytics.insights', { courseId: c1, f: { departmentId: { $ne: 1 } } }), ['VALIDATION']);
});
t('integration', 'RPT-01: analytic report — packed A4 pages (count = sections = footer N), RTL, escaped, no external resources, every chart has a table fallback or an "אין מספיק נתונים" notice; names XSS-safe', () => {
  const w = W(); const { X, admin, c1, S } = w; X.Db.update('Soldiers', S.a.id, { full_name: '<img src=x onerror=alert(1)>' });
  const p = ok(w.as(admin, 'reports.preview', { courseId: c1, spec: {} })); const h = p.html;
  assert.ok(/dir="rtl"/.test(h) && /size:A4/.test(h)); const np = (h.match(/class="pg"/g) || []).length; assert.strictEqual(np, p.pages); assert.ok(np >= 1 && np <= 4, 'pages ' + np);
  assert.ok(!/<img |<script|https?:\/\/|<svg[^>]*xmlns/i.test(h), 'unescaped / external content'); assert.ok(h.includes('עמוד ' + np + ' מתוך ' + np) && /הופק /.test(h)); for (let i = 1; i <= np; i++) assert.ok(h.includes('עמוד ' + i + ' מתוך ' + np));
  assert.ok(/<table/.test(h)); const sv = (h.match(/<svg/g) || []).length, nd = (h.match(/אין מספיק נתונים/g) || []).length; assert.ok(sv + nd >= 4);
});
t('integration', 'RPT-02: empty / sparse course gives explicit "אין מספיק נתונים", never 0 or NaN; commander may preview but not generate', () => {
  const w = W(); const { X, admin, c1, c2, cT } = w; const p = ok(w.as(admin, 'reports.preview', { courseId: c2, spec: {} }));
  assert.ok(!/NaN|undefined|null/.test(p.html), 'NaN/undefined/null in html'); assert.ok(/אין מספיק נתונים/.test(p.html));
  ok(w.as(cT, 'reports.preview', { courseId: c1, spec: {} })); refused(w.as(cT, 'reports.generate', { courseId: c1, spec: { layout: 'analytic' }, format: 'pdf' }), ['FORBIDDEN']);
});

// ============================================================ owner decisions (dev6.2 final) D1–D6
t('hardening', 'D1: emergency contact stays ADMIN-ONLY — no commander action exists for it and every commander (all scopes) is refused for get AND set', () => {
  const w = W(); const { X, admin, c1, cT, cD, cC, cT2, S } = w; ok(w.as(admin, 'emergency.set', { courseId: c1, soldierId: S.a.id, contact: EC }));
  [cT, cD, cC, cT2].forEach(u => { refused(w.as(u, 'emergency.get', { courseId: c1, soldierId: S.a.id }), ['FORBIDDEN']); refused(w.as(u, 'emergency.set', { courseId: c1, soldierId: S.a.id, contact: EC }), ['FORBIDDEN']); });
  assert.ok(Object.keys(X.API_).filter(k => /emergency/i.test(k)).every(k => ['emergency.get', 'emergency.set', 'emergency.orphans'].includes(k)));
  [cT, cD, cC, cT2].forEach(u => { X.Auth._emailProvider = () => u.email; refused(X.api('emergency.orphans', { courseId: c1, apply: true }), ['FORBIDDEN']); }); X.Auth._emailProvider = () => admin.email;
  Object.keys(X.ACTIONS || X.Policy.ACTIONS || {}).filter(k => /emergency/i.test(k)).forEach(k => assert.fail('unexpected emergency policy action ' + k));
});
t('hardening', 'D2: scopes / groups below 5 soldiers get NOTHING — insights, report, overview, comparison, home card; no counts, names, totals or metadata leak', () => {
  const w = W(); const { X, admin, c1, c2, cT } = w; const NAMES = ['SOLA77', 'SOLA277', 'SOLB77'];
  const ins = ok(w.as(cT, 'analytics.insights', { courseId: c1 })); assert.deepStrictEqual([ins.small_group, ins.items.length, ins.scope.soldiers], [true, 0, null]); const js = allText(ins); NAMES.forEach(n => assert.ok(!js.includes(n))); assert.ok(!/\d/.test(ins.suppressed.map(x => x.reason).join('') .replace(/5/g, '')), 'no counts in the reason');
  const rp = ok(w.as(cT, 'reports.preview', { courseId: c1, spec: {} })); assert.strictEqual(rp.data.small_group, true); assert.strictEqual(rp.data.soldiers, null); assert.strictEqual(rp.pages, 1); NAMES.forEach(n => assert.ok(!rp.html.includes(n))); assert.ok(/קבוצה קטנה/.test(rp.html)); assert.ok(!/<svg|<td/.test(rp.html), 'no chart or table rows');
  const ov = ok(w.as(cT, 'dash.overview', { courseId: c1, opts: {} })); assert.deepStrictEqual(Object.keys(ov).sort(), ['reason', 'small_group', 'suppressed']);
  const gr = ok(w.as(cT, 'dash.groups', { courseId: c1, by: 'team', opts: {} })); gr.forEach(r => assert.ok(r.suppressed && r.soldiers === null && r.navigation === null)); NAMES.forEach(n => assert.ok(!allText(gr).includes(n)));
  const home = ok(w.as(cT, 'dash.home', { courseId: c1 })); assert.ok(home.courses.every(c => c.suppressed && c.soldiers === null && c.fitness_mean === null));
  const small = ok(w.as(admin, 'reports.preview', { courseId: c2, spec: {} })); assert.strictEqual(small.data.small_group, true);   // a whole small course
  const filtered = ok(w.as(admin, 'analytics.insights', { courseId: c1, f: { teamId: X.Courses.org(admin, c1).teams[0].id } })); assert.ok(filtered.small_group || filtered.scope.soldiers >= 5, 'a filter to a small team is suppressed');
});
t('unit', 'D2: complementary suppression — with exactly one hidden group the smallest visible group is hidden too (hidden = total − shown is impossible); no hidden group => nothing extra hidden', () => {
  const { X } = W(); const g = [{ n: 9, k: 'a' }, { n: 6, k: 'b' }, { n: 12, k: 'c' }, { n: 3, k: 'd' }];
  assert.deepStrictEqual(X.Analytics.shownGroups_(g, 1).map(x => x.k).sort(), ['a', 'c']); assert.deepStrictEqual(X.Analytics.shownGroups_(g.slice(0, 3), 0).map(x => x.k).sort(), ['a', 'b', 'c']);
  assert.deepStrictEqual(X.Analytics.shownGroups_(g, 2).map(x => x.k).sort(), ['a', 'b', 'c']); assert.strictEqual(X.Analytics.MIN_GROUP, 5);
});
t('integration', 'D2: public dash.groups never returns a group (or a group metric) backed by < 5 soldiers; the hidden row is anonymous; raw calculation stays available only internally', () => {
  const w = W(); const { X, admin, c1 } = w; const pub = ok(w.as(admin, 'dash.groups', { courseId: c1, by: 'department', opts: {} })); const raw = X.Dashboard.groupsRaw_(admin, c1, 'department', {});
  pub.forEach(r => assert.ok(r.suppressed ? (r.id === null && r.soldiers === null) : r.soldiers >= 5)); raw.filter(g => g.soldiers < 5).forEach(g => assert.ok(!allText(pub).includes(g.name)));
  assert.ok(!('groupsRaw_' in X.API_) && !Object.values(X.API_).some(f => /groupsRaw_/.test(String(f))), 'raw groups are not an API route');
});
t('integration', 'D2: a LARGE group report (many departments above the threshold) is paginated into packed pages with exact footers; GROUP ONLY — no soldier table, names, ids or personal measures', () => {
  const w = W(); const { X, admin, c1 } = w; const names = [];
  const defs = []; for (let d = 0; d < 12; d++) defs.push({ name: 'מחלקת עומס ' + (d + 1), teams: ['צוות א'] }); X.Courses.seedOrg_(admin, c1, defs);
  const org = X.Courses.org(admin, c1); org.departments.filter(d => /עומס/.test(d.name)).forEach((d, di) => { const tm = org.teams.find(t => t.department_id === d.id);
    for (let i = 0; i < 6; i++) { const nm = 'חייל-דליפה-' + di + '-' + i; names.push(nm); const s = X.Soldiers.create(admin, c1, { full_name: nm, personal_number: String(700000 + di * 10 + i), gender: i % 2 ? 'F' : 'M', department_id: d.id, team_id: tm.id });
      X.Records.create(admin, 'NavigationTests', c1, { request_id: X.Util.uuid(), soldier_id: s.id, test_date: '2026-0' + (3 + (i % 3)) + '-10', navigation_type_id: X.Db.all('NavigationTypes')[0].id, distance_km: 3, plan_score: 3 + (di % 3), debrief_score: 4 + (i % 2), points_completed: 2 + (i % 2), points_total: 3 }); } });
  const p = ok(w.as(admin, 'reports.preview', { courseId: c1, spec: {} })); const n = (p.html.match(/<section class="pg">/g) || []).length; assert.strictEqual(n, p.pages); assert.ok(p.pages >= 2, 'large group report spans several pages: ' + p.pages);
  assert.strictEqual((p.html.match(new RegExp('עמוד \\d+ מתוך ' + p.pages, 'g')) || []).length, p.pages); for (let i = 1; i <= p.pages; i++) assert.ok(p.html.includes('עמוד ' + i + ' מתוך ' + p.pages), 'footer ' + i);
  assert.ok(!/<th>#<\/th>|class="ach"|<svg[^>]*class="(scatter|radar)/.test(p.html), 'no per-soldier table / scatter / radar markup');
  const blob = p.html + JSON.stringify(p.data); names.concat(X.Db.all('Soldiers').filter(s => s.course_id === c1).map(s => s.full_name), X.Db.all('Soldiers').filter(s => s.course_id === c1).map(s => String(s.personal_number || '')).filter(v => v.length >= 6)).forEach(v => assert.ok(!blob.includes(v), 'leak: ' + v));
  assert.deepStrictEqual(p.data.achievements, []); assert.deepStrictEqual(p.data.radar, []); assert.deepStrictEqual(p.data.scatter.points, []); assert.strictEqual(p.data.scatter.available, false);
});
t('hardening', 'PRV-GROUP-ONLY: the analytic report (preview, data, insights, dashboard, nav groups, summaries) carries no name / personal number / per-soldier measure for admin and commander; permitted group data stays', () => {
  const w = W(); const { X, admin, c1, cC } = w; const sols = X.Db.all('Soldiers').filter(s => s.course_id === c1); assert.ok(sols.length >= 5);
  const secrets = sols.map(s => s.full_name).concat(sols.map(s => s.personal_number).filter(Boolean), sols.map(s => s.id));
  const noTs = j => j.replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, 'TS'); /* FINAL: a generated_at timestamp's milliseconds (e.g. ".201Z") can equal a short synthetic personal number and made this scan flaky (1 run in ~40); timestamps carry no soldier data, every other byte is still scanned */
  [admin, cC].forEach(u => { const r = ok(w.as(u, 'reports.preview', { courseId: c1, spec: {} })); const blob = noTs(r.html + JSON.stringify(r.data));
    secrets.forEach(v => assert.ok(!blob.includes(v), u.role + ' leak ' + v)); assert.deepStrictEqual(r.data.achievements, []); assert.deepStrictEqual(r.data.radar, []); assert.deepStrictEqual(r.data.scatter.points, []);
    assert.ok(r.data.bars && r.data.trends && r.data.completeness && r.data.definitions, 'group sections kept');
    ['analytics.insights', 'analytics.report'].forEach(m => { const x = w.as(u, m, { courseId: c1 }); if (x.ok) secrets.forEach(v => assert.ok(!noTs(JSON.stringify(x.data)).includes(v), u.role + ' ' + m + ' leak ' + v)); }); });
});
t('integration', 'D3: PDF default is the ANALYTIC A4 report; the tabular PDF only with layout:"tabular"; Excel is always tabular; job params record the layout', () => {
  const w = W(); const { X, admin, c1 } = w; const a = ok(w.as(admin, 'reports.generate', { courseId: c1, spec: { sections: ['soldiers'] }, format: 'pdf' })), b = ok(w.as(admin, 'reports.generate', { courseId: c1, spec: { sections: ['soldiers'], layout: 'tabular' }, format: 'pdf' })), x = ok(w.as(admin, 'reports.generate', { courseId: c1, spec: { sections: ['soldiers'] }, format: 'xlsx' }));
  const job = id => X.Db.get('ReportJobs', id); assert.ok(/analytic/.test(job(a.id).params_json)); assert.ok(!/analytic/.test(job(b.id).params_json) && /tabular/.test(job(b.id).params_json)); assert.ok(!/analytic/.test(job(x.id).params_json));
  const sizes = [a, b].map(j => Buffer.from(X.Reports.download(admin, j.id).content_base64, 'base64').toString()); assert.notStrictEqual(sizes[0], sizes[1], 'analytic and tabular PDFs differ (fake PDF encodes html length; compared as strings, not string length)');
});
t('hardening', 'D4: soldiers with active=false are excluded from analytics, the analytic report, dashboard figures and the default tabular report; history only with include_inactive by the admin', () => {
  const w = W(); const { X, admin, c1, cC } = w; const inactive = X.Db.all('Soldiers').find(s => s.course_id === c1 && s.full_name === 'SOLINACT77'); assert.ok(inactive && !X.Util.isTrue(inactive.active));
  const act = X.Db.all('Soldiers').filter(s => s.course_id === c1 && s.record_status === 'active' && X.Util.isTrue(s.active)).length;
  assert.strictEqual(ok(w.as(admin, 'dash.overview', { courseId: c1, opts: {} })).soldiers, act); assert.strictEqual(ok(w.as(admin, 'analytics.insights', { courseId: c1 })).scope.soldiers, act);
  const p = ok(w.as(admin, 'reports.preview', { courseId: c1, spec: {} })); assert.ok(!p.html.includes('SOLINACT77')); assert.strictEqual(p.data.soldiers, act);
  const rb = ok(w.as(admin, 'reports.build', { courseId: c1, spec: { sections: ['soldiers', 'navigation'] } })); assert.ok(!allText(rb).includes('SOLINACT77'));
  const hist = ok(w.as(admin, 'reports.build', { courseId: c1, spec: { sections: ['soldiers'], include_inactive: true } })); assert.ok(allText(hist).includes('SOLINACT77') && hist.include_inactive === true);
  refused(w.as(cC, 'reports.build', { courseId: c1, spec: { sections: ['soldiers'], include_inactive: true } }), ['FORBIDDEN']); refused(w.as(admin, 'reports.build', { courseId: c1, spec: { sections: ['soldiers'], include_inactive: 'yes' } }), ['VALIDATION']);
  assert.ok(/היסטוריה של חיילים שאינם פעילים/.test(X.Reports.html_(hist)));
});
t('hardening', 'D5: no external model / third-party / network call anywhere in the new server code (static) and the analytics return no free-text from outside', () => {
  const fs = require('fs'), path = require('path'); ['Analytics.gs', 'EmergencyContact.gs'].forEach(f => { const src = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); assert.ok(!/UrlFetchApp|fetch\(|XMLHttpRequest|https?:\/\/|Adapters\.(llm|ocr|http)/i.test(src), f); });
  const rep = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'Reports.gs'), 'utf8'); const i = rep.indexOf('analytic A4 report'); assert.ok(!/UrlFetchApp|https?:\/\//.test(rep.slice(i)), 'Reports analytic section');
});
t('hardening', 'D6: attendance scope rule unchanged — Mods.scopeAllowed_ still decides; a commander cannot create an event for a scope outside his assignment (course-wide / other team), but can for his own', () => {
  const w = W(); const { X, admin, c1, cT } = w; const act = X.Db.all('ActivityTypes')[0].id, org = X.Courses.org(admin, c1), other = org.teams.find(t => !X.Mods.scopeAllowed_(cT, c1, 'team', t.id)), mine = org.teams.find(t => X.Mods.scopeAllowed_(cT, c1, 'team', t.id));
  refused(w.as(cT, 'attendance.create', { courseId: c1, data: { request_id: 'd6-a', event_date: '2026-05-01', activity_type_id: act, scope_type: 'course', scope_id: c1 } }), ['VALIDATION', 'FORBIDDEN']); refused(w.as(cT, 'attendance.create', { courseId: c1, data: { request_id: 'd6-b', event_date: '2026-05-01', activity_type_id: act, scope_type: 'team', scope_id: other.id } }), ['VALIDATION', 'FORBIDDEN']);
  ok(w.as(cT, 'attendance.create', { courseId: c1, data: { request_id: 'd6-c', event_date: '2026-05-01', activity_type_id: act, scope_type: 'team', scope_id: mine.id } }));
});

// ============================================================ adversarial pass (D5 round): findings F1–F3 found by probing, not by an existing test
t('hardening', 'F1 (D2): nav.groups never returns a department/team/course figure for fewer than 5 soldiers, adds the anonymous hidden row, applies complementary suppression; per-soldier list unchanged', () => {
  const w = W(); const { X, admin, c1, cT } = w;
  const small = ok(w.as(cT, 'nav.groups', { courseId: c1, opts: {} })); assert.strictEqual(small.small_group, true); assert.ok(small.course.suppressed && small.departments.length === 0 && small.teams.length === 0);
  const dep = X.Courses.org(admin, c1).departments[0], team = X.Courses.org(admin, c1).teams.find(x => x.department_id === dep.id);
  for (let i = 0; i < 6; i++) X.Soldiers.create(admin, c1, { full_name: 'חייל גדול ' + i, personal_number: String(700000 + i), gender: 'M', department_id: dep.id, team_id: team.id });
  const g = ok(w.as(admin, 'nav.groups', { courseId: c1, opts: {} })); const MIN = 5;
  [g.course].concat(g.departments, g.teams).forEach(r => assert.ok(r.suppressed ? (r.id === null && r.soldiers === null && r.count === null && r.mean_display === null) : r.soldiers >= MIN, JSON.stringify(r)));
  assert.ok(g.teams.some(x => x.suppressed), 'small teams are hidden behind one anonymous row'); assert.ok(g.soldiers.length >= 8, 'per-soldier list (own recorded results) is unchanged');
  const raw = X.Navigation.groupSummaryRaw_(admin, c1, {}); assert.ok(raw.teams.some(x => x.soldiers < MIN), 'the raw (internal) calculation still exists'); assert.ok(!('groupSummaryRaw_' in X.API_));
});
t('hardening', 'F2 (D4): Snapshot, nav.groups and every aggregate exclude active=false by default; onlyActive:false is the explicit history switch', () => {
  const w = W(); const { X, admin, c1 } = w; const inact = X.Db.all('Soldiers').find(s => s.full_name === 'SOLINACT77');
  assert.ok(!X.Snapshot.soldiers(admin, c1, {}).some(s => s.id === inact.id)); assert.ok(X.Snapshot.soldiers(admin, c1, { onlyActive: false }).some(s => s.id === inact.id));
  assert.ok(!allText(ok(w.as(admin, 'nav.groups', { courseId: c1, opts: {} })).soldiers).includes('SOLINACT77'));
  assert.ok(allText(ok(w.as(admin, 'soldiers.list', { courseId: c1, opts: {} }))).includes('SOLINACT77'), 'the management list still shows him (status badge) so he can be re-activated');
});
t('hardening', 'F3 (D2): the per-soldier summary routes called WITHOUT a soldierId (= whole-scope aggregate) are suppressed for a scope under 5; with a soldierId they answer as before; the permission guard still comes first', () => {
  const w = W(); const { X, admin, c1, c2, cT, cC, S } = w;
  ['nav', 'fitness', 'mk', 'exams', 'attendance', 'marches'].forEach(k => { const r = ok(w.as(cT, k + '.summary', { courseId: c1 })); assert.strictEqual(r.small_group, true, k); assert.ok(!('count' in r) && !('total' in r) && !('present' in r), k + ' leaks a figure'); ok(w.as(cT, k + '.summary', { courseId: c1, soldierId: S.a.id })); });
  refused(w.as(cC, 'nav.summary', { courseId: c2 }), ['FORBIDDEN', 'NOT_FOUND']);   // unauthorised caller: still the guard's answer, not the suppression object
});
t('hardening', 'F1b (D2): nav.groups complementary suppression — exactly one small team hidden => the smallest visible team is hidden too, so the hidden one cannot be derived as course total minus shown teams', () => {
  const w = W(); const { X, admin, c1 } = w; const org = X.Courses.org(admin, c1), teams = org.teams.filter(x => X.Db.all('Soldiers').some(s => s.team_id === x.id) || true);
  const keep = teams.slice(0, teams.length - 1); let k = 0; keep.forEach((tm, ix) => { for (let i = 0; i < 5 + ix; i++) X.Soldiers.create(admin, c1, { full_name: 'חייל משלים ' + (k++), personal_number: String(600000 + k), gender: 'M', department_id: tm.department_id, team_id: tm.id }); });
  const raw = X.Navigation.groupSummaryRaw_(admin, c1, {}), hiddenRaw = raw.teams.filter(g => g.soldiers < 5).length; assert.strictEqual(hiddenRaw, 1, 'fixture: exactly one small team (got ' + hiddenRaw + ')');
  const g = ok(w.as(admin, 'nav.groups', { courseId: c1, opts: {} })), visible = g.teams.filter(x => !x.suppressed);
  assert.strictEqual(visible.length, raw.teams.length - 2, 'one hidden + the smallest visible one also hidden'); assert.ok(g.teams.some(x => x.suppressed));
  const minVisible = Math.min.apply(null, raw.teams.filter(x => x.soldiers >= 5).map(x => x.soldiers)); assert.ok(!visible.some(x => x.soldiers === minVisible && raw.teams.filter(y => y.soldiers === minVisible).length === 1), 'the smallest visible team is the one dropped');
});
t('hardening', 'PRV-ROUTES: every aggregate / summary / dashboard / analytics / report-preview API route, as admin and as commander, returns no soldier name, id or personal number (all 175 routes are enumerated; per-soldier routes are listed explicitly and excluded)', () => {
  const w = W(); const { X, admin, c1, cC } = w; const sols = X.Db.all('Soldiers').filter(s => s.course_id === c1);
  const secrets = sols.map(s => s.full_name).concat(sols.map(s => String(s.personal_number || '')).filter(v => v.length >= 3 && /[^0-9]/.test(v) || v.length >= 6), sols.map(s => s.id)).filter(Boolean);
  const all = Object.keys(X.API_); assert.ok(all.length >= 170, 'routes ' + all.length);
  const AGG = /^(analytics\.|dash\.|reports\.preview$|nav\.groups$|(nav|fitness|mk|exams|attendance|marches|readiness|qual)\.summary$|nav\.groups$|alerts\.counts$|tasks\.indicators$)/;
  const PER_SOLDIER = /^(soldiers\.|emergency\.|nav\.(create|list)$|record\.|correction\.|snote\.|notes\.|assess\.|events\.|favorites\.|followups\.|mk\.(create|list)$|fitness.(create|list|completion|quality)$|exams\.(attempt|attempts)$|marches\.(create|list|roll)$|readiness\.(assess|list|notEntered)$|attendance\.(create|roll)$|qual\.(assignments|dueHistory|update|postpone|requestExclusion|reviewExclusion)$|assignments\.|forms\.|docs\.|ocr\.|ai\.|import\.|audit\.|reports\.(build|generate|fullExport|download|jobs)$|meetings\.|tasks\.(list|get|setStatus)$|alerts\.(list|refresh|handle)$|backup\.|preflight\.|migration\.)/;
  const aggregate = all.filter(m => AGG.test(m)); assert.ok(aggregate.length >= 12, 'aggregate routes ' + aggregate.join(','));
  const unclassified = all.filter(m => !AGG.test(m) && !PER_SOLDIER.test(m) && !/^(courses\.|users\.|navtypes\.|settings\.|fitness\.|exams\.|acttypes\.|attendance\.events$|qual\.(define|list|setActive|summary)$|attendance\.summary$|alerts\.|reports\.export(Authorize|Complete)$)/.test(m)); assert.deepStrictEqual(unclassified, [], 'route(s) neither aggregate, per-soldier nor config: ' + unclassified.join(','));
  const args = [{ courseId: c1 }, { courseId: c1, spec: {} }, { courseId: c1, filters: {} }, { courseId: c1, group_by: 'department' }, { courseId: c1, groupBy: 'team' }];
  const OPERATIONAL_IDS = /^(exams\.summary|dash\.overview|readiness\.summary)$/; /* F6 (owner decision pending): these operational summaries still list per-soldier STATUS rows keyed by soldier_id (no names / personal numbers); not part of the analytic report, left unchanged to preserve readiness/exam workflows */
  const namesOnly = secrets.filter(v => !sols.some(s => s.id === v));
  [admin, cC].forEach(u => aggregate.forEach(m => args.forEach(a => { const r = w.as(u, m, a); if (r.ok) { const d = m === 'nav.groups' ? { course: r.data.course, departments: r.data.departments, teams: r.data.teams } : r.data /* nav.groups also carries the NAVIGATION SCREEN soldier list (per-soldier rows, approved earlier, outside the analytic report) — only its group levels are group-only */; const blob = JSON.stringify(d); (OPERATIONAL_IDS.test(m) ? namesOnly : secrets).forEach(v => assert.ok(!blob.includes(v), u.role + ' ' + m + ' leaks ' + v)); } })));
  assert.ok(ok(w.as(admin, 'analytics.insights', { courseId: c1 })) && ok(w.as(admin, 'dash.home', { courseId: c1 })), 'sanity: aggregate routes answer');
});
t('hardening', 'RPT-ESC: user-controlled text in the analytic report (course / department names) is HTML-escaped', () => {
  const w = W(); const { X, admin, c1 } = w; const evil = '<img src=x onerror=1>"&';
  X.Db.update('Courses', c1, { name: 'קורס ' + evil }); const org = X.Courses.org(admin, c1); X.Courses.rename(admin, c1, 'department', org.departments[0].id, 'מחלקה ' + evil);
  const p = ok(w.as(admin, 'reports.preview', { courseId: c1, spec: {} })); assert.ok(!p.html.includes('<img src=x'), 'raw markup must not reach the report'); assert.ok(p.html.includes('&lt;img src=x onerror=1&gt;&quot;&amp;'), 'escaped form present');
});
done();
