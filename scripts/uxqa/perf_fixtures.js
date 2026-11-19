// Performance fixtures 60 / 300 / 1000 soldiers (synthetic, in-memory Node Db — NOT Sheets/Apps Script latency; Google timing is listed in GOOGLE_TEST_PENDING).
// Measures server-side compute of: analytics.insights, reports.preview (analytic), attendance.events, soldiers.list, attendance.create with 1/3 absent.
const path = require('path'); const root = path.join(__dirname, '..', '..');
const { setup } = require(path.join(root, 'tests', 'fixture'));
const rows = [];
for (const N of [60, 300, 1000]) {
  const S = setup(); const { X, admin, c1 } = S; const org = X.Courses.org(admin, c1); const dep = org.departments[0], team = org.teams.find(t => t.department_id === dep.id);
  const nt = X.Navigation.typeCreate(admin, c1, 'ניווט פרף'); const ty = X.ActivityTypes.create(admin, c1, 'פעילות פרף').id; const ids = [];
  for (let i = 0; i < N; i++) { const s = X.Soldiers.create(admin, c1, { full_name: 'חייל סינתטי ' + i, personal_number: String(100000 + i), gender: 'M', department_id: dep.id, team_id: team.id }); ids.push(s.id);
    X.Records.create(admin, 'NavigationTests', c1, { request_id: X.Util.uuid(), soldier_id: s.id, test_date: '2026-0' + (3 + (i % 2)) + '-0' + (1 + (i % 8)), navigation_type_id: nt.id, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 } ); }
  for (let e = 0; e < 5; e++) X.Attendance.createEvent(admin, c1, { request_id: X.Util.uuid(), event_date: '2026-03-0' + (e + 1), activity_type_id: ty, scope_type: 'course', scope_id: c1, absent: ids.slice(0, 3).map(id => ({ soldier_id: id })) });
  X.Auth._emailProvider = () => admin.email; const T = (f) => { const a = process.hrtime.bigint(); const r = f(); const ms = Number(process.hrtime.bigint() - a) / 1e6; return [Math.round(ms), r]; };
  const o = { soldiers: N };
  [['soldiers.list', () => X.api('soldiers.list', { courseId: c1, opts: {} })], ['attendance.events', () => X.api('attendance.events', { courseId: c1 })], ['analytics.insights', () => X.api('analytics.insights', { courseId: c1 })], ['reports.preview', () => X.api('reports.preview', { courseId: c1, spec: {} })],
   ['attendance.create(absent 1/3/10)', () => X.api('attendance.create', { courseId: c1, data: { request_id: X.Util.uuid(), event_date: '2026-04-09', activity_type_id: ty, scope_type: 'course', scope_id: c1, absent: ids.slice(0, 10).map(id => ({ soldier_id: id })) } })]]
    .forEach(([n, f]) => { const [ms, r] = T(f); if (!r.ok) throw new Error(n + ' ' + JSON.stringify(r)); o[n + ' ms'] = ms; if (n === 'reports.preview') o['report html KB'] = Math.round(r.data.html.length / 1024); });
  rows.push(o); console.log(JSON.stringify(o));
}
require('fs').writeFileSync(process.argv[2] || '/tmp/perf.json', JSON.stringify(rows, null, 1));
