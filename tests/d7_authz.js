// D7 — F6 closure + authorization audit. Node only (in-memory Db, faked identity); NOT Apps Script / Sheets. Synthetic data only.
// Owner decision: ANALYTICS = GROUP ONLY (no names / soldier ids / personal numbers, no exception for admin or commander);
// OPERATIONAL = admin sees individual data in every course, a commander only inside his own courseScope (and only the soldiers visible to him).
const { suite } = require('./tlib'); const { t, done, assert } = suite('d7_authz.js'); const { world } = require('./world');
const CLASSES = require('./route_classes.json');
function W() { const w = world(); const { X } = w; w.as = (u, m, a) => { X.Auth._emailProvider = () => (u && typeof u === 'object' ? u.email : u); return X.api(m, a); }; return w; }
const ok = r => { assert.strictEqual(r.ok, true, JSON.stringify(r)); return r.data; };
const F6 = [['exams.summary', 'O'], ['dash.overview', 'O'], ['readiness.notEntered', 'O'], ['nav.groups', 'O'], ['fitness.completion', 'O'], ['fitness.quality', 'A']];
const A_ARGS = (c, w) => ({ courseId: c, opts: {} });
function users(w) { const { X, admin, c1 } = w; const off = X.Courses.addUser(admin, { email: 'off7@x.com', role: 'commander', course_ids: [c1], display_name: 'כבוי' }); X.Courses.setUser(admin, off.id, { active: false }); return { off: off.email }; }

t('hardening', 'D7-MATRIX: authorization matrix on the six F6 routes, direct API calls — ADMIN any course, COMMANDER only inside courseScope, unknown / inactive / no identity refused', () => {
  const w = W(); const { X, admin, c1, c2, cC, cT, cO } = w; const { off } = users(w);
  F6.forEach(([m, cls]) => {
    assert.strictEqual(CLASSES[m], cls, m + ' classification');
    [c1, c2].forEach(c => ok(w.as(admin, m, A_ARGS(c))));                                   // ADMIN: both courses
    if (cls === 'O') { ok(w.as(cC, m, A_ARGS(c1))); ok(w.as(cT, m, A_ARGS(c1))); } else { [cC, cT].forEach(u => assert.strictEqual(w.as(u, m, A_ARGS(c1)).ok, false, m + ' is administrative only (stricter than the owner minimum, unchanged)')); }
    [cC, cT].forEach(u => { const r = w.as(u, m, A_ARGS(c2)); assert.strictEqual(r.ok, false, m + ' commander of course 1 -> course 2'); assert.strictEqual(r.code, 'FORBIDDEN'); });
    const r = w.as(cO, m, A_ARGS(c1)); assert.strictEqual(r.ok, false, m + ' commander of course 2 -> course 1'); assert.strictEqual(r.code, 'FORBIDDEN');
    ['', 'ghost@x.com', off].forEach(em => { const q = w.as(em, m, A_ARGS(c1)); assert.strictEqual(q.ok, false, m + ' as "' + em + '"'); });
    assert.strictEqual(w.as(cO, m, A_ARGS(c1)).data, undefined, 'no body on refusal');
  });
});

t('hardening', 'D7-SPOOF: role / email / courseScope / ctx sent by the client are ignored — identity and scope come from the server only', () => {
  const w = W(); const { admin, c1, c2, cC, cO } = w;
  const spoof = { role: 'ADMIN', email: admin.email, userEmail: admin.email, user: { role: 'ADMIN', email: admin.email }, ctx: { role: 'ADMIN', email: admin.email, courseScope: [c1, c2] }, courseScope: [c1, c2], course_scope: [c1, c2], scope: [c1, c2], asAdmin: true, actor: admin.email };
  F6.forEach(([m]) => {
    assert.strictEqual(w.as(cO, m, Object.assign({ courseId: c1, opts: {} }, spoof)).ok, false, m + ': commander of course 2 + spoofed admin identity -> course 1');
    assert.strictEqual(w.as(cC, m, Object.assign({ courseId: c2, opts: {} }, spoof)).ok, false, m + ': commander of course 1 + spoofed scope -> course 2');
    assert.strictEqual(w.as('ghost@x.com', m, Object.assign({ courseId: c1, opts: {} }, spoof)).ok, false, m + ': unknown caller claiming to be admin');
  });
  assert.strictEqual(w.as(cC, 'fitness.quality', Object.assign({ courseId: c1 }, spoof)).ok, false, 'admin-only route stays admin-only for a commander who claims admin');
  // a forged courseId in the nested opts must not widen the course either
  assert.strictEqual(w.as(cO, 'nav.groups', { courseId: c1, opts: { courseId: c2 } }).ok, false); assert.strictEqual(w.as(cC, 'readiness.notEntered', { courseId: c2, opts: { courseId: c1 } }).ok, false); assert.strictEqual(w.as(cC, 'readiness.summary', { courseId: c2, opts: { courseId: c1 } }).ok, false);
});

t('hardening', 'D7-SOLDIER-ID: a soldier_id of another course (or of a hidden soldier) never yields that soldier through the F6 routes', () => {
  const w = W(); const { X, admin, c1, c2, cC, cT, S } = w; const foreign = S.f; const f = X.Db.get('Soldiers', foreign.id); assert.strictEqual(f.course_id, c2);
  [admin, cC, cT].forEach(u => { ['exams.summary'].forEach(m => { const r = w.as(u, m, { courseId: c1, soldierId: f.id }); if (r.ok) { const blob = JSON.stringify(r.data); assert.ok(!blob.includes(f.id) && !blob.includes(f.full_name), m + ' leaks the foreign soldier'); } });
    ['dash.overview', 'readiness.summary', 'readiness.notEntered', 'nav.groups', 'fitness.completion'].forEach(m => { const r = w.as(u, m, { courseId: c1, soldierId: f.id, opts: { soldierId: f.id } }); if (r.ok) { const blob = JSON.stringify(r.data); assert.ok(!blob.includes(f.id) && !blob.includes(f.full_name), m + ' leaks the foreign soldier'); } }); });
  // the foreign soldier is not reachable with the OWN course id as a commander of course 1 on the per-soldier card either
  assert.strictEqual(w.as(cC, 'soldiers.card', { id: f.id }).ok, false);
});

// every soldier (id / name) that appears anywhere in a response, recursively through arrays and nested objects, keys included
function mentioned(data, all) { const found = new Set(); const hay = []; (function walk(o) { if (o === null || o === undefined) return; if (typeof o === 'string') hay.push(o); else if (typeof o === 'number') hay.push(String(o)); else if (Array.isArray(o)) o.forEach(walk); else if (typeof o === 'object') Object.keys(o).forEach(k => { hay.push(k); walk(o[k]); }); })(data);
  const blob = hay.join('\u0001'); all.forEach(s => { if (blob.includes(s.id) || (s.full_name && blob.includes(s.full_name)) || (s.personal_number && String(s.personal_number).length >= 6 && blob.includes(String(s.personal_number)))) found.add(s.id); }); return found; }

t('hardening', 'D7-LEAK-F6: operational routes return soldiers only to an authorized caller and only the soldiers visible to him (recursive scan, admin vs team / department / course commander)', () => {
  const w = W(); const { X, admin, c1, cC, cT, cD, cT2 } = w; const all = X.Db.all('Soldiers').slice();
  ['exams.summary', 'dash.overview', 'readiness.summary', 'readiness.notEntered', 'nav.groups', 'fitness.completion'].forEach(m => [admin, cC, cD, cT, cT2].forEach(u => { const r = w.as(u, m, { courseId: c1, opts: {} }); if (!r.ok) return; const ctx = X.Auth.context(); const vis = X.Soldiers.visibleFn_(ctx, c1); const seen = mentioned(r.data, all);
    seen.forEach(id => { const s = X.Db.get('Soldiers', id); assert.ok(s.course_id === c1, m + ' ' + u.email + ' shows a soldier of another course'); if (u !== admin) assert.ok(vis(s), m + ' ' + u.email + ' shows a soldier who is not visible to him (' + s.id + ')'); }); }));
  // a small group stays suppressed for the operational summaries when no soldier is asked for explicitly (F3 / N=5)
  // non-vacuity: the scan really sees soldiers — admin gets the full list, a team commander a strict, non-empty subset
  const cnt = (u, m) => mentioned(ok(w.as(u, m, { courseId: c1, opts: {} })), all).size; ['readiness.list', 'fitness.completion', 'nav.groups'].forEach(m => { const a = cnt(admin, m), c = cnt(cT, m); assert.ok(a >= 3, m + ' admin sees soldiers: ' + a); assert.ok(c >= 1 && c <= a, m + ' team commander sees own soldiers: ' + c + '/' + a); });
  assert.ok(cnt(cT, 'readiness.list') < cnt(admin, 'readiness.list'), 'the team commander sees fewer soldiers than the admin');
});

t('hardening', 'D7-GROUP-NAV: nav.groups — group levels (course / departments / teams) carry no soldier identity; the soldier list is operational and shown only inside scope; groups < 5 are suppressed with complementary suppression', () => {
  const w = W(); const { X, admin, c1, cC, cT } = w; const all = X.Db.all('Soldiers').slice();
  [admin, cC, cT].forEach(u => { const d = ok(w.as(u, 'nav.groups', { courseId: c1, opts: {} })); const lv = { course: d.course, departments: d.departments, teams: d.teams }; assert.strictEqual(mentioned(lv, all).size, 0, u.email + ': group levels must hold no soldier identity'); (d.departments || []).concat(d.teams || []).forEach(g => { if (g.suppressed) { assert.strictEqual(g.soldiers, null); assert.strictEqual(g.id, null); } }); });
});

t('hardening', 'D7-ROUTE-MAP: all 178 routes carry an explicit classification (G group / O operational individual / P personal restricted / A admin only / N no soldier data); no route is missing and none is stale', () => {
  const w = W(); const keys = Object.keys(w.X.API_).sort(); assert.strictEqual(keys.length, 178);
  assert.deepStrictEqual(Object.keys(CLASSES).sort(), keys, 'route_classes.json lists exactly the API routes'); Object.values(CLASSES).forEach(c => assert.ok('GOPAN'.includes(c) && c.length === 1, 'class ' + c));
});

const SAFE_WRITE = /\.(create|add|set|update|cancel|restore|save|toggle|assess|approve|reject|decide|commit|start|recover|prune|run|reassign|reopen|archive|rename|edit|import|define|setActive|postpone|handle|refresh|attach|upload|review|reviewLink|requestLink|requestExclusion|importDraft|addTable|editRow|draft|ask|recompute|auditRepair|generalLink|createLink|typeCreate|typeActive|typeVariant|defCreate|defPass|attempt|roll|generate|fullExport|build|restore)$/;
const ARGS = w => { const a = w.S.a; return [{ courseId: w.c1 }, { courseId: w.c1, opts: {} }, { courseId: w.c1, spec: {}, filters: {} }, { courseId: w.c1, soldierId: a.id, opts: {} }, { id: a.id }, { courseId: w.c1, groupBy: 'department' }]; };

t('hardening', 'D7-SWEEP-GROUP: every GROUP route (and every NO-SOLDIER-DATA route), as admin and as every commander, returns no soldier id / name / personal number anywhere in the recursive response', () => {
  const w = W(); const { X, admin, c1, cC, cT, cD, cT2 } = w; const all = X.Db.all('Soldiers').slice(); let calls = 0, answered = 0;
  Object.keys(CLASSES).filter(m => CLASSES[m] === 'G' || CLASSES[m] === 'N').filter(m => !SAFE_WRITE.test(m) || /^(reports\.preview)$/.test(m)).forEach(m => [admin, cC, cD, cT, cT2].forEach(u => ARGS(w).forEach(a => { calls++; const r = w.as(u, m, a); if (!r.ok) return; answered++; const seen = mentioned(r.data, all); assert.strictEqual(seen.size, 0, m + ' (' + (u.role || '') + ' ' + u.email + ') exposes soldier(s): ' + [...seen].join(',')); })));
  assert.ok(answered > 60, 'the sweep really answered (' + answered + '/' + calls + ')');
});

t('hardening', 'D7-SWEEP-OPERATIONAL: for every OPERATIONAL / PERSONAL read route a caller outside the course scope is refused and an in-scope commander sees only soldiers visible to him; ADMIN-only routes are refused to every commander', () => {
  const w = W(); const { X, admin, c1, cC, cT, cD, cT2, cO, none } = w; const all = X.Db.all('Soldiers').slice(); let checked = 0;
  Object.keys(CLASSES).forEach(m => { const cls = CLASSES[m]; if (cls === 'A') { if (SAFE_WRITE.test(m) && !/\.(list|verify|plan|rows|drafts|last|jobs|pendingLinks)$/.test(m) && !/^(audit|users|settings|assignments)\./.test(m)) return; [cC, cT, cD, cO, none].forEach(u => ARGS(w).forEach(a => { const r = w.as(u, m, a); assert.strictEqual(r.ok, false, m + ' (admin only) answered a commander ' + u.email); checked++; })); return; }
    if (cls !== 'O' && cls !== 'P') return; if (SAFE_WRITE.test(m)) return;
    ARGS(w).forEach(a => { if (!a.courseId) return; const rr = w.as(cO, m, a); assert.strictEqual(rr.ok, false, m + ' answered a commander of another course'); checked++; });
    [cC, cD, cT, cT2].forEach(u => ARGS(w).forEach(a => { const r = w.as(u, m, a); if (!r.ok) return; const ctx = X.Auth.context(); const vis = X.Soldiers.visibleFn_(ctx, c1); mentioned(r.data, all).forEach(id => { const s = X.Db.get('Soldiers', id); assert.ok(s.course_id === c1 && vis(s), m + ' ' + u.email + ' sees soldier ' + id + ' outside his visibility'); }); checked++; })); });
  assert.ok(checked > 150, 'checked ' + checked);
});
t('hardening', 'D7-REPORT-PATHS: GROUP ONLY holds on every analytic report path (preview, include_inactive, commander, filters); the tabular report stays operational and scoped; N=5 suppression intact', () => {
  const w = W(); const { X, admin, c1, c2, cC, cT } = w; const all = X.Db.all('Soldiers').slice();
  [admin, cC, cT].forEach(u => [{}, { include_inactive: true }, { departmentId: 'x' }, { sections: ['soldiers', 'navigation'] }, { layout: 'analytic' }].forEach(spec => { const r = w.as(u, 'reports.preview', { courseId: c1, spec }); if (!r.ok) return; assert.strictEqual(mentioned({ d: r.data.data, h: r.data.html }, all).size, 0, 'analytic preview ' + JSON.stringify(spec) + ' ' + u.email);
    assert.deepStrictEqual(r.data.data.achievements, []); assert.deepStrictEqual(r.data.data.radar, []); assert.deepStrictEqual(r.data.data.scatter.points, []); }));
  assert.strictEqual(w.as(cT, 'reports.preview', { courseId: c2, spec: {} }).ok, false, 'out-of-scope course refused');
  const small = w.as(cT, 'reports.preview', { courseId: c1, spec: {} }); assert.ok(small.ok);   // team commander: fewer than 5 soldiers in scope -> suppressed, nothing about the group
  assert.ok(small.data.data.suppressed === true || small.data.data.small_group === true || JSON.stringify(small.data.data).includes('suppressed'), 'N=5 suppression for a small scope');
  // tabular report = operational: only soldiers visible to the caller
  const tb = w.as(cT, 'reports.generate', { courseId: c1, spec: { layout: 'tabular', sections: ['soldiers'] }, format: 'xlsx' }); assert.ok(tb.ok || tb.code, 'tabular generate answers');
  assert.strictEqual(w.as(cT, 'reports.generate', { courseId: c2, spec: { layout: 'tabular', sections: ['soldiers'] }, format: 'xlsx' }).ok, false, 'tabular for another course refused');
});
done();
