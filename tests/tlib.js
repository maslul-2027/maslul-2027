// Tiny test runner shared by the v1.0.0 suites: counts by kind, prints failures with the first stack line of the test file.
const assert = require('assert');
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
assert.deepStrictEqual = (a, b, m) => assert.strictEqual(canon(a), canon(b), m);
function suite(file) {
  const counts = { unit: 0, integration: 0, hardening: 0 }; let fail = 0; const failures = [];
  function t(kind, name, fn) {
    try { fn(); counts[kind]++; console.log('PASS', '[' + kind + ']', name); }
    catch (e) { fail++; failures.push(name); const loc = (e.stack || '').split('\n').find(l => l.includes(file)) || ''; console.log('FAIL', '[' + kind + ']', name, '\n   ', String(e.message).split('\n').slice(0, 4).join(' | '), loc.trim()); }
  }
  function done() {
    console.log('\nBY TYPE:', JSON.stringify(counts), 'TOTAL pass=' + (counts.unit + counts.integration + counts.hardening) + ' fail=' + fail);
    if (fail) { console.log('FAILED:', failures.join(' | ')); process.exit(1); }
  }
  return { t, done, assert };
}
module.exports = { suite };
