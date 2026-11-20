/**
 * Snapshot — the ONE gateway for "current state" figures (averages, counts, group metrics).  (Stage 3, v0.4.0)
 *
 * Rule (approved): history is never touched, but a CANCELLED soldier is excluded from every current-state calculation.
 *   - Historical view  : Records.list / Navigation.list / soldier card history  -> may show cancelled soldiers' results (admin only).
 *   - Current snapshot : anything that aggregates (mean, count, rate, group metric) MUST take its rows from Snapshot.*  -> never from Records.list directly.
 * Visibility (commander assignments, inactive/cancelled hiding) is applied here too, so an aggregate can never reveal what a list would hide.
 * A structural test (tests/stage3.js) fails if another file calls Calc.mean directly.
 */
const Snapshot = {
  /** Eligible for current-state figures: not cancelled. (Inactive soldiers stay eligible unless onlyActive is requested — open decision, see DECISIONS_NEEDED.) */
  eligible_(s) { return !!s && s.record_status === RECORD_STATUS.ACTIVE; },

  /** Soldiers of the course the caller may see AND that count in current figures. f: {departmentId, teamId, soldierId, onlyActive}. */
  soldiers(ctx, courseId, f) {
    f = f || {};
    const vis = Soldiers.visibleFn_(ctx, courseId);
    return Db.where('Soldiers', function (s) {
      if (s.course_id !== courseId) return false;
      if (!Snapshot.eligible_(s) || !vis(s)) return false;
      if (f.soldierId && s.id !== f.soldierId) return false;
      if (f.departmentId && s.department_id !== f.departmentId) return false;
      if (f.teamId && s.team_id !== f.teamId) return false;
      if (f.onlyActive === true && !Util.isTrue(s.active)) return false;
      return true;
    });
  },

  /** ACTIVE (non-cancelled) navigation results of Snapshot soldiers. f adds: typeId, from, to (ISO dates, inclusive). */
  navigationRows(ctx, courseId, f) {
    f = f || {};
    const ids = {}; Snapshot.soldiers(ctx, courseId, f).forEach(function (s) { ids[s.id] = s; });
    return Db.where('NavigationTests', function (r) {
      if (r.course_id !== courseId || r.record_status !== RECORD_STATUS.ACTIVE || !ids[r.soldier_id]) return false;
      if (f.typeId && r.navigation_type_id !== f.typeId) return false;
      const d = Util.cellToIsoDate(r.test_date);
      if (f.from && d < f.from) return false;
      if (f.to && d > f.to) return false;
      return true;
    }).map(function (r) { return Object.assign({}, r, { _soldier: ids[r.soldier_id] }); });
  }
};
