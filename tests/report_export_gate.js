// Report-export gate (Issue #95): the SERVER authorizes + records every report file the browser builds. Node only (in-memory engine, faked identity); synthetic data only.
const { suite } = require('./tlib'); const { t, done, assert } = suite('report_export_gate.js'); const { world } = require('./world');
function W() { const w = world(); const { X } = w; w.as = (u, m, a) => { X.Auth._emailProvider = () => (u && typeof u === 'object' ? u.email : u); return X.api(m, a); }; return w; }
const SHA = 'a'.repeat(64), req = (o) => Object.assign({ kind: 'navigation', format: 'pdf', scope: 'nav-type 2026-11-01' }, o || {});
const rows = (w, action) => w.X.Db.where('AuditLog', r => r.action === action);

t('hardening', 'ADMIN: authorize -> complete is recorded in the audit log with kind/format/scope/size/SHA-256, bound to a single ticket', () => {
  const w = W(), { admin, c1 } = w; const a = w.as(admin, 'reports.exportAuthorize', { courseId: c1, req: req() }); assert.strictEqual(a.ok, true, JSON.stringify(a)); assert.ok(a.data.ticket);
  const c = w.as(admin, 'reports.exportComplete', { courseId: c1, req: { ticket: a.data.ticket, sha256: SHA, bytes: 4321, pages: 3 } }); assert.strictEqual(c.ok, true, JSON.stringify(c));
  const au = rows(w, 'REPORT_EXPORT_AUTHORIZED'), co = rows(w, 'REPORT_EXPORT_COMPLETED'); assert.strictEqual(au.length, 1); assert.strictEqual(co.length, 1); assert.strictEqual(co[0].record_id, a.data.ticket); assert.strictEqual(au[0].actor_email, admin.email);
  const after = JSON.parse(co[0].after_json); assert.deepStrictEqual([after.kind, after.format, after.bytes, after.pages, after.sha256], ['navigation', 'pdf', 4321, 3, SHA]);
  const list = w.as(admin, 'audit.list', { courseId: c1 }); assert.strictEqual(list.ok, true); assert.ok(list.data.some(r => r.action === 'REPORT_EXPORT_COMPLETED'), 'admin reads the download event');
});
t('hardening', 'COMMANDER / foreign-course commander / unknown / no identity: refused by the SERVER, no ticket, and the refusal itself is audited (no personal data in it)', () => {
  const w = W(), { admin, c1, cC, cT, cO } = w; const before = rows(w, 'REPORT_EXPORT_DENIED').length;
  [cC, cT, cO].forEach(u => { const r = w.as(u, 'reports.exportAuthorize', { courseId: c1, req: req() }); assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'FORBIDDEN'); assert.strictEqual(r.data, undefined); });
  ['', 'ghost@x.com'].forEach(e => assert.strictEqual(w.as(e, 'reports.exportAuthorize', { courseId: c1, req: req() }).ok, false));
  assert.ok(rows(w, 'REPORT_EXPORT_DENIED').length >= before + 3, 'denied attempts are recorded');
  assert.strictEqual(rows(w, 'REPORT_EXPORT_AUTHORIZED').length, 0, 'no ticket was ever issued'); rows(w, 'REPORT_EXPORT_DENIED').forEach(r => assert.ok(!/SOL[A-F]77|סודי|SECRET/.test(r.after_json + r.before_json)));
  assert.strictEqual(w.as(cC, 'audit.list', { courseId: c1 }).ok, false, 'a commander cannot read the audit log');
});
t('hardening', 'a commander cannot complete or reuse an admin ticket (actor-bound), cannot complete without authorize, and a ticket is single-use', () => {
  const w = W(), { admin, c1, c2, cC } = w; const a = w.as(admin, 'reports.exportAuthorize', { courseId: c1, req: req() }).data.ticket, body = { ticket: a, sha256: SHA, bytes: 999, pages: 1 };
  assert.strictEqual(w.as(cC, 'reports.exportComplete', { courseId: c1, req: body }).ok, false, 'commander refused');
  assert.strictEqual(w.as(admin, 'reports.exportComplete', { courseId: c2, req: body }).ok, false, 'ticket is bound to its course');
  assert.strictEqual(w.as(admin, 'reports.exportComplete', { courseId: c1, req: Object.assign({}, body, { ticket: 'nope-1234' }) }).ok, false, 'invented ticket');
  assert.strictEqual(w.as(admin, 'reports.exportComplete', { courseId: c1, req: body }).ok, true);
  const again = w.as(admin, 'reports.exportComplete', { courseId: c1, req: body }); assert.strictEqual(again.ok, false); assert.strictEqual(again.code, 'CONFLICT');
  const other = w.X.Db.where('AuditLog', r => r.action === 'REPORT_EXPORT_DENIED')[0]; if (other) assert.strictEqual(w.as(admin, 'reports.exportComplete', { courseId: c1, req: Object.assign({}, body, { ticket: other.id }) }).ok, false, 'a DENIED row is not a ticket');
  assert.strictEqual(rows(w, 'REPORT_EXPORT_COMPLETED').length, 1);
});
t('hardening', 'a second admin session cannot complete the first admin\'s ticket (actor-bound)', () => {
  const w = W(), { X, admin, c1 } = w; const adm2 = { email: 'admin2@x.com', role: 'admin', courseScope: [c1] }; X.Courses.addUser(admin, { email: adm2.email, role: 'admin', course_ids: [c1], display_name: 'מנהל2' });
  const a = w.as(admin, 'reports.exportAuthorize', { courseId: c1, req: req() }).data.ticket; const r = w.as(adm2, 'reports.exportComplete', { courseId: c1, req: { ticket: a, sha256: SHA, bytes: 500, pages: 1 } }); assert.strictEqual(r.ok, false, JSON.stringify(r));
  assert.strictEqual(w.as(admin, 'reports.exportComplete', { courseId: c1, req: { ticket: a, sha256: SHA, bytes: 500, pages: 1 } }).ok, true);
});
t('hardening', 'role downgrade / revocation between authorize and complete: the completion is refused once the user is no longer an admin or is deactivated', () => {
  const w = W(), { X, admin, c1 } = w; const adm2 = { email: 'admin3@x.com', role: 'admin', courseScope: [c1] }; const u = X.Courses.addUser(admin, { email: adm2.email, role: 'admin', course_ids: [c1], display_name: 'מנהל3' });
  const a = w.as(adm2, 'reports.exportAuthorize', { courseId: c1, req: req() }); assert.strictEqual(a.ok, true, JSON.stringify(a));
  X.Courses.setUser(admin, u.id, { active: false }); assert.strictEqual(w.as(adm2, 'reports.exportComplete', { courseId: c1, req: { ticket: a.data.ticket, sha256: SHA, bytes: 500, pages: 1 } }).ok, false, 'deactivated user');
  assert.strictEqual(w.as(adm2, 'reports.exportAuthorize', { courseId: c1, req: req() }).ok, false);
  assert.strictEqual(rows(w, 'REPORT_EXPORT_COMPLETED').length, 0);
});
t('hardening', 'expired ticket (15 min) is refused; invalid kind / format / scope / sha / size are rejected before anything is recorded', () => {
  const w = W(), { X, admin, c1 } = w; const a = w.as(admin, 'reports.exportAuthorize', { courseId: c1, req: req() }).data.ticket; const real = X.Util._clock;
  X.Util._clock = () => new Date(Date.now() + 16 * 60000); try { const r = w.as(admin, 'reports.exportComplete', { courseId: c1, req: { ticket: a, sha256: SHA, bytes: 500, pages: 1 } }); assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'FORBIDDEN'); } finally { X.Util._clock = real; }
  [{ kind: 'x' }, { kind: 'navigation; drop' }, { format: 'docx' }, { format: '' }, { scope: 'x'.repeat(161) }, { scope: 'a\u0000b' }].forEach(o => assert.strictEqual(w.as(admin, 'reports.exportAuthorize', { courseId: c1, req: req(o) }).ok, false, JSON.stringify(o)));
  const ok = w.as(admin, 'reports.exportAuthorize', { courseId: c1, req: req() }).data.ticket;
  [{ sha256: 'zz' }, { sha256: SHA.slice(1) }, { bytes: 5 }, { bytes: 99999999999 }, { bytes: 12.5 }, { pages: -1 }, { pages: 'x' }].forEach(o => assert.strictEqual(w.as(admin, 'reports.exportComplete', { courseId: c1, req: Object.assign({ ticket: ok, sha256: SHA, bytes: 500, pages: 1 }, o) }).ok, false, JSON.stringify(o)));
  assert.strictEqual(rows(w, 'REPORT_EXPORT_COMPLETED').length, 0, 'nothing recorded for invalid completions');
});
t('hardening', 'spoofed identity fields in the request body are ignored (role/email/courseScope come from the server)', () => {
  const w = W(), { admin, c1, cC } = w; const sp = { role: 'admin', email: admin.email, ctx: { role: 'admin' }, courseScope: [c1], asAdmin: true };
  assert.strictEqual(w.as(cC, 'reports.exportAuthorize', Object.assign({ courseId: c1, req: req() }, sp)).ok, false); assert.strictEqual(w.as(cC, 'reports.exportAuthorize', { courseId: c1, req: Object.assign(req(), sp) }).ok, false);
});
done();
