#!/usr/bin/env node
'use strict';
// Read-only start-up gate (systemd ExecStartPre; also runnable by hand). Uses the SAME address/certificate rules as the app (backend_next/private_net.js), so a mis-configured host fails HERE with a plain reason instead of half-starting.
// Exit 0 = every check passed. It changes nothing and prints no secret.
const fs = require('fs'), path = require('path'); const privateNet = require('../../backend_next/private_net.js');
const E = process.env, out = []; const chk = (ok, name, why) => { out.push({ ok: !!ok, name, why: ok ? '' : why }); };
const mode = f => { try { return fs.statSync(f).mode & 0o777; } catch (e) { return null; } };
chk(E.MASLUL_SYNTHETIC_ONLY_ACK === 'yes', 'synthetic-only acknowledgement', 'MASLUL_SYNTHETIC_ONLY_ACK=yes is required: this TEST must never hold real data');
chk(/^[A-Za-z0-9.-]+$/.test(E.MASLUL_NAME || '') && /\./.test(E.MASLUL_NAME || '') && !/^(example\.com|maslul-test\.example\.com)$/.test(E.MASLUL_NAME || '') || process.env.MASLUL_PREFLIGHT_ALLOW_PLACEHOLDER === '1', 'private DNS name set (not the placeholder)', 'MASLUL_NAME is empty, malformed or still the example placeholder');
const b = privateNet.checkBind(E.MASLUL_BIND || ''); chk(b.ok, 'bind address is private (RFC1918/ULA, never public/wildcard/CGNAT/DNS)', b.reason || 'bad bind');
const port = Number(E.MASLUL_PORT || 8443); chk(Number.isInteger(port) && port >= 1024 && port <= 65535, 'port is unprivileged', 'MASLUL_PORT must be 1024-65535 (the service runs without root)');
let og = { ok: false, reason: 'no name' }; if (E.MASLUL_NAME) og = privateNet.checkOrigin('https://' + E.MASLUL_NAME + ':' + port, null); chk(og.ok, 'origin is https://<name>:<port>', og.reason);
let cert = null; try { cert = privateNet.checkCertFiles({ certFile: E.MASLUL_TLS_CERT, keyFile: E.MASLUL_TLS_KEY, name: E.MASLUL_NAME }); chk(true, 'certificate valid for the name (SAN), not expiring within 1h, key matches'); } catch (e) { chk(false, 'certificate valid for the name', e.message); }
if (cert) { const days = (new Date(cert.validTo).getTime() - Date.now()) / 864e5; chk(days >= 5, 'certificate has >= 5 days left (renewal timer is working)', 'certificate expires in ' + days.toFixed(1) + ' days: renewal is not working'); }
const km = mode(E.MASLUL_TLS_KEY || ''); chk(km !== null && (km & 0o007) === 0, 'TLS key is not world-readable', 'TLS key mode is ' + (km === null ? 'unreadable' : km.toString(8)));
const dir = E.MASLUL_DATA_DIR || ''; let w = false; try { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); const t = path.join(dir, '.pf' + process.pid); fs.writeFileSync(t, 'x'); fs.unlinkSync(t); w = true; } catch (e) { /* reported below */ } chk(w, 'data directory writable by the service user', 'cannot write ' + dir);
const dm = mode(dir); chk(dm !== null && (dm & 0o077) === 0, 'data directory is private (0700)', 'data directory mode is ' + (dm === null ? '?' : dm.toString(8)));
const sec = path.join(dir, 'server', 'secrets.json'); if (fs.existsSync(sec)) { const sm = mode(sec); chk((sm & 0o077) === 0, 'secrets.json is private (0600)', 'secrets.json mode is ' + sm.toString(8)); }
chk(!/^(CHANGE_ME.*|)$/.test(E.MASLUL_SEED_ADMIN_PIN || '') || fs.existsSync(path.join(dir, 'server', 'state.bin')), 'first-admin PIN set (or store already initialised)', 'MASLUL_SEED_ADMIN_PIN is still the placeholder and no store exists yet');
let bad = 0; for (const c of out) { if (!c.ok) bad++; console.log((c.ok ? 'PASS ' : 'FAIL ') + c.name + (c.ok ? '' : ' — ' + c.why)); }
console.log(bad ? 'PREFLIGHT FAILED (' + bad + '): the service will not start. Nothing was changed.' : 'PREFLIGHT OK (' + out.length + ' checks)'); process.exit(bad ? 1 : 0);
