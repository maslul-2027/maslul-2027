// Loads the Apps Script sources into one Node VM context (no Apps Script APIs => in-memory Db).
const fs = require('fs'), path = require('path'), vm = require('vm');
const order = ['Config', 'Util', 'Calc', 'Scoring', 'Policy', 'Store', 'AuthAudit', 'Records', 'Courses', 'Navigation', 'Soldiers', 'Assignments', 'Snapshot', 'Settings', 'FitnessDraft', 'Fitness', 'Modules', 'Marksmanship', 'Exams', 'Attendance', 'Readiness', 'Qualifications', 'Private', 'EmergencyContact', 'Alerts', 'Forms', 'Dashboard', 'Analytics', 'Adapters', 'Documents', 'Reports', 'Import', 'Ocr', 'Assistant', 'Backup', 'Preflight', 'Migration', 'Card', 'Meetings', 'Setup', 'Code'];
// every top-level const/class of the sources is exported to tests (so new modules need no harness edit)
const TOP = src => Array.from(src.matchAll(/^(?:const|class) ([A-Za-z_][A-Za-z0-9_]*)/gm)).map(m => m[1]);

function load(opts) {
  opts = opts || {}; const env = { console }; let sheets = null;
  if (opts.sheets) { sheets = require('./fakesheets').create(); env.SpreadsheetApp = sheets.SpreadsheetApp; env.PropertiesService = sheets.PropertiesService; }
  Object.assign(env, opts.env || {}); const ctx = vm.createContext(env);
  const files = order.filter(f => fs.existsSync(path.join(__dirname, '..', 'src', f + '.gs')));
  const srcs = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f + '.gs'), 'utf8'));
  const names = Array.from(new Set(srcs.flatMap(TOP))).concat(['api', 'whoAmI', 'dailyJob_', 'runDailyJobNow', 'formOpen', 'formSubmit', 'setupDatabase', 'migrateToV1', 'createFirstCourse', 'installDailyTrigger']);
  const code = srcs.join('\n;\n') + '\n;this.__x={' + names.join(',') + '};';
  vm.runInContext(code, ctx);
  const X = ctx.__x;
  if (opts.sheets) { X.sheets = sheets; return X; }
  const mem = {};
  const clone = o => JSON.parse(JSON.stringify(o));
  X.Db.use({
    readAll: t => (mem[t] = mem[t] || []).map(clone),
    insert: (t, o) => { (mem[t] = mem[t] || []).push(clone(o)); return o; },
    updateById: (t, id, p) => {
      const r = (mem[t] || []).find(x => String(x.id) === String(id));
      if (!r) throw new X.AppError('NOT_FOUND', 'x');
      Object.assign(r, clone(p));
    },
    replaceAll: (t, rows) => { mem[t] = rows.map(clone); },
    prepare: () => true,
    ensureTable: () => ({})
  });
  X.mem = mem;
  return X;
}
module.exports = { load };
