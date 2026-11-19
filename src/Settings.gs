/**
 * Settings — ThresholdSettings: configurable values with history (append-only; the latest row whose effective_from <= today wins).
 * RULE: no professional value is invented. A key without an approved/default value is "unset" and the feature that needs it stays OFF
 * (shown as "לא הוגדר"), never replaced by a guess. Defaults below are ONLY values given in the approved specification or purely operational.
 */
const Settings = {
  /** key -> { type, min, max, def (spec/operational default or undefined), label, source } */
  KEYS: {
    'exam.pass_score':          { type: 'number', min: 0, max: 100, def: 80, label: 'ציון עובר במבחן עיוני', source: 'spec' },
    'qual.early_alert_days':    { type: 'int', min: 0, max: 365, def: 7, label: 'ימי התרעה מוקדמת להסמכה', source: 'spec' },
    'readiness.alert_days_before': { type: 'int', min: 0, max: 365, def: 0, label: 'ימים לפני מועד בדיקת כשירות להתראה', source: 'spec: "התראה במועד בדיקה"' },
    'attendance.min_percent':   { type: 'number', min: 0, max: 100, label: 'מינימום נוכחות (%)' },
    'trend.drop_points':        { type: 'number', min: 0.000001, max: 100, label: 'ירידה משמעותית (נקודות בין מדידות)' },
    'low.nav':                  { type: 'number', min: 0, max: 100, label: 'סף "תוצאה נמוכה" — ניווט' },
    'low.fitness':              { type: 'number', min: 0, max: 100, label: 'סף "תוצאה נמוכה" — כש״ג' },
    'low.marksmanship':         { type: 'number', min: 0, max: 100, label: 'סף "תוצאה נמוכה" — קליעה' },
    'level.nav.green_min':      { type: 'number', min: 0, max: 100, label: 'ירוק מתחילת ערך — ניווט' },
    'level.nav.yellow_min':     { type: 'number', min: 0, max: 100, label: 'צהוב מתחילת ערך — ניווט' },
    'level.fitness.green_min':  { type: 'number', min: 0, max: 100, label: 'ירוק מתחילת ערך — כש״ג' },
    'level.fitness.yellow_min': { type: 'number', min: 0, max: 100, label: 'צהוב מתחילת ערך — כש״ג' },
    'level.exams.green_min':    { type: 'number', min: 0, max: 100, label: 'ירוק מתחילת ערך — מבחנים' },
    'level.exams.yellow_min':   { type: 'number', min: 0, max: 100, label: 'צהוב מתחילת ערך — מבחנים' },
    'level.attendance.green_min':  { type: 'number', min: 0, max: 100, label: 'ירוק מתחילת ערך — נוכחות (%)' },
    'level.attendance.yellow_min': { type: 'number', min: 0, max: 100, label: 'צהוב מתחילת ערך — נוכחות (%)' },
    'evidence.min_records':     { type: 'int', min: 1, max: 100, label: 'מינימום מדידות כראיה לחוזקה/פער' },
    'health.weights':           { type: 'json', label: 'משקולות מדד בריאות קורס (JSON: תחום→אחוז, סכום 100)' },
    'backup.keep':              { type: 'int', min: 1, max: 365, def: 7, label: 'מספר גיבויים לשמירה', source: 'operational' }
  },
  HEALTH_DOMAINS: ['fitness', 'marksmanship', 'navigation', 'exams', 'attendance', 'qualifications', 'readiness'],

  parse_(key, value) {
    const k = Settings.KEYS[key];
    if (!k) throw new AppError('VALIDATION', 'מפתח הגדרה לא מוכר.');
    if (k.type === 'json') {
      const o = typeof value === 'string' ? Util.parseJson(value, null) : value;
      if (!o || typeof o !== 'object' || Array.isArray(o)) throw new AppError('VALIDATION', 'נדרש אובייקט JSON.');
      let sum = 0;
      Object.keys(o).forEach(function (d) {
        if (Settings.HEALTH_DOMAINS.indexOf(d) === -1) throw new AppError('VALIDATION', 'תחום לא מוכר במשקולות: ' + d);
        if (typeof o[d] !== 'number' || !Number.isFinite(o[d]) || o[d] < 0) throw new AppError('VALIDATION', 'משקל לא תקין: ' + d);
        sum += o[d];
      });
      if (Math.abs(sum - 100) > 1e-9) throw new AppError('VALIDATION', 'סכום המשקולות חייב להיות 100 (התקבל ' + sum + ').');
      return o;
    }
    if (typeof value === 'boolean' || (typeof value === 'object' && value !== null) || Util.isBlank(value)) throw new AppError('VALIDATION', 'ערך מספרי חסר או לא תקין.');
    const n = Util.numOrNull(value, k.label);
    if (n < k.min || n > k.max) throw new AppError('VALIDATION', 'ערך מחוץ לטווח המותר (' + k.min + '–' + k.max + ').');
    if (k.type === 'int' && !Number.isInteger(n)) throw new AppError('VALIDATION', 'נדרש מספר שלם.');
    return n;
  },

  /** Effective value for the course on `onDate` (default today): latest effective_from <= onDate; else the spec/operational default; else undefined (unset). */
  get(courseId, key, onDate) {
    const d = onDate || Util.todayIso();
    const rows = Db.where('ThresholdSettings', function (r) { return r.course_id === courseId && r.setting_key === key && Util.cellToIsoDate(r.effective_from) <= d; })
      .sort(function (a, b) { const x = Util.cellToIsoDate(a.effective_from), y = Util.cellToIsoDate(b.effective_from); return x === y ? String(a.updated_at).localeCompare(String(b.updated_at)) : x.localeCompare(y); });
    const last = rows[rows.length - 1];
    if (last) { const v = Util.parseJson(last.setting_value, undefined); if (v !== undefined) return v; }
    return Settings.KEYS[key] ? Settings.KEYS[key].def : undefined;
  },

  /** Same as get() but null (never undefined) when unset — for rules that stay OFF until configured. */
  opt(courseId, key, onDate) { const v = Settings.get(courseId, key, onDate); return v === undefined ? null : v; },

  /** Admin: set a value effective from a date. Appends (history is never overwritten). Reason required. */
  set(ctx, courseId, key, value, effectiveFrom, reason) {
    Records.guardCourse_(ctx, 'settings.edit', courseId);
    if (Util.isBlank(reason)) throw new AppError('VALIDATION', 'חובה לציין סיבה.');
    const parsed = Settings.parse_(key, value);
    const eff = Util.isBlank(effectiveFrom) ? Util.todayIso() : Util.isoDate(effectiveFrom, 'בתוקף מתאריך');
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'settings.edit', courseId);
      const before = Settings.get(courseId, key);
      const row = { id: Util.uuid(), course_id: courseId, domain: key.split('.')[0], setting_key: key, setting_value: JSON.stringify(parsed), effective_from: eff, updated_by: ctx.email, updated_at: Util.nowIso(), reason: Util.str(reason) };
      Db.insert('ThresholdSettings', row);
      Audit.log(ctx, { courseId: courseId, action: 'SETTING_SET', table: 'ThresholdSettings', recordId: row.id, before: { key: key, value: before }, after: { key: key, value: parsed, effective_from: eff }, reason: reason });
      return { key: key, value: parsed, effective_from: eff };
    });
  },

  /** All known keys with their current value ("unset" when nothing is configured) + history. Admin sees history; commander gets current values only. */
  list(ctx, courseId) {
    Records.guardCourse_(ctx, ctx.role === ROLES.ADMIN ? 'settings.edit' : 'settings.read', courseId);
    return Object.keys(Settings.KEYS).map(function (k) {
      const meta = Settings.KEYS[k], v = Settings.get(courseId, k);
      const o = { key: k, label: meta.label, type: meta.type, value: v === undefined ? null : v, is_set: v !== undefined, default_source: meta.def !== undefined ? (meta.source || 'default') : '' };
      if (ctx.role === ROLES.ADMIN) o.history = Db.where('ThresholdSettings', function (r) { return r.course_id === courseId && r.setting_key === k; })
        .map(function (r) { return { value: Util.parseJson(r.setting_value, null), effective_from: Util.cellToIsoDate(r.effective_from), updated_by: r.updated_by, updated_at: r.updated_at, reason: r.reason }; });
      return o;
    });
  },

  /** Traffic light for a value: 'green' | 'yellow' | 'red' | null (null = thresholds not configured or no data — never guessed). */
  level(courseId, domain, value, onDate) {
    if (value === null || value === undefined) return null;
    const g = Settings.get(courseId, 'level.' + domain + '.green_min', onDate), y = Settings.get(courseId, 'level.' + domain + '.yellow_min', onDate);
    if (g === undefined || y === undefined) return null;
    return value >= g ? 'green' : (value >= y ? 'yellow' : 'red');
  }
};
