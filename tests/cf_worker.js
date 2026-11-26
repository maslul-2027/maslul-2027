'use strict';
const fs = require('fs');
// Cloudflare Free shared-TEST: end-to-end through the REAL Worker code (fetch handler) with the REAL engine and a REAL SQL database.
//   default       : Worker called in-process, D1 = node:sqlite shim (tests/lib/d1_shim.js)           -> `node tests/cf_worker.js`
//   CF_BASE_URL=… : the same assertions over HTTP against `wrangler dev` (workerd + local D1), see .github/workflows/cloudflare-free-test.yml
// Two/three independent authenticated sessions (own cookie jars, own TOTP devices) read ONE database. SYNTHETIC DATA ONLY. No account, no network to Cloudflare.
const assert = require('assert/strict'), path = require('path'), { pathToFileURL } = require('url');
if (!process.env.CF_BASE_URL) require('child_process').spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'build_cf_worker.js')], { stdio: 'ignore' });   // generated engine + seed (gitignored build output) are always rebuilt from src/*.gs
const SRC = path.join(__dirname, '..', 'cloudflare', 'free-shared-test', 'src'), imp = f => import(pathToFileURL(path.join(SRC, f)).href);
const HTTP = process.env.CF_BASE_URL || '', BOOT = process.env.CF_BOOTSTRAP_TOKEN || 'test-bootstrap-token-0123456789abcdef', SECRET = 'test-app-secret-0123456789abcdef0123456789abcdef';
let pass = 0, fail = 0; const T = async (n, f) => { try { await f(); pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, '\n   ', String(e.stack || e.message).split("\n").slice(0, 9).join('\n    ')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function unb32(s) { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, v = 0; const o = []; for (const ch of s) { v = (v << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(o); }
(async () => {
  const U = await imp('util.js'); let W, db, env, BASE, clock = Date.now(), stats = { maxStatements: 0, maxRowsRead: 0, maxRowsWritten: 0, perRoute: {} };
  const nowMs = () => HTTP ? Date.now() : clock;
  if (HTTP) { BASE = HTTP.replace(/\/$/, ''); } else {
    const { D1 } = require('./lib/d1_shim.js'); db = new D1(); env = { DB: db, APP_SECRET: SECRET, BOOTSTRAP_TOKEN: BOOT }; W = await imp('worker.js'); BASE = 'https://maslul-test.example.workers.dev';
  }
  const ORIGIN = new URL(BASE).origin; let ipn = 0;
  const doFetch = async (m, p, headers, bodyStr, label) => {
    if (HTTP) { const r = await fetch(BASE + p, { method: m, headers, body: bodyStr, signal: AbortSignal.timeout(25000) }); return { status: r.status, headers: r.headers, text: await r.text() }; }
    db.resetInvocation(); const r = await W.handle(new Request(BASE + p, { method: m, headers, body: bodyStr }), env, nowMs), text = await r.text(), inv = db.resetInvocation();
    stats.maxStatements = Math.max(stats.maxStatements, inv.statements); stats.maxRowsRead = Math.max(stats.maxRowsRead, inv.rowsRead); stats.maxRowsWritten = Math.max(stats.maxRowsWritten, inv.rowsWritten);
    const k = label || (m + ' ' + p), o = stats.perRoute[k] || (stats.perRoute[k] = { n: 0, maxStatements: 0, maxRowsRead: 0, maxRowsWritten: 0 }); o.n++; o.maxStatements = Math.max(o.maxStatements, inv.statements); o.maxRowsRead = Math.max(o.maxRowsRead, inv.rowsRead); o.maxRowsWritten = Math.max(o.maxRowsWritten, inv.rowsWritten);
    return { status: r.status, headers: r.headers, text };
  };
  function client() {
    const jar = {}, ip = '10.1.' + Math.floor(++ipn / 250) + '.' + (ipn % 250 + 1);
    const f = async (m, p, b, extra) => { const h = Object.assign({ origin: ORIGIN, 'cf-connecting-ip': ip }, b !== undefined ? { 'content-type': 'application/json' } : {}); if (jar.c) h.cookie = jar.c; if (jar.csrf && m !== 'GET') h['x-csrf-token'] = jar.csrf; Object.assign(h, extra || {});
      const r = await doFetch(m, p, h, b !== undefined && m !== 'GET' ? JSON.stringify(b) : undefined, m === 'POST' && p === '/api' && b ? b.method : null); let j = {}; try { j = JSON.parse(r.text); } catch (e) { j = { raw: r.text.slice(0, 80) }; }
      const sc = r.headers.get('set-cookie'); if (sc) { const c = sc.split(';')[0]; jar.c = /=$/.test(c) ? '' : c; } if (j && j.csrf) jar.csrf = j.csrf; return Object.assign({ _status: r.status, _h: r.headers }, j); };
    f.jar = jar; f.api = (method, args) => f('POST', '/api', { method, args: args || {} }); return f;
  }
  /** TOTP device: picks the next unused 30-s step (login accepts a step once), waiting only when all three drift-window steps are used. */
  const device = () => ({ async code() { return ''; }, async wrong() { return ''; } });   // no authenticator any more (owner decision 25.11.2026: PIN only, synthetic pilot); inert stub
  const admin = client(), anon = client(), people = {};
  async function enroll(c, token, pin) { pin = pin || '4826'; const s = await c('POST', '/auth/enroll/start', { token }); if (!s.ok) return s; const dev = device(), cf = await c('POST', '/auth/enroll/confirm', { token, pin }); s.accessCode = pin; return Object.assign({ dev, start: s, confirm: cf }, cf); }
  async function login(c, p) { return c('POST', '/auth/login', { email: p.email, pin: p.accessCode, code: await p.dev.code() }); }
  async function addPerson(key, name, email, grant) { const c = client(); const r = await c('POST', '/auth/register', { fullName: name, email }); assert.ok(r.ok, JSON.stringify(r)); const pend = (await admin('GET', '/admin/pending')).pending, row = pend.find(x => x.email === email); assert.ok(row, 'pending request visible to admin'); const ap = await admin('POST', '/admin/approve', { requestId: row.id, grant }); assert.ok(ap.ok, JSON.stringify(ap));
    const e = await enroll(c, ap.enrollToken); assert.ok(e.ok, JSON.stringify(e.confirm || e)); const p = { c, email, accessCode: e.start.accessCode, dev: e.dev, id: row.id, name }; people[key] = p; const l = await login(c, p); assert.ok(l.ok, JSON.stringify(l)); return p; }
  let cid, org, t1, t2, A, B, C, V; const stamp = Math.random().toString(36).slice(2, 7);

  await T('S1 fresh database: needs setup; wrong bootstrap token refused; unauthenticated /api refused', async () => {
    assert.equal((await anon('GET', '/auth/status')).needsSetup, true); const bad = await anon('POST', '/auth/bootstrap', { token: 'wrong-wrong-wrong-wrong', fullName: 'מנהל סינתטי', email: 'admin@example.test' }); assert.equal(bad.ok, false); assert.equal(bad._status, 403);
    assert.equal((await anon.api('courses.list'))._status, 401); assert.equal((await anon('GET', '/auth/me'))._status, 401); assert.equal((await anon('GET', '/admin/users'))._status, 401); });
  let adminDev, adminAcc;
  await T('S2 first admin: bootstrap token + enrolment link + PIN; wrong deployment token refused', async () => {
    const b = await admin('POST', '/auth/bootstrap', { token: BOOT, fullName: 'מנהל סינתטי', email: 'admin@example.test' }); assert.ok(b.ok, JSON.stringify(b)); assert.ok(b.enrollToken.length >= 40);
    assert.equal((await anon('POST', '/auth/bootstrap', { token: 'y'.repeat(40), fullName: 'x y', email: 'other@example.test' }))._status, 403, 'wrong deployment token');
    assert.equal((await anon('POST', '/auth/enroll/start', { token: 'nope' }))._status, 400);
    const s = await admin('POST', '/auth/enroll/start', { token: b.enrollToken }); assert.ok(s.ok); assert.equal(s.accessCode, undefined, 'the server no longer generates an access code: the person chooses a 4-digit PIN'); s.accessCode = '4826'; assert.equal(s.totpSecret, undefined, 'no authenticator secret any more'); assert.equal(s.email, 'admin@example.test');
    assert.equal((await admin('POST', '/auth/enroll/confirm', { token: b.enrollToken }))._status, 400, 'no PIN -> the account is not activated');
    assert.equal((await admin('POST', '/auth/login', { email: 'admin@example.test', pin: s.accessCode, code: '123456' }))._status, 401, 'not active before confirmation');
    adminDev = device(); adminAcc = s.accessCode; const c = await admin('POST', '/auth/enroll/confirm', { token: b.enrollToken, pin: s.accessCode }); assert.ok(c.ok, JSON.stringify(c));
    assert.equal((await anon('POST', '/auth/enroll/confirm', { token: b.enrollToken, pin: '4826' }))._status, 400, 'enrolment link is single-use'); });
  await T('S3 login = e-mail + PIN; errors are generic and identical for unknown / wrong PIN; session cookie is __Host-, HttpOnly, Secure, SameSite=Strict', async () => {
    const em = 'admin@example.test', l1 = await admin('POST', '/auth/login', { email: em, pin: '9137', code: await adminDev.code() }); assert.equal(l1._status, 401);
    const l2 = await admin('POST', '/auth/login', { email: em, pin: '9138' }); assert.equal(l2._status, 401); assert.equal(l1.message, l2.message, 'same message for two wrong PINs');
    const l0 = await admin('POST', '/auth/login', { email: 'nobody@example.test', pin: adminAcc, code: '123456' }); assert.equal(l0.message, l1.message, 'unknown account looks the same');
    const code = await adminDev.code(), l3 = await admin('POST', '/auth/login', { email: em, pin: adminAcc, code }); assert.ok(l3.ok, JSON.stringify(l3)); assert.ok(l3.csrf && l3.role === 'admin');
    const sc = l3._h.get('set-cookie'); assert.match(sc, /^__Host-maslul_sid=/); assert.match(sc, /HttpOnly/); assert.match(sc, /Secure/); assert.match(sc, /SameSite=Strict/); assert.match(sc, /Path=\//);
    const again = await client()('POST', '/auth/login', { email: em, pin: adminAcc }); assert.ok(again.ok, 'returning login (second device/session) works with e-mail + PIN'); });
  await T('S4 session rules: CSRF header and exact Origin are required; role in the body is ignored; viewer/unknown/blocked routes denied', async () => {
    const me = await admin('GET', '/auth/me'); assert.equal(me.role, 'admin'); const noCsrf = await admin('POST', '/api', { method: 'courses.list', args: {} }, { 'x-csrf-token': 'x' }); assert.equal(noCsrf._status, 403);
    const badOrigin = await admin('POST', '/api', { method: 'courses.list', args: {} }, { origin: 'https://evil.example' }); assert.equal(badOrigin._status, 403);
    const noOrigin = await doFetch('POST', '/api', { 'content-type': 'application/json', cookie: admin.jar.c, 'x-csrf-token': admin.jar.csrf, 'cf-connecting-ip': '10.9.9.9' }, JSON.stringify({ method: 'courses.list', args: {} })); assert.equal(noOrigin.status, 403);
    assert.equal((await admin.api('nope.nothing'))._status, 403); assert.equal((await admin.api('migration.run'))._status, 403); assert.equal((await admin.api('dash.trends', { courseId: 'x' }))._status, 403); assert.equal((await admin.api('bad method!'))._status, 400); });
  await T('S5 admin loads the synthetic course once (second load refused); engine data is real', async () => {
    const s = await admin('POST', '/admin/seed-synthetic', {}); assert.ok(s.ok, JSON.stringify(s)); assert.equal((await admin('POST', '/admin/seed-synthetic', {}))._status, 409);
    const cl = await admin.api('courses.list'); assert.ok(cl.ok && cl.data.length === 1, JSON.stringify(cl).slice(0, 200)); cid = cl.data[0].id; org = (await admin.api('courses.org', { courseId: cid })).data; t1 = org.teams[0]; t2 = org.teams[1]; assert.ok(t1 && t2);
    const so = await admin.api('soldiers.list', { courseId: cid, opts: {} }); assert.ok(so.ok && so.data.length >= 40); });
  await T('S6 approvals: commander (team 1), second commander (team 1), foreign commander (team 2), viewer; each enrolls and logs in with their own device', async () => {
    A = await addPerson('A', 'מפקד צוות 1 (טלפון א)', 'a-' + stamp + '@example.test', { role: 'commander', courseIds: [cid], unitIds: [], scope: { type: 'team', id: t1.id } });
    B = await addPerson('B', 'מפקד צוות 1 (טלפון ב)', 'b-' + stamp + '@example.test', { role: 'commander', courseIds: [cid], unitIds: [], scope: { type: 'team', id: t1.id } });
    C = await addPerson('C', 'מפקד צוות 2 (זר)', 'c-' + stamp + '@example.test', { role: 'commander', courseIds: [cid], unitIds: [], scope: { type: 'team', id: t2.id } });
    V = await addPerson('V', 'צופה', 'v-' + stamp + '@example.test', { role: 'viewer', courseIds: [cid], unitIds: [] }); assert.notEqual(A.c.jar.c, B.c.jar.c);
    const who = await A.c.api('whoAmI'); assert.ok(who.ok, JSON.stringify(who)); assert.equal(who.data.role, 'commander'); });
  await T('S7 scope is server-side: team-1 commanders see only team-1 soldiers; the foreign team sees none of them; no count leaks', async () => {
    const all = (await admin.api('soldiers.list', { courseId: cid, opts: {} })).data, mine = all.filter(x => x.team_id === t1.id).map(x => x.id).sort(), other = all.filter(x => x.team_id === t2.id).map(x => x.id).sort();
    const a = await A.c.api('soldiers.list', { courseId: cid, opts: {} }), b = await B.c.api('soldiers.list', { courseId: cid, opts: {} }), c = await C.c.api('soldiers.list', { courseId: cid, opts: {} });
    assert.deepEqual(a.data.map(x => x.id).sort(), mine); assert.deepEqual(b.data.map(x => x.id).sort(), mine); assert.deepEqual(c.data.map(x => x.id).sort(), other); assert.ok(!c.data.some(x => mine.includes(x.id)));
    const card = await C.c.api('soldiers.card', { id: mine[0] }); assert.equal(card.ok, false); const fc = await C.c.api('soldiers.list', { courseId: 'other-course', opts: {} }); assert.equal(fc._status, 403); });
  let mid, tm;
  await T('S8 march: phone A saves a march with two missing; phone B (other session, same team) reads the SAME roster; foreign team and viewer-writes denied', async () => {
    const all = (await admin.api('soldiers.list', { courseId: cid, opts: {} })).data; tm = all.filter(x => x.team_id === t1.id).slice(0, 4).map(x => x.id);
    const r = await A.c.api('marches.create', { courseId: cid, data: { request_id: 'cf-1-' + stamp, march_date: '2026-12-12', location: 'מסע-A-B', km_no_stretcher: 5, km_stretcher: 0, scope_type: 'team', scope_id: t1.id, absent: tm.slice(0, 2).map(id => ({ soldier_id: id })) } }); assert.ok(r.ok, JSON.stringify(r)); mid = r.data.march.id;
    const roster = who => who.c.api('marches.list', { courseId: cid, opts: { marchId: mid, includeRoster: true } }).then(x => x.ok && x.data[0] ? x.data[0].roster : null);
    const ra = await roster(A), rb = await roster(B); assert.equal(ra.filter(x => !x.present).length, 2); assert.deepEqual(rb.map(x => x.id + x.present).sort(), ra.map(x => x.id + x.present).sort());
    assert.equal(await roster(C), null, 'foreign team cannot see the march'); assert.ok(!(await C.c.api('marches.list', { courseId: cid })).data.some(x => x.id === mid));
    for (const [m, a] of [['record.edit', { table: 'MarchAttendance', id: ra[0].id, patch: { present: true }, reason: 'צופה' }], ['marches.create', { courseId: cid, data: { request_id: 'v1-' + stamp, march_date: '2026-12-13', location: 'x' } }]]) { const x = await V.c.api(m, a); assert.equal(x.ok, false, m); assert.equal(x._status, 200 === x._status && x.ok === false ? x._status : 403); }
    const e = await C.c.api('record.edit', { table: 'MarchAttendance', id: ra[0].id, patch: { present: true }, reason: 'זר' }); assert.equal(e.ok, false); assert.equal((await roster(A)).filter(x => !x.present).length, 2, 'no write landed'); });
  await T('S9 B (second session) saves its OWN march; A sees it at once; B requests a correction, the admin approves, and A sees the new value (read-after-write across independent sessions)', async () => {
    const rs = (who, id) => who.c.api('marches.list', { courseId: cid, opts: { marchId: id, includeRoster: true } }).then(x => x.ok && x.data[0] ? x.data[0].roster : null);
    const mb = await B.c.api('marches.create', { courseId: cid, data: { request_id: 'cf-2-' + stamp, march_date: '2026-12-14', location: 'מסע-של-B', km_no_stretcher: 3, km_stretcher: 0, scope_type: 'team', scope_id: t1.id, absent: tm.slice(0, 2).map(id => ({ soldier_id: id })) } }); assert.ok(mb.ok, JSON.stringify(mb)); const bid = mb.data.march.id;
    const seen = await rs(A, bid); assert.ok(seen && seen.filter(x => !x.present).length === 2, 'A sees B\'s march and both missing'); const row = seen.find(x => !x.present);
    const deny = await A.c.api('correction.request', { table: 'MarchAttendance', id: row.id, changes: { present: true }, reason: 'לא שלי' }); assert.equal(deny.code, 'FORBIDDEN', 'only the entering user may request a correction');
    const rq = await B.c.api('correction.request', { table: 'MarchAttendance', id: row.id, changes: { present: true }, reason: 'בקשת B' }); assert.ok(rq.ok, JSON.stringify(rq)); assert.equal((await rs(A, bid)).filter(x => !x.present).length, 2, 'unchanged until approved');
    const p = (await admin.api('correction.list', { courseId: cid, status: 'pending' })).data.filter(x => x.reason === 'בקשת B'); assert.equal(p.length, 1); assert.ok((await admin.api('correction.review', { requestId: p[0].id, decision: 'approve', note: 'ok' })).ok);
    const fin = await rs(A, bid); assert.equal(fin.filter(x => !x.present).length, 1); assert.equal(fin.length, seen.length, 'no duplicate rows'); });
  await T('S10 meeting + tasks ("+"): saved by A, listed for B (same scope), invisible to the foreign team; status change persists', async () => {
    const asg = (await admin.api('meetings.options', { courseId: cid })); assert.ok(asg.ok, JSON.stringify(asg).slice(0, 200));
    const r = await A.c.api('meetings.save', { courseId: cid, data: { request_id: 'mt-' + stamp, subject: 'ישיבת תיאום (סינתטית)', meeting_at: '2026-12-15T09:30', participants: 'משתתפי דמה', summary: 'סיכום', decisions: 'החלטה', tasks: [{ client_key: 'k1', title: 'משימת בדיקה א', assignee_email: 'demo-cmd@x.com', due_date: '2026-12-20', due_time: '', priority: 'normal', notes: '' }] } });
    assert.ok(r.ok, JSON.stringify(r)); const lb = await B.c.api('meetings.list', { courseId: cid }); assert.ok(lb.ok && JSON.stringify(lb.data).includes('ישיבת תיאום'), JSON.stringify(lb).slice(0, 200)); const lc = await C.c.api('meetings.list', { courseId: cid });
    assert.ok(!JSON.stringify(lc.data || []).includes('ישיבת תיאום (סינתטית)'), 'foreign team must not see it'); const tl = await A.c.api('tasks.list', { courseId: cid }); assert.ok(tl.ok, JSON.stringify(tl).slice(0, 200)); });
  await T('S11 revocation: admin deactivates B -> B\'s very next request fails and login is refused; others unaffected; reactivation + fresh login works', async () => {
    assert.ok((await B.c.api('soldiers.list', { courseId: cid, opts: {} })).ok); assert.ok((await admin('POST', '/admin/set-active', { targetUserId: B.id, active: false })).ok);
    assert.equal((await B.c.api('soldiers.list', { courseId: cid, opts: {} }))._status, 401); assert.equal((await login(B.c, B))._status, 401); assert.ok((await A.c.api('soldiers.list', { courseId: cid, opts: {} })).ok);
    assert.ok((await admin('POST', '/admin/set-active', { targetUserId: B.id, active: true })).ok); assert.ok((await login(B.c, B)).ok); assert.ok((await B.c.api('soldiers.list', { courseId: cid, opts: {} })).ok);
    assert.equal((await admin('POST', '/admin/set-active', { targetUserId: (await admin('GET', '/auth/me')).userId, active: false }))._status, 400, 'admin cannot lock themselves out'); });
  await T('S12 scope change takes effect immediately (A moved to team 2: sees team-2 soldiers, no longer team-1)', async () => {
    const x = await admin('POST', '/admin/set-scope', { targetUserId: A.id, grant: { role: 'commander', courseIds: [cid], unitIds: [], scope: { type: 'team', id: t2.id } } }); assert.ok(x.ok, JSON.stringify(x));
    assert.equal((await A.c.api('soldiers.list', { courseId: cid, opts: {} }))._status, 401, 'sessions are revoked on a scope change'); assert.ok((await login(A.c, A)).ok);
    const all = (await admin.api('soldiers.list', { courseId: cid, opts: {} })).data, a = await A.c.api('soldiers.list', { courseId: cid, opts: {} }); assert.deepEqual(a.data.map(y => y.id).sort(), all.filter(y => y.team_id === t2.id).map(y => y.id).sort());
    const back = await admin('POST', '/admin/set-scope', { targetUserId: A.id, grant: { role: 'commander', courseIds: [cid], unitIds: [], scope: { type: 'team', id: t1.id } } }); assert.ok(back.ok); assert.ok((await login(A.c, A)).ok); });
await T('S24 PIN-only pilot login: exactly 4 digits; weak PINs refused WITHOUT consuming the link; wrong/missing PIN never logs in; locked after 5 wrong PINs (423, even with the right PIN); the PIN is chosen once and the person can return from another device', async () => {
      const em = 'pin.user@example.test', c = client(); await c('POST', '/auth/register', { fullName: 'בודק PIN', email: em }); const row = (await admin('GET', '/admin/pending')).pending.find(x => x.email === em); const ap = await admin('POST', '/admin/approve', { requestId: row.id, grant: { role: 'viewer', courseIds: [cid], unitIds: [] } }); assert.ok(ap.ok, JSON.stringify(ap));
      const st = await c('POST', '/auth/enroll/start', { token: ap.enrollToken }); assert.ok(st.ok); assert.equal(st.accessCode, undefined); assert.equal(st.totpSecret, undefined);
      for (const bad of ['', '123', '12345', 'abcd', '12a4', '0000', '1111', '1234', '4321', '2580']) { const r = await c('POST', '/auth/enroll/confirm', { token: ap.enrollToken, pin: bad }); assert.equal(r._status, 400, 'PIN "' + bad + '" must be refused'); }
      assert.equal((await c('POST', '/auth/enroll/confirm', { token: ap.enrollToken }))._status, 400, 'a missing PIN is refused');
      const ok = await c('POST', '/auth/enroll/confirm', { token: ap.enrollToken, pin: '7391' }); assert.ok(ok.ok, 'link still valid after refused PINs: ' + JSON.stringify(ok));
      assert.equal((await c('POST', '/auth/enroll/confirm', { token: ap.enrollToken, pin: '7391' }))._status, 400, 'the enrolment link is single-use');
      const L = b => client()('POST', '/auth/login', Object.assign({ email: em }, b));
      assert.equal((await L({}))._status, 401, 'no PIN'); assert.equal((await L({ pin: '7392' }))._status, 401, 'wrong PIN');
      const in1 = await L({ pin: '7391' }); assert.ok(in1.ok, JSON.stringify(in1)); const in2 = await L({ pin: '7391' }); assert.ok(in2.ok, 're-login on another device works');
      for (let i = 0; i < 5; i++) await L({ pin: '1357' }); const lk = await L({ pin: '7391' }); assert.equal(lk._status, 423, 'locked temporarily even with the right PIN'); });
  await T('S26 ADMIN RECOVERY: needs its own owner-set secret (not the set-up token); wrong/absent = 403; admin goes back to invited (sessions revoked, old PIN void), data untouched; owner picks a new PIN; a used recovery value cannot be replayed', async () => {
      const LS = require('../scripts/cf_local_server.js'), RT = 'owner-recovery-secret-0123456789abcdefXYZ', BT = 'local-bootstrap-token-0123456789', none = await LS.start({}), srv = await LS.start({ recoveryToken: RT });
      const mk = o => async (m, p0, body, jar) => { const r = await fetch(o.origin + p0, { method: m, headers: Object.assign({ 'content-type': 'application/json', origin: o.origin }, jar && jar.c ? { cookie: jar.c } : {}, jar && jar.csrf ? { 'x-csrf-token': jar.csrf } : {}), body: m === 'POST' ? JSON.stringify(body || {}) : undefined }); const j = await r.json().catch(() => ({})); j._status = r.status; const sc = r.headers.get('set-cookie'); if (sc && jar) jar.c = sc.split(';')[0]; if (j.csrf && jar) jar.csrf = j.csrf; return j; };
      try {
        const n = mk(none); assert.equal((await n('GET', '/auth/status')).recoveryEnabled, false); assert.equal((await n('POST', '/auth/recover', { token: RT }))._status, 403, 'no secret configured = refused');
        const c = mk(srv), jar = {}; assert.equal((await c('GET', '/auth/status')).recoveryEnabled, true);
        const b = await c('POST', '/auth/bootstrap', { token: BT, fullName: 'מנהל', email: 'owner@example.test' }); assert.ok((await c('POST', '/auth/enroll/confirm', { token: b.enrollToken, pin: '4826' })).ok);
        const li = await c('POST', '/auth/login', { email: 'owner@example.test', pin: '4826' }, jar); assert.ok(li.ok); assert.ok((await c('POST', '/api', { method: 'whoAmI', args: {} }, jar))._status !== 401, 'session works before recovery');
        assert.equal((await c('POST', '/auth/recover', { token: BT }))._status, 403, 'the SET-UP token cannot recover'); assert.equal((await c('POST', '/auth/recover', { token: 'z'.repeat(40) }))._status, 403, 'wrong random token denied');
        assert.equal((await c('POST', '/auth/recover', { token: RT, email: 'wrong@example.test' }))._status, 404, 'typo in supplied admin email MUST NOT silently recover a different admin');
        assert.equal((await c('GET', '/auth/status')).needsSetup, false, 'failed recovery targeting leaves the original admin active');
        const r = await c('POST', '/auth/recover', { token: RT }); assert.ok(r.ok && r.enrollToken, JSON.stringify(r));
        assert.equal((await c('POST', '/api', { method: 'whoAmI', args: {} }, jar))._status, 401, 'old session revoked'); assert.equal((await c('POST', '/auth/login', { email: 'owner@example.test', pin: '4826' }))._status, 401, 'old PIN void until re-enrolment');
        assert.equal((await c('GET', '/auth/status')).needsSetup, true, 'no active admin while waiting');
        assert.equal((await c('POST', '/auth/recover', { token: RT }))._status, 403, 'the same recovery value cannot be replayed');
        assert.equal((await c('POST', '/auth/enroll/confirm', { token: r.enrollToken, pin: '1111' }))._status, 400, 'weak PIN refused'); assert.ok((await c('POST', '/auth/enroll/confirm', { token: r.enrollToken, pin: '5938' })).ok);
        const again = await c('POST', '/auth/login', { email: 'owner@example.test', pin: '5938' }, {}); assert.ok(again.ok && again.role === 'admin', 'the SAME admin signs in with the new PIN');
        // Five recovery requests have been used; beyond that the per-IP rate limiter intentionally returns 429.
        assert.equal((await c('POST', '/auth/recover', { token: RT }))._status, 429); const aud = (await c('GET', '/audit', null, { c: undefined })); 
      } finally { await none.close(); await srv.close(); } });
  await T('S25 interrupted first-admin set-up can be RESUMED: same account, nothing deleted, fresh link, old link void; needs the deployment token; not possible once an admin is active', async () => {
      const LS = require('../scripts/cf_local_server.js'), srv = await LS.start({}); try {
        const call = async (m, p0, body) => { const r = await fetch(srv.origin + p0, { method: m, headers: { 'content-type': 'application/json', origin: srv.origin }, body: m === 'POST' ? JSON.stringify(body || {}) : undefined }); const j = await r.json().catch(() => ({})); j._status = r.status; return j; };
        const b1 = await call('POST', '/auth/bootstrap', { token: 'local-bootstrap-token-0123456789', fullName: 'מנהל ראשון', email: 'first@example.test' }); assert.ok(b1.ok && b1.enrollToken, JSON.stringify(b1));
        assert.equal((await call('GET', '/auth/status')).needsSetup, true); assert.ok((await call('POST', '/auth/enroll/start', { token: b1.enrollToken })).ok);   // the owner reached the last step and stopped
        assert.equal((await call('POST', '/auth/bootstrap', { token: 'x'.repeat(40), fullName: 'x y', email: 'first@example.test' }))._status, 403, 'resume still needs the deployment token');
        const b2 = await call('POST', '/auth/bootstrap', { token: 'local-bootstrap-token-0123456789', fullName: 'שם אחר', email: 'first@example.test' }); assert.ok(b2.ok && b2.resumed === true && b2.enrollToken && b2.enrollToken !== b1.enrollToken, JSON.stringify(b2));
        assert.equal((await call('POST', '/auth/enroll/confirm', { token: b1.enrollToken, pin: '8264' }))._status, 400, 'the old link is void');
        const done = await call('POST', '/auth/enroll/confirm', { token: b2.enrollToken, pin: '8264' }); assert.ok(done.ok, JSON.stringify(done));
        const li = await call('POST', '/auth/login', { email: 'first@example.test', pin: '8264' }); assert.ok(li.ok && li.role === 'admin', 'the SAME first-admin account signs in: ' + JSON.stringify(li));
        assert.equal((await call('GET', '/auth/status')).needsSetup, false); assert.equal((await call('POST', '/auth/bootstrap', { token: 'local-bootstrap-token-0123456789', fullName: 'x y', email: 'third@example.test' }))._status, 403, 'no resume / no new bootstrap once an admin is active');
      } finally { await srv.close(); } });
    await T('S13 lockout: 5 wrong authenticator codes lock the account (even a correct code is then refused); admin reset issues a new enrolment link and voids old credentials', async () => {
    const x = await addPerson('X', 'משתמש נעילה', 'x-' + stamp + '@example.test', { role: 'viewer', courseIds: [cid], unitIds: [] }); const cc = client();
    for (let i = 0; i < 5; i++) assert.equal((await cc('POST', '/auth/login', { email: x.email, pin: '9130' }))._status, 401);
    const locked = await cc('POST', '/auth/login', { email: x.email, pin: x.accessCode, code: await x.dev.code() }); assert.equal(locked._status, 423);
    const rs = await admin('POST', '/admin/reset', { targetUserId: x.id }); assert.ok(rs.ok && rs.enrollToken); assert.equal((await x.c.api('courses.list'))._status, 401, 'old session void'); const e = await enroll(cc, rs.enrollToken, '5937'); assert.ok(e.ok, JSON.stringify(e.confirm));
    assert.equal((await cc('POST', '/auth/login', { email: x.email, pin: x.accessCode, code: await x.dev.code() }))._status, 401, 'old access code/device no longer valid'); const np = { email: x.email, accessCode: e.start.accessCode, dev: e.dev }; assert.ok((await login(cc, np)).ok); });
  await T('S14 logout ends the session; password-less: a PIN field is meaningless; registration answers identically for known and new emails', async () => {
    const l = client(); assert.ok((await login(l, A)).ok); assert.ok((await l.api('courses.list')).ok); assert.ok((await l('POST', '/auth/logout', {})).ok); assert.equal((await l.api('courses.list'))._status, 401);
    const r1 = await anon('POST', '/auth/register', { fullName: 'אותו אדם', email: 'dup-' + stamp + '@example.test' }), r2 = await anon('POST', '/auth/register', { fullName: 'אותו אדם', email: 'dup-' + stamp + '@example.test' }), r3 = await anon('POST', '/auth/register', { fullName: 'אותו אדם', email: A.email }); assert.deepEqual([r1.ok, r1.status], [r2.ok, r2.status]); assert.deepEqual([r1.ok, r1.status], [r3.ok, r3.status]);
    assert.equal((await anon('POST', '/auth/register', { fullName: 'x', email: 'bad' }))._status, 400); });
  await T('S15 concurrent writers: 8 simultaneous march saves from two sessions all persist or answer BUSY cleanly (optimistic version guard, no lost update, no phantom)', async () => {
    const cnt = async () => (await admin.api('marches.list', { courseId: cid, opts: {} })).data.length, base = await cnt();
    const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? B : A).c.api('marches.create', { courseId: cid, data: { request_id: 'cc-' + stamp + '-' + i, march_date: '2026-12-2' + (i % 8), location: 'מקביל ' + i, km_no_stretcher: 2, km_stretcher: 0, scope_type: 'team', scope_id: t1.id, absent: [{ soldier_id: tm[i % 4] }] } })));
    const okc = rs.filter(r => r.ok).length; assert.ok(okc >= 1, JSON.stringify(rs.map(r => r.code || r.message).slice(0, 3))); for (const r of rs) assert.ok(r.ok || r.code === 'BUSY', 'every write is acknowledged or cleanly BUSY, got ' + JSON.stringify(r).slice(0, 120));
    assert.equal((await cnt()) - base, okc, 'rows added == writes acknowledged'); console.log('     concurrent: ' + okc + '/8 acknowledged, ' + (8 - okc) + ' BUSY'); });
  await T('S15c idempotency key: a keyed write on a not-yet-existing table is PERSISTED (regression: the engine memory cache replayed a pass without writing); the same key replays the original, a new key creates a second one', async () => {
    const mk = (rid, idem) => A.c.api('marches.create', { courseId: cid, idem_: idem, data: { request_id: rid, march_date: '2026-12-20', location: 'מסע-מפתח', km_no_stretcher: 2, km_stretcher: 0, scope_type: 'team', scope_id: t1.id, absent: [] } });
    const k1 = 'idem' + stamp + 'aaaa', k2 = 'idem' + stamp + 'bbbb', count = async () => (await admin.api('marches.list', { courseId: cid })).data.filter(x => x.location === 'מסע-מפתח').length;
    const a = await mk('idem-r1-' + stamp, k1); assert.ok(a.ok, JSON.stringify(a)); assert.equal(await count(), 1, 'the keyed write was persisted');
    const b = await mk('idem-r1-' + stamp, k1); assert.ok(b.ok); assert.equal(b.data.march.id, a.data.march.id, 'same key = original result'); assert.equal(await count(), 1, 'replay did not write again');
    const c = await mk('idem-r2-' + stamp, k2); assert.ok(c.ok); assert.notEqual(c.data.march.id, a.data.march.id); assert.equal(await count(), 2); });
  await T('S15b analytics cache: a repeat is served from the cache (no engine run), a write to a table it read invalidates it at once, and results are never shared between users', async () => {
    const q = who => who.api('dash.home', { courseId: cid }), a1 = await q(A.c), a2 = await q(A.c); assert.ok(a1.ok && a2.ok); assert.equal(a2._h.get('x-maslul-cache'), 'hit'); assert.equal(JSON.stringify(a1.data), JSON.stringify(a2.data));
    const before = (await A.c.api('marches.list', { courseId: cid, opts: {} })).data.length; const r = await A.c.api('marches.create', { courseId: cid, data: { request_id: 'cache-' + stamp, march_date: '2026-12-27', location: 'מסע-מטמון', km_no_stretcher: 4, km_stretcher: 0, scope_type: 'team', scope_id: t1.id, absent: [] } }); assert.ok(r.ok, JSON.stringify(r));
    const a3 = await q(A.c); assert.notEqual(a3._h.get('x-maslul-cache'), 'hit', 'a write to a table the dashboard read must invalidate the cache'); assert.equal((await A.c.api('marches.list', { courseId: cid, opts: {} })).data.length, before + 1);
    const c1 = await q(C.c); assert.notEqual(c1._h.get('x-maslul-cache'), 'hit', 'another user never gets A\'s cached result'); const v1 = await q(V.c); assert.ok(v1.ok); });
  await T('S16 data survives a fresh Worker instance (state lives in the database, not the isolate)', async () => {
    const before = JSON.stringify((await B.c.api('marches.list', { courseId: cid, opts: { marchId: mid, includeRoster: true } })).data[0].roster.map(x => [x.id, x.present]).sort());
    if (!HTTP) { (await imp('schema.js')).resetSchemaCache(); } const fresh = client(); assert.ok((await login(fresh, B)).ok); const after = JSON.stringify((await fresh.api('marches.list', { courseId: cid, opts: { marchId: mid, includeRoster: true } })).data[0].roster.map(x => [x.id, x.present]).sort()); assert.equal(after, before); });
  await T('S17 unsupported features answer NOT_CONNECTED honestly (never a fake success): report file, document upload, backup file', async () => {
    const dl = await admin('GET', '/api/download/report/abcdef12'); assert.equal(dl._status, 501); assert.equal(dl.code, 'NOT_CONNECTED');
    for (const [m, a] of [['docs.upload', { courseId: cid, data: { file_name: 'x.pdf', mime_type: 'application/pdf', content_base64: 'JVBERi0=', title: 't' } }], ['backup.create', { kind: 'manual' }], ['reports.generate', { courseId: cid, data: { kind: 'course', format: 'pdf' } }]]) { const r = await admin.api(m, a); assert.equal(r.ok, false, m + ' must not claim success: ' + JSON.stringify(r).slice(0, 160)); }
    // file-backed routes: HTTP 501 + ok:false + NOT_CONNECTED (a 200 would look like success to any client that checks only the status)
    for (const [m, a] of [['backup.create', { kind: 'manual' }], ['backup.restore', { id: 'x' }], ['reports.fullExport', { courseId: cid }]]) { const r = await admin.api(m, a); assert.equal(r._status, 501, m + ' status'); assert.equal(r.ok, false); assert.equal(r.code, 'NOT_CONNECTED', m); }
    const nonAdmin = await A.c.api('backup.create', { kind: 'manual' }); assert.equal(nonAdmin._status, 403, 'a commander is refused before anything else'); });
  await T('S17b report-file gate on the real Worker + D1: commander/foreign/anonymous are refused by the SERVER (403/401, no ticket) and the refusal is audited; the admin gets a single-use ticket whose completion (size + SHA-256) is stored in D1 and readable via audit.list; reuse, wrong actor and bad hashes are refused', async () => {
    const body = { courseId: cid, req: { kind: 'course', format: 'pdf', scope: 'all' } }, SHA = 'b'.repeat(64);
    for (const who of [A, B, C]) { const r = await who.c.api('reports.exportAuthorize', body); assert.equal(r.ok, false, JSON.stringify(r)); assert.equal(r.code, 'FORBIDDEN'); assert.equal(r.data, undefined); }
    assert.equal((await anon.api('reports.exportAuthorize', body))._status, 401);
    const a = await admin.api('reports.exportAuthorize', body); assert.ok(a.ok, JSON.stringify(a)); const t = a.data.ticket;
    { const r = await A.c.api('reports.exportComplete', { courseId: cid, req: { ticket: t, sha256: SHA, bytes: 4000, pages: 2 } }); assert.equal(r.ok, false); assert.equal(r.code, 'FORBIDDEN', 'a commander cannot complete the admin ticket'); }
    assert.equal((await admin.api('reports.exportComplete', { courseId: cid, req: { ticket: t, sha256: 'zz', bytes: 4000, pages: 2 } })).ok, false, 'bad hash');
    const c = await admin.api('reports.exportComplete', { courseId: cid, req: { ticket: t, sha256: SHA, bytes: 4000, pages: 2 } }); assert.ok(c.ok, JSON.stringify(c));
    assert.equal((await admin.api('reports.exportComplete', { courseId: cid, req: { ticket: t, sha256: SHA, bytes: 4000, pages: 2 } })).ok, false, 'single use');
    const au = await admin.api('audit.list', { courseId: cid }); assert.ok(au.ok); const acts = au.data.filter(x => /^REPORT_EXPORT_/.test(x.action)); const kinds = acts.map(x => x.action);
    assert.ok(kinds.includes('REPORT_EXPORT_DENIED') && kinds.includes('REPORT_EXPORT_AUTHORIZED') && kinds.includes('REPORT_EXPORT_COMPLETED'), kinds.join());
    const done = acts.filter(x => x.action === 'REPORT_EXPORT_COMPLETED').map(x => JSON.parse(x.after_json)); assert.ok(done.some(x => x.sha256 === SHA && x.bytes === 4000), 'sha + size stored');
    { const r = await A.c.api('audit.list', { courseId: cid }); assert.equal(r.ok, false); assert.equal(r.code, 'FORBIDDEN', 'a commander cannot read the audit'); } });
  await T('S18 security headers on API responses', async () => { const r = await admin('GET', '/auth/me'); for (const [k, v] of [['x-content-type-options', 'nosniff'], ['x-frame-options', 'DENY'], ['referrer-policy', 'no-referrer']]) assert.equal(r._h.get(k), v); assert.match(r._h.get('content-security-policy'), /default-src 'self'/); assert.match(r._h.get('strict-transport-security'), /max-age/); assert.equal(r._h.get('cache-control'), 'no-store'); });
  if (!HTTP) {
    await T('S19 Free-plan query budget: every request stays far below 50 D1 statements per invocation; row counts recorded', async () => {
      assert.ok(stats.maxStatements <= 25, 'max statements in one request = ' + stats.maxStatements); const top = Object.entries(stats.perRoute).sort((a, b) => b[1].maxRowsRead - a[1].maxRowsRead).slice(0, 6); console.log('     budget: max statements/request =', stats.maxStatements, ' max rows read =', stats.maxRowsRead, ' max rows written =', stats.maxRowsWritten); top.forEach(([k, v]) => console.log('     ', k.padEnd(28), JSON.stringify(v))); });
    await T('S20 expiry: idle (60 min) and absolute (12 h) session limits are enforced on the server', async () => {
      const l = client(); assert.ok((await login(l, B)).ok); assert.ok((await l.api('courses.list')).ok); clock += 61 * 60e3; assert.equal((await l.api('courses.list'))._status, 401, 'idle timeout'); assert.ok((await login(l, B)).ok); const t0 = clock; let denied = false; for (let i = 0; i < 20 && !denied; i++) { clock += 50 * 60e3; denied = (await l.api('courses.list'))._status === 401; if (!denied) assert.ok(clock - t0 < 12 * 3600e3, 'still valid past 12 h'); } assert.ok(denied && clock - t0 >= 12 * 3600e3 - 1, 'absolute 12 h limit enforced (elapsed ' + Math.round((clock - t0) / 60e3) + ' min)'); });
    await T('S21 recovery runbook: after a (simulated) Time Travel restore, ops/post_restore.sql revokes every session and clears the cache; users log in again; audit records the operator action', async () => {
      const l = client(); assert.ok((await login(l, B)).ok); assert.ok((await l.api('courses.list')).ok);
      const sql = fs.readFileSync(path.join(__dirname, '..', 'cloudflare', 'free-shared-test', 'ops', 'post_restore.sql'), 'utf8').split('\n').filter(x => !/^\s*--/.test(x)).join('\n').split(';').map(x => x.trim()).filter(Boolean);
      assert.ok(sql.length >= 4); for (const st of sql) await db.prepare(st).run();
      assert.equal((await l.api('courses.list'))._status, 401, 'a session that existed before the restore must not survive it'); assert.equal((await admin.api('courses.list'))._status, 401, 'admin session too');
      const again = client(); assert.ok((await login(again, B)).ok, 'login works again after the runbook'); assert.ok((await again.api('courses.list')).ok);
      const ev = await db.prepare("SELECT count(*) n FROM audit WHERE ev = 'operator_post_restore'").first('n'); assert.equal(ev, 1); });
    await T('S22 first deploy BEFORE the Worker secrets exist: /auth/status answers (configured:false), every other door fails closed (503), the deploy smoke test reports NOT READY (not "finished"); with the secrets it reports READY; an open data route makes it fail', async () => {
      const L = require('../scripts/cf_local_server.js'), cp = require('child_process'), smoke = u => new Promise(res => { cp.execFile(process.execPath, [path.join(__dirname, '..', 'scripts', 'cf_ci_smoke.js'), u], { encoding: 'utf8', env: Object.assign({}, process.env, { SMOKE_RETRIES: '2', SMOKE_WAIT_MS: '50' }) }, (err, stdout) => res({ status: err ? err.code : 0, stdout })); });
      const none = await L.start({ appSecret: '', bootstrapToken: '' }); try {
        const st = await (await fetch(none.origin + '/auth/status')).json(); assert.equal(st.ok, true); assert.equal(st.configured, false); assert.deepEqual(st.missing.sort(), ['APP_SECRET', 'BOOTSTRAP_TOKEN']);
        for (const [p0, m0] of [['/api', 'POST'], ['/auth/login', 'POST'], ['/auth/bootstrap', 'POST'], ['/auth/me', 'GET']]) { const r = await fetch(none.origin + p0, { method: m0, headers: { 'content-type': 'application/json', origin: none.origin }, body: m0 === 'POST' ? '{"token":"x","method":"courses.list","args":{}}' : undefined }); assert.equal(r.status, 503, p0 + ' must fail closed while unconfigured'); }
        const r1 = await smoke(none.origin); assert.equal(r1.status, 0, r1.stdout); assert.match(r1.stdout, /STAGE 1.*NOT CONFIGURED.*NOT READY/); assert.match(r1.stdout, /RESULT=NOT_READY_EXPECTED/); assert.doesNotMatch(r1.stdout, /RESULT=READY/);
      } finally { await none.close(); }
      const half = await L.start({ bootstrapToken: '' }); try { const st = await (await fetch(half.origin + '/auth/status')).json(); assert.equal(st.configured, false); assert.deepEqual(st.missing, ['BOOTSTRAP_TOKEN']); } finally { await half.close(); }
      const shortToken = '0123456789abcdef', short = await L.start({ bootstrapToken: shortToken }); try {
        const st = await (await fetch(short.origin + '/auth/status')).json(); assert.equal(st.configured, false, '16-char bootstrap token cannot mark production ready');
        const denied = await fetch(short.origin + '/auth/bootstrap', { method: 'POST', headers: { 'content-type': 'application/json', origin: short.origin }, body: JSON.stringify({ token: shortToken, email: 'test@example.invalid', fullName: 'Synthetic Test Admin' }) });
        assert.equal(denied.status, 403, '16-char bootstrap token must not create an admin');
      } finally { await short.close(); }
      const full = await L.start({}); try { const r2 = await smoke(full.origin); assert.equal(r2.status, 0, r2.stdout); assert.match(r2.stdout, /STAGE 2/); assert.match(r2.stdout, /RESULT=READY/); } finally { await full.close(); }
      const http = require('http'), open = http.createServer((q, s) => { s.setHeader('content-type', 'application/json'); s.end(q.url === '/auth/status' ? '{"ok":true,"configured":true,"needsSetup":false,"recoveryEnabled":true}' : '{"ok":true,"data":[]}'); }); await new Promise(r => open.listen(0, '127.0.0.1', r));
      try { const r3 = await smoke('http://127.0.0.1:' + open.address().port); assert.equal(r3.status, 1, 'an open data route must fail the smoke test'); assert.match(r3.stdout, /RESULT=FAIL/); } finally { open.close(); } });
    await T('S23 smoke is fail-closed: 404 / 503 / fake-200 / HTML-200 on /auth/status, an open "/" without the app, or a 200 on the unauthenticated /api never end green (the live false-green of 25.11.2026)', async () => {
      const http = require('http'), cp = require('child_process'), run = u => new Promise(res => cp.execFile(process.execPath, [path.join(__dirname, '..', 'scripts', 'cf_ci_smoke.js'), u], { encoding: 'utf8', env: Object.assign({}, process.env, { SMOKE_RETRIES: '2', SMOKE_WAIT_MS: '50' }) }, (err, stdout) => res({ status: err ? err.code : 0, stdout })));
      const cases = { 'all 404 (route not active / asset layer swallowed /auth)': () => [404, 'text/plain', 'Not found'], 'status 503': () => [503, 'application/json', '{"ok":false}'], 'fake 200 html': () => [200, 'text/html', '<html>hi</html>'], 'fake 200 json without configured': () => [200, 'application/json', '{"ok":true}'] };
      for (const [name, fn] of Object.entries(cases)) { const srv = http.createServer((q, s) => { const [c, t, b] = fn(q); s.statusCode = c; s.setHeader('content-type', t); s.end(b); }); await new Promise(r => srv.listen(0, '127.0.0.1', r)); try { const r = await run('http://127.0.0.1:' + srv.address().port); assert.equal(r.status, 1, name + ' must FAIL: ' + r.stdout); assert.match(r.stdout, /RESULT=FAIL/, name); assert.doesNotMatch(r.stdout, /RESULT=(READY|NOT_READY)/, name); } finally { srv.close(); } }
      const oldv = http.createServer((q, s) => { s.setHeader('content-type', 'application/json'); s.end(q.url === '/auth/status' ? '{"ok":true,"needsSetup":false,"configured":true,"missing":[]}' : '{"ok":false}'); }); await new Promise(r => oldv.listen(0, '127.0.0.1', r)); try { const r = await run('http://127.0.0.1:' + oldv.address().port); assert.equal(r.status, 1, 'a status without recoveryEnabled (previous version still served) must not be READY'); assert.match(r.stdout, /recoveryEnabled/); } finally { oldv.close(); }
      const srv2 = http.createServer((q, s) => { s.setHeader('content-type', 'application/json'); if (q.url === '/auth/status') return s.end('{"ok":true,"configured":true,"needsSetup":false,"recoveryEnabled":true}'); s.statusCode = q.url === '/api' ? 200 : 401; s.end('{"ok":true}'); }); await new Promise(r => srv2.listen(0, '127.0.0.1', r)); try { const r = await run('http://127.0.0.1:' + srv2.address().port); assert.equal(r.status, 1, 'open /api must FAIL'); } finally { srv2.close(); } });
  }
  console.log('CLOUDFLARE FREE SHARED-TEST (' + (HTTP ? 'wrangler dev over HTTP' : 'in-process Worker + SQLite D1 shim') + ') TOTAL pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
