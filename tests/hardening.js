// Tests added after the independent review (v0.2.1): races inside the lock, cancelled-record privacy,
// clone permissions opt-in, validation hardening, and safe Sheets writes (against a mock sheet).
const { load } = require('./harness');
const assert = require('assert');
let pass = 0, fail = 0; const failures = [];
function t(name, fn) { try { fn(); pass++; console.log('PASS', name); } catch (e) { fail++; failures.push(name); console.log('FAIL', name, '\n   ', e.message); } }
const code = fn => { try { fn(); return null; } catch (e) { return e.code || ('JS:' + e.message); } };

function setup() {
  const X = load();
  const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
  const { id: c1 } = X.Courses.create(admin, { name: 'קורס א', start_date: '2026-01-01' });
  const org = X.Courses.org(admin, c1); const dep = org.departments[0].id, team = org.teams[0].id;
  const sid = X.Util.uuid(); X.Db.insert('Soldiers', { id: sid, course_id: c1, personal_number: '1001', full_name: 'בדיקה', gender: 'M', department_id: dep, team_id: team, active: true, record_status: 'active' });
  const nt = X.Util.uuid(); X.Db.insert('NavigationTypes', { id: nt, course_id: c1, name: 'יום', active: true });
  X.Courses.addUser(admin, { email: 'cmd1@x.com', role: 'commander', course_ids: [c1] });
  X.Assignments.create(admin, { course_id: c1, user_email: 'cmd1@x.com', scope_type: 'course', scope_id: c1, reason: 'בדיקה' });
  const cmd1 = { email: 'cmd1@x.com', role: 'commander', courseScope: [c1] };
  const payload = o => Object.assign({ request_id: X.Util.uuid(), soldier_id: sid, test_date: '2026-03-01', navigation_type_id: nt, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 }, o || {});
  // one-shot hook that runs right when the lock is acquired (i.e. after the caller's pre-checks)
  const raceOnce = hook => { const orig = X.Locks.run; X.Locks.run = function (fn) { X.Locks.run = orig; hook(); return orig(fn); }; };
  const archive = () => X.Db.update('Courses', c1, { status: 'archived' });
  return { X, admin, cmd1, c1, sid, nt, payload, raceOnce, archive };
}

// ---------- finding 1: history of cancelled records ----------
t('history of a cancelled record is NOT_FOUND for a commander, allowed for admin', () => {
  const { X, admin, cmd1, c1, payload } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  assert.ok(X.Records.history(cmd1, 'NavigationTests', id).length >= 1);
  X.Records.cancel(admin, 'NavigationTests', id, 'שגוי');
  assert.strictEqual(code(() => X.Records.history(cmd1, 'NavigationTests', id)), 'NOT_FOUND');
  assert.ok(X.Records.history(admin, 'NavigationTests', id).some(h => h.action === 'CANCEL'));
  X.Records.restore(admin, 'NavigationTests', id);
  assert.ok(X.Records.history(cmd1, 'NavigationTests', id).length >= 1, 'visible again after restore');
});

// ---------- finding 2: re-check inside the lock ----------
t('race: course archived between pre-check and lock => create blocked, nothing written', () => {
  const { X, cmd1, c1, payload, raceOnce, archive } = setup(); raceOnce(archive);
  assert.strictEqual(code(() => X.Records.create(cmd1, 'NavigationTests', c1, payload())), 'COURSE_ARCHIVED');
  assert.strictEqual(X.mem.NavigationTests ? X.mem.NavigationTests.length : 0, 0);
});
t('race: archived before lock => adminEdit blocked, record unchanged', () => {
  const { X, admin, cmd1, c1, payload, raceOnce, archive } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  raceOnce(archive); assert.strictEqual(code(() => X.Records.adminEdit(admin, 'NavigationTests', id, { plan_score: 1 }, 'x')), 'COURSE_ARCHIVED');
  assert.strictEqual(X.mem.NavigationTests[0].plan_score, 4);
});
t('race: archived before lock => cancel blocked', () => {
  const { X, admin, cmd1, c1, payload, raceOnce, archive } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  raceOnce(archive); assert.strictEqual(code(() => X.Records.cancel(admin, 'NavigationTests', id, 'x')), 'COURSE_ARCHIVED');
  assert.strictEqual(X.mem.NavigationTests[0].record_status, 'active');
});
t('race: archived before lock => restore blocked', () => {
  const { X, admin, cmd1, c1, payload, raceOnce, archive } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  X.Records.cancel(admin, 'NavigationTests', id, 'x'); raceOnce(archive);
  assert.strictEqual(code(() => X.Records.restore(admin, 'NavigationTests', id)), 'COURSE_ARCHIVED');
  assert.strictEqual(X.mem.NavigationTests[0].record_status, 'cancelled');
});
t('race: archived before lock => requestCorrection blocked, no request stored', () => {
  const { X, cmd1, c1, payload, raceOnce, archive } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  raceOnce(archive); assert.strictEqual(code(() => X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5 }, 'סיבה')), 'COURSE_ARCHIVED');
  assert.strictEqual((X.mem.CorrectionRequests || []).length, 0);
});
t('race: record cancelled before lock => requestCorrection rejected (NOT_FOUND for commander, uniform)', () => {
  const { X, admin, cmd1, c1, payload, raceOnce } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  raceOnce(() => X.Db.update('NavigationTests', id, { record_status: 'cancelled' }));
  assert.strictEqual(code(() => X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5 }, 'סיבה')), 'NOT_FOUND');
  assert.strictEqual((X.mem.CorrectionRequests || []).length, 0);
});
t('race: archived before lock => reviewCorrection blocked, request stays pending, record unchanged', () => {
  const { X, admin, cmd1, c1, payload, raceOnce, archive } = setup(); const id = X.Records.create(cmd1, 'NavigationTests', c1, payload()).record.id;
  const req = X.Records.requestCorrection(cmd1, 'NavigationTests', id, { plan_score: 5 }, 'סיבה'); raceOnce(archive);
  assert.strictEqual(code(() => X.Records.reviewCorrection(admin, req.id, 'approve')), 'COURSE_ARCHIVED');
  assert.strictEqual(X.mem.CorrectionRequests[0].status, 'pending'); assert.strictEqual(X.mem.NavigationTests[0].plan_score, 4);
});
t('race: commander requests correction for a record he did not create (reloaded owner check)', () => {
  const { X, admin, c1, payload } = setup(); X.Courses.addUser(admin, { email: 'cmd9@x.com', role: 'commander', course_ids: [c1] }); X.Assignments.create(admin, { course_id: c1, user_email: 'cmd9@x.com', scope_type: 'course', scope_id: c1, reason: 'בדיקה' });
  const cmd9 = { email: 'cmd9@x.com', role: 'commander', courseScope: [c1] };
  const id = X.Records.create(admin, 'NavigationTests', c1, payload()).record.id;   // created by admin
  assert.strictEqual(code(() => X.Records.requestCorrection(cmd9, 'NavigationTests', id, { plan_score: 5 }, 'סיבה')), 'FORBIDDEN');
});

// ---------- finding 3: clone permissions are opt-in ----------
t('clone: permissions NOT copied by default, copied only with clone_permissions:true', () => {
  const { X, admin, c1 } = setup();
  const a = X.Courses.create(admin, { name: 'א2', start_date: '2027-01-01', clone_from: c1 }).id;
  const b = X.Courses.create(admin, { name: 'ב2', start_date: '2027-01-01', clone_from: c1, clone_permissions: true }).id;
  const u = X.Db.where('Users', x => x.email === 'cmd1@x.com')[0];
  assert.ok(!u.course_scope.split(',').includes(a)); assert.ok(u.course_scope.split(',').includes(b));
  assert.ok(X.Audit.list(admin, { courseId: b, action: 'COURSE_CLONE' })[0].after_json.includes('"clone_permissions":true'));
  assert.ok(X.Audit.list(admin, { courseId: a, action: 'COURSE_CLONE' })[0].after_json.includes('"clone_permissions":false'));
});

// ---------- finding 4: weightedFitness ----------
{
  const X = load(); const C = X.Calc; const W = { a: 50, b: 50 };
  t('fitness: weights summing 99 / 101 rejected (no silent normalisation)', () => { assert.strictEqual(code(() => C.weightedFitness({ a: 1, b: 1 }, { a: 49, b: 50 })), 'VALIDATION'); assert.strictEqual(code(() => C.weightedFitness({ a: 1, b: 1 }, { a: 51, b: 50 })), 'VALIDATION'); });
  t('fitness: negative / non-numeric / NaN / Infinity / string weights rejected', () => [{ a: -10, b: 110 }, { a: '50', b: 50 }, { a: NaN, b: 100 }, { a: Infinity, b: 0 }, { a: null, b: 100 }].forEach(w => assert.strictEqual(code(() => C.weightedFitness({ a: 1, b: 1 }, w)), 'VALIDATION')));
  t('fitness: empty weights rejected', () => assert.strictEqual(code(() => C.weightedFitness({}, {})), 'VALIDATION'));
  t('fitness: score <0, >100, non-numeric rejected', () => [-1, 100.5, '80', NaN].forEach(v => assert.strictEqual(code(() => C.weightedFitness({ a: v, b: 50 }, W)), 'VALIDATION')));
  t('fitness: boundary scores 0 and 100 accepted; weights exactly 100', () => { assert.strictEqual(C.weightedFitness({ a: 0, b: 100 }, W).score, 50); });
  t('fitness: missing still yields null (not an error) once inputs valid', () => assert.strictEqual(C.weightedFitness({ a: 80, b: null }, W).score, null));
  t('fitness: invalid score reported even if another component is missing', () => assert.strictEqual(code(() => C.weightedFitness({ a: 500, b: null }, W)), 'VALIDATION'));

  // ---------- finding 6: examEvaluate passScore ----------
  t('exam: invalid passScore rejected (NaN, <0, >100, string, Infinity)', () => [NaN, -1, 101, '80', Infinity].forEach(v => assert.strictEqual(code(() => C.examEvaluate({ A: 90 }, v)), 'VALIDATION')));
  t('exam: custom passScore 60 and boundaries 0/100 accepted', () => { assert.strictEqual(C.examEvaluate({ A: 60 }, 60).status, 'passed'); assert.strictEqual(C.examEvaluate({ A: 59 }, 60).status, 'pending_B'); assert.strictEqual(C.examEvaluate({ A: 0 }, 0).status, 'passed'); assert.strictEqual(C.examEvaluate({ A: 100 }, 100).status, 'passed'); });
  t('exam: B fail with custom threshold still forces meeting even if C passes', () => { const r = C.examEvaluate({ A: 50, B: 55, C: 70 }, 60); assert.strictEqual(r.status, 'passed'); assert.strictEqual(r.meeting_required, true); });
  t('exam: passScore null/undefined => default 80', () => { assert.strictEqual(C.examEvaluate({ A: 80 }, null).status, 'passed'); assert.strictEqual(C.examEvaluate({ A: 79 }, undefined).status, 'pending_B'); });
}

// ---------- finding 5: checkContiguity ----------
{
  const X = load(); const S = X.Scoring;
  const reps = rows => ({ kind: 'reps', rows: rows.map(([score, a, b]) => ({ score, reps_min: a, reps_max: b })) });
  const time = rows => ({ kind: 'time', rows: rows.map(([score, a, b]) => ({ score, from_sec: a, to_sec: b })) });
  const has = (issues, frag) => issues.some(i => i.includes(frag));
  t('contiguity: valid reps table => no issues', () => assert.strictEqual(S.checkContiguity(reps([[100, 20, 20], [95, 19, 19], [90, 17, 18]])).length, 0));
  t('contiguity: duplicate score', () => assert.ok(has(S.checkContiguity(reps([[100, 20, 20], [100, 19, 19]])), 'כפול')));
  t('contiguity: ascending/out-of-order scores', () => assert.ok(has(S.checkContiguity(reps([[90, 20, 20], [95, 19, 19]])), 'סדר')));
  t('contiguity: inverted range', () => assert.ok(has(S.checkContiguity(reps([[100, 20, 20], [95, 19, 17]])), 'הפוך')));
  t('contiguity: overlap (reps)', () => assert.ok(has(S.checkContiguity(reps([[100, 20, 20], [95, 19, 20]])), 'חפיפה')));
  t('contiguity: gap (reps)', () => assert.ok(has(S.checkContiguity(reps([[100, 20, 20], [95, 18, 18]])), 'פער')));
  t('contiguity: non-numeric reps / score out of 0-100 / non-integer', () => { assert.ok(S.checkContiguity(reps([[100, '20', 20]])).length); assert.ok(S.checkContiguity(reps([[101, 20, 20]])).length); assert.ok(S.checkContiguity(reps([[100, 2.5, 3]])).length); });
  t('contiguity: the real U3 shape (two rows both "1 rep") is flagged, not approvable', () => assert.ok(S.checkContiguity(reps([[50, 2, 2], [45, 1, 1], [40, 1, 1]])).length > 0));
  t('contiguity: valid time table', () => assert.strictEqual(S.checkContiguity(time([[100, null, 650], [99, 651, 700], [98, 701, null]])).length, 0));
  t('contiguity: time gap / overlap / closed ends / open end in the middle / non-numeric', () => {
    assert.ok(has(S.checkContiguity(time([[100, null, 650], [99, 652, null]])), 'פער'));
    assert.ok(has(S.checkContiguity(time([[100, null, 650], [99, 650, null]])), 'חפיפה'));
    assert.ok(has(S.checkContiguity(time([[100, 10, 650], [99, 651, null]])), 'פתוחה כלפי מטה'));
    assert.ok(has(S.checkContiguity(time([[100, null, 650], [99, 651, 700]])), 'פתוחה כלפי מעלה'));
    assert.ok(has(S.checkContiguity(time([[100, null, null], [99, 651, null]])), 'באמצע'));
    assert.ok(S.checkContiguity(time([[100, null, 'x'], [99, 651, null]])).length);
  });
  t('contiguity v0.2.2: decimal time bounds (650.5 / 651.5) rejected', () => {
    assert.ok(has(S.checkContiguity(time([[100, null, 650.5], [99, 651.5, null]])), 'שלם'));
    assert.ok(S.checkContiguity(time([[100, null, 650], [99, 651.5, null]])).length);
    assert.ok(S.checkContiguity(time([[100, null, 650.5], [99, 651, null]])).length);
  });
  t('contiguity v0.2.2: negative time bounds rejected', () => {
    assert.ok(has(S.checkContiguity(time([[100, null, -5], [99, -4, null]])), 'שלם'));
    assert.ok(S.checkContiguity(time([[100, null, 650], [99, 651, 700], [98, 701, null]])).length === 0, 'valid table still valid');
    assert.ok(S.checkContiguity(time([[100, null, 0], [99, 1, null]])).length === 0, 'zero is allowed');
  });
  t('contiguity: empty table / bad kind / null', () => { assert.ok(S.checkContiguity({ kind: 'reps', rows: [] }).length); assert.ok(S.checkContiguity({ kind: 'x', rows: [] }).length); assert.ok(S.checkContiguity(null).length); });
  t('contiguity: ALL 7 draft tables — only the known U3 table fails', () => {
    const d = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'scoring', 'fitness_scoring_draft.json'), 'utf8'));
    const bad = d.tables.filter(tb => S.checkContiguity({ kind: tb.kind, rows: tb.rows }).length).map(tb => tb.id);
    assert.strictEqual(JSON.stringify(bad), JSON.stringify(['pullups_B_rubberband']));
  });
}

// ---------- finding 7: safe writes to Sheets (mock sheet; verifies OUR logic, not Sheets itself) ----------
function mockSheet(headers, opts) {
  opts = opts || {};
  const grid = [headers.slice()], fmt = {}; let maxRows = 3;
  const key = (r, c) => r + ',' + c;
  const sh = {
    grid, fmt,
    getLastRow: () => grid.length, getLastColumn: () => headers.length, getMaxRows: () => maxRows,
    insertRowsAfter: (_, n) => { maxRows += n; },
    getRange: (r, c, nr, nc) => {
      nr = nr || 1; nc = nc || 1;
      return {
        getValue: () => { const v = (grid[r - 1] || [])[c - 1]; return v === undefined ? '' : v; },
        getNumberFormat: () => fmt[key(r, c)] || 'General',
        getValues: () => { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(((grid[r - 1 + i] || [])[c - 1 + j]) === undefined ? '' : grid[r - 1 + i][c - 1 + j]); out.push(row); } return out; },
        setNumberFormat: f => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) fmt[key(r + i, c + j)] = f; },
        setValues: vals => { if (r + nr - 1 > maxRows) throw new Error('out of grid'); vals.forEach((rowVals, i) => rowVals.forEach((v, j) => sh._put(r + i, c + j, v))); },
        setValue: v => sh._put(r, c, v),
        getFormulas: () => { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (grid[r - 1 + i] || [])[c - 1 + j]; row.push(v && typeof v === 'object' && v.formula ? v.formula : ''); } out.push(row); } return out; },
        clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (grid[r - 1 + i]) grid[r - 1 + i][c - 1 + j] = ''; }
      };
    },
    _put(r, c, v) {
      if (opts.putGuard) opts.putGuard(v);
      grid[r - 1] = grid[r - 1] || [];
      if (((opts.ignoreTextFormat === true || (typeof opts.ignoreTextFormat === 'function' && opts.ignoreTextFormat(v))) || fmt[key(r, c)] !== '@') && typeof v === 'string') {
        if (/^=/.test(v)) v = { formula: v };                    // Sheets would execute it
        else if (/^[0-9]+(\.[0-9]+)?$/.test(v)) v = Number(v);   // Sheets would coerce (loses leading zeros)
      }
      grid[r - 1][c - 1] = v;
    }
  };
  return sh;
}
function sheetsSetup(opts) {
  const X = load(); const S = X.SheetsStore; const headers = X.TABLES.Soldiers.cols; const sh = mockSheet(headers, opts);
  S.sheet_ = () => sh; S.headers_ = () => headers.slice(); // headers read through mock-compatible path
  return { X, S, sh, headers };
}
t('sheets: formula-like text (=, +, -, @) is stored as TEXT, never executed', () => {
  const { S, sh, headers } = sheetsSetup(); const col = headers.indexOf('commander_note');
  ['=HYPERLINK("http://evil","x")', '+1+1', '-2+3', '@SUM(1)'].forEach((v, i) => {
    S.insert('Soldiers', { id: 'id' + i, course_id: 'c', commander_note: v });
    const cell = sh.grid[i + 1][col]; assert.strictEqual(typeof cell, 'string', 'must stay a string: ' + v); assert.strictEqual(cell, v);
    assert.strictEqual(sh.fmt[(i + 2) + ',' + (col + 1)], '@');
  });
});
t('sheets: personal number keeps leading zeros (text column)', () => {
  const { S, sh, headers } = sheetsSetup(); const col = headers.indexOf('personal_number');
  S.insert('Soldiers', { id: 'a', course_id: 'c', personal_number: '0012345' }); assert.strictEqual(sh.grid[1][col], '0012345');
});
t('sheets v0.2.2: ALL non-empty strings are written as text (policy, not prefix list)', () => {
  const { S, sh, headers } = sheetsSetup(); const col = headers.indexOf('full_name');
  S.insert('Soldiers', { id: 'a', course_id: 'c', full_name: 'ישראל ישראלי' }); assert.strictEqual(sh.fmt['2,' + (col + 1)], '@');
});
const DANGEROUS = ['=1+1', ' =1+1', '\t=1+1', '\r=1+1', '\n=1+1', '\u00a0=1+1', '\u200b=1+1', '+1+1', '-2+3', '@SUM(1)', ' +1', '\n-1', '\t@x', '=\n=', ' \t\r\n=HYPERLINK("http://evil")', '00123', '1e3', '2026-01-05'];
t('sheets v0.2.2: dangerous / coercible values stay verbatim strings on INSERT', () => {
  const { S, sh, headers } = sheetsSetup(); const col = headers.indexOf('commander_note');
  DANGEROUS.forEach((v, i) => { S.insert('Soldiers', { id: 'i' + i, course_id: 'c', commander_note: v });
    const cell = sh.grid[i + 1][col]; assert.strictEqual(typeof cell, 'string', JSON.stringify(v)); assert.strictEqual(cell, v); });
});
t('sheets v0.2.2: dangerous / coercible values stay verbatim strings on UPDATE', () => {
  const { S, sh, headers } = sheetsSetup(); const col = headers.indexOf('commander_note');
  S.insert('Soldiers', { id: 'u', course_id: 'c' });
  DANGEROUS.forEach(v => { S.updateById('Soldiers', 'u', { commander_note: v });
    const cell = sh.grid[1][col]; assert.strictEqual(typeof cell, 'string', JSON.stringify(v)); assert.strictEqual(cell, v); });
});
t('sheets v0.2.2: fail-closed — if the text format is NOT honoured, INSERT throws and the row is cleared', () => {
  const { S, sh, headers } = sheetsSetup({ ignoreTextFormat: true }); const col = headers.indexOf('commander_note');
  assert.throws(() => S.insert('Soldiers', { id: 'x', course_id: 'c', commander_note: '=HYPERLINK("http://evil")' }), /UNSAFE_WRITE/);
  assert.ok(sh.grid[1].every(v => v === '' || v === undefined), 'row must be cleared'); assert.strictEqual(typeof sh.grid[1][col], 'string');
});
t('sheets v0.2.2: fail-closed — UPDATE throws and clears the cell when a formula would result', () => {
  const { S, sh, headers } = sheetsSetup({ ignoreTextFormat: true }); const col = headers.indexOf('commander_note');
  sh.grid.push(['u'].concat(new Array(headers.length - 1).fill(''))); sh.grid[1][headers.indexOf('id')] = 'u';
  assert.throws(() => S.updateById('Soldiers', 'u', { commander_note: '=1+1' }), /UNSAFE_WRITE/);
  assert.strictEqual(sh.grid[1][col], '');
});
t('sheets v0.2.2: fail-closed — silent coercion (leading zeros lost) is detected', () => {
  const { S } = sheetsSetup({ ignoreTextFormat: true });
  assert.throws(() => S.insert('Soldiers', { id: 'z', course_id: 'c', personal_number: '0012345' }), /UNSAFE_WRITE/);
});
t('sheets: numbers/booleans/blank pass through unchanged', () => {
  const { S, sh, headers } = sheetsSetup(); const col = headers.indexOf('active');
  S.insert('Soldiers', { id: 'a', course_id: 'c', active: true }); assert.strictEqual(sh.grid[1][col], true);
  assert.strictEqual(S.cellPlan_('NavigationTests', X_cols('NavigationTests'), { distance_km: 3.5 }).find(c => c.header === 'distance_km').value, 3.5);
});
function X_cols(t) { return load().TABLES[t].cols; }
t('sheets: inserting past the grid expands it instead of throwing', () => {
  const { S, sh } = sheetsSetup(); for (let i = 0; i < 10; i++) S.insert('Soldiers', { id: 'r' + i, course_id: 'c' });
  assert.strictEqual(sh.grid.length, 11); assert.ok(sh.getMaxRows() >= 11);
});
t('sheets: unknown column still rejected (schema guard)', () => { const { S } = sheetsSetup(); assert.throws(() => S.insert('Soldiers', { id: 'a', not_a_col: 1 })); });
t('sheets: update with formula-like text is also forced to text', () => {
  const { S, sh, headers } = sheetsSetup(); S.insert('Soldiers', { id: 'u1', course_id: 'c' });
  const col = headers.indexOf('commander_note'); S.updateById('Soldiers', 'u1', { commander_note: '=1+1' });
  assert.strictEqual(sh.grid[1][col], '=1+1');
});


// ---- v0.2.3 ----
function threeFieldSetup(opts) {
  const ctx = sheetsSetup(opts); const { S, sh, headers } = ctx;
  S.insert('Soldiers', { id: 'm', course_id: 'c', commander_note: 'n0', full_name: 'name0', personal_number: '0012345' });
  const cols = ['commander_note', 'full_name', 'personal_number'].map(h => headers.indexOf(h));
  return Object.assign(ctx, { cols, snapshot: () => JSON.stringify([sh.grid[1], cols.map(c => sh.fmt['2,' + (c + 1)])]) });
}
t('sheets v0.2.3: multi-field update where the 3rd field fails => ALL fields back to original (no partial update)', () => {
  // make only the 3rd value unsafe: format '@' is ignored just for '=EVIL'
  const c2 = threeFieldSetup({ ignoreTextFormat: v => v === '=EVIL' }); const before = c2.snapshot();
  assert.throws(() => c2.S.updateById('Soldiers', 'm', { commander_note: 'n1', full_name: 'name1', personal_number: '=EVIL' }), /UNSAFE_WRITE/);
  assert.strictEqual(c2.snapshot(), before, 'sheet must be identical to the pre-update state');
  assert.strictEqual(c2.sh.grid[1][c2.cols[2]], '0012345'); assert.strictEqual(typeof c2.sh.grid[1][c2.cols[2]], 'string');
});
t('sheets v0.2.3: failing update leaves no success trace — Db.update throws before any Audit call can run', () => {
  const c = threeFieldSetup({ ignoreTextFormat: v => v === '=EVIL' });
  let reached = false;
  try { c.S.updateById('Soldiers', 'm', { commander_note: 'n1', full_name: '=EVIL' }); reached = true; } catch (e) { /* expected */ }
  assert.strictEqual(reached, false, 'the call must not return normally, so callers never write the success AuditLog');
});
t('sheets v0.2.3: successful multi-field update still works and keeps text', () => {
  const c = threeFieldSetup(); c.S.updateById('Soldiers', 'm', { commander_note: ' =1', full_name: 'x', personal_number: '000' });
  assert.deepStrictEqual([c.sh.grid[1][c.cols[0]], c.sh.grid[1][c.cols[1]], c.sh.grid[1][c.cols[2]]], [' =1', 'x', '000']);
});
t('sheets v0.2.3: rollback that itself fails => ROLLBACK_FAILED, never presented as restored', () => {
  let armed = false;
  const c = threeFieldSetup({ ignoreTextFormat: v => v === '=EVIL', putGuard: v => { if (armed && v === 'n0') throw new Error('sheet unavailable'); } });
  armed = true;
  assert.throws(() => c.S.updateById('Soldiers', 'm', { commander_note: 'n1', full_name: '=EVIL' }), /ROLLBACK_FAILED/);
});
t('sheets v0.2.3: exception thrown mid-write also triggers rollback', () => {
  const c = threeFieldSetup({ putGuard: v => { if (v === 'name1') throw new Error('boom'); } });
  const before = c.snapshot();
  assert.throws(() => c.S.updateById('Soldiers', 'm', { commander_note: 'n1', full_name: 'name1' }), /boom/);
  assert.strictEqual(c.snapshot(), before);
});
t('scoring v0.2.3: lookup(time) rejects non-integer / negative / NaN / Infinity seconds', () => {
  const { X } = sheetsSetup(); const tb = { status: 'APPROVED', kind: 'time', rows: [{ score: 100, from_sec: null, to_sec: 650 }, { score: 99, from_sec: 651, to_sec: 700 }, { score: 98, from_sec: 701, to_sec: null }] };
  [650.5, 651.5, -1, NaN, Infinity, -Infinity].forEach(v => assert.strictEqual(code(() => X.Scoring.lookup(tb, v)), 'VALIDATION', String(v)));
  assert.strictEqual(X.Scoring.lookup(tb, 0), 100); assert.strictEqual(X.Scoring.lookup(tb, 650), 100);
  assert.strictEqual(X.Scoring.lookup(tb, 651), 99); assert.strictEqual(X.Scoring.lookup(tb, '10:50'), 100);
});

console.log('\nTOTAL pass=%d fail=%d', pass, fail);
if (fail) { console.log('FAILED:', failures.join(' | ')); process.exit(1); }
