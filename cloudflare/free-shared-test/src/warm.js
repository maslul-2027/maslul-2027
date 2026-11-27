// Start-up warm-up. V8 compiles functions lazily, on first call; on a fresh isolate that cost would land inside the FIRST request that touches each part of the 570 KB engine and
// can exceed the Free plan's 10 ms CPU per request. Running a fixed set of READ-ONLY routes once, on the bundled synthetic course, while the module loads moves that cost into the
// start-up phase (which has its own 1 s limit, not the per-request 10 ms). Nothing here touches D1, the network or random numbers; failures are ignored (a cold path is slower, not wrong).
import { SEED_CHUNKS } from './seed.generated.js';
import { withMem, callEngine, allTableNames } from './host.js';
const ROUTES = ['courses.list', 'courses.org', 'assignments.mine', 'soldiers.list', 'soldiers.card', 'marches.list', 'attendance.summary', 'attendance.events', 'tasks.list', 'meetings.list', 'meetings.options', 'dash.home', 'dash.overview',
  'analytics.insights', 'alerts.counts', 'fitness.summary', 'mk.summary', 'exams.summary', 'readiness.summary', 'users.list', 'correction.list', 'settings.list', 'reports.preview'];
export function warmup() {
  if (globalThis.__MASLUL_NO_WARM) return 0; let ok = 0;
  try {
    const mem = {}; allTableNames().forEach(t => { mem[t] = []; }); for (const c of SEED_CHUNKS) for (const it of JSON.parse(c)) mem[it.t].push(it.j);
    const course = mem.Courses[0], sol = mem.Soldiers[0], admin = { userId: 'warm', role: 'admin', name: 'warm', courseIds: ['*'] };
    withMem(mem, () => { for (const m of ROUTES) { try { const r = callEngine(admin, 'demo-admin@x.com', m, { courseId: course.id, id: sol.id, opts: {}, data: {} }); if (r) ok++; } catch (e) { /* ignore */ } } });
  } catch (e) { /* warm-up is best effort */ }
  return ok;
}
