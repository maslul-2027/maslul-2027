// Shared fixture for the v1.0.0 module tests (Node, in-memory Db). Synthetic data only.
const { load } = require('./harness'); const fakes = require('./fakes');
function setup(opts) {
  const X = load(); let tick = 0; const base = Date.now(); X.Util._clock = () => new Date(Math.max(Date.now(), base) + (++tick)); /* strictly increasing: optimistic-concurrency tokens are never equal within a test */ const fake = fakes.install(X); const admin = { email: 'admin@x.com', role: 'admin', courseScope: '*' };
  const c1 = X.Courses.create(admin, { name: 'קורס א', start_date: '2099-01-01' }).id, c2 = X.Courses.create(admin, { name: 'קורס ב', start_date: '2099-02-01' }).id;
  // Issue #66: new courses are seeded with the REGULAR fitness type only. Older courses still carry a legacy opening type; the shared fixture reproduces such a course (unless { noLegacyOpening: true }) so the opening-type regression tests keep covering history and legacy data.
  if (!(opts && opts.noLegacyOpening)) X.Fitness.legacyOpeningEntryForTests_ = true;   // test seam: legacy opening results may still be created by the regression suites
  if (!(opts && opts.noLegacyOpening)) [c1, c2].forEach(cid => X.Db.insert('FitnessTestTypes', { id: X.Util.uuid(), course_id: cid, name: 'מבחן פתיחה', components_json: JSON.stringify(['pullups', 'parallel_bars', 'trap_bar', 'run3km']), weights_json: JSON.stringify({ pullups: 20, parallel_bars: 20, trap_bar: 20, run3km: 40 }), active: true, created_at: X.Util.nowIso(), created_by: 'legacy', variants_json: '{}', is_opening: true }));
  const o1 = X.Courses.org(admin, c1), o2 = X.Courses.org(admin, c2);
  const dep = i => o1.departments[i].id, team = (d, i) => o1.teams.filter(t => t.department_id === o1.departments[d].id)[i].id;
  X.Courses.addUser(admin, { email: 'admin@x.com', role: 'admin', display_name: 'מנהל' });
  const mkCmd = (email, courses) => { X.Courses.addUser(admin, { email, role: 'commander', course_ids: courses || [c1], display_name: 'שם-' + email.split('@')[0] }); return { email, role: 'commander', courseScope: courses || [c1] }; };
  const none = mkCmd('none@x.com'), cT = mkCmd('team@x.com'), cD = mkCmd('dept@x.com'), cC = mkCmd('course@x.com');
  const asg = (c, type, id) => X.Assignments.create(admin, { course_id: c1, user_email: c.email, scope_type: type, scope_id: id, reason: 'בדיקה' });
  asg(cT, 'team', team(0, 0)); asg(cD, 'department', dep(0)); asg(cC, 'course', c1);
  const mk = (n, pn, d, i, g) => X.Soldiers.create(admin, c1, { full_name: n, personal_number: pn, gender: g || 'M', department_id: dep(d), team_id: team(d, i), commander_note: 'SECRET' });
  const S = { a: mk('אלף', '101', 0, 0), a2: mk('אלף-שני', '102', 0, 0, 'F'), b: mk('בית', '201', 0, 1), c: mk('גימל', '301', 1, 0), d: mk('דלת', '401', 1, 1) };
  S.f = X.Soldiers.create(admin, c2, { full_name: 'זר', personal_number: '101', gender: 'F', department_id: o2.departments[0].id, team_id: o2.teams[0].id });
  const as = (c, m, a) => { X.Auth._emailProvider = () => c.email; return X.api(m, a); };
  const code = fn => { try { fn(); return null; } catch (e) { return e.code || ('JS:' + e.message); } };
  const rid = () => X.Util.uuid();
  return { fake, fakes, X, admin, c1, c2, o1, o2, dep, team, none, cT, cD, cC, S, mk, as, code, rid };
}
module.exports = { setup };
