// R3 — (a) general Google-Form fill-in link (read-only, never an edit link, never invented), (b) existing reports verified & scoped. Node only, synthetic data.
const { suite } = require('./tlib'); const { t, done, assert } = suite('r3_forms_reports.js'); const { world } = require('./world');
const GOOD = 'https://docs.google.com/forms/d/e/1FAIpQLSdAbCdEfGhIjKlMnOpQrStUvWxYz0123456789/viewform';
const snap = (X) => JSON.stringify(Object.keys(X.SCHEMA || {}).length ? Object.keys(X.SCHEMA).map(n => X.Db.all(n)) : ['Soldiers', 'FitnessTests', 'FormTokens', 'SoldierUpdateRequests', 'ReportJobs'].map(n => X.Db.all(n)));
t('integration', 'link: not configured => honest "not set" answer, no URL, nothing invented', () => {
  const { X, admin, c1, cT } = world(); X.Forms._urlProvider = () => null;
  [admin, cT].forEach(c => { const r = X.Forms.generalLink(c, c1); assert.strictEqual(r.configured, false); assert.strictEqual(r.reason, 'not_set'); assert.ok(!('url' in r)); assert.ok(/PERSONAL_FORM_URL/.test(r.message)); });
  X.Forms._urlProvider = () => '   '; assert.strictEqual(X.Forms.generalLink(admin, c1).reason, 'not_set');
});
t('integration', 'link: a proper respondent link (viewform, forms.gle) is returned as-is to admin and commanders in scope', () => {
  const { X, admin, c1, cT, cD, cC } = world();
  [GOOD, GOOD + '?usp=sf_link', GOOD + '?usp=pp_url&entry.123=x', 'https://forms.gle/AbCd1234efGh'].forEach(u => { X.Forms._urlProvider = () => u; [admin, cT, cD, cC].forEach(c => { const r = X.Forms.generalLink(c, c1); assert.deepStrictEqual([r.configured, r.url], [true, u]); }); });
  X.Forms._urlProvider = () => '  ' + GOOD + '\n'; assert.strictEqual(X.Forms.generalLink(admin, c1).url, GOOD, 'surrounding whitespace trimmed');
});
t('hardening', 'link: edit / manage / look-alike / unsafe values are NOT exposed (and not echoed back)', () => {
  const { X, admin, c1, cT } = world();
  const bad = ['https://docs.google.com/forms/d/1FAIpQLSdAbCdEfGhIjKlMnOpQrStUv/edit', 'https://docs.google.com/forms/d/1FAIpQLSdAbCdEfGhIjKlMnOpQrStUv/edit?usp=sharing', 'https://docs.google.com/forms/d/e/1FAIpQLSdAbCdEfGhIjKl/edit', 'https://docs.google.com/forms/d/e/1FAIpQLSdAbCdEfGhIjKl/viewanalytics',
    'http://docs.google.com/forms/d/e/1FAIpQLSdAbCdEfGhIjKl/viewform', 'https://docs.google.com.evil.com/forms/d/e/1FAIpQLSdAbCdEfGhIjKl/viewform', 'https://evil.com/?https://docs.google.com/forms/d/e/1FAIpQLSdAbCdEfGhIjKl/viewform', 'https://user:pw@docs.google.com/forms/d/e/1FAIpQLSdAbCdEfGhIjKl/viewform',
    'javascript:alert(1)', 'https://docs.google.com/forms/d/e/1FAIpQLSdAbCdEfGhIjKl/viewform#x', GOOD + ' extra', 'https://docs.google.com/forms/d/e/short/viewform', 'https://forms.gle/', 'https://forms.gle/ab', 'https://docs.google.com/spreadsheets/d/1FAIpQLSdAbCdEfGhIjKl/edit', GOOD + '"onmouseover="x', 'https://' + 'a'.repeat(450)];
  bad.forEach(u => { X.Forms._urlProvider = () => u; [admin, cT].forEach(c => { const r = X.Forms.generalLink(c, c1); assert.strictEqual(r.configured, false, u); assert.strictEqual(r.reason, 'invalid', u); assert.ok(!('url' in r), u); assert.ok(!JSON.stringify(r).includes('evil') && !JSON.stringify(r).includes('/edit'), 'not echoed: ' + u); }); });
});
t('hardening', 'link permissions: commander without assignment / commander of another course / unknown course are refused; read-only (no data, no audit change)', () => {
  const { X, admin, c1, c2, cO, none } = world(); X.Forms._urlProvider = () => GOOD; const before = snap(X), aud = X.Db.all('AuditLog').length;
  const code = f => { try { f(); return null; } catch (e) { return e.code; } };
  assert.strictEqual(code(() => X.Forms.generalLink(cO, c1)), 'FORBIDDEN'); assert.ok(code(() => X.Forms.generalLink(cO, 'no-such')) !== null, 'unknown course refused for a commander');
  assert.strictEqual(code(() => X.Forms.generalLink(none, c1)), 'FORBIDDEN', 'commander without an assignment');
  X.Forms.generalLink(admin, c1); assert.strictEqual(snap(X), before); assert.strictEqual(X.Db.all('AuditLog').length, aud);
});
t('integration', 'link through the API route: works for a commander, response never contains management data; the existing per-soldier token flow is unchanged', () => {
  const S = world(), { X, admin, c1, cT, as } = S; X.Forms._urlProvider = () => GOOD;
  const r = as(cT, 'forms.generalLink', { courseId: c1 }); assert.ok(r.ok, JSON.stringify(r)); assert.deepStrictEqual(Object.keys(r.data).sort(), ['configured', 'url']);
  const l = X.Forms.createLink(admin, c1, S.S.a.id, 3); assert.ok(l.token && l.fields.length === 3, 'per-soldier flow untouched');
  assert.strictEqual(S.code(() => X.Forms.createLink(cT, c1, S.S.a.id, 3)), 'FORBIDDEN', 'commander still cannot create personal links');
});
t('integration', 'reports (existing): admin generates xlsx and pdf for several sections; the job is logged; no soldier data changes', () => {
  const S = world(), { X, admin, c1 } = S; const j0 = X.Reports.jobs(admin, c1).length, soldiers = JSON.stringify(X.Db.all('Soldiers')), fit = JSON.stringify(X.Db.all('FitnessTests'));
  ['xlsx', 'pdf'].forEach(f => { const r = X.Reports.generate(admin, c1, { sections: ['soldiers', 'fitness', 'navigation'] }, f); assert.strictEqual(r.format, f); assert.ok(r.rows_count > 0); assert.ok(!JSON.stringify(r).includes('drive.google'), 'no Drive link'); });
  assert.strictEqual(X.Reports.jobs(admin, c1).length, j0 + 2); assert.strictEqual(JSON.stringify(X.Db.all('Soldiers')), soldiers); assert.strictEqual(JSON.stringify(X.Db.all('FitnessTests')), fit);
  assert.ok(X.Reports.fullExport(admin, c1, false));
});
t('integration', 'reports (existing policy kept): a team commander previews ONLY his team; cannot generate/download/export; other course refused', () => {
  const S = world(), { X, admin, c1, cT, cD, cO } = S; const m = X.Reports.build(cT, c1, { sections: ['soldiers'] }); const txt = JSON.stringify(m);
  assert.ok(txt.includes('SOLA77') && !txt.includes('SOLC77') && !txt.includes('SOLD77') && !txt.includes('SOLB77'), 'team scope only');
  assert.ok(JSON.stringify(X.Reports.build(cD, c1, { sections: ['soldiers'] })).includes('SOLB77'));
  ['generate', 'jobs', 'fullExport'].forEach(k => assert.strictEqual(S.code(() => k === 'generate' ? X.Reports.generate(cT, c1, { sections: ['soldiers'] }, 'xlsx') : k === 'jobs' ? X.Reports.jobs(cT, c1) : X.Reports.fullExport(cT, c1, false)), 'FORBIDDEN', k));
  const job = X.Reports.generate(admin, c1, { sections: ['soldiers'] }, 'xlsx'); assert.ok(['FORBIDDEN', 'NOT_FOUND'].includes(S.code(() => X.Reports.download(cT, job.id))), 'download refused (fail closed)');
  assert.strictEqual(S.code(() => X.Reports.build(cO, c1, { sections: ['soldiers'] })), 'FORBIDDEN');
  assert.strictEqual(S.code(() => X.Reports.build(cT, c1, { sections: ['soldiers'], include_private: true })), 'FORBIDDEN', 'private data not available to commanders');
});
done();
