'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const source = process.argv[2];
if (!source) throw Error('Specify the pinned legacy source checkout');
const harness = fs.readFileSync(path.join(source, 'tests/harness.js'), 'utf8');
const orderLine = harness.match(/^const order = \[([^\n]+)\];$/m);
assert.ok(orderLine, 'Missing source load order');
const order = Array.from(orderLine[1].matchAll(/'([A-Za-z]+)'/g), match => match[1]);
const modules = order.map(name => fs.readFileSync(path.join(source, 'src', name + '.gs'), 'utf8'));

const bridge = String.raw`
const tables = new Map();
function rows(table) {
  if (!tables.has(table)) tables.set(table, []);
  return tables.get(table);
}
Db.use({
  readAll: table => structuredClone(rows(table)),
  insert: (table, row) => { rows(table).push(structuredClone(row)); return row; },
  updateById: (table, id, patch) => {
    const row = rows(table).find(item => String(item.id) === String(id));
    if (!row) throw new AppError('NOT_FOUND', 'הרשומה לא נמצאה');
    Object.assign(row, structuredClone(patch));
  },
  replaceAll: (table, records) => tables.set(table, structuredClone(records)),
  prepare: () => true,
  ensureTable: () => ({}),
});

const email = 'admin@example.invalid';
const admin = { email, role: 'admin', courseScope: '*' };
Courses.addUser(admin, { email, role: 'admin', display_name: 'מנהל הדגמה' });
Auth._emailProvider = () => email;
const courseId = Courses.create(admin, { name: 'קורס לדוגמה', start_date: '2027-03-01' }).id;
Courses.org(admin, courseId).teams.forEach((team, index) => {
  Soldiers.create(admin, courseId, {
    full_name: 'חניך לדוגמה ' + (index + 1),
    personal_number: String(9001 + index),
    gender: index % 2 ? 'F' : 'M',
    department_id: team.department_id,
    team_id: team.id,
  });
});

window.google = { script: { get run() {
  let success, failure;
  const run = operation => Promise.resolve().then(operation)
    .then(result => success?.(structuredClone(result)), error => failure?.(error));
  return {
    withSuccessHandler(handler) { success = handler; return this; },
    withFailureHandler(handler) { failure = handler; return this; },
    api(method, args) { return run(() => api(method, args)); },
    whoAmI() { return run(whoAmI); },
  };
} } };

window.syntheticCourse = Object.freeze({
  methods: Object.freeze(Object.keys(API_).sort()),
  run: (method, args) => structuredClone(api(method, args)),
});
`;

const engine = '(function () {\n' + modules.join('\n;\n') + '\n;\n' + bridge + '\n})();';
const context = { window: {}, structuredClone, console };
vm.runInNewContext(engine, context);
const { methods, run } = context.window.syntheticCourse;
const inventory = JSON.parse(fs.readFileSync('preview/capabilities.json', 'utf8'));
assert.deepEqual(Array.from(methods), Object.values(inventory.groups).flat().sort());
const [course] = run('courses.list', {}).data;
assert.equal(run('soldiers.list', { courseId: course.id }).data.length, 4);
const department = run('courses.org', { courseId: course.id }).data.departments[0];
assert.equal(run('courses.rename', { courseId: course.id, kind: 'department', id: department.id, name: 'בדיקה' }).ok, true);
assert.equal(run('courses.org', { courseId: course.id }).data.departments[0].name, 'בדיקה');

const original = fs.readFileSync(path.join(source, 'src/Index.html'), 'utf8');
assert.ok(original.includes('<body>'));
const html = original.replace('</head>', '<link rel="stylesheet" href="./design.css"><link rel="stylesheet" href="./course-design.css"></head>').replace('<body>', `<body>
<script src="./course-engine.js"></script>
<div data-course-banner dir="rtl">
  קורס סינתטי · השינויים נשמרים עד לרענון הדף.
  <details><summary>בדיקת פעולות מערכת</summary>
    <form id="course-actions">
      <label>פעולה <select name="method" dir="ltr"></select></label>
      <label>פרמטרים (JSON) <textarea name="args" dir="ltr">{}</textarea></label>
      <button type="submit">הפעלה</button>
    </form>
    <pre id="course-action-result" dir="ltr" aria-live="polite" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre>
  </details>
</div>
<script>
const actionForm = document.getElementById('course-actions');
const params = actionForm.elements;
const output = document.getElementById('course-action-result');
for (const method of window.syntheticCourse.methods) params.method.add(new Option(method, method));
actionForm.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const args = JSON.parse(params.args.value);
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw Error('נדרש אובייקט JSON');
    output.textContent = JSON.stringify(window.syntheticCourse.run(params.method.value, args), null, 2);
  } catch (error) {
    output.textContent = error.message;
  }
});
</script>`);
fs.writeFileSync('preview/course-engine.js', engine);
const unified = html.replace('<base target="_top">', '<link rel="manifest" href="./manifest.webmanifest">')
  .replace('<main>', '<main id="workspace" tabindex="-1">')
  .replace('<body>', '<body class="unified"><a class="skip-workspace" href="#workspace">דילוג לתוכן</a>')
  .replace(/<div class="notice" id="stageNotice">[^<]*<\/div>/, '<p id="stageNotice" class="notice">קורס לדוגמה · נתונים סינתטיים בלבד</p>')
  .replace('</body>', `<nav class="quick-nav" aria-label="מסכי עבודה">
    <button type="button" data-screen="dash" aria-current="page">בית</button>
    <button type="button" data-screen="soldiers">חניכים</button>
    <button type="button" data-screen="attendance">דיווח</button>
    <button type="button" data-screen="tasks">מעקבים</button>
    <button type="button" id="all-screens">כל המסכים</button>
  </nav>
  <script>
  const quickNav = document.querySelector('.quick-nav');
  const originalShowTab = showTab;
  showTab = function (screen) {
    const result = originalShowTab(screen);
    for (const item of quickNav.querySelectorAll('[data-screen]')) {
      if (item.dataset.screen === screen) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
    return result;
  };
  quickNav.addEventListener('click', event => {
    const screen = event.target.dataset.screen;
    if (screen && S.courseId) {
      showTab(screen);
      const workspace = document.getElementById('workspace');
      workspace.focus({ preventScroll: true });
      workspace.scrollIntoView({ block: 'start' });
    }
  });
  document.getElementById('all-screens').addEventListener('click', () => {
    const menu = document.getElementById('menuBtn');
    if (menu.getClientRects().length && menu.getAttribute('aria-expanded') !== 'true') menu.click();
    const firstScreen = document.querySelector('#grps button');
    if (firstScreen) firstScreen.focus();
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
  </script></body>`);
assert.ok(unified.includes('class="quick-nav"') && !unified.includes('<iframe'));
fs.writeFileSync('preview/course.html', unified);
fs.writeFileSync('preview/index.html', unified);
console.log(`PASS: ${methods.length} actions match inventory; synthetic course read and write verified`);
