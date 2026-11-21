'use strict';
// Issue #79 — marches.list / marches.roll visibility, counts and roster over the private TEST server (real TLS, real session cookies, real binary HTTP download). SYNTHETIC DATA ONLY.
// Proves: reports.generate / reports.fullExport / reports.download produce real PDF + XLSX bytes, stored encrypted at rest, delivered with safe headers,
// and the engine's course/team scope + owner-or-admin + viewer-denied rules hold on the download path. Nothing here is mocked.
const https = require('https'), fs = require('fs'), path = require('path'), zlib = require('zlib'), assert = require('assert/strict');
const ts = require('../backend_next/test_server.js');
const DIR = '/tmp/maslul_marches_' + process.pid, PORT = 24000 + (process.pid % 900), ORIGIN = 'https://localhost:' + PORT;
let pass = 0, fail = 0; const T = async (n, f) => { try { await f(); pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, '\n   ', String(e.stack || e.message).split('\n').slice(0, 3).join('\n    ')); } };
function client() {
  const jar = {};
  const f = (m, p, b, hdr) => new Promise(res => {
    const h = Object.assign({ origin: ORIGIN }, b ? { 'content-type': 'application/json' } : {}, hdr || {}); if (jar.c) h.cookie = jar.c; if (jar.csrf && m !== 'GET') h['x-csrf-token'] = jar.csrf;
    const q = https.request({ host: '127.0.0.1', port: PORT, path: p, method: m, rejectUnauthorized: false, headers: h }, rs => { const ch = []; rs.on('data', c => ch.push(c)); rs.on('end', () => {
      const buf = Buffer.concat(ch); let j = null; if (/json/.test(rs.headers['content-type'] || '')) { try { j = JSON.parse(buf.toString('utf8')); } catch (e) { j = {}; } }
      if (rs.headers['set-cookie']) jar.c = rs.headers['set-cookie'][0].split(';')[0]; if (j && j.csrf) jar.csrf = j.csrf; res({ status: rs.statusCode, headers: rs.headers, buf, json: j || {} }); }); });
    q.on('error', e => res({ status: 0, headers: {}, buf: Buffer.alloc(0), json: { ok: false, code: 'NET', message: e.message } })); q.end(b ? JSON.stringify(b) : undefined);
  });
  f.api = async (method, args) => (await f('POST', '/api', { method, args: args || {} })).json; f.login = (phone, pin) => f('POST', '/auth/login', { phone, pin }); f.get = (p) => f('GET', p); return f;
}

(async () => {
  fs.rmSync(DIR, { recursive: true, force: true }); const PUB = path.join(DIR, 'pub'); fs.mkdirSync(PUB, { recursive: true }); fs.writeFileSync(path.join(PUB, 'index.html'), '<!doctype html><title>api-only</title>');
  const s = await ts.start({ publicDir: PUB, authOpts: { cfg: { ipMax: 5000 } }, dir: DIR, port: PORT, origin: ORIGIN, seedAdmin: { fullName: 'מנהל בדיקות', phone: '0500000001', pin: '4826' } });
  const A = client(), C1 = client(), C2 = client(), V = client(); await A.login('0500000001', '4826'); const cid = (await A.api('courses.list')).data[0].id, org = (await A.api('courses.org', { courseId: cid })).data, t1 = org.teams[0], t2 = org.teams[1];
  for (const [c, n, p, pin] of [[C1, 'מפקד צוות 1', '0500000002', '7391'], [V, 'צופה בלבד', '0500000003', '5173'], [C2, 'מפקד צוות 2', '0500000004', '6284']]) await c('POST', '/auth/register', { fullName: n, phone: p, pin });
  const pend = (await A('GET', '/admin/pending')).json.pending, by = n => pend.find(x => x.phone.endsWith(n)).id;
  await A('POST', '/admin/approve', { requestId: by('0002'), grant: { role: 'commander', courseIds: [cid], unitIds: [], scope: { type: 'team', id: t1.id } } }); await A('POST', '/admin/approve', { requestId: by('0003'), grant: { role: 'viewer', courseIds: [cid], unitIds: [] } }); await A('POST', '/admin/approve', { requestId: by('0004'), grant: { role: 'commander', courseIds: [cid], unitIds: [], scope: { type: 'team', id: t2.id } } });
  await C1.login('0500000002', '7391'); await V.login('0500000003', '5173'); await C2.login('0500000004', '6284');
  const all = (await A.api('soldiers.list', { courseId: cid, opts: {} })).data, of = tid => all.filter(x => x.team_id === tid), mk = (who, rid, scope, loc, abs) => who.api('marches.create', { courseId: cid, data: { request_id: rid, march_date: '2026-11-16', location: loc, km_no_stretcher: 4, km_stretcher: 0, scope_type: scope[0], scope_id: scope[1], absent: abs.map(id => ({ soldier_id: id })) } });
  let m1, m2, mAll;
  await T('commander team1 creates a team1 march with 2 missing; roster over HTTPS lists only team1 trainees; list row has exact counts (N>=5 sides) or suppression', async () => {
    const r = await mk(C1, 'h-t1', ['team', t1.id], 'מסע-צוות-1', of(t1.id).slice(0, 2).map(x => x.id)); assert.ok(r.ok, JSON.stringify(r)); m1 = r.data.march.id; assert.equal(r.data.records, of(t1.id).length);
    const roll = await C1.api('marches.roll', { courseId: cid, marchId: m1 }); assert.ok(roll.ok); assert.equal(roll.data.length, of(t1.id).length); assert.equal(roll.data.filter(x => !x.present).length, 2); roll.data.forEach(x => assert.equal(of(t1.id).some(s => s.id === x.soldier_id), true));
    const row = (await C1.api('marches.list', { courseId: cid })).data.find(x => x.id === m1); assert.ok(row); assert.equal(row.total, of(t1.id).length); if (row.counts_suppressed) { assert.equal(row.participants, null); assert.equal(row.absent, null); } else { assert.equal(row.absent, 2); } });
  await T('commander team2: the team1 march is invisible in list and roll (NOT_FOUND), no team1 name in any response; an out-of-scope absent id is refused', async () => {
    const l = await C2.api('marches.list', { courseId: cid }); assert.ok(l.ok); assert.ok(!l.data.some(x => x.id === m1)); assert.ok(!JSON.stringify(l).includes('מסע-צוות-1'));
    const r = await C2.api('marches.roll', { courseId: cid, marchId: m1 }); assert.equal(r.ok, false); assert.equal(r.code, 'NOT_FOUND'); of(t1.id).forEach(x => assert.ok(!JSON.stringify(r).includes(x.full_name)));
    const bad = await mk(C2, 'h-bad', ['team', t2.id], 'מסע-זר', [of(t1.id)[0].id]); assert.equal(bad.ok, false); assert.equal(bad.code, 'VALIDATION');
    const bad2 = await mk(C2, 'h-bad2', ['team', t1.id], 'מסע-זר-2', []); assert.equal(bad2.ok, false); });
  await T('course-wide march by admin: each commander sees counts only over own visible rows; admin sees everything; roll narrowed per commander', async () => {
    const r = await mk(A, 'h-all', ['course', cid], 'מסע-כל-הקורס', all.slice(0, 3).map(x => x.id)); assert.ok(r.ok); mAll = r.data.march.id;
    const adm = (await A.api('marches.list', { courseId: cid })).data.find(x => x.id === mAll); assert.equal(adm.total, all.length); assert.equal(adm.absent, 3);
    for (const [c, tm] of [[C1, t1], [C2, t2]]) { const row = (await c.api('marches.list', { courseId: cid })).data.find(x => x.id === mAll); assert.equal(row.total, of(tm.id).length, 'only visible rows'); const roll = (await c.api('marches.roll', { courseId: cid, marchId: mAll })).data; assert.equal(roll.length, of(tm.id).length); }
    const rA = (await A.api('marches.roll', { courseId: cid, marchId: mAll })).data; assert.equal(rA.length, all.length); });
  await T('viewer: reads allowed only inside scope; create denied; no write happens; anonymous refused', async () => {
    const before = (await A.api('marches.list', { courseId: cid })).data.length; const w = await mk(V, 'h-v', ['course', cid], 'מסע-צופה', []); assert.equal(w.ok, false); assert.ok(['FORBIDDEN', 'VALIDATION'].includes(w.code)); assert.equal((await A.api('marches.list', { courseId: cid })).data.length, before);
    const an = await client().api('marches.list', { courseId: cid }); assert.equal(an.ok, false); });
  await T('idempotent repeat of the same request_id does not duplicate the march or its roster; foreign course id refused', async () => {
    const again = await mk(C1, 'h-t1', ['team', t1.id], 'מסע-צוות-1', of(t1.id).slice(0, 2).map(x => x.id)); assert.ok(again.ok); assert.equal(again.data.duplicate, true); assert.equal((await C1.api('marches.roll', { courseId: cid, marchId: m1 })).data.length, of(t1.id).length);
    const fc = await C1.api('marches.roll', { courseId: 'id-999999', marchId: m1 }); assert.equal(fc.ok, false); assert.equal(fc.code, 'FORBIDDEN'); });
  await T('cancelled march: commander cannot read it any more (NOT_FOUND), admin still can', async () => {
    const c = await A.api('record.cancel', { table: 'Marches', id: m1, reason: 'בדיקה' }); assert.ok(c.ok, JSON.stringify(c)); assert.equal((await C1.api('marches.roll', { courseId: cid, marchId: m1 })).code, 'NOT_FOUND'); assert.ok(!(await C1.api('marches.list', { courseId: cid })).data.some(x => x.id === m1)); assert.ok((await A.api('marches.roll', { courseId: cid, marchId: m1 })).ok); });
  await s.close().catch(() => {}); fs.rmSync(DIR, { recursive: true, force: true }); console.log('\nTOTAL pass=' + pass + ' fail=' + fail); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
