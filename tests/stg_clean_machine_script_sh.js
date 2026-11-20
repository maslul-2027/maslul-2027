// POSIX-ONLY suite (Linux / macOS / WSL): the SAME scenarios and assertions as tests/stg_clean_machine_script.js, run against the bash original scripts/clean_machine_verify.sh with real bash, zip and find; node/npm/npx are sh STUBS on PATH.
// Needs bash + zip + find. On Windows without them this suite prints "NOT AVAILABLE" and exits 0 WITHOUT any PASS line (it is NOT counted as passed): the Windows evidence is the Node port suite. Run: npm run test:posix.
// Extra here: the pure-Node zip reader is cross-checked against the real `zip`/`unzip` tools. Proves nothing about npm ci / Playwright / the real test run.
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');
const have = c => { const r = spawnSync(c, ['--version'], { encoding: 'utf8' }); return !r.error; };
if (process.platform === 'win32' || !['bash', 'zip', 'unzip', 'find'].every(have)) { console.log('NOT AVAILABLE: stg_clean_machine_script_sh needs bash, zip, unzip and find on this platform (' + process.platform + '). Nothing ran; this is NOT a pass. The Node port suite (stg_clean_machine_script) covers every scenario without them.'); process.exit(0); }
const { suite } = require('./tlib'); const { t, done, assert } = suite('stg_clean_machine_script_sh.js'); const scenarios = require('./lib/clean_machine_scenarios'); const { extractZip, walk } = require('../scripts/lib/zipnode');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'clean_machine_verify.sh'), src = fs.readFileSync(SCRIPT, 'utf8');
const EXP = { S: src.match(/EXP_SUITES=(\d+)/)[1] };
const sh = (cmd, cwd, env) => spawnSync('bash', ['-c', cmd], { cwd, env: Object.assign({}, process.env, env || {}), encoding: 'utf8' });
const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ct-cm-'));
const stubs = (() => { const d = mk(); const w = (n, body) => { fs.writeFileSync(path.join(d, n), '#!/bin/sh\n' + body + '\n'); fs.chmodSync(path.join(d, n), 0o755); };
  w('node', `if [ "$1" = "-v" ]; then echo v22.23.4; else exec ${process.execPath} "$@"; fi`);
  w('npm', `case "$1" in -v) echo 10.9.2;; install) echo '{"lockfileVersion":3}' > package-lock.json;; ls) echo ok; exit 0;; ci) [ "$CT_STUB_FAIL" = ci ] && { echo boom; exit 1; }; exit 0;; run) echo "SUITES: ${EXP.S} total — ${EXP.S} PASS, 0 FAIL, 0 SKIP"; echo "TESTS RUN: 17 — passed 17, failed 0"; echo "BREAKDOWN (passed tests): Node 12 (unit 4, integration 4, hardening 4) | browser 5 | suites run: ${EXP.S}/${EXP.S}"; echo "RESULT: ALL SUITES RAN AND PASSED";; esac`);
  w('npx', 'echo "Version 1.63.0"; exit 0'); return d; })();
const PATHV = stubs + ':' + process.env.PATH;
const H = { mk,
  mkZip: (withLock) => { const d = mk(), p = path.join(d, 'proj'); fs.mkdirSync(path.join(p, 'tests'), { recursive: true }); fs.writeFileSync(path.join(p, 'package.json'), '{"name":"x","version":"1.0.0"}'); fs.writeFileSync(path.join(p, 'tests', 'env_check.js'), 'console.log("ENV: OK")');
    if (withLock) fs.writeFileSync(path.join(p, 'package-lock.json'), '{"lockfileVersion":3,"shipped":true}'); const zip = path.join(d, 'pkg.zip'); assert.strictEqual(sh('zip -qr pkg.zip proj', d).status, 0); return { zip, sha: crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex') }; },
  run: (cwd, zip, sha, env, extra) => sh('bash ' + JSON.stringify(SCRIPT) + ' ' + zip + ' ' + sha + ' ' + (extra || ''), cwd, Object.assign({ PATH: PATHV }, env || {})),
  usage: cwd => sh('bash ' + SCRIPT, cwd, { PATH: PATHV }).status,
  stray: cwd => sh('find ' + JSON.stringify(cwd) + ' -path "*/work/*" -name STATUS.txt', cwd).stdout.trim(),
  runNetFail: (cwd, zipName, sha) => { const d = mk(); const w = (n, body) => { fs.writeFileSync(path.join(d, n), '#!/bin/sh\n' + body + '\n'); fs.chmodSync(path.join(d, n), 0o755); };
    w('node', `if [ "$1" = "-v" ]; then echo v22.23.4; else exec ${process.execPath} "$@"; fi`); w('npm', 'case "$1" in -v) echo 10.9.2;; install) echo "npm error code ENOTFOUND" >&2; echo "npm error network request failed" >&2; exit 1;; esac'); w('npx', 'exit 0');
    return sh('bash ' + JSON.stringify(SCRIPT) + ' ' + zipName + ' ' + sha, cwd, { PATH: d + ':' + process.env.PATH, ALLOW_NEW_LOCK: '1' }); },
};
scenarios(H, t, assert, 'sh');
t('integration', 'pure-Node zip reader == real unzip: an archive made by the real `zip` tool (nested dirs, UTF-8 names, large and empty files) extracts byte-identically with both', () => {
  const d = mk(), p = path.join(d, 'proj'); fs.mkdirSync(path.join(p, 'a', 'b'), { recursive: true }); fs.writeFileSync(path.join(p, 'a', 'b', 'שלום.txt'), 'héllo'); fs.writeFileSync(path.join(p, 'a', 'big.bin'), Buffer.alloc(400000, 'xyz')); fs.writeFileSync(path.join(p, 'empty'), ''); fs.writeFileSync(path.join(p, 'r.txt'), 'r'.repeat(10000));
  assert.strictEqual(sh('zip -qr z.zip proj', d).status, 0); extractZip(path.join(d, 'z.zip'), path.join(d, 'node')); assert.strictEqual(sh('unzip -q z.zip -d real', d).status, 0);
  const a = walk(path.join(d, 'node')), b = walk(path.join(d, 'real')); assert.deepStrictEqual(a, b); assert.ok(a.length === 4); a.forEach(f => assert.ok(fs.readFileSync(path.join(d, 'node', f)).equals(fs.readFileSync(path.join(d, 'real', f))), f));
});
t('integration', 'pure-Node zip reader == real unzip on the REAL project tree (src/, tests/, scripts/, docs/): same file list and same bytes', () => {
  const root = path.join(__dirname, '..'), d = mk(); assert.strictEqual(sh('zip -qr z.zip src tests scripts docs package.json -x "*/node_modules/*" -x "docs/qa_dev61/screens/*"', root.replace(/\\/g, '/') ? root : root).status, 0, 'zip');
  fs.renameSync(path.join(root, 'z.zip'), path.join(d, 'z.zip')); extractZip(path.join(d, 'z.zip'), path.join(d, 'node')); assert.strictEqual(sh('unzip -q z.zip -d real', d).status, 0);
  const a = walk(path.join(d, 'node')), b = walk(path.join(d, 'real')); assert.deepStrictEqual(a, b); assert.ok(a.length > 150, 'files: ' + a.length); const bad = a.filter(f => !fs.readFileSync(path.join(d, 'node', f)).equals(fs.readFileSync(path.join(d, 'real', f)))); assert.deepStrictEqual(bad, []);
});
done();
