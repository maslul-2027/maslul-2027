// Static-review finding F-1: top-level Apps Script functions are callable from the browser by any user of the Web App. Setup/migration functions must refuse non-admin callers.
// Node only (simulation: Session/PropertiesService are fakes). NOT a Google test. Part (c) is a STATIC source check, labelled as such.
const fs = require('fs'), path = require('path');
const { suite } = require('./tlib'); const { t, done, assert } = suite('stg_setup_guard.js'); const { load } = require('./harness');
const boot = (admin) => { const X = load({ sheets: true }); if (admin !== null) X.sheets.PropertiesService.getScriptProperties().setProperty('ADMIN_EMAIL', admin); return X; };
const refused = (f) => { try { f(); return null; } catch (e) { return e.message; } };
t('hardening', 'setup / migration functions refuse any caller who is not the bootstrap admin (commander, empty identity, other case-different user, no ADMIN_EMAIL) — and change nothing', () => {
  [['commander@x.com', 'admin@x.com'], ['', 'admin@x.com'], [null, 'admin@x.com'], ['admin@x.com', null], ['admin@x.com.evil.com', 'admin@x.com'], ['admin@x.co', 'admin@x.com'], ['ad.min@x.com', 'admin@x.com'], ['xadmin@x.com', 'admin@x.com'], ['', null]].forEach(([caller, admin]) => {
    ['setupDatabase', 'createFirstCourse', 'installDailyTrigger', 'migrateToV1'].forEach(fn => {
      const X = boot(admin); X.Auth._emailProvider = () => caller; const props0 = JSON.stringify(X.sheets.PropertiesService.getScriptProperties().getProperties ? X.sheets.PropertiesService.getScriptProperties().getProperties() : {});
      const m = refused(() => X[fn]('x', '2099-01-01')); assert.ok(m && /רק למנהל/.test(m), fn + ' as ' + JSON.stringify(caller) + ' / admin ' + admin + ' => ' + m);
      assert.strictEqual(X.Auth._emailProvider() , caller, fn + ' must not leave an identity override behind');
      assert.strictEqual(JSON.stringify(X.sheets.PropertiesService.getScriptProperties().getProperties ? X.sheets.PropertiesService.getScriptProperties().getProperties() : {}), props0, fn + ' changed script properties');
    }); });
});
t('integration', 'the admin (any letter case) can still run setupDatabase and createFirstCourse; a refused commander call created no course', () => {
  const X = boot('admin@x.com'); X.Auth._emailProvider = () => 'commander@x.com'; assert.ok(refused(() => X.setupDatabase()));
  X.Auth._emailProvider = () => 'Admin@X.com'; const r = X.setupDatabase(); assert.ok(r.tables.length > 10);
  X.Auth._emailProvider = () => 'commander@x.com'; assert.ok(refused(() => X.createFirstCourse('פריצה', '2099-01-01'))); assert.strictEqual(X.Db.all('Courses').length, 0, 'no course created by a refused caller');
  X.Auth._emailProvider = () => 'admin@x.com'; X.createFirstCourse('קורס', '2099-01-01'); assert.strictEqual(X.Db.all('Courses').length, 1);
});
t('hardening', 'STATIC source check: the set of top-level functions is exactly the reviewed list, split into browser-callable (no trailing "_") and private ("_") — a new top-level function must be reviewed and added here; no top-level function expressions / global assignments sneak in', () => {
  const dir = path.join(__dirname, '..', 'src'), found = [], sneaky = [];
  fs.readdirSync(dir).filter(f => f.endsWith('.gs')).forEach(f => { const src = fs.readFileSync(path.join(dir, f), 'utf8'); (src.match(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm) || []).forEach(m => found.push(f + ':' + m.replace(/^function\s+/, '').replace(/\s*\($/, '')));
    (src.match(/^(?:const|let|var)\s+[A-Za-z0-9_$]+\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z0-9_$]+\s*=>)/gm) || []).forEach(m => sneaky.push(f + ':' + m)); (src.match(/^(?:this|globalThis)\.[A-Za-z0-9_$]+\s*=/gm) || []).forEach(m => sneaky.push(f + ':' + m)); });
  assert.deepStrictEqual(sneaky, [], 'top-level function expressions / global assignments need review');
  const callable = found.filter(x => !/_$/.test(x)).sort(), priv = found.filter(x => /_$/.test(x)).sort();
  assert.deepStrictEqual(callable, ['Code.gs:api', 'Code.gs:doGet', 'Code.gs:formOpen', 'Code.gs:formSubmit', 'Code.gs:runDailyJobNow', 'Code.gs:whoAmI', 'Setup.gs:createFirstCourse', 'Setup.gs:installDailyTrigger', 'Setup.gs:migrateToV1', 'Setup.gs:setupDatabase'].sort(), 'browser-callable functions');
  assert.deepStrictEqual(priv, ['Code.gs:dailyJob_'], 'private (not callable via google.script.run)');
  const setup = fs.readFileSync(path.join(dir, 'Setup.gs'), 'utf8'); ['setupDatabase', 'createFirstCourse', 'installDailyTrigger', 'migrateToV1'].forEach(fn => { const i = setup.indexOf('function ' + fn + '('); assert.ok(setup.slice(i, i + 120).includes('Auth.assertAdminCaller_()'), fn + ' starts with the admin-caller guard'); });
  const code = fs.readFileSync(path.join(dir, 'Code.gs'), 'utf8'); const i = code.indexOf('function runDailyJobNow('); assert.ok(code.slice(i, i + 140).includes('Auth.assertAdminCaller_()'), 'runDailyJobNow starts with the admin-caller guard');
  const j = code.indexOf('function whoAmI('); assert.ok(!/Backup|Alerts|Db\.(insert|update|replace)/.test(code.slice(j, j + 400)), 'whoAmI only reads identity');
});
done();
