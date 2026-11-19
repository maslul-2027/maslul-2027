# דוח בדיקות product-dev6.1 (ראיות בלבד)
| בדיקה | פקודה | תוצאה |
|---|---|---|
| כל הסוויטות (Node + Chromium, strict) | `node tests/run_all.js --ui --strict` | **PASS** 52/52 סוויטות, 695 בדיקות (Node 530, דפדפן 165), 0 נכשלו/דולגו — `test_run_full_strict.txt` |
| PD6 (שרת) | `node tests/pd6_meetings_tasks.js` | **PASS** 26 |
| QA-01/QA-02 ייעודי | `node tests/pd61_qa_fixes.js` | **PASS** 16 (6 הרשאות מחלקה/IDOR, 10 עקביות audit/save/orphans/היסטוריה) |
| UI Chromium | `node tests/ui_pd6_meetings.js` | **PASS** 20 (דסקטופ 1280 + מובייל 390; כולל אזהרת Audit ופאנל שלמות; צילומים `docs/pd6/screens/`) |
| זהות מקור | `node tests/src_identity.js` | **PASS** 4 (fingerprint dev6.1) |
| בקרה שלילית | `pd61_qa_fixes.js` מול src של dev6 | **14 מתוך 16 נכשלות** — הבדיקות אכן תופסות את הליקויים (`negative_control_pd61_on_dev6_src.txt`) |
כיסוי מבוקש: הרשאות שליליות כולל IDOR/הסלמה (pd6 + pd61 #6 + v1_pentest) · עקביות שמירה/rollback/idempotency (pd6 + pd61 A–H) · היסטוריה שלמה אחרי עריכה (pd6 + pd61 האחרונה) · אין יצירת משימה עצמאית (pd6 #1 + pd61 I) · XSS בתצוגת משימות (ui_pd6: HTML בכותרת מוצג כטקסט, ללא הרצה).
**NOT RUN / BLOCKED:** Google/Apps Script/clasp/Deploy (אסור/אין גישה) · נתוני אמת · התקנה נקייה ו-package-lock (אין רשת) · mutation (קיים רק על dev4) · דפדפן נייד פיזי · התנהגות `LockService`/מכסות Apps Script אמיתיים (הבדיקות על מעטפת Node). שערי האישור הקיימים (G01–G25 וכו') נשארים בתוקף ולא הורצו.
