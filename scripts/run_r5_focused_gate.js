#!/usr/bin/env node
'use strict';
// Reproducible, dependency-free focused R5 gate. This is not the full regression.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const suites = [
  'tests/v1_import.js',
  'tests/v1_import_infile.js',
  'tests/pd6_meetings_tasks.js',
  'tests/v1_reports.js',
  'tests/v1_pentest.js',
  'tests/src_identity.js',
  'tests/emergency_orphan_ui_contract.js',
  'tests/v1_forms.js',
  'tests/v1_backup.js',
  'tests/v1_restore_fault.js',
  'tests/r5_privacy_subcohort.js',
  'tests/r5_final_closure.js',
];
let totalPass = 0;
const results = [];
for (const suite of suites) {
  const run = spawnSync(process.execPath, [path.resolve(suite)], {
    cwd: process.cwd(), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  process.stdout.write(`\n===== ${suite} =====\n${output}`);
  const matches = [...output.matchAll(/TOTAL pass=(\d+) fail=(\d+)/g)];
  const pass = matches.reduce((n, m) => n + Number(m[1]), 0);
  const fail = matches.reduce((n, m) => n + Number(m[2]), 0);
  const ok = run.status === 0 && matches.length > 0 && fail === 0;
  results.push({ suite, pass, fail, exit_code: run.status, status: ok ? 'PASS' : 'FAIL' });
  totalPass += pass;
  if (!ok) {
    process.stderr.write(`\nGATE STOP: ${suite} did not produce a clean passing summary.\n`);
    process.exitCode = 1;
    break;
  }
}
const summary = {
  gate: 'R5_FOCUSED_TARGETED_ONLY',
  status: process.exitCode === 1 ? 'FAIL' : (results.length === suites.length ? 'PASS' : 'INCOMPLETE'),
  files_requested: suites.length,
  files_run: results.length,
  checks_passed: totalPass,
  checks_failed: results.reduce((n, r) => n + r.fail, 0),
  suites: results,
  full_regression: 'NOT_ESTABLISHED',
};
process.stdout.write(`\nR5 FOCUSED GATE SUMMARY\n${JSON.stringify(summary, null, 2)}\n`);
if (results.length !== suites.length || totalPass !== 124) process.exitCode = 1;
