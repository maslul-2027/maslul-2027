// Runs every suite and reports THREE separate states per suite: PASS (ran, all passed) / FAIL (ran and failed, crashed, or produced no result line) / SKIP (did not run: missing dependency/environment, or UI not requested).
// Exit code: non-zero if ANY suite FAILED. SKIP alone does not fail the run — unless --strict is given (then SKIP also fails). The summary never says "all passed" while anything was skipped.
// Node only; the UI suites need Playwright + Chromium (pass --ui). NOT Apps Script.
const { spawnSync } = require('child_process'); const path = require('path');
const NODE = ['idempotency', 'pin_auth', 'selfsigned', 'report_export', 'backup_restore', 'full_backup', 'documents_server', 'marches_scope', 'marches_server', 'launcher_smoke', 'hosting_templates', 'launcher_env_preflight', 'ab_sessions_server', 'contract_route_parity', 'auth_gateway', 'preview_fresh', 'preview_contracts', 'run', 'd7_authz', 'pd2_corrections', 'pd5_f1_fitness_snapshot', 'integration', 'hardening', 'soldiers', 'stage3', 'v1_tracking', 'v1_qual', 'v1_private', 'v1_alerts', 'v1_forms', 'emergency_orphan_ui_contract', 'v1_dashboard', 'v1_docs', 'v1_reports', 'v1_import', 'v1_import_dups', 'v1_import_infile', 'v1_ocr', 'v1_assistant', 'v1_backup', 'v1_migration', 'v1_card', 'v1_pentest', 'pd6_meetings_tasks', 'pd61_qa_fixes', 'uxqa_server', 'v1_system', 'b7_gaps', 'stg_setup_guard', 'stg_f2_dailyjob', 'stg_clean_machine_script', 'r3_forms_reports', 'v1_restore_fault', 'v1_replaceall_text', 'v1_preflight', 'v103_fitness', 'v104_audit', 'v105_missing', 'v106_pullups', 'v105_fitness_governance', 'demo_data_audit', 'r5_privacy_subcohort', 'r5_final_closure', 'src_identity'];
const UI = ['ui_staging_smoke', 'ui_smoke', 'ui_v1', 'ui_form', 'ui_fitness', 'ui_b7b8', 'ui_r3', 'ui_pd1', 'ui_pd2', 'ui_pd6_meetings', 'ui_pd6_qa', 'ui_uxqa', 'ui_ux_sprint1', 'ui_synthetic_app'];
const wantUi = process.argv.includes('--ui'), strict = process.argv.includes('--strict');
const fs = require('fs'); const exists = s => fs.existsSync(path.join(__dirname, s + '.js'));
const rows = []; let tp = 0, tf = 0;
// Always show what this run can actually do (Node / Playwright / Chromium).
const envRun = spawnSync('node', [path.join(__dirname, 'env_check.js')], { encoding: 'utf8', timeout: 60000 });
console.log('ENVIRONMENT\n' + (envRun.stdout || envRun.stderr || '(env_check failed)').trim() + '\nFLAGS: ui=' + wantUi + ' strict=' + strict + '\n');
const run = s => { const r = spawnSync('node', [path.join(__dirname, s + '.js')], { encoding: 'utf8', timeout: 590000 }); const out = (r.stdout || '') + (r.stderr || '');
  const sk = /^SKIP[^\n]*/m.exec(out), m = /TOTAL pass=(\d+) fail=(\d+)/.exec(out);
  if (sk && !m) return UI.includes(s) && wantUi ? { s, state: 'FAIL', pass: 0, fail: 0, why: 'UI was requested (--ui) but the suite could not run: ' + sk[0].replace(/^SKIP\s*/, '') } : { s, state: 'SKIP', pass: 0, fail: 0, why: sk[0].replace(/^SKIP\s*/, '') };
  if (!m) return { s, state: 'FAIL', pass: 0, fail: 1, why: r.error ? String(r.error.message) : 'no result line (crash or timeout), exit ' + r.status };
  const p = +m[1], f = +m[2]; if (f || r.status) console.log('--- ' + s + ': failing lines ---\n' + out.split('\n').flatMap((l, i, lines) => /^(FAIL|not ok|\s*✗|AssertionError|Error)/.test(l.trim()) ? [l, lines[i + 1] || '', lines[i + 2] || ''] : []).slice(0, 36).map(l => l.slice(0, 1000)).join('\n') + '\n---'); const bt = /BY TYPE: (\{[^\n]*\})/.exec(out); let types = null; try { types = bt ? JSON.parse(bt[1]) : null; } catch (e) {}
  if (!f && !r.status && p === 0) return { s, state: 'FAIL', pass: 0, fail: 0, why: 'suite ran but produced 0 tests (a suite that proves nothing is a failure)' };
  return { s, types, state: f || r.status ? 'FAIL' : 'PASS', pass: p, fail: f, why: f ? 'failed tests' : (r.status ? 'non-zero exit with no failed test' : '') }; };
NODE.filter(exists).forEach(s => rows.push(run(s)));
UI.filter(exists).forEach(s => rows.push(wantUi ? run(s) : { s, state: 'SKIP', pass: 0, fail: 0, why: 'UI suites not requested (run with --ui; needs Playwright + Chromium)' }));
rows.forEach(r => { tp += r.pass; tf += r.fail; console.log(r.state.padEnd(5) + ' ' + r.s.padEnd(18) + ' pass=' + String(r.pass).padEnd(4) + ' fail=' + r.fail + (r.why ? '   — ' + r.why : '')); });
const c = { PASS: 0, FAIL: 0, SKIP: 0 }; rows.forEach(r => c[r.state]++);
// separate counts: Node unit / Node integration / Node hardening / browser. Suites that print "BY TYPE" are split by their own tags; the three legacy suites are classified by name.
const cat = { node_unit: 0, node_integration: 0, node_hardening: 0, browser: 0, unclassified: 0 };
rows.forEach(r => { if (r.state === 'SKIP') return; if (UI.includes(r.s)) { cat.browser += r.pass; return; }
  if (r.types) { cat.node_unit += r.types.unit || 0; cat.node_integration += r.types.integration || 0; cat.node_hardening += r.types.hardening || 0; const sum = (r.types.unit || 0) + (r.types.integration || 0) + (r.types.hardening || 0); cat.unclassified += r.pass + r.fail - sum; }
  else if (r.s === 'run') cat.node_unit += r.pass; else if (r.s === 'integration') cat.node_integration += r.pass; else if (r.s === 'hardening') cat.node_hardening += r.pass; else cat.unclassified += r.pass; });
const nodeTotal = cat.node_unit + cat.node_integration + cat.node_hardening + cat.unclassified;
console.log('\nSUITES: ' + rows.length + ' total — ' + c.PASS + ' PASS, ' + c.FAIL + ' FAIL, ' + c.SKIP + ' SKIP');
console.log('TESTS RUN: ' + (tp + tf) + ' — passed ' + tp + ', failed ' + tf + ' (tests inside SKIPPED suites are NOT counted)');
console.log('BREAKDOWN (passed tests): Node ' + nodeTotal + ' (unit ' + cat.node_unit + ', integration ' + cat.node_integration + ', hardening ' + cat.node_hardening + (cat.unclassified ? ', unclassified ' + cat.unclassified : '') + ') | browser ' + cat.browser + ' | suites run: ' + rows.filter(r => r.state !== 'SKIP').length + '/' + rows.length);
if (c.SKIP) console.log('SKIPPED (not run): ' + rows.filter(r => r.state === 'SKIP').map(r => r.s + ' [' + r.why + ']').join('; '));
const bad = c.FAIL > 0 || (strict && c.SKIP > 0);
console.log(bad ? 'RESULT: FAILED' + (c.FAIL ? '' : ' (strict: skipped suites)') : (c.SKIP ? 'RESULT: NO FAILURES, BUT ' + c.SKIP + ' SUITE(S) WERE SKIPPED — this is NOT a complete pass' : 'RESULT: ALL SUITES RAN AND PASSED'));
try { fs.writeFileSync(path.join(__dirname, 'last_run.json'), JSON.stringify({ when: new Date().toISOString(), node: process.version, flags: { ui: wantUi, strict }, env_ok: envRun.status === 0, suites: rows, totals: { breakdown: cat, node_total: nodeTotal, suites: rows.length, PASS: c.PASS, FAIL: c.FAIL, SKIP: c.SKIP, tests_run: tp + tf, passed: tp, failed: tf }, result: bad ? 'FAILED' : (c.SKIP ? 'INCOMPLETE' : 'COMPLETE_PASS') }, null, 1)); } catch (e) {}
process.exit(bad ? 1 : 0);
