# סקירת כל הפונקציות הגלובליות (Apps Script) — 1.0.6-b7b8-r3-product-dev2

> סקירה סטטית שנעשתה בקריאת הקוד של כל פונקציה (לא grep בלבד) + בדיקות סימולציית Node. **אינה מוכיחה התנהגות ב-Apps Script אמיתי.**
> **כלל Google המתועד** ([HTML Service: Communicate with Server Functions → Private functions](https://developers.google.com/apps-script/guides/html/communication)): פונקציית שרת ששמה מסתיים ב-`_` היא פרטית — "cannot be called by google.script.run and their names are never sent to the client". כל פונקציה גלובלית אחרת ניתנת לקריאה ע״י כל משתמש שיכול לפתוח את ה-Web App, ו-Web App שפרוס `executeAs: USER_DEPLOYING` רץ בהרשאות המפרס.
> **לא מתועד:** שימוש בפונקציה פרטית כ-handler של טריגר מתוזמן (`ScriptApp.newTrigger('dailyJob_')`). נבדק בחיפוש בתיעוד Google — לא נמצא אישור או שלילה. לכן זה **דורש אימות אמיתי: AT-D07**.

## הפונקציות (אכיפה בבדיקה סטטית: `tests/stg_setup_guard.js` — פונקציה גלובלית חדשה מפילה את הבדיקה עד לסקירה)

| פונקציה | קובץ | ניתנת לקריאה מהדפדפן? | רצה בהרשאת | משנה/יוצרת | הגנה בצד השרת | סטטוס |
|---|---|---|---|---|---|---|
| `api(method, args)` | Code.gs | כן (כל משתמש של ה-Web App) | מפרס | כל נתוני המערכת, דרך רשימת `API_` בלבד | `Auth.context()` (משתמש רשום ופעיל; אחרת נכשל), `Policy.require` לכל פעולה, `Records.guardCourse_` / `Soldiers.visibleFn_`; שיטה לא ברשימה = `NOT_FOUND`; שגיאות פנימיות מנוקות | נבדק סימולציה (`v1_pentest`) · [REAL] AT-AUTH/AT-SEC |
| `doGet(e)` | Code.gs | כן (HTTP GET; גם `google.script.run` — מחזיר רק HTML, ללא תופעות לוואי) | מפרס | כלום | `?form=` מגיש רק את `FormPage` (ללא נתונים); אחרת `Auth.tryContext()` — ללא הרשאה: דף "אין הרשאה" | נבדק סימולציה |
| `formOpen(token)` | Code.gs | כן, ללא התחברות לפי תכנון (הטוקן = ההרשאה) | מפרס | כלום (קריאה: שם/פק״ל/תאריך גיוס של חייל הטוקן בלבד) | `Forms.find_`: אורך 24–128, hash, תוקף, חד-פעמי, חייל פעיל וקורס לא בארכיון; שגיאה אחידה | מכוון · נבדק סימולציה · [REAL] מול פריסה |
| `formSubmit(token, payload)` | Code.gs | כן, כנ״ל | מפרס | שורת בקשה `pending` + סימון הטוקן כנוצל + יומן; **לא משנה את החייל** עד אישור מנהל | אותה בדיקת טוקן (שוב בתוך הנעילה), רשימת שדות מותרים, ולידציה, הערכים חייבים להיות שונים | מכוון · נבדק סימולציה |
| `whoAmI()` | Code.gs | כן | מפרס | כלום | מחזיר זהות עצמית/תפקיד/גרסה בלבד; לא רשום = `UNAUTHENTICATED` | מכוון |
| `setupDatabase()` | Setup.gs | כן | מפרס | יוצר גיליונות, עמודות, שורת מנהל, `SchemaMeta`, יומן | `Auth.assertAdminCaller_()` בשורה הראשונה | **F-1 תוקן בקוד · לא מאומת ב-Google (AT-SEC-01)** |
| `createFirstCourse(name, start)` | Setup.gs | כן | מפרס | קורס (+ זהות מנהל זמנית) | מגן מנהל לפני החלפת ספק הזהות; ה-`finally` מחזיר את הספק | כנ״ל |
| `installDailyTrigger()` | Setup.gs | כן | מפרס | טריגרים של הפרויקט (מוחק handler `dailyJob_`/`dailyJob` ויוצר אחד) | מגן מנהל | כנ״ל |
| `migrateToV1()` | Setup.gs | כן | מפרס | מיגרציית סכמה (אחרי גיבוי) | מגן מנהל לפני החלפת זהות | כנ״ל |
| `runDailyJobNow()` | Code.gs | כן | מפרס | זהה ל-`dailyJob_` (גיבוי יומי, התראות, גיזום, Preflight) | מגן מנהל (נכשל סגור) | **חדש ב-stg2** · סימולציה · [REAL] AT-SEC-01 |
| `dailyJob_()` | Code.gs | **לא** — פרטית (שם מסתיים ב-`_`) | בעל הטריגר | גיבוי יומי (פעם ביום), רענון התראות (קורסים לא בארכיון), גיזום, Preflight | אינה נחשפת ל-`google.script.run`; לא נשענת על פרמטר/אירוע | **F-2 תוקן בקוד · לא מאומת ב-Google (AT-SEC-02, AT-D07)** |

אין בפרויקט `doPost`, `onOpen`, `onEdit`, `onInstall` או פונקציות גלובליות אחרות; אין הצהרות `const f = function…` / הצבות `this.x =` ברמה העליונה (הבדיקה הסטטית אוכפת). מחלקות/אובייקטים (`Auth`, `Backup` …) אינם פונקציות גלובליות, ולכן אינם נקראים ישירות מהדפדפן; ה-hooks לבדיקות (`Auth._emailProvider`, `Adapters._fake`) הם מאפיינים בלבד ואינם ניתנים להצבה מהדפדפן.

## מגבלות ידועות של מגן הזהות
`Auth.assertAdminCaller_` משווה את `Session.getActiveUser().getEmail()` ל-`ADMIN_EMAIL`. ב-Gmail צרכני `getActiveUser()` עלול להיות ריק גם למנהל בהרצה מהעורך — במקרה כזה הפונקציות נחסמות (**מכוון: נכשל סגור**) ויש לתעד BLOCKED ולבדוק בסביבה אמיתית (AT-SEC-01) — אין להחליש את המגן.
