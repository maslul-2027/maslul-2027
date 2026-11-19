/**
 * Calc — pure business calculations. No storage, no Apps Script APIs.
 * Missing data is null and is never treated as zero.
 */
const Calc = {
  NAV_FORMULA_VERSION: 'nav-v1',

  // ---------------- Navigation ----------------
  /** Validates + normalises a navigation payload. Throws AppError(VALIDATION). */
  navNormalize(p) {
    if (!p) throw new AppError('VALIDATION', 'חסרים נתוני ניווט.');
    const distance = Util.numOrNull(p.distance_km, 'מרחק');
    const plan = Util.numOrNull(p.plan_score, 'ציון תכנון');
    const debrief = Util.numOrNull(p.debrief_score, 'ציון תחקיר');
    const done = Util.numOrNull(p.points_completed, 'נקודות שנדקרו');
    const total = Util.numOrNull(p.points_total, 'סך נקודות');
    if (distance === null || distance <= 0 || distance > APP.NAV_DISTANCE_MAX_KM ||
        Math.abs(distance / APP.NAV_DISTANCE_STEP_KM - Math.round(distance / APP.NAV_DISTANCE_STEP_KM)) > 1e-9) {
      throw new AppError('VALIDATION', 'המרחק חייב להיות מספר חיובי בקפיצות של 0.5 ק״מ.');
    }
    if (plan === null || debrief === null || plan < 0 || plan > 5 || debrief < 0 || debrief > 5) {
      throw new AppError('VALIDATION', 'ציוני התכנון והתחקיר חייבים להיות בין 0 ל-5.');
    }
    if (done === null || total === null || !Number.isInteger(done) || !Number.isInteger(total) || total <= 0 || done < 0 || done > total) {
      throw new AppError('VALIDATION', 'מספר הנקודות אינו תקין (סך נקודות > 0, ושנדקרו בין 0 לסך).');
    }
    return { distance_km: distance, plan_score: plan, debrief_score: debrief, points_completed: done, points_total: total };
  },

  /** points_score = 90 * completed / total ; final = plan + debrief + points_score (exact, unrounded). */
  navCompute(n) {
    const pointsScore = 90 * n.points_completed / n.points_total;
    return { points_score: pointsScore, final_score: n.plan_score + n.debrief_score + pointsScore };
  },

  // ---------------- Marches ----------------
  marchNormalize(p) {
    const a = Util.numOrNull(p.km_no_stretcher, 'ק״מ ללא אלונקה');
    const b = Util.numOrNull(p.km_stretcher, 'ק״מ עם אלונקה');
    if (a === null || b === null || a < 0 || b < 0) throw new AppError('VALIDATION', 'ק״מ חייבים להיות מספרים אי-שליליים.');
    return { km_no_stretcher: a, km_stretcher: b, total_km: Math.round((a + b) * 1e6) / 1e6 };
  },

  // ---------------- Trap Bar ----------------
  // v1.0.3: the Trap Bar score comes from the gender-specific table (images supplied by the user), like the other components — see Fitness.componentScore_.
  // The old formula 100-10*(10-reps) contradicted the table (e.g. 9 reps = 95, not 90) and was removed.

  // ---------------- Fitness weighting (tables are NOT part of this function) ----------------
  /**
   * scores: {component: number|null}; weights: {component: percent}.
   * If any weighted component lacks a score => no total (null) and the missing list; never partial, never zero.
   */
  weightedFitness(scores, weights) {
    if (!weights || typeof weights !== 'object') throw new AppError('VALIDATION', 'חסרות משקולות.');
    const comps = Object.keys(weights);
    if (!comps.length) throw new AppError('VALIDATION', 'חסרות משקולות.');
    let wsum = 0;
    comps.forEach(function (c) {
      const w = weights[c];
      if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) throw new AppError('VALIDATION', 'משקל לא תקין ברכיב ' + c + ' (נדרש מספר סופי אי-שלילי).');
      wsum += w;
    });
    if (Math.abs(wsum - 100) > 1e-9) throw new AppError('VALIDATION', 'סכום המשקולות חייב להיות 100 (התקבל ' + wsum + ').');   // never silently normalise
    comps.forEach(function (c) {
      const v = scores ? scores[c] : undefined;
      if (v === null || v === undefined) return;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) throw new AppError('VALIDATION', 'ציון רכיב לא תקין (נדרש מספר 0–100): ' + c);
    });
    const missing = comps.filter(function (c) { return scores[c] === null || scores[c] === undefined; });
    if (missing.length) return { score: null, missing: missing };   // never a partial total, never zero
    const total = comps.reduce(function (a, c) { return a + scores[c] * weights[c]; }, 0) / 100;
    return { score: total, missing: [] };
  },

  // ---------------- Theoretical exams ----------------
  EXAM_PASS_DEFAULT: 80,
  /**
   * attempts: {A,B,C} scores (null/undefined = not taken). Each attempt judged separately.
   * Returns { status, passed, pass_attempt, next_required, meeting_required, weighted_score, effective_score, warnings }
   * status: incomplete | pending_B | pending_C | passed | failed
   */
  examEvaluate(attempts, passScore) {
    const pass = passScore === undefined || passScore === null ? Calc.EXAM_PASS_DEFAULT : passScore;
    if (typeof pass !== 'number' || !Number.isFinite(pass) || pass < 0 || pass > 100) throw new AppError('VALIDATION', 'ציון עובר חייב להיות מספר סופי בין 0 ל-100.');
    const get = function (k) {
      const v = Util.numOrNull(attempts && attempts[k], 'ציון ' + k);
      if (v !== null && (v < 0 || v > 100)) throw new AppError('VALIDATION', 'ציון חייב להיות בין 0 ל-100.');
      return v;
    };
    const A = get('A'), B = get('B'), C = get('C');
    const out = { status: 'incomplete', passed: null, pass_attempt: null, next_required: null, meeting_required: false,
                  weighted_score: null, effective_score: null, warnings: [] };
    if (A === null) {
      if (B !== null || C !== null) out.warnings.push('קיים ציון B/C ללא ציון A');
      out.next_required = 'A';
      return out;
    }
    if (A >= pass) {
      if (B !== null || C !== null) out.warnings.push('B/C הוזנו אף שאין בהם צורך (A עבר)');
      out.status = 'passed'; out.passed = true; out.pass_attempt = 'A'; out.effective_score = A; // weighted_score stays null: weighting defined only for retake path
      return out;
    }
    // A failed => B required
    if (B === null) {
      if (C !== null) out.warnings.push('קיים ציון C ללא ציון B');
      out.status = 'pending_B'; out.next_required = 'B';
      return out;
    }
    if (B >= pass) {
      if (C !== null) out.warnings.push('C הוזן אף שאין בו צורך (B עבר)');
      out.status = 'passed'; out.passed = true; out.pass_attempt = 'B';
      out.weighted_score = 0.7 * B + 0.3 * A; out.effective_score = out.weighted_score;
      return out;
    }
    // B failed => C required AND disciplinary/commander meeting required (even if C passes)
    out.meeting_required = true;
    if (C === null) { out.status = 'pending_C'; out.next_required = 'C'; return out; }
    if (C >= pass) {
      out.status = 'passed'; out.passed = true; out.pass_attempt = 'C';
      out.weighted_score = 0.7 * C + 0.3 * A; out.effective_score = out.weighted_score;
      return out;
    }
    out.status = 'failed'; out.passed = false;
    return out;
  },

  // ---------------- PZM (formula only partially approved) ----------------
  PZM_BANDS: { 4: 0, 5: 0.5, 6: 0.5, 7: 1, 8: 1, 9: 1.5, 10: 1.5, 11: 2, 12: 2 },
  /**
   * Only integer months 4..12 are mapped (approved). 3 months and the rounding method are NOT approved:
   * they return status 'unverified'. <3 and >12 are flagged, no value is invented.
   */
  pzmFromMonths(months) {
    if (months === null || months === undefined || !Number.isInteger(months)) return { status: 'unverified', reason: 'שיטת העיגול טרם אושרה' };
    if (months < 3) return { status: 'anomaly_low', flag: 'חריג: פחות מ-3 חודשים' };
    if (months === 3) return { status: 'unverified', reason: 'מיפוי 3 חודשים טרם אושר' };
    if (months > 12) return { status: 'anomaly_high', flag: 'חריג: מעל 12 חודשים' };
    const offset = Calc.PZM_BANDS[months];
    return { status: 'ok', base: 'ת׳', offset: offset, label: offset === 0 ? 'ת׳' : 'ת׳+' + offset };
  },

  // ---------------- Aggregates ----------------
  /** Mean of finite numbers; null if there is nothing to average. null/undefined are skipped, never zero. */
  /** v1.0.5 — the ONE definition of "this cell holds a usable number". Returns the number, or null for: null, undefined, '', whitespace-only, non-numeric text, NaN, +-Infinity, booleans, objects. A real 0 is valid. */
  validNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') { const s = v.trim(); return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null; }
    return null;
  },
  hasScore(v) { return Calc.validNumber(v) !== null; },
  mean(values) {
    const xs = (values || []).filter(function (v) { return typeof v === 'number' && Number.isFinite(v); });
    if (!xs.length) return null;
    return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
  },

  /** records: [{present:boolean}] (cancelled already excluded by caller). null when no records. */
  attendancePercent(records) {
    const total = (records || []).length;
    if (!total) return null;
    const present = records.filter(function (r) { return Util.isTrue(r.present); }).length;
    return { present: present, total: total, absent: total - present, percent: 100 * present / total };
  }
};
