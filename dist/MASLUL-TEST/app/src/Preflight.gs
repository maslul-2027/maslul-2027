/**
 * Preflight — v1.0.1. Admin only, READ-ONLY. Inspects the ACTUAL Drive sharing of everything sensitive the system owns (not what the code intended to set):
 * main spreadsheet, private spreadsheet, the Drive root + documents/backups/reports folders, and every file inside those folders (up to a cap per folder).
 * Every check ends in exactly one of: PASS (verified), FAIL (verified, violates policy), NOT_VERIFIED (could not be checked — never counted as PASS), BLOCKED (cannot be checked from a script at all).
 * It NEVER changes a permission. Result overall: FAIL if any FAIL; INCOMPLETE if no FAIL but anything NOT_VERIFIED/BLOCKED; PASS only if every check passed.
 * Policy: access must be PRIVATE (no public link, no domain-wide link); the only people with direct access are the owner, the configured admin and 'system'; no commander may have direct Drive access.
 * The Apps Script branch (Adapters.gas_.driveReport) is UNVERIFIED — it was never run against real Drive in this package.
 */
const Preflight = {
  PER_FOLDER_CAP: 300,
  run(ctx) {
    Policy.require(ctx, 'backup.run', {});
    const checks = [], add = function (id, target, status, detail) { checks.push({ id: id, target: target, status: status, detail: detail }); };
    let rep = null; try { rep = Adapters.driveReport(Preflight.PER_FOLDER_CAP); } catch (e) { rep = null; add('drive.report', 'Drive', 'BLOCKED', 'לא ניתן לבדוק הרשאות Drive מהסביבה הזו: ' + String(e && e.message || e).slice(0, 120)); }
    if (rep) {
      const allowed = {}; [rep.owner, rep.admin, 'system'].forEach(function (e) { if (e) allowed[String(e).toLowerCase()] = 1; });
      const commanders = {}; Db.where('Users', function (u) { return u.role === ROLES.COMMANDER; }).forEach(function (u) { commanders[String(u.email).toLowerCase()] = 1; });
      rep.targets.forEach(function (t) {
        const id = 'drive.' + t.kind + '.' + t.label;
        if (t.missing) { add(id, t.label, t.required ? 'FAIL' : 'NOT_VERIFIED', t.required ? 'חסר פריט נדרש (' + t.label + ') — ההתקנה לא הושלמה?' : 'עדיין לא נוצר — אין מה לבדוק'); return; }
        if (t.error || !t.info) { add(id, t.label, 'NOT_VERIFIED', 'לא ניתן לקרוא את ההרשאות: ' + String(t.error || 'אין מידע').slice(0, 100)); return; }
        const i = t.info, problems = [], acc = String(i.access || '').toUpperCase();
        if (acc === 'ANYONE' || acc === 'ANYONE_WITH_LINK') problems.push('שיתוף ציבורי (' + acc + ')');
        else if (acc === 'DOMAIN' || acc === 'DOMAIN_WITH_LINK') problems.push('שיתוף לכל הדומיין (' + acc + ')');
        else if (acc !== 'PRIVATE') { add(id, t.label, 'NOT_VERIFIED', 'ערך שיתוף לא מוכר: ' + acc); return; }
        const people = (i.editors || []).map(function (e) { return { e: String(e).toLowerCase(), r: 'editor' }; }).concat((i.viewers || []).map(function (e) { return { e: String(e).toLowerCase(), r: 'viewer' }; }));
        people.forEach(function (p) { if (commanders[p.e]) problems.push('מפקד עם גישת ' + p.r + ' ישירה: ' + p.e); else if (!allowed[p.e]) problems.push('גישת ' + p.r + ' לא מורשית: ' + p.e); });
        add(id, t.label, problems.length ? 'FAIL' : 'PASS', problems.length ? problems.join('; ') : 'פרטי (PRIVATE), ללא עורכים/צופים נוספים');
      });
      (rep.truncated || []).forEach(function (f) { add('drive.cap.' + f, f, 'NOT_VERIFIED', 'נבדקו רק ' + Preflight.PER_FOLDER_CAP + ' הקבצים הראשונים בתיקייה — ייתכנו קבצים נוספים שלא נבדקו'); });
      if (rep.triggers === null || rep.triggers === undefined) add('trigger.daily', Backup.DAILY_HANDLER, 'NOT_VERIFIED', 'לא ניתן לקרוא טריגרים');
      else if (rep.triggers.indexOf(Backup.DAILY_HANDLER) !== -1) add('trigger.daily', Backup.DAILY_HANDLER, 'PASS', 'טריגר יומי מותקן (קיום בלבד — הרצה בפועל אינה נבדקת כאן; AT-D07)');
      else add('trigger.daily', Backup.DAILY_HANDLER, 'FAIL', rep.triggers.indexOf('dailyJob') !== -1 ? 'נמצא טריגר ישן על הפונקציה הציבורית dailyJob — יש להריץ שוב installDailyTrigger' : 'טריגר יומי לא מותקן (installDailyTrigger)');
    }
    add('deployment.access', 'Web App', 'BLOCKED', 'הגדרות הפריסה (Execute as / Who has access) אינן נקראות מתוך הסקריפט — יש לבדוק ידנית ב-Deploy → Manage deployments.');
    add('oauth.scopes', 'OAuth', 'NOT_VERIFIED', 'היקפי ההרשאה שניתנו בפועל אינם נבדקים מהסקריפט.');
    add('lock.service', 'LockService', 'NOT_VERIFIED', 'התנהגות נעילה בין משתמשים אמיתיים לא נבדקה (דורש חשבונות נפרדים).');
    add('temp.exports', 'קבצי ייצוא זמניים', 'NOT_VERIFIED', 'קובץ ייצוא זמני שנוצר בשורש ה-Drive של המנהל נמחק בסיום; אם הייצוא נקטע — הוא עלול להישאר מחוץ לתיקיות המערכת ולא ייסרק כאן.');
    const c = { PASS: 0, FAIL: 0, NOT_VERIFIED: 0, BLOCKED: 0 }; checks.forEach(function (x) { c[x.status]++; });
    const overall = c.FAIL ? 'FAIL' : (c.NOT_VERIFIED || c.BLOCKED ? 'INCOMPLETE' : 'PASS');
    const out = { overall: overall, counts: c, checks: checks, at: Util.nowIso(), note: 'בדיקה לקריאה בלבד — לא בוצע שום שינוי בהרשאות. PASS = אומת בפועל; NOT_VERIFIED/BLOCKED אינם PASS.' };
    Audit.log(ctx, { action: 'PREFLIGHT_RUN', table: 'Drive', recordId: '', after: { overall: overall, counts: c } });
    return out;
  },
  /** The most recent run recorded in the audit log (summary only), or null. */
  last(ctx) {
    Policy.require(ctx, 'backup.run', {});
    const r = Db.where('AuditLog', function (a) { return a.action === 'PREFLIGHT_RUN'; }).sort(function (a, b) { return a.timestamp < b.timestamp ? 1 : -1; })[0]; if (!r) return null;
    return { at: r.timestamp, summary: Util.parseJson(r.after_json, {}) };
  }
};
