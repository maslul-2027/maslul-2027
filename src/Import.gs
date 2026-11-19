/**
 * Import (Excel / CSV rows parsed in the browser) — v1.0.0. Admin only.
 * Flow: start (mapping + rows) -> server-side DRY-RUN validation of every row (nothing written) -> preview (counts + per-row issues) -> admin commit.
 * Nothing is overwritten without approval: a row for an EXISTING soldier is a 'conflict' (shown as a diff) and is applied only if the admin decided 'update' for that row.
 * Result rows are created through Records.create (same validation, audit, idempotency: request_id = import:<job>:<row>), so re-running a commit never duplicates.
 * Unknown soldiers / unknown names / bad values are row errors — they are never auto-created, guessed or zero-filled.
 */
const Import = {
  MAX_ROWS: 1000,
  TARGETS: {
    soldiers:     { label: 'חיילים', fields: ['personal_number', 'full_name', 'gender', 'department', 'team', 'pakal', 'enlistment_date'], required: ['personal_number', 'full_name', 'gender', 'department', 'team'] },
    navigation:   { label: 'ניווטים', table: 'NavigationTests', fields: ['personal_number', 'test_date', 'navigation_type', 'distance_km', 'plan_score', 'debrief_score', 'points_completed', 'points_total'], required: ['personal_number', 'test_date', 'navigation_type', 'distance_km', 'plan_score', 'debrief_score', 'points_completed', 'points_total'] },
    marksmanship: { label: 'קליעה', table: 'MarksmanshipTests', fields: ['personal_number', 'test_date', 'weapon_type', 'distance_m', 'examiner_score', 'ylm_score', 'weapon_zeroed'], required: ['personal_number', 'test_date', 'weapon_type', 'distance_m', 'weapon_zeroed'] },
    fitness:      { label: 'כש״ג', table: 'FitnessTests', fields: ['personal_number', 'test_date', 'test_type', 'pullups', 'parallel_bars', 'trap_bar', 'run150x2', 'run3km'], required: ['personal_number', 'test_date', 'test_type'] },
    exams:        { label: 'מבחנים עיוניים', table: 'TheoreticalExamAttempts', fields: ['personal_number', 'exam', 'attempt', 'attempt_date', 'score'], required: ['personal_number', 'exam', 'attempt', 'attempt_date', 'score'] }
  },
  GENDER: { M: 'M', F: 'F', 'זכר': 'M', 'נקבה': 'F', 'ז': 'M', 'נ': 'F' },

  cell_(v) { if (v === null || v === undefined) return ''; if (typeof v === 'object') throw new AppError('VALIDATION', 'ערך תא לא תקין.'); return typeof v === 'number' ? v : String(v).trim(); },
  byName_(table, courseId, name) { const n = String(name).trim().toLowerCase(); return Db.where(table, function (x) { return x.course_id === courseId && String(x.name).trim().toLowerCase() === n; })[0] || null; },

  /** Component value for comparison: blank/missing => '', numbers compare numerically (8, "8", "8.0" are equal), anything else (e.g. a time "12:00") as trimmed text. */
  compNorm_(v) { if (v === null || v === undefined) return ''; const s = String(v).trim(); return /^-?\d+(\.\d+)?$/.test(s) ? String(Number(s)) : s; },
  /** An ACTIVE fitness record of the same course/soldier with the same test type, date and component values (compared inside raw_values_json); p = the NORMALISED output of Fitness.recordType.prepare. */
  fitnessDuplicate_(courseId, soldierId, p) {
    const want = Util.parseJson(p.raw_values_json, {});
    return Db.where('FitnessTests', function (r) {
      if (r.course_id !== courseId || r.soldier_id !== soldierId || r.record_status !== RECORD_STATUS.ACTIVE || r.test_type_id !== p.test_type_id || Util.cellToIsoDate(r.test_date) !== p.test_date) return false;
      const have = Util.parseJson(r.raw_values_json, {}) || {};
      return Fitness.COMPONENTS.every(function (c) { return Import.compNorm_(have[c]) === Import.compNorm_(want[c]); });
    })[0] || null;
  },

  /** Identity of a RESULT row inside one file (navigation / marksmanship / fitness), so identical rows of the same job are caught before anything is stored. Fitness: soldier + type + date + the five components (normalised like the stored comparison); others: every prepared field (dates as ISO, the rest as text — the same equality the existing-record check uses). Exams are NOT keyed here: the attempt rules already reject a repeated attempt. */
  resultKey_(target, data) {
    if (target === 'fitness') return JSON.stringify(['f', data.soldier_id, data.test_type_id, Util.cellToIsoDate(data.test_date)].concat(Fitness.COMPONENTS.map(function (c) { return Import.compNorm_(data[c]); })));
    return JSON.stringify([target].concat(Object.keys(data).sort().map(function (k) { return [k, k.indexOf('date') !== -1 ? Util.cellToIsoDate(data[k]) : String(data[k])]; })));
  },

  /** Map one raw row to {data, issues, key}. Pure validation: no writes. */
  prepareRow_(ctx, courseId, target, m, no) {
    const spec = Import.TARGETS[target], issues = [], v = {}; spec.required.forEach(function (f) { if (m[f] === '' || m[f] === undefined) issues.push('חסר ערך בשדה ' + f); });
    spec.fields.forEach(function (f) { v[f] = m[f] === undefined ? '' : m[f]; });
    if (issues.length) return { issues: issues };
    try {
      if (target === 'soldiers') {
        const dep = Import.byName_('Departments', courseId, v.department), team = dep ? Db.where('Teams', function (t) { return t.course_id === courseId && t.department_id === dep.id && String(t.name).trim().toLowerCase() === String(v.team).trim().toLowerCase(); })[0] : null;
        if (!dep) throw new AppError('VALIDATION', 'מחלקה לא קיימת: ' + v.department); if (!team) throw new AppError('VALIDATION', 'צוות לא קיים במחלקה: ' + v.team);
        const g = Import.GENDER[String(v.gender).trim()]; if (!g) throw new AppError('VALIDATION', 'מגדר לא מזוהה: ' + v.gender);
        const d = { personal_number: String(v.personal_number), full_name: v.full_name, gender: g, pakal: v.pakal, enlistment_date: v.enlistment_date === '' ? '' : String(v.enlistment_date) }; const f = Soldiers.clean_(d, true);
        const ex = Db.where('Soldiers', function (s) { return s.course_id === courseId && String(s.personal_number) === f.personal_number; })[0];
        if (ex) { const diff = Soldiers.diff_(ex, Util.pick(f, ['full_name', 'gender', 'pakal', 'enlistment_date'])); return { data: Object.assign({}, f, { department_id: dep.id, team_id: team.id }), status: diff.changed ? 'conflict' : 'duplicate', existing_id: ex.id, diff: diff.changed ? diff : null, issues: diff.changed ? ['קיים חייל עם מספר אישי זה — נדרש אישור לעדכון'] : ['קיים חייל זהה — לא ייווצר שוב'] }; }
        Soldiers.checkOrg_(courseId, dep.id, team.id); return { data: Object.assign({}, f, { department_id: dep.id, team_id: team.id }), status: 'ok', issues: [] };
      }
      const sol = Db.where('Soldiers', function (s) { return s.course_id === courseId && String(s.personal_number) === String(v.personal_number); })[0]; if (!sol || sol.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('VALIDATION', 'חייל לא נמצא בקורס (מספר אישי ' + v.personal_number + ')');
      let data = { soldier_id: sol.id };
      if (target === 'navigation') { const ty = Import.byName_('NavigationTypes', courseId, v.navigation_type); if (!ty) throw new AppError('VALIDATION', 'סוג ניווט לא קיים: ' + v.navigation_type); data = Object.assign(data, { test_date: String(v.test_date), navigation_type_id: ty.id, distance_km: v.distance_km, plan_score: v.plan_score, debrief_score: v.debrief_score, points_completed: v.points_completed, points_total: v.points_total }); }
      if (target === 'marksmanship') { const z = String(v.weapon_zeroed).trim(); const zb = { 'כן': true, 'לא': false, 'true': true, 'false': false, 'TRUE': true, 'FALSE': false }[z]; if (zb === undefined) throw new AppError('VALIDATION', 'נשק מאופס: כן/לא'); data = Object.assign(data, { test_date: String(v.test_date), weapon_type: v.weapon_type, distance_m: v.distance_m, examiner_score: v.examiner_score, ylm_score: v.ylm_score, weapon_zeroed: zb }); }
      if (target === 'fitness') { const ty = Import.byName_('FitnessTestTypes', courseId, v.test_type); if (!ty) throw new AppError('VALIDATION', 'סוג מבחן כש״ג לא קיים: ' + v.test_type); data = Object.assign(data, { test_date: String(v.test_date), test_type_id: ty.id, pullups: v.pullups, parallel_bars: v.parallel_bars, trap_bar: v.trap_bar, run150x2: v.run150x2, run3km: v.run3km }); }
      if (target === 'exams') { const ex = Db.where('ExamDefinitions', function (e) { return e.course_id === courseId && String(e.name).trim().toLowerCase() === String(v.exam).trim().toLowerCase(); })[0]; if (!ex) throw new AppError('VALIDATION', 'מבחן לא קיים: ' + v.exam); data = Object.assign(data, { exam_id: ex.id, attempt: String(v.attempt).trim(), attempt_date: String(v.attempt_date), score: v.score }); }
      const prepared = Records.typeFor_(spec.table).prepare(courseId, data, null);      // full validation incl. order rules/ranges — nothing written
      // Fitness components are NOT columns (they live inside raw_values_json), so the generic column comparison can never match them: fitness compares the NORMALISED stored shape instead.
      const same = target === 'fitness' ? Import.fitnessDuplicate_(courseId, sol.id, prepared) : Db.where(spec.table, function (r) { return r.course_id === courseId && r.soldier_id === sol.id && r.record_status === RECORD_STATUS.ACTIVE && Object.keys(data).every(function (k) { return k === 'soldier_id' || String(r[k]) === String(data[k]) || (k.indexOf('date') !== -1 && Util.cellToIsoDate(r[k]) === data[k]); }); })[0];
      if (same) return { data: data, status: 'duplicate', issues: ['רשומה זהה כבר קיימת — לא תיווצר שוב'] };
      return { data: data, status: 'ok', issues: [] };
    } catch (e) { if (e instanceof AppError || (e && e.name === 'AppError')) return { issues: [e.message] }; throw e; }
  },

  start(ctx, courseId, p) {
    p = p || {}; Records.guardCourse_(ctx, 'import.run', courseId); Soldiers.scalar_(p.target, 'target'); Soldiers.scalar_(p.file_name, 'file_name');
    const spec = Import.TARGETS[p.target]; if (!spec || !Object.prototype.hasOwnProperty.call(Import.TARGETS, p.target)) throw new AppError('VALIDATION', 'יעד ייבוא לא מוכר.');
    if (!p.mapping || typeof p.mapping !== 'object' || Array.isArray(p.mapping)) throw new AppError('VALIDATION', 'חסר מיפוי עמודות.');
    const map = {}; Object.keys(p.mapping).forEach(function (f) { if (spec.fields.indexOf(f) === -1) throw new AppError('VALIDATION', 'שדה יעד לא מוכר במיפוי: ' + f); if (typeof p.mapping[f] !== 'string' || !p.mapping[f]) throw new AppError('VALIDATION', 'מיפוי לא תקין לשדה ' + f); map[f] = p.mapping[f]; });
    const unmapped = spec.required.filter(function (f) { return !map[f]; }); if (unmapped.length) throw new AppError('VALIDATION', 'שדות חובה ללא מיפוי: ' + unmapped.join(', '));
    if (!Array.isArray(p.rows) || !p.rows.length || p.rows.length > Import.MAX_ROWS) throw new AppError('VALIDATION', 'מספר שורות חייב להיות 1–' + Import.MAX_ROWS + '.');
    const raw = p.rows.map(function (r) { if (!r || typeof r !== 'object' || Array.isArray(r)) throw new AppError('VALIDATION', 'שורה לא תקינה.'); const m = {}; Object.keys(map).forEach(function (f) { m[f] = Import.cell_(r[map[f]]); }); return m; });
    const seen = {}, seenRes = {}, prepared = raw.map(function (m, i) { const r = Import.prepareRow_(ctx, courseId, p.target, m, i + 1); const k = String(m.personal_number); if (p.target === 'soldiers' && r.status !== undefined) { if (seen[k]) return { issues: ['מספר אישי מופיע פעמיים בקובץ'] }; seen[k] = true; } if (p.target !== 'soldiers' && p.target !== 'exams' && r.status === 'ok') { const rk = Import.resultKey_(p.target, r.data); if (seenRes[rk]) return { data: r.data, status: 'duplicate', issues: ['שורה זהה לשורה ' + seenRes[rk] + ' בקובץ — לא תיווצר שוב'] }; seenRes[rk] = i + 1; } return r; });
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'import.run', courseId); const now = Util.nowIso(), job = { id: Util.uuid(), course_id: courseId, target: p.target, file_name: Util.str(p.file_name).slice(0, 120), mapping_json: JSON.stringify(map), status: 'preview', created_by: ctx.email, created_at: now, reviewed_by: '', reviewed_at: '', summary_json: '' };
      Db.insert('ImportJobs', job);
      prepared.forEach(function (r, i) { Db.insert('ImportRows', { id: Util.uuid(), course_id: courseId, job_id: job.id, row_no: i + 1, data_json: JSON.stringify(r.data ? Object.assign({}, r.data, r.existing_id ? { _existing_id: r.existing_id, _decision: '' } : {}) : raw[i]), issues_json: JSON.stringify(r.issues || []), status: r.data ? r.status : 'error', committed_record_id: '' }); });
      Audit.log(ctx, { courseId: courseId, action: 'IMPORT_START', table: 'ImportJobs', recordId: job.id, after: { target: p.target, rows: prepared.length } }); return Import.preview(ctx, job.id);
    });
  },
  job_(ctx, id) { const j = Db.get('ImportJobs', Util.str(typeof id === 'string' ? id : '')); if (!j || !Policy.inScope(ctx, j.course_id)) throw new AppError('NOT_FOUND', 'משימת הייבוא לא נמצאה.'); Records.guardCourse_(ctx, 'import.run', j.course_id); return j; },
  counts_(rows) { const c = { ok: 0, error: 0, conflict: 0, duplicate: 0, committed: 0, skipped: 0 }; rows.forEach(function (r) { c[r.status] = (c[r.status] || 0) + 1; }); return c; },
  preview(ctx, jobId, page) {
    const j = Import.job_(ctx, jobId), rows = Db.where('ImportRows', function (r) { return r.job_id === j.id; }).sort(function (a, b) { return Number(a.row_no) - Number(b.row_no); });
    const pg = Number.isInteger(page) && page >= 0 ? page : 0;
    return { id: j.id, target: j.target, status: j.status, counts: Import.counts_(rows), total: rows.length, rows: rows.slice(pg * 100, pg * 100 + 100).map(function (r) { const d = Util.parseJson(r.data_json, {}); return { row_no: Number(r.row_no), status: r.status, issues: Util.parseJson(r.issues_json, []), data: d, decision: d._decision || '' }; }) };
  },
  /** Explicit per-row decision for a CONFLICT row: 'update' (apply the diff) or 'skip'. */
  decide(ctx, jobId, rowNo, decision) {
    const j = Import.job_(ctx, jobId); if (['update', 'skip'].indexOf(decision) === -1) throw new AppError('VALIDATION', 'החלטה: update או skip.'); if (j.status !== 'preview') throw new AppError('VALIDATION', 'הייבוא כבר בוצע או בוטל.');
    return Locks.run(function () {
      const r = Db.where('ImportRows', function (x) { return x.job_id === j.id && Number(x.row_no) === Number(rowNo); })[0]; if (!r) throw new AppError('NOT_FOUND', 'שורה לא נמצאה.'); if (r.status !== 'conflict') throw new AppError('VALIDATION', 'רק שורות בסתירה דורשות החלטה.');
      const d = Util.parseJson(r.data_json, {}); d._decision = decision; Db.update('ImportRows', r.id, { data_json: JSON.stringify(d) }); return { row_no: Number(r.row_no), decision: decision };
    });
  },
  commit(ctx, jobId, confirm) {
    const pre = Import.job_(ctx, jobId); if (confirm !== true) throw new AppError('VALIDATION', 'נדרש אישור מפורש (confirm=true).');
    return Locks.run(function () {
      const j = Import.job_(ctx, pre.id); if (j.status === 'cancelled') throw new AppError('VALIDATION', 'הייבוא בוטל.'); if (j.status === 'committed') throw new AppError('VALIDATION', 'הייבוא כבר בוצע.');
      const rows = Db.where('ImportRows', function (r) { return r.job_id === j.id; }).sort(function (a, b) { return Number(a.row_no) - Number(b.row_no); }), spec = Import.TARGETS[j.target]; let created = 0, updated = 0, failed = 0;
      rows.forEach(function (r) {
        if (['ok', 'conflict'].indexOf(r.status) === -1 || r.committed_record_id) return; const d = Util.parseJson(r.data_json, {});
        try {
          let id;
          if (r.status === 'conflict') { if (d._decision !== 'update') { Db.update('ImportRows', r.id, { status: 'skipped' }); return; } const s = Db.get('Soldiers', d._existing_id); Soldiers.update(ctx, s.id, Util.pick(d, ['full_name', 'gender', 'pakal', 'enlistment_date']), s.updated_at, 'ייבוא Excel — עדכון מאושר (שורה ' + r.row_no + ')'); id = s.id; updated++; }
          else if (j.target === 'soldiers') { id = Soldiers.create(ctx, j.course_id, d).id; created++; }
          else { const data = Object.assign({ request_id: 'import:' + j.id + ':' + r.row_no }, d); id = (j.target === 'exams' ? Exams.addAttempt(ctx, j.course_id, data) : (j.target === 'fitness' ? Records.create(ctx, spec.table, j.course_id, data) : Records.create(ctx, spec.table, j.course_id, data))).record.id; created++; }
          Db.update('ImportRows', r.id, { status: 'committed', committed_record_id: id });
        } catch (e) { if (!(e instanceof AppError || (e && e.name === 'AppError'))) throw e; failed++; Db.update('ImportRows', r.id, { status: 'error', issues_json: JSON.stringify([e.message]) }); }
      });
      const summary = { created: created, updated: updated, failed: failed, skipped: Db.where('ImportRows', function (r) { return r.job_id === j.id && r.status === 'skipped'; }).length };
      Db.update('ImportJobs', j.id, { status: failed ? 'partial' : 'committed', reviewed_by: ctx.email, reviewed_at: Util.nowIso(), summary_json: JSON.stringify(summary) });
      Audit.log(ctx, { courseId: j.course_id, action: 'IMPORT_COMMIT', table: 'ImportJobs', recordId: j.id, after: summary }); return summary;
    });
  },
  cancel(ctx, jobId, reason) {
    const pre = Import.job_(ctx, jobId); reason = Mods.reason_(reason, true);
    return Locks.run(function () { const j = Import.job_(ctx, pre.id); if (j.status !== 'preview' && j.status !== 'partial') throw new AppError('VALIDATION', 'לא ניתן לבטל.'); Db.update('ImportJobs', j.id, { status: 'cancelled', reviewed_by: ctx.email, reviewed_at: Util.nowIso() }); Audit.log(ctx, { courseId: j.course_id, action: 'IMPORT_CANCEL', table: 'ImportJobs', recordId: j.id, reason: reason }); return { id: j.id, status: 'cancelled' }; });
  },
  jobs(ctx, courseId) { Records.guardCourse_(ctx, 'import.run', courseId); return Db.where('ImportJobs', function (j) { return j.course_id === courseId; }).map(function (j) { return { id: j.id, target: j.target, file_name: j.file_name, status: j.status, created_at: j.created_at, summary: Util.parseJson(j.summary_json, null) }; }); }
};
