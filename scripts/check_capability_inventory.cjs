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
if (methods.length !== 140) throw Error('Expected 140 inventoried API methods; review any changes explicitly');
if (Object.keys(inv.groups).length !== 39) throw Error('Expected 39 API namespaces');
if (inv.source.path !== 'src/Code.gs') throw Error('Unexpected inventory source');
console.log('PASS: '+methods.length+' API methods in '+Object.keys(inv.groups).length+' groups; inventory only, no runtime assertion');
