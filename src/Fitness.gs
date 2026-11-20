/**
 * Fitness (כש״ג) — test types + weights (approved), scoring-table versions (DRAFT -> verified -> APPROVED), results with component scores.
 *
 * What is approved and implemented: weights (opening / regular), Trap Bar rule (reps only), missing component => no total (never 0 / never partial).
 * What is NOT invented: score tables. Only an APPROVED version (explicit admin approval after contiguity check + "verified against source") is ever used.
 * v1.0.3: the five component tables (boys / girls, Trap Bar included) are transcribed from the user's images into FitnessDraft.gs (gender explicit per table). They are still imported as DRAFT and
 * only an admin approval makes them usable. Open items N1–N8 (see scoring/transcribe_v103.py): the affected component score stays NULL with an explicit reason, never 0.
 */
const Fitness = {
  COMPONENTS: ['pullups', 'parallel_bars', 'trap_bar', 'run150x2', 'run3km'],
  LABELS: { pullups: 'מתח', parallel_bars: 'מקבילים', trap_bar: 'Trap Bar', run150x2: 'ריצת הלוך־חזור 300 מ׳', run3km: 'ריצת 3 ק״מ' },
  /** reps components vs time components */
  TIME: ['run150x2', 'run3km'],
  /** v1.0.6 BINDING PROFESSIONAL DECISION: boys pull-ups are scored ONLY by the 'אפוד אישי 7 ק״ג' table in every test type. 'ללא משקל חיצוני' is not a valid track for boys. Not configurable, no fallback. */
  VEST_VARIANT: 'אפוד אישי 7 ק״ג',
  NO_WEIGHT_VARIANT: 'ללא משקל חיצוני',
  BOYS_PULLUPS_RULE_TEXT: 'מתח בנים: רק טבלת ״אפוד אישי 7 ק״ג״ בכל סוגי המבחנים. ״ללא משקל חיצוני״ אינו מסלול ניקוד תקף לבנים.',
  /** true when (gender, component, variant) is a boys pull-up table that violates the rule. */
  forbiddenTable_(gender, component, variant) { return gender === 'M' && component === 'pullups' && variant !== Fitness.VEST_VARIANT; },
  MAX_REPS_SANITY: 500,   // technical sanity bound for typed reps, not a business rule
  /** Hebrew status per component reason (shown instead of a score; a missing / unsupported value is never 0). */
  REASON_TEXT: { ok: '', not_entered: 'לא הוזן', no_table: 'אין טבלת ניקוד מאושרת', out_of_range: 'מחוץ לטווח הטבלה — נדרשת בדיקה', gender_missing: 'מין החייל לא מוגדר' },
  WAITING_TEXT: 'ממתין להשלמת נתונים',
  REVIEW_TEXT: 'נדרשת בדיקה — ערך מחוץ לטווח הטבלה',
  // approved weights (spec §5.1)
  // Owner decision (Issue #66): NEW tests use the regular fitness test only. The opening type is no longer seeded for new courses; existing opening types and their results stay readable (history, score version attribution) and are never deleted.
  DEFAULT_TYPES: [
    { name: 'מבחן רגיל', is_opening: false, weights: { pullups: 20, parallel_bars: 20, trap_bar: 20, run150x2: 10, run3km: 30 } }
  ],
  /** Test seam ONLY (undefined in production, set by no route, never persisted): lets the regression tests keep creating LEGACY opening results to cover history. */
  legacyOpeningEntryForTests_: false,
  OPENING_BLOCKED_TEXT: 'מבחן פתיחה אינו זמין להזנה חדשה — יש להזין מבחן כש״ג רגיל. תוצאות פתיחה קיימות נשארות לצפייה.',

  seedTypes_(ctx, courseId) {
    Fitness.DEFAULT_TYPES.forEach(function (t) {
      Db.insert('FitnessTestTypes', { id: Util.uuid(), course_id: courseId, name: t.name, components_json: JSON.stringify(Object.keys(t.weights)), weights_json: JSON.stringify(t.weights),
        active: true, created_at: Util.nowIso(), created_by: ctx.email, variants_json: '{}', is_opening: t.is_opening });
    });
  },

  // ---------------- test types (configurable) ----------------
  typesList(ctx, courseId) {
    Records.guardCourse_(ctx, 'course.read', courseId);
    return Db.where('FitnessTestTypes', function (t) { return t.course_id === courseId && (ctx.role === ROLES.ADMIN || Util.isTrue(t.active)); })
      .map(function (t) { return { id: t.id, name: t.name, active: Util.isTrue(t.active), is_opening: Util.isTrue(t.is_opening), selectable: Util.isTrue(t.active) && !Util.isTrue(t.is_opening), weights: Util.parseJson(t.weights_json, {}), variants: Util.parseJson(t.variants_json, {}) }; });
  },

  checkWeights_(w) {
    if (!w || typeof w !== 'object' || Array.isArray(w)) throw new AppError('VALIDATION', 'משקולות חסרות.');
    Object.keys(w).forEach(function (c) { if (Fitness.COMPONENTS.indexOf(c) === -1) throw new AppError('VALIDATION', 'רכיב לא מוכר: ' + c); });
    Calc.weightedFitness({}, w);          // validates finite / non-negative / sum exactly 100 (throws otherwise)
    return w;
  },

  typeCreate(ctx, courseId, p) {
    Records.guardCourse_(ctx, 'config.edit', courseId);
    p = p || {}; Soldiers.scalar_(p.name, 'name');
    const name = Util.str(p.name); if (!name || name.length > 50) throw new AppError('VALIDATION', 'שם סוג מבחן חובה (עד 50 תווים).');
    const w = Fitness.checkWeights_(p.weights);
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'config.edit', courseId);
      if (Db.where('FitnessTestTypes', function (t) { return t.course_id === courseId && String(t.name).toLowerCase() === name.toLowerCase(); }).length) throw new AppError('DUPLICATE', 'סוג מבחן בשם זה כבר קיים.');
      const row = { id: Util.uuid(), course_id: courseId, name: name, components_json: JSON.stringify(Object.keys(w)), weights_json: JSON.stringify(w), active: true, created_at: Util.nowIso(), created_by: ctx.email, variants_json: '{}', is_opening: p.is_opening === true };
      Db.insert('FitnessTestTypes', row);
      Audit.log(ctx, { courseId: courseId, action: 'FITTYPE_CREATE', table: 'FitnessTestTypes', recordId: row.id, after: { name: name, weights: w } });
      return { id: row.id };
    });
  },

  typeMutate_(ctx, id, reason, build) {
    const pre = Db.get('FitnessTestTypes', Util.str(id));
    if (!pre || !Policy.inScope(ctx, pre.course_id)) throw new AppError('NOT_FOUND', 'סוג המבחן לא נמצא.');
    Records.guardCourse_(ctx, 'config.edit', pre.course_id);
    if (Util.isBlank(reason)) throw new AppError('VALIDATION', 'חובה לציין סיבה.');
    return Locks.run(function () {
      const cur = Db.get('FitnessTestTypes', pre.id); Records.guardCourse_(ctx, 'config.edit', cur.course_id);
      const plan = build(cur);
      Db.update('FitnessTestTypes', cur.id, plan.patch);
      Audit.log(ctx, { courseId: cur.course_id, action: plan.action, table: 'FitnessTestTypes', recordId: cur.id, before: plan.before, after: plan.after, reason: reason });
      return { id: cur.id };
    });
  },
  /** Weights change affects only FUTURE results (existing results keep the weights they were computed with only if recomputed by an admin edit). */
  typeSetWeights(ctx, id, weights, reason) {
    const w = Fitness.checkWeights_(weights);
    return Fitness.typeMutate_(ctx, id, reason, function (cur) { return { patch: { weights_json: JSON.stringify(w), components_json: JSON.stringify(Object.keys(w)) }, action: 'FITTYPE_WEIGHTS', before: { weights: Util.parseJson(cur.weights_json, {}) }, after: { weights: w } }; });
  },
  typeSetActive(ctx, id, active, reason) {
    if (typeof active !== 'boolean') throw new AppError('VALIDATION', 'סטטוס לא תקין.');
    return Fitness.typeMutate_(ctx, id, reason, function (cur) { return { patch: { active: active }, action: 'FITTYPE_ACTIVITY', before: { active: Util.isTrue(cur.active) }, after: { active: active } }; });
  },
  /** v1.0.6: pull-up track is fixed by policy (see VEST_VARIANT). This endpoint only accepts '' or the vest variant and has no effect on scoring; anything else is rejected. */
  typeSetVariant(ctx, id, component, variant, reason) {
    if (Fitness.COMPONENTS.indexOf(component) === -1) throw new AppError('VALIDATION', 'רכיב לא מוכר.');
    Soldiers.scalar_(variant, 'variant');
    // v1.0.6: no pull-up track is selectable. Only the fixed boys rule (vest 7 kg) or clearing is accepted; the stored value is never used for scoring.
    return Fitness.typeMutate_(ctx, id, reason, function (cur) {
      if (component !== 'pullups' || (Util.str(variant) !== '' && Util.str(variant) !== Fitness.VEST_VARIANT)) throw new AppError('VALIDATION', Fitness.BOYS_PULLUPS_RULE_TEXT + ' לא ניתן לבחור סוג ביצוע אחר.');
      const v = Util.parseJson(cur.variants_json, {}) || {}, before = Object.assign({}, v), val = Util.str(variant);
      if (val) v[component] = val; else delete v[component];
      return { patch: { variants_json: JSON.stringify(v) }, action: 'FITTYPE_VARIANT', before: { variants: before }, after: { variants: v } };
    });
  },

  // ---------------- scoring versions ----------------
  /** Read-only: what the draft transcription contains and what is uncertain. Nothing is activated by reading it. */
  draftSource(ctx) {
    Policy.require(ctx, 'config.edit', { courseId: '__none__' });
    return { status: FITNESS_DRAFT.status, note: FITNESS_DRAFT.note, uncertain: FITNESS_DRAFT.uncertain,
      tables: FITNESS_DRAFT.tables.map(function (t) { return { id: t.id, component: t.component, variant: t.variant, gender: t.gender, sheet: t.sheet, kind: t.kind, meta: t.meta || null, rows: t.rows.length }; }) };
  },

  /** Admin read. Optional rowsFor (a version id of THIS course): additionally returns that version's table rows (id, score, from, to) so a row can be corrected with editRow. Additive, no write. */
  versionsList(ctx, courseId, rowsFor) {
    Records.guardCourse_(ctx, 'config.edit', courseId);
    return Db.where('FitnessScoringVersions', function (v) { return v.course_id === courseId; }).map(function (v) {
      const rows = Db.where('FitnessScoringRows', function (r) { return r.version_id === v.id; });
      const tables = {}; rows.forEach(function (r) { const k = r.gender + '|' + r.component + '|' + r.variant; tables[k] = (tables[k] || 0) + 1; });
      return Object.assign({ id: v.id, label: v.label, status: v.status, approved_by: v.approved_by, approved_at: v.approved_at, gender_map: Util.parseJson(v.gender_map_json, {}), issues: Util.parseJson(v.issues_json, []),
        tables: Object.keys(tables).map(function (k) { const p = k.split('|'); return { gender: p[0], component: p[1], variant: p[2], rows: tables[k] }; }) },
      Util.str(rowsFor) === v.id ? { table_rows: rows.map(function (r) { return { id: r.id, gender: r.gender, component: r.component, variant: r.variant, score: r.score, from: r.from_value, to: r.to_value, row_no: r.row_no }; }) } : {});
    });
  },

  /** Table object in Scoring.lookup format built from stored rows (status taken from the version). */
  tableRows_(version, gender, component, variant) {
    const rows = Db.where('FitnessScoringRows', function (r) { return r.version_id === version.id && r.gender === gender && r.component === component && (variant === undefined || r.variant === variant); });
    return rows.sort(function (a, b) { return Number(a.row_no) - Number(b.row_no); });
  },
  buildTable_(version, rows) {
    const kind = rows.length ? rows[0].kind : 'time', num = function (v) { return v === '' || v === null || v === undefined ? null : Number(v); };
    return { status: version.status, kind: kind, rows: rows.map(function (r) {
      return kind === 'time' ? { score: Number(r.score), from_sec: num(r.from_value), to_sec: num(r.to_value) } : { score: Number(r.score), reps_min: num(r.from_value), reps_max: num(r.to_value) };
    }) };
  },
  /** Table groups of a version: unique (gender, component, variant). */
  groups_(versionId) {
    const g = {};
    Db.where('FitnessScoringRows', function (r) { return r.version_id === versionId; }).forEach(function (r) { g[r.gender + '|' + r.component + '|' + r.variant] = { gender: r.gender, component: r.component, variant: r.variant }; });
    return Object.keys(g).map(function (k) { return g[k]; });
  },
  versionIssues_(version) {
    const issues = [];
    Fitness.groups_(version.id).forEach(function (g) {
      if (Fitness.forbiddenTable_(g.gender, g.component, g.variant)) issues.push({ gender: g.gender, component: g.component, variant: g.variant, issue: 'טבלה אסורה: ' + Fitness.BOYS_PULLUPS_RULE_TEXT });
      const rows = Fitness.tableRows_(version, g.gender, g.component, g.variant), t = Fitness.buildTable_(version, rows);
      Scoring.checkContiguity(t).forEach(function (m) { issues.push({ gender: g.gender, component: g.component, variant: g.variant, issue: m }); });
    });
    return issues;
  },

  /**
   * Admin: copy the DRAFT transcription into a DRAFT version. v1.0.3: every table in the transcription carries an explicit gender (M = boys image, F = girls image),
   * so no gender is mapped or assumed here. p.sheets (optional) limits the import to ['M'] and/or ['F']; default both. The version cannot be used for any calculation until approved.
   */
  importDraft(ctx, courseId, p) {
    Records.guardCourse_(ctx, 'config.edit', courseId);
    p = p || {};
    const sheets = p.sheets === undefined ? GENDERS.slice() : p.sheets;
    if (!Array.isArray(sheets) || !sheets.length || sheets.some(function (s) { return GENDERS.indexOf(s) === -1; })) throw new AppError('VALIDATION', 'sheets חייב להיות רשימה של M ו/או F.');
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'config.edit', courseId);
      const gm = {}; sheets.forEach(function (s) { gm[s] = s; });
      const v = { id: Util.uuid(), course_id: courseId, label: Util.str(p.label) || 'תמלול מתמונות (v1.0.3)', status: 'DRAFT', approved_by: '', approved_at: '', source_note: 'תמלול מתמונות הניקוד של המשתמש (scoring/transcribe_v103.py). לא מאושר.', created_at: Util.nowIso(), created_by: ctx.email, gender_map_json: JSON.stringify(gm), issues_json: '[]' };
      Db.insert('FitnessScoringVersions', v);
      let n = 0;
      FITNESS_DRAFT.tables.forEach(function (t) {
        if (sheets.indexOf(t.gender) === -1) return;
        if (t.excluded || Fitness.forbiddenTable_(t.gender, t.component, t.variant)) return;     // historical source material, never imported
        t.rows.forEach(function (r, i) {
          Db.insert('FitnessScoringRows', { id: Util.uuid(), version_id: v.id, gender: t.gender, component: t.component, variant: t.variant, score: r[0], from_value: r[1] === null ? '' : r[1], to_value: r[2] === null ? '' : r[2], created_at: Util.nowIso(), kind: t.kind, sheet: t.sheet, row_no: i + 1, flag: (t.meta && t.meta.flag_rows && t.meta.flag_rows[String(i + 1)]) || '' });
          n++;
        });
      });
      const issues = Fitness.versionIssues_(v); Db.update('FitnessScoringVersions', v.id, { issues_json: JSON.stringify(issues) });
      Audit.log(ctx, { courseId: courseId, action: 'FITSCORING_IMPORT_DRAFT', table: 'FitnessScoringVersions', recordId: v.id, after: { sheets: sheets, rows: n, issues: issues.length } });
      return { id: v.id, rows: n, issues: issues };
    });
  },

  draftVersion_(ctx, versionId) {
    const v = Db.get('FitnessScoringVersions', Util.str(versionId));
    if (!v || !Policy.inScope(ctx, v.course_id)) throw new AppError('NOT_FOUND', 'גרסת הניקוד לא נמצאה.');
    Records.guardCourse_(ctx, 'config.edit', v.course_id);
    return v;
  },

  /** Admin: fix a single row of a DRAFT version (e.g. the U3 typo once verified against the source). Reason required; approved versions are immutable. */
  editRow(ctx, versionId, rowId, patch, reason) {
    const pre = Fitness.draftVersion_(ctx, versionId);
    if (Util.isBlank(reason)) throw new AppError('VALIDATION', 'חובה לציין סיבה.');
    patch = patch || {}; Object.keys(patch).forEach(function (k) { if (['score', 'from_value', 'to_value'].indexOf(k) === -1) throw new AppError('VALIDATION', 'שדה לא ניתן לעריכה: ' + k); });
    return Locks.run(function () {
      const v = Db.get('FitnessScoringVersions', pre.id);
      if (v.status !== 'DRAFT') throw new AppError('VALIDATION', 'ניתן לערוך רק גרסת טיוטה.');
      const r = Db.get('FitnessScoringRows', Util.str(rowId));
      if (!r || r.version_id !== v.id) throw new AppError('NOT_FOUND', 'השורה לא נמצאה.');
      const upd = {}; Object.keys(patch).forEach(function (k) { const x = patch[k]; upd[k] = Util.isBlank(x) ? '' : Util.numOrNull(x, k); });
      if ('score' in upd && upd.score === '') throw new AppError('VALIDATION', 'ציון חובה.');
      Db.update('FitnessScoringRows', r.id, upd);
      const issues = Fitness.versionIssues_(v); Db.update('FitnessScoringVersions', v.id, { issues_json: JSON.stringify(issues) });
      Audit.log(ctx, { courseId: v.course_id, action: 'FITSCORING_ROW_EDIT', table: 'FitnessScoringRows', recordId: r.id, before: Util.pick(r, Object.keys(upd)), after: upd, reason: reason });
      return { issues: issues };
    });
  },

  /** Admin: add a whole table to a DRAFT version (e.g. parallel bars once the source is supplied). rows: [{score, from, to}] — same format rules as the others. */
  addTable(ctx, versionId, p) {
    const pre = Fitness.draftVersion_(ctx, versionId); p = p || {};
    if (GENDERS.indexOf(p.gender) === -1 || Fitness.COMPONENTS.indexOf(p.component) === -1) throw new AppError('VALIDATION', 'מגדר/רכיב לא תקינים.');
    Soldiers.scalar_(p.variant === undefined ? '' : p.variant, 'variant');
    if (!Array.isArray(p.rows) || !p.rows.length || p.rows.length > 200) throw new AppError('VALIDATION', 'שורות חסרות.');
    if (Util.isBlank(p.reason)) throw new AppError('VALIDATION', 'חובה לציין סיבה.');
    const kind = Fitness.TIME.indexOf(p.component) !== -1 ? 'time' : 'reps', variant = Util.str(p.variant);
    if (Fitness.forbiddenTable_(p.gender, p.component, variant)) throw new AppError('VALIDATION', Fitness.BOYS_PULLUPS_RULE_TEXT);
    return Locks.run(function () {
      const v = Db.get('FitnessScoringVersions', pre.id); if (v.status !== 'DRAFT') throw new AppError('VALIDATION', 'ניתן לערוך רק גרסת טיוטה.');
      if (Db.where('FitnessScoringRows', function (r) { return r.version_id === v.id && r.gender === p.gender && r.component === p.component && r.variant === variant; }).length) throw new AppError('DUPLICATE', 'טבלה כזו כבר קיימת בגרסה.');
      p.rows.forEach(function (r, i) {
        const num = function (x) { return Util.isBlank(x) ? '' : Util.numOrNull(x, 'ערך'); };
        const score = Util.numOrNull(r.score, 'ציון'); if (score === null) throw new AppError('VALIDATION', 'ציון חובה בכל שורה.');
        Db.insert('FitnessScoringRows', { id: Util.uuid(), version_id: v.id, gender: p.gender, component: p.component, variant: variant, score: score, from_value: num(r.from), to_value: num(r.to), created_at: Util.nowIso(), kind: kind, sheet: '', row_no: i + 1, flag: '' });
      });
      const issues = Fitness.versionIssues_(v); Db.update('FitnessScoringVersions', v.id, { issues_json: JSON.stringify(issues) });
      Audit.log(ctx, { courseId: v.course_id, action: 'FITSCORING_ADD_TABLE', table: 'FitnessScoringVersions', recordId: v.id, after: { gender: p.gender, component: p.component, variant: variant, rows: p.rows.length }, reason: p.reason });
      return { issues: issues };
    });
  },

  /** Admin approval. Requires: structurally valid tables (no gap/overlap/duplicates) AND an explicit statement that the values were verified against the source. */
  approve(ctx, versionId, p) {
    const pre = Fitness.draftVersion_(ctx, versionId); p = p || {};
    if (p.verified_against_source !== true) throw new AppError('VALIDATION', 'נדרש אישור מפורש שהערכים אומתו מול המקור (verified_against_source).');
    if (Util.isBlank(p.reason)) throw new AppError('VALIDATION', 'חובה לציין סיבה.');
    return Locks.run(function () {
      const v = Db.get('FitnessScoringVersions', pre.id);
      if (v.status !== 'DRAFT') throw new AppError('VALIDATION', 'רק גרסת טיוטה ניתנת לאישור.');
      const issues = Fitness.versionIssues_(v);
      if (issues.length) throw new AppError('VALIDATION', 'הגרסה אינה תקינה מבחינה מבנית (' + issues.length + ' ממצאים) — יש לתקן לפני אישור.');
      if (!Fitness.groups_(v.id).length) throw new AppError('VALIDATION', 'הגרסה ריקה.');
      Db.where('FitnessScoringVersions', function (x) { return x.course_id === v.course_id && x.status === 'APPROVED'; }).forEach(function (x) { Db.update('FitnessScoringVersions', x.id, { status: 'SUPERSEDED' }); });
      Db.update('FitnessScoringVersions', v.id, { status: 'APPROVED', approved_by: ctx.email, approved_at: Util.nowIso(), issues_json: '[]' });
      Audit.log(ctx, { courseId: v.course_id, action: 'FITSCORING_APPROVE', table: 'FitnessScoringVersions', recordId: v.id, before: { status: 'DRAFT' }, after: { status: 'APPROVED' }, reason: p.reason });
      return { id: v.id, status: 'APPROVED' };
    });
  },

  activeVersion_(courseId) {
    const vs = Db.where('FitnessScoringVersions', function (v) { return v.course_id === courseId && v.status === 'APPROVED'; }).sort(function (a, b) { return String(a.approved_at).localeCompare(String(b.approved_at)); });
    return vs[vs.length - 1] || null;
  },

  // ---------------- score computation ----------------
  /** One component -> {score, reason}. reason: ok | not_entered | no_table | out_of_range | gender_missing. Never throws for table gaps; throws VALIDATION for garbage input. */
  componentScore_(version, gender, comp, raw, variantCfg) {
    if (Util.isBlank(raw)) return { score: null, reason: 'not_entered' };
    if (Fitness.TIME.indexOf(comp) === -1) {
      // reps (pull-ups, parallel bars, Trap Bar): a whole number of repetitions. A working weight or a time typed here is not a repetition count and is rejected / flagged out of range by the table.
      const n = Util.numOrNull(raw, Fitness.LABELS[comp]);
      if (!Number.isInteger(n) || n < 0 || n > Fitness.MAX_REPS_SANITY) throw new AppError('VALIDATION', 'חזרות חייבות להיות מספר שלם אי-שלילי: ' + Fitness.LABELS[comp]);
    } else {
      // time: ONLY the text format mm:ss (minutes:seconds). A bare number is ambiguous (seconds? minutes?) and is never interpreted.
      if (typeof raw !== 'string') throw new AppError('VALIDATION', 'זמן חייב להיות בפורמט דקות:שניות (mm:ss): ' + Fitness.LABELS[comp]);
      Scoring.parseTime(raw.trim());
    }
    if (!version) return { score: null, reason: 'no_table' };
    if (GENDERS.indexOf(gender) === -1) return { score: null, reason: 'gender_missing' };
    const all = Fitness.tableRows_(version, gender, comp, undefined);
    if (!all.length) return { score: null, reason: 'no_table' };
    // v1.0.6: no silent fallback. Boys pull-ups: ONLY the vest table (policy). Everything else: the sole table of the (gender, component) — if there is not exactly one, no_table.
    const variants = {}; all.forEach(function (r) { variants[r.variant] = true; });
    const vk = Object.keys(variants);
    let variant;
    if (gender === 'M' && comp === 'pullups') { if (!variants[Fitness.VEST_VARIANT]) return { score: null, reason: 'no_table' }; variant = Fitness.VEST_VARIANT; }
    else if (vk.length === 1) variant = vk[0];
    else return { score: null, reason: 'no_table' };
    const table = Fitness.buildTable_(version, all.filter(function (r) { return r.variant === variant; }));
    try { return { score: Scoring.lookup(table, typeof raw === 'string' ? raw.trim() : raw), reason: 'ok' }; }
    catch (e) { if (e && e.code === 'OUT_OF_RANGE') return { score: null, reason: 'out_of_range' }; throw e; }
  },

  /** Pure-ish computation used by the record type. */
  compute_(courseId, soldier, type, raw, versionId) {
    const version = versionId ? Db.get('FitnessScoringVersions', versionId) : Fitness.activeVersion_(courseId);
    const usable = version && version.status !== 'DRAFT' ? version : null;     // a DRAFT is never used for calculation
    const weights = Util.parseJson(type.weights_json, {}), variantCfg = Util.parseJson(type.variants_json, {}) || {};
    const comps = {}, scores = {};
    Object.keys(weights).forEach(function (c) { const r = Fitness.componentScore_(usable, soldier.gender, c, raw[c], variantCfg); comps[c] = r; scores[c] = r.score; });
    const w = Calc.weightedFitness(scores, weights);
    return { component_scores: comps, weighted: w.score, missing: w.missing, version_id: usable ? usable.id : '' };
  },

  recordType: {
    editable: ['soldier_id', 'test_date', 'test_type_id', 'pullups', 'parallel_bars', 'trap_bar', 'run150x2', 'run3km', 'notes'],
    /** v product-dev5 (F-1): snapshot source = row columns + the five components read from raw_values_json (missing component -> '', never 0). */
    snapshotSource(rec) {
      const raw = Util.parseJson(rec.raw_values_json, {}) || {}, out = Object.assign({}, rec);
      Fitness.COMPONENTS.forEach(function (c) { out[c] = raw[c] === undefined || raw[c] === null ? '' : raw[c]; });
      return out;
    },
    prepare(courseId, data, existing) {
      const soldierId = Util.str(data.soldier_id), soldier = Db.get('Soldiers', soldierId);
      if (!soldier || soldier.course_id !== courseId || soldier.record_status !== RECORD_STATUS.ACTIVE || !Util.isTrue(soldier.active)) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE);
      const type = Db.get('FitnessTestTypes', Util.str(data.test_type_id));
      if (!type || type.course_id !== courseId || (!Util.isTrue(type.active) && !(existing && existing.test_type_id === type.id))) throw new AppError('VALIDATION', 'סוג מבחן לא תקין.');
      if (Util.isTrue(type.is_opening) && !Fitness.legacyOpeningEntryForTests_ && !(existing && existing.test_type_id === type.id)) throw new AppError('VALIDATION', Fitness.OPENING_BLOCKED_TEXT);
      const date = Util.isoDate(Util.cellToIsoDate(data.test_date), 'תאריך מבחן');
      const raw = existing ? Object.assign({}, Util.parseJson(existing.raw_values_json, {})) : {};
      Fitness.COMPONENTS.forEach(function (c) { if (c in data && (!existing || typeof data[c] !== 'undefined')) raw[c] = Util.isBlank(data[c]) ? '' : data[c]; });
      const weights = Util.parseJson(type.weights_json, {});
      const clean = {}; Object.keys(raw).forEach(function (c) { if (Fitness.COMPONENTS.indexOf(c) !== -1) clean[c] = raw[c]; });
      if (!Object.keys(weights).some(function (c) { return !Util.isBlank(clean[c]); })) throw new AppError('VALIDATION', 'יש להזין לפחות רכיב אחד.');
      Object.keys(clean).forEach(function (c) { if (!(c in weights) && !Util.isBlank(clean[c])) throw new AppError('VALIDATION', 'הרכיב ' + Fitness.LABELS[c] + ' אינו חלק מסוג המבחן.'); });
      const notes = Util.str(data.notes); if (notes.length > 1000) throw new AppError('VALIDATION', 'הערות ארוכות מדי.');
      const c = Fitness.compute_(courseId, soldier, type, clean, existing ? existing.scoring_version_id : '');
      return { soldier_id: soldierId, test_date: date, test_type_id: type.id, raw_values_json: JSON.stringify(clean), component_scores_json: JSON.stringify(c.component_scores),
        weighted_score: c.weighted === null ? '' : c.weighted, scoring_version_id: c.version_id, notes: notes };
    }
  },

  /** Admin: recompute (as a normal edit with reason) results that were saved before an approved version existed — only the scoring fields change. */
  recompute(ctx, id, reason) {
    const rec = Records.load_(ctx, 'FitnessTests', id);
    if (Util.isBlank(reason)) throw new AppError('VALIDATION', 'חובה לציין סיבה.');
    Records.guardCourse_(ctx, 'result.edit', rec.course_id);
    return Locks.run(function () {
      const cur = Records.load_(ctx, 'FitnessTests', id); Records.guardCourse_(ctx, 'result.edit', cur.course_id);
      if (cur.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('RECORD_CANCELLED', 'הרשומה מבוטלת.');
      const soldier = Db.get('Soldiers', cur.soldier_id), type = Db.get('FitnessTestTypes', cur.test_type_id);
      const c = Fitness.compute_(cur.course_id, soldier, type, Util.parseJson(cur.raw_values_json, {}), '');
      const upd = { component_scores_json: JSON.stringify(c.component_scores), weighted_score: c.weighted === null ? '' : c.weighted, scoring_version_id: c.version_id, version: Number(cur.version || 1) + 1, updated_at: Util.nowIso(), updated_by: ctx.email };
      Db.update('FitnessTests', cur.id, upd);
      Audit.log(ctx, { courseId: cur.course_id, action: 'EDIT', table: 'FitnessTests', recordId: cur.id, before: Util.pick(cur, ['component_scores_json', 'weighted_score', 'scoring_version_id']), after: Util.pick(upd, ['component_scores_json', 'weighted_score', 'scoring_version_id']), reason: reason });
      return { record: Db.get('FitnessTests', cur.id) };
    });
  },


  // ---------------- read-only preview + reference (Issue #66) ----------------
  /** Sorted table rows -> display rows. Time rows in mm:ss, reps as numbers. */
  refRows_(kind, rows) {
    const fmt = function (sec) { return sec === null || sec === undefined || sec === '' ? null : Math.floor(Number(sec) / 60) + ':' + ('0' + (Number(sec) % 60)).slice(-2); };
    return rows.map(function (r) { return kind === 'time' ? { score: r.score, from: fmt(r.from_sec), to: fmt(r.to_sec) } : { score: r.score, from: r.reps_min, to: r.reps_max }; });
  },
  /** The regular (non-opening) active type of a course, or null. */
  regularType_(courseId) {
    return Db.where('FitnessTestTypes', function (t) { return t.course_id === courseId && Util.isTrue(t.active) && !Util.isTrue(t.is_opening); })[0] || null;
  },
  /**
   * READ-ONLY. Full scoring reference: the SAME table data the calculator uses. Official only when an APPROVED version exists; otherwise the newest DRAFT (imported) or the raw transcription is shown
   * with an explicit "unverified — not used for scoring" status and the still-open transcription items. Nothing is approved or invented here. No personal data.
   */
  reference(ctx, courseId) {
    Records.guardCourse_(ctx, 'course.read', courseId);
    const gl = { M: 'בנים', F: 'בנות' }, active = Fitness.activeVersion_(courseId);
    let status, version = null, tables = [], source;
    if (active) {
      status = 'APPROVED'; version = { id: active.id, label: active.label, status: active.status, approved_at: active.approved_at || '', source_note: active.source_note || '' }; source = 'version';
      Fitness.groups_(active.id).forEach(function (g) { const rows = Fitness.tableRows_(active, g.gender, g.component, g.variant), t = Fitness.buildTable_(active, rows); tables.push({ gender: g.gender, component: g.component, variant: g.variant, kind: t.kind, rows: Fitness.refRows_(t.kind, t.rows) }); });
    } else {
      status = 'NOT_APPROVED'; source = 'draft_transcription';
      const drafts = Db.where('FitnessScoringVersions', function (v) { return v.course_id === courseId && v.status === 'DRAFT'; }).sort(function (a, b) { return String(a.created_at || '').localeCompare(String(b.created_at || '')); });
      const d = drafts[drafts.length - 1];
      if (d) { source = 'draft_version'; version = { id: d.id, label: d.label, status: d.status, approved_at: '', source_note: d.source_note || '' };
        Fitness.groups_(d.id).forEach(function (g) { const rows = Fitness.tableRows_(d, g.gender, g.component, g.variant), t = Fitness.buildTable_({ status: 'APPROVED' }, rows); tables.push({ gender: g.gender, component: g.component, variant: g.variant, kind: t.kind, rows: Fitness.refRows_(t.kind, t.rows) }); }); }
      else FITNESS_DRAFT.tables.forEach(function (t) {
        if (t.excluded || Fitness.forbiddenTable_(t.gender, t.component, t.variant) || Fitness.COMPONENTS.indexOf(t.component) === -1) return;
        const kind = t.kind || (Fitness.TIME.indexOf(t.component) !== -1 ? 'time' : 'reps');
        tables.push({ gender: t.gender, component: t.component, variant: t.variant || '', kind: kind, rows: Fitness.refRows_(kind, t.rows.map(function (r) { return kind === 'time' ? { score: r[0], from_sec: r[1], to_sec: r[2] } : { score: r[0], reps_min: r[1], reps_max: r[2] }; })) });
      });
    }
    tables = tables.filter(function (t) { return Fitness.COMPONENTS.indexOf(t.component) !== -1 && !Fitness.forbiddenTable_(t.gender, t.component, t.variant); })
      .map(function (t) { return Object.assign({ gender_label: gl[t.gender] || t.gender, component_label: Fitness.LABELS[t.component] }, t); })
      .sort(function (a, b) { return a.gender === b.gender ? Fitness.COMPONENTS.indexOf(a.component) - Fitness.COMPONENTS.indexOf(b.component) : (a.gender < b.gender ? 1 : -1); });
    const type = Fitness.regularType_(courseId), weights = type ? Util.parseJson(type.weights_json, {}) : Fitness.DEFAULT_TYPES[0].weights, need = Object.keys(weights), missing = [];
    GENDERS.forEach(function (g) { need.forEach(function (c) { if (!tables.some(function (t) { return t.gender === g && t.component === c; })) missing.push({ gender: g, gender_label: gl[g], component: c, component_label: Fitness.LABELS[c] }); }); });
    const open = status === 'APPROVED' ? [] : (FITNESS_DRAFT.uncertain || []).filter(function (u) { return u.status !== 'CLOSED'; }).map(function (u) { return { id: u.id, topic: u.topic, detail: u.detail }; });
    return { status: status, source: source, version: version, test_type: 'מבחן כש״ג רגיל', weights: weights, weight_labels: Fitness.LABELS, tables: tables, missing_tables: missing, open_items: open,
      rule_note: Fitness.BOYS_PULLUPS_RULE_TEXT,
      warning: status === 'APPROVED' ? '' : 'הטבלאות להלן הן טיוטת תמלול שטרם אושרה: אינן משמשות לחישוב ציון רשמי עד שמנהל מאשר שהערכים אומתו מול המקור.' };
  },

  /**
   * READ-ONLY live preview of the regular test. Writes nothing and is never trusted by a save: Records.create recomputes with the same Fitness.compute_ on the server.
   * p: { test_type_id?, soldier_id (required), raw: { pullups, parallel_bars, trap_bar, run150x2, run3km } }. Returns a per-component breakdown, the weighted total only when every required component is valid, or the exact reason.
   */
  preview(ctx, courseId, p) {
    Records.guardCourse_(ctx, 'course.read', courseId); p = p || {};
    let type = p.test_type_id ? Db.get('FitnessTestTypes', Util.str(p.test_type_id)) : Fitness.regularType_(courseId);
    if (!type || type.course_id !== courseId) throw new AppError('VALIDATION', 'סוג מבחן לא תקין.');
    if (Util.isTrue(type.is_opening) && !Fitness.legacyOpeningEntryForTests_) throw new AppError('VALIDATION', Fitness.OPENING_BLOCKED_TEXT);
    let gender;
    if (Util.isBlank(p.soldier_id)) throw new AppError('VALIDATION', 'יש לבחור חייל.');   // the soldier is required and scope-checked: the preview discloses nothing about anyone outside the caller's scope
    {
      const vis = Soldiers.visibleFn_(ctx, courseId), s = Db.get('Soldiers', Util.str(p.soldier_id));
      if (!s || s.course_id !== courseId || !vis(s)) throw new AppError('NOT_FOUND', 'החייל לא נמצא.');
      gender = s.gender;
    }
    const raw = p.raw && typeof p.raw === 'object' && !Array.isArray(p.raw) ? p.raw : {}, weights = Util.parseJson(type.weights_json, {});
    const version = Fitness.activeVersion_(courseId), variantCfg = Util.parseJson(type.variants_json, {}) || {};
    const comps = {}, scores = {}; let invalid = 0, entered = 0;
    Object.keys(weights).forEach(function (c) {
      const v = raw[c]; let r;
      if (!Util.isBlank(v)) entered++;
      try { r = Fitness.componentScore_(version, gender, c, Util.isBlank(v) ? '' : v, variantCfg); }
      catch (e) { if (e && e.code === 'VALIDATION') { r = { score: null, reason: 'invalid', message: String(e.message) }; invalid++; } else throw e; }
      comps[c] = { label: Fitness.LABELS[c], weight: weights[c], score: r.score, reason: r.reason, text: r.reason === 'invalid' ? r.message : (r.reason === 'ok' ? '' : (Fitness.REASON_TEXT[r.reason] || r.reason)),
        points: r.score === null ? null : Math.round(r.score * weights[c]) / 100 };
      scores[c] = r.score;
    });
    const w = Calc.weightedFitness(scores, weights), gl = GENDERS.indexOf(gender) !== -1;
    let state = 'ok', explain = '';
    if (!version) { state = 'no_approved_table'; explain = 'אין טבלאות ניקוד מאושרות — לא ניתן לחשב ציון סופי.'; }
    else if (!gl) { state = 'gender_missing'; explain = 'מין החייל לא מוגדר — לא ניתן לבחור טבלת ניקוד.'; }
    else if (invalid) { state = 'invalid'; explain = 'יש ערך שגוי — תקנו כדי לקבל ציון.'; }
    else if (w.score === null && Object.keys(comps).some(function (c) { return comps[c].reason === 'out_of_range'; })) { state = 'out_of_range'; explain = Fitness.REVIEW_TEXT; }
    else if (w.score === null && Object.keys(comps).some(function (c) { return comps[c].reason === 'no_table'; })) { state = 'missing_table'; explain = 'חסרה טבלה מאושרת לרכיב — לא ניתן לחשב ציון סופי.'; }
    else if (w.score === null) { state = 'incomplete'; explain = entered ? 'חסרים רכיבים — הציון הסופי יחושב כשכל הרכיבים יוזנו.' : 'הזינו ערכים לרכיבי המבחן.'; }
    const missing = [];
    if (!version) GENDERS.forEach(function (g) { if (!gl || g === gender) Object.keys(weights).forEach(function (c) { missing.push({ gender: g, gender_label: g === 'M' ? 'בנים' : 'בנות', component: c, component_label: Fitness.LABELS[c] }); }); });
    return { state: state, explain: explain, weighted: w.score, weighted_display: w.score === null ? null : Util.display1(w.score), components: comps, test_type: type.name, test_type_id: type.id,
      version: version ? { id: version.id, label: version.label, approved_at: version.approved_at || '' } : null, missing_tables: missing,
      has_draft: !version && Db.where('FitnessScoringVersions', function (v) { return v.course_id === courseId && v.status === 'DRAFT'; }).length > 0,
      note: 'תצוגה מקדימה בלבד — לא נשמר דבר. הציון הרשמי מחושב מחדש בשרת בעת השמירה.' };
  },

  // ---------------- read models ----------------
  view_(r, ctx, extra) {
    const comps = Util.parseJson(r.component_scores_json, {}), raw = Util.parseJson(r.raw_values_json, {});
    const o = { id: r.id, soldier_id: r.soldier_id, test_date: Util.cellToIsoDate(r.test_date), test_type_id: r.test_type_id, raw: raw, components: comps,
      weighted_score: r.weighted_score === '' || r.weighted_score === null ? null : Number(r.weighted_score), weighted_display: r.weighted_score === '' || r.weighted_score === null ? Fitness.waitingText_(comps) : Util.display1(Number(r.weighted_score)), component_status: Fitness.statusTexts_(comps),
      scoring_version_id: r.scoring_version_id, notes: r.notes || '', created_by_name: Navigation.userNames_()[String(r.created_by).toLowerCase()] || '', own: String(r.created_by).toLowerCase() === ctx.email };
    if (ctx.role === ROLES.ADMIN) { o.created_by = r.created_by; o.record_status = r.record_status; o.updated_at = r.updated_at; }
    return Object.assign(o, extra || {});
  },

  /** Text shown instead of a final score: out-of-table values ask for a review, anything else waits for the missing data. Never a number. */
  waitingText_(comps) {
    return Object.keys(comps || {}).some(function (c) { return comps[c] && comps[c].reason === 'out_of_range'; }) ? Fitness.REVIEW_TEXT : Fitness.WAITING_TEXT;
  },
  statusTexts_(comps) {
    const o = {}; Object.keys(comps || {}).forEach(function (c) { const r = comps[c] && comps[c].reason; if (r && r !== 'ok') o[c] = Fitness.REASON_TEXT[r] || r; }); return o;
  },

  /** History list (admin may include cancelled). Commanders: only soldiers in their assignments (Records.list). */
  list(ctx, courseId, opts) {
    opts = opts || {};
    const rows = Records.list(ctx, 'FitnessTests', courseId, { soldierId: opts.soldierId, includeCancelled: opts.includeCancelled === true });
    const sol = Object.create(null); Db.where('Soldiers', function (s) { return s.course_id === courseId; }).forEach(function (s) { sol[s.id] = s; });
    const types = Object.create(null); Db.where('FitnessTestTypes', function (t) { return t.course_id === courseId; }).forEach(function (t) { types[t.id] = t.name; });
    return rows.filter(function (r) { const s = sol[r.soldier_id]; return !(opts.teamId && (!s || s.team_id !== opts.teamId)) && !(opts.departmentId && (!s || s.department_id !== opts.departmentId)); })
      .map(function (r) { return Fitness.view_(r, ctx, { soldier_name: sol[r.soldier_id] ? sol[r.soldier_id].full_name : '', type_name: types[r.test_type_id] || '', soldier_cancelled: sol[r.soldier_id] ? sol[r.soldier_id].record_status !== RECORD_STATUS.ACTIVE : false }); })
      .sort(function (a, b) { return a.test_date < b.test_date ? 1 : (a.test_date > b.test_date ? -1 : 0); });
  },

  /**
   * B7 — READ-ONLY "missing fitness data" list for the commander (admin sees every soldier of the course).
   * Authorization is enforced HERE, on the server: course scope + Soldiers.visibleFn_ (team / department / course assignments, fail closed, cancelled and inactive soldiers hidden).
   * A team filter can only NARROW what the caller may already see; a team outside his assignments simply yields no soldiers (nothing is disclosed).
   * Definitions (stated, not invented — see docs/B7_B8_DEFINITIONS.md):
   *  - the soldier's CURRENT result = his most recent active fitness result (test date, then creation order); components are judged on that result only;
   *  - component state: complete (has a score) | missing (not entered, or the soldier has no result) | review (value outside the table — "נדרשת בדיקה", never scored) |
   *    blocked (cannot be scored: no approved table / no gender — needs an admin) | na (component is not part of that result's test type);
   *  - "complete" soldier = no component is missing, in review or blocked.
   *  - a "disqualified" (נפסלה) state is NOT implemented: no pass/fail rule exists (U6 undecided); cancelled results are invisible to commanders by existing policy.
   * Never writes. opts: teamId, component.
   */
  completion(ctx, courseId, opts) {
    opts = opts || {};
    Records.guardCourse_(ctx, 'result.read', courseId);
    if (opts.component && Fitness.COMPONENTS.indexOf(opts.component) === -1) throw new AppError('VALIDATION', 'רכיב לא מוכר.');
    if (opts.teamId !== undefined && opts.teamId !== null && typeof opts.teamId !== 'string') throw new AppError('VALIDATION', 'צוות לא תקין.');
    const vis = Soldiers.visibleFn_(ctx, courseId);
    const org = Courses.org(ctx, courseId), teamName = {}, depName = {};
    org.teams.forEach(function (t) { teamName[t.id] = t.name; }); org.departments.forEach(function (d) { depName[d.id] = d.name; });
    const sols = Db.where('Soldiers', function (x) { return x.course_id === courseId && x.record_status === RECORD_STATUS.ACTIVE && Util.isTrue(x.active) && vis(x); });
    const ids = Object.create(null); sols.forEach(function (x) { ids[x.id] = true; });
    const types = {}; Db.where('FitnessTestTypes', function (t) { return t.course_id === courseId; }).forEach(function (t) { types[t.id] = t; });
    const latest = Object.create(null);
    Records.list(ctx, 'FitnessTests', courseId, {}).forEach(function (r) {
      if (!ids[r.soldier_id]) return;
      const d = Util.cellToIsoDate(r.test_date), cur = latest[r.soldier_id];
      if (!cur || d > cur.d || (d === cur.d && String(r.created_at || '') >= String(cur.r.created_at || ''))) latest[r.soldier_id] = { d: d, r: r };
    });
    const STATE_TEXT = { complete: 'הושלם', missing: 'חסר', review: 'ממתין לבדיקה', blocked: 'לא ניתן לנקד — נדרשת פעולת מנהל', na: 'לא חלק ממבחן זה' };
    // R2: which components a result REQUIRES comes from its test type (weights_json, the same source the scoring uses; components_json as fallback).
    // Only a component the type does not require is 'na'. A required component absent from component_scores_json is 'missing'. Unknown type / unreadable JSON => 'blocked' (never complete).
    const objOf = function (txt) { try { const o = JSON.parse(txt); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (e) { return null; } };
    const requiredOf = function (type) {
      if (!type) return null;
      // R3: weights_json is trusted as the map of required components ONLY if it is fully valid per Fitness.checkWeights_ (object, known components, finite non-negative numbers, sum 100).
      // Missing / empty / unparseable weights_json => components_json may be the fallback (must be a non-empty array of distinct known components).
      // Parseable but semantically invalid weights_json => NOT a usable map: null (blocked); never partial keys, never a silent fallback.
      let w = null, parsed = false;
      try { w = JSON.parse(type.weights_json); parsed = true; } catch (e) { parsed = false; }                  // unparseable / blank => treated as missing
      if (parsed && w !== null) {
        if (typeof w !== 'object' || Array.isArray(w)) return null;                                           // valid JSON of the wrong shape (array / number / string) is damaged, not missing
        if (Object.keys(w).length) { try { Fitness.checkWeights_(w); return Object.keys(w); } catch (e) { return null; } }
      }
      let a; try { a = JSON.parse(type.components_json); } catch (e) { return null; }
      if (!Array.isArray(a) || !a.length) return null;
      const seen = {}; for (let i = 0; i < a.length; i++) { if (typeof a[i] !== 'string' || Fitness.COMPONENTS.indexOf(a[i]) === -1 || seen[a[i]]) return null; seen[a[i]] = true; }
      return a.slice();
    };
    const stateOf = function (cs, c, required) {
      if (!required) return 'blocked';                                       // type missing / unreadable: cannot know what is required
      if (required.indexOf(c) === -1) return 'na';                           // the ONLY way to be 'na': the test type does not require it
      if (cs === null) return 'blocked';                                     // component_scores_json corrupt
      const x = cs[c];
      if (x === undefined) return 'missing';                                 // required but absent
      if (!x || typeof x !== 'object') return 'blocked';
      if (x.reason === 'ok') return Calc.hasScore(x.score) ? 'complete' : 'blocked';
      if (x.reason === 'not_entered') return 'missing'; if (x.reason === 'out_of_range') return 'review';
      return 'blocked';                                                      // no_table / gender_missing / anything unknown: never counted as complete
    };
    let rows = sols.map(function (s) {
      const L = latest[s.id], noRes = !L, type = noRes ? null : types[L.r.test_type_id], required = noRes ? Fitness.COMPONENTS.slice() : requiredOf(type);
      const cs = noRes ? {} : objOf(L.r.component_scores_json), comps = {};
      Fitness.COMPONENTS.forEach(function (c) { const st = noRes ? 'missing' : stateOf(cs, c, required); comps[c] = { label: Fitness.LABELS[c], state: st, text: STATE_TEXT[st] }; });
      const gaps = Fitness.COMPONENTS.filter(function (c) { return comps[c].state !== 'complete' && comps[c].state !== 'na'; });
      const complete = !noRes && !!required && gaps.length === 0 && Fitness.COMPONENTS.some(function (c) { return comps[c].state === 'complete'; });
      return { soldier_id: s.id, soldier_name: s.full_name, department_name: depName[s.department_id] || '', team_id: s.team_id, team_name: teamName[s.team_id] || '',
        no_results: noRes, last_test_date: noRes ? '' : L.d, type_name: noRes || !type ? '' : type.name,
        components: comps, gaps: gaps.map(function (c) { return { component: c, label: Fitness.LABELS[c], state: comps[c].state, text: comps[c].text }; }), complete: complete };
    });
    if (opts.teamId) rows = rows.filter(function (r) { return r.team_id === opts.teamId; });
    const counts = { soldiers: rows.length, complete: 0, incomplete: 0, no_results: 0, with_review: 0, with_blocked: 0, by_component: {} };
    Fitness.COMPONENTS.forEach(function (c) { counts.by_component[c] = { label: Fitness.LABELS[c], missing: 0, review: 0, blocked: 0 }; });
    rows.forEach(function (r) {
      if (r.complete) counts.complete++; else counts.incomplete++;
      if (r.no_results) counts.no_results++;
      if (r.gaps.some(function (g) { return g.state === 'review'; })) counts.with_review++;
      if (r.gaps.some(function (g) { return g.state === 'blocked'; })) counts.with_blocked++;
      r.gaps.forEach(function (g) { counts.by_component[g.component][g.state]++; });
    });
    if (opts.component) rows = rows.filter(function (r) { return r.gaps.some(function (g) { return g.component === opts.component; }); });
    rows.sort(function (a, b) { return a.complete === b.complete ? (a.team_name + a.soldier_name < b.team_name + b.soldier_name ? -1 : 1) : (a.complete ? 1 : -1); });
    const mine = Assignments.mine(ctx, courseId), teams = org.teams.filter(function (t) { return ctx.role === ROLES.ADMIN || mine.team_ids.indexOf(t.id) !== -1; }).map(function (t) { return { id: t.id, name: t.name }; });
    return { counts: counts, rows: rows, teams: teams, filter: { teamId: opts.teamId || '', component: opts.component || '' },
      note: 'מסך לקריאה בלבד. "נפסלה" — אין כלל עובר/נכשל מוגדר (נדרשת החלטה); תוצאות מבוטלות אינן מוצגות.' };
  },

  /** Current snapshot for one soldier: latest, previous, progress (delta of weighted), component means. */
  summary(ctx, courseId, soldierId) {
    Records.guardCourse_(ctx, 'result.read', courseId);
    const rows = Snapshot.rows(ctx, 'FitnessTests', courseId, { soldierId: Util.str(soldierId) }).sort(function (a, b) { return Util.cellToIsoDate(a.test_date) < Util.cellToIsoDate(b.test_date) ? -1 : 1; });
    return Util.str(soldierId) ? Fitness.aggregate_(rows) : Analytics.groupFitness_(rows, Snapshot.soldiers(ctx, courseId, {}).length);   // D2: no soldierId => group figure, cohort-gated
  },
  aggregate_(rows) {
    const withW = rows.filter(function (r) { return Calc.hasScore(r.weighted_score); });
    const last = withW[withW.length - 1], prev = withW[withW.length - 2];
    const comp = {}; Fitness.COMPONENTS.forEach(function (c) {
      const vals = rows.map(function (r) { const x = Util.parseJson(r.component_scores_json, {})[c]; return { v: x && x.score !== null && x.score !== undefined ? x.score : null }; });
      const m = Snapshot.mean_(vals, 'v'); comp[c] = { label: Fitness.LABELS[c], count: vals.filter(function (x) { return x.v !== null; }).length, mean: m, mean_display: Util.display1(m) };
    });
    const mean = Snapshot.mean_(withW, 'weighted_score');
    return { count: rows.length, complete_count: withW.length, mean: mean, mean_display: Util.display1(mean), last: last ? Calc.validNumber(last.weighted_score) : null, previous: prev ? Calc.validNumber(prev.weighted_score) : null,
      progress: last && prev ? Calc.validNumber(last.weighted_score) - Calc.validNumber(prev.weighted_score) : null, by_component: comp, note: withW.length ? '' : Fitness.WAITING_TEXT };
  },
  /**
   * v1.0.4 — READ-ONLY data-quality report for the admin (changes nothing, decides nothing).
   * Counts results that have / lack a score and why, lists active soldiers with no gender (they can never be scored), and results that were scored under a different version than the active one.
   */
  dataQuality(ctx, courseId) {
    Records.guardCourse_(ctx, 'config.edit', courseId);
    const active = Fitness.activeVersion_(courseId);
    const sold = Db.where('Soldiers', function (x) { return x.course_id === courseId; }), byId = Object.create(null); sold.forEach(function (x) { byId[x.id] = x; });
    const rows = Records.list(ctx, 'FitnessTests', courseId, {});
    let complete = 0, incomplete = 0, noVersion = 0, stale = 0; const types = {};
    rows.forEach(function (r) {
      const has = Calc.hasScore(r.weighted_score);
      if (has) { complete++; if (active && r.scoring_version_id && r.scoring_version_id !== active.id) stale++; } else { incomplete++; if (!r.scoring_version_id) noVersion++; }
    });
    // why each unscored result has no score (source of the problem): per-component reasons stored with the result, grouped
    const byReason = {}, detail = [];
    rows.forEach(function (r) {
      if (Calc.hasScore(r.weighted_score)) return;
      const cs = Util.parseJson(r.component_scores_json, {}) || {}, rs = {}; Object.keys(cs).forEach(function (k) { const x = cs[k]; if (x && x.reason && x.reason !== 'ok') rs[x.reason] = true; });
      if (!Object.keys(cs).length) rs.not_entered = true;
      Object.keys(rs).forEach(function (k) { byReason[k] = (byReason[k] || 0) + 1; });
      if (detail.length < 100) detail.push({ id: r.id, soldier_name: byId[r.soldier_id] ? byId[r.soldier_id].full_name : '', test_date: Util.cellToIsoDate(r.test_date), reasons: Object.keys(rs).map(function (k) { return Fitness.REASON_TEXT[k] || k; }) });
    });
    const reasons = Object.keys(byReason).map(function (k) { return { code: k, text: Fitness.REASON_TEXT[k] || k, results: byReason[k] }; });
    const noGender = sold.filter(function (x) { return Util.isTrue(x.active) && GENDERS.indexOf(x.gender) === -1; }).map(function (x) { return { id: x.id, name: x.full_name }; });
    return { results: rows.length, complete: complete, incomplete: incomplete, incomplete_without_scoring_version: noVersion, scored_under_other_version: stale,
      active_version_id: active ? active.id : '', soldiers_without_gender: noGender, incomplete_reasons: reasons, incomplete_detail: detail,
      advice: (active ? '' : 'אין גרסת ניקוד מאושרת — אף תוצאה לא תקבל ציון. ') + (noGender.length ? noGender.length + ' חיילים פעילים ללא מין מוגדר — לא ניתן לנקד אותם. ' : '') + (stale ? stale + ' תוצאות חושבו בגרסת ניקוד אחרת — שקול "חשב מחדש" לכל תוצאה (לא מתבצע אוטומטית).' : '') };
  },
};
