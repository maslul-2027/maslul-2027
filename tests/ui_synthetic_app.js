// Native app (preview/): browser E2E on synthetic data — see scripts/e2e_native.js (navigation, create/edit/cancel/restore, follow-ups, double-click guard, overflow + 44px targets at 320/360/390/414).
const cp = require('child_process'), path = require('path');
try { require('playwright'); } catch (e) { console.log('SKIP ui_synthetic_app: playwright not available'); process.exit(0); }
const eng = require('fs').readFileSync(path.join(__dirname, '..', 'preview', 'engine.js'), 'utf8');
if (!/X\.Auth\._emailProvider=/.test(eng)) { console.log('FAIL engine must override Auth._emailProvider (no real session e-mail)'); process.exit(1); }   // identity is always the synthetic demo admin
const r = cp.spawnSync('node', [path.join(__dirname, '..', 'scripts', 'e2e_native.js'), path.join(__dirname, '..', 'preview')], { encoding: 'utf8' });
const out = (r.stdout || '') + (r.stderr || ''), m = /E2E PASS (\d+) checks/.exec(out);
console.log(out.trim().split('\n').slice(-3).join('\n')); console.log('\nUI SYNTHETIC APP TOTAL pass=' + (m ? m[1] : 0) + ' fail=' + (m ? 0 : 1)); process.exit(m ? 0 : 1);
