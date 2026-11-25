'use strict';
// Read-only post-deploy smoke test (deploy workflow + local workerd CI + unit tests). Writes nothing, prints no secret/body of user data.
// Final line is ALWAYS exactly one of:   RESULT=READY   |   RESULT=NOT_READY_EXPECTED   |   RESULT=FAIL      (exit 0 / 0 / 1)
//   NOT_READY_EXPECTED = HTTP 200 JSON from /auth/status with configured:false AND /api,/auth/login fail closed (503). Never reported as finished.
//   READY              = configured:true AND unauthenticated /api is 401 AND login with an empty body is not 200 AND security headers AND "/" serves the app (200 html).
//   FAIL               = anything else (404, 5xx, non-JSON, open data route, fake 200 ...).  A just-created workers.dev route can answer 404/5xx for a short while:
//                        /auth/status is retried (SMOKE_RETRIES x SMOKE_WAIT_MS, default 12 x 10 s) and every attempt prints a non-secret diagnostic (status, content-type, server, short body).
const BASE = process.argv[2]; if (!BASE || !/^https?:\/\//.test(BASE)) { console.error('usage: node scripts/cf_ci_smoke.js <base-url>'); process.exit(2); }
const RETRIES = Number(process.env.SMOKE_RETRIES || 12), WAIT = Number(process.env.SMOKE_WAIT_MS || 10000), ORIGIN = new URL(BASE).origin;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const f = (p, o) => fetch(BASE.replace(/\/$/, '') + p, Object.assign({ redirect: 'manual', signal: AbortSignal.timeout(20000) }, o));
const post = (p, b) => f(p, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify(b || {}) });
const diag = async (label, r) => { let t = ''; try { t = (await r.clone().text()).replace(/\s+/g, ' ').slice(0, 100); } catch (e) { /* ignore */ } console.log('  [diag] ' + label + ' -> ' + r.status + ' content-type=' + (r.headers.get('content-type') || '-') + ' server=' + (r.headers.get('server') || '-') + ' cf-ray=' + (r.headers.get('cf-ray') ? 'yes' : 'no') + ' body="' + t + '"'); };
const fail = m => { console.log('SMOKE FAIL: ' + m); console.log('RESULT=FAIL'); process.exit(1); };
(async () => {
  let st, j = null;
  for (let i = 1; i <= RETRIES; i++) {
    try { st = await f('/auth/status'); await diag('GET /auth/status (attempt ' + i + '/' + RETRIES + ')', st); j = null; if (st.status === 200) { try { j = await st.json(); } catch (e) { j = null; } if (j && j.ok === true && typeof j.configured === 'boolean') break; fail('/auth/status answered 200 but not the expected JSON (a fake 200 is not a pass)'); } }
    catch (e) { console.log('  [diag] attempt ' + i + ' network error: ' + String(e.message || e).slice(0, 80)); }
    if (st && st.status !== 200 && ![404, 502, 503, 504, 522, 523, 524, 530].includes(st.status)) fail('/auth/status answered ' + st.status);
    if (i < RETRIES) await sleep(WAIT);
  }
  if (!j) { try { const root = await f('/'); await diag('GET / (diagnostic)', root); console.log(root.status === 200 ? '  [diag] the static app is served but /auth/* does not reach the Worker -> routing (run_worker_first) problem' : '  [diag] nothing is served yet -> route not active / deploy not complete'); } catch (e) { /* ignore */ } fail('/auth/status must answer 200 JSON even before the secrets are set; last status ' + (st ? st.status : 'none')); }
  const api = await post('/api', { method: 'courses.list', args: {} }), login = await post('/auth/login', {});
  if (j.configured === false) {
    if (api.status !== 503 || login.status !== 503) fail('an unconfigured Worker must fail closed (503) on /api and /auth/login, got ' + api.status + '/' + login.status);
    console.log('SMOKE STAGE 1: deployed, NOT CONFIGURED, fails closed. missing=' + (j.missing || []).join(',') + ' -> NOT READY (add the Worker secrets, then re-run)'); console.log('RESULT=NOT_READY_EXPECTED'); return;
  }
  if (api.status !== 401) fail('an unauthenticated data request must be 401, got ' + api.status);
  if (login.status === 200) fail('login with an empty body must not succeed');
  const root = await f('/'); if (root.status !== 200 || !/text\/html/.test(root.headers.get('content-type') || '')) fail('"/" must serve the app (200 html), got ' + root.status);
  for (const k of ['strict-transport-security', 'content-security-policy', 'x-frame-options']) if (!root.headers.get(k)) fail('missing header ' + k);
  console.log('SMOKE STAGE 2: configured, data routes need a session, app + headers present (needsSetup=' + j.needsSetup + ')'); console.log('RESULT=READY');
})().catch(e => fail(String(e.message || e).slice(0, 160)));
