'use strict';
// CPU feasibility probe for the Workers FREE plan (10 ms CPU per request). Runs the REAL Worker code on synthetic data and reports, per scenario:
//   cold = FIRST call in a fresh process (V8 not yet optimised: the worst case, like the first request on a new isolate), warm = median of 25 repeats.
// "Worker-JS CPU" = process CPU time of the request minus the time spent inside the SQLite shim (D1 executes remotely on Cloudflare and is not billed to the Worker).
// LIMITS OF THIS PROBE (stated, not hidden): Node on this machine is a PROXY for workerd on Cloudflare hardware; the 10 ms limit is enforced only on Cloudflare. A real measurement needs a Cloudflare account (NOT_RUN).
const fs = require('fs'), path = require('path'), { boot } = require('./lib/cf_harness.js');
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
(async () => {
  const h = await boot(), A = h.admin, cid = (await A.api('courses.list')).data[0].id, org = (await A.api('courses.org', { courseId: cid })).data, sol = (await A.api('soldiers.list', { courseId: cid, opts: {} })).data;
  const t1 = org.teams[0], tm = sol.filter(x => x.team_id === t1.id).slice(0, 3).map(x => x.id); let n = 0;
  const scen = [['login (access code + TOTP, session create)', async () => { const c = h.client(); const e = await A('POST', '/auth/register', { fullName: 'בדיקה ' + (++n), email: 'bench' + n + '@example.test' }); void e; return null; }],
    ['GET /auth/me (session check)', () => A('GET', '/auth/me')], ['soldiers.list (60 rows)', () => A.api('soldiers.list', { courseId: cid, opts: {} })], ['courses.org', () => A.api('courses.org', { courseId: cid })],
    ['marches.list', () => A.api('marches.list', { courseId: cid, opts: {} })], ['marches.create (write, roster saved)', () => A.api('marches.create', { courseId: cid, data: { request_id: 'b' + (++n) + 'x' + Math.random().toString(36).slice(2, 8), march_date: '2026-12-1' + (++n % 9), location: 'בנצ׳מרק', km_no_stretcher: 4, km_stretcher: 0, scope_type: 'team', scope_id: t1.id, absent: tm.slice(0, 2).map(id => ({ soldier_id: id })) } })],
    ['meetings.save with a task (write)', () => A.api('meetings.save', { courseId: cid, data: { request_id: 'm' + (++n) + 'x' + Math.random().toString(36).slice(2, 8), subject: 'ישיבה ' + (++n), meeting_at: '2026-12-15T09:30', participants: 'x', summary: 's', decisions: 'd', tasks: [{ client_key: 'k' + n, title: 'משימה', assignee_email: 'demo-cmd@x.com', due_date: '2026-12-20', due_time: '', priority: 'normal', notes: '' }] } })],
    ['tasks.list', () => A.api('tasks.list', { courseId: cid })], ['attendance.summary', () => A.api('attendance.summary', { courseId: cid, opts: {} })], ['dash.home (analytics, cache MISS each time: args vary)', () => A.api('dash.home', { courseId: cid, opts: { _n: ++n } })], ['soldiers.card', () => A.api('soldiers.card', { id: sol[n++ % 10].id })], ['reports.preview', () => A.api('reports.preview', { courseId: cid, data: { _n: ++n } })]];
  const rows = [];
  for (const [name, fn] of scen) {
    if (name.startsWith('login')) { // real login path: register -> approve -> enrol -> login
      const c = h.client(), em = 'lg' + (++n) + '@example.test'; await c('POST', '/auth/register', { fullName: 'מנהל ' + n, email: em }); const pend = (await A('GET', '/admin/pending')).pending.find(x => x.email === em);
      const ap = await A('POST', '/admin/approve', { requestId: pend.id, grant: { role: 'viewer', courseIds: [cid], unitIds: [] } }), st = await c('POST', '/auth/enroll/start', { token: ap.enrollToken }), sec = h.unb32(st.totpSecret);
      await c('POST', '/auth/enroll/confirm', { token: ap.enrollToken, pin: '4826', code: await h.U.hotp(sec, Math.floor(h.clock() / 30000)) });
      const body = { email: em, pin: '4826', code: await h.code(sec) }; await c('POST', '/auth/login', body); const cold = c.last.workerCpuMs; const warm = [];
      for (let i = 0; i < 6; i++) { const c2 = h.client(); await c2('POST', '/auth/login', { email: em, pin: '4826', code: await h.code(sec) }); warm.push(c2.last.workerCpuMs); }
      rows.push({ name, cold: cold, warm: med(warm), st: c.last.statements }); continue;
    }
    const r0 = await fn(); const cold = A.last.workerCpuMs, ws = []; let last, ok = !!(r0 && r0.ok); for (let i = 0; i < 25; i++) { const r = await fn(); ok = ok && !!(r && r.ok); ws.push(A.last.workerCpuMs); last = A.last; } if (!ok) console.log('WARNING: ' + name + ' did not return ok:true — its numbers are for an error path: ' + JSON.stringify(r0).slice(0, 120)); rows.push({ name, ok, cold, warm: med(ws), p95: ws.slice().sort((a, b) => a - b)[Math.floor(ws.length * 0.95)], st: last.statements, rr: last.rowsRead, rw: last.rowsWritten });
  }
  const f = x => x == null ? '' : x.toFixed(2);
  console.log('scenario'.padEnd(58), 'cold ms', 'warm ms', 'p95 ms', 'D1 stmts', 'rows read/written'); rows.forEach(r => console.log(r.name.padEnd(58), f(r.cold).padStart(7), f(r.warm).padStart(7), f(r.p95).padStart(6), String(r.st).padStart(8), (r.rr != null ? r.rr + '/' + r.rw : '')));
  const over = rows.filter(r => r.warm > 5); console.log('\nstartup (module import + engine compile):', h.startupMs.toFixed(0), 'ms (limit 1000 ms)'); console.log('warm scenarios above 5 ms (half the limit):', over.map(r => r.name).join('; ') || 'none');
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'evidence_cf_cpu_bench.json'), JSON.stringify({ note: 'Node proxy, synthetic data; Cloudflare enforcement NOT_RUN', startupMs: Math.round(h.startupMs), rows }, null, 1));
})().catch(e => { console.error(e); process.exit(2); });
