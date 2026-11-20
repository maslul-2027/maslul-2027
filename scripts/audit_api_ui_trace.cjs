'use strict';
/**
 * Reproducible source-to-UI traceability audit.
 * Run: node scripts/audit_api_ui_trace.cjs legacy-source
 *
 * Static references are NOT evidence of runtime execution, authorization,
 * data persistence, or accessible UX. Dynamic dispatch may undercount.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.argv[2];
if (!root) throw Error('Expected pinned legacy checkout directory argument');
const inventory = JSON.parse(fs.readFileSync('docs/capability-inventory.json', 'utf8'));
const methods = Object.values(inventory.groups).flat();
assert.equal(new Set(methods).size, methods.length, 'Duplicate inventory entry');
assert.equal(inventory.source.method_count, methods.length, 'Inventory count mismatch');
const source = fs.readFileSync(path.join(root, 'src', 'Index.html'), 'utf8');
const form = fs.readFileSync(path.join(root, 'src', 'FormPage.html'), 'utf8');
const all = source + '\n' + form;
const apiFile = fs.readFileSync(path.join(root, 'src', 'Code.gs'), 'utf8');
const trace = methods.map(method => {
  const quoted = ["'"+method+"'", '"'+method+'"', '`'+method+'`'];
  const literal = quoted.some(token => all.includes(token));
  const inApiWhitelist = quoted.some(token => apiFile.includes(token));
  assert.ok(inApiWhitelist, 'Inventory API is absent from Code.gs: ' + method);
  return { method, uiReference: literal ? 'LITERAL_REFERENCE' : 'NOT_STATICALLY_TRACED',
           runtime: 'NOT_TESTED', authorized: 'NOT_TESTED', deployed: 'NOT_VERIFIED' };
});
const summary = { source: 'pinned legacy source', expected: methods.length,
  literalReferences: trace.filter(x=>x.uiReference==='LITERAL_REFERENCE').length,
  notStaticallyTraced: trace.filter(x=>x.uiReference==='NOT_STATICALLY_TRACED').length };
const result = { warning: 'Static string matching only: dynamic code and workflow coverage require human and browser auditing. No operational or security claim.', summary, actions: trace };
fs.mkdirSync('artifacts', {recursive:true});
fs.writeFileSync('artifacts/api-ui-traceability.json', JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(summary));
assert.equal(trace.length,174,'Expected all 174 API methods in trace report');
