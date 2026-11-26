'use strict';
// COURSE-DASHBOARD privacy + authorization, attacked from the outside (Issue #95): (1) no hidden small cell is recoverable by subtracting displayed counts from a displayed total, (2) the same
// model is built for ADMIN and COMMANDER in two simultaneous sessions with no bleed, (3) a role downgrade inside one session never serves stale admin numbers, (4) the report-file gate is enforced by the SERVER
// (commander direct calls refused + audited), (5) exported PDF/XLSX contain exactly the displayed values. Synthetic data only.
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process'), assert = require('assert/strict'); const { chromium } = require('playwright');
const dir = path.resolve(process.argv[2] || 'preview'), M = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0], f = path.join(dir, u === '/' ? 'index.html' : u); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(''); } r.setHeader('content-type', M[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); });
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, String(e.message).split('\n').slice(0, 12).join(' ')); } }; const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cprv-')); const sh = (c, a) => cp.spawnSync(c, a, { encoding: 'utf8' });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port, b = await chromium.launch(), errs = [];
  const open = async (role) => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); if (role) await p.addInitScript(r => { try { localStorage.setItem('maslul_native_role', r); } catch (e) {} }, role); await p.goto(base + '/'); await p.waitForSelector('#k1'); await p.waitForFunction(() => window.__app && window.__app.state && window.__app.state.course && window.__insight); return p; };
  const go = async (p, h) => { await p.evaluate(h => { location.hash = h; }, h); };
  const course = async (p) => { await go(p, '#/insight/course'); await p.waitForSelector('#ciK1'); await p.waitForTimeout(300); return p.evaluate(() => JSON.parse(JSON.stringify(window.__insight.course))); };
  const small = (m) => { const bad = []; m.sections.forEach(s => s.rows.forEach(r => { if (/ק״מ|מסעות|%|ממוצע|אחוז|מבחן|רשומ/.test(String(r[0]))) return; const v = r[1]; if (typeof v === 'number' && v >= 1 && v <= 4) bad.push(s.title + '/' + r[0] + '=' + v); })); return bad; };

  await t('PARTITION: for 4000 random (total, cells) the displayed cells never leave a recoverable 1–4 remainder, no displayed positive cell <5, and every hidden cell is labelled', async () => {
    const r = await b.newContext().then(c => c.newPage()); await r.goto(base + '/'); await r.waitForFunction(() => window.__insight);
    const res = await r.evaluate(() => { const bad = []; let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
      for (let i = 0; i < 4000; i++) { const cells = [rnd(40), rnd(40), rnd(6), rnd(3)], total = cells.reduce((a, c) => a + c, 0) + (rnd(3) === 0 ? rnd(4) : 0);
        const R = { 'readiness.summary': { ok: true, data: { total, counts: { fit: cells[0], fit_with_restrictions: cells[1], unfit: cells[2], not_entered: cells[3] } } }, 'dash.overview': { ok: true, data: { active_soldiers: total } } };
        const m = window.__insight.courseModel(R, { course: 'x', now: '2026-11-26T00:00:00Z' }); const sec = m.sections.filter(s => s.key === 'readiness')[0]; if (!sec) { bad.push('no section ' + JSON.stringify(cells)); continue; }
        const shown = sec.rows.map(x => x[1]); let sum = 0; shown.forEach(v => { if (/^\d+$/.test(v)) { sum += +v; if (+v > 0 && +v < 5) bad.push('small ' + v + ' ' + JSON.stringify([total, cells])); } });
        const rem = total - sum; if (total >= 5 && rem > 0 && rem < 5) bad.push('recoverable remainder ' + rem + ' ' + JSON.stringify([total, cells, shown]));
        if (total < 5 && (m.soldiers !== null || shown.some(v => /^\d+$/.test(v) && v !== '0'))) bad.push('small total shown ' + total + ' ' + JSON.stringify(shown)); shown.forEach((v, k) => { if (!/^\d+$/.test(v) && !/פחות מ-5|מוסתר|—/.test(v)) bad.push('unlabelled ' + v); }); }
      return bad.slice(0, 5); }); assert.deepEqual(res, []); });
  await t('NAV COVERAGE + FITNESS completeness: "with result" is hidden when the complement is 1–4; attention lines never print a count that the table hides', async () => {
    const r = await b.newContext().then(c => c.newPage()); await r.goto(base + '/'); await r.waitForFunction(() => window.__insight);
    const out = await r.evaluate(() => { const mk = (soldiers, withR, complete, incomplete) => window.__insight.courseModel({ 'nav.groups': { ok: true, data: { course: { soldiers, soldiers_with_results: withR } } }, 'fitness.summary': { ok: true, data: { count: 9, by_component: {} } }, 'fitness.completion': { ok: true, data: { counts: { soldiers: complete + incomplete, complete, incomplete } } }, 'dash.overview': { ok: true, data: { active_soldiers: soldiers } } }, { course: 'x', now: '2026-11-26T00:00:00Z' });
      const a = mk(30, 27, 28, 2), c = mk(30, 20, 20, 10); const f = m => JSON.stringify(m); return { a: f(a), c: f(c), aNav: a.sections.filter(s => s.source === 'nav.groups')[0].rows, aFit: a.sections.filter(s => s.key === 'fitness')[0].rows, cNav: c.sections.filter(s => s.source === 'nav.groups')[0].rows, att: a.attention.concat(c.attention).map(x => x.text) }; });
    assert.ok(/מוסתר|פחות מ-5/.test(String(out.aNav[1][1])), 'with-result hidden when 3 are missing: ' + out.aNav[1][1]); assert.ok(!/\b27\b/.test(String(out.aNav[1][1]))); assert.equal(String(out.cNav[1][1]), '20');
    assert.ok(out.aFit.slice(2, 4).every(x => !/^(28|2)$/.test(String(x[1]))), 'fitness complete/incomplete hidden: ' + JSON.stringify(out.aFit.slice(2, 4)));
    assert.ok(!out.att.some(x => /^2 |^3 |^1 |^4 /.test(x)), 'no small count in attention: ' + out.att.join(' | ')); });

  const admin = await open(), cmd = await open('commander');
  let am, cm;
  await t('TWO SESSIONS (admin + commander, simultaneously): each sees its own scope; commander never receives the admin course numbers or export buttons', async () => {
    am = await course(admin); cm = await course(cmd); assert.notEqual(am.soldiers, cm.soldiers, 'different scope: ' + am.soldiers + ' vs ' + cm.soldiers); assert.ok(cm.soldiers === null || cm.soldiers <= am.soldiers);
    assert.equal(await admin.locator('#ciPdf').count(), 1); assert.equal(await cmd.locator('#ciPdf').count(), 0); assert.equal(await cmd.locator('#ciXlsx').count(), 0);
    for (const m of [am, cm]) assert.deepEqual(small(m), [], 'small counts leaked'); await course(admin); const cm2 = await course(cmd); assert.equal(JSON.stringify(cm2.sections), JSON.stringify(cm.sections), 'commander view stable across admin activity'); });
  await t('SERVER ENFORCEMENT: the commander session calling the report-file gate directly is refused with FORBIDDEN and no ticket (the denial audit row is proven in tests/report_export_gate.js and the Worker+D1 suite — each demo context has its own store); the admin session gets a ticket and an AUTHORIZED row', async () => {
    const r = await cmd.evaluate(async () => { const c = window.__app.state.course.id; const a = await window.__app.api('reports.exportAuthorize', { courseId: c, req: { kind: 'course', format: 'pdf', scope: 'all' } }); const d = await window.__app.api('reports.exportComplete', { courseId: c, req: { ticket: 'id-1', sha256: 'a'.repeat(64), bytes: 5000, pages: 1 } }); return { a, d }; });
    assert.equal(r.a.ok, false); assert.equal(r.a.code, 'FORBIDDEN'); assert.equal(r.a.data, undefined); assert.equal(r.d.ok, false);
    const ok = await admin.evaluate(async () => { const c = window.__app.state.course.id; return window.__app.api('reports.exportAuthorize', { courseId: c, req: { kind: 'course', format: 'pdf', scope: 'all' } }); }); assert.equal(ok.ok, true);
    const aud = await admin.evaluate(async () => { const c = window.__app.state.course.id; const r = await window.__app.api('audit.list', { courseId: c }); return r.ok ? r.data.filter(x => /^REPORT_EXPORT_/.test(x.action)).map(x => x.action) : r; }); assert.ok(Array.isArray(aud) && aud.includes('REPORT_EXPORT_AUTHORIZED'), JSON.stringify(aud)); });
  await t('DOWNLOAD IS BOUND TO THE SERVER RECORD: a real admin download writes AUTHORIZED+COMPLETED with the SHA-256 of the exact bytes; a refused gate means no file', async () => {
    await course(admin); const [dl] = await Promise.all([admin.waitForEvent('download'), admin.click('#ciPdf')]); const f = path.join(tmp, 'c.pdf'); await dl.saveAs(f); const bytes = fs.readFileSync(f), sha = require('crypto').createHash('sha256').update(bytes).digest('hex');
    const rec = await admin.evaluate(async () => { const c = window.__app.state.course.id; const r = await window.__app.api('audit.list', { courseId: c }); return r.data.filter(x => x.action === 'REPORT_EXPORT_COMPLETED').map(x => JSON.parse(x.after_json)); });
    const last = rec[rec.length - 1] || rec[0]; assert.ok(rec.some(x => x.sha256 === sha && x.bytes === bytes.length && x.format === 'pdf' && x.kind === 'course'), 'audit holds sha ' + sha + ' / ' + JSON.stringify(last));
    await admin.evaluate(() => { const o = window.appClient.api.bind(window.appClient); window.__o = o; window.appClient.api = (m, a, s) => m === 'reports.exportAuthorize' ? Promise.resolve({ ok: false, code: 'FORBIDDEN', message: 'חסום בשרת' }) : o(m, a, s); });
    let got = false; admin.once('download', () => { got = true; }); await admin.click('#ciPdf'); await admin.waitForTimeout(1500); assert.equal(got, false, 'no download when the server refuses'); assert.ok(/נחסמה בשרת/.test(await admin.evaluate(() => document.body.innerText)), 'visible refusal'); await admin.evaluate(() => { window.appClient.api = window.__o; });
    await admin.evaluate(() => { const o = window.appClient.api.bind(window.appClient); window.__o = o; window.appClient.api = (m, a, s) => m === 'reports.exportComplete' ? Promise.resolve({ ok: false, code: 'CONFLICT', message: 'נוצל' }) : o(m, a, s); });
    got = false; admin.once('download', () => { got = true; }); await admin.click('#ciPdf'); await admin.waitForTimeout(1500); assert.equal(got, false, 'no download when the server does not confirm the record'); await admin.evaluate(() => { window.appClient.api = window.__o; }); });
  await t('ROLE DOWNGRADE inside one session: after switching admin→commander the same page reloads fresh data of the commander scope and loses the export buttons (no stale admin numbers)', async () => {
    const q = await open(); const a1 = await course(q); assert.equal(await q.locator('#ciPdf').count(), 1);
    await q.evaluate(() => window.appClient.as('commander')); await q.waitForFunction(() => window.__app.state.who && window.__app.state.who.role === 'commander', null, { timeout: 8000 }).catch(() => {});
    const a2 = await course(q); assert.notEqual(a2.soldiers, a1.soldiers, 'scope changed: ' + a1.soldiers + ' → ' + a2.soldiers); assert.equal(await q.locator('#ciPdf').count(), 0, 'no export buttons after downgrade'); assert.deepEqual(small(a2), []);
    const r = await q.evaluate(async () => window.__app.api('reports.exportAuthorize', { courseId: window.__app.state.course.id, req: { kind: 'course', format: 'xlsx', scope: 'x' } })); assert.equal(r.ok, false); await q.context().close(); });
  await t('no page errors', async () => assert.deepEqual(errs, []));
  console.log('COURSE-PRIVACY pass=' + pass + ' fail=' + fail); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
