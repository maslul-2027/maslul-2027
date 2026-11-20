// Static-review finding F-2: dailyJob must not be callable from the browser. Node only (simulation). NOT a Google test.
// The "browser" below applies the DOCUMENTED rule (HTML Service > Private functions: names ending in "_" cannot be called by google.script.run);
// that rule itself, and the use of such a function as a trigger handler, are verified only on real Google (AT-SEC-02 / AT-D07).
const fs = require('fs'), path = require('path');
const { suite } = require('./tlib'); const { t, done, assert } = suite('stg_f2_dailyjob.js'); const { load } = require('./harness'); const fakes = require('./fakes');
const mkEnv = (admin) => { const props = { ADMIN_EMAIL: admin }, trig = [];
  const PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) };
  const ScriptApp = { _t: trig, getProjectTriggers: () => trig.slice(), deleteTrigger: x => { trig.splice(trig.indexOf(x), 1); },
    newTrigger: h => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create: () => { const o = { getHandlerFunction: () => h, _kind: 'time' }; trig.push(o); return o; } }) }) }) }) };
  return { PropertiesService, ScriptApp }; };
const boot = (admin) => { const env = mkEnv(admin === undefined ? 'admin@x.com' : admin), X = load({ env }); fakes.install(X); X._env = env; return X; };
// documented google.script.run rule: only top-level functions whose name does NOT end with "_" can be called
const browser = (X, name, ...args) => { if (typeof X[name] !== 'function') throw new Error('google.script.run: ' + name + ' is not a function'); if (/_$/.test(name)) throw new Error('google.script.run: ' + name + ' is private'); return X[name](...args); };
const refused = (f) => { try { f(); return null; } catch (e) { return e.message; } };
const adminCtx = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
const withData = (X) => { X.Courses.addUser(adminCtx, { email: 'admin@x.com', role: 'admin', display_name: 'א' }); const c1 = X.Courses.create(adminCtx, { name: 'פעיל', start_date: '2099-01-01' }).id, c2 = X.Courses.create(adminCtx, { name: 'ארכיון', start_date: '2099-01-01' }).id; X.Db.update('Courses', c2, { status: X.COURSE_STATUS.ARCHIVED }); return { c1, c2 }; };
const spy = (X) => { const n = { create: 0, refresh: 0, prune: 0, courses: [] }; const o = { c: X.Backup.create, r: X.Alerts.refresh, p: X.Backup.prune };
  X.Backup.create = function () { n.create++; return o.c.apply(this, arguments); }; X.Alerts.refresh = function (s, id) { n.refresh++; n.courses.push(id); return o.r.apply(this, arguments); }; X.Backup.prune = function () { n.prune++; return o.p.apply(this, arguments); }; return n; };
t('hardening', 'F-2: google.script.run cannot reach the daily job (old public name is gone, new name is private) and a rejected call causes NO backup, NO alert refresh, NO pruning, NO new rows', () => {
  const X = boot(); withData(X); const n = spy(X), jobs0 = X.Db.all('BackupJobs').length, audit0 = X.Db.all('AuditLog').length;
  assert.strictEqual(typeof X.dailyJob, 'undefined', 'no public dailyJob any more');
  ['dailyJob', 'dailyJob_'].forEach(nm => [[], [{ triggerUid: '1' }], ['x', 1]].forEach(a => assert.ok(refused(() => browser(X, nm, ...a)), nm + ' must be rejected')));
  assert.deepStrictEqual([n.create, n.refresh, n.prune], [0, 0, 0]); assert.strictEqual(X.Db.all('BackupJobs').length, jobs0); assert.strictEqual(X.Db.all('AuditLog').length, audit0);
});
t('integration', 'F-2: installDailyTrigger installs ONE trigger whose handler is the private dailyJob_, replaces a legacy "dailyJob" trigger, and is idempotent', () => {
  const X = boot(); X.Auth._emailProvider = () => 'admin@x.com'; const T = X._env.ScriptApp;
  T._t.push({ getHandlerFunction: () => 'dailyJob', _kind: 'legacy' });                                 // left over from <= r3-stg1
  X.installDailyTrigger(); X.installDailyTrigger();
  assert.deepStrictEqual(T.getProjectTriggers().map(x => x.getHandlerFunction()), ['dailyJob_']);
  T._t.push({ getHandlerFunction: () => 'someOtherHandler' }); X.installDailyTrigger(); assert.deepStrictEqual(T.getProjectTriggers().map(x => x.getHandlerFunction()).sort(), ['dailyJob_', 'someOtherHandler'], 'unrelated triggers untouched');
  assert.ok(/_$/.test(X.Backup.DAILY_HANDLER), 'handler name is private');
});
t('integration', 'F-2: the scheduled trigger still works — firing the installed handler by name (no event object) backs up, refreshes alerts of NON-archived courses only, prunes, runs preflight', () => {
  const X = boot(); X.Auth._emailProvider = () => 'admin@x.com'; const { c1, c2 } = withData(X); X.installDailyTrigger(); const n = spy(X);
  const h = X._env.ScriptApp.getProjectTriggers()[0].getHandlerFunction(); const r = X[h]();                // what the Apps Script trigger runner does (simulation)
  assert.strictEqual(n.create, 1); assert.deepStrictEqual(n.courses, [c1]); assert.ok(!n.courses.includes(c2)); assert.strictEqual(n.prune, 1); assert.ok(r.backup && r.backup.id); assert.ok(['PASS', 'FAIL', 'INCOMPLETE', 'ERROR'].includes(r.preflight));
  assert.strictEqual(X.Db.where('BackupJobs', j => j.kind === 'daily' && j.status === 'ok').length, 1);
});
t('integration', 'F-2: daily idempotency intact — a second run the same day creates no second daily backup; arguments (even a forged event object) change nothing', () => {
  const X = boot(); withData(X); const a = X.dailyJob_(), b = X.dailyJob_({ triggerUid: 'forged', triggerSource: 'CLOCK' }, 'junk');
  assert.ok(a.backup && a.backup.id); assert.strictEqual(b.backup, null, 'no second backup'); assert.strictEqual(X.Db.where('BackupJobs', j => j.kind === 'daily' && j.status === 'ok').length, 1);
});
t('hardening', 'F-2: runDailyJobNow (manual run) is admin-only and fails closed — other / empty / look-alike / missing ADMIN_EMAIL identities are refused with no side effects; the admin can run it', () => {
  [['commander@x.com', 'admin@x.com'], ['', 'admin@x.com'], [null, 'admin@x.com'], ['admin@x.com', null], ['admin@x.com.evil.com', 'admin@x.com'], ['admin@x.co', 'admin@x.com'], ['ad.min@x.com', 'admin@x.com'], ['xadmin@x.com', 'admin@x.com']].forEach(([caller, admin]) => {
    const X = boot(admin); withData(X); X.Auth._emailProvider = () => caller; const n = spy(X), jobs0 = X.Db.all('BackupJobs').length;
    const m = refused(() => X.runDailyJobNow()); assert.ok(m && /רק למנהל/.test(m), JSON.stringify([caller, admin]) + ' => ' + m);
    assert.deepStrictEqual([n.create, n.refresh, n.prune], [0, 0, 0]); assert.strictEqual(X.Db.all('BackupJobs').length, jobs0); assert.strictEqual(X.Auth._emailProvider(), caller, 'no identity override left behind'); });
  const X = boot(); withData(X); X.Auth._emailProvider = () => 'Admin@X.com'; const r = X.runDailyJobNow(); assert.ok(r.backup && r.backup.id);
});
t('hardening', 'F-2: Preflight reports the trigger by its real name — dailyJob_ PASS; only the legacy public "dailyJob" => FAIL with a reinstall hint; none => FAIL; unreadable => NOT_VERIFIED', () => {
  const X = boot(); const admin = adminCtx, d = X.Adapters._fake.drive, st = (r) => r.checks.find(c => c.id === 'trigger.daily');
  X.Courses.addUser(admin, { email: 'admin@x.com', role: 'admin', display_name: 'א' });
  d.triggers = ['dailyJob_']; assert.strictEqual(st(X.Preflight.run(admin)).status, 'PASS');
  d.triggers = ['dailyJob']; let c = st(X.Preflight.run(admin)); assert.strictEqual(c.status, 'FAIL'); assert.ok(/installDailyTrigger/.test(c.detail || c.message || JSON.stringify(c)));
  d.triggers = []; assert.strictEqual(st(X.Preflight.run(admin)).status, 'FAIL'); d.triggers = null; assert.strictEqual(st(X.Preflight.run(admin)).status, 'NOT_VERIFIED');
});
t('hardening', 'STATIC: the client pages call only the reviewed server entry points (api, formOpen, formSubmit, whoAmI) and never the daily job', () => {
  const dir = path.join(__dirname, '..', 'src'); const idx = fs.readFileSync(path.join(dir, 'Index.html'), 'utf8'), frm = fs.readFileSync(path.join(dir, 'FormPage.html'), 'utf8');
  [idx, frm].forEach(s => assert.ok(!/dailyJob/.test(s), 'client must not reference the daily job'));
  assert.ok(/google\.script\.run[^;]{0,160}\.api\(/.test(idx), 'Index calls api');
  ['dailyJob_', 'runDailyJobNow', 'setupDatabase', 'createFirstCourse', 'installDailyTrigger', 'migrateToV1', 'doGet'].forEach(n => [idx, frm].forEach(h => assert.ok(!h.includes(n), 'client references ' + n)));
  const used = (frm.match(/run\('(\w+)'/g) || []).map(m => m.slice(5, -1)); assert.deepStrictEqual(Array.from(new Set(used)).sort(), ['formOpen', 'formSubmit']);
});
done();
