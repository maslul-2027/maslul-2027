# דוח בדיקות v1.0.1 — תוצאות אמיתיות

הרצה: `node tests/run_all.js --ui` (Node + Playwright/Chromium מותקן בסביבת הבנייה). **26 סוויטות: 26 PASS, 0 FAIL, 0 SKIP. 362 בדיקות: עברו 362, נכשלו 0.**
ללא `--ui`: 23 PASS, 3 SKIP (סוויטות הדפדפן, "לא התבקשו"), 322 בדיקות; exit=0; הדוח מציג "NOT a complete pass". עם `--strict` — exit=1.

| סוויטה | בדיקות | | סוויטה | בדיקות |
|---|---|---|---|---|
| run | 47 | | v1_import | 3 |
| integration | 29 | | v1_ocr | 3 |
| hardening | 53 | | v1_assistant | 3 |
| soldiers | 52 | | v1_backup | 4 |
| stage3 | 43 | | v1_migration | 3 |
| v1_tracking | 24 | | v1_card | 2 |
| v1_qual | 6 | | **v1_pentest** | **11** (היו 3) |
| v1_private | 6 | | v1_system | 4 |
| v1_alerts | 4 | | **v1_restore_fault** (חדש) | **7** |
| v1_forms | 3 | | **v1_preflight** (חדש) | **4** |
| v1_dashboard | 4 | | ui_smoke (Chromium) | 26 |
| v1_docs | 4 | | ui_v1 (Chromium; כולל כרטיס Preflight) | 9 |
| v1_reports | 3 | | ui_form (Chromium) | 5 |

**Node: 322** (303 הקיימות + 8 חדשות ב-pentest + 7 fault + 4 preflight). **דפדפן: 40.** סה״כ v1.0.0 היה 343; כעת 362 — אין ירידה, אף בדיקה לא הוסרה/הוחלשה (v1_backup עודכנה והוקשחה: סמני שחזור + recover; v1_system: מספר הגרסה בלבד).
נוסף: `verify_export.py` (xlsx: 10 גיליונות, ללא הזרקת נוסחאות) ו-`verify_pdf.js` (PDF תקין) — עברו. התקנה נקייה ומיגרציה מ-v0.4.1 נבדקות ב-`v1_system`/`v1_migration` ועברו.

## הפרדת סביבות
- **Node (הפעלת קוד .gs האמיתי עם fakes):** כל הסוויטות v*/run/integration/hardening/soldiers/stage3.
- **Node + גיליון מדומה (`fakesheets.js`, מריץ את `SheetsStore` האמיתי):** `v1_restore_fault`. האטומיות והתנהגות Sheets הן הנחה.
- **Drive מדומה:** `v1_preflight`. ההרשאות בפועל לא נבדקו.
- **Chromium (Playwright):** ui_*.
- **Apps Script אמיתי: לא הורץ כלל.**

## ראיות עיקריות
- Restore: 7 בדיקות הזרקת תקלות (כתיבה חלקית בכל טבלה, אחרי כתיבה, ניקוי זנב, פורמט, השחתה שקטה, בין טבלאות, כשל זמני/קבוע ב-rollback ← `ROLLBACK_FAILED`, שחזור מקביל, 10 גיבויים פגומים, הרשאות). מוטציה (סימון TOUCHED אחרי כמו במקור) — נתפסת.
- Pentest: סריקה >20,000 קריאות (כל endpoint × 6 משתמשים × כל מזהה אמיתי × 2 קורסים) + 10 תרחישים ממוקדים. מוטציות: הסרת בדיקת בעלות בהורדת מסמך ← 3 כשלים; הסרת בדיקת מחבר בביטול הערה ← 2 כשלים.
- `CMD_OK`: לא הורחבה; כל ערך מנומק; ללא מציאה של endpoint פתוח מעבר לרשימה.

## לא נבדק
Apps Script אמיתי; LockService/Drive/Session.getActiveUser/PDF-Excel/טריגרים אמיתיים; חשבונות Google נפרדים; מובייל אמיתי; Sheets אמיתי תחת קריסה/timeout; אישור אבטחה; ספי כש״ג/החלטות מקצועיות.
