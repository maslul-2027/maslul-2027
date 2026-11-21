'use strict';
// Pure-Node self-signed certificate for LOOPBACK TEST use (Windows has no openssl). No dependencies, nothing is installed or trusted on the machine.
// The browser will show a one-time "not private" warning for https://localhost (self-signed); the launcher prints the SHA-256 fingerprint to compare. Never use for a phone or any non-loopback host.
const crypto = require('crypto');
const len = n => n < 128 ? Buffer.from([n]) : n < 256 ? Buffer.from([0x81, n]) : Buffer.from([0x82, n >> 8, n & 255]);
const tlv = (t, ...b) => { const body = Buffer.concat(b); return Buffer.concat([Buffer.from([t]), len(body.length), body]); };
const seq = (...b) => tlv(0x30, ...b), set = (...b) => tlv(0x31, ...b);
const oid = s => { const p = s.split('.').map(Number), o = [p[0] * 40 + p[1]]; for (const v of p.slice(2)) { const st = [v & 127]; let x = v >> 7; while (x) { st.unshift((x & 127) | 128); x >>= 7; } o.push(...st); } return tlv(0x06, Buffer.from(o)); };
const int = b => { b = Buffer.from(b); while (b.length > 1 && b[0] === 0 && !(b[1] & 128)) b = b.subarray(1); if (b[0] & 128) b = Buffer.concat([Buffer.from([0]), b]); return tlv(0x02, b); };
const utf8 = s => tlv(0x0c, Buffer.from(s, 'utf8')), time = d => tlv(0x17, Buffer.from(d.toISOString().replace(/[-:T]/g, '').slice(2, 14) + 'Z'));
const RSA_SHA256 = seq(oid('1.2.840.113549.1.1.11'), tlv(0x05));
function create(opts) {
  opts = opts || {}; const days = opts.days || 30, cn = opts.cn || 'localhost';
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const name = seq(set(seq(oid('2.5.4.3'), utf8(cn))));
  const san = seq(tlv(0x82, Buffer.from('localhost')), tlv(0x87, Buffer.from([127, 0, 0, 1])));
  const ext = seq(
    seq(oid('2.5.29.19'), tlv(0x01, Buffer.from([0xff])), tlv(0x04, seq(tlv(0x01, Buffer.from([0]))))),            // basicConstraints: CA:FALSE (critical)
    seq(oid('2.5.29.15'), tlv(0x01, Buffer.from([0xff])), tlv(0x04, tlv(0x03, Buffer.from([0x05, 0xa0])))),         // keyUsage: digitalSignature, keyEncipherment (critical)
    seq(oid('2.5.29.37'), tlv(0x04, seq(oid('1.3.6.1.5.5.7.3.1')))),                                                  // extKeyUsage: serverAuth
    seq(oid('2.5.29.17'), tlv(0x04, san)));                                                                           // subjectAltName: DNS:localhost, IP:127.0.0.1
  const now = Date.now(), tbs = seq(tlv(0xa0, int(Buffer.from([2]))), int(crypto.randomBytes(16)), RSA_SHA256, name,
    seq(time(new Date(now - 3600e3)), time(new Date(now + days * 86400e3))), name, publicKey.export({ type: 'spki', format: 'der' }), tlv(0xa3, ext));
  const sig = crypto.sign('sha256', tbs, privateKey), der = seq(tbs, RSA_SHA256, tlv(0x03, Buffer.concat([Buffer.from([0]), sig])));
  const pem = der.toString('base64').match(/.{1,64}/g).join('\n');
  return { cert: '-----BEGIN CERTIFICATE-----\n' + pem + '\n-----END CERTIFICATE-----\n', key: privateKey.export({ type: 'pkcs8', format: 'pem' }), fingerprint: crypto.createHash('sha256').update(der).digest('hex').toUpperCase().match(/../g).join(':') };
}
module.exports = { create };
