// B7 — read-only "missing fitness components" screen (Fitness.completion) + B8 server-side time rules unchanged. Node only, synthetic data.
const { suite } = require('./tlib'); const { t, done, assert } = suite('b7_gaps.js'); const { world, NAME_INACTIVE, NAME_CANCELLED } = require('./world');
const FULL = { pullups: 15, parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' };
function W() {
  const S = world(), { X, admin, c1 } = S;
  const v = X.Fitness.importDraft(admin, c1, {}); X.Fitness.approve(admin, v.id, { verified_against_source: true, reason: 'בדיקה' });
  S.reg = X.Fitness.typesList(admin, c1).find(x => !x.is_opening); S.open = X.Fitness.typesList(admin, c1).find(x => x.is_opening);
  S.res = (sol, raw, date, type, ctx) => X.Records.create(ctx || admin, 'FitnessTests', c1, Object.assign({ request_id: S.rid(), soldier_id: sol.id, test_date: date || '2026-11-09', test_type_id: (type || S.reg).id }, raw)).record;
  S.names = (o) => o.rows.map(r => r.soldier_name).sort();
  return S;
}
const comp = (o, name) => o.rows.find(r => r.soldier_name === name);
const snap = (X) => JSON.stringify(['Soldiers', 'FitnessTests', 'FitnessScoringVersions', 'FitnessTestTypes', 'AuditLog'].map(n => { try { return X.Db.all(n); } catch (e) { return null; } }));

t('integration', 'B7 states: no result / partial / full / pending review are told apart; missing components are exact; nothing is scored 0', () => {
  const S = W(), { X, admin, c1 } = S, sol = S.S;
  S.res(sol.a, { pullups: 15, run3km: '13:00' });                                   // partial
  S.res(sol.a2, Object.assign({}, FULL, { pullups: 0 }));                           // girl, 0 reps => review
  S.res(sol.c, FULL);                                                              // full
  const o = X.Fitness.completion(admin, c1, {});
  assert.deepStrictEqual(S.names(o), ['אלף', 'אלף-שני', 'בית', 'גימל', 'דלת'].map(n => ({ 'אלף': 'SOLA77', 'אלף-שני': 'SOLA277', 'בית': 'SOLB77', 'גימל': 'SOLC77', 'דלת': 'SOLD77' }[n])).sort());
  const a = comp(o, 'SOLA77'), a2 = comp(o, 'SOLA277'), b = comp(o, 'SOLB77'), c = comp(o, 'SOLC77');
  assert.strictEqual(a.complete, false); assert.deepStrictEqual(a.gaps.map(g => g.component + ':' + g.state), ['parallel_bars:missing', 'trap_bar:missing', 'run150x2:missing']); assert.strictEqual(a.no_results, false);
  assert.deepStrictEqual(a2.gaps.map(g => g.component + ':' + g.state), ['pullups:review']); assert.strictEqual(a2.components.pullups.text, 'ממתין לבדיקה');
  assert.strictEqual(b.no_results, true); assert.strictEqual(b.gaps.length, 5); assert.ok(b.gaps.every(g => g.state === 'missing')); assert.strictEqual(b.last_test_date, '');
  assert.strictEqual(c.complete, true); assert.strictEqual(c.gaps.length, 0); assert.strictEqual(c.last_test_date, '2026-11-09');
  assert.deepStrictEqual([o.counts.soldiers, o.counts.complete, o.counts.incomplete, o.counts.no_results, o.counts.with_review, o.counts.with_blocked], [5, 1, 4, 2, 1, 0]);
  assert.deepStrictEqual(o.counts.by_component.pullups, { label: 'מתח', missing: 2, review: 1, blocked: 0 });
  assert.strictEqual(o.rows[o.rows.length - 1].complete, true, 'complete soldiers sort last');
  assert.ok(o.note.includes('נפסלה'), 'screen states that a disqualified rule is not defined');
});
t('integration', 'B7: opening test (no 150x2 component) — that component is "not part of this test", never a gap; latest result per soldier wins', () => {
  const S = W(), { X, admin, c1 } = S, sol = S.S;
  S.res(sol.a, { pullups: 15, parallel_bars: 20, trap_bar: 10, run3km: '13:00' }, '2026-11-01', S.open);
  let o = X.Fitness.completion(admin, c1, {}); const a = comp(o, 'SOLA77');
  assert.strictEqual(a.components.run150x2.state, 'na'); assert.strictEqual(a.complete, true);
  S.res(sol.a, { pullups: 15 }, '2026-11-05');                                       // newer, partial
  o = X.Fitness.completion(admin, c1, {}); assert.strictEqual(comp(o, 'SOLA77').complete, false); assert.strictEqual(comp(o, 'SOLA77').last_test_date, '2026-11-05');
});
t('integration', 'B7: a result with a component that cannot be scored (no table / gender missing) is "blocked", never complete', () => {
  const S = W(), { X, admin, c1 } = S, sol = S.S; const r = S.res(sol.a, FULL);
  const cs = JSON.parse(r.component_scores_json); cs.run3km = { score: null, reason: 'no_table' }; X.Db.update('FitnessTests', r.id, { component_scores_json: JSON.stringify(cs) });
  const o = X.Fitness.completion(admin, c1, {}), a = comp(o, 'SOLA77');
  assert.deepStrictEqual(a.gaps.map(g => g.component + ':' + g.state), ['run3km:blocked']); assert.strictEqual(a.complete, false); assert.strictEqual(o.counts.with_blocked, 1);
});
t('integration', 'B7 permissions: every commander sees ONLY the soldiers of the scope assigned to him (team / department / course); none / other course are refused or empty', () => {
  const S = W(), { X, admin, c1, cT, cD, cC, cT2, none, cO } = S, sol = S.S;
  [sol.a, sol.a2, sol.b, sol.c, sol.d].forEach(s => S.res(s, { pullups: 15 }));
  const nm = (ctx) => S.names(X.Fitness.completion(ctx, c1, {}));
  assert.deepStrictEqual(nm(cT), ['SOLA277', 'SOLA77']);
  assert.deepStrictEqual(nm(cD), ['SOLA277', 'SOLA77', 'SOLB77']);
  assert.deepStrictEqual(nm(cT2), ['SOLC77']);
  assert.strictEqual(nm(cC).length, 5); assert.strictEqual(nm(admin).length, 5);
  let none_r; try { none_r = nm(none); } catch (e) { none_r = e.code; }
  assert.ok(none_r === 'FORBIDDEN' || (Array.isArray(none_r) && none_r.length === 0), 'unassigned commander sees nothing: ' + JSON.stringify(none_r));
  assert.strictEqual(S.code(() => X.Fitness.completion(cO, c1, {})), 'FORBIDDEN', 'commander of another course');
  assert.strictEqual(S.code(() => X.Fitness.completion(cT, S.c2, {})), 'FORBIDDEN', 'course outside scope');
  // counts are computed from the commander's own scope only
  assert.strictEqual(X.Fitness.completion(cT, c1, {}).counts.soldiers, 2);
  // teams list shows only the commander's teams; a team filter outside the scope yields nothing (never leaks)
  const o = X.Fitness.completion(cT, c1, {}); assert.strictEqual(o.teams.length, 1);
  const other = X.Courses.org(admin, c1).teams.find(t => t.id !== o.teams[0].id);
  const f = X.Fitness.completion(cT, c1, { teamId: other.id }); assert.strictEqual(f.rows.length, 0); assert.strictEqual(f.counts.soldiers, 0);
  assert.ok(!JSON.stringify(X.Fitness.completion(cT, c1, {})).includes('SOLC77'), 'no foreign soldier anywhere in the payload');
});
t('integration', 'B7: inactive and cancelled soldiers and cancelled results are not listed', () => {
  const S = W(), { X, admin, c1 } = S, sol = S.S;
  const all = JSON.stringify(X.Fitness.completion(admin, c1, {}));
  assert.ok(!all.includes(NAME_INACTIVE) && !all.includes(NAME_CANCELLED));
  const r = S.res(sol.a, FULL); X.Records.cancel(admin, 'FitnessTests', r.id, 'בדיקה');
  assert.strictEqual(comp(X.Fitness.completion(admin, c1, {}), 'SOLA77').no_results, true, 'cancelled result does not count as a result');
});
t('integration', 'B7 multiple teams + filters: team filter, component filter, both; counts follow the team filter and ignore the component filter', () => {
  const S = W(), { X, admin, c1 } = S, sol = S.S, org = X.Courses.org(admin, c1);
  S.res(sol.a, FULL); S.res(sol.b, { pullups: 15, parallel_bars: 20 }); S.res(sol.c, { run3km: '13:00' });
  const tA = sol.a.team_id, tB = sol.b.team_id; assert.notStrictEqual(tA, tB);
  const byTeam = X.Fitness.completion(admin, c1, { teamId: tA }); assert.deepStrictEqual(S.names(byTeam), ['SOLA277', 'SOLA77'].sort()); assert.strictEqual(byTeam.counts.complete, 1);
  const byComp = X.Fitness.completion(admin, c1, { component: 'run3km' }); assert.ok(byComp.rows.every(r => r.gaps.some(g => g.component === 'run3km')));
  assert.ok(!byComp.rows.some(r => r.soldier_name === 'SOLC77'), 'soldier with run3km entered is not listed under run3km');
  assert.strictEqual(byComp.counts.soldiers, 5, 'counts ignore the component filter');
  const both = X.Fitness.completion(admin, c1, { teamId: tB, component: 'trap_bar' }); assert.deepStrictEqual(S.names(both), ['SOLB77']);
  assert.ok(org.teams.length >= 4); assert.ok(X.Fitness.completion(admin, c1, {}).teams.length === org.teams.length, 'admin gets all teams');
  assert.strictEqual(S.code(() => X.Fitness.completion(admin, c1, { component: 'zzz' })), 'VALIDATION'); assert.strictEqual(S.code(() => X.Fitness.completion(admin, c1, { teamId: 5 })), 'VALIDATION');
});
t('integration', 'B7 is strictly read-only: the database is byte-identical after calls (also through the API route and for commanders)', () => {
  const S = W(), { X, admin, c1, cT } = S; S.res(S.S.a, { pullups: 15 }); const before = snap(X);
  X.Fitness.completion(admin, c1, {}); X.Fitness.completion(cT, c1, { component: 'pullups' }); S.as(cT, 'fitness.completion', { courseId: c1, opts: {} });
  assert.strictEqual(snap(X), before);
  const r = S.as(cT, 'fitness.completion', { courseId: c1, opts: {} }); assert.ok(r && (r.ok === undefined || r.ok)); 
});
t('integration', 'B8 server rule unchanged: invalid mm:ss strings and non-strings are still rejected by the server; valid ones are accepted; scoring values unchanged', () => {
  const S = W(), { X, c1 } = S, sol = S.S;
  ['13', '1300', '13:5', '13:60', '1:2:3', 'aa:bb', '-1:00', '13.00', ' 13:00x'].forEach(v => assert.strictEqual(S.code(() => S.res(sol.a, { run3km: v })), 'VALIDATION', 'rejects ' + v));
  assert.strictEqual(S.code(() => S.res(sol.a, { run3km: 780 })), 'VALIDATION', 'numbers are not times');
  const ok = S.res(sol.a, { run3km: '13:00', run150x2: '0:50' }); assert.strictEqual(JSON.parse(ok.component_scores_json).run3km.reason, 'ok');
  const r2 = S.res(sol.c, FULL); const cs = JSON.parse(r2.component_scores_json); assert.ok(Object.keys(cs).every(k => cs[k].reason === 'ok' && typeof cs[k].score === 'number'));
});
t('integration', 'B7 regression: every result-entry route still works (direct create by admin and commander, admin edit, import) and shows up in the gaps screen', () => {
  const S = W(), { X, admin, c1, cT } = S, sol = S.S;
  const r = S.res(sol.a, { pullups: 15 }, '2026-11-02');                           // admin create
  const rc = S.res(sol.a2, Object.assign({}, FULL, { pullups: 2 }), '2026-11-02', S.reg, S.cT);   // commander create in own scope
  assert.ok(rc.id);
  X.Records.adminEdit(admin, 'FitnessTests', r.id, { parallel_bars: 20, trap_bar: 10, run150x2: '00:50', run3km: '13:00' }, 'השלמה');
  assert.strictEqual(comp(X.Fitness.completion(admin, c1, {}), 'SOLA77').complete, true, 'update completes the soldier');
  const j = X.Import.start(admin, c1, { target: 'fitness', file_name: 'f.xlsx', mapping: { personal_number: 'a', test_date: 'b', test_type: 'c', pullups: 'd', run3km: 'e' }, rows: [{ a: '201', b: '2026-11-03', c: S.reg.name, d: 12, e: '14:00' }] });
  X.Import.commit(admin, j.id, true);
  const b = comp(X.Fitness.completion(admin, c1, {}), 'SOLB77'); assert.strictEqual(b.no_results, false); assert.deepStrictEqual(b.gaps.map(g => g.component), ['parallel_bars', 'trap_bar', 'run150x2']);
  assert.ok(['FORBIDDEN', 'VALIDATION'].includes(S.code(() => S.res(sol.d, FULL, '2026-11-02', S.reg, cT))), 'commander cannot enter results outside his scope (refused, existing behaviour)');
});

// ---- R2: required components come from the test type; absent/corrupt data can never make a soldier "complete" ----
const setJson = (X, r, v) => X.Db.update('FitnessTests', r.id, { component_scores_json: v });
t('integration', 'R2: regular type, component_scores_json empty string / null / missing => every required component is missing (or blocked), complete=false', () => {
  const S = W(), { X, admin, c1 } = S;
  [['', S.S.a], [null, S.S.b], [' ', S.S.c]].forEach(([v, sol]) => { const r = S.res(sol, FULL); setJson(X, r, v); });
  const o = X.Fitness.completion(admin, c1, {});
  ['SOLA77', 'SOLB77', 'SOLC77'].forEach(n => { const r = comp(o, n); assert.strictEqual(r.complete, false, n); assert.strictEqual(r.gaps.length, 5, n); assert.ok(r.gaps.every(g => g.state === 'blocked' || g.state === 'missing'), n); });
});
t('integration', 'R2: "{}" with a type that requires five components => five missing (not na, not complete)', () => {
  const S = W(), { X, admin, c1 } = S; const r = S.res(S.S.a, FULL); setJson(X, r, '{}');
  const a = comp(X.Fitness.completion(admin, c1, {}), 'SOLA77'); assert.strictEqual(a.complete, false); assert.deepStrictEqual(a.gaps.map(g => g.state), ['missing', 'missing', 'missing', 'missing', 'missing']);
  assert.ok(Object.values(a.components).every(c => c.state === 'missing'), 'no na for required components');
});
t('integration', 'R2: one required component absent from the JSON of a full type => that one is missing, soldier incomplete', () => {
  const S = W(), { X, admin, c1 } = S; const r = S.res(S.S.a, FULL); const cs = JSON.parse(r.component_scores_json); delete cs.trap_bar; setJson(X, r, JSON.stringify(cs));
  const a = comp(X.Fitness.completion(admin, c1, {}), 'SOLA77'); assert.strictEqual(a.complete, false); assert.deepStrictEqual(a.gaps.map(g => g.component + ':' + g.state), ['trap_bar:missing']); assert.strictEqual(a.components.trap_bar.state, 'missing');
});
t('integration', 'R2: opening type — the component it does not require stays na (and is not a gap); complete when all required are ok', () => {
  const S = W(), { X, admin, c1 } = S; S.res(S.S.a, { pullups: 15, parallel_bars: 20, trap_bar: 10, run3km: '13:00' }, '2026-11-01', S.open);
  let a = comp(X.Fitness.completion(admin, c1, {}), 'SOLA77'); assert.strictEqual(a.components.run150x2.state, 'na'); assert.strictEqual(a.complete, true);
  // and the same soldier on the REGULAR type without run150x2 is NOT complete: there it is required
  S.res(S.S.b, { pullups: 15, parallel_bars: 20, trap_bar: 10, run3km: '13:00' }); const b = comp(X.Fitness.completion(admin, c1, {}), 'SOLB77'); assert.strictEqual(b.components.run150x2.state, 'missing'); assert.strictEqual(b.complete, false);
});
t('integration', 'R2: test_type_id that does not exist / type deleted => blocked, never complete', () => {
  const S = W(), { X, admin, c1 } = S; const r = S.res(S.S.a, FULL); X.Db.update('FitnessTests', r.id, { test_type_id: 'no-such-type' });
  let a = comp(X.Fitness.completion(admin, c1, {}), 'SOLA77'); assert.strictEqual(a.complete, false); assert.ok(a.gaps.length === 5 && a.gaps.every(g => g.state === 'blocked')); assert.strictEqual(a.type_name, '');
  const r2 = S.res(S.S.b, FULL); X.Db.update('FitnessTests', r2.id, { test_type_id: '' }); assert.strictEqual(comp(X.Fitness.completion(admin, c1, {}), 'SOLB77').complete, false);
});
t('integration', 'R2: corrupt JSON (component_scores_json or the type\'s weights/components) => never complete', () => {
  const S = W(), { X, admin, c1 } = S; const r = S.res(S.S.a, FULL);
  ['{bad', '[1,2]', '"x"', '123', 'null'].forEach(v => { setJson(X, r, v); const a = comp(X.Fitness.completion(admin, c1, {}), 'SOLA77'); assert.strictEqual(a.complete, false, v); assert.ok(a.gaps.length >= 1, v); });
  setJson(X, r, JSON.stringify(JSON.parse(JSON.stringify({ pullups: { score: 1, reason: 'ok' } }))));
  const cs = {}; ['pullups', 'parallel_bars', 'trap_bar', 'run150x2', 'run3km'].forEach(c => cs[c] = { score: 80, reason: 'ok' }); setJson(X, r, JSON.stringify(cs)); assert.strictEqual(comp(X.Fitness.completion(admin, c1, {}), 'SOLA77').complete, true, 'sanity: intact data is complete');
  X.Db.update('FitnessTestTypes', S.reg.id, { weights_json: '{bad', components_json: '{bad' }); let a = comp(X.Fitness.completion(admin, c1, {}), 'SOLA77'); assert.strictEqual(a.complete, false); assert.ok(a.gaps.every(g => g.state === 'blocked'));
  X.Db.update('FitnessTestTypes', S.reg.id, { weights_json: '{}', components_json: '[]' }); assert.strictEqual(comp(X.Fitness.completion(admin, c1, {}), 'SOLA77').complete, false, 'type with no required components is never complete');
  X.Db.update('FitnessTestTypes', S.reg.id, { weights_json: '{bad', components_json: JSON.stringify(['pullups', 'run3km']) }); a = comp(X.Fitness.completion(admin, c1, {}), 'SOLA77'); assert.strictEqual(a.complete, true, 'weights unreadable: components_json fallback decides'); assert.strictEqual(a.components.trap_bar.state, 'na');
});
t('integration', 'R2: "ok" with no numeric score is not complete; a score-less ok never hides a gap; missing/review/blocked stay distinct', () => {
  const S = W(), { X, admin, c1 } = S; const r = S.res(S.S.a, FULL); const cs = JSON.parse(r.component_scores_json);
  cs.pullups = { score: null, reason: 'ok' }; cs.parallel_bars = { score: null, reason: 'not_entered' }; cs.trap_bar = { score: null, reason: 'out_of_range' }; cs.run150x2 = { score: null, reason: 'no_table' }; setJson(X, r, JSON.stringify(cs));
  const a = comp(X.Fitness.completion(admin, c1, {}), 'SOLA77'); assert.deepStrictEqual(a.gaps.map(g => g.component + ':' + g.state), ['pullups:blocked', 'parallel_bars:missing', 'trap_bar:review', 'run150x2:blocked']); assert.strictEqual(a.complete, false);
});
t('integration', 'R2: no combination of absent / damaged data yields complete=true (sweep) and commander scope + read-only still hold under corrupt data', () => {
  const S = W(), { X, admin, c1, cT } = S; const rs = [S.res(S.S.a, FULL), S.res(S.S.a2, FULL), S.res(S.S.c, FULL)];
  const bads = ['', '{}', '{bad', 'null', '[]', JSON.stringify({ pullups: { score: 90, reason: 'ok' } })];
  bads.forEach(v => { rs.forEach(r => setJson(X, r, v)); const o = X.Fitness.completion(admin, c1, {}); ['SOLA77', 'SOLA277', 'SOLC77'].forEach(n => assert.strictEqual(comp(o, n).complete, false, n + ' / ' + v)); });
  const before = snap(X); const o = X.Fitness.completion(cT, c1, {}); assert.strictEqual(snap(X), before, 'read-only'); assert.ok(!JSON.stringify(o).includes('SOLC77') && !JSON.stringify(o).includes('SOLD77'), 'no leak to team commander');
});
t('integration', 'R2: gender_missing and no_table components are blocked (not complete, not missing); a soldier with several unscorable components lists each exactly', () => {
  const S = W(), { X, admin, c1 } = S; const r = S.res(S.S.a, FULL); const cs = JSON.parse(r.component_scores_json);
  cs.pullups = { score: null, reason: 'gender_missing' }; cs.trap_bar = { score: null, reason: 'no_table' }; cs.run3km = { score: null, reason: 'something_new' }; setJson(X, r, JSON.stringify(cs));
  const o = X.Fitness.completion(admin, c1, {}), a = comp(o, 'SOLA77'); assert.deepStrictEqual(a.gaps.map(g => g.component + ':' + g.state), ['pullups:blocked', 'trap_bar:blocked', 'run3km:blocked']); assert.strictEqual(a.complete, false);
  assert.strictEqual(o.counts.with_blocked, 1); assert.strictEqual(o.counts.by_component.pullups.blocked, 1);
});
t('integration', 'R2: a soldier whose gender was removed after the result: the stored result is still not "complete" unless every stored component is ok; no data is rewritten', () => {
  const S = W(), { X, admin, c1 } = S; S.res(S.S.a, FULL); X.Db.update('Soldiers', S.S.a.id, { gender: '' }); const before = snap(X);
  const a = comp(X.Fitness.completion(admin, c1, {}), 'SOLA77'); assert.strictEqual(a.complete, true, 'stored result is intact; completion reads, never recomputes'); assert.strictEqual(snap(X), before);
});
t('integration', 'R2: a commander of one team cannot see, via counts, teams list or rows, any data of a team outside his scope even when that team\'s data is corrupt', () => {
  const S = W(), { X, admin, c1, cT } = S; const r = S.res(S.S.c, FULL); setJson(X, r, '{bad'); S.res(S.S.a, FULL);
  const o = X.Fitness.completion(cT, c1, {}); assert.strictEqual(o.counts.soldiers, 2); assert.strictEqual(o.counts.no_results + o.counts.complete + o.counts.incomplete - o.counts.no_results, 2); assert.ok(!JSON.stringify(o).includes('SOLC77')); assert.strictEqual(o.counts.with_blocked, 0);
});
// ---- R3: weights_json must be semantically valid (Fitness.checkWeights_) before it defines the required components ----
const typeWith = (S, patch) => S.X.Db.update('FitnessTestTypes', S.reg.id, patch);
const ALL5 = ['pullups', 'parallel_bars', 'trap_bar', 'run150x2', 'run3km'];
t('integration', 'R3: syntactically valid but semantically invalid weights_json (sum != 100, negative, non-number, unknown key, partial keys) => blocked, never complete — even with a full components_json', () => {
  const S = W(), { X, admin, c1 } = S; S.res(S.S.a, FULL);
  const bad = { 'sum 40 (partial keys)': { pullups: 20, parallel_bars: 20 }, 'sum 99': { pullups: 20, parallel_bars: 20, trap_bar: 20, run150x2: 10, run3km: 29 }, 'sum 101': { pullups: 21, parallel_bars: 20, trap_bar: 20, run150x2: 10, run3km: 30 },
    negative: { pullups: -20, parallel_bars: 60, trap_bar: 20, run150x2: 10, run3km: 30 }, 'string weight': { pullups: '20', parallel_bars: 20, trap_bar: 20, run150x2: 10, run3km: 30 }, 'null weight': { pullups: null, parallel_bars: 40, trap_bar: 20, run150x2: 10, run3km: 30 },
    'unknown key + known': { pullups: 20, parallel_bars: 20, trap_bar: 20, run150x2: 10, run3km: 20, swim: 10 }, 'array': [20, 20, 20, 10, 30], 'empty array': [], 'number': 100, 'string': 'x' };
  Object.keys(bad).forEach(k => { typeWith(S, { weights_json: JSON.stringify(bad[k]), components_json: JSON.stringify(ALL5) }); const a = comp(X.Fitness.completion(admin, c1, {}), 'SOLA77');
    assert.strictEqual(a.complete, false, k); assert.strictEqual(a.gaps.length, 5, k + ' all five blocked'); assert.ok(a.gaps.every(g => g.state === 'blocked'), k); assert.ok(!Object.values(a.components).some(c => c.state === 'na'), k + ': no na from a damaged definition'); });
});
t('integration', 'R3: a fully valid weights_json (sum 100) defines the required set; 4-component opening type is classified correctly; no regression', () => {
  const S = W(), { X, admin, c1 } = S; S.res(S.S.a, FULL);
  assert.strictEqual(comp(X.Fitness.completion(admin, c1, {}), 'SOLA77').complete, true, 'default regular type');
  S.res(S.S.b, { pullups: 15, parallel_bars: 20, trap_bar: 10, run3km: '13:00' }, '2026-11-01', S.open); const b = comp(X.Fitness.completion(admin, c1, {}), 'SOLB77'); assert.strictEqual(b.complete, true); assert.strictEqual(b.components.run150x2.state, 'na');
  assert.strictEqual(Object.values(JSON.parse(S.open.weights_json || JSON.stringify(S.open.weights))).reduce((x, y) => x + y, 0), 100);
  typeWith(S, { weights_json: JSON.stringify({ pullups: 40, run3km: 60 }), components_json: JSON.stringify(['pullups', 'run3km']) });   // valid custom 2-component type
  const r = S.res(S.S.c, { pullups: 15, run3km: '13:00' }); const c = comp(X.Fitness.completion(admin, c1, {}), 'SOLC77'); assert.strictEqual(c.complete, true); assert.strictEqual(c.components.trap_bar.state, 'na');
});
t('integration', 'R3: weights_json unparseable / empty / missing => components_json is the fallback only when it is itself valid; otherwise blocked', () => {
  const S = W(), { X, admin, c1 } = S; S.res(S.S.a, FULL); const a = () => comp(X.Fitness.completion(admin, c1, {}), 'SOLA77');
  [['{bad', null], ['{}', null], ['', null], ['null', null]].forEach(([wj]) => { typeWith(S, { weights_json: wj, components_json: JSON.stringify(ALL5) }); assert.strictEqual(a().complete, true, 'fallback works for weights=' + JSON.stringify(wj)); });
  typeWith(S, { weights_json: '{bad', components_json: JSON.stringify(['pullups', 'run3km']) }); assert.strictEqual(a().components.trap_bar.state, 'na', 'valid partial components_json is a legal fallback definition');
  ['{bad', '[]', '{}', 'null', '"x"', JSON.stringify(['pullups', 'swim']), JSON.stringify(['pullups', 'pullups']), JSON.stringify([1, 2]), JSON.stringify({ pullups: 1 })].forEach(cj => { typeWith(S, { weights_json: '{bad', components_json: cj }); const x = a(); assert.strictEqual(x.complete, false, 'bad fallback ' + cj); assert.ok(x.gaps.every(g => g.state === 'blocked'), cj); });
});
t('integration', 'R3: both sources damaged => blocked; a damaged definition never yields partial keys as the required set; read-only', () => {
  const S = W(), { X, admin, c1 } = S; S.res(S.S.a, FULL); typeWith(S, { weights_json: JSON.stringify({ pullups: 20, parallel_bars: 20 }), components_json: '{bad' }); const before = snap(X);
  const a = comp(X.Fitness.completion(admin, c1, {}), 'SOLA77'); assert.strictEqual(a.complete, false); assert.strictEqual(a.gaps.length, 5); assert.strictEqual(snap(X), before);
  assert.strictEqual(X.Fitness.completion(admin, c1, {}).counts.with_blocked, 1);
});
done();
