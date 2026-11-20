// 174-route evidence ledger: backend route -> native workflow -> synthetic browser E2E evidence (recorded by the appClient during e2e_native*.js).
// Usage: node scripts/build_route_ledger.js [callsDir=artifacts] [outDir=docs]. Markers: PASS_SYNTH_E2E | IMPLEMENTED_NOT_E2E | BLOCKED_NOT_CONNECTED | NOT_IMPLEMENTED.
const fs = require('fs'), path = require('path'); const root = path.join(__dirname, '..');
const callsDir = path.resolve(root, process.argv[2] || 'artifacts'), outDir = path.resolve(root, process.argv[3] || 'docs');
const code = fs.readFileSync(path.join(root, 'src', 'Code.gs'), 'utf8'), block = code.slice(code.indexOf('const API_'), code.indexOf('};', code.indexOf('const API_')));
const routes = Array.from(block.matchAll(/^\s*'([A-Za-z]+\.[A-Za-z]+)':/gm)).map(m => m[1]);
const classes = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'route_classes.json'), 'utf8')), inv = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'capability-inventory.json'), 'utf8'));
const native = ['app.js', 'domains.js'].map(f => fs.readFileSync(path.join(root, 'native', f), 'utf8')).join('\n');
const calls = {}; (fs.existsSync(callsDir) ? fs.readdirSync(callsDir).filter(f => /^calls_.*\.json$/.test(f)) : []).forEach(f => { const j = JSON.parse(fs.readFileSync(path.join(callsDir, f), 'utf8')); Object.keys(j).forEach(m => { const c = calls[m] || (calls[m] = { ok: 0, ui_ok: 0, direct_ok: 0, codes: {} }); c.ok += j[m].ok; c.ui_ok += j[m].ui_ok || 0; c.direct_ok += j[m].direct_ok === undefined ? (j[m].ui_ok === undefined ? j[m].ok : 0) : j[m].direct_ok; Object.keys(j[m].codes).forEach(k => c.codes[k] = (c.codes[k] || 0) + j[m].codes[k]); }); });
const grp = {}; Object.keys(inv.groups || {}).forEach(g => inv.groups[g].forEach(m => grp[m] = g));
const BLOCK_NOTE = { 'backup.create': 'needs Drive/Spreadsheet adapter', 'backup.verify': 'needs Drive adapter', 'backup.restore': 'needs Drive adapter', 'backup.recover': 'needs Drive adapter', 'backup.prune': 'needs Drive adapter', 'docs.upload': 'needs Drive file storage', 'docs.download': 'needs Drive file storage', 'ocr.start': 'needs OCR/Drive adapter', 'reports.generate': 'needs Drive export adapter', 'reports.download': 'needs Drive export adapter' };
const rows = routes.map(m => { const c = calls[m], inNative = new RegExp("'" + m.replace('.', '\\.') + "'").test(native); let st, note = '';
  // An API invoked directly from a browser test is NOT proof of a usable native screen.
  // Require at least a referenced native action before marking it as browser-tested.
  // Note: this still proves an API success, not a click-driven end-to-end UX journey.
  // PASS_SYNTH_E2E = at least one SUCCESSFUL call that was made by the app's own UI code (recorded without the 'direct' tag) during a browser run.
  // Calls made through the test hook window.__app.api are 'direct' and only ever give API_ONLY_NOT_UI.
  const uiOk = c ? c.ui_ok : 0, directOk = c ? c.direct_ok : 0;
  if (uiOk > 0) st = 'PASS_SYNTH_E2E';
  else if (directOk > 0) { st = 'API_ONLY_NOT_UI'; note = inNative ? 'API succeeds only when called directly by a test; no click-driven success recorded' : 'API succeeds in a browser test but no native workflow is wired'; }
  else if ((c && c.codes.NOT_CONNECTED) || BLOCK_NOTE[m]) { st = 'BLOCKED_NOT_CONNECTED'; note = BLOCK_NOTE[m] || 'adapter not connected in synthetic mode'; }
  else if (inNative) st = 'IMPLEMENTED_NOT_E2E';
  else st = 'NOT_IMPLEMENTED';
  if (BLOCK_NOTE[m] && st === 'PASS_SYNTH_E2E') note = BLOCK_NOTE[m];
  return { route: m, group: grp[m] || m.split('.')[0], authz_class: classes[m] || '?', backend: 'yes', server_authz_test: classes[m] ? 'tests/d7_authz.js' : 'no', native_screen: (inNative || uiOk > 0) ? 'yes' : 'no', status: st, e2e_ok_calls: c ? c.ok : 0, ui_ok_calls: uiOk, direct_ok_calls: directOk, negative_authz_observed: c && c.codes.FORBIDDEN ? 'yes' : 'no', blocked: note, secured_test_e2e: 'NOT_RUN', deployed: 'NO' }; });
const count = s => rows.filter(r => r.status === s).length, sum = { total: rows.length, PASS_SYNTH_E2E: count('PASS_SYNTH_E2E'), API_ONLY_NOT_UI: count('API_ONLY_NOT_UI'), IMPLEMENTED_NOT_E2E: count('IMPLEMENTED_NOT_E2E'), BLOCKED_NOT_CONNECTED: count('BLOCKED_NOT_CONNECTED'), NOT_IMPLEMENTED: count('NOT_IMPLEMENTED'), native_screen: rows.filter(r => r.native_screen === 'yes').length };
fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'route-evidence-ledger.json'), JSON.stringify({ generated_by: 'scripts/build_route_ledger.js', summary: sum, rows }, null, 1) + '\n');
let md = '# 174-route evidence ledger (generated — do not edit)\n\nSource: `scripts/build_route_ledger.js` from `src/Code.gs` API_ map, `tests/route_classes.json`, native sources and the calls recorded by the browser E2E (`E2E_CALLS_OUT`). Synthetic data only. **secured TEST E2E = NOT_RUN and deployed = NO for every row** (no secured backend exists yet).\n\n' + '**Summary:** ' + JSON.stringify(sum) + '\n\nMarkers: PASS_SYNTH_E2E = API called successfully during a browser test AND referenced by native code; this alone does NOT prove a click-driven UI journey (some tests call window.__app.api directly) · IMPLEMENTED_NOT_E2E = native code references the API but no successful browser call observed · BLOCKED_NOT_CONNECTED = missing external adapter, shown honestly · NOT_IMPLEMENTED = no native workflow (even if a test calls the backend API directly).\n\n| # | Route | Group | Authz class | Native | Status | OK calls | Negative authz seen | Note |\n|---|---|---|---|---|---|---|---|---|\n';
rows.forEach((r, i) => md += `| ${i + 1} | \`${r.route}\` | ${r.group} | ${r.authz_class} | ${r.native_screen} | ${r.status} | ${r.ui_ok_calls}/${r.direct_ok_calls} | ${r.negative_authz_observed} | ${r.blocked} |\n`);
fs.writeFileSync(path.join(outDir, 'ROUTE_EVIDENCE_LEDGER.md'), md); console.log(JSON.stringify(sum));
