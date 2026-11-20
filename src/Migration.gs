/**
 * Migration v0.4.1 (schema 1) -> v1.0.0 (schema 2). Admin only. Idempotent; never drops, renames or reorders anything.
 *   1. bookkeeping tables get their new columns (BackupJobs/AuditLog/SchemaMeta), then an automatic 'pre_migration' backup (aborts the migration if the backup cannot be written; no other table has been touched yet)
 *   2. ensureTable for every table: creates missing sheets, APPENDS missing columns (existing rows read '' in new columns)
 *   3. data steps: default fitness test types for courses that have none (approved weights, no scoring tables), assignments for course-wide qualifications, SchemaMeta
 *   4. invariant check: no existing table lost a row; report returned and audited
 * Existing data keeps its meaning: no value is recomputed or reinterpreted. Fitness scoring tables are NOT created (they need admin import + verification + approval).
 */
const Migration = {
  plan() {
    return { from_schema: Number((Db.get('SchemaMeta', 'schema_version') || {}).value || 1), to_schema: APP.SCHEMA_VERSION, tables: Object.keys(TABLES).length, note: 'התכנית המפורטת (עמודות חדשות/טבלאות חדשות) נוצרת בהרצה: setupDatabase() ו-Migration.run.' };
  },
  run(ctx) {
    Policy.require(ctx, 'backup.run', {});
    // Serialize the complete migration, including schema/table preparation and the pre-migration backup.
    // Locks.run is re-entrant in this codebase, so Backup.create() can safely run inside this lock.
    return Locks.run(function () {
      Policy.require(ctx, 'backup.run', {});
      const from = Number((Db.get('SchemaMeta', 'schema_version') || {}).value || 1);
      if (from > APP.SCHEMA_VERSION) throw new AppError('VALIDATION', 'סכמת הנתונים חדשה מהקוד — לא מבצעים מיגרציה לאחור.');
      ['BackupJobs', 'AuditLog', 'SchemaMeta'].forEach(function (t) { Db.ensureTable(t); });
      const backup = Backup.create(ctx, 'pre_migration');
      const before = {}; Object.keys(TABLES).forEach(function (t) { try { before[t] = Db.all(t).length; } catch (e) { before[t] = 0; } });
      const addedTables = [], addedCols = {};
      Object.keys(TABLES).forEach(function (t) { const r = Db.ensureTable(t); if (r.created) addedTables.push(t); if (r.addedCols && r.addedCols.length) addedCols[t] = r.addedCols; });
      let seeded = 0, assigned = 0;
      Db.all('Courses').forEach(function (c) {
        if (!Db.where('FitnessTestTypes', function (x) { return x.course_id === c.id; }).length) { Fitness.seedTypes_(ctx, c.id); seeded++; }
        assigned += Qualifications.sync_(ctx, c.id);
      });
      const meta = Db.get('SchemaMeta', 'schema_version');
      if (!meta) Db.insert('SchemaMeta', { id: 'schema_version', value: APP.SCHEMA_VERSION, updated_at: Util.nowIso() }); else if (Number(meta.value) !== APP.SCHEMA_VERSION) Db.update('SchemaMeta', 'schema_version', { value: APP.SCHEMA_VERSION, updated_at: Util.nowIso() });
      const lost = []; Object.keys(before).forEach(function (t) { if (Db.all(t).length < before[t]) lost.push(t); });
      if (lost.length) throw new AppError('MIGRATION_FAILED', 'אחרי המיגרציה חסרות שורות בטבלאות: ' + lost.join(', ') + ' — שחזרו מהגיבוי ' + backup.id);
      const rep = { from_schema: from, to_schema: APP.SCHEMA_VERSION, backup_id: backup.id, added_tables: addedTables, added_columns: addedCols, fitness_types_seeded_for_courses: seeded, qualification_assignments_created: assigned, rows_per_table_unchanged: true, backup_audit_status: backup.audit_status || 'ok' };
      let auditStatus = 'ok';
      try { Audit.log(ctx, { action: 'MIGRATION', table: 'SchemaMeta', recordId: 'schema_version', before: { schema: from }, after: rep }); }
      catch (auditError) { auditStatus = 'failed'; }
      rep.migration_committed = true;
      rep.audit_status = auditStatus;
      if (auditStatus === 'failed' || rep.backup_audit_status === 'failed') {
        rep.warning_code = 'AUDIT_WRITE_FAILED';
        rep.warning = 'המיגרציה הושלמה ואומתה, אך אחד מאירועי הביקורת לא נשמר. יש לדווח למנהל המערכת.';
      }
      return rep;
    });
  }
};
