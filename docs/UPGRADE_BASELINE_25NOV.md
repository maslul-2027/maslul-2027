# מצב קיים ובסיס רגרסיה — לפני שיפורים הדרגתיים (25.11.2026)

**נקודת חזרה:** ענף `cloudflare/free-shared-test`, commit `ff7044d9` (פרוס ב-TEST; CI 8/8; deploy run 45618833428). כל שיפור הוא commit קטן נפרד על הענן הזה; חזרה = `git revert` של ה-commit (ללא נגיעה בהתחברות, בסודות ובנתונים).

## מה כבר עובד (נבדק, לא נשכתב) — מקור: `tests/run_all.js --ui --strict` = 79/79 סוויטות, 1262 בדיקות
| תחום | כיסוי קיים (סוויטות ← מספר בדיקות) |
|---|---|
| חניכים / כרטיס | soldiers 52, v1_card 2, ui_synthetic_app 171 (דפדפן) |
| נוכחות | v1_tracking 24, ui_pd1 21, ui_synthetic_app |
| מסעות (חסרים, עריכת משתתפים לאחר שמירה, רענון) | marches_scope 7, marches_server 7, B7 (cf_worker S8/S9), ui_b7b8 26 |
| משימות וישיבות | pd6_meetings_tasks 26, pd61_qa_fixes 16, ui_pd6_meetings 20, ui_pd6_qa 18 |
| כושר (כש״ג רגיל, ניקוד, שלמות) | v103_fitness 11, v105_fitness_governance 8, v106_pullups 11, pd5_f1_fitness_snapshot 25, ui_fitness 20 |
| מבחנים / קליעה / ניווט / כשירות | stage3 43, v1_forms 28, r3_forms_reports 7, v1_qual 6 |
| הרשאות / פרטיות / MIN_GROUP | d7_authz 9, auth_gateway 14, r5_privacy_subcohort 14, v1_pentest 11, hardening 53 |
| ייבוא / ייצוא / דוחות / גיבוי / שחזור | v1_import* 19, report_export 16, v1_reports 3, backup_restore 24, full_backup 15, v1_restore_fault 7 |
| מעברים, גלילה, תנועה מופחתת, UX | ui_uxqa 43, ui_ux_sprint1 8, uxqa_server 29 |
| Cloudflare TEST (Worker+D1) | `tests/cf_worker.js` 28 תרחישים (S1–S26), דפדפן E2E 10, מסך כניסה 9, `cf_static` 12 |

## חסום / לא אומת (לא מדווח כהצלחה)
- **ענן אמיתי:** כניסה/הרשאות/שמירה מול `workers.dev` — NOT_RUN עד שהבעלים משחזר גישה (אין לי גישת רשת לאתר).
- PDF/XLSX/OCR/גיבוי-בענן ב-Cloudflare Free: `NOT_CONNECTED` (HTTP 501), לא "הצלחה".
- תובנות כושר (מגמות/השוואת בוחנים/פערים/תמונה קבוצתית MIN_GROUP=5): NOT_STARTED. מקורות כושר: רשומים כ-PROVENANCE PENDING (ראו `FITNESS_SOURCES.md`); שום ניקוד לא שונה.
- מעברים: קיימים (לחיצה 150ms, דיאלוג 200ms, כניסה למסך עמוק 160ms, שחזור גלילה, `prefers-reduced-motion`) — **שיפור מדיד נוסף טרם הוגדר**; לפני כל שינוי תוגדר בדיקת דפדפן לפני/אחרי.

## כלל עבודה
שינוי קטן → בדיקת רגרסיה מלאה (`node tests/run_all.js --ui --strict`) + דפדפן CF → commit נפרד → CI → רק אז בקשת פריסה. אין שינוי בהתחברות/סודות/ארכיטקטורה/ארבע הלשוניות.
