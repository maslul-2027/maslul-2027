#!/usr/bin/env node
'use strict';
// Private TEST launcher for the two-phone pilot — SYNTHETIC DATA ONLY, approved PRIVATE network ONLY.
//  PREFERRED (IT-managed trusted certificate, nothing to install on phones):
//    MASLUL_SYNTHETIC_ONLY_ACK=yes MASLUL_SEED_ADMIN_PHONE=… MASLUL_SEED_ADMIN_PIN=… node backend_next/private_test_launch.js --name pilot.example.internal --bind 10.1.2.3 --cert fullchain.pem --key privkey.pem [--port 8443]
//  FALLBACK (short-lived private CA — ONLY with explicit owner + InfoSec approval, on dedicated test devices; see docs/TWO_PHONE_ACCEPTANCE.md):
//    … MASLUL_CA_FALLBACK_APPROVED=owner+infosec-dedicated-test-devices node backend_next/private_test_launch.js --name 192.168.1.20 [--bind 192.168.1.20]
// Bind policy (backend_next/private_net.js): RFC1918 IPv4 / IPv6 ULA literal only. Public, wildcard, multicast, link-local, CGNAT and DNS bind values are refused. No firewall/NAT/tunnel is opened by this tool.
// The CA private key is deleted right after the server certificate is signed and never leaves this machine. Real phone-ownership verification, a real secret store and InfoSec approval are still OPEN.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto'), net = require('net'), privateNet = require('./private_net');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const sh = (cmd, a, o) => cp.execFileSync(cmd, a, Object.assign({ stdio: 'pipe' }, o || {}));
/** Create (or reuse) the private CA and a server certificate for `name`. Returns paths + the CA SHA-256 fingerprint the phone user can compare. */
function prepare({ dir, name, days }) {
  if (!name || !/^[A-Za-z0-9.-]+$/.test(name)) throw new Error('--name must be a DNS name or IP address (letters, digits, dots, dashes)');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); const f = n => path.join(dir, n), D = String(days || 7);
  { try { fs.unlinkSync(f('ca.crt')); fs.unlinkSync(f('ca.key')); } catch (e) { /* fresh CA every run: the key is deleted after signing, so a CA is never reused */ }
    sh('openssl', ['req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-keyout', f('ca.key'), '-out', f('ca.crt'), '-days', D, '-subj', '/CN=MASLUL TEST private CA (synthetic data only)', '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0', '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
  }
  const san = (net.isIP(name) ? 'IP:' : 'DNS:') + name + ',DNS:localhost';
  sh('openssl', ['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', f('server.key'), '-out', f('server.csr'), '-subj', '/CN=' + name]);
  fs.writeFileSync(f('ext.cnf'), 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=' + san + '\n');
  sh('openssl', ['x509', '-req', '-in', f('server.csr'), '-CA', f('ca.crt'), '-CAkey', f('ca.key'), '-CAcreateserial', '-out', f('server.crt'), '-days', D, '-extfile', f('ext.cnf')]);
  fs.chmodSync(f('server.key'), 0o600); ['ca.key', 'server.csr', 'ext.cnf', 'ca.srl'].forEach(k => { try { fs.unlinkSync(f(k)); } catch (e) { /* ignore */ } });
  const der = sh('openssl', ['x509', '-in', f('ca.crt'), '-outform', 'der']); const fp = crypto.createHash('sha256').update(der).digest('hex').toUpperCase().match(/../g).join(':');
  return { caCert: f('ca.crt'), serverCert: f('server.crt'), serverKey: f('server.key'), caFingerprint: fp, san };
}
/** Validate a certificate file pair for `name`: SAN contains the name, currently valid, key matches. Throws (server stays closed) otherwise. */
function checkCert(a) { return privateNet.checkCertFiles(a); }
module.exports = { prepare, checkCert };
if (require.main === module) (async () => {
  const die = m => { console.error('REFUSED: ' + m); process.exit(2); };
  if (process.env.MASLUL_SYNTHETIC_ONLY_ACK !== 'yes') die('set MASLUL_SYNTHETIC_ONLY_ACK=yes to confirm this private TEST contains SYNTHETIC data only and runs on an approved private network.');
  const name = arg('name'), port = Number(arg('port', '8443')), dir = path.resolve(arg('dir', '.private-test')), bind = arg('bind', net.isIP(name || '') ? name : ''), certFile = arg('cert'), keyFile = arg('key');
  if (!name || !/^[A-Za-z0-9.-]+$/.test(name)) die('--name must be a DNS name or private IP address');
  const b = privateNet.checkBind(bind); if (!b.ok) die('--bind ' + (bind || '(missing)') + ': ' + b.reason);
  if (net.isIP(name) && name !== bind) die('when --name is an IP it must equal --bind');
  if (net.isIP(name)) { const n = privateNet.checkBind(name); if (!n.ok) die('--name: ' + n.reason); }
  const ts = require('./test_server'); let cf, kf, extra = '';
  try {
    if (certFile || keyFile) { if (!certFile || !keyFile) die('--cert and --key go together'); checkCert({ certFile, keyFile, name }); cf = certFile; kf = keyFile; }
    else { if (process.env.MASLUL_CA_FALLBACK_APPROVED !== 'owner+infosec-dedicated-test-devices') die('no IT certificate given (--cert/--key). The private-CA fallback installs a root trust anchor on the phone and needs explicit owner + InfoSec approval for dedicated test devices: set MASLUL_CA_FALLBACK_APPROVED=owner+infosec-dedicated-test-devices only after that approval. Preferred: ask IT for a trusted HTTPS certificate for the pilot name.');
      const c = prepare({ dir, name }); checkCert({ certFile: c.serverCert, keyFile: c.serverKey, name }); cf = c.serverCert; kf = c.serverKey; extra = '\nCA fallback (APPROVED dedicated test devices only): install ' + c.caCert + ' as a trusted root ONLY on those devices; compare SHA-256 ' + c.caFingerprint + '. REMOVE the profile/root CA from every device when the pilot ends; the CA key was already deleted and the certificate expires in 7 days.'; }
    const s = await ts.start({ dir: path.join(dir, 'server'), port, host: bind, origin: 'https://' + name + ':' + port, certFile: cf, keyFile: kf });
    console.log('MASLUL private TEST (SYNTHETIC ONLY) listening on https://' + name + ':' + port + ' (bound to ' + bind + ', ' + b.kind + ' address; HTTPS only, no HTTP listener)\nState (encrypted): ' + path.join(dir, 'server', 'state.bin') + extra + '\nStop: Ctrl+C. Delete ' + dir + ' when the pilot ends.');
  } catch (e) { console.error('FAILED (server not started): ' + e.message); process.exit(1); }
})();
