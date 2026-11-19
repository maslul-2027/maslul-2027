> **ARCHIVED / NOT AN EXECUTABLE RUNBOOK (2026-11-17).** This document contains historical instructions and must not be followed to install, migrate, configure permissions, create triggers, or deploy the R5 candidate. The only current preparation path is the read-only `MASLUL_2027_GOOGLE_TEST_TRANSFER_KIT_R10` procedure described in `docs/GOOGLE_TEST_RUNBOOK_D7.md` and `OWNER_ACTIONS.md`. That procedure stops before any remote write. Any later upload, setup, migration, trigger installation, or deployment requires a separate explicit owner approval after reviewing the exact TEST clone, backup, and content diff. Synthetic data only. If this notice conflicts with text below, this notice controls.

# מיגרציה מ-v0.4.1 ל-v1.0.0 (סכמה 1 → 2)

## עקרונות
תוספת בלבד: אין מחיקה, שינוי שם או שינוי סדר של עמודות/טבלאות/שורות. הכול ב-`Migration.run` (מנהל בלבד), אידמפוטנטי, ונבדק מול **קוד v0.4.1 האמיתי** (`tests/fixtures/v041`).

## סדר פעולות באמת (Staging קודם!)
1. **גיבוי ידני של שני הגיליונות** (File → Make a copy) — מעבר לגיבוי האוטומטי.
2. הדבק את קבצי `src/` החדשים (כולל `Card.gs`, `FormPage.html`, ועדכון `appsscript.json` — יבקש הרשאות חדשות).
3. הרץ `setupDatabase()` — מוסיף טבלאות ועמודות חסרות. **אינו מקדם את גרסת הסכמה** בהתקנה קיימת.
4. הרץ `migrateToV1()` פעם אחת. הפעולה: יוצרת גיבוי `pre_migration` (אם הגיבוי נכשל — נעצרת **לפני** כל שינוי); מוסיפה עמודות/טבלאות; זורעת סוגי כש״ג (פתיחה/רגיל, משקלים לפי האפיון) לכל קורס; מסנכרנת שיוכי הסמכות; בודקת שאף טבלה לא איבדה שורות; ורק אז מעדכנת `SchemaMeta=2`.
5. `installDailyTrigger()`; Deploy → New version.
6. מפקדים קיימים: ללא שינוי ביחס ל-v0.4.1 — עדיין דרוש שיוך פעיל כדי לראות חיילים (החלטה פתוחה §6 בשלב 3).

## מה משתנה בנתונים
- טבלה `Favorites` הועברה לגיליון **הפרטי** (בגרסה 0.4.1 לא היה בה שימוש/נתונים). בגיליון הראשי נשארת לשונית ריקה ישנה — אפשר למחוק ידנית.
- עמודות חדשות לטבלאות קיימות (`AuditLog`, `BackupJobs`, `Soldiers` וכו') — ערכים ריקים בשורות ישנות; הקוד מתייחס לריק כ"לא קיים" ולא כאפס.
- סה״כ 51 טבלאות (v0.4.1: 46). בין החדשות: `SoldierUpdateRequests`, `FormTokens`, `ImportJobs`, `ImportRows`, `AssistantDrafts`, `Qualifications*`, `PrivateNotes`, `PersonalFollowUps`, `FollowUpHistory`, `AlertHistory`, `ReadinessReviews`.

## חזרה אחורה
שחזור נקודת זמן מגיבוי `pre_migration` (מסך "גיבויים ותפעול" → שחזור, אישור `RESTORE`; נוצר גיבוי `pre_restore` אוטומטי לפני, ובכשל באמצע — rollback אוטומטי). השחזור אינו נוגע ב-`AuditLog`, `BackupJobs`, `ReportJobs`, `Users`, `SchemaMeta`, ומבטל טוקני טפסים פתוחים.

## מה נבדק / לא נבדק
נבדק ב-Node מול v0.4.1 אמיתי: הוספת עמודות/טבלאות, אי-אובדן שורות, אידמפוטנציה, כשל גיבוי ← עצירה לפני שינוי, סכמה חדשה מהקוד ← סירוב. **לא נבדק:** מיגרציה על גיליונות Google אמיתיים (גבולות גודל, זמני ריצה, מגבלת 6 דקות של Apps Script על נתונים גדולים).
