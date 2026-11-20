// Mutation testing: deliberately break the code in a TEMP COPY and verify the test-suite notices. The real src/ is never modified.
// Usage: node scripts/mutation_run.js [--ui]   (--ui also runs the browser suites for the UI mutation; needs Playwright)
// Exit code 1 if any mutation SURVIVES (tests still pass) or cannot be applied.
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..'), wantUi = process.argv.includes('--ui'), onlyArg = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7), outArg = (process.argv.find(a => a.startsWith('--out=')) || '').slice(6);
// --only=M01-M29 | M30,M31 (sharding: run a subset; use --out=<file> so shards do not overwrite each other; merge afterwards) — default = all mutations, results in tests/mutation_results.json
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-mut-')); fs.cpSync(root, tmp, { recursive: true, filter: s => !/node_modules|last_run\.json|mutation_results\.json/.test(s) });
/* src_identity pins the exact src of the product; EVERY mutation changes src, so it would 'catch' all of them trivially. In the temp copy it is stubbed so a mutant counts as CAUGHT only when a behavioural test fails. */
fs.writeFileSync(path.join(tmp, 'tests', 'src_identity.js'), "console.log('SRC-IDENTITY stubbed in the mutation copy (mutations always change src)');\nconsole.log('SRC-IDENTITY TOTAL pass=4 fail=0');\n");
if (fs.existsSync(path.join(root, 'node_modules'))) fs.symlinkSync(path.join(root, 'node_modules'), path.join(tmp, 'node_modules'), 'dir'); /* browser mutation needs Playwright */
const M = [
  // ---- missing / invalid value becomes zero (v1.0.5 family) ----
  ['M01 validNumber accepts empty string as 0', 'src/Calc.gs', "return /^[+-]?(\\d+\\.?\\d*|\\.\\d+)$/.test(s) ? Number(s) : null;", "return /^[+-]?(\\d*\\.?\\d*)$/.test(s) ? Number(s) : null;"],
  ['M02 validNumber accepts booleans', 'src/Calc.gs', "    return null;\n  },\n  hasScore", "    if (typeof v === 'boolean') return v ? 1 : 0;\n    return null;\n  },\n  hasScore"],
  ['M03 Snapshot.mean_ turns missing into 0', 'src/Snapshot.gs', "return Calc.mean(rows.map(function (r) { return Calc.validNumber(r[key]); }));", "return Calc.mean(rows.map(function (r) { return Calc.validNumber(r[key]) || 0; }));"],
  ['M04 Calc.mean counts non-numbers as 0', 'src/Calc.gs', ".filter(function (v) { return typeof v === 'number' && Number.isFinite(v); });\n    if (!xs.length)", ".map(function (v) { return typeof v === 'number' && Number.isFinite(v) ? v : 0; });\n    if (!xs.length)"],
  ['M05 per-soldier mean (groups) keeps unscored rows (both layers removed: Snapshot.mean_ also filters, so this needs a double mutation)', 'src/Dashboard.gs', "ids[r.soldier_id] && Calc.hasScore(r[field])", "ids[r.soldier_id]", [["push({ v: Calc.validNumber(r[field]) })", "push({ v: Number(r[field]) })"]]],
  ['M06 trends series keeps unscored rows', 'src/Dashboard.gs', "return Calc.hasScore(r[field]); }).map(function (r) { return { date:", "return true; }).map(function (r) { return { date:"],
  ['M07 strengths/gaps keeps unscored rows', 'src/Dashboard.gs', "return Calc.hasScore(r[D[d][1]]); }); if (rs.length < minRec)", "return true; }); if (rs.length < minRec)"],
  ['M08 completeness counts unscored as scored', 'src/Dashboard.gs', "const S = Analytics.distinct_(rows, function (r) { return Calc.hasScore(r[SC]); });", "const S = Analytics.distinct_(rows);"],
  ['M09 health index ignores missing domains', 'src/Dashboard.gs', "if (missing.length) return { index: null, reason: 'חסרים", "if (false) return { index: null, reason: 'חסרים"],
  ['M10 alerts keep unscored rows', 'src/Alerts.gs', ".filter(function (r) { return Calc.hasScore(r[spec[1]]); }), by = {};", ".filter(function (r) { return true; }), by = {};"],
  ['M11 fitness aggregate counts unscored as complete', 'src/Fitness.gs', "const withW = rows.filter(function (r) { return Calc.hasScore(r.weighted_score); });", "const withW = rows;"],
  ['M12 marksmanship aggregate counts unscored', 'src/Marksmanship.gs', "const withEx = sorted.filter(function (r) { return Calc.hasScore(r.examiner_score); });", "const withEx = sorted;"],
  ['M13 navigation aggregate: blank final score -> 0', 'src/Navigation.gs', "const overall = Calc.mean(rows.map(function (r) { return Calc.validNumber(r.final_score); }));", "const overall = Calc.mean(rows.map(function (r) { return Number(r.final_score); }));"],
  ['M14 report prints 0 for a missing score', 'src/Reports.gs', "return n === null ? '' : Util.display1(n);", "return n === null ? '0' : Util.display1(n);"],
  ['M15 fitness result stored with 0 when incomplete', 'src/Fitness.gs', "weighted_score: c.weighted === null ? '' : c.weighted, scoring_version_id: c.version_id, notes: notes", "weighted_score: c.weighted === null ? 0 : c.weighted, scoring_version_id: c.version_id, notes: notes"],
  ['M16 missing component becomes 0 in the weighted total', 'src/Calc.gs', "if (missing.length) return { score: null, missing: missing };", "missing.forEach(function (c) { scores[c] = 0; });"],
  ['M17 not-entered component scored 0', 'src/Fitness.gs', "if (Util.isBlank(raw)) return { score: null, reason: 'not_entered' };", "if (Util.isBlank(raw)) return { score: 0, reason: 'ok' };"],
  // ---- fitness rules / governance ----
  ['M18 regular-test weights altered', 'src/Fitness.gs', "run150x2: 10, run3km: 30", "run150x2: 15, run3km: 25"],
  ['M19 DRAFT versions used for scoring', 'src/Fitness.gs', "x.status === 'APPROVED'; }).forEach(function (x) { Db.update('FitnessScoringVersions', x.id, { status: 'SUPERSEDED' }); });", "x.status === 'APPROVED'; }).forEach(function (x) { /*kept*/ });"],
  ['M20 approve without the verification flag', 'src/Fitness.gs', "if (p.verified_against_source !== true) throw", "if (false) throw"],
  ['M21 time given as a bare number is accepted', 'src/Fitness.gs', "if (typeof raw !== 'string') throw new AppError('VALIDATION', 'זמן חייב", "if (false) throw new AppError('VALIDATION', 'זמן חייב"],
  ['M23 data-quality report writes data (read-only violated)', 'src/Fitness.gs', "    return { results: rows.length, complete: complete,", "    if (rows[0]) Db.update('FitnessTests', rows[0].id, { notes: 'x' });\n    return { results: rows.length, complete: complete,"],
  ['M24 retroactive: approving a version rescored old results', 'src/Fitness.gs', "Db.update('FitnessScoringVersions', v.id, { status: 'APPROVED', approved_by: ctx.email,", "Db.where('FitnessTests', function (x) { return x.course_id === v.course_id; }).forEach(function (x) { Db.update('FitnessTests', x.id, { weighted_score: 1 }); }); Db.update('FitnessScoringVersions', v.id, { status: 'APPROVED', approved_by: ctx.email,"],
  ['M25 boys may use the no-weight pull-up table (policy removed)', 'src/Fitness.gs', "forbiddenTable_(gender, component, variant) { return gender === 'M' && component === 'pullups' && variant !== Fitness.VEST_VARIANT; },", "forbiddenTable_(gender, component, variant) { return false; },"],
  ['M26 silent fallback: boys pull-ups with no vest table use any table', 'src/Fitness.gs', "if (gender === 'M' && comp === 'pullups') { if (!variants[Fitness.VEST_VARIANT]) return { score: null, reason: 'no_table' }; variant = Fitness.VEST_VARIANT; }", "if (gender === 'M' && comp === 'pullups') { variant = variants[Fitness.VEST_VARIANT] ? Fitness.VEST_VARIANT : vk[0]; }"],
  ['M27 girls one rep scores 45 again', 'src/FitnessDraft.gs', '[50, 2, 2], [40, 1, 1]]', '[50, 2, 2], [45, 1, 1]]'],
  ['M28 typeSetVariant accepts the no-weight track', 'src/Fitness.gs', "if (component !== 'pullups' || (Util.str(variant) !== '' && Util.str(variant) !== Fitness.VEST_VARIANT)) throw", "if (false) throw"],
  ['M29 import brings in the excluded historical table', 'src/Fitness.gs', "if (t.excluded || Fitness.forbiddenTable_(t.gender, t.component, t.variant)) return;", ""],
  ['M30 B7 ignores team/department visibility', 'src/Fitness.gs', "Util.isTrue(x.active) && vis(x); });\n    const ids", "Util.isTrue(x.active); });\n    const ids"],
  ['M31 B7 counts a not-entered component as complete', 'src/Fitness.gs', "if (x.reason === 'not_entered') return 'missing';", "if (x.reason === 'not_entered') return 'complete';"],
  ['M32 B7 team filter ignored', 'src/Fitness.gs', "if (opts.teamId) rows = rows.filter(", "if (false) rows = rows.filter("],
  ['M33 B7 unscorable (blocked) component counted as complete', 'src/Fitness.gs', "return 'blocked';                                                      // no_table", "return 'complete';                                                      // no_table"],
  ['M34 B7 soldier with no result treated as complete', 'src/Fitness.gs', "const st = noRes ? 'missing' : stateOf(cs, c, required);", "const st = noRes ? 'na' : stateOf(cs, c, required);"],
  ['M35 B7 pending-review reported as missing (states not told apart)', 'src/Fitness.gs', "if (x.reason === 'out_of_range') return 'review';", "if (x.reason === 'out_of_range') return 'missing';"],
  ['M36 B7 component filter ignored', 'src/Fitness.gs', "if (opts.component) rows = rows.filter(", "if (false) rows = rows.filter("],
  ['M37 B8 UI: local mm:ss check skipped (invalid time is sent)', 'src/Index.html', "var a=checkRequired(fields,ins),b=checkTimes(fields,ins),first=null;", "var a=checkRequired(fields,ins),b=null,first=null;", 'uib'],
  ['M38 B8 UI: seconds above 59 accepted locally', 'src/Index.html', "if(+m[2]>59)", "if(false)", 'uib'],
  ['M39 B7 required component absent from JSON treated as na', 'src/Fitness.gs', "if (x === undefined) return 'missing';", "if (x === undefined) return 'na';"],
  ['M40 B7 corrupt component_scores_json treated as complete', 'src/Fitness.gs', "if (cs === null) return 'blocked';", "if (cs === null) return 'complete';"],
  ['M41 B7 unknown test type: no required set => na', 'src/Fitness.gs', "if (!required) return 'blocked';", "if (!required) return 'na';"],
  ['M42 B7 ok without numeric score counted complete', 'src/Fitness.gs', "return Calc.hasScore(x.score) ? 'complete' : 'blocked';", "return 'complete';"],
  ['M43 B7 required set ignores the test type (everything required)', 'src/Fitness.gs', "if (required.indexOf(c) === -1) return 'na';", ""],
  ['M44 R3 weights_json used without semantic validation', 'src/Fitness.gs', "Fitness.checkWeights_(w); return Object.keys(w);", "return Object.keys(w);"],
  ['M45 R3 weights_json of wrong shape (array/number) treated as missing', 'src/Fitness.gs', "if (typeof w !== 'object' || Array.isArray(w)) return null;", ""],
  ['M46 R3 components_json fallback not validated', 'src/Fitness.gs', "if (typeof a[i] !== 'string' || Fitness.COMPONENTS.indexOf(a[i]) === -1 || seen[a[i]]) return null;", ""],
  ['M47 R3 form link: any URL accepted (edit link exposed)', 'src/Forms.gs', "return m ? u : null;", "return u;"],
  ['M48 R3 form link: commander without assignment allowed', 'src/Forms.gs', "if (ctx.role !== ROLES.ADMIN && !Assignments.mine(ctx, courseId).has_assignment) throw new AppError('FORBIDDEN', 'אין הרשאה.');", ""],
  ['M50 R3 UI: reports shortcut shown to non-admin', 'src/Index.html', "if(isAdmin())bar.appendChild(el('button',{id:'toReports'", "bar.appendChild(el('button',{id:'toReports'", 'uir'],
  ['M51 F-1 createFirstCourse callable by any user (guard removed)', 'src/Setup.gs', "function createFirstCourse(name, startDate) {\n  Auth.assertAdminCaller_();", "function createFirstCourse(name, startDate) {"],
  ['M52 F-1 guard lets any non-empty caller through', 'src/AuthAudit.gs', "if (!admin || !caller || caller !== admin) throw", "if (!admin || !caller || false) throw"],
  ['M53 F-1 migrateToV1 callable by any user (guard removed)', 'src/Setup.gs', "function migrateToV1() {\n  Auth.assertAdminCaller_();", "function migrateToV1() {"],
  ['M54 F-2 runDailyJobNow callable by any user (guard removed)', 'src/Code.gs', "function runDailyJobNow() { Auth.assertAdminCaller_(); return dailyJob_(); }", "function runDailyJobNow() { return dailyJob_(); }"],
  ['M55 F-2 Preflight accepts the legacy public trigger name as PASS', 'src/Preflight.gs', "else if (rep.triggers.indexOf(Backup.DAILY_HANDLER) !== -1) add(", "else if (rep.triggers.indexOf(Backup.DAILY_HANDLER) !== -1 || rep.triggers.indexOf('dailyJob') !== -1) add("],
  ['M56 F-2 installDailyTrigger leaves a legacy public-name trigger in place', 'src/Backup.gs', "DAILY_HANDLERS: ['dailyJob_', 'dailyJob'],", "DAILY_HANDLERS: ['dailyJob_'],"],
  ['M57 F-2 trigger handler name changed back to a non-private name', 'src/Backup.gs', "DAILY_HANDLER: 'dailyJob_',", "DAILY_HANDLER: 'dailyJob',"],
  ['M58 install script: unverified lock reported as a plain PASS', 'scripts/clean_machine_verify.sh', "echo \"RESULT: PASS_WITH_UNVERIFIED_LOCK (all steps ran, but this is NOT a full PASS)\"", "echo \"RESULT: PASS (all steps completed on THIS machine, with the package's own lock)\"", 'sh'],
  ['M59 install script: output directory relative again (STATUS lands in the project after cd)', 'scripts/clean_machine_verify.sh', 'OUT="$ORIG/return"; WORK="$ORIG/work"', 'OUT="return"; WORK="work"', 'sh'],
  // ---- product-dev2: correction requests (snapshot, scope, display) ----
  ['M60 correction: snapshot not stored at request time', 'src/Records.gs', "before_json: Util.jsonCell(before),", "before_json: '',", 'p2'],
  ['M61 correction: previous value recomputed live from the record instead of the stored snapshot', 'src/Records.gs', "before: hasSnap ? Util.parseJson(q.before_json, null) : null,", "before: hasSnap && orig ? (function () { const o = {}; Object.keys(Util.parseJson(q.changes_json, {})).forEach(function (k) { o[k] = orig[k]; }); return o; })() : null,", 'p2'],
  ['M62 correction: snapshot takes the REQUESTED value instead of the current one', 'src/Records.gs', "before[k] = snapSrc[k] === undefined || snapSrc[k] === null ? '' : snapSrc[k];", "before[k] = changes[k];", 'p2'],
  ['M63 correction list: commander sees requests of other commanders', 'src/Records.gs', "      if (q.requested_by !== ctx.email) return false;\n      // v0.2.2", "      // v0.2.2", 'p2'],
  ['M64 correction list: commander sees requests of cancelled / hidden records', 'src/Records.gs', "return !!orig && orig.course_id === courseId && orig.record_status === RECORD_STATUS.ACTIVE && Records.soldierVisible_(ctx, orig);\n    });\n    // product-dev2", "return true;\n    });\n    // product-dev2", 'p2'],
  ['M65 correction list: old request without snapshot reported as having one', 'src/Records.gs', "has_snapshot: hasSnap && Util.parseJson(q.before_json, null) !== null,", "has_snapshot: true,", 'p2'],
  ['M66 UI: request without snapshot shows the raw value "undefined"', 'src/Index.html', "text:pv===undefined?'אין ערך קודם שמור':(pv===null?'(ריק)':pv)", "text:String(pv)", 'up2'],
  ['M67 UI: reason of a request inserted as raw HTML', 'src/Index.html', "el('div',{class:'corr-reason',text:'סיבת הבקשה: '+q.reason})", "(function(){var d=el('div',{class:'corr-reason'});d.innerHTML='סיבת הבקשה: '+q.reason;return d;})()", 'up2'],
  ['M68 UI: internal English field name shown instead of the Hebrew label', 'src/Index.html', "plan_score:'ציון תכנון'", "plan_score:'plan_score'", 'up2'],
  ['M69 UI: dashboard soldier shortcut does not open the soldier', 'src/Index.html', "onclick:function(){showCard(x.id);}}));});if(i.sols.length>5)", "onclick:function(){showTab('soldiers');}}));});if(i.sols.length>5)", 'up2'],
  ['M70 UI: previous and requested columns swapped', 'src/Index.html', "tr.appendChild(el('td',{class:'cprev'+(bf&&pv!==undefined?'':' nosnap'),text:pv===undefined?'אין ערך קודם שמור':(pv===null?'(ריק)':pv)}));tr.appendChild(el('td',{class:'cnew',text:nv===null?'(ריק)':nv}));", "tr.appendChild(el('td',{class:'cnew',text:nv===null?'(ריק)':nv}));tr.appendChild(el('td',{class:'cprev'+(bf&&pv!==undefined?'':' nosnap'),text:pv===undefined?'אין ערך קודם שמור':(pv===null?'(ריק)':pv)}));", 'up2'],
  ['M71 UI: dashboard readiness task loses its soldier names', 'src/Index.html', "'למסך כשירות','readiness',sols(no.map(", "'למסך כשירות','readiness',[].concat(no.map(", 'up2'],
  // ---- import duplicate detection (dev3 fix: fitness compares the normalised stored shape, components inside raw_values_json) ----
  ['M72 import fitness duplicate: component values ignored (type+date only)', 'src/Import.gs', "return Fitness.COMPONENTS.every(function (c) { return Import.compNorm_(have[c]) === Import.compNorm_(want[c]); });", "return true;", 'imp'],
  ['M73 import fitness duplicate: cancelled records count as duplicates', 'src/Import.gs', "r.soldier_id !== soldierId || r.record_status !== RECORD_STATUS.ACTIVE || ", "r.soldier_id !== soldierId || ", 'imp'],
  ['M74 import fitness duplicate: test type ignored', 'src/Import.gs', "r.test_type_id !== p.test_type_id || ", "", 'imp'],
  ['M75 import fitness duplicate: test date ignored', 'src/Import.gs', " || Util.cellToIsoDate(r.test_date) !== p.test_date) return false;", ") return false;", 'imp'],
  ['M76 import fitness duplicate: no value normalisation (8 vs "8.0")', 'src/Import.gs', "return /^-?\\d+(\\.\\d+)?$/.test(s) ? String(Number(s)) : s; },", "return s; },", 'imp'],
  ['M77 import fitness: back to the generic column comparison (the reported bug)', 'src/Import.gs', "const same = target === 'fitness' ? Import.fitnessDuplicate_(courseId, sol.id, prepared) : Db.where", "const same = Db.where", 'imp'],
  ['M78 import fitness duplicate: other soldiers\' records match', 'src/Import.gs', "r.course_id !== courseId || r.soldier_id !== soldierId || ", "r.course_id !== courseId || ", 'imp'],
  ['M79 import generic (navigation/marksmanship) duplicate: any single field match is enough', 'src/Import.gs', "Object.keys(data).every(function (k) { return k === 'soldier_id'", "Object.keys(data).some(function (k) { return k === 'soldier_id'", 'imp'],
  // ---- duplicates INSIDE one import file (dev4) ----
  ['M80 in-file duplicate check disabled for results (reported bug: 2 identical rows both created)', 'src/Import.gs', "if (p.target !== 'soldiers' && p.target !== 'exams' && r.status === 'ok') {", "if (false) {", 'imf'],
  ['M81 in-file duplicate row reported as an error instead of duplicate', 'src/Import.gs', "return { data: r.data, status: 'duplicate', issues: ['שורה זהה לשורה '", "return { issues: ['שורה זהה לשורה '", 'imf'],
  ['M82 in-file fitness key ignores the component values', 'src/Import.gs', ".concat(Fitness.COMPONENTS.map(function (c) { return Import.compNorm_(data[c]); }))", ".concat([])", 'imf'],
  ['M83 in-file fitness key ignores the test type', 'src/Import.gs', "['f', data.soldier_id, data.test_type_id, Util.cellToIsoDate(data.test_date)]", "['f', data.soldier_id, Util.cellToIsoDate(data.test_date)]", 'imf'],
  ['M84 in-file fitness key ignores the date', 'src/Import.gs', "['f', data.soldier_id, data.test_type_id, Util.cellToIsoDate(data.test_date)]", "['f', data.soldier_id, data.test_type_id]", 'imf'],
  ['M85 in-file fitness key ignores the soldier', 'src/Import.gs', "['f', data.soldier_id, data.test_type_id, Util.cellToIsoDate(data.test_date)]", "['f', data.test_type_id, Util.cellToIsoDate(data.test_date)]", 'imf'],
  ['M86 in-file fitness key not normalised (8 vs "8.0")', 'src/Import.gs', "return Import.compNorm_(data[c]);", "return String(data[c]);", 'imf'],
  ['M87 in-file generic key (navigation/marksmanship) ignores the fields (soldier only)', 'src/Import.gs', "return JSON.stringify([target].concat(Object.keys(data).sort().map(", "return JSON.stringify([target, data.soldier_id].concat([].map(", 'imf'],
  ['M88 in-file duplicates also applied to exams (behaviour change)', 'src/Import.gs', "if (p.target !== 'soldiers' && p.target !== 'exams' && r.status === 'ok') {", "if (p.target !== 'soldiers' && r.status === 'ok') {", 'imf'],
  // ---- product-dev6/6.1: meeting minutes + tasks (Meetings.gs) ----
  ['M90 department filter is not authorised (QA-01)', 'src/Meetings.gs', "if (Meetings.authDepts_(L)[dep] !== 1) throw", "if (false) throw", 'pd61'],
  ['M91 department_ids reveals departments outside the requester authority (QA-01)', 'src/Meetings.gs', "return Meetings.deptIds_(dep, L).filter(function (d) { return A[d] === 1; });", "return Meetings.deptIds_(dep, L).filter(function (d) { return true; });", 'pd61'],
  ['M92 commander authority = every department of the course (QA-01)', 'src/Meetings.gs', "const ids = L.admin ? Object.keys(L.depts) : Meetings.deptIds_(L.scopeFor(L.me), L);", "const ids = Object.keys(L.depts);", 'pd61'],
  ['M93 a commit that threw but landed is reported as a failed save (QA-02)', 'src/Meetings.gs', "if (!committed && Meetings.commitLanded_(m, R)) committed = true;", "", 'pd61'],
  ['M94 audit failure after the commit is answered SAVE_FAILED (QA-02)', 'src/Meetings.gs', "      } catch (ea) {\n        audit = {", "      } catch (ea) {\n        throw new AppError('SAVE_FAILED', 'x');\n        audit = {", 'pd61'],
  ['M95 a failed failure-log turns a clean rollback into SAVE_PARTIAL (QA-02)', 'src/Meetings.gs', "/* best effort: a failed failure-log never turns a clean rollback into SAVE_PARTIAL */", "clean = false;", 'pd61'],
  ['M96 duplicate submit (same request_id) is not recognised', 'src/Meetings.gs', "if (m && Number(m.committed_rev) >= 1) return { replayed: true", "if (false) return { replayed: true", 'pd6'],
  ['M97 a completed task may be cancelled directly (status matrix)', 'src/Meetings.gs', "completed: ['open', 'in_progress'],", "completed: ['open', 'in_progress', 'cancelled'],", 'pd6'],
  ['M98 completed/cancelled tasks can be overdue', 'src/Meetings.gs', "if (Meetings.OPEN_STATES.indexOf(t.status) === -1) return false;\n    const dd", "const dd", 'pd6'],
  ['M99 a commander sees every task of the course (IDOR)', 'src/Meetings.gs', "return Meetings.overlap_(mine, scopeFor(t.assignee_email), teams);", "return true;", 'pd6'],
  // ---- QA complement 2: cross-platform clean-machine verifier (Node port), pure-Node zip, demo-data audit scope exemption ----
  ['M100 node port: unverified lock reported as a plain PASS', 'scripts/clean_machine_verify.js', "RESULT: PASS_WITH_UNVERIFIED_LOCK (all steps ran, but this is NOT a full PASS)", "RESULT: PASS (all steps ran)", 'cm'],
  ['M101 node port: output directory relative again (STATUS lands in the project after chdir)', 'scripts/clean_machine_verify.js', "OUT = path.join(ORIG, 'return'), WORK = path.join(ORIG, 'work')", "OUT = 'return', WORK = 'work'", 'cm'],
  ['M102 node port: package sha256 mismatch is not enforced', 'scripts/clean_machine_verify.js', "if (GOT !== SHA) stop(", "if (false) stop(", 'cm'],
  ['M103 node port: leftover evidence of a previous run is not refused', 'scripts/clean_machine_verify.js', "if (fs.existsSync(OUT) || fs.existsSync(WORK)) {", "if (false) {", 'cm'],
  ['M104 node port: network-only failure reported as FAIL instead of BLOCKED_NETWORK', 'scripts/clean_machine_verify.js', "if (logs.some(f => NET.test(read(f)))) {", "if (false) {", 'cm'],
  ['M105 node port: a package that already contains node_modules is accepted', 'scripts/clean_machine_verify.js', "if (fs.existsSync('node_modules')) stop(", "if (false) stop(", 'cm'],
  ['M106 node port: UNVERIFIED lock exits 0 (looks like a pass to a caller)', 'scripts/clean_machine_verify.js', "a full PASS requires the reviewed lock.\"); process.exit(3);", "a full PASS requires the reviewed lock.\"); process.exit(0);", 'cm'],
  ['M107 node port: npm version is not checked', 'scripts/clean_machine_verify.js', "if (!/^10\\./.test(nn.out)) stop(", "if (false) stop(", 'cm'],
  ['M108 zipnode: CRC-32 is not verified', 'scripts/lib/zipnode.js', "if (crc(d) !== en.crc32) throw", "if (false) throw", 'cm'],
  ['M109 zipnode: path traversal in archive names is accepted (both layers removed)', 'scripts/lib/zipnode.js', "if (n.split('/').some(s => s === '..')) throw new Error('path escapes the target in archive: ' + n);", "", [["if (target !== root && !target.startsWith(root + path.sep)) throw new Error('path escapes the target: ' + nm);", ""]], 'cm'],
  ['M110 zipnode: symlink entries are extracted as files', 'scripts/lib/zipnode.js', "if ((en.mode & 0o170000) === 0o120000) throw", "if (false) throw", 'cm'],
  ['M111 demo audit: scope exemption by prefix (scope + any suffix/path is exempt)', 'tests/demo_data_audit.js', "const isScope = u => SCOPES.has(trimU(u));", "const isScope = u => [...SCOPES].some(s => u.startsWith(s));", 'dda'],
  ['M112 demo audit: every Google API host URL is exempt', 'tests/demo_data_audit.js', "const isScope = u => SCOPES.has(trimU(u));", "const isScope = u => /googleapis\\.com/i.test(u);", 'dda'],
  ['M113 demo audit: path separators not normalised (the Windows failure)', 'tests/demo_data_audit.js', "const rel = relRaw.replace(/\\\\/g, '/'), raw = [];", "const rel = relRaw, raw = [];", 'dda'],
  ['M114 demo audit: http:// variant of a scope is exempt', 'tests/demo_data_audit.js', "const isScope = u => SCOPES.has(trimU(u));", "const isScope = u => SCOPES.has(trimU(u).replace(/^http:/, 'https:'));", 'dda'],
  // ---- product-dev6.2 (uxqa1): emergency contact, attendance visibility, report escaping, UI guards ----
  ['M201 emergency.get: private.read guard removed (any caller reads the contact)', 'src/EmergencyContact.gs', "Private.guard_(ctx, 'private.read', courseId); const s = EmergencyContact.soldier_(ctx, courseId, soldierId);", "const s = EmergencyContact.soldier_(ctx, courseId, soldierId);", 'ux'],
  ['M202 emergency.set: private.write guard removed at BOTH layers (precheck + in-lock recheck)', 'src/EmergencyContact.gs', "Private.guard_(ctx, 'private.write', courseId); const pre = EmergencyContact.soldier_(ctx, courseId, soldierId);", "const pre = EmergencyContact.soldier_(ctx, courseId, soldierId);", [["Private.guard_(ctx, 'private.write', courseId); const s = EmergencyContact.soldier_(ctx, courseId, pre.id);", "const s = EmergencyContact.soldier_(ctx, courseId, pre.id);"]], 'ux'],
  ['M203 emergency phone: any digit count accepted', 'src/EmergencyContact.gs', "if (digits.length < 7 || digits.length > 15) return '';", "if (digits.length < 1) return '';", 'ux'],
  ['M204 attendance.events: commander counts include soldiers outside his visibility', 'src/Attendance.gs', "if (!isAdmin && !(sol[r.soldier_id] && vis(sol[r.soldier_id]))) return;", "if (false) return;", 'ux'],
  ['M205 analytic report: HTML escaping of names removed', 'src/Reports.gs', ".replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;'); },\n  noData_", ".replace(/&/g, '&amp;'); },\n  noData_", 'ux'],
  ['M206 UI attendance: double-click guard removed (busy flag AND disabled button)', 'src/Index.html', "save.onclick=function(){if(state.busy)return;", "save.onclick=function(){", [["state.busy=true;save.disabled=true;setMsg(box,'שומר…',true);", "setMsg(box,'שומר…',true);"]], 'uxu'],
  ['M207 UI emergency form: all-or-none validation removed (partial contact is sent)', 'src/Index.html', "if(state()!=='partial')return true;", "return true;", 'uxu'],
  ['M208 FormPage: all-or-none check of the emergency contact removed (partial contact is submitted)', 'src/FormPage.html', "if(ek.length&&ek.length<EK.length){", "if(false){", 'uxu'],
  ['M209 D2: minimum group size lowered from 5 to 1 (small groups exposed)', 'src/Analytics.gs', "MIN_GROUP: 5,", "MIN_GROUP: 1,", 'ux'],
  ['M210 D4: dashboard overview no longer excludes inactive soldiers', 'src/Dashboard.gs', "onlyActive: true }, today = Util.todayIso();", "onlyActive: false }, today = Util.todayIso();", 'ux'],
  ['M211 D4: report include_inactive no longer needs private.read permission', 'src/Reports.gs', "if (spec.include_inactive === true) Records.guardCourse_(ctx, 'private.read', courseId);", "", 'ux'],
  ['M212 D4: report default includes inactive soldiers', 'src/Reports.gs', "onlyActive: spec.include_inactive === true ? false : true,", "onlyActive: false,", 'ux'],
  ['M213 D2: dashboard home card for a small course leaks the soldier count', 'src/Dashboard.gs', "suppressed: true, reason: ov.reason, soldiers: null, readiness: null,", "suppressed: true, reason: ov.reason, soldiers: 1, readiness: null,", 'ux'],
  ['M214 D3: PDF default switched back to the tabular layout', 'src/Reports.gs', "if (format === 'pdf' && (!spec || spec.layout !== 'tabular')) {", "if (format === 'pdf' && spec && spec.layout === 'analytic') {", 'ux'],
  ['M215 report footer says the wrong total page count', 'src/Reports.gs', "foot(k + 1, total) + '</section>'", "foot(k + 1, total + 1) + '</section>'", 'ux'],
  ['M216 report packer ignores page capacity (everything on one page)', 'src/Reports.gs', "if (cur.px + px > CAP && cur.px > 60) fresh();", "", 'ux'],
  ['M217 D6: report block heights not counted (large group report overflows one page)', 'src/Reports.gs', "if (cur.px + px > CAP && cur.px > 60) fresh(); cur.html += html; cur.px += px;", "cur.html += html;", 'ux'],
  ['M218 D2: nav.groups returns figures for a scope under 5 soldiers', 'src/Navigation.gs', "if (out.course.soldiers < MIN) {", "if (false) {", 'ux'],
  ['M219 D2: summary routes without soldierId aggregate a small scope', 'src/Analytics.gs', "return n < Analytics.MIN_GROUP ? { suppressed: true, small_group: true,", "return false ? { suppressed: true, small_group: true,", 'ux'],
  ['M220 D4: Snapshot includes inactive soldiers by default again', 'src/Snapshot.gs', "if (f.onlyActive !== false && !Util.isTrue(s.active)) return false;", "if (f.onlyActive === true && !Util.isTrue(s.active)) return false;", 'ux'],
  ['M221 D2: nav.groups complementary suppression removed (one hidden team derivable)', 'src/Navigation.gs', "const hidden = list.filter(function (g) { return g.soldiers < MIN; }).length,", "const hidden = 0,", 'ux'],
  ['M222 D6: analytic report returns personal achievements again', 'src/Analytics.gs', "suppressed: ins.suppressed, achievements: [], bars: bars,", "suppressed: ins.suppressed, achievements: rows.map(function (r) { return { id: r.id, navigation: r.navigation }; }), bars: bars,", 'ux'],
  ['M223 D6: scatter carries personal points again', 'src/Analytics.gs', "n: null, points: [] };", "n: rows.length, points: rows.map(function (r) { return { id: r.id, x: r.navigation, y: r.marksmanship }; }) };", 'ux'],
  ['M224 D6: radar carries personal profiles again', 'src/Analytics.gs', "const radar = [];", "const radar = rows.map(function (r) { return { id: r.id, fitness: r.fitness }; });", 'ux'],
  ['M225 D6: scatter declared available again', 'src/Analytics.gs', "const scatter = { available: false, group_only: true,", "const scatter = { available: true, group_only: true,", 'ux'],
  ['M226 D6: report html embeds personal data (soldier ids) in the definitions block', 'src/Reports.gs', "d.definitions.map(function (x) { return '<li>' + e(x) + '</li>'; }).join('')", "d.definitions.map(function (x) { return '<li>' + e(x) + '</li>'; }).join('') + Db.all('Soldiers').map(function (s) { return '<li>' + e(s.id) + '</li>'; }).join('')", 'ux'],
  ['M227 D7: readiness.summary without the course guard (scope not enforced)', 'src/Readiness.gs', "summary(ctx, courseId, f) {\n    Records.guardCourse_(ctx, 'result.read', courseId);", "summary(ctx, courseId, f) {", 'd7'],
  ['M228 D7: exams.summary without the course guard', 'src/Exams.gs', "summary(ctx, courseId, soldierId) {\n    Records.guardCourse_(ctx, 'result.read', courseId);", "summary(ctx, courseId, soldierId) {", 'd7'],
  ['M229 D7: dash.overview without the course guard', 'src/Dashboard.gs', "f = f || {}; Records.guardCourse_(ctx, 'dashboard.view', courseId);", "f = f || {};", 'd7'],
  ['M230 D7: fitness.completion lists soldiers outside the commander visibility', 'src/Fitness.gs', "Util.isTrue(x.active) && vis(x); });\n    const ids = Object.create(null);", "Util.isTrue(x.active); });\n    const ids = Object.create(null);", 'd7'],
  ['M231 D7: fitness.quality opened to commanders (config.edit -> result.read)', 'src/Fitness.gs', "dataQuality(ctx, courseId) {\n    Records.guardCourse_(ctx, 'config.edit', courseId);", "dataQuality(ctx, courseId) {\n    Records.guardCourse_(ctx, 'result.read', courseId);", 'd7'],
  ['M232 D7: nav.groups soldier list built from every soldier of the course (visibility ignored)', 'src/Navigation.gs', "out.soldiers = soldiers.map(function (x) {", "out.soldiers = Db.where('Soldiers', function (x) { return x.course_id === courseId; }).map(function (x) {", 'd7'],
  ['M233 D7: commander scope check accepts any course', 'src/Policy.gs', "return Array.isArray(ctx.courseScope) && ctx.courseScope.indexOf(courseId) !== -1;", "return Array.isArray(ctx.courseScope);", 'd7'],
  ['M234 D7: readiness snapshot ignores the commander visibility filter', 'src/Snapshot.gs', "if (!Snapshot.eligible_(s) || !vis(s)) return false;", "if (!Snapshot.eligible_(s)) return false;", 'd7'],
  ['M22 UI: approve without the verification tick', 'src/Index.html', "if(!x.verified){setMsg(m,'לא ניתן לאשר בלי סימון האימות מול המקור.',false);return;}", "", 'ui'],
  // ---- REV3: privacy sub-cohort suppression (D2: a figure is never backed by 1-4 distinct soldiers) ----
  ['M235 REV3: splitOk_ accepts every split (1-4 sub-cohorts shown)', 'src/Analytics.gs', "splitOk_(a, b) { const ok = function (x) { return x === 0 || x >= Analytics.MIN_GROUP; }; return ok(a) && ok(b); },", "splitOk_(a, b) { return true; },"],
  ['M236 REV3: attendance cohort check removed (present/absent 9/1 shown)', 'src/Analytics.gs', "if (!(Analytics.splitOk_(A, W - A) && Analytics.splitOk_(P, W - P)) || (N !== undefined && !Analytics.splitOk_(W, N - W))) return", "if (false) return"],
  ['M237 REV3: coverage_ never suppresses (have/missing 9/1 shown)', 'src/Analytics.gs', "coverage_(have, total) { return Analytics.splitOk_(have, total - have) ?", "coverage_(have, total) { return true ?"],
  ['M238 REV3: insights coverage ignores the have/missing split', 'src/Analytics.gs', "if (!Analytics.splitOk_(haveN, N - haveN)) { anyHidden = true; return; }", ""],
  ['M239 REV3: group fitness shown with 1-4 scored soldiers', 'src/Analytics.gs', "if (!Analytics.scoreOk_(rows, 'weighted_score')) return { count: null, complete_count: null,", "if (false) return { count: null, complete_count: null,"],
  ['M240 REV3: readiness status counts shown when a part is 1-4 soldiers', 'src/Readiness.gs', "counts: okC ? counts : {", "counts: counts ? counts : {"],
  // ---- FINAL (REV4) ----
  ['M241 FINAL: Readiness.summary returns a per-soldier list again (group path)', 'src/Readiness.gs', "return { total: soldiers.length, counts: okC", "return { soldiers: soldiers.map(function (s) { return { soldier_id: s.id }; }), total: soldiers.length, counts: okC"],
  ['M242 FINAL: Dashboard.groups shows a metric without the per-group split check (5 of 6 shown)', 'src/Dashboard.gs', "nv >= min && Analytics.splitOk_(nv, g.soldiers - nv) ? g[k] : gone()", "nv >= min ? g[k] : gone()"],
  ['M243 FINAL: Dashboard.groups complementary suppression removed', 'src/Dashboard.gs', "if ((lost.length + (raw.length - out.length) === 1) && keep.length)", "if (false)"],
  ['M244 FINAL: monthly_ keeps the whole point of a month with an illegal split', 'src/Analytics.gs', "return w >= Analytics.MIN_GROUP && (N === undefined || Analytics.splitOk_(w, N - w)); })", "return w >= Analytics.MIN_GROUP; })"],
  ['M245 FINAL: fitness distribution prints the minimum again', 'src/Analytics.gs', "Analytics.r1_(Analytics.quantile_(pv, 0.75)) + '.',", "Analytics.r1_(Analytics.quantile_(pv, 0.75)) + '; מינימום ' + Analytics.r1_(pv[0]) + '.',"],
  ['M246 FINAL: Alerts.counts cohort check removed (red/yellow counts of 1-4 soldiers shown)', 'src/Alerts.gs', "if (!Analytics.catOk_([who(red), who(yel)]))", "if (false)"],
  ['M247 FINAL: attendance.events present/absent split check removed', 'src/Attendance.gs', "const okP = Analytics.splitOk_(present, rs.length - present), okE = Analytics.splitOk_(early, rs.length - early);", "const okP = true, okE = true;"],
  ['M248 FINAL: report bars eligibility ignores the with/without split', 'src/Analytics.gs', "return x.nv >= MIN && Analytics.splitOk_(x.nv, x.dsize - x.nv); })", "return x.nv >= MIN; })"],
  ['M249 FINAL: group-gap insight ignores the within-department split', 'src/Analytics.gs', "Analytics.splitOk_(g.n_values.fitness, g.soldiers - g.n_values.fitness) && g.fitness.by_results !== null", "g.fitness.by_results !== null"],
  ['M250 FINAL: completeness score split check removed (with_score / missing_score of 1-4 shown)', 'src/Dashboard.gs', "if (Analytics.splitOk_(S, N - S) && Analytics.splitOk_(S, R - S)) {", "if (true) {"],
  ['M251 FINAL: distinct_ counts result rows instead of soldiers', 'src/Analytics.gs', "if (!pred || pred(r)) s[r.soldier_id] = true; }); return Object.keys(s).length; }", "if (!pred || pred(r)) s[r.soldier_id + Math.random()] = true; }); return Object.keys(s).length; }"],
  ['M252 FINAL: group readiness summary bypasses the cohort gate', 'src/Readiness.gs', "const okC = Analytics.catOk_([counts.fit, counts.fit_with_restrictions, counts.unfit, counts.not_entered]);", "const okC = true;"],
  ['M253 FINAL: Assistant prints raw alert counts even when suppressed', 'src/Assistant.gs', "c.suppressed ? (c.has_open ?", "false ? (c.has_open ?"],
  ['M254 FINAL: dashboard alerts KPI shows the numbers although suppressed (UI)', 'src/Index.html', "kp.appendChild(a.suppressed?kpi('kpiAlerts','התראות פתוחות','יש התראות פתוחות'", "kp.appendChild(false?kpi('kpiAlerts','התראות פתוחות','יש התראות פתוחות'", 'upd1'],
  ['M255 FINAL: dashboard fitness-gap KPI prints the split although suppressed (UI)', 'src/Index.html', "if(fcm.suppressed||fcm.with_data===null||fcm.with_data===undefined)kp.appendChild(", "if(false)kp.appendChild(", 'upd1'],
];
const results = []; let bad = 0;
const inOnly = id => { if (!onlyArg) return true; return onlyArg.split(',').some(p => { const m = p.match(/^M(\d+)(?:-M(\d+))?$/); if (!m) return false; const n = Number(id), a = Number(m[1]), b = m[2] ? Number(m[2]) : a; return n >= a && n <= b; }); };
for (const [name, file, from, to, extra, kind0] of M) {
  if (!inOnly(name.match(/^M(\d+)/)[1])) continue;
  const kind = Array.isArray(extra) ? kind0 : (extra || kind0);
  const f = path.join(tmp, file), orig = fs.readFileSync(f, 'utf8'), n = orig.split(from).length - 1;
  if ((kind === 'ui' || kind === 'uib' || kind === 'uir' || kind === 'up2' || kind === 'uxu' || kind === 'upd1') && !wantUi) { results.push({ name, state: 'NOT_RUN', why: '--ui not given' }); continue; }
  if (n !== 1) { results.push({ name, state: 'NOT_APPLIED', why: 'pattern found ' + n + ' times' }); bad++; continue; }
  let mutated = orig.replace(from, () => to); if (Array.isArray(extra)) for (const [a, b] of extra) { if (mutated.split(a).length !== 2) { results.push({ name, state: 'NOT_APPLIED', why: 'extra pattern not found once' }); bad++; mutated = null; break; } mutated = mutated.replace(a, () => b); }
  if (mutated === null) continue;
  fs.writeFileSync(f, mutated);
  const args = kind === 'd7' ? ['tests/d7_authz.js'] : kind === 'ux' ? ['tests/uxqa_server.js'] : kind === 'uxu' ? ['tests/ui_uxqa.js'] : kind === 'pd61' ? ['tests/pd61_qa_fixes.js'] : kind === 'pd6' ? ['tests/pd6_meetings_tasks.js'] : kind === 'p2' ? ['tests/pd2_corrections.js'] : kind === 'up2' ? ['tests/ui_pd2.js'] : kind === 'ui' ? ['tests/ui_fitness.js'] : kind === 'upd1' ? ['tests/ui_pd1.js'] : kind === 'uib' ? ['tests/ui_b7b8.js'] : kind === 'uir' ? ['tests/ui_r3.js'] : kind === 'imp' ? ['tests/v1_import_dups.js'] : kind === 'imf' ? ['tests/v1_import_infile.js'] : kind === 'sh' ? ['tests/stg_clean_machine_script_sh.js'] : kind === 'cm' ? ['tests/stg_clean_machine_script.js'] : kind === 'dda' ? ['tests/demo_data_audit.js'] : ['tests/run_all.js'];
  const r = spawnSync('node', args, { cwd: tmp, encoding: 'utf8', timeout: 590000, env: Object.assign({}, process.env) }); const out = (r.stdout || '') + (r.stderr || '');
  fs.writeFileSync(f, orig);
  const failed = [...out.matchAll(/^FAIL\s+(\S+)/gm)].map(m => m[1]); const tests = [...out.matchAll(/^FAIL (?:\[\w+\] )?(.{0,70})/gm)].map(m => m[1]);
  if ((kind === 'ui' || kind === 'uib' || kind === 'uir' || kind === 'up2') && /SKIP ui_(fitness|b7b8|r3|pd2)/.test(out)) { results.push({ name, state: 'NOT_RUN', why: 'Playwright not available - the UI suite skipped itself' }); bad++; console.log('NOT_RUN  ' + name + ' (Playwright missing)'); continue; }
  const caught = r.status !== 0; if (!caught) bad++;
  results.push({ name, state: caught ? 'CAUGHT' : 'SURVIVED', by: (kind === 'ui' || kind === 'up2' || kind === 'upd1') ? tests.slice(0, 3) : failed.slice(0, 6) });
  console.log((caught ? 'CAUGHT   ' : 'SURVIVED ') + name + (caught ? '  <- ' + ((kind === 'ui' || kind === 'uib' || kind === 'uir' || kind === 'up2' || kind === 'upd1') ? tests.slice(0, 2).join(' | ') : failed.slice(0, 5).join(', ')) : ''));
}
fs.writeFileSync(outArg || path.join(root, 'tests', 'mutation_results.json'), JSON.stringify({ when: new Date().toISOString(), node: process.version, results }, null, 1));
const c = s => results.filter(r => r.state === s).length;
console.log('\nMUTATIONS: ' + results.length + ' — CAUGHT ' + c('CAUGHT') + ', SURVIVED ' + c('SURVIVED') + ', NOT_APPLIED ' + c('NOT_APPLIED') + ', NOT_RUN ' + c('NOT_RUN'));
fs.rmSync(tmp, { recursive: true, force: true }); process.exit(bad ? 1 : 0);
