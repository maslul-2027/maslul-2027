// Tests of the clean-machine verifier LOGIC (paths, STATUS location, no overwrite, lock status, exit codes, BLOCKED_NETWORK) for scripts/clean_machine_verify.js — the cross-platform Node port. Runs on Windows 10 / Linux / macOS with NO bash, zip, unzip or find:
// the fixture zip is built and extracted by scripts/lib/zipnode.js (pure Node) and node/npm/npx are STUB programs (Node scripts passed through CT_NODE_CMD/CT_NPM_CMD/CT_NPX_CMD). The scenarios/assertions live in tests/lib/clean_machine_scenarios.js and are shared with the bash original (tests/stg_clean_machine_script_sh.js, POSIX only).
// This proves nothing about npm ci / Playwright / the real test run — that still needs a real clean machine (docs/INSTALL_CLEAN_MACHINE.md).
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');
const { suite } = require('./tlib'); const { t, done, assert } = suite('stg_clean_machine_script.js');
const { buildZip, walk, extractZip, listZip } = require('../scripts/lib/zipnode'); const scenarios = require('./lib/clean_machine_scenarios');
const JS = path.join(__dirname, '..', 'scripts', 'clean_machine_verify.js'), SH = path.join(__dirname, '..', 'scripts', 'clean_machine_verify.sh'), src = fs.readFileSync(JS, 'utf8'), srcSh = fs.readFileSync(SH, 'utf8');
const EXP = { S: src.match(/EXP_SUITES = (\d+)/)[1] };
const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ct-cm-'));
const stubDir = mk(), q = JSON.stringify;
const wr = (n, body) => { const f = path.join(stubDir, n); fs.writeFileSync(f, body); return f; };
const nodeStub = wr('node_stub.js', `const a=process.argv.slice(2); if(a[0]==='-v'){console.log('v22.23.4');} else { const r=require('child_process').spawnSync(${q(process.execPath)},a,{stdio:'inherit'}); process.exit(r.status===null?1:r.status); }`);
const npmStub = wr('npm_stub.js', `const a=process.argv.slice(2),fs=require('fs'); const c=a[0];
if(c==='-v')console.log('10.9.2'); else if(c==='install'){fs.writeFileSync('package-lock.json','{"lockfileVersion":3}\\n');} else if(c==='ls')console.log('ok'); else if(c==='ci'){ if(process.env.CT_STUB_FAIL==='ci'){console.log('boom');process.exit(1);} }
else if(c==='run'){console.log('SUITES: ${EXP.S} total — ${EXP.S} PASS, 0 FAIL, 0 SKIP');console.log('TESTS RUN: 17 — passed 17, failed 0');console.log('BREAKDOWN (passed tests): Node 12 (unit 4, integration 4, hardening 4) | browser 5 | suites run: ${EXP.S}/${EXP.S}');console.log('RESULT: ALL SUITES RAN AND PASSED');}`);
const npmNet = wr('npm_net_stub.js', `const a=process.argv.slice(2); if(a[0]==='-v')console.log('10.9.2'); else if(a[0]==='install'){console.error('npm error code ENOTFOUND');console.error('npm error network request failed');process.exit(1);}`);
const npxStub = wr('npx_stub.js', `console.log('Version 1.63.0');`);
const toolEnv = (npm) => ({ CT_NODE_CMD: q([process.execPath, nodeStub]), CT_NPM_CMD: q([process.execPath, npm || npmStub]), CT_NPX_CMD: q([process.execPath, npxStub]) });
const H = {
  mk,
  mkZip: (withLock) => { const d = mk(), files = [{ name: 'proj/package.json', data: '{"name":"x","version":"1.0.0"}' }, { name: 'proj/tests/env_check.js', data: 'console.log("ENV: OK")' }]; if (withLock) files.push({ name: 'proj/package-lock.json', data: '{"lockfileVersion":3,"shipped":true}' });
    const zip = path.join(d, 'pkg.zip'); fs.writeFileSync(zip, buildZip(files)); return { zip, sha: crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex') }; },
  run: (cwd, zip, sha, env, extra) => { const r = spawnSync(process.execPath, [JS, zip, sha].concat(extra ? [extra] : []), { cwd, env: Object.assign({}, process.env, toolEnv(), env || {}), encoding: 'utf8' }); return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' }; },
  usage: cwd => spawnSync(process.execPath, [JS], { cwd, env: Object.assign({}, process.env, toolEnv()), encoding: 'utf8' }).status,
  stray: cwd => walk(cwd).filter(f => /(^|\/)STATUS\.txt$/.test(f) && ('/' + f).includes('/work/')).join('\n'),
  runNetFail: (cwd, zipName, sha) => { const r = spawnSync(process.execPath, [JS, zipName, sha], { cwd, env: Object.assign({}, process.env, toolEnv(npmNet), { ALLOW_NEW_LOCK: '1' }), encoding: 'utf8' }); return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' }; },
};
scenarios(H, t, assert, 'node');
t('unit', 'Node and POSIX gates use the same suite count and validate live test totals instead of stale historical test/browser counts', () => {
  const suiteCount = s => (new RegExp('EXP_SUITES\\s*=\\s*(\\d+)').exec(s) || [])[1];
  assert.strictEqual(suiteCount(src), suiteCount(srcSh)); assert.ok(suiteCount(src));
  assert.ok(!/EXP_TESTS|EXP_BROWSER/.test(src)); assert.ok(!/EXP_TESTS|EXP_BROWSER/.test(srcSh));
  assert.ok(/TESTS RUN: \(\\d\+\)/.test(src)); assert.ok(/browser \(\\d\+\)/.test(src));
  const ra = fs.readFileSync(path.join(__dirname, 'run_all.js'), 'utf8'), names = [...ra.matchAll(/^const (NODE|UI) = \[([^\]]*)\]/gm)].flatMap(m => m[2].match(/'[^']+'/g).map(x => x.slice(1, -1)));
  const present = names.filter(n => fs.existsSync(path.join(__dirname, n + '.js'))); assert.strictEqual(present.length, +suiteCount(src), 'run_all runs ' + present.length + ' suites, the script expects ' + suiteCount(src));
});
t('unit', 'zipnode: round trip of nested/UTF-8/large files, stored and deflate; list matches; walk is sorted', () => {
  const big = Buffer.alloc(300000, 'abc'), files = [{ name: 'a/b/c.txt', data: 'שלום' }, { name: 'a/big.bin', data: big }, { name: 'empty.txt', data: '' }];
  for (const m of ['deflate', 'store']) { const d = mk(); fs.writeFileSync(path.join(d, 'z.zip'), buildZip(files, m)); extractZip(path.join(d, 'z.zip'), path.join(d, 'o'));
    assert.strictEqual(fs.readFileSync(path.join(d, 'o', 'a', 'b', 'c.txt'), 'utf8'), 'שלום'); assert.ok(fs.readFileSync(path.join(d, 'o', 'a', 'big.bin')).equals(big)); assert.strictEqual(fs.readFileSync(path.join(d, 'o', 'empty.txt'), 'utf8'), '');
    assert.deepStrictEqual(walk(path.join(d, 'o')), ['a/b/c.txt', 'a/big.bin', 'empty.txt']); assert.deepStrictEqual(listZip(path.join(d, 'z.zip')).map(e => e.name), files.map(f => f.name)); }
});
t('hardening', 'zipnode refuses: path traversal (../), absolute and drive paths, backslash names, corrupted data (CRC), a truncated/non-zip file, a symlink entry — and writes nothing outside the target', () => {
  const d = mk(), bad = n => { const z = path.join(d, 'z.zip'); return z; };
  for (const name of ['../evil.txt', 'a/../../evil.txt', '/abs.txt', 'C:/abs.txt', 'a\\b.txt']) { const z = path.join(d, 'z.zip'); fs.writeFileSync(z, buildZip([{ name, data: 'x' }])); assert.throws(() => extractZip(z, path.join(d, 'o')), /unsafe|absolute|escapes/, name); }
  assert.ok(!fs.existsSync(path.join(d, 'evil.txt')) && !fs.existsSync(path.join(os.tmpdir(), 'evil.txt')));
  const good = buildZip([{ name: 'p/x.txt', data: 'hello hello hello hello' }], 'store'), crcBad = Buffer.from(good); crcBad[crcBad.indexOf('hello')] = 0x48; fs.writeFileSync(path.join(d, 'c.zip'), crcBad); assert.throws(() => extractZip(path.join(d, 'c.zip'), path.join(d, 'o2')), /CRC mismatch/);
  fs.writeFileSync(path.join(d, 't.zip'), good.subarray(0, good.length - 10)); assert.throws(() => extractZip(path.join(d, 't.zip'), path.join(d, 'o3')), /not a zip|bad central/); fs.writeFileSync(path.join(d, 'n.zip'), 'not a zip'); assert.throws(() => extractZip(path.join(d, 'n.zip'), path.join(d, 'o4')), /not a zip/);
  const sym = Buffer.from(buildZip([{ name: 'l', data: 'target' }], 'store')); const cd = sym.indexOf(Buffer.from([0x50, 0x4b, 1, 2])); sym.writeUInt32LE((0o120777 << 16) >>> 0, cd + 38); fs.writeFileSync(path.join(d, 's.zip'), sym); assert.throws(() => extractZip(path.join(d, 's.zip'), path.join(d, 'o5')), /symlink/);
});
t('hardening', 'zipnode rejects Windows aliases, duplicate/case-folded names and file-directory conflicts before output creation', () => {
  const d=mk(), cases=[['CON'],['con.txt'],['AUX.log'],['name.'],['name '],['file.txt:stream'],['bad?.txt'],['same','same'],['Report.txt','report.txt'],['a','a/b.txt'],['a/b.txt','a'],['a//b.txt','a/b.txt'],['a///b.txt']];
  for(let i=0;i<cases.length;i++){const z=path.join(d,'bad'+i+'.zip'),out=path.join(d,'out'+i);fs.writeFileSync(z,buildZip(cases[i].map(name=>({name,data:'x'}))));assert.throws(()=>extractZip(z,out),/unsafe|Windows-invalid|reserved|duplicate|collision|conflict/);assert.ok(!fs.existsSync(out));}
  const unicodeZip=path.join(d,'unicode-collision.zip'), unicodeOut=path.join(d,'unicode-out'); fs.writeFileSync(unicodeZip,buildZip([{name:'caf\u00e9.txt',data:'1'},{name:'cafe\u0301.txt',data:'2'}])); assert.throws(()=>extractZip(unicodeZip,unicodeOut),/duplicate|collision/); assert.ok(!fs.existsSync(unicodeOut));
  const z=path.join(d,'large.zip'),out=path.join(d,'large-out');fs.writeFileSync(z,buildZip([{name:'large.bin',data:Buffer.alloc(32)}]));assert.throws(()=>extractZip(z,out,{maxEntries:10,maxEntryBytes:16,maxTotalBytes:64}),/size limit/);assert.ok(!fs.existsSync(out));
});
t('hardening', 'zipnode enforces the decompression ceiling inside zlib even when the central-directory uncompressed size is forged low', () => {
  const d = mk(), z = path.join(d, 'bomb.zip'), out = path.join(d, 'bomb-out');
  const raw = Buffer.alloc(1024 * 1024, 0x41), archive = Buffer.from(buildZip([{ name: 'bomb.bin', data: raw }], 'deflate'));
  const cd = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(cd >= 0); archive.writeUInt32LE(1, cd + 24); // lie: central directory claims only one uncompressed byte
  fs.writeFileSync(z, archive);
  assert.throws(() => extractZip(z, out, { maxEntries: 10, maxEntryBytes: 64, maxTotalBytes: 128 }), /size limit|larger than/);
  assert.ok(!fs.existsSync(out), 'rejected archive must not create an extraction directory');
});
t('hardening', 'a package that already contains node_modules is refused (not a clean install), and a corrupt zip is FAIL at step unzip — never PASS', () => {
  const cwd = H.mk(), files = [{ name: 'proj/package.json', data: '{}' }, { name: 'proj/package-lock.json', data: '{}' }, { name: 'proj/node_modules/x/index.js', data: '1' }], zip = path.join(cwd, 'pkg.zip'); fs.writeFileSync(zip, buildZip(files)); const sha = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
  let r = H.run(cwd, 'pkg.zip', sha); assert.strictEqual(r.status, 1); assert.ok(/node_modules is present/.test(fs.readFileSync(path.join(cwd, 'return', 'STATUS.txt'), 'utf8')));
  const cwd2 = H.mk(), z2 = path.join(cwd2, 'pkg.zip'); fs.writeFileSync(z2, 'definitely not a zip'); r = H.run(cwd2, 'pkg.zip', crypto.createHash('sha256').update(fs.readFileSync(z2)).digest('hex')); assert.strictEqual(r.status, 1); assert.ok(/FAILED at step: unzip/.test(fs.readFileSync(path.join(cwd2, 'return', 'STATUS.txt'), 'utf8')));
});
t('hardening', 'a wrong tool version stops the run: node != v22.23.4 or npm not 10.x => FAIL (never PASS)', () => {
  for (const [env, re] of [[{ CT_NODE_CMD: q([process.execPath, wr('node_old.js', "console.log('v20.1.0')")]) }, /node version is v20\.1\.0/], [{ CT_NPM_CMD: q([process.execPath, wr('npm_old.js', "console.log('9.9.9')")]) }, /npm version is 9\.9\.9/]]) {
    const z = H.mkZip(true), cwd = H.mk(); fs.copyFileSync(z.zip, path.join(cwd, 'pkg.zip')); const r = H.run(cwd, 'pkg.zip', z.sha, env); assert.strictEqual(r.status, 1); const s = fs.readFileSync(path.join(cwd, 'return', 'STATUS.txt'), 'utf8'); assert.ok(re.test(s) && /RESULT: FAIL/.test(s)); }
});
t('hardening', 'a nonzero npm ls exit cannot be hidden by a successful npx version check', () => {
  const npmLsFail = wr('npm_ls_fail_stub.js', `const a=process.argv.slice(2); if(a[0]==='-v')console.log('10.9.2'); else if(a[0]==='ci'){} else if(a[0]==='ls'){console.error('npm error ELSPROBLEMS');process.exit(1);}`);
  const z = H.mkZip(true), cwd = H.mk(); fs.copyFileSync(z.zip, path.join(cwd, 'pkg.zip'));
  const r = H.run(cwd, 'pkg.zip', z.sha, { CT_NPM_CMD: q([process.execPath, npmLsFail]) });
  assert.strictEqual(r.status, 1);
  const status = fs.readFileSync(path.join(cwd, 'return', 'STATUS.txt'), 'utf8');
  assert.ok(/npm ls playwright\/playwright-core exit code 1/.test(status));
  assert.ok(/RESULT: FAIL/.test(status));
});
done();
