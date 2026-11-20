/**
 * Setup & migrations. Run setupDatabase() manually from the Apps Script editor as the deploying admin.
 * Idempotent: safe to re-run; only creates missing sheets / appends missing columns. Never drops or reorders.
 * Creates TWO spreadsheets: main, and private (notes/assessments/personal details). Neither is shared with
 * commanders — all access goes through the Web App (runs as the deployer) and Policy checks.
 */
function setupDatabase() {
  const props = PropertiesService.getScriptProperties();
  const adminEmail = String(props.getProperty(APP.PROP.ADMIN_EMAIL) || '').trim().toLowerCase();
  if (!adminEmail) throw new Error('יש להגדיר Script Property בשם ADMIN_EMAIL לפני ההתקנה.');

  const make = function (propKey, title) {
    let id = props.getProperty(propKey);
    if (!id) { const ss = SpreadsheetApp.create(title); id = ss.getId(); props.setProperty(propKey, id); }
    return id;
  };
  make(APP.PROP.MAIN_DB, 'Course Tracker — Main DB (do not share)');
  make(APP.PROP.PRIVATE_DB, 'Course Tracker — Private DB (admin only, do not share)');
  SheetsStore._ss = {};

  const report = [];
  Object.keys(TABLES).forEach(function (t) { const r = SheetsStore.ensureTable(t); report.push(t + (r.created ? ' [new]' : '') + (r.addedCols.length ? ' +' + r.addedCols.join(',') : '')); });

  // remove the default empty sheet created with a new spreadsheet
  ['main', 'private'].forEach(function (s) {
    const ss = SheetsStore.ss_(s); const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('גיליון1');
    if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
  });

  const meta = Db.get('SchemaMeta', 'schema_version');
  if (!meta) Db.insert('SchemaMeta', { id: 'schema_version', value: APP.SCHEMA_VERSION, updated_at: Util.nowIso() });
  else Db.update('SchemaMeta', 'schema_version', { value: APP.SCHEMA_VERSION, updated_at: Util.nowIso() });

  // bootstrap admin user row (so the admin appears in user management)
  if (!Db.where('Users', function (u) { return String(u.email).toLowerCase() === adminEmail; }).length) {
    Db.insert('Users', { id: Util.uuid(), email: adminEmail, display_name: 'מנהל מערכת', role: ROLES.ADMIN, course_scope: '', active: true, created_at: Util.nowIso(), created_by: 'setup' });
  }
  Audit.log(null, { action: 'SETUP', table: 'SchemaMeta', recordId: 'schema_version', after: { version: APP.SCHEMA_VERSION } });
  return { mainUrl: SheetsStore.ss_('main').getUrl(), privateUrl: SheetsStore.ss_('private').getUrl(), tables: report };
}

/** One-off helper: creates the first course with default (temporary, renameable) departments/teams. Run once as admin. */
function createFirstCourse(name, startDate) {
  Auth._emailProvider = function () { return PropertiesService.getScriptProperties().getProperty(APP.PROP.ADMIN_EMAIL); };
  try { return Courses.create(Auth.context(), { name: name || 'קורס ראשון', start_date: startDate }); }
  finally { Auth._emailProvider = null; }
}
