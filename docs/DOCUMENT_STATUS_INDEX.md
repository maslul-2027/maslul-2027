# אינדקס סטטוס מסמכים — R5.2.16.4.4

הבחנה מחייבת בין **מסמך הפעלה עדכני** לבין **מסמך היסטורי / ראיה**. מספרים וסטטוסים: `R5_2_16_STATUS_MATRIX.md`.

## מסמכי הפעלה עדכניים (נבדקו ויושרו ל-R5.2.16.4.4)
| מסמך | תפקיד |
|---|---|
| `README.md` | מבוא, מצב, מבנה, פקודות |
| `OWNER_ACTIONS.md` (עברית) · `docs/OWNER_ACTIONS.md` (אנגלית) | פעולות בעלים — תוכן זהה בשתי השפות |
| `docs/R5_2_16_STATUS_MATRIX.md` | מקור יחיד למספרים וסטטוסים (שם הקובץ נשמר; תוכן R5.2.16.4.4) |
| `docs/PRIVACY_EXCEPTION_REGISTER.md` | מסמך הפעלה — רישום חריגי פרטיות (A/B/C) ונתיבים שנסגרו ב-FINAL |
| `docs/GOOGLE_TEST_SMOKE_AND_ROLLBACK_PLAN.md` | מסמך הפעלה — תוכנית בדיקת עשן ל-Google TEST + נתיב עדכון + rollback (תכנון בלבד, לא הורץ) |
| `docs/INSTALL_CLEAN_MACHINE.md` | נוהל Windows 10 נקי מפורט (preflight → lock → ci → strict) |
| `docs/WINDOWS10_RUNBOOK_D7.md` | צ׳קליסט קצר לאותו נוהל |
| `docs/PACKAGE_LOCK_RUNBOOK_D7.md` | יצירת lock אמיתי |
| `docs/GOOGLE_TEST_RUNBOOK_D7.md` | Google TEST: read-only clone/backup/diff, עצירה לפני כתיבה |
| `docs/INSTALL_ROLLBACK_uxqa1.md` · `INSTALL_ROLLBACK_uxqa1.md` | אין אישור התקנה/rollback (שני עותקים זהים) |
| `docs/RUN_TESTS_CI.md` · `docs/TEST_ENVIRONMENT.md` | פקודות ודרישות בדיקה |
| `docs/GOOGLE_TEST_PENDING.md` | רשימת בדיקות G-01..G-07 (לא ניתנת לביצוע בלי אישור נפרד) |
| `docs/OPEN_BLOCKERS.md`, `docs/PRODUCT_DECISIONS.md`, `docs/PERMISSION_MATRIX_D7.md` | החלטות וחסמים מקצועיים (לא שונו) |

## קובצי סטטוס של גרסאות
- **מחייב:** `R5_2_16_4_4_CANDIDATE_STATUS.md` (שורש ו-`project/`, עותקים זהים) — הגרסה היחידה הנוכחית.
- **היסטוריה בלבד (נשמרו ללא שינוי):** `R5_2_16_3_`, `R5_2_16_4_`, `R5_2_16_4_1_`, `R5_2_16_4_2_`, `R5_2_16_4_3_CANDIDATE_STATUS.md`, `R5_2_16_4_ZIP_EXTRACTION_HARDENING.md` (פירוט ההקשחה ב-R5.2.16.4; הספירה 13/13 שבו היסטורית — הנוכחית 15/15).

## ארכיון — אסור לפעול לפיו
`docs/INSTALL_AND_SETUP.md`, `docs/STAGING_*.md`, `docs/GOOGLE_ACCOUNT_ACTIONS.md`, `docs/MIGRATION_FROM_v0.4.1.md` ועוד מסמכים עם כותרת ARCHIVED — נשמרו ללא שינוי.

## היסטוריה / ראיות של גרסאות קודמות — לא נכתבו מחדש
`docs/TEST_REPORT_*.md`, `docs/CHANGES_*.md`, `QA_REPORT_*.md` (שורש ו-`docs/`), `docs/QA_REPORT_*`, `docs/qa_dev61*/`, `docs/pd6*/`, `docs/pd61/`, `MASLUL_2027_R5_2_6_CANDIDATE_STATUS.md`, `MASLUL_2027_R5_2_7_CANDIDATE_STATUS.md`, `AUDIT_FINDINGS_uxqa1.md`, `docs/PRODUCT_AUDIT_*`, `docs/R5_*`, `docs/EMERGENCY_ORPHAN_RECOVERY_*`, `phase1/` (חומרי עיצוב שלא מומשו — אין Dark Mode במועמד). מספרי הבדיקות בהם אינם תוצאה של R5.2.16.
