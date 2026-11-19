> **ARCHIVED / NOT AN EXECUTABLE RUNBOOK (2026-11-17).** This document contains historical instructions and must not be followed to install, migrate, configure permissions, create triggers, or deploy the R5 candidate. The only current preparation path is the read-only `MASLUL_2027_GOOGLE_TEST_TRANSFER_KIT_R10` procedure described in `docs/GOOGLE_TEST_RUNBOOK_D7.md` and `OWNER_ACTIONS.md`. That procedure stops before any remote write. Any later upload, setup, migration, trigger installation, or deployment requires a separate explicit owner approval after reviewing the exact TEST clone, backup, and content diff. Synthetic data only. If this notice conflicts with text below, this notice controls.

# התקנה והגדרה — 1.0.6-b7b8-r3-product-dev2 (גרסת הכנה ל-Staging; שערי קבלה פתוחים)

> **תכנון Staging מלא:** `STAGING_ENVIRONMENT.md`. **שינוי חשוב (F-1):** `setupDatabase`/`createFirstCourse`/`installDailyTrigger`/`migrateToV1` יורצו **מהעורך כחשבון `ADMIN_EMAIL`** — מריץ אחר נדחה. התקנה על מחשב נקי לבדיקות: `INSTALL_CLEAN_MACHINE.md`.

> **לא מוכנה לשימוש מבצעי.** לא הורצה אף בדיקה ב-Google Apps Script אמיתי (ראו `TEST_REPORT_v1.0.5.md`). התקנה ל-**Staging בלבד, נתוני דמה בלבד**.

## דרישות
- חשבון Google Workspace (חסם א׳ ב-`DECISIONS_NEEDED.md`): בלעדיו `Session.getActiveUser()` מחזיר ריק והמערכת נכשלת-סגור (חוסמת את כולם).
- הרשאות OAuth שהמניפסט מבקש: Sheets, Drive (גיבויים/מסמכים/ייצוא), `script.scriptapp` (טריגר יומי), `script.external_request` (המרת Sheets→xlsx). **נדרש אישור ארגוני** — ראו `REMAINING_GAPS.md`.

## התקנה נקייה
1. פרויקט Apps Script חדש. העתק את כל קבצי `src/`: כל ה-`.gs`, `Index.html`, `FormPage.html`, `appsscript.json`.
2. Project Settings → Script Properties: `ADMIN_EMAIL` = כתובת Google של המ״פ (מנהל).
3. הרץ `setupDatabase()` (אשר הרשאות). נוצרים גיליון ראשי וגיליון **פרטי** (הערות מ״פ, מעקבים אישיים, מועדפים, הערכות מפקד, פרטים אישיים). **אין לשתף אותם עם אף אחד.**
4. הרץ `createFirstCourse('שם','YYYY-MM-DD')`.
5. הרץ `installDailyTrigger()` פעם אחת — טריגר יומי (02:00) לפונקציה הפרטית `dailyJob_` (F-2: אינה ניתנת להפעלה מהדפדפן; הרצה ידנית מהעורך: `runDailyJobNow`): גיבוי יומי, רענון התראות, שמירת N גיבויים אחרונים (`backup.keep`, ברירת מחדל 7).
6. Deploy → Web app: Execute as **Me**, Access **Anyone within domain**.
7. כניסה כמנהל → מסך "הגדרות וספים": הזנת ספים (ספים שלא הוגדרו = הכלל כבוי). מסך "קורסים ומשתמשים": הוספת מפקדים; מסך "שיוכי מפקדים": שיוך (ללא שיוך — המפקד לא רואה אף חייל).

## טופס עדכון פרטים לחיילים (אופציונלי, החלטה פתוחה)
דף `FormPage.html` מוגש כש-`?form=<קוד>` מופיע ב-URL, ומגיש **רק** את הטופס (אף פעם לא את האפליקציה). חייל ללא חשבון Workspace דורש **פריסה נפרדת** עם Access = Anyone — החלטה ארגונית (ראו DECISIONS_NEEDED §1). כל עוד לא הוחלט, השאירו רק את פריסת ה-DOMAIN; המנהל יכול להעביר חייל קוד/קישור בעצמו. הקוד חד־פעמי, תקף עד 30 יום (ברירת מחדל 7), נשמר כ-SHA-256 בלבד, והשדות מוגבלים ל: שם מלא, פק״ל, תאריך גיוס. שום שינוי לא נכנס לתוקף לפני אישור המ״פ.

## OCR / AI
- OCR: תשתית וטיוטות בלבד; **ספק OCR לא נבחר** (`Adapters.gas_.ocrAvailable()` מחזיר false → `NOT_CONFIGURED`). כל שורה דורשת אישור פרטני.
- עוזר: מבוסס כללים ותבניות קבועות (ללא מודל שפה חיצוני). אין שליחת נתונים החוצה.

## הרצת הבדיקות המקומיות
```
node tests/run_all.js          # כל סוויטות ה-Node
node tests/run_all.js --ui     # + דפדפן (Playwright/Chromium מותקן מראש)
python3 tests/verify_export.py && node tests/verify_pdf.js   # ייצוא Excel / PDF (סימולציה)
```

## הפעלת ניקוד כש״ג (אחרי ההתקנה; Staging, נתוני דמה)
במסך כש״ג (מנהל): טען טבלאות כטיוטה ← בדוק מול המקור (החלטות מתח מחייבות: `OPEN_BLOCKERS.md`) ← "אשר גרסה" (סימון אימות + נימוק) (מתח בנים: אפוד אישי 7 ק״ג — קבוע, ללא בחירה). שורת המצב והדוח "איכות נתונים" מציגים מה עדיין חסר. מחזור הבדיקות המקומי: `docs/TEST_ENVIRONMENT.md`.

## חסמים פתוחים (זהים בכל המסמכים — מקור: docs/OPEN_BLOCKERS.md)
1. **לא הורץ Apps Script / Sheets / Drive אמיתיים.** כל הבדיקות רצות ב-Node/Chromium מול סימולציה.
2. **חסם Workspace (א׳):** זיהוי משתמש דורש Google Workspace — ממתין להחלטה.
3. **חסמי כש״ג:** אין חסמי ניקוד פתוחים בכש״ג. N1, N2, N5, N6, N7 הוכרעו (v1.0.6: מתח בנים = אפוד אישי 7 ק״ג בלבד; בנות חזרה אחת = 40 — החלטה מקצועית מאושרת; מחוץ לטווח = בדיקה); N3, N4, N8 נסגרו בראיה (`docs/OPEN_BLOCKERS.md`).
4. **U-פריטים / פז״ם / ספי התראה / כלל 60 לרכיב (U6)** — פתוחים; ספים שלא הוגדרו = כבויים.
5. **מתח בנים:** אפוד אישי 7 ק״ג בלבד, קבוע בקוד בכל סוגי המבחנים (אין בחירה); מעל 15 חזרות = בדיקה ידנית.
6. **ציונים שחושבו בגרסאות קודמות** (למשל Trap Bar לפי הנוסחה הישנה) אינם מחושבים מחדש אוטומטית.
**המערכת אינה מוכנה להפעלה מבצעית.**

## קישור כללי לטופס פרטים אישיים (v1.0.6-b7b8-r3, אופציונלי)
כדי שהכפתור "העתקת קישור לטופס פרטים אישיים" במסך החיילים יציג קישור: ב-Apps Script → Project Settings → Script properties הוסיפו מאפיין `PERSONAL_FORM_URL` עם **קישור המילוי** של הטופס הקיים (`https://docs.google.com/forms/d/e/…/viewform` או `https://forms.gle/…`). לא קישור עריכה. בלי המאפיין המסך מציג "הקישור לא הוגדר". לא נבדק מול Google אמיתי.
