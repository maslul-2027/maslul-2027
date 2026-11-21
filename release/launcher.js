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
const freePort = p => new Promise(r => { const s = net.createServer(); s.once('error', () => r(false)); s.listen(p, '127.0.0.1', () => s.close(() => r(true))); });
async function pickPort(start, tries) { for (let i = 0; i < tries; i++) if (await freePort(start + i)) return start + i; return 0; }
const randomPin = () => { const { weakPin } = require(path.join(root, 'backend_next', 'pin_auth.js')); for (;;) { const p = Array.from(crypto.randomBytes(4), b => b % 10).join(''); if (new Set(p).size === 4 && !weakPin(p)) return p; } };   // the app's PIN is 4 digits by design (loopback synthetic test; real phone-OTP is an open gate)
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const lockFile = () => path.join(dataDir, 'server.lock');
function readSecrets() { return JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf8')); }
function openStore() { const store = require(path.join(root, 'backend_next', 'store.js')); return store.open({ file: path.join(dataDir, 'state.bin'), key: Buffer.from(readSecrets().storeKey, 'hex') }); }

async function backup() {
  if (!fs.existsSync(path.join(dataDir, 'state.bin'))) { say('Nothing to back up yet: start the app once first.'); return 3; }
  const S = openStore(), st = S.load(), dir = path.join(dataDir, 'backups'); fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'backup-' + new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '') + '.bin'); const r = await S.backup(st, dest);
  say('Encrypted backup written: ' + dest + (r && r.sha ? '\nSHA-256 of content: ' + r.sha : '')); say('It can only be opened with THIS data folder\'s secrets.json — keep both together. Synthetic data only.'); return 0;
}
async function restore(src) {
  if (!src || !fs.existsSync(src)) { say('Restore needs an existing backup file: --restore <file>'); return 3; }
  try { const l = JSON.parse(fs.readFileSync(lockFile(), 'utf8')); if (alive(l.pid)) { say('The app is running (pid ' + l.pid + '). Close its window first, then restore.'); return 3; } } catch (e) { /* no lock */ }
  const S = openStore(); let st; try { st = S.restore(src); } catch (e) { say('REFUSED — backup is not valid for this data folder (' + e.message + '). Current data untouched.'); return 4; }
  const keep = path.join(dataDir, 'state.before-restore-' + Date.now() + '.bin'); try { fs.copyFileSync(path.join(dataDir, 'state.bin'), keep); say('Previous state kept as ' + keep); } catch (e) { /* first run */ }
  S.saveNow(st); say('Restored. All sessions were revoked: sign in again.'); return 0;
}

/** Integrity: every file listed in SHA256SUMS.txt (next to START-MASLUL-TEST.cmd) must match. Read-only. */
function verify() {
  const f = path.join(root, '..', 'SHA256SUMS.txt'); if (!fs.existsSync(f)) { say('No SHA256SUMS.txt next to the package (running from a source checkout?).'); return 3; }
  let bad = 0, n = 0; for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean)) { const m = /^([a-f0-9]{64})  (.+)$/.exec(l); if (!m) continue; n++; const p = path.join(root, '..', m[2]); let h = ''; try { h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } catch (e) { /* missing */ } if (h !== m[1]) { bad++; say('MISMATCH/MISSING: ' + m[2]); } }
  say(bad ? bad + ' of ' + n + ' files differ — do not use this copy; download the package again.' : 'All ' + n + ' files match SHA256SUMS.txt.'); return bad ? 5 : 0;
}
async function main() {
  say('MASLUL 2027 — TEST launcher (synthetic data only · this computer only)');
  if (flag('verify')) return verify();
  if (flag('backup')) return backup();
  if (flag('restore')) return restore(arg('restore'));
  problems.push(...preflight());
  const want = Number(arg('port', 8443)), port = problems.length ? 0 : await pickPort(want, 20);
  if (!problems.length && !port) problems.push('No free local port between ' + want + ' and ' + (want + 19) + '. Close the other program that uses them, or run with --port <number>.');
  try { const l = JSON.parse(fs.readFileSync(lockFile(), 'utf8')); if (alive(l.pid) && l.pid !== process.pid) problems.push('Another MASLUL TEST window is already running on this data folder (pid ' + l.pid + ', ' + l.origin + '). Use it, or close it first.'); } catch (e) { /* no lock */ }
  if (problems.length) { say('\nCannot start:'); problems.forEach((p, i) => say(' ' + (i + 1) + '. ' + p)); say('\nNothing was changed on this computer.'); return 2; }
  if (flag('check')) { say('Preflight OK: Node ' + process.version + ', package complete, data folder writable, port ' + port + ' free. Nothing was started or changed.'); return 0; }

  const first = !fs.existsSync(path.join(dataDir, 'state.bin')), credFile = path.join(dataDir, 'ADMIN-LOGIN-SYNTHETIC.txt');
  let seed; if (first) { const pin = randomPin(); seed = { fullName: 'מנהל בדיקות (סינתטי)', phone: '0500000001', pin }; fs.writeFileSync(credFile, 'MASLUL TEST — SYNTHETIC admin (no real person).\r\nPhone: ' + seed.phone + '\r\nPIN: ' + pin + '\r\nThis file stays on this computer. Delete it after you have memorised the PIN.\r\n', { mode: 0o600 }); }
  const ts = require(path.join(root, 'backend_next', 'test_server.js'));
  let s; try { s = await ts.start({ dir: dataDir, port, host: '127.0.0.1', origin: 'https://localhost:' + port, seedAdmin: seed }); } catch (e) { say('FAILED TO START: ' + e.message); return 1; }
  fs.writeFileSync(lockFile(), JSON.stringify({ pid: process.pid, origin: s.origin, at: new Date().toISOString() }));
  let fp = ''; try { fp = new crypto.X509Certificate(fs.readFileSync(path.join(dataDir, 'cert.pem'))).fingerprint256; } catch (e) { /* ignore */ }
  say('\n  ✔ RUNNING — open this link:   ' + s.origin + '/');
  say('\n  First time in the browser you will see "Your connection is not private" (the certificate is self-signed for this computer only).');
  say('  Click "Advanced" → "Proceed to localhost". Certificate SHA-256 (compare if you wish):\n  ' + fp);
  say('\n  Sign in with the SYNTHETIC admin: ' + (first ? 'phone 0500000001, PIN ' + seed.pin + '  (also saved in ' + credFile + ')' : 'the phone/PIN printed on the first run (see ADMIN-LOGIN-SYNTHETIC.txt if you kept it)'));
  say('  Data folder: ' + dataDir + '   |   Close this window to stop the app. Other devices cannot reach it.\n');
  if (!flag('no-browser')) { try { if (process.platform === 'win32') cp.spawn('cmd', ['/c', 'start', '', s.origin + '/'], { stdio: 'ignore', detached: true }).unref(); else if (process.platform === 'darwin') cp.spawn('open', [s.origin + '/'], { stdio: 'ignore', detached: true }).unref(); else cp.spawn('xdg-open', [s.origin + '/'], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch (e) { /* the link above is enough */ } }
  const stop = async () => { try { fs.unlinkSync(lockFile()); } catch (e) { /* ignore */ } try { await s.close(); } catch (e) { /* ignore */ } process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop); process.on('exit', () => { try { fs.unlinkSync(lockFile()); } catch (e) { /* ignore */ } });
  return null;   // keep serving
}
module.exports = { preflight, randomPin };
if (require.main === module) main().then(c => { if (c !== null) process.exit(c); }).catch(e => { console.error('Unexpected error: ' + e.message); process.exit(1); });
