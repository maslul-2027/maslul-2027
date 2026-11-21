'use strict';
// Pure-Node loopback certificate (used when openssl is absent, e.g. stock Windows): valid X.509, SAN localhost+127.0.0.1, CA:FALSE, serverAuth, signature verifies, and a real TLS handshake works.
const assert = require('assert'), crypto = require('crypto'), https = require('https'), { create } = require('../backend_next/selfsigned');
let pass = 0, fail = 0; const T = async (n, f) => { try { await f(); pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, e.message); } };
(async () => {
  const c = create({ days: 7 }), x = new crypto.X509Certificate(c.cert);
  await T('parses as X.509 with SAN localhost + 127.0.0.1, not a CA, self-signed signature verifies', () => { assert.ok(x.checkHost('localhost') && x.checkIP('127.0.0.1')); assert.equal(x.ca, false); assert.ok(x.verify(x.publicKey)); assert.ok(!x.checkHost('example.com')); });
  await T('validity window is about 7 days and already started', () => { const d = (new Date(x.validTo) - Date.now()) / 86400e3; assert.ok(d > 6.9 && d < 7.1, String(d)); assert.ok(new Date(x.validFrom) < new Date()); });
  await T('fingerprint reported equals the certificate fingerprint', () => assert.equal(c.fingerprint, x.fingerprint256));
  await T('two certificates differ (fresh key + serial every time)', () => assert.notEqual(create().cert, c.cert));
  await T('a real TLS handshake works with it (client pinned to this certificate)', async () => { const s = https.createServer({ cert: c.cert, key: c.key }, (q, r) => r.end('ok')); await new Promise(r => s.listen(0, '127.0.0.1', r)); const body = await new Promise((res, rej) => https.get({ host: 'localhost', port: s.address().port, ca: c.cert, rejectUnauthorized: true }, q => { let b = ''; q.on('data', d => b += d); q.on('end', () => res(b)); }).on('error', rej)); s.close(); assert.equal(body, 'ok'); });
  console.log('SELFSIGNED TOTAL pass=' + pass + ' fail=' + fail); process.exit(fail ? 1 : 0);
})();
