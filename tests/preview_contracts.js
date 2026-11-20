// Owner UX contract + static PWA checks (scripts/test_unified_mobile_contract.cjs from PR #33, scripts/test_preview.cjs) run unchanged against preview/index.html.
const cp = require('child_process'), path = require('path'); let fail = 0;
for (const f of ['test_unified_mobile_contract.cjs', 'test_preview.cjs']) { const r = cp.spawnSync('node', [path.join(__dirname, '..', 'scripts', f)], { cwd: path.join(__dirname, '..'), encoding: 'utf8' }); const ok = r.status === 0; if (!ok) fail++; console.log((ok ? 'PASS' : 'FAIL') + ' [integration] ' + f + (ok ? '' : '\n   ' + (r.stderr || r.stdout).split('\n')[0])); }
console.log('\nPREVIEW CONTRACTS TOTAL pass=' + (2 - fail) + ' fail=' + fail); process.exit(fail ? 1 : 0);
