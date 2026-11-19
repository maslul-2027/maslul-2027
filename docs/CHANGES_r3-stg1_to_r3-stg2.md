# שינויים: r3-stg1 → r3-stg2 (1.0.6-b7b8-r3-stg2)

עותק חדש ונפרד; r3-stg1 לא שונה. אין פריסה לייצור, אין נתוני אמת. Diff מלא: `DIFF_r3-stg1_to_r3-stg2.diff` (במסירה).

## קוד (`src/`)
| קובץ | שינוי | סיבה |
|---|---|---|
| `Code.gs` | `dailyJob` → `dailyJob_` (פרטית); נוסף `runDailyJobNow()` עם `Auth.assertAdminCaller_()` | F-2 |
| `Backup.gs` | קבועים `DAILY_HANDLER = 'dailyJob_'`, `DAILY_HANDLERS = ['dailyJob_','dailyJob']`; ללא שינוי בלוגיקת הגיבוי/הגיזום | F-2 |
| `Setup.gs` | `installDailyTrigger` מסיר טריגר ישן/חדש ויוצר טריגר על `Backup.DAILY_HANDLER` | F-2 |
| `Preflight.gs` | בדיקת `trigger.daily` על `dailyJob_`; טריגר ישן בלבד = FAIL עם הנחיה; PASS מציין "קיום בלבד" | F-2 |
| `Config.gs` | VERSION `1.0.6-b7b8-r3-stg2` | — |
לא שונו: ניקוד, הרשאות/`Policy`, מדיניות גיבויים, לוגיקת התראות, מסכי B7/B8, `Auth.assertAdminCaller_`.

## בדיקות
- חדש `stg_f2_dailyjob.js` (7): דפדפן נדחה ללא תופעות לוואי; התקנת טריגר (כולל הסרת ישן, אידמפוטנטי, טריגרים זרים לא נוגעים); הטריגר ממשיך לעבוד (קורסים בארכיון מדולגים); אידמפוטנטיות + אובייקט אירוע מזויף לא משנה; `runDailyJobNow` נכשל סגור ב-8 זהויות; Preflight; בדיקה סטטית של הלקוח.
- חדש `stg_clean_machine_script.js` (6): לוגיקת הסקריפט עם stubs — נתיבים אחרי `cd`, כשל בכל שלב 2–9, `PASS` מול `PASS_WITH_UNVERIFIED_LOCK`, אי-דריסת ראיות. הבדיקה נכשלת על הסקריפט הישן (הוכח).
- `stg_setup_guard.js`: זהויות דומות נוספות; הבדיקה הסטטית מסווגת גלובליות/פרטיות, אוכפת מגן ב-`runDailyJobNow`, ותופסת פונקציות-ביטוי/הצבות גלובליות.
- `harness.js`: `opts.env` להזרקת `ScriptApp`/`PropertiesService` מדומים; עודכנו `v1_system`, `v1_preflight`, `fakes` לשם החדש.
- מוטציות חדשות M54–M59.

## סקריפט ההתקנה (`scripts/clean_machine_verify.sh`)
נתיבים מוחלטים; `PASS` / `PASS_WITH_UNVERIFIED_LOCK` (exit 3) / `FAIL`; שמירת lock ו-hash; אי-דריסה; hook בדיקה `CT_INJECT_FAIL` (בדיקות בלבד).

## מסמכים
חדשים: `GLOBAL_FUNCTIONS_REVIEW.md`, `TEST_REPORT_r3-stg2.md`, מסמך זה. עודכנו: `SECURITY_REVIEW_STATIC.md`, `ACCEPTANCE_TEST_PLAN.md` (AT-D06/AT-D07/AT-SEC-01/02), `OPEN_BLOCKERS.md`, `GOOGLE_ACCOUNT_ACTIONS.md`, `INSTALL_CLEAN_MACHINE.md`, `INSTALL_AND_SETUP.md`, `STAGING_ENVIRONMENT.md`, `CHANGELOG.md`, `README.md`.
