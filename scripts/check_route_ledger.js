'use strict';
// QA gate: a synthetic browser API call alone cannot stand in for a native screen.
const fs = require('fs'), path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'docs', 'route-evidence-ledger.json');
const x = JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = x.rows || [], total = rows.length;
const counts = {};
rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
const violations = [];
if (total !== 178 || x.summary.total !== 178) violations.push('route inventory must be exactly 178');
for (const r of rows) {
  if (r.status === 'PASS_SYNTH_E2E' && !(r.native_screen === 'yes' && r.ui_ok_calls > 0))
    violations.push(r.route + ': PASS without a successful UI-originated call (direct test API calls do not count)');
  if (r.status === 'API_ONLY_NOT_UI' && !(r.direct_ok_calls > 0 && !(r.ui_ok_calls > 0)))
    violations.push(r.route + ': API_ONLY_NOT_UI row inconsistent');
  if (r.status === 'NOT_IMPLEMENTED' && r.native_screen === 'yes')
    violations.push(r.route + ': native reference unexpectedly marked not implemented');
  if (r.secured_test_e2e === 'PASS' || r.deployed === 'YES')
    violations.push(r.route + ': unsupported secure/deployment assertion in public synthetic QA');
}
for (const r of rows) {
  if (r.interaction_verified === 'yes' && !(r.gesture_correlated_ok > 0 && r.gesture_correlated_ok <= r.ui_origin_api_ok))
    violations.push(r.route + ': interaction_verified without gesture-correlated UI-origin success');
  if (r.status === 'POLICY_BLOCKED' && (r.interaction_verified === 'yes' || r.ui_origin_api_ok > 0))
    violations.push(r.route + ': policy-blocked route must not be called by the native UI');
}
const iv = rows.filter(r => r.interaction_verified === 'yes').length;
if ((x.summary.interaction_verified || 0) !== iv) violations.push('interaction_verified: summary does not match rows');
if (iv > (counts.PASS_SYNTH_E2E || 0)) violations.push('interaction_verified exceeds PASS count (inflation)');
for (const key of ['PASS_SYNTH_E2E','API_ONLY_NOT_UI','POLICY_BLOCKED','IMPLEMENTED_NOT_E2E','BLOCKED_NOT_CONNECTED','NOT_IMPLEMENTED']) {
  if ((x.summary[key] || 0) !== (counts[key] || 0))
    violations.push(key + ': summary does not match rows');
}
const directOnly = rows.filter(r => r.status === 'API_ONLY_NOT_UI');
console.log('ROUTE QA', JSON.stringify(x.summary), 'direct API success without native screen:', directOnly.map(r => r.route).join(', ') || 'none');
if (violations.length) { console.error('ROUTE QA FAILURE\n' + violations.join('\n')); process.exit(1); }
console.log('ROUTE QA PASS — caution: native-code presence + API success does NOT prove a click-driven UI journey');
