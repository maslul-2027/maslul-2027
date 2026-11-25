/**
 * Scoring — lookup engine for fitness component tables.
 * Tables are DATA, loaded from approved FitnessScoringVersions only. The draft transcription in /scoring is
 * intentionally NOT embedded in code: until the user approves it, every lookup throws SCORING_NOT_APPROVED.
 * No interpolation, no guessing: a value outside every row yields OUT_OF_RANGE.
 */
const Scoring = {
  parseTime(s) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(Util.str(s));
    if (!m || +m[2] > 59) throw new AppError('VALIDATION', 'זמן לא תקין (נדרש mm:ss).');
    return +m[1] * 60 + +m[2];
  },

  /**
   * table: { status:'APPROVED', kind:'time'|'reps', rows:[...] }
   * time rows: {score, from_sec|null, to_sec|null}  (null = open end); inclusive both ends
   * reps rows: {score, reps_min, reps_max}
   */
  lookup(table, value) {
    if (!table || table.status !== 'APPROVED') throw new AppError('SCORING_NOT_APPROVED', 'טבלת הניקוד טרם אושרה — החישוב חסום.');
    if (value === null || value === undefined || value === '') return null;
    if (table.kind === 'time') {
      const sec = typeof value === 'number' ? value : Scoring.parseTime(value);
      // v0.2.3: whole, non-negative seconds only (consistent with checkContiguity); 650.5 would fall between rows
      if (!Number.isFinite(sec) || !Number.isInteger(sec) || sec < 0) throw new AppError('VALIDATION', 'זמן חייב להיות מספר שלם אי-שלילי של שניות.');
      const row = table.rows.find(function (r) {
        return (r.from_sec === null || sec >= r.from_sec) && (r.to_sec === null || sec <= r.to_sec);
      });
      if (!row) throw new AppError('OUT_OF_RANGE', 'הערך מחוץ לטווחי הטבלה.');
      return row.score;
    }
    if (table.kind === 'reps') {
      const n = Util.numOrNull(value, 'חזרות');
      if (!Number.isInteger(n) || n < 0) throw new AppError('VALIDATION', 'מספר חזרות חייב להיות מספר שלם אי-שלילי.');
      const row = table.rows.find(function (r) { return n >= r.reps_min && n <= r.reps_max; });
      if (!row) throw new AppError('OUT_OF_RANGE', 'מספר החזרות מחוץ לטווחי הטבלה (לא מוגדר ציון).');
      return row.score;
    }
    throw new AppError('VALIDATION', 'סוג טבלה לא מוכר.');
  },

  /**
   * Structural validation required BEFORE an admin may approve a version. Returns a list of issues (empty = structurally valid).
   * Checks: kind, non-empty, numeric values, score range 0-100, strictly descending unique scores,
   * inverted ranges, open ends (time), and exact contiguity (no gap, no overlap).
   * Passing this check is necessary, NOT sufficient: values must still be verified against the source by a human.
   */
  checkContiguity(table) {
    const issues = [];
    const isNum = function (v) { return typeof v === 'number' && Number.isFinite(v); };
    if (!table || (table.kind !== 'time' && table.kind !== 'reps')) return ['סוג טבלה לא תקין'];
    const rows = table.rows;
    if (!Array.isArray(rows) || !rows.length) return ['הטבלה ריקה'];
    const seen = {};
    rows.forEach(function (r, i) {
      if (!isNum(r.score) || r.score < 0 || r.score > 100) issues.push('שורה ' + (i + 1) + ': ציון לא תקין');
      else {
        if (seen[r.score]) issues.push('ציון כפול: ' + r.score);
        seen[r.score] = true;
        if (i > 0 && isNum(rows[i - 1].score) && r.score >= rows[i - 1].score) issues.push('סדר ציונים לא יורד לפני ציון ' + r.score);
      }
    });
    if (table.kind === 'time') {
      rows.forEach(function (r, i) {
        // v0.2.2: time bounds are whole, non-negative seconds (a 650.5 bound would leave an uncovered second yet look contiguous)
        const okSec = function (v) { return v === null || (Number.isInteger(v) && v >= 0); };
        if (!okSec(r.from_sec) || !okSec(r.to_sec)) { issues.push('שורה ' + (i + 1) + ': גבול זמן חייב להיות מספר שלם אי-שלילי של שניות'); return; }
        if (i === 0 && r.from_sec !== null) issues.push('השורה הראשונה חייבת להיות פתוחה כלפי מטה');
        if (i === rows.length - 1 && r.to_sec !== null) issues.push('השורה האחרונה חייבת להיות פתוחה כלפי מעלה');
        if (i > 0 && r.from_sec === null) issues.push('שורה ' + (i + 1) + ': קצה פתוח באמצע הטבלה');
        if (i < rows.length - 1 && r.to_sec === null) issues.push('שורה ' + (i + 1) + ': קצה פתוח באמצע הטבלה');
        if (r.from_sec !== null && r.to_sec !== null && r.from_sec > r.to_sec) issues.push('טווח הפוך בציון ' + r.score);
        if (i > 0 && isNum(rows[i - 1].to_sec) && isNum(r.from_sec)) {
          if (r.from_sec < rows[i - 1].to_sec + 1) issues.push('חפיפה לפני ציון ' + r.score);
          else if (r.from_sec > rows[i - 1].to_sec + 1) issues.push('פער לפני ציון ' + r.score);
        }
      });
    } else {
      rows.forEach(function (r, i) {
        if (!Number.isInteger(r.reps_min) || !Number.isInteger(r.reps_max) || r.reps_min < 0) { issues.push('שורה ' + (i + 1) + ': חזרות לא תקינות'); return; }
        if (r.reps_min > r.reps_max) issues.push('טווח הפוך בציון ' + r.score);
        if (i > 0 && Number.isInteger(rows[i - 1].reps_min)) {
          if (rows[i - 1].reps_min < r.reps_max + 1) issues.push('חפיפה לפני ציון ' + r.score);
          else if (rows[i - 1].reps_min > r.reps_max + 1) issues.push('פער לפני ציון ' + r.score);
        }
      });
    }
    return issues;
  }
};
