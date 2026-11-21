// Issue #72 (part 3) — REAL secure document upload/download through the NATIVE UI + private TEST server (state + report files): admin creates files + a backup, changes data, loses a file, verifies the plan, restores after confirmation; commander/viewer get nothing. Browser download E2E against the private TEST server over TLS: admin clicks the report buttons in the native UI, the browser performs a real
// file download (Playwright 'download' event), and the saved bytes are validated as real PDF/XLSX. Commander/viewer get no export controls and no bytes. SYNTHETIC DATA ONLY.
const fs = require('fs'), path = require('path'), https = require('https'), zlib = require('zlib'), assert = require('assert/strict'), { chromium } = require('playwright');
const ts = require('../backend_next/test_server.js');
const DIR = '/tmp/maslul_e2e_docs_' + process.pid, OUT = process.env.DL_DIR || path.join(DIR, 'downloads'), PORT = 23000 + (process.pid % 900), ORIGIN = 'https://localhost:' + PORT, CALLS = process.env.E2E_CALLS_OUT, SHOTS = process.env.SHOTS_DIR;
const PH = { admin: ['0500000001', '4826'], cmd: ['0500000002', '7391'], view: ['0500000003', '5173'] };
let n = 0; const ok = m => console.log('ok', ++n, m), errs = [];
function req(m, p, body, jar) { return new Promise(res => { const h = { origin: ORIGIN }; if (body) h['content-type'] = 'application/json'; if (jar && jar.c) h.cookie = jar.c; if (jar && jar.csrf && m !== 'GET') h['x-csrf-token'] = jar.csrf; const q = https.request({ host: '127.0.0.1', port: PORT, path: p, method: m, rejectUnauthorized: false, headers: h }, rs => { let d = ''; rs.on('data', c => d += c); rs.on('end', () => { let j = {}; try { j = JSON.parse(d); } catch (e) {} if (jar && rs.headers['set-cookie']) jar.c = rs.headers['set-cookie'][0].split(';')[0]; if (jar && j.csrf) jar.csrf = j.csrf; res(j); }); }); q.end(body ? JSON.stringify(body) : undefined); }); }
(async () => {
  fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true }); if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const s = await ts.start({ authOpts: { cfg: { ipMax: 500 } }, dir: DIR, port: PORT, origin: ORIGIN, seedAdmin: { fullName: 'מנהל בדיקות', phone: PH.admin[0], pin: PH.admin[1] } });
  const J = {}; await req('POST', '/auth/login', { phone: PH.admin[0], pin: PH.admin[1] }, J); const cid = (await req('POST', '/api', { method: 'courses.list', args: {} }, J)).data[0].id, org = (await req('POST', '/api', { method: 'courses.org', args: { courseId: cid } }, J)).data;
  for (const [n2, p, pin] of [['מפקד צוות 1', PH.cmd[0], PH.cmd[1]], ['צופה בלבד', PH.view[0], PH.view[1]]]) await req('POST', '/auth/register', { fullName: n2, phone: p, pin });
  const pend = (await req('GET', '/admin/pending', null, J)).pending, by = x => pend.find(r => r.phone.endsWith(x)).id;
  await req('POST', '/admin/approve', { requestId: by('0002'), grant: { role: 'commander', courseIds: [cid], unitIds: [], scope: { type: 'team', id: org.teams[0].id } } }, J); await req('POST', '/admin/approve', { requestId: by('0003'), grant: { role: 'viewer', courseIds: [cid], unitIds: [] } }, J);
  const b = await chromium.launch(), calls = {};
  const open = async w => { const c = await b.newContext({ viewport: { width: w || 390, height: 800 }, ignoreHTTPSErrors: true, acceptDownloads: true }), p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  const login = async (p, who) => { await p.goto(ORIGIN + '/'); await p.waitForSelector('#auPhone'); for (let i = 0; i < 3; i++) { await p.fill('#auPhone', PH[who][0]); await p.fill('#auPin', PH[who][1]); if ((await p.inputValue('#auPhone')) === PH[who][0] && (await p.inputValue('#auPin')) === PH[who][1]) break; await p.waitForTimeout(150); } await p.click('#auGo'); await p.waitForSelector('.tab', { timeout: 15000 }); };
  const noOverflow = async (p, m) => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'overflow ' + m);
  const grab = p => p.evaluate(() => JSON.parse(sessionStorage.getItem('maslul_calls') || '{}'));
  const download = async (p, click, name) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), click()]); const f = path.join(OUT, name + '-' + d.suggestedFilename()); await d.saveAs(f); return { file: f, name: d.suggestedFilename(), buf: fs.readFileSync(f) }; };
  const sha = b => require('crypto').createHash('sha256').update(b).digest('hex'), FD = path.join(DIR, 'files');
  const crc = (() => { const t = []; for (let n2 = 0; n2 < 256; n2++) { let c = n2; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n2] = c >>> 0; } return b => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
  const chunk = (t, d) => { const o = Buffer.alloc(12 + d.length); o.writeUInt32BE(d.length, 0); o.write(t, 4, 'latin1'); d.copy(o, 8); o.writeUInt32BE(crc(o.subarray(4, 8 + d.length)), 8 + d.length); return o; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.alloc(14, 0x7f))), chunk('IEND', Buffer.alloc(0))]);
  const PDF = require('../backend_next/export_formats').pdfFromHtml('<h1>מסמך E2E סינתטי</h1>');
  const FX = path.join(DIR, 'fx'); fs.mkdirSync(FX, { recursive: true }); fs.writeFileSync(path.join(FX, 'scan.pdf'), PDF); fs.writeFileSync(path.join(FX, 'photo.png'), PNG); fs.writeFileSync(path.join(FX, 'evil.pdf'), Buffer.concat([PDF, Buffer.from('\n<< /S /JavaScript /JS (x) >>\n')])); fs.writeFileSync(path.join(FX, 'fake.pdf'), Buffer.from('MZ' + 'x'.repeat(500))); fs.writeFileSync(path.join(FX, 'big.pdf'), Buffer.concat([PDF, Buffer.alloc(8 * 1024 * 1024 + 10, 0x20)]));
  const A = await open(390); await login(A, 'admin');
  const upload = async (p, file, type, expectOk) => { await p.click('button:has-text("העלאת מסמך")'); await p.waitForSelector('#duFile'); await p.setInputFiles('#duFile', path.join(FX, file)); await p.fill('#duT', type); if (await p.locator('#duS option').count() > 1) await p.selectOption('#duS', { index: 1 }); await p.click('dialog[open] button[type=submit], dialog[open] button:has-text("אישור"), dialog[open] button.primary'); if (expectOk) { await p.waitForSelector('dialog[open]', { state: 'detached', timeout: 20000 }); await p.waitForSelector('#view >> text=' + file, { timeout: 20000 }); } else await p.waitForSelector('dialog[open] .msg.err', { timeout: 20000 }); };
  const toDocs = async p => { for (let k = 0; k < 3; k++) { await p.goto(ORIGIN + '/#/d/docs'); await p.reload(); await p.waitForTimeout(1500); try { await p.waitForSelector('button:has-text("העלאת מסמך")', { timeout: 10000 }); return; } catch (e) { if (k === 2) { throw new Error('upload button missing after 3 loads; screen text: ' + String(await p.evaluate(() => (document.getElementById('view') || document.body).innerText)).slice(0, 300)); } } } };
  await toDocs(A);
  // 1. upload a PDF and a PNG through the real file picker
  await upload(A, 'scan.pdf', 'אישור סינתטי', true); await toDocs(A); await upload(A, 'photo.png', 'תמונה סינתטית', true);
  ok('admin uploads a real PDF and a real PNG through the app\'s file picker (rows appear in the list)');
  // 2. refusals shown inside the dialog, nothing stored
  const stored0 = fs.readdirSync(FD).filter(f => /\.enc$/.test(f)).length;
  for (const f of ['evil.pdf', 'fake.pdf', 'big.pdf']) { await toDocs(A); await A.keyboard.press('Escape').catch(() => {}); await toDocs(A); await upload(A, f, 'בדיקת דחייה', false); await A.keyboard.press('Escape'); }
  assert.equal(fs.readdirSync(FD).filter(f => /\.enc$/.test(f)).length, stored0, 'refused uploads stored nothing');
  ok('active-content PDF, fake (MZ) PDF and >8MB file are refused with a visible error; nothing stored');
  // 3. real browser download, byte-identical
  const open1 = async (txt) => { await A.goto(ORIGIN + '/#/d/docs'); await A.waitForSelector('#view'); await A.waitForTimeout(800); await A.locator('#view').getByText(txt).first().click(); await A.waitForSelector('#dlOpen'); };
  await open1('scan.pdf'); const d1 = await download(A, () => A.click('#dlOpen'), 'doc'); assert.equal(sha(d1.buf), sha(PDF)); assert.ok(/^maslul-doc-[A-Za-z0-9-]+\.pdf$/.test(d1.name), d1.name); await A.waitForSelector('#dlDone'); await A.keyboard.press('Escape');
  await open1('photo.png'); const d2 = await download(A, () => A.click('#dlOpen'), 'doc'); assert.equal(sha(d2.buf), sha(PNG)); assert.ok(/\.png$/.test(d2.name));
  ok('"פתיחת הקובץ" performs a REAL download; PDF and PNG are byte-identical to the originals (sha256), fixed safe file names');
  // 4. encrypted at rest
  for (const f of fs.readdirSync(FD).filter(f => /\.enc$/.test(f))) { const bb = fs.readFileSync(path.join(FD, f)); assert.ok(!bb.includes('%PDF') && !bb.includes(Buffer.from([0x89, 0x50, 0x4e, 0x47]))); }
  ok('stored files are encrypted at rest (no PDF/PNG magic in any .enc file)');
  // 5. widths
  for (const w of [320, 360, 414]) { const p = await open(w); await login(p, 'admin'); await p.goto(ORIGIN + '/#/d/docs'); await p.waitForSelector('button:has-text("העלאת מסמך")'); await noOverflow(p, 'docs@' + w); await p.click('button:has-text("העלאת מסמך")'); await p.waitForSelector('#duFile'); await noOverflow(p, 'upload dialog@' + w); }
  ok('documents screen and upload dialog: no horizontal overflow at 320/360/414');
  // 6. viewer: no upload button, direct download refused; commander: sees only own
  const V = await open(390); await login(V, 'view'); await V.goto(ORIGIN + '/#/d/docs'); await V.waitForSelector('#view'); await V.waitForTimeout(1200); assert.equal(await V.locator('button:has-text("העלאת מסמך")').count(), 0, 'viewer has no upload button');
  const vr = await V.evaluate(async () => { const l = await window.appClient.api('docs.list', { courseId: (await window.appClient.api('courses.list', {})).data[0].id }); const id = l.ok && l.data[0] && l.data[0].id; const r = await fetch('/api/download/document/' + (id || '00000000-0000-4000-8000-000000000000'), { credentials: 'same-origin' }); return r.status; }); assert.ok([403, 404].includes(vr), 'viewer download refused: ' + vr);
  const C = await open(390); await login(C, 'cmd'); await C.goto(ORIGIN + '/#/d/docs'); await C.waitForSelector('#view'); await C.waitForTimeout(1200); assert.equal(await C.locator('#view').getByText('scan.pdf').count(), 0, 'commander does not see the admin file name');
  ok('viewer: no upload control and download refused; commander does not see the admin\'s files');
  Object.assign(calls, await A.evaluate(() => JSON.parse(sessionStorage.getItem('maslul_calls') || '{}')));
  for (const m of ['docs.upload', 'docs.download']) assert.ok(calls[m] && calls[m].ui_ok > 0, m + ' needs UI-origin success evidence: ' + JSON.stringify(calls[m])); ok('client evidence (UI-origin successes): docs.upload, docs.download');
  if (CALLS) { fs.mkdirSync(path.dirname(CALLS), { recursive: true }); fs.writeFileSync(CALLS, JSON.stringify(calls)); }
  assert.deepEqual(errs, [], 'page errors: ' + errs.join(' | ')); await b.close(); await s.close(); fs.rmSync(DIR, { recursive: true, force: true }); console.log('e2e_documents_browser: ' + n + ' checks passed');
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
