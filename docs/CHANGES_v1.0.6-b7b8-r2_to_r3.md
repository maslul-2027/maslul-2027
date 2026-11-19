# שינויים: v1.0.6-b7b8-r2 → v1.0.6-b7b8-r3
## 1. תיקון ממצא ביקורת (`src/Fitness.gs`, `Fitness.completion`)
`requiredOf` בודקת עכשיו תקינות סמנטית של `weights_json` (`Fitness.checkWeights_`). פגום סמנטית → blocked (לא מפתחות חלקיים, לא na). ראו `B7_B8_DEFINITIONS.md` (R3). לא שונו: מנגנון הניקוד, טבלאות, הרשאות, שמירה.
## 2. דוחות — נבדק, קיים ועובד; שיפור נגישות בלבד
כבר קיים מסך "דוחות וייצוא" (תצוגה מקדימה לכל מי שמורשה; הפקת Excel/PDF וייצוא מלא — מנהל בלבד לפי `Policy`; יומן הפקות). לא שונה. נוסף רק כפתור קיצור **"הפקת דוחות"** במסך החיילים (מנהל בלבד). ההרשאות לא שונו (`report.generate` נשאר מנהל-בלבד; מפקד רואה תצוגה מקדימה בהיקפו בלבד).
## 3. קישור כללי לטופס פרטים אישיים (Google Forms)
**נמצא:** בפרויקט אין קישור Google Forms מוגדר ואין אפשרות להציג/להעתיק אותו. הקיים הוא תהליך אחר — קישור אישי חד-פעמי לחייל בתוך האפליקציה (`forms.createLink`, מנהל בלבד) — ולא שונה.
**נוסף (קריאה בלבד):** `Forms.generalLink` + נתיב `forms.generalLink`; כפתור **"העתקת קישור לטופס פרטים אישיים"** ו-**"פתיחה לבדיקה"** במסך החיילים. הקישור נלקח ממאפיין הסקריפט `PERSONAL_FORM_URL` (לא בקוד, לא ב-DB, לא הומצא). מוחזר רק קישור מילוי (`https://docs.google.com/forms/d/e/<id>/viewform[?…]` או `https://forms.gle/<id>`); קישור עריכה/ניהול, http, מארח אחר, פרטי גישה, רווחים — נדחים ולא מוחזרים. מורשים: מנהל ומפקד עם שיבוץ פעיל בקורס. העתקה: Clipboard API, עם גיבוי (שדה מסומן) כשהדפדפן חוסם. אין כתיבה ואין שינוי בטופס. **כשהקישור לא מוגדר** המסך אומר זאת במפורש — נדרש ממך הקישור (ראו החלטות).
## קבצים
שונו: `src/Fitness.gs`, `src/Forms.gs`, `src/Code.gs`, `src/Index.html`, `src/Config.gs` (VERSION), `tests/b7_gaps.js`, `tests/v1_pentest.js`, `tests/v1_system.js`, `tests/run_all.js`, `scripts/mutation_run.js`, `tests/mutation_results.json`, `CHANGELOG.md`, `docs/B7_B8_DEFINITIONS.md`. חדשים: `tests/r3_forms_reports.js`, `tests/ui_r3.js`, מסמכי r3.
