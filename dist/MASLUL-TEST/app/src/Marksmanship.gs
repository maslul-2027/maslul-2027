/**
 * Marksmanship (קליעה) — multiple tests per soldier. Regular score and YLM (ירי לאחר מאמץ) are SEPARATE measures:
 * YLM never enters the regular marksmanship score/average. There is NO "hits out of rounds" field (spec).
 * ASSUMPTIONS (to confirm, see DECISIONS_NEEDED): scores are numeric 0–100 (the specification does not define the scale); weapon type is free text (no list approved).
 */
const Marksmanship = {
  recordType: {
    editable: ['soldier_id', 'test_date', 'weapon_type', 'distance_m', 'examiner_score', 'weapon_zeroed', 'ylm_score', 'notes'],
    prepare(courseId, data, existing) {
      const s = Mods.availableSoldier_(courseId, data.soldier_id);
      const date = Util.isoDate(Util.cellToIsoDate(data.test_date), 'תאריך קליעה');
      Soldiers.scalar_(data.weapon_type, 'weapon_type'); const weapon = Util.str(data.weapon_type);
      if (!weapon || weapon.length > 50) throw new AppError('VALIDATION', 'סוג נשק חובה (עד 50 תווים).');
      const dist = Util.numOrNull(data.distance_m, 'מרחק ירי');
      if (dist === null || dist <= 0 || dist > 2000) throw new AppError('VALIDATION', 'מרחק ירי חייב להיות מספר חיובי במטרים.');
      const sc = function (v, l) { const n = Util.numOrNull(v, l); if (n !== null && (n < 0 || n > 100)) throw new AppError('VALIDATION', l + ' חייב להיות בין 0 ל-100.'); return n; };
      const ex = sc(data.examiner_score, 'ציון בוחן/רמה'), ylm = sc(data.ylm_score, 'ציון יל״מ');
      if (ex === null && ylm === null) throw new AppError('VALIDATION', 'יש להזין ציון בוחן/רמה ו/או ציון יל״מ.');
      const zeroed = Mods.bool_(data.weapon_zeroed, 'הנשק מאופס');
      return { soldier_id: s.id, test_date: date, weapon_type: weapon, distance_m: dist, examiner_score: ex === null ? '' : ex, weapon_zeroed: zeroed, ylm_score: ylm === null ? '' : ylm,
        notes: Mods.note_(data.notes), test_kind: ex !== null && ylm !== null ? 'both' : (ex !== null ? 'regular' : 'ylm') };
    }
  },

  view_(r) { return { test_date: Util.cellToIsoDate(r.test_date), weapon_type: r.weapon_type, distance_m: Number(r.distance_m), examiner_score: r.examiner_score === '' ? null : Number(r.examiner_score),
    weapon_zeroed: Util.isTrue(r.weapon_zeroed), ylm_score: r.ylm_score === '' ? null : Number(r.ylm_score), notes: r.notes || '', test_kind: r.test_kind }; },
  list(ctx, courseId, opts) { return Mods.history(ctx, 'MarksmanshipTests', courseId, opts, 'test_date', function (r) { return Marksmanship.view_(r); }); },

  /** The two measures are averaged separately. Rows MUST come from Snapshot. */
  aggregate_(rows) {
    const regular = Snapshot.mean_(rows, 'examiner_score'), ylm = Snapshot.mean_(rows, 'ylm_score');
    const sorted = rows.slice().sort(function (a, b) { return Util.cellToIsoDate(a.test_date) < Util.cellToIsoDate(b.test_date) ? -1 : 1; });
    const withEx = sorted.filter(function (r) { return Calc.hasScore(r.examiner_score); });
    return { count: rows.length, regular: { count: withEx.length, mean: regular, mean_display: Util.display1(regular), last: withEx.length ? Calc.validNumber(withEx[withEx.length - 1].examiner_score) : null },
      ylm: { count: rows.filter(function (r) { return Calc.hasScore(r.ylm_score); }).length, mean: ylm, mean_display: Util.display1(ylm) },
      zeroed_last: sorted.length ? Util.isTrue(sorted[sorted.length - 1].weapon_zeroed) : null, note: rows.length ? '' : 'אין מספיק נתונים' };
  },
  summary(ctx, courseId, soldierId) { Records.guardCourse_(ctx, 'result.read', courseId); const rows = Snapshot.rows(ctx, 'MarksmanshipTests', courseId, { soldierId: Util.str(soldierId) }); return Util.str(soldierId) ? Marksmanship.aggregate_(rows) : Analytics.groupMarksmanship_(rows, Snapshot.soldiers(ctx, courseId, {}).length); }
};
