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
  /** Eligible for current-state figures: not cancelled. Owner decision D4 (approved): soldiers with active=false are ALSO excluded from every current figure; a caller that needs history passes onlyActive:false explicitly (and must be permitted to). */
  eligible_(s) { return !!s && s.record_status === RECORD_STATUS.ACTIVE; },

  /** Soldiers of the course the caller may see AND that count in current figures. f: {departmentId, teamId, soldierId, onlyActive (default true; false = include inactive history)}. */
  soldiers(ctx, courseId, f) {
    f = f || {};
    const vis = Soldiers.visibleFn_(ctx, courseId);
    return Db.where('Soldiers', function (s) {
      if (s.course_id !== courseId) return false;
      if (!Snapshot.eligible_(s) || !vis(s)) return false;
      if (f.soldierId && s.id !== f.soldierId) return false;
      if (f.departmentId && s.department_id !== f.departmentId) return false;
      if (f.teamId && s.team_id !== f.teamId) return false;
      if (f.onlyActive !== false && !Util.isTrue(s.active)) return false;
      return true;
    });
  },

  /** ACTIVE (non-cancelled) navigation results of Snapshot soldiers. f adds: typeId, from, to (ISO dates, inclusive). */
  navigationRows(ctx, courseId, f) {
    f = f || {};
    const r = Snapshot.rows(ctx, 'NavigationTests', courseId, f);
    return f.typeId ? r.filter(function (x) { return x.navigation_type_id === f.typeId; }) : r;
  },

  /** Column that carries the date of each soldier-bound result table (for from/to filters and trends). */
  DATE_COL: { NavigationTests: 'test_date', FitnessTests: 'test_date', MarksmanshipTests: 'test_date', TheoreticalExamAttempts: 'attempt_date',
    ExamMeetings: 'meeting_date', SoldierEvents: 'event_date', ReadinessRecords: 'start_date', QualificationAssignments: 'completion_date' },

  /**
   * v1.0.0 — generic current-state rows for ANY soldier-bound result table: ACTIVE records of Snapshot soldiers
   * (visible to the caller, not cancelled). Every aggregate in every module takes its rows from here (structural test).
   * f: Snapshot.soldiers filters + from / to (ISO, inclusive; records without a date are kept only when no date filter is given).
   */
  /** Tables whose date/status live on a parent record (an attendance row belongs to an event; a cancelled event drops all its rows). */
  PARENT: { AttendanceRecords: ['AttendanceEvents', 'event_id', 'event_date'], MarchAttendance: ['Marches', 'march_id', 'march_date'] },

  rows(ctx, table, courseId, f) {
    f = f || {};
    const ids = Object.create(null); Snapshot.soldiers(ctx, courseId, f).forEach(function (s) { ids[s.id] = s; });
    const par = Snapshot.PARENT[table], parents = Object.create(null);
    if (par) Db.where(par[0], function (e) { return e.course_id === courseId && e.record_status === RECORD_STATUS.ACTIVE; }).forEach(function (e) { parents[e.id] = e; });
    const dc = par ? null : Snapshot.DATE_COL[table];
    return Db.where(table, function (r) {
      if (r.course_id !== courseId || r.record_status !== RECORD_STATUS.ACTIVE || !ids[r.soldier_id]) return false;
      if (par && !parents[r[par[1]]]) return false;
      if ((f.from || f.to) && (dc || par)) {
        const d = Util.cellToIsoDate(par ? parents[r[par[1]]][par[2]] : r[dc]);
        if (!d) return false;
        if (f.from && d < f.from) return false;
        if (f.to && d > f.to) return false;
      }
      return true;
    }).map(function (r) { return Object.assign({}, r, { _soldier: ids[r.soldier_id], _parent: par ? parents[r[par[1]]] : undefined }); });
  },

  /** Mean of a numeric field over Snapshot rows (rows with no number are skipped, never zero). null when nothing to average. */
  mean_(rows, key) {
    return Calc.mean(rows.map(function (r) { return Calc.validNumber(r[key]); }));
  }
};
