#!/usr/bin/env node
'use strict';
// Automated A/B/foreign/viewer probe against a RUNNING private TEST server (any URL whose CA you pass). It is a script on a computer — NOT evidence from physical phones.
//   node scripts/private_test_probe.js --url https://192.168.1.20:8443 --ca .private-test/ca.crt --admin-phone 05… --admin-pin ####
// Creates 4 clearly synthetic users, checks isolation/read-only/persistence-visible behaviour, deactivates them afterwards, prints a JSON evidence record. SYNTHETIC DATA ONLY.
const https = require('https'), fs = require('fs'), assert = require('assert/strict');
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : undefined; };
const url = new URL(arg('url') || ''), ca = fs.readFileSync(arg('ca')), ORIGIN = url.origin, tag = Date.now().toString(36);
function client() { const jar = {}; const f = (m, p, b) => new Promise(res => { const h = { 'content-type': 'application/json', origin: ORIGIN }; if (jar.c) h.cookie = jar.c; if (jar.csrf && m !== 'GET') h['x-csrf-token'] = jar.csrf;
  const q = https.request({ host: url.hostname, port: url.port || 443, path: p, method: m, ca, headers: h }, rs => { let d = ''; rs.on('data', c => d += c); rs.on('end', () => { let j; try { j = JSON.parse(d); } catch (e) { j = {}; } if (rs.headers['set-cookie']) jar.c = rs.headers['set-cookie'][0].split(';')[0]; if (j.csrf) jar.csrf = j.csrf; j.__status = rs.statusCode; res(j); }); }); q.on('error', e => res({ ok: false, code: 'NET', message: e.message })); q.end(b ? JSON.stringify(b) : undefined); });
  f.api = (method, args) => f('POST', '/api', { method, args: args || {} }); return f; }
(async () => {
  const ev = { url: ORIGIN, at: new Date().toISOString(), device: 'script (NOT a physical phone)', checks: [] }; const ok = (n, v) => { ev.checks.push({ n, ok: true, v }); console.log('PASS', n); };
  const A = client(); const l = await A('POST', '/auth/login', { phone: arg('admin-phone'), pin: arg('admin-pin') }); assert.ok(l.ok, 'admin login over trusted TLS: ' + JSON.stringify(l)); ok('TLS chain trusted with the private CA; admin login works');
  const cid = (await A.api('courses.list')).data[0].id, org = (await A.api('courses.org', { courseId: cid })).data, t1 = org.teams[0].id, t2 = org.teams[1].id;
  const mk = async (name, ph, pin) => { const c = client(); assert.ok((await c('POST', '/auth/register', { fullName: name, phone: ph, pin })).ok); return c; };
  const users = { a: ['בדיקה-א ' + tag, '05000' + String(Math.floor(10000 + Math.random() * 89999)), '6173'], b: ['בדיקה-ב ' + tag, '05000' + String(Math.floor(10000 + Math.random() * 89999)), '8294'], f: ['בדיקה-זר ' + tag, '05000' + String(Math.floor(10000 + Math.random() * 89999)), '3851'], v: ['בדיקה-צופה ' + tag, '05000' + String(Math.floor(10000 + Math.random() * 89999)), '7406'] };
  const C = {}; for (const k of Object.keys(users)) C[k] = await mk(...users[k]); const pend = (await A('GET', '/admin/pending')).pending, ids = {};
  for (const [k, g] of [['a', { role: 'commander', courseIds: [cid], unitIds: [], scope: { type: 'team', id: t1 } }], ['b', { role: 'commander', courseIds: [cid], unitIds: [], scope: { type: 'team', id: t1 } }], ['f', { role: 'commander', courseIds: [cid], unitIds: [], scope: { type: 'team', id: t2 } }], ['v', { role: 'viewer', courseIds: [cid], unitIds: [] }]]) { const r = await A('POST', '/admin/approve', { requestId: pend.find(x => x.phone.endsWith(users[k][1].slice(-4)) && x.name === users[k][0]).id, grant: g }); assert.ok(r.ok); ids[k] = r.id; assert.ok((await C[k]('POST', '/auth/login', { phone: users[k][1], pin: users[k][2] })).ok); }
  ok('4 synthetic users registered → admin-approved → logged in (A,B team 1; foreign team 2; viewer course read-only)');
  try {
    const at = (await A.api('acttypes.list', { courseId: cid })).data.find(x => x.active), sol1 = (await C.a.api('soldiers.list', { courseId: cid, opts: {} })).data; assert.ok(sol1.length > 0 && sol1.every(x => x.team_id === t1));
    const wr = await C.a.api('attendance.create', { courseId: cid, data: { request_id: 'probe-' + tag, event_date: new Date().toISOString().slice(0, 10), activity_type_id: at.id, scope_type: 'team', scope_id: t1, description: 'probe ' + tag, absent: [{ soldier_id: sol1[0].id }] } }); assert.ok(wr.ok, JSON.stringify(wr).slice(0, 120));
    const cnt = async c => ((await c.api('attendance.events', { courseId: cid, opts: {} })).data || []).length, nb = await cnt(C.b), nf = await cnt(C.f); assert.equal(nb, nf + 1); ok('A writes (team 1 attendance) → authorized B reads it; foreign team-2 user does not (B ' + nb + ' vs foreign ' + nf + ')');
    assert.equal((await C.f.api('soldiers.card', { id: sol1[0].id })).ok, false); ok('foreign team cannot open team-1 trainee card');
    const vw = await C.v.api('attendance.create', { courseId: cid, data: { request_id: 'probe-v-' + tag, event_date: new Date().toISOString().slice(0, 10), activity_type_id: at.id, scope_type: 'course', scope_id: cid } }); assert.equal(vw.ok, false); assert.equal(vw.code, 'FORBIDDEN'); assert.equal((await C.v.api('soldiers.list', { courseId: cid, opts: {} })).ok, true); ok('viewer reads but write is FORBIDDEN');
    assert.equal((await C.a.api('reports.build', { courseId: cid })).code, 'POLICY_BLOCKED'); ok('owner-policy route reports.build is POLICY_BLOCKED');
    const rv = await A('POST', '/admin/set-active', { targetUserId: ids.b, active: false }); assert.ok(rv.ok); assert.equal((await C.b.api('attendance.events', { courseId: cid, opts: {} })).ok, false); ok('revoking B ends B\'s live session immediately');
  } finally { for (const k of Object.keys(ids)) await A('POST', '/admin/set-active', { targetUserId: ids[k], active: false }); ev.cleanup = 'all probe users deactivated'; }
  console.log('\nEVIDENCE ' + JSON.stringify(ev)); process.exit(0);
})().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
