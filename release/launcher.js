#!/usr/bin/env node
'use strict';
// MASLUL 2027 — one-action TEST launcher (Windows / macOS / Linux). SYNTHETIC DATA ONLY, LOOPBACK ONLY (https://localhost), single user, single machine.
// This is NOT the two-phone / multi-user path: other devices cannot reach it (it binds 127.0.0.1 and refuses anything else). Nothing is installed, no firewall/hosts/registry/certificate-store change, no elevation, no network call.
//   node release/launcher.js [--data DIR] [--port N] [--no-browser] [--check] [--smoke] [--backup] [--restore FILE]
const fs = require('fs'), path = require('path'), net = require('net'), crypto = require('crypto'), cp = require('child_process');
const root = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = n => process.argv.includes('--' + n);
const dataDir = path.resolve(arg('data', path.join(root, '..', 'data')));
const say = m => console.log(m), problems = [];
const REQUIRED = ['backend_next/test_server.js', 'backend_next/gateway.js', 'backend_next/engine_host.js', 'backend_next/store.js', 'backend_next/pin_auth.js', 'backend_next/route_table.js', 'server_public/index.html', 'src/Code.gs', 'scripts/lib/synthetic_seed.js'];

/** Preflight: read-only checks that explain what is missing instead of failing later. Returns the problem list. */
function preflight(port) {
  const out = [];
  const major = Number(process.versions.node.split('.')[0]);
  if (major !== 22) out.push('Node.js 22 (LTS) is required; this machine has ' + process.version + '. Install "Node.js 22 LTS" (Windows Installer .msi, per-user is fine) from nodejs.org, then run this again.');
  for (const f of REQUIRED) if (!fs.existsSync(path.join(root, f))) out.push('Package is incomplete or was not fully extracted (missing ' + f + '). Extract the whole ZIP (right-click → Extract All) and do not run it from inside the ZIP.');
  try { fs.mkdirSync(dataDir, { recursive: true }); const t = path.join(dataDir, '.w' + process.pid); fs.writeFileSync(t, 'x'); fs.unlinkSync(t); } catch (e) { out.push('Cannot write to the data folder ' + dataDir + ' (' + e.code + '). Move the package to a normal folder such as Documents (not Program Files / a read-only drive / a synced OneDrive "Files On-Demand" folder).'); }
  return out;
}
const freePort = p => new Promise(r => { const s = net.createServer(); s.once('error', () => r(false)); s.listen(p, '127.0.0.1', () => s.close(() => r(true))); });
async function pickPort(start, tries) { for (let i = 0; i < tries; i++) if (await freePort(start + i)) return start + i; return 0; }
const randomPin = () => { const { weakPin } = require(path.join(root, 'backend_next', 'pin_auth.js')); for (;;) { const p = Array.from(crypto.randomBytes(4), b => b % 10).join(''); if (new Set(p).size === 4 && !weakPin(p)) return p; } };   // the app's PIN is 4 digits by design (loopback synthetic test; real phone-OTP is an open gate)
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const lockFile = () => path.join(dataDir, 'server.lock');
function readSecrets() { return JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf8')); }
function openStore() { const store = require(path.join(root, 'backend_next', 'store.js')); return store.open({ file: path.join(dataDir, 'state.bin'), key: Buffer.from(readSecrets().storeKey, 'hex') }); }

function openFull() {
  const store = openStore(), key = Buffer.from(readSecrets().storeKey, 'hex'), files = require(path.join(root, 'backend_next', 'file_store.js')).open({ dir: path.join(dataDir, 'files'), key });
  return { store, files, full: require(path.join(root, 'backend_next', 'full_backup.js')).open({ dataDir, store, files }) };
}
/** FULL backup: encrypted state AND every stored report file in one integrity-protected container (see backend_next/full_backup.js). Same-installation scope: it carries no key. */
async function backup() {
  if (!fs.existsSync(path.join(dataDir, 'state.bin'))) { say('Nothing to back up yet: start the app once first.'); return 3; }
  const { full } = openFull(), dir = path.join(dataDir, 'backups'); fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'full-backup-' + new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '') + '.mbk');
  let r; try { r = full.create(dest); } catch (e) { say('Backup FAILED (' + e.message + '). Nothing was written.'); return 5; }
  say('Full encrypted backup written: ' + dest + '\nContains: the app state + ' + r.files + ' stored file(s) (' + r.bytes + ' bytes)' + (r.skipped_corrupt ? '\nWARNING: ' + r.skipped_corrupt + ' stored file(s) failed their own integrity check and were NOT copied.' : '') + '\nSHA-256 of the backup file: ' + r.sha);
  say('It contains NO secret. It can only be restored into THIS installation (same data folder / secrets.json) — keep secrets.json safe, separately. Synthetic data only.'); return 0;
}
async function restore(src) {
  if (!src || !fs.existsSync(src)) { say('Restore needs an existing backup file: --restore <file>'); return 3; }
  try { const l = JSON.parse(fs.readFileSync(lockFile(), 'utf8')); if (alive(l.pid)) { say('The app is running (pid ' + l.pid + '). Close its window first, then restore.'); return 3; } } catch (e) { /* no lock */ }
  const head = Buffer.alloc(4); try { const fd = fs.openSync(src, 'r'); fs.readSync(fd, head, 0, 4, 0); fs.closeSync(fd); } catch (e) { say('Cannot read the backup file.'); return 3; }
  if (head.toString('latin1') === 'MBK1') {
    const { full } = openFull(); try { const rec = full.recover(); if (rec.action !== 'none') say('An interrupted restore was found and ' + rec.action + '.'); } catch (e) { say('REFUSED — could not recover the interrupted restore (' + e.message + '). Nothing changed.'); return 4; }
    let r; try { r = full.restore(src); } catch (e) { say((e.code === 'CORRUPT' ? 'REFUSED — backup is not valid for this data folder (' + e.message + ')' : 'FAILED — ' + e.message) + '. Current data and reports untouched.'); return e.code === 'CORRUPT' ? 4 : 5; }
    say('Restored state + ' + r.files + ' stored file(s) (' + r.added + ' added, ' + r.repaired + ' repaired). Everything that was there before is kept in ' + r.rollback + ' (delete it when you no longer need it).'); say('All sessions were revoked: sign in again.'); return 0;
  }
  const S = openStore(); let st; try { st = S.restore(src); } catch (e) { say('REFUSED — backup is not valid for this data folder (' + e.message + '). Current data untouched.'); return 4; }
  say('NOTE: this is an OLD state-only backup (no report files). Report files already in this data folder are left as they are.');
  const keep = path.join(dataDir, 'state.before-restore-' + Date.now() + '.bin'); try { fs.copyFileSync(path.join(dataDir, 'state.bin'), keep); say('Previous state kept as ' + keep); } catch (e) { /* first run */ }
  S.saveNow(st); say('Restored. All sessions were revoked: sign in again.'); return 0;
}

/** Integrity (fail-closed). In a PACKAGE (SHA256SUMS.txt, MANIFEST.json or the .cmd files sit next to app/) EVERY start/check re-verifies: manifest present and well-formed, at least one entry,
 *  entry count == MANIFEST.json "files", every listed file's SHA-256 matches, and no unlisted file exists outside data/. There is deliberately no switch to skip this in a package.
 *  NOTE: SHA256SUMS.txt travels inside the ZIP, so it detects corruption / partial extraction / edits, not a malicious publisher — compare the ZIP's own SHA-256 with the digest published separately. */
function verifyPackage() {
  const pk = path.join(root, '..'), sums = path.join(pk, 'SHA256SUMS.txt'), man = path.join(pk, 'MANIFEST.json');
  const isPackage = fs.existsSync(sums) || fs.existsSync(man) || fs.existsSync(path.join(pk, 'START-MASLUL-TEST.cmd'));
  if (!isPackage) return { package: false, ok: true, lines: ['Running from a source checkout (no package manifest): integrity check not applicable.'] };
  const bad = []; let listed = new Map(), meta = {};
  if (!fs.existsSync(sums)) bad.push('SHA256SUMS.txt is missing'); if (!fs.existsSync(man)) bad.push('MANIFEST.json is missing');
  if (!bad.length) {
    try { meta = JSON.parse(fs.readFileSync(man, 'utf8')); } catch (e) { bad.push('MANIFEST.json is not valid JSON'); }
    for (const l of fs.readFileSync(sums, 'utf8').split(/\r?\n/)) { if (!l.trim()) continue; const m = /^([a-f0-9]{64})  ([A-Za-z0-9_.\-\/]+)$/.exec(l); if (!m || m[2].includes('..') || path.isAbsolute(m[2])) { bad.push('malformed checksum line: ' + l.slice(0, 80)); continue; } if (listed.has(m[2])) bad.push('duplicate entry: ' + m[2]); listed.set(m[2], m[1]); }
    if (listed.size === 0) bad.push('SHA256SUMS.txt lists no files (an empty manifest can never pass)');
    if (!Number.isInteger(meta.files) || meta.files !== listed.size) bad.push('file count mismatch: MANIFEST.json says ' + meta.files + ', SHA256SUMS.txt lists ' + listed.size);
    for (const [rel, h] of listed) { let got = ''; try { got = crypto.createHash('sha256').update(fs.readFileSync(path.join(pk, rel))).digest('hex'); } catch (e) { bad.push('missing: ' + rel); continue; } if (got !== h) bad.push('modified: ' + rel); }
    const walk = (d, rel) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => { const r = rel ? rel + '/' + e.name : e.name; if (!rel && e.name === 'data') return []; return e.isDirectory() ? walk(path.join(d, e.name), r) : [r]; });
    for (const r of walk(pk, '')) if (!listed.has(r) && r !== 'SHA256SUMS.txt' && r !== 'MANIFEST.json') bad.push('unexpected file not in the manifest: ' + r);
  }
  return { package: true, ok: bad.length === 0, lines: bad.length ? bad : ['All ' + listed.size + ' files match SHA256SUMS.txt (source commit ' + String(meta.source_commit || '?').slice(0, 7) + ').'] };
}
function verify() { const v = verifyPackage(); v.lines.forEach(l => say(v.ok ? l : ' ✗ ' + l)); if (!v.ok) say('\nIntegrity check FAILED — do not use this copy. Download the ZIP again from the approved source and compare its SHA-256 with the published digest.'); return v.ok ? 0 : 5; }
/** One-action synthetic SMOKE: starts a THROWAWAY server (temp folder, 127.0.0.1 only, random synthetic admin PIN) and walks the core path over real HTTPS: login, march with two absent read back,
 *  unauthenticated + no-CSRF refusals, logout, restart persistence. It never touches --data, binds nothing but loopback, installs nothing. It is a quick "does this copy work on this computer" check, NOT the two-phone pilot. */
async function smoke() {
  const https = require('https'), os = require('os'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maslul-smoke-')), port = await pickPort(18900, 40), results = []; const pin = randomPin();
  if (!port) { say('SMOKE FAIL: no free local port between 18900 and 18939.'); return 1; }
  const origin = 'https://localhost:' + port, ts = require(path.join(root, 'backend_next', 'test_server.js')), start = seed => ts.start({ dir: tmp, port, host: '127.0.0.1', origin, seedAdmin: seed });
  const client = () => { const jar = {}; const f = (m, p, b, noCsrf) => new Promise(res => { const h = { origin }; if (b) h['content-type'] = 'application/json'; if (jar.c) h.cookie = jar.c; if (jar.csrf && !noCsrf && m !== 'GET') h['x-csrf-token'] = jar.csrf; const q = https.request({ host: '127.0.0.1', port, path: p, method: m, rejectUnauthorized: false, headers: h }, rs => { const ch = []; rs.on('data', c => ch.push(c)); rs.on('end', () => { let j = {}; try { j = JSON.parse(Buffer.concat(ch).toString('utf8')); } catch (e) { /* not json */ } if (rs.headers['set-cookie']) jar.c = rs.headers['set-cookie'][0].split(';')[0]; if (j && j.csrf) jar.csrf = j.csrf; res(Object.assign({ _status: rs.statusCode, _headers: rs.headers }, j)); }); }); q.on('error', e => res({ ok: false, _status: 0, message: e.message })); q.end(b ? JSON.stringify(b) : undefined); }); f.api = (method, args, noCsrf) => f('POST', '/api', { method, args: args || {} }, noCsrf); return f; };
  const step = async (name, fn) => { try { await fn(); results.push([true, name]); say('  ✔ ' + name); } catch (e) { results.push([false, name + ' — ' + e.message]); say('  ✘ ' + name + ' — ' + e.message); } };
  const need = (c, m) => { if (!c) throw new Error(m || 'unexpected result'); };
  say('SMOKE (temporary folder, this computer only, synthetic data; your real data folder is not touched)');
  let s; try { s = await start({ fullName: 'מנהל סינתטי', phone: '0500000001', pin }); } catch (e) { say('SMOKE FAIL: the server could not start (' + e.message + ')'); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (x) { /* ignore */ } return 1; }
  const A = client(); let cid, mid;
  try {
    await step('HTTPS page is served with security headers', async () => { const r = await A('GET', '/'); need(r._status === 200, 'status ' + r._status); need(r._headers['strict-transport-security'] || r._headers['content-security-policy'], 'no security headers'); });
    await step('unauthenticated API call is refused', async () => { const r = await client().api('courses.list'); need(r._status === 401 || r.ok === false, 'was answered: ' + r._status); });
    await step('admin logs in with the synthetic PIN', async () => { const r = await A('POST', '/auth/login', { phone: '0500000001', pin }); need(r.ok, JSON.stringify(r).slice(0, 120)); const c = await A.api('courses.list'); need(c.ok && c.data.length, 'no course'); cid = c.data[0].id; });
    await step('a march with TWO absent is saved and read back with exactly two missing', async () => { const sol = await A.api('soldiers.list', { courseId: cid, opts: {} }); need(sol.ok && sol.data.length >= 3, 'no trainees'); const r = await A.api('marches.create', { courseId: cid, data: { request_id: 'smoke-1', march_date: '2026-12-01', location: 'smoke', km_no_stretcher: 3, km_stretcher: 0, absent: sol.data.slice(0, 2).map(x => ({ soldier_id: x.id })) } }); need(r.ok, JSON.stringify(r).slice(0, 160)); mid = r.data.march.id; const l = await A.api('marches.list', { courseId: cid, opts: { marchId: mid, includeRoster: true } }); need(l.ok && l.data[0].roster.filter(x => !x.present).length === 2, 'roster does not show 2 missing'); });
    await step('a request without the CSRF token is refused', async () => { const r = await A.api('courses.list', {}, true); need(r._status >= 400 || r.ok === false, 'was accepted'); });
    await step('after logout the session is dead', async () => { await A('POST', '/auth/logout', {}); const r = await A.api('courses.list'); need(r.ok === false, 'still authenticated'); });
    await s.close(); s = await start(undefined);
    await step('after a server restart the data is still there and login works again', async () => { const B = client(); const r = await B('POST', '/auth/login', { phone: '0500000001', pin }); need(r.ok, 'login after restart failed'); const l = await B.api('marches.list', { courseId: cid, opts: { marchId: mid, includeRoster: true } }); need(l.ok && l.data[0] && l.data[0].roster.filter(x => !x.present).length === 2, 'march lost after restart'); });
  } finally { try { await s.close(); } catch (e) { /* ignore */ } try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ } }
  const bad = results.filter(r => !r[0]); say('');
  if (bad.length) { say('SMOKE FAIL (' + bad.length + ' of ' + results.length + '): ' + bad.map(b => b[1]).join(' | ')); return 1; }
  say('SMOKE PASS (' + results.length + '/' + results.length + ') — this copy starts, logs in, saves a march, enforces access and survives a restart on this computer. NOT the two-phone pilot; no real data used; nothing was installed or left behind.'); return 0;
}
async function main() {
  say('MASLUL 2027 — TEST launcher (synthetic data only · this computer only)');
  if (flag('verify')) return verify();
  if (flag('smoke')) return smoke();
  if (flag('backup')) return backup();
  if (flag('restore')) return restore(arg('restore'));
  problems.push(...preflight());
  { const v = verifyPackage(); if (!v.ok) problems.push('Integrity check failed (the package is incomplete, modified or has extra files): ' + v.lines.slice(0, 5).join('; ') + '. Download the ZIP again from the approved source and compare its SHA-256 with the published digest.'); else if (v.package) say(v.lines[0]); }
  const want = Number(arg('port', 8443)), port = problems.length ? 0 : await pickPort(want, 20);
  if (!problems.length && !port) problems.push('No free local port between ' + want + ' and ' + (want + 19) + '. Close the other program that uses them, or run with --port <number>.');
  try { const l = JSON.parse(fs.readFileSync(lockFile(), 'utf8')); if (alive(l.pid) && l.pid !== process.pid) problems.push('Another MASLUL TEST window is already running on this data folder (pid ' + l.pid + ', ' + l.origin + '). Use it, or close it first.'); } catch (e) { /* no lock */ }
  if (problems.length) { say('\nCannot start:'); problems.forEach((p, i) => say(' ' + (i + 1) + '. ' + p)); say('\nNothing was changed on this computer.'); return 2; }
  if (flag('check')) { say('Preflight OK: Node ' + process.version + ', package complete, data folder writable, port ' + port + ' free. Nothing was started or changed.'); return 0; }

  const first = !fs.existsSync(path.join(dataDir, 'state.bin')), credFile = path.join(dataDir, 'ADMIN-LOGIN-SYNTHETIC.txt');
  let seed; if (first) { const pin = randomPin(); seed = { fullName: 'מנהל בדיקות (סינתטי)', phone: '0500000001', pin }; fs.writeFileSync(credFile, 'MASLUL TEST — SYNTHETIC admin (no real person).\r\nPhone: ' + seed.phone + '\r\nPIN: ' + pin + '\r\nThis file stays on this computer. Delete it after you have memorised the PIN.\r\n', { mode: 0o600 }); }
  if (!first) { try { const rec = openFull().full.recover(); if (rec.action !== 'none') say('An interrupted restore was found and ' + rec.action + ' (your data is consistent).'); } catch (e) { say('FAILED TO START: an interrupted restore could not be recovered (' + e.message + '). Nothing was changed.'); return 1; } }
  const ts = require(path.join(root, 'backend_next', 'test_server.js'));
  let s; try { s = await ts.start({ dir: dataDir, port, host: '127.0.0.1', origin: 'https://localhost:' + port, seedAdmin: seed }); } catch (e) { say('FAILED TO START: ' + e.message); return 1; }
  fs.writeFileSync(lockFile(), JSON.stringify({ pid: process.pid, origin: s.origin, at: new Date().toISOString() }));
  let fp = ''; try { fp = new crypto.X509Certificate(fs.readFileSync(path.join(dataDir, 'cert.pem'))).fingerprint256; } catch (e) { /* ignore */ }
  say('\n  ✔ RUNNING — open this link:   ' + s.origin + '/');
  say('\n  First time in the browser you will see "Your connection is not private" (the certificate is self-signed for this computer only).');
  say('  Click "Advanced" → "Proceed to localhost". Certificate SHA-256 (compare if you wish):\n  ' + fp);
  say('\n  Sign in with the SYNTHETIC admin: ' + (first ? 'phone 0500000001, PIN ' + seed.pin + '  (also saved in ' + credFile + ')' : 'the phone/PIN printed on the first run (see ADMIN-LOGIN-SYNTHETIC.txt if you kept it)'));
  say('  Data folder: ' + dataDir + '   |   Close this window to stop the app. Other devices cannot reach it.\n');
  if (!flag('no-browser') && !process.env.MASLUL_NO_BROWSER) { try { if (process.platform === 'win32') cp.spawn('cmd', ['/c', 'start', '', s.origin + '/'], { stdio: 'ignore', detached: true }).unref(); else if (process.platform === 'darwin') cp.spawn('open', [s.origin + '/'], { stdio: 'ignore', detached: true }).unref(); else cp.spawn('xdg-open', [s.origin + '/'], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch (e) { /* the link above is enough */ } }
  const stop = async () => { try { fs.unlinkSync(lockFile()); } catch (e) { /* ignore */ } try { await s.close(); } catch (e) { /* ignore */ } process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop); process.on('exit', () => { try { fs.unlinkSync(lockFile()); } catch (e) { /* ignore */ } });
  return null;   // keep serving
}
module.exports = { preflight, randomPin };
if (require.main === module) main().then(c => { if (c !== null) process.exit(c); }).catch(e => { console.error('Unexpected error: ' + e.message); process.exit(1); });
