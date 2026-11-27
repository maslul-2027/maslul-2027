#!/usr/bin/env node
'use strict';
// Contract route parity guard. Reads THREE independent sources and fails (exit 1) on any silent change:
//   1. docs/capability-inventory.json   — the canonical, approved 174 original contract routes (never edited)
//   2. src/Code.gs API_ whitelist       — the routes the engine really exposes
//   3. docs/route-evidence-ledger.json  — every current route classified once
// Rules: all 174 originals present everywhere; no duplicate ids; the ONLY extras are the reviewed explicit additions below
// (adding a route needs a deliberate edit here, in the same reviewed PR); each addition has a real dispatch function;
// ledger == whitelist == 174 + additions. It says nothing about whether routes are operational: that is the evidence ledger's job.
const fs = require('fs'), path = require('path'); const root = path.join(__dirname, '..');
const REVIEWED_ADDITIONS = { 'fitness.preview': 'Fitness.preview', 'fitness.reference': 'Fitness.reference', 'reports.exportAuthorize': 'Reports.exportAuthorize', 'reports.exportComplete': 'Reports.exportComplete', 'navevents.adopt': 'NavEvents.adopt', 'navevents.create': 'NavEvents.create', 'navevents.get': 'NavEvents.get', 'navevents.legacy': 'NavEvents.legacy', 'navevents.list': 'NavEvents.list', 'navevents.setStatus': 'NavEvents.setStatus', 'navevents.update': 'NavEvents.update' };   // fitness regular-scoring feature, reviewed in PR #88
const EXPECTED_ORIGINAL = 174;
function load(opts) {
  opts = opts || {}; const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  const inv = opts.inventory || JSON.parse(rd('docs/capability-inventory.json')), ledger = opts.ledger || JSON.parse(rd('docs/route-evidence-ledger.json')), code = opts.code != null ? opts.code : rd('src/Code.gs');
  const block = code.slice(code.indexOf('const API_'), code.indexOf('};', code.indexOf('const API_')));
  return { inv, ledger, code, whitelist: Array.from(block.matchAll(/^\s*'([A-Za-z]+\.[A-Za-z]+)':(.*)$/gm)).map(m => ({ id: m[1], line: m[2] })) };
}
function compute(opts) {
  const s = load(opts), errors = [], dup = a => a.filter((x, i) => a.indexOf(x) !== i);
  const orig = Object.values(s.inv.groups || {}).reduce((a, g) => a.concat(g), []), origSet = new Set(orig);
  const wl = s.whitelist.map(x => x.id), wlSet = new Set(wl), led = (s.ledger.rows || []).map(r => r.route), ledSet = new Set(led);
  if (dup(orig).length) errors.push('duplicate ids in capability-inventory: ' + [...new Set(dup(orig))].join(', '));
  if (dup(wl).length) errors.push('duplicate ids in the Code.gs API_ whitelist: ' + [...new Set(dup(wl))].join(', '));
  if (dup(led).length) errors.push('duplicate route ids in route-evidence-ledger: ' + [...new Set(dup(led))].join(', '));
  if (origSet.size !== EXPECTED_ORIGINAL) errors.push('canonical inventory has ' + origSet.size + ' unique routes, expected exactly ' + EXPECTED_ORIGINAL);
  const approved = new Set([...origSet, ...Object.keys(REVIEWED_ADDITIONS)]);
  for (const [name, set] of [['Code.gs whitelist', wlSet], ['route-evidence-ledger', ledSet]]) {
    const missing = [...origSet].filter(x => !set.has(x)), extra = [...set].filter(x => !approved.has(x)), lostAdd = Object.keys(REVIEWED_ADDITIONS).filter(x => !set.has(x));
    if (missing.length) errors.push(name + ' is MISSING original routes: ' + missing.join(', '));
    if (extra.length) errors.push(name + ' has UNEXPECTED extra routes (not in the 174 and not a reviewed addition): ' + extra.join(', '));
    if (lostAdd.length) errors.push(name + ' lost reviewed additions: ' + lostAdd.join(', '));
  }
  for (const [route, fn] of Object.entries(REVIEWED_ADDITIONS)) {
    const e = s.whitelist.find(x => x.id === route); if (e && !e.line.includes(fn + '(')) errors.push(route + ' does not dispatch to ' + fn);
    if (!new RegExp('\\b' + fn.replace('.', '\\.') + '\\s*[:=]|\\b' + fn.split('.')[1] + '\\s*:\\s*function|\\b' + fn.split('.')[1] + '\\s*\\(').test(s.code)) errors.push(fn + ' implementation not found in Code.gs');
  }
  const unclassified = (s.ledger.rows || []).filter(r => !r.status).map(r => r.route); if (unclassified.length) errors.push('ledger rows without a status: ' + unclassified.join(', '));
  const preserved = [...origSet].filter(x => wlSet.has(x) && ledSet.has(x)).length, additions = [...ledSet].filter(x => !origSet.has(x) && approved.has(x)).sort(), classified = (s.ledger.rows || []).filter(r => r.status).length;
  if (s.ledger.summary && s.ledger.summary.total !== led.length) errors.push('ledger summary.total (' + s.ledger.summary.total + ') != rows (' + led.length + ')');
  return { errors, preserved, original: origSet.size, additions, classified, current: led.length, line: preserved + '/' + origSet.size + ' preserved; additions ' + additions.join(', ') + '; current ' + classified + '/' + led.length + ' classified' };
}
module.exports = { compute, REVIEWED_ADDITIONS, EXPECTED_ORIGINAL };
if (require.main === module) { const r = compute(); if (r.errors.length) { r.errors.forEach(e => console.error('FAIL ' + e)); console.error('CONTRACT ROUTE PARITY FAILED'); process.exit(1); } console.log(r.line); console.log('CONTRACT ROUTE PARITY OK (classification only: not a claim that all ' + r.current + ' routes are operational)'); }
