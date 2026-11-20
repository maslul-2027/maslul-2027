// Prints exactly what this machine can run. Exit 0 = full run possible (Node + Playwright + Chromium launchable); exit 1 = UI suites cannot run.
// Pure Node. Does NOT run the app (no Apps Script, Sheets or Drive).
const out = { node: process.version, nodeOk: /^v22\./.test(process.version), playwright: null, chromium: null, problems: [] };
if (!out.nodeOk) out.problems.push('Node ' + process.version + ' (tested on v22.x; package.json engines: >=22 <23)');
let pw = null;
try { pw = require('playwright'); try { out.playwright = require('playwright/package.json').version; } catch (e) { out.playwright = 'unknown'; } }
catch (e) { out.problems.push('playwright is not installed (run: npm install  OR  sh scripts/setup_tests.sh)'); }
const done = () => { module.exports = out; if (require.main === module) {
  console.log('node       : ' + out.node + (out.nodeOk ? '' : '  (NOT the tested major)'));
  console.log('playwright : ' + (out.playwright || 'MISSING') + (out.playwright && out.playwright !== '1.63.0' ? '  (pinned: 1.63.0 - results may differ)' : ''));
  console.log('chromium   : ' + (out.chromium || 'MISSING / not launchable'));
  console.log(out.problems.length ? 'ENV: UI SUITES CANNOT RUN\n - ' + out.problems.join('\n - ') : 'ENV: OK (all suites can run)');
  process.exit(out.problems.length ? 1 : 0); } };
if (!pw) done(); else (async () => { try { const b = await pw.chromium.launch(); out.chromium = b.version(); await b.close(); } catch (e) { out.problems.push('chromium cannot launch: ' + String(e.message).split('\n')[0] + ' (run: npx playwright install chromium)'); } done(); })();
