#!/usr/bin/env node
'use strict';
// MASLUL 2027 — one-action TEST launcher (Windows / macOS / Linux). SYNTHETIC DATA ONLY, LOOPBACK ONLY (https://localhost), single user, single machine.
// This is NOT the two-phone / multi-user path: other devices cannot reach it (it binds 127.0.0.1 and refuses anything else). Nothing is installed, no firewall/hosts/registry/certificate-store change, no elevation, no network call.
//   node release/launcher.js [--data DIR] [--port N] [--no-browser] [--check] [--backup] [--restore FILE]
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
/** Environment checks (pure + injectable so CI can prove them on any OS). Problems block the start; warnings are printed and never bypass anything. Read-only. */
function environmentChecks(env) {
  const e = Object.assign({ platform: process.platform, release: require('os').release(), root, dataDir, freeBytes: null }, env || {}), problems = [], warnings = [], norm = x => String(x).replace(/\//g, '\\');
  if (e.platform === 'win32') {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(e.release || ''); if (m && (Number(m[1]) < 10)) problems.push('Windows 10 or 11 is required (this is Windows NT ' + m[1] + '.' + m[2] + '). Use a newer computer for the TEST.');
    const r = norm(e.root).toLowerCase();
    if (/\\appdata\\local\\temp\\/.test(r) && /(\.zip|rar\$|7zo)/.test(r)) problems.push('The package is being run from inside a ZIP preview (a temporary folder). Right-click the ZIP → Extract All…, then open START-MASLUL-TEST.cmd from the extracted folder.');
    if (norm(e.root).length > 150 || norm(e.dataDir).length > 180) problems.push('The folder path is too long for Windows (' + Math.max(norm(e.root).length, norm(e.dataDir).length) + ' characters). Extract the ZIP to a short folder such as C:\\MASLUL-TEST.');
    if (/\\(onedrive|dropbox|google drive|icloud)[^\\]*\\/i.test(norm(e.dataDir) + '\\')) warnings.push('The data folder is inside a cloud-synced folder. The synthetic data and its local key would then be copied to that cloud account. Prefer a folder outside OneDrive/Dropbox/Drive (for example C:\\MASLUL-TEST\\data).');
  }
  if (typeof e.freeBytes === 'number' && e.freeBytes < 300 * 1024 * 1024) problems.push('Less than 300 MB free on the data drive (' + Math.floor(e.freeBytes / 1048576) + ' MB). Free some space or use --data on another drive.');
  return { problems, warnings };
}
const freeBytesOf = d => { try { const s = fs.statfsSync(d); return Number(s.bavail) * Number(s.bsize); } catch (e) { return null; } };
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
async function main() {
  say('MASLUL 2027 — TEST launcher (synthetic data only · this computer only)');
  if (flag('verify')) return verify();
  if (flag('backup')) return backup();
  if (flag('restore')) return restore(arg('restore'));
  problems.push(...preflight());
  { const env = environmentChecks({ freeBytes: freeBytesOf(fs.existsSync(dataDir) ? dataDir : path.dirname(dataDir)) }); problems.push(...env.problems); env.warnings.forEach(w => say('Warning: ' + w)); }
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
module.exports = { preflight, randomPin, environmentChecks, REQUIRED };
if (require.main === module) main().then(c => { if (c !== null) process.exit(c); }).catch(e => { console.error('Unexpected error: ' + e.message); process.exit(1); });
