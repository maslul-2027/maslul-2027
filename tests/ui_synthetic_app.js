// Native app (preview/): browser E2E on synthetic data — see scripts/e2e_native.js (navigation, create/edit/cancel/restore, follow-ups, double-click guard, overflow + 44px targets at 320/360/390/414).
const cp = require('child_process'), path = require('path');
try { require('playwright'); } catch (e) { console.log('SKIP ui_synthetic_app: playwright not available'); process.exit(0); }
const eng = require('fs').readFileSync(path.join(__dirname, '..', 'preview', 'engine.js'), 'utf8');
if (!/X\.Auth\._emailProvider=/.test(eng)) { console.log('FAIL engine must override Auth._emailProvider (no real session e-mail)'); process.exit(1); }   // identity is always the synthetic demo admin
const run = f => cp.spawnSync('node', [path.join(__dirname, '..', 'scripts', f), path.join(__dirname, '..', 'preview')], { encoding: 'utf8' });
const r1 = run('e2e_native.js'), r2 = run('e2e_native_domains.js'), r3 = run('e2e_native_roles.js');
const out = (r1.stdout || '') + (r1.stderr || '') + (r2.stdout || '') + (r2.stderr || '') + (r3.stdout || '') + (r3.stderr || ''), a = /E2E PASS (\d+) checks/.exec(out), d = /DOMAINS E2E pass=(\d+) fail=0/.exec(out), rl = /ROLES E2E pass=(\d+) fail=0/.exec(out), m = a && d && rl ? [0, +a[1] + +d[1] + +rl[1]] : null;
console.log(out.trim().split('\n').slice(-3).join('\n')); console.log('\nUI SYNTHETIC APP TOTAL pass=' + (m ? m[1] : 0) + ' fail=' + (m ? 0 : 1)); process.exit(m ? 0 : 1);
