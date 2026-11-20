// Renders Reports.analyticHtml_ with REAL Chromium page.pdf (local simulation of the HtmlService->PDF path; NOT Google/Apps Script) and validates: 5 A4 pages, RTL, text present, no NaN/undefined.
// usage: node scripts/uxqa/pdf_validate.js <outdir> [sparse]
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..', '..'); const out = process.argv[2] || '/tmp/pdfv'; fs.mkdirSync(out, { recursive: true });
const { world } = require(path.join(root, 'tests', 'world')); const { chromium } = require('playwright');
(async () => {
  const w = world(); const { X, admin, c1, c2 } = w; X.Auth._emailProvider = () => admin.email;
  const res = {};
  const dep = X.Courses.org(admin, c1).departments[0], team = X.Courses.org(admin, c1).teams.find(t => t.department_id === dep.id);
  const fixtures = [['full', c1, 0], ['sparse', c2, 0], ['large', c1, 72]];
  for (const [label, cid, extra] of fixtures) {
    if (extra) { /* large GROUP report: many departments, each >= 5 soldiers with navigation results => long comparison tables (no per-soldier element exists in the report) */
      const defs = []; for (let d = 0; d < extra / 6; d++) defs.push({ name: 'מחלקת עומס ' + (d + 1), teams: ['צוות א'] }); X.Courses.seedOrg_(admin, c1, defs);
      const org = X.Courses.org(admin, c1); org.departments.filter(d => /עומס/.test(d.name)).forEach((d, di) => { const tm = org.teams.find(t => t.department_id === d.id);
        for (let i = 0; i < 6; i++) { const s = X.Soldiers.create(admin, c1, { full_name: 'חייל סינתטי ' + di + '-' + i, personal_number: String(800000 + di * 10 + i), gender: i % 2 ? 'F' : 'M', department_id: d.id, team_id: tm.id });
          X.Records.create(admin, 'NavigationTests', c1, { request_id: X.Util.uuid(), soldier_id: s.id, test_date: '2026-0' + (3 + (i % 3)) + '-10', navigation_type_id: X.Db.all('NavigationTypes')[0].id, distance_km: 3, plan_score: 3 + (di % 3), debrief_score: 4 + (i % 2), points_completed: 2 + (i % 2), points_total: 3 }); } }); }
    const p = X.api('reports.preview', { courseId: cid, spec: {} }); if (!p.ok) throw new Error(JSON.stringify(p));
    const b = await chromium.launch(); const pg = await b.newPage(); await pg.setViewportSize({ width: 703, height: 1000 }); await pg.emulateMedia({ media: 'print' }); await pg.setContent(p.data.html, { waitUntil: 'load' });
    const clip = await pg.evaluate(() => [...document.querySelectorAll('section.pg')].map((e, i) => ({ page: i + 1, over: e.scrollHeight - e.clientHeight })).filter(x => x.over > 1)); const fill = await pg.evaluate(() => [...document.querySelectorAll('section.pg')].map((e, i) => { const b = e.querySelector('.bd'); return { page: i + 1, fill: Math.round(100 * b.offsetHeight / (e.clientHeight - 53)) }; }));
    const f = path.join(out, 'analytic_' + label + '.pdf'); await pg.pdf({ path: f, format: 'A4', printBackground: true, preferCSSPageSize: true }); await b.close();
    const info = execFileSync('pdfinfo', [f]).toString(); const pages = Number(/Pages:\s+(\d+)/.exec(info)[1]), size = /Page size:\s+(.*)/.exec(info)[1];
    const txt = execFileSync('pdftotext', ['-layout', f, '-']).toString(); fs.writeFileSync(path.join(out, 'analytic_' + label + '.txt'), txt);
    execFileSync('pdftoppm', ['-r', '70', '-png', f, path.join(out, 'analytic_' + label)]);
    const clean = t => t.replace(/[\u200e\u200f\u202a-\u202e]/g, ''); let footers = 0, wrong = [];
    for (let i = 1; i <= pages; i++) { const t = clean(execFileSync('pdftotext', ['-f', String(i), '-l', String(i), '-layout', f, '-']).toString()); const line = t.split('\n').find(l => /מתוך/.test(l) && /הופק/.test(l)) || ''; const nums = (line.match(/\d+/g) || []).slice(-2).map(Number); if (nums.includes(i) && nums.includes(pages)) footers++; else wrong.push({ page: i, line: line.trim().slice(0, 140) }); }
    res[label] = { pages, declared_pages: p.data.pages, pages_match: pages === p.data.pages, size, clipped_pages: clip, fill_pct: fill, near_empty: fill.length > 1 ? fill.filter(x => x.fill < 35) : [], footers_ok: footers, footers_wrong: wrong, has_title: /דוח אנליטי/.test(txt), nan: /NaN|undefined|\bnull\b/.test(txt), no_data_notice: /אין מספיק נתונים/.test(txt), svg_charts: (p.data.html.match(/<svg/g) || []).length };
  }
  console.log(JSON.stringify(res, null, 1)); fs.writeFileSync(path.join(out, 'pdf_validation.json'), JSON.stringify(res, null, 1));
  const bad = Object.values(res).some(r => !r.pages_match || !/A4/.test(r.size) || r.nan || !r.has_title || r.clipped_pages.length || r.near_empty.length || r.footers_ok !== r.pages); process.exit(bad ? 1 : 0);
})();
