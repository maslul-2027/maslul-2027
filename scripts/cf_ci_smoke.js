'use strict';
// Read-only post-deploy smoke test used by .github/workflows/cloudflare-deploy-test.yml (and unit-tested against the local Worker). Writes nothing, prints no secret.
// STAGE 1 (first deploy, Worker secrets not set yet): /auth/status answers configured:false and every other entry point FAILS CLOSED (503) -> exit 0, but reported as NOT READY.
// STAGE 2 (secrets set): unauthenticated data request must be 401, security headers present -> READY.
// Anything else (an open data route, a 200 where 503/401 is required, a non-JSON status) -> exit 1.
const URL_ = process.argv[2]; if (!URL_ || !/^https?:\/\//.test(URL_)) { console.error('usage: node scripts/cf_ci_smoke.js <base-url>'); process.exit(2); }
(async () => {
  const f = (p, o) => fetch(URL_ + p, Object.assign({ redirect: 'manual', signal: AbortSignal.timeout(20000) }, o)), post = (p, b) => f(p, { method: 'POST', headers: { 'content-type': 'application/json', origin: new URL(URL_).origin }, body: JSON.stringify(b || {}) });
  const bad = m => { console.log('SMOKE FAIL: ' + m); process.exit(1); };
  const st = await f('/auth/status'); if (st.status !== 200) bad('/auth/status must answer 200 even before the secrets are set, got ' + st.status);
  let j; try { j = await st.json(); } catch (e) { bad('/auth/status is not JSON'); } if (!j || j.ok !== true || typeof j.configured !== 'boolean') bad('/auth/status shape');
  const api = await post('/api', { method: 'courses.list', args: {} }), login = await post('/auth/login', {});
  if (j.configured === false) {
    if (api.status !== 503 || login.status !== 503) bad('an unconfigured Worker must fail closed (503) on /api and /auth/login, got ' + api.status + '/' + login.status);
    console.log('SMOKE STAGE 1 OK: deployed, NOT CONFIGURED, fails closed. missing=' + (j.missing || []).join(',') + ' -> NOT READY (add the Worker secrets, then run this again)'); console.log('READY=false'); return;
  }
  if (api.status !== 401) bad('an unauthenticated data request must be 401, got ' + api.status);
  if (login.status === 200) bad('login with an empty body must not succeed');
  const h = (await f('/')).headers; for (const k of ['strict-transport-security', 'content-security-policy', 'x-frame-options']) if (!h.get(k)) bad('missing header ' + k);
  console.log('SMOKE STAGE 2 OK: configured, data routes need a session, headers present -> READY for owner set-up (needsSetup=' + j.needsSetup + ')'); console.log('READY=true');
})().catch(e => { console.log('SMOKE FAIL: ' + String(e.message || e).slice(0, 160)); process.exit(1); });
