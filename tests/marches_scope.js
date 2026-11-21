// Issue #79 — marches.list / marches.roll visibility (same authoritative model as attendance.events): scoped commanders see only marches that overlap their visible soldiers,
// counts come ONLY from visible rows, small present/absent splits are suppressed (MIN_GROUP=5), names only in the operational roll, foreign course refused. Synthetic data only.
const { suite } = require('./tlib'); const { t, done, assert } = suite('marches_scope.js'); const { world } = require('./world');
function W() { const w = world(); const { X } = w; w.as = (u, m, a) => { X.Auth._emailProvider = () => u.email; return X.api(m, a); }; return w; }
const ok = r => { assert.strictEqual(r.ok, true, JSON.stringify(r)); return r.data; };
const refused = (r, codes) => { assert.strictEqual(r.ok, false, 'expected refusal'); if (codes) assert.ok(codes.includes(r.code), r.code); };
const teamOf = (X, id) => X.Db.get('Soldiers', id).team_id;
function mk(w, scope, absentN, tag) { const { X, admin, c1 } = w; const ids = X.Mods.scopeSoldiers_(admin, c1, scope.t, scope.id).map(s => s.id); const data = { request_id: 'm79-' + tag, march_date: '2026-05-0' + (1 + (tag.length % 8)), location: 'מסע-' + tag, km_no_stretcher: 5, km_stretcher: 0, scope_type: scope.t, scope_id: scope.id, absent: ids.slice(0, absentN).map(id => ({ soldier_id: id })) };
  return { r: ok(w.as(admin, 'marches.create', { courseId: c1, data })), ids, data }; }

t('hardening', 'M79-01: a commander of team A does not see a team-B-only march at all (no name/location/count), course-wide march is counted over visible rows only', () => {
  const w = W(); const { X, admin, c1, cT, cT2, team } = w; const tB = team(1, 0);
  const mB = mk(w, { t: 'team', id: tB }, 1, 'teamB'), mAll = mk(w, { t: 'course', id: c1 }, 2, 'all');
  const cmdA = ok(w.as(cT, 'marches.list', { courseId: c1 })), adm = ok(w.as(admin, 'marches.list', { courseId: c1 }));
  assert.ok(!cmdA.some(m => m.id === mB.r.march.id), 'foreign-team march must be hidden'); assert.ok(!JSON.stringify(cmdA).includes('מסע-teamB'));
  assert.ok(adm.some(m => m.id === mB.r.march.id)); const row = cmdA.find(m => m.id === mAll.r.march.id); assert.ok(row, 'course-wide march visible'); const admRow = adm.find(m => m.id === mAll.r.march.id);
  assert.ok(row.total < admRow.total, 'commander total is narrowed to visible soldiers'); assert.strictEqual(admRow.total, mAll.ids.length);
  const visIds = new Set(ok(w.as(cT, 'soldiers.list', { courseId: c1, opts: {} })).map(s => s.id)), exp = X.Db.all('MarchAttendance').filter(r => r.march_id === mAll.r.march.id && r.record_status === 'active' && visIds.has(r.soldier_id)).length; assert.strictEqual(row.total, exp);
  const cmdB = ok(w.as(cT2, 'marches.list', { courseId: c1 })); assert.ok(cmdB.some(m => m.id === mB.r.march.id), 'team B commander sees the team B march'); assert.ok(!cmdB.some(m => m.id !== mB.r.march.id && /teamA/.test(m.location)));
});
t('hardening', 'M79-02: admin sees exact present/absent counts for any split (suppression protects scoped commanders)', () => {
  const w = W(); const { X, admin, c1 } = w; const big = X.Db.all('Soldiers').filter(s => s.course_id === c1 && s.record_status === 'active').length; const m = mk(w, { t: 'course', id: c1 }, 1, 'sup1');
  const adm = ok(w.as(admin, 'marches.list', { courseId: c1 })).find(x => x.id === m.r.march.id); assert.strictEqual(adm.absent, 1); assert.strictEqual(adm.participants, m.ids.length - 1); assert.ok(!adm.counts_suppressed || adm.counts_suppressed === undefined);
  const m0 = mk(w, { t: 'course', id: c1 }, 0, 'zero'), r0 = ok(w.as(admin, 'marches.list', { courseId: c1 })).find(x => x.id === m0.r.march.id); assert.strictEqual(r0.absent, 0);
});
t('hardening', 'M79-03: suppression is applied to a commander whose visible split is small (counts null, total stays)', () => {
  const w = W(); const { X, c1, cT } = w; const ids = X.Mods.scopeSoldiers_(w.admin, c1, 'course', c1).map(s => s.id), vis = new Set(ok(w.as(cT, 'soldiers.list', { courseId: c1, opts: {} })).map(s => s.id)), inV = ids.filter(i => vis.has(i));
  assert.ok(inV.length >= 1 && inV.length < 5 || inV.length >= 5, 'fixture sanity'); const m = mk(w, { t: 'course', id: c1 }, 0, 'cmdsup'); const mm = X.Db.all('MarchAttendance').filter(r => r.march_id === m.r.march.id && vis.has(r.soldier_id))[0]; X.Db.update('MarchAttendance', mm.id, { present: false });
  const row = ok(w.as(cT, 'marches.list', { courseId: c1 })).find(x => x.id === m.r.march.id); if (inV.length - 1 >= 1 && inV.length - 1 < 5 || 1 < 5) { assert.strictEqual(row.counts_suppressed, true); assert.strictEqual(row.participants, null); assert.strictEqual(row.absent, null); assert.strictEqual(row.total, inV.length); }
});
t('hardening', 'M79-04: marches.roll — admin sees every soldier, commander only visible ones, foreign-team march and foreign course are refused, nothing is written', () => {
  const w = W(); const { X, admin, c1, cT, cT2, cO, team } = w; const mB = mk(w, { t: 'team', id: team(1, 0) }, 1, 'rollB'), mAll = mk(w, { t: 'course', id: c1 }, 2, 'rollAll');
  const before = JSON.stringify([X.Db.all('MarchAttendance'), X.Db.all('Marches')]);
  const a = ok(w.as(admin, 'marches.roll', { courseId: c1, marchId: mAll.r.march.id })); assert.strictEqual(a.length, mAll.ids.length); assert.strictEqual(a.filter(r => !r.present).length, 2); a.forEach(r => assert.ok(r.soldier_name && r.id));
  const vis = new Set(ok(w.as(cT, 'soldiers.list', { courseId: c1, opts: {} })).map(s => s.id)); const c = ok(w.as(cT, 'marches.roll', { courseId: c1, marchId: mAll.r.march.id })); assert.ok(c.length > 0 && c.length < a.length); c.forEach(r => assert.ok(vis.has(r.soldier_id)));
  refused(w.as(cT, 'marches.roll', { courseId: c1, marchId: mB.r.march.id }), ['NOT_FOUND']); ok(w.as(cT2, 'marches.roll', { courseId: c1, marchId: mB.r.march.id }));
  refused(w.as(cO, 'marches.roll', { courseId: c1, marchId: mAll.r.march.id }), ['FORBIDDEN']); refused(w.as(admin, 'marches.roll', { courseId: c1, marchId: 'no-such-march' }), ['NOT_FOUND']);
  assert.strictEqual(JSON.stringify([X.Db.all('MarchAttendance'), X.Db.all('Marches')]), before, 'read-only');
});
t('hardening', 'M79-05: cancelled march — admin can still read it, a commander gets NOT_FOUND and it disappears from his list', () => {
  const w = W(); const { X, admin, c1, cT } = w; const m = mk(w, { t: 'course', id: c1 }, 0, 'canc'); ok(w.as(admin, 'record.cancel', { table: 'Marches', id: m.r.march.id, reason: 'בדיקה' }));
  assert.ok(!ok(w.as(cT, 'marches.list', { courseId: c1 })).some(x => x.id === m.r.march.id)); refused(w.as(cT, 'marches.roll', { courseId: c1, marchId: m.r.march.id }), ['NOT_FOUND']); ok(w.as(admin, 'marches.roll', { courseId: c1, marchId: m.r.march.id }));
});
t('hardening', 'M79-06: create is idempotent (same request_id → duplicate, one roster), an out-of-scope absent id is rejected, a commander cannot create outside his scope', () => {
  const w = W(); const { X, admin, c1, cT, team } = w; const mA = mk(w, { t: 'course', id: c1 }, 1, 'idem'), again = ok(w.as(admin, 'marches.create', { courseId: c1, data: mA.data })); assert.strictEqual(again.duplicate, true);
  assert.strictEqual(X.Db.all('MarchAttendance').filter(r => r.march_id === mA.r.march.id).length, mA.ids.length);
  const foreignSol = X.Mods.scopeSoldiers_(admin, c1, 'team', team(1, 0))[0].id; refused(w.as(cT, 'marches.create', { courseId: c1, data: { request_id: 'm79-oos', march_date: '2026-05-02', location: 'x', km_no_stretcher: 1, km_stretcher: 0, scope_type: 'team', scope_id: team(0, 0), absent: [{ soldier_id: foreignSol }] } }), ['VALIDATION']);
  refused(w.as(cT, 'marches.create', { courseId: c1, data: { request_id: 'm79-oos2', march_date: '2026-05-02', location: 'x', km_no_stretcher: 1, km_stretcher: 0, scope_type: 'team', scope_id: team(1, 0) } }), ['VALIDATION']);
});
t('hardening', 'M79-07: the roll carries no cross-team data to a team-B commander for a team-A march and the list/roll answers never contain names of invisible soldiers', () => {
  const w = W(); const { X, admin, c1, cT, cT2, team } = w; const mA = mk(w, { t: 'team', id: team(0, 0) }, 1, 'onlyA'); const names = X.Db.all('Soldiers').filter(s => s.team_id !== team(0, 0)).map(s => s.full_name);
  const resA = JSON.stringify(ok(w.as(cT, 'marches.roll', { courseId: c1, marchId: mA.r.march.id }))); names.forEach(n => assert.ok(!resA.includes(n), 'foreign name leaked')); refused(w.as(cT2, 'marches.roll', { courseId: c1, marchId: mA.r.march.id }), ['NOT_FOUND']);
});
done();
