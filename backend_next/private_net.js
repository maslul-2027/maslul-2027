'use strict';
// Address policy for the private TEST pilot: a non-loopback bind is allowed ONLY on a private address — IPv4 RFC1918 (10/8, 172.16/12, 192.168/16) or IPv6 ULA (fc00::/7).
// Everything else is refused: public, unspecified (0.0.0.0, ::), multicast, link-local, CGNAT (100.64/10), documentation/reserved ranges, IPv4-mapped IPv6, and any DNS name as a BIND value.
const net = require('net');
function v4(ip) { return ip.split('.').map(Number); }
function classify(ip) {
  const f = net.isIP(ip); if (!f) return 'not-an-ip';
  if (f === 4) { const [a, b] = v4(ip);
    if (a === 127) return 'loopback'; if (a === 0) return 'unspecified'; if (a >= 224) return a >= 240 ? 'reserved' : 'multicast';
    if (a === 10) return 'private'; if (a === 172 && b >= 16 && b <= 31) return 'private'; if (a === 192 && b === 168) return 'private';
    if (a === 169 && b === 254) return 'link-local'; if (a === 100 && b >= 64 && b <= 127) return 'cgnat'; return 'public'; }
  const l = ip.toLowerCase(); if (l === '::1') return 'loopback'; if (l === '::' ) return 'unspecified'; if (/^::ffff:/.test(l) || /^::\d/.test(l)) return 'ipv4-mapped';
  const first = parseInt((l.split(':')[0] || '0') || '0', 16); if (first >= 0xfc00 && first <= 0xfdff) return 'private'; if (first >= 0xfe80 && first <= 0xfebf) return 'link-local'; if (first >= 0xff00) return 'multicast'; return 'public';
}
/** @returns {{ok:boolean, kind:string, reason?:string}} — bind addresses only (IP literals; DNS names are refused). */
function checkBind(ip, opts) {
  opts = opts || {}; const kind = classify(String(ip || ''));
  if (kind === 'private') return { ok: true, kind };
  if (kind === 'loopback') return opts.allowLoopback ? { ok: true, kind } : { ok: false, kind, reason: 'loopback is only for local automated tests, not for phones' };
  if (kind === 'not-an-ip') return { ok: false, kind, reason: 'the bind value must be an IP literal on a private network (DNS names are not accepted for --bind)' };
  return { ok: false, kind, reason: kind + ' address refused: only RFC1918 IPv4 (10/8, 172.16/12, 192.168/16) or IPv6 ULA (fc00::/7) may be bound' };
}
/** The public ORIGIN must be https and its host either a DNS name or a PRIVATE IP literal (never a public IP). */
function checkOrigin(origin, bindIp) {
  let u; try { u = new URL(origin); } catch (e) { return { ok: false, reason: 'ORIGIN is not a valid URL' }; }
  if (u.protocol !== 'https:') return { ok: false, reason: 'ORIGIN must be https (no plaintext HTTP)' };
  const h = u.hostname.replace(/^\[|\]$/g, ''); if (u.pathname !== '/' || u.username || u.password || u.search || u.hash) return { ok: false, reason: 'ORIGIN must be scheme://host[:port] only' };
  if (net.isIP(h)) { const c = checkBind(h, { allowLoopback: true }); if (!c.ok) return { ok: false, reason: 'ORIGIN host ' + c.reason }; if (bindIp && h !== bindIp) return { ok: false, reason: 'ORIGIN IP must equal the bind address' }; }
  return { ok: true, host: h };
}
/** Validate a supplied certificate/key pair for `name` WITHOUT openssl (works on stock Windows too): readable PEMs, SAN contains the name (IP or DNS, no CN fallback), valid now and for >= 1 hour, private key matches.
 *  Throws (the server must stay closed) otherwise. Used by BOTH entry points (private_test_launch and a direct test_server start) so neither can be a bypass of the other. */
function checkCertFiles({ certFile, keyFile, name }) {
  const crypto = require('crypto'), fs = require('fs'); let x, key;
  try { x = new crypto.X509Certificate(fs.readFileSync(certFile)); } catch (e) { throw new Error('certificate file is missing or not a valid PEM certificate'); }
  try { key = crypto.createPrivateKey(fs.readFileSync(keyFile)); } catch (e) { throw new Error('private key file is missing or not a valid PEM key'); }
  const sanOk = net.isIP(name) ? (x.subjectAltName || '').split(/,\s*/).some(e => e === 'IP Address:' + name) : !!x.subjectAltName && x.checkHost(name, { subject: 'never', wildcards: false }) === name;
  if (!sanOk) throw new Error('TLS SAN does not contain ' + name + ' — refusing to start (no browser warning workaround)');
  const now = Date.now(); if (new Date(x.validFrom).getTime() > now) throw new Error('certificate is not valid yet'); if (new Date(x.validTo).getTime() < now + 3600e3) throw new Error('certificate is expired or expires within one hour');
  if (!x.checkPrivateKey(key)) throw new Error('private key does not match the certificate');
  return { san: (net.isIP(name) ? 'IP Address:' : 'DNS:') + name, validTo: x.validTo, fingerprint256: x.fingerprint256 };
}
module.exports = { classify, checkBind, checkOrigin, checkCertFiles };
