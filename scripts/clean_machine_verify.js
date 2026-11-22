#!/usr/bin/env node
// Clean-machine verification — cross-platform Node port of scripts/clean_machine_verify.sh (same steps, same STATUS.txt texts, same exit codes). Needs NO bash / unzip / find / sha256sum: works on Windows 10.
// Usage: node scripts/clean_machine_verify.js <package.zip> <expected_sha256> [--mutations]
// Result values (return/STATUS.txt, last "RESULT:" line; exit code): PASS (0) | PASS_WITH_UNVERIFIED_LOCK (3, lock generated in this run, NOT a full PASS) | BLOCKED_NETWORK (4, nothing verified) | FAIL (1) | usage / leftover evidence = 2.
// Needs: Node v22.23.4 exactly, npm 10.x, network to registry.npmjs.org + the Playwright CDN. Outputs go to ABSOLUTE return/ and work/ next to the directory the script was started from.
// Test hooks (used only by tests/stg_clean_machine_script.js): CT_INJECT_FAIL=<step>; CT_NODE_CMD / CT_NPM_CMD / CT_NPX_CMD = JSON array [exe, ...args] replacing the tool.
// NOT YET EXECUTED on a real clean machine. The Windows-specific launch of npm (npm-cli.js beside node.exe, else npm.cmd via shell) has NOT been exercised in the build environment (Linux).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), { spawnSync } = require('child_process');
const { extractZip, walk } = require('./lib/zipnode');
const EXP_NODE = 'v22.23.4', EXP_SUITES = 78, EXP_MUT = 167;
let [ZIP, SHA, MUT] = [process.argv[2] || '', process.argv[3] || '', process.argv[4] || ''];
const ORIG = fs.realpathSync(process.cwd()), OUT = path.join(ORIG, 'return'), WORK = path.join(ORIG, 'work');
if (ZIP && !path.isAbsolute(ZIP)) ZIP = path.join(ORIG, ZIP);
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };
function tool(name) {
  const o = process.env['CT_' + name.toUpperCase() + '_CMD']; if (o) { const a = JSON.parse(o); return { file: a[0], args: a.slice(1) }; }
  if (name === 'node') return { file: process.execPath, args: [] };
  if (process.platform === 'win32') { const cli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', name + '-cli.js'); return fs.existsSync(cli) ? { file: process.execPath, args: [cli] } : { file: name + '.cmd', args: [], shell: true }; }
  return { file: name, args: [] };
}
// run a tool; output (stdout+stderr) goes to logFile (overwritten) if given. Returns the exit status (null/-1 if it could not be started).
function run(name, args, o) {
  o = o || {}; const t = tool(name); let fd = null; if (o.log) fd = fs.openSync(o.log, o.append ? 'a' : 'w');
  const r = spawnSync(t.file, t.args.concat(args), { cwd: o.cwd, env: o.env || process.env, shell: !!t.shell, encoding: 'utf8', stdio: fd !== null ? ['ignore', fd, fd] : ['ignore', 'pipe', 'pipe'] });
  if (fd !== null) fs.closeSync(fd); return { status: r.error ? -1 : r.status, out: ((r.stdout || '') + (r.stderr || '')).trim(), error: r.error };
}
function stop(step) {
  fs.mkdirSync(OUT, { recursive: true });
  const logs = ['npm_lock.log', 'npm_ci.log', 'npm_ls.log', 'playwright_install.log'].map(f => path.join(OUT, f)).filter(f => fs.existsSync(f));
  const NET = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTCACHED|getaddrinfo|npm error network|403 Forbidden|Download failed/;
  if (logs.some(f => NET.test(read(f)))) {
    fs.writeFileSync(path.join(OUT, 'STATUS.txt'), 'FAILED at step: ' + step + '\nRESULT: BLOCKED_NETWORK — the install could not reach the registry / Playwright CDN; nothing was verified\n');
    console.log("RESULT: BLOCKED_NETWORK — stopped at step: " + step + " (no network to npm/Playwright). This is NOT a pass. Return '" + OUT + "/'."); process.exit(4);
  }
  fs.writeFileSync(path.join(OUT, 'STATUS.txt'), 'FAILED at step: ' + step + '\nRESULT: FAIL\n');
  console.log('FAILED at step: ' + step); console.log("RESULT: FAIL — stopped; return the folder '" + OUT + "/' for analysis"); process.exit(1);
}
const inject = n => { if (process.env.CT_INJECT_FAIL === String(n)) stop('injected failure at step ' + n + ' (test hook)'); };
if (!ZIP || !SHA) { console.log('usage: node scripts/clean_machine_verify.js <package.zip> <expected_sha256> [--mutations]'); process.exit(2); }
if (fs.existsSync(OUT) || fs.existsSync(WORK)) { console.log("'" + OUT + "' or '" + WORK + "' already exists from a previous run — archive them first (rename return and work). Nothing deleted or overwritten."); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(WORK, { recursive: true });
const log = m => { console.log('== ' + m); fs.appendFileSync(path.join(OUT, 'steps.log'), '== ' + m + '\n'); };
log('1 sha256 of the package');
if (!fs.existsSync(ZIP) || !fs.statSync(ZIP).isFile()) stop('package file not found');
const GOT = sha256(fs.readFileSync(ZIP)); fs.writeFileSync(path.join(OUT, 'SHA256SUMS_package.txt'), GOT + '  ' + path.basename(ZIP) + '\n');
if (GOT !== SHA) stop('sha256 mismatch (got ' + GOT + ')');
log('2 tool versions');
const nv = run('node', ['-v']), nn = run('npm', ['-v']); if (nv.status !== 0 || nn.status !== 0) stop('node/npm not found');
let who = 'unknown'; try { who = os.userInfo().username; } catch (e) {}
fs.writeFileSync(path.join(OUT, 'versions.txt'), 'node ' + nv.out + '\nnpm ' + nn.out + '\n' + os.type() + ' ' + os.release() + ' ' + os.arch() + ' (' + process.platform + ')\nuser ' + who + '\n');
if (nv.out !== EXP_NODE) stop('node version is ' + nv.out + ', required ' + EXP_NODE);
if (!/^10\./.test(nn.out)) stop('npm version is ' + nn.out + ', required 10.x');
inject(2);
log('3 extract');
try { extractZip(ZIP, WORK); } catch (e) { fs.writeFileSync(path.join(OUT, 'unzip.log'), String(e.message) + '\n'); stop('unzip'); }
let PROJ = ''; const cand = [WORK].concat(fs.readdirSync(WORK, { withFileTypes: true }).filter(e => e.isDirectory() && e.name !== 'node_modules').map(e => path.join(WORK, e.name)).sort());
for (const c of cand) if (fs.existsSync(path.join(c, 'package.json'))) { PROJ = c; break; }
if (!PROJ) stop('package.json not found in the archive');
try { PROJ = fs.realpathSync(PROJ); process.chdir(PROJ); } catch (e) { stop('cd project'); }
if (fs.existsSync('node_modules')) stop('node_modules is present in the extracted package — this would not be a clean install');
inject(3);
log('4 package-lock.json');
let LOCK_STATE;
if (!fs.existsSync('package-lock.json')) {
  if (process.env.ALLOW_NEW_LOCK !== '1') stop('no package-lock.json in the package (generate it via the lock-transfer flow, or rerun with ALLOW_NEW_LOCK=1 to create one here — it will be UNVERIFIED and must be returned)');
  if (run('npm', ['install', '--package-lock-only', '--ignore-scripts'], { log: path.join(OUT, 'npm_lock.log') }).status !== 0) stop('npm install --package-lock-only');
  LOCK_STATE = 'UNVERIFIED';
} else LOCK_STATE = 'SHIPPED';
if (!fs.existsSync('package-lock.json')) stop('package-lock.json missing after step 4');
fs.copyFileSync('package-lock.json', path.join(OUT, 'package-lock.json'));
fs.writeFileSync(path.join(OUT, 'package-lock.sha256.txt'), sha256(fs.readFileSync('package-lock.json')) + '  package-lock.json\n');
inject(4);
log('5 npm ci (installs ONLY from the lock; fails if package.json and the lock disagree)');
const cleanEnv = Object.assign({}, process.env); delete cleanEnv.NODE_PATH; delete cleanEnv.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;
if (run('npm', ['ci'], { log: path.join(OUT, 'npm_ci.log'), env: cleanEnv }).status !== 0) stop('npm ci');
const npmLs = run('npm', ['ls', 'playwright', 'playwright-core', '--depth=0'], { log: path.join(OUT, 'npm_ls.log'), env: cleanEnv });
if (npmLs.status !== 0) stop('npm ls playwright/playwright-core exit code ' + npmLs.status);
if (run('npx', ['--no-install', 'playwright', '--version'], { log: path.join(OUT, 'npm_ls.log'), append: true, env: cleanEnv }).status !== 0) stop('npx playwright --version');
if (!read(path.join(OUT, 'npm_ls.log')).includes('1.63.0')) stop('installed playwright is not the pinned 1.63.0');
inject(5);
log('6 playwright chromium (downloaded into a fresh browsers folder inside the work dir — no machine-wide cache is reused)');
const pwEnv = Object.assign({}, cleanEnv, { PLAYWRIGHT_BROWSERS_PATH: path.join(WORK, 'pw-browsers') });
if (run('npx', ['playwright', 'install', 'chromium'], { log: path.join(OUT, 'playwright_install.log'), env: pwEnv }).status !== 0) stop('playwright install chromium');
inject(6);
log('7 env check');
if (run('node', ['tests/env_check.js'], { log: path.join(OUT, 'env_check.log'), env: pwEnv }).status !== 0) stop('env_check');
if (!read(path.join(OUT, 'env_check.log')).includes('ENV: OK')) stop('env_check did not report ENV: OK');
inject(7);
log('8 test:ci (= env check + run_all --ui --strict)');
const rc = run('npm', ['run', 'test:ci'], { log: path.join(OUT, 'test_strict.log'), env: pwEnv }).status;
if (rc !== 0) stop('test:ci exit code ' + rc);
const L = read(path.join(OUT, 'test_strict.log'));
const suiteMatch = /SUITES: (\d+) total — (\d+) PASS, (\d+) FAIL, (\d+) SKIP/.exec(L);
if (!suiteMatch || +suiteMatch[1] !== EXP_SUITES || +suiteMatch[2] !== EXP_SUITES || +suiteMatch[3] !== 0 || +suiteMatch[4] !== 0) stop('suite summary differs from expected all-pass state (' + EXP_SUITES + ' suites)');
const testMatch = /TESTS RUN: (\d+) — passed (\d+), failed (\d+)/.exec(L);
if (!testMatch || +testMatch[1] <= 0 || +testMatch[1] !== +testMatch[2] || +testMatch[3] !== 0) stop('test summary is missing, empty, or not all-pass');
const browserMatch = /\| browser (\d+) \| suites run: (\d+)\/(\d+)/.exec(L);
if (!browserMatch || +browserMatch[1] <= 0 || +browserMatch[2] !== EXP_SUITES || +browserMatch[3] !== EXP_SUITES) stop('browser suites did not run or suite breakdown is inconsistent');
if (!L.includes('RESULT: ALL SUITES RAN AND PASSED')) stop('missing final PASS line');
if (/^(FAIL|SKIP) /m.test(L)) stop('FAIL/SKIP line present');
inject(8);
if (MUT === '--mutations') {
  log('9 mutations (slow)');
  try { fs.copyFileSync('tests/mutation_results.json', path.join(OUT, 'mutation_results_shipped.json')); fs.renameSync('tests/mutation_results.json', 'tests/mutation_results.shipped.bak'); } catch (e) {}
  const sm = run('bash', ['scripts/smoke_mutations.sh'], { log: path.join(OUT, 'smoke_mutations.log'), env: pwEnv });
  if (sm.status === -1) stop('smoke mutations need bash, python3 and tar (not available here; use WSL/Linux for --mutations)');
  if (sm.status !== 0) stop('smoke mutations');
  if (!read(path.join(OUT, 'smoke_mutations.log')).includes('SMOKE MUTATIONS: 8 CAUGHT, 0 SURVIVED, 0 NOT_APPLIED')) stop('smoke mutation summary differs from expected (8)');
  if (run('node', ['scripts/mutation_run.js', '--ui'], { log: path.join(OUT, 'mutations.log'), env: pwEnv }).status !== 0) stop('mutation run exit code');
  if (!read(path.join(OUT, 'mutations.log')).includes('MUTATIONS: ' + EXP_MUT + ' — CAUGHT ' + EXP_MUT + ', SURVIVED 0, NOT_APPLIED 0, NOT_RUN 0')) stop('mutation summary differs from expected (' + EXP_MUT + ')');
}
inject(9);
log('10 package unchanged by the run');
process.chdir(ORIG);
try { fs.writeFileSync(path.join(OUT, 'SHA256SUMS_tree_after.txt'), walk(WORK, ['node_modules', 'pw-browsers']).map(f => sha256(fs.readFileSync(path.join(WORK, f))) + '  ./' + f).join('\n') + '\n'); } catch (e) {}
if (LOCK_STATE === 'SHIPPED') {
  const m = 'LOCK: SHIPPED_IN_PACKAGE (sha256 in package-lock.sha256.txt) — not generated by this run\nRESULT: PASS (all steps completed on THIS machine, with the package\'s own lock)\n';
  fs.writeFileSync(path.join(OUT, 'STATUS.txt'), m); process.stdout.write(m); console.log("DONE — return the folder '" + OUT + "/' (zip it)."); process.exit(0);
} else {
  const m = 'LOCK: UNVERIFIED — package-lock.json was GENERATED in this run (ALLOW_NEW_LOCK=1); it must be reviewed/compared (lock-transfer flow) before it is trusted or added to a package\nRESULT: PASS_WITH_UNVERIFIED_LOCK (all steps ran, but this is NOT a full PASS)\n';
  fs.writeFileSync(path.join(OUT, 'STATUS.txt'), m); process.stdout.write(m); console.log("DONE — return '" + OUT + "/' INCLUDING package-lock.json and package-lock.sha256.txt; a full PASS requires the reviewed lock."); process.exit(3);
}
