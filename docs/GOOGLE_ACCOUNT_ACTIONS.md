> **ARCHIVED / NOT AN EXECUTABLE RUNBOOK (2026-11-17).** This document contains historical instructions and must not be followed to install, migrate, configure permissions, create triggers, or deploy the R5 candidate. The only current preparation path is the read-only `MASLUL_2027_GOOGLE_TEST_TRANSFER_KIT_R10` procedure described in `docs/GOOGLE_TEST_RUNBOOK_D7.md` and `OWNER_ACTIONS.md`. That procedure stops before any remote write. Any later upload, setup, migration, trigger installation, or deployment requires a separate explicit owner approval after reviewing the exact TEST clone, backup, and content diff. Synthetic data only. If this notice conflicts with text below, this notice controls.

# פעולות שדורשות גישה לחשבון Google שלך — Staging (1.0.6-b7b8-r3-product-dev2)

> אני (Claude) לא ביצעתי ואיני יכול לבצע אף אחת מהפעולות הבאות. הן תוכננו בלבד. כולן **בחשבון/טננט Staging ייעודי**, לא בייצור. נתוני דמה בלבד. אל תשנו הרשאות ארגוניות ללא אישור מנהל ה-Workspace שלכם.

## 0. החלטות שאני צריך ממך לפני שמתחילים
1. **סוג חשבון:** Google Workspace (טננט בדיקות) או Gmail צרכני? (קובע האם אפשר לבדוק מפקדים.)
2. **קישור המילוי של טופס פרטים אישיים** (או אישור ליצור טופס בדיקה חדש בחשבון ה-Staging לפי `STAGING_ENVIRONMENT.md` §7).
3. אישור לשינויי האבטחה: F-1 (מגן `assertAdminCaller_`) **ו-F-2** (`dailyJob_` פרטית + `runDailyJobNow`) — ראו `SECURITY_REVIEW_STATIC.md`. **שימו לב:** F-2 נשען על כך שטריגר מתוזמן יכול להפעיל פונקציה פרטית — לא מתועד ע״י Google; נבדק ב-AT-D07.

## 1. חשבונות (Workspace) — פעולת מנהל Workspace
| חשבון | תפקיד בבדיקות | שיבוץ באפליקציה |
|---|---|---|
| `stg-admin@<דומיין>` | מנהל + בעל הסקריפט (`ADMIN_EMAIL`) | — |
| `stg-cmd-t1@…` | מפקד צוות אחד | צוות 1 |
| `stg-cmd-t2@…` | מפקד שני צוותים | צוות 1 + צוות 2 |
| `stg-cmd-none@…` | מפקד ללא שיבוץ | ללא |
| `stg-cmd-other@…` | מפקד קורס אחר | קורס ב׳ בלבד |
(שמות לדוגמה — אתם בוחרים. אין להשתמש בחשבונות אמיתיים של מפקדים.)

## 2. צעדים בחשבון ה-Staging (על פי הסדר)
1. כניסה לחשבון `stg-admin` בפרופיל דפדפן נפרד.
2. `script.google.com` → פרויקט חדש `CourseTracker-STAGING` → העתקת 41 קבצי `src/` (ראו `STAGING_ENVIRONMENT.md` §5).
3. Project Settings → Script Properties → `ADMIN_EMAIL`.
4. הרצת `setupDatabase` מהעורך → אישור הרשאות ("Advanced → Go to … (unsafe)" — צפוי בסקריפט לא מאומת). צילום המסך של רשימת ההרשאות.
5. הרצת `createFirstCourse` (או יצירה מהאפליקציה) ו-`installDailyTrigger`. אחר כך: בדף Triggers לוודא טריגר אחד על `dailyJob_`; להריץ מהעורך `runDailyJobNow` (הפונקציה `dailyJob_` פרטית ואינה מופיעה בתפריט Run); למחרת אחרי 02:00 לבדוק ב-Executions שהטריגר רץ (AT-D07). בהרצות מהעורך — לצלם אם `ADMIN_EMAIL` מזוהה (AT-SEC-01): אם הפונקציות נחסמות למנהל, דווחו ואל תעקפו.
6. Deploy → Web app: Execute as **Me**; Access לפי סוג החשבון (§0.1). שמירת כתובת `/exec`.
7. ב-Drive: אימות ידני שהגיליונות והתיקיות Restricted ובבעלות חשבון ה-Staging (צילום).
8. יצירת Google Form (או קבלת הקישור), העתקת קישור **מילוי**, הגדרת `PERSONAL_FORM_URL`.
9. הרצת תוכנית הקבלה (`ACCEPTANCE_TEST_PLAN.md`) ומילוי עמודת התוצאה.
10. בסיום: ביטול הרשאות (myaccount.google.com/permissions) ואיפוס (`STAGING_ENVIRONMENT.md` §9).

## 3. מה אני יכול להכין מראש (ללא גישה)
קבצי `src/` מוכנים להעתקה, `staging_demo/` (נתוני דמה), רשימת שדות הטופס, תוכנית הקבלה, ותבנית טבלת תוצאות. כשהמחשב וה-Staging זמינים — שלחו לי את תוצאות הריצה (צילומים/טבלה) ואנתח ממצאים.

## 4. אסור
פריסה לייצור · הרצה על נתוני אמת · שיתוף הגיליונות · "Anyone" בפריסה · שינוי מדיניות ארגונית/OAuth בלי אישור · עריכת קוד בשטח כדי "לתקן" כשל (מדווחים).


## 5. הערה למעבר מ-stg2/dev1 ל-dev2 (שינוי סכמה תואם לאחור)
נוספה עמודה אחת **בסוף** הטבלה `CorrectionRequests`: `before_json`. בסביבה קיימת יש להריץ `setupDatabase()` (מנהל, ידנית) — היא רק מוסיפה עמודות חסרות ולא מוחקת/משנה נתונים. בקשות תיקון שנוצרו לפני כן יוצגו עם "אין ערך קודם שמור". עד שיורץ — קריאות כתיבה/שחזור על הטבלה ייכשלו ב-`Structure mismatch` (בכוונה, נכשל סגור). לא בוצע ב-Google; מכוסה ב-AT-D08.
