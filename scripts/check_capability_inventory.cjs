#!/usr/bin/env node
'use strict';
// Checks that the committed API inventory is internally consistent and has not
// silently lost entries. It does NOT claim live backend/API parity.
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'docs', 'capability-inventory.json');
const inv = JSON.parse(fs.readFileSync(file, 'utf8'));
const methods = Object.entries(inv.groups).flatMap(([group, entries]) => {
  if (!Array.isArray(entries) || entries.length === 0) throw Error('Empty group: '+group);
  for (const method of entries) {
    if (!method.startsWith(group+'.')) throw Error('Mismatched group: '+method);
  }
  return entries;
});
if (new Set(methods).size !== methods.length) throw Error('Duplicate API methods');
if (methods.length !== inv.source.method_count) throw Error('Method count mismatch');
if (methods.length !== 174) throw Error('Expected 174 inventoried API methods; review any changes explicitly');
if (Object.keys(inv.groups).length !== 39) throw Error('Expected 39 API namespaces');
if (inv.source.path !== 'src/Code.gs') throw Error('Unexpected inventory source');
const sourceFile = process.argv[2];
if (!sourceFile) throw Error('Pass the baseline src/Code.gs path');
const source = fs.readFileSync(sourceFile, 'utf8');
const whitelist = source.match(/^const API_ = \{\s*\n([\s\S]*?)^\};/m);
if (!whitelist) throw Error('Cannot locate the Apps Script API_ whitelist');
const sourceMethods = Array.from(
  whitelist[1].matchAll(/^\s*'([\w.]+)'\s*:\s*function\b/gm),
  ([, method]) => method
);
if (new Set(sourceMethods).size !== sourceMethods.length) {
  throw Error('Duplicate methods in the source whitelist');
}
const inventorySet = new Set(methods);
const sourceSet = new Set(sourceMethods);
const missing = sourceMethods.filter(method => !inventorySet.has(method));
const extra = methods.filter(method => !sourceSet.has(method));
if (missing.length || extra.length) {
  throw Error('Source inventory mismatch\nMissing: ' + missing.join(', ') + '\nExtra: ' + extra.join(', '));
}
console.log('PASS: ' + methods.length + ' API methods match the Apps Script source whitelist');
