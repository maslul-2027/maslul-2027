// Loads the Apps Script sources into one Node VM context (no Apps Script APIs => in-memory Db).
const fs = require('fs'), path = require('path'), vm = require('vm');
const order = ['Config', 'Util', 'Calc', 'Scoring', 'Policy', 'Store', 'AuthAudit', 'Records', 'Courses', 'Navigation', 'Soldiers', 'Assignments', 'Snapshot', 'Code'];

function load() {
  const ctx = vm.createContext({ console });
  const code = order.map(f => fs.readFileSync(path.join(__dirname, 'src', f + '.gs'), 'utf8')).join('\n;\n')
    + '\n;this.__x={APP,ROLES,TABLES,Util,Calc,Scoring,Policy,Db,Auth,Audit,Records,Courses,Navigation,Soldiers,Assignments,Snapshot,api,whoAmI,API_,AppError,COURSE_STATUS,RECORD_STATUS,Locks,SheetsStore};';
  vm.runInContext(code, ctx);
  const X = ctx.__x;
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
    ensureTable: () => ({})
  });
  X.mem = mem;
  return X;
}
module.exports = { load };
