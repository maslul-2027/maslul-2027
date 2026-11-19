// v1.0.2 — replaceAll / Restore must keep text EXACTLY, no matter which row of a column holds the first risky value.
// Runs the REAL SheetsStore.replaceAll on the in-memory fake of SpreadsheetApp (tests/fakesheets.js). Simulation only: Sheets '@' behaviour is assumed, not verified in Apps Script.
const { suite } = require('./tlib'); const { t, done, assert } = suite('v1_replaceall_text.js'); const { load } = require('./harness'); const fakes = require('./fakes');
function env() {
  const X = load({ sheets: true }); X.sheets.PropertiesService.getScriptProperties().setProperty('ADMIN_EMAIL', 'admin@x.com'); X.Auth._emailProvider = () => 'admin@x.com'; X.setupDatabase(); X.Auth._emailProvider = null; const fake = fakes.install(X);
  const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' }; const c1 = X.Courses.create(admin, { name: 'קורס', start_date: '2099-01-01' }).id, o = X.Courses.org(admin, c1);
  const mk = (n, pn, note) => X.Soldiers.create(admin, c1, { full_name: n, personal_number: pn, gender: 'M', department_id: o.departments[0].id, team_id: o.teams[0].id, commander_note: note });
  return { X, fake, admin, c1, mk, code: fn => { try { fn(); return null; } catch (e) { return e.code || 'JS:' + e.message; } } };
}
const T = 'MarksmanshipTests', COL = 'notes';
// column values in write order: first cell EMPTY, then risky text, mixed with REAL numbers and booleans
const MIX = ['', '00123', '=1+1', '0521234567', 42, '+972501234567', '-5', '1E3', 7.5, '007', '@SUM(1)', ' =x', 'TRUE', true, 0, '1/2', '12:30', '2026-03-02', '00', '0'];
const rowsFor = () => MIX.map((v, i) => ({ id: 'id-' + i, course_id: 'c', soldier_id: 's', test_date: '2026-03-02', weapon_type: 'M16', distance_m: 100 + i, examiner_score: i, [COL]: v }));
const sheet = (X, name) => X.SheetsStore.ss_(name === 'Soldiers' || name === T ? 'main' : 'main').getSheetByName(name);
function rawCol(X, name, col) { const sh = sheet(X, name), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], j = h.indexOf(col) + 1, n = sh.getLastRow() - 1; const r = sh.getRange(2, j, n, 1); return { v: r.getValues().map(x => x[0]), f: r.getFormulas().map(x => x[0]), fmt: Array.from({ length: n }, (_, i) => sh.getRange(2 + i, j, 1, 1).getNumberFormat()) }; }
const same = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);

t('hardening', 'replaceAll: FIRST cell empty, later cells "00123" / phone with leading zeros / "=…" text / "+…" / "-5" / "1E3" ... — every value is stored EXACTLY (no number conversion, no formula), real numbers and booleans stay real', () => {
  const E = env(); const { X } = E; X.SheetsStore.replaceAll(T, rowsFor()); const r = rawCol(X, T, COL);
  assert.strictEqual(r.v.length, MIX.length); same(r.v, MIX, 'raw cell values equal the planned values, type for type'); assert.ok(r.f.every(f => f === ''), 'no cell became a formula');
  MIX.forEach((v, i) => assert.strictEqual(typeof r.v[i], typeof v, 'type of row ' + i + ' (' + JSON.stringify(v) + ')'));
  assert.strictEqual(r.v[0], '', 'empty stays empty (not 0, not a space)'); assert.strictEqual(r.v[1], '00123'); assert.strictEqual(r.v[3], '0521234567'); assert.strictEqual(r.v[2], '=1+1');
  assert.strictEqual(r.v[4], 42); assert.strictEqual(r.v[8], 7.5); assert.strictEqual(r.v[14], 0); assert.strictEqual(r.v[13], true);
  assert.strictEqual(r.fmt[1], '@', 'text cell is in a text-formatted cell'); assert.strictEqual(r.fmt[4], 'General', 'a real number is NOT in a text-formatted cell');
  // read through the application layer too (Db.all reads the sheet back)
  const back = X.Db.all(T).sort((a, b) => a.id < b.id ? -1 : 1).map(x => x[COL]); const exp = rowsFor().sort((a, b) => a.id < b.id ? -1 : 1).map(x => x[COL]); assert.strictEqual(back.length, exp.length);
  const byId = {}; X.Db.all(T).forEach(x => { byId[x.id] = x[COL]; }); rowsFor().forEach(r0 => assert.strictEqual(byId[r0.id], r0[COL], 'Db view of ' + r0.id)); });

t('hardening', 'replaceAll column rules: only the position of the risky value differs — risky value in the 1st row, the last row, or the middle gives the same exact result; an all-numeric column is untouched (stays numbers, no text format); other columns unaffected', () => {
  const E = env(); const { X } = E;
  [['first', ['00123', '', '', 5]], ['last', ['', '', 5, '00123']], ['middle', ['', '=1+1', 5, '']], ['only-empty-then-one', ['', '', '', '0501234567']]].forEach(([nm, vals]) => {
    X.SheetsStore.replaceAll(T, vals.map((v, i) => ({ id: nm + i, course_id: 'c', soldier_id: 's', distance_m: 100 + i, [COL]: v }))); const r = rawCol(X, T, COL); same(r.v, vals, nm); assert.ok(r.f.every(f => f === ''), nm + ' no formulas');
    const d = rawCol(X, T, 'distance_m'); same(d.v, vals.map((_, i) => 100 + i), nm + ' numeric column intact'); assert.ok(d.fmt.every(f => f === 'General'), nm + ': an all-number column is never switched to text'); });
  X.SheetsStore.replaceAll(T, [1, 2, 3].map(i => ({ id: 'n' + i, course_id: 'c', soldier_id: 's', distance_m: i * 10, examiner_score: i, [COL]: '' }))); const e = rawCol(X, T, COL); same(e.v, ['', '', ''], 'all-empty column'); assert.ok(e.f.every(f => f === '')); });

t('integration', 'RESTORE: first-row-empty / "00123" / "=…" values in a text column are exactly the same AFTER the restore (checked on the sheet and through Db), also when the live data was changed after the backup', () => {
  const E = env(); const { X, admin } = E; const s1 = E.mk('אלף', '101', ''), s2 = E.mk('בית', '00123', '00123'), s3 = E.mk('גימל', '0521234567', '=HYPERLINK("x")'), s4 = E.mk('דלת', '102', '+972501234567'), s5 = E.mk('הא', '103', '1E3');
  const want = {}; X.Db.all('Soldiers').forEach(s => { want[s.id] = JSON.stringify(s); }); const wantCol = rawCol(X, 'Soldiers', 'commander_note'); const bk = X.Backup.create(admin, 'manual');
  X.Soldiers.update(admin, s2.id, { commander_note: 'שונה' }, X.Db.get('Soldiers', s2.id).updated_at, 'בדיקה'); E.mk('נוסף', '999', '000'); X.Soldiers.update(admin, s1.id, { commander_note: '=1+1' }, X.Db.get('Soldiers', s1.id).updated_at, 'בדיקה');
  const r = X.Backup.restore(admin, bk.id, { confirm: 'RESTORE', reason: 'בדיקה' }); assert.ok(r.restored_tables > 40);
  const got = {}; X.Db.all('Soldiers').forEach(s => { got[s.id] = JSON.stringify(s); }); same(got, want, 'every Soldiers row identical after restore'); const gc = rawCol(X, 'Soldiers', 'commander_note'); same(gc.v, wantCol.v, 'raw commander_note column identical'); assert.ok(gc.f.every(f => f === ''), 'no formulas after restore');
  const idx = X.Db.all('Soldiers').findIndex(s => s.id === s2.id); assert.strictEqual(X.Db.get('Soldiers', s2.id).commander_note, '00123'); assert.strictEqual(X.Db.get('Soldiers', s2.id).personal_number, '00123'); assert.strictEqual(X.Db.get('Soldiers', s3.id).personal_number, '0521234567'); assert.strictEqual(X.Db.get('Soldiers', s3.id).commander_note, '=HYPERLINK("x")'); assert.strictEqual(X.Db.get('Soldiers', s1.id).commander_note, ''); assert.ok(idx >= 0); });

t('hardening', 'FAULTS + the text fix: a failed write / failed verification (partial write, silent corruption of a risky cell) during a restore of a table with first-empty + "00123" + "=…" + real numbers still rolls back EXACTLY (the rollback itself uses the fixed replaceAll)', () => {
  const E = env(); const { X, admin } = E; X.SheetsStore.replaceAll(T, rowsFor()); const want = JSON.stringify(X.Db.all(T)), wantCol = rawCol(X, T, COL);
  const bk = X.Backup.create(admin, 'manual'); const s = E.mk('נוסף אחרי', '555', '=2+2'); X.SheetsStore.replaceAll(T, rowsFor().reverse().slice(3).concat([0, 1, 2, 3, 4].map(i => ({ id: 'extra' + i, course_id: 'c', soldier_id: 's', [COL]: '00' + i })), rowsFor().map(r => Object.assign({}, r, { id: 'again-' + r.id })))); const mid = JSON.stringify(X.Db.all(T)); const midSol = JSON.stringify(X.Db.all('Soldiers'));
  const once = (match, act) => { let n = 0; return (op, sh, i) => { if (!match(op, sh, i)) return undefined; n++; return act(n); }; };
  [['partial write', once((op, sh, i) => op === 'setValues' && sh === T && i.r === 2, k => k === 1 ? { partial: 3 } : undefined)], ['silent corruption', once((op, sh, i) => op === 'setValues' && sh === T && i.r === 2, k => k === 1 ? { corrupt: true } : undefined)],
   ['failure on the number-format step', once((op, sh) => op === 'setNumberFormat' && sh === T, k => k === 2 ? (() => { throw new Error('INJECTED fmt'); })() : undefined)], ['failure clearing the tail', once((op, sh) => op === 'clearContent' && sh === T, k => k === 1 ? (() => { throw new Error('INJECTED clear'); })() : undefined)]].forEach(([nm, hook]) => {
    X.sheets.setHook(hook); const c = E.code(() => X.Backup.restore(admin, bk.id, { confirm: 'RESTORE', reason: 'בדיקה' })); X.sheets.setHook(null); assert.strictEqual(c, 'RESTORE_FAILED', nm);
    assert.strictEqual(JSON.stringify(X.Db.all(T)), mid, nm + ': table rolled back exactly'); assert.strictEqual(JSON.stringify(X.Db.all('Soldiers')), midSol, nm + ': other tables rolled back exactly'); assert.ok(X.Db.get('Soldiers', s.id), nm + ': the soldier added after the backup is still there');
    assert.ok(rawCol(X, T, COL).f.every(f => f === ''), nm + ': no formula cells after rollback'); });
  const ok = X.Backup.restore(admin, bk.id, { confirm: 'RESTORE', reason: 'בדיקה' }); assert.ok(ok.restored_tables > 40); assert.strictEqual(JSON.stringify(X.Db.all(T)), want, 'a clean restore afterwards returns the backed-up rows exactly'); same(rawCol(X, T, COL).v, wantCol.v, 'raw column after restore'); });

t('hardening', 'replaceAll verification: a risky text cell that the sheet altered, or a real number that came back as something else, is DETECTED (UNSAFE_WRITE) — never silently accepted', () => {
  const E = env(); const { X } = E; const rows = rowsFor(); const origSet = null;
  // a faulty sheet that silently converts "00123" in the NOTES column to a number: simulated by corrupting via hook on the 2nd call (the id cell is overwritten by the fake, so use a direct wrapper)
  const sh = sheet(X, T); const R = sh.getRange(2, 1, 1, 1).constructor; const orig = R.prototype.getValues;
  R.prototype.getValues = function () { const v = orig.call(this); if (this.nr > 1) v.forEach(row => row.forEach((x, j) => { if (x === '00123') row[j] = 123; })); return v; };
  try { const c = E.code(() => X.SheetsStore.replaceAll(T, rows)); assert.ok(/UNSAFE_WRITE/.test(String(c)), 'altered text detected: ' + c); } finally { R.prototype.getValues = orig; }
  R.prototype.getValues = function () { const v = orig.call(this); if (this.nr > 1) v.forEach(row => row.forEach((x, j) => { if (x === 42) row[j] = '42'; })); return v; };
  try { const c = E.code(() => X.SheetsStore.replaceAll(T, rows)); assert.ok(/UNSAFE_WRITE/.test(String(c)), 'a real number that came back as text is detected: ' + c); } finally { R.prototype.getValues = orig; } });
done();
