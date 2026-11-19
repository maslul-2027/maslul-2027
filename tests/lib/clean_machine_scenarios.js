// Scenario matrix for the clean-machine verifier, shared by tests/stg_clean_machine_script.js (Node port, runs on Windows/Linux/macOS) and tests/stg_clean_machine_script_sh.js (bash original, POSIX only).
// ONE copy of every scenario and assertion: both implementations are held to exactly the same expectations. The harness H adapts the platform (how a zip is built, how the script is launched, how the tools are stubbed).
// H = { mk(), mkZip(withLock) -> {zip, sha}, run(cwd, zip, sha, env, extra) -> {status, stdout, stderr}, usage(cwd) -> status, stray(cwd) -> string, runNetFail(cwd, zipName, sha) -> result }
const fs = require('fs'), path = require('path');
module.exports = function scenarios(H, t, assert, tag) {
  const status = cwd => fs.readFileSync(path.join(cwd, 'return', 'STATUS.txt'), 'utf8'), N = n => n + (tag ? ' [' + tag + ']' : '');
  t('unit', N('usage error and sha mismatch: exit codes, STATUS.txt next to the start directory'), () => {
    const cwd = H.mk(); assert.strictEqual(H.usage(cwd), 2);
    const z = H.mkZip(true); const r = H.run(cwd, z.zip, 'deadbeef'); assert.strictEqual(r.status, 1); assert.ok(/sha256 mismatch/.test(status(cwd)) && /RESULT: FAIL/.test(status(cwd)));
  });
  t('integration', N('a failure AFTER cd into the project (no lock / npm ci fails) writes return/STATUS.txt next to the start directory — relative zip path, never inside work/'), () => {
    const z = H.mkZip(false), cwd = H.mk(); fs.copyFileSync(z.zip, path.join(cwd, 'pkg.zip'));
    let r = H.run(cwd, 'pkg.zip', z.sha); assert.strictEqual(r.status, 1); assert.ok(/no package-lock\.json/.test(status(cwd))); assert.ok(/RESULT: FAIL/.test(status(cwd))); assert.strictEqual(H.stray(cwd), ''); assert.ok(!fs.existsSync(path.join(cwd, 'work', 'proj', 'return')));
    const z2 = H.mkZip(true), cwd2 = H.mk(); fs.copyFileSync(z2.zip, path.join(cwd2, 'pkg.zip')); r = H.run(cwd2, 'pkg.zip', z2.sha, { CT_STUB_FAIL: 'ci' }); assert.strictEqual(r.status, 1); assert.ok(/npm ci/.test(status(cwd2))); assert.strictEqual(H.stray(cwd2), '');
  });
  t('integration', N('injected failure at every later step (2..9) — STATUS.txt always lands in <start dir>/return, FAIL, nothing stray under work/'), () => {
    for (let n = 2; n <= 9; n++) { const z = H.mkZip(true), cwd = H.mk(); fs.copyFileSync(z.zip, path.join(cwd, 'pkg.zip')); const r = H.run(cwd, 'pkg.zip', z.sha, { CT_INJECT_FAIL: String(n) });
      assert.strictEqual(r.status, 1, 'step ' + n); assert.ok(new RegExp('injected failure at step ' + n + ' ').test(status(cwd)), 'step ' + n + ': ' + status(cwd)); assert.ok(/RESULT: FAIL/.test(status(cwd))); assert.strictEqual(H.stray(cwd), '', 'step ' + n); assert.ok(!/^RESULT: PASS/m.test(status(cwd))); }
  });
  t('integration', N('lock shipped in the package + every step OK => RESULT: PASS (exit 0); lock and its sha saved in return/'), () => {
    const z = H.mkZip(true), cwd = H.mk(); fs.copyFileSync(z.zip, path.join(cwd, 'pkg.zip')); const r = H.run(cwd, 'pkg.zip', z.sha); assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    const s = status(cwd); assert.ok(/^RESULT: PASS \(/m.test(s)); assert.ok(/SHIPPED_IN_PACKAGE/.test(s)); assert.ok(!/UNVERIFIED/.test(s));
    assert.ok(fs.existsSync(path.join(cwd, 'return', 'package-lock.json')) && fs.existsSync(path.join(cwd, 'return', 'package-lock.sha256.txt')) && fs.existsSync(path.join(cwd, 'return', 'test_strict.log')));
  });
  t('hardening', N('lock generated in the run (ALLOW_NEW_LOCK=1) => PASS_WITH_UNVERIFIED_LOCK (exit 3), never a plain PASS; the lock is kept in return/; without ALLOW_NEW_LOCK it stops'), () => {
    const z = H.mkZip(false), cwd = H.mk(); fs.copyFileSync(z.zip, path.join(cwd, 'pkg.zip')); const r = H.run(cwd, 'pkg.zip', z.sha, { ALLOW_NEW_LOCK: '1' }); assert.strictEqual(r.status, 3, r.stdout + r.stderr);
    const s = status(cwd); assert.ok(/^RESULT: PASS_WITH_UNVERIFIED_LOCK/m.test(s)); assert.ok(/LOCK: UNVERIFIED/.test(s)); assert.ok(!/^RESULT: PASS(?!_WITH)/m.test(s), 'no plain PASS line'); assert.ok(/NOT a full PASS/.test(s));
    assert.ok(/UNVERIFIED/.test(r.stdout) && !/^RESULT: PASS \(/m.test(r.stdout)); assert.ok(fs.existsSync(path.join(cwd, 'return', 'package-lock.json')) && fs.existsSync(path.join(cwd, 'return', 'package-lock.sha256.txt')));
  });
  t('hardening', N('evidence of a previous run is never overwritten: a second run refuses (exit 2) and STATUS.txt / lock are byte-identical; leftover work/ alone also refuses'), () => {
    const z = H.mkZip(true), cwd = H.mk(); fs.copyFileSync(z.zip, path.join(cwd, 'pkg.zip')); assert.strictEqual(H.run(cwd, 'pkg.zip', z.sha).status, 0);
    const before = [status(cwd), fs.readFileSync(path.join(cwd, 'return', 'package-lock.json'), 'utf8')]; const r = H.run(cwd, 'pkg.zip', z.sha); assert.strictEqual(r.status, 2); assert.ok(/already exists/.test(r.stdout));
    assert.deepStrictEqual([status(cwd), fs.readFileSync(path.join(cwd, 'return', 'package-lock.json'), 'utf8')], before);
    const cwd2 = H.mk(); fs.mkdirSync(path.join(cwd2, 'work')); fs.writeFileSync(path.join(cwd2, 'work', 'keep.txt'), 'x'); fs.copyFileSync(z.zip, path.join(cwd2, 'pkg.zip')); assert.strictEqual(H.run(cwd2, 'pkg.zip', z.sha).status, 2); assert.ok(fs.existsSync(path.join(cwd2, 'work', 'keep.txt')) && !fs.existsSync(path.join(cwd2, 'return')));
  });
  t('hardening', N('a failure caused only by the network is BLOCKED_NETWORK (exit 4), never a PASS: STATUS.txt says nothing was verified'), () => {
    const z = H.mkZip(false), cwd = H.mk(); fs.copyFileSync(z.zip, path.join(cwd, 'pkg.zip'));
    const r = H.runNetFail(cwd, 'pkg.zip', z.sha); assert.strictEqual(r.status, 4); assert.ok(/RESULT: BLOCKED_NETWORK/.test(status(cwd)) && !/RESULT: PASS/.test(status(cwd)));
  });
};
