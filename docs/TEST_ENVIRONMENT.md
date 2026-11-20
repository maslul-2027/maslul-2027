# סביבת בדיקות — v1.0.6 (תיאור סביבה; סטטוס/מספרים עדכניים ב-`docs/R5_2_16_STATUS_MATRIX.md`)

> הסעיפים על Playwright/Chromium ש"הותקנו מראש" ועל מגבלות סביבת הפיתוח בהמשך מתארים את סביבות הפיתוח של גרסאות קודמות (היסטוריה). נוהל התקנה נקייה ל-R5.2.16.4.4: `docs/INSTALL_CLEAN_MACHINE.md`; Node בשער Windows: v22.23.4 בדיוק.

**דרישות:** Node 22.x (`.nvmrc`; `engines` ב-`package.json`), Playwright **1.63.0** (נעוץ ב-`devDependencies`), Chromium של Playwright. אין תלות אחרת; האפליקציה עצמה ללא תלויות npm.
**הקמה (דורשת רשת):** `sh scripts/setup_tests.sh` — בודק Node 22, `npm install`, `npx playwright install chromium`, ואז `node tests/env_check.js`.
**בדיקת סביבה:** `node tests/env_check.js` מדפיס גרסת Node, גרסת Playwright, גרסת Chromium ואם ניתן להפעיל אותו (קוד יציאה 0 = אפשר להריץ את כל הסוויטות).
**הרצה:** `npm run test` (Node בלבד; סוויטות דפדפן = SKIP והסיכום אומר "NOT a complete pass") · `npm run test:ui` · `npm run test:strict` (= `--ui --strict`: חסר Playwright או כל SKIP = כישלון).
**מה נרשם:** `tests/last_run.json` — זמן, גרסת Node, דגלים, סטטוס כל סוויטה (PASS/FAIL/SKIP + סיבה), סיכומים.
**למה הדוח הקודם נראה לא עקבי:** ב-v1.0.3 ההרצה עם `--ui` על מחשב בלי Playwright סימנה את שלוש סוויטות הדפדפן כ-SKIP (336 + 3 SKIP) בעוד הדוח דיווח 376 שרצו במחשב שבו Playwright מותקן. מ-v1.0.4 אותה הרצה נכשלת במפורש.
**מגבלות מוצהרות:** (1) אין `package-lock.json` — יצירתו דורשת גישה לרישום npm, שנחסמה כאן; הגרסה נעוצה במדויק ב-`package.json`. (2) בסביבת הפיתוח הזו Playwright ו-Chromium הותקנו מראש מחוץ לפרויקט (`NODE_PATH`), ולכן **לא** בוצעה כאן התקנה מאפס עם `setup_tests.sh`; ההתקנה הזו לא נבדקה בפועל. (3) הבדיקות מדמות Apps Script — הן אינן Apps Script.

## עדכון v1.0.5
**מקור הפער 343 ↔ 393 (דוח v1.0.4):** 343 = בדיקות Node (26 סוויטות); 50 = ארבע סוויטות דפדפן (26+9+5+10) שרצו רק במחשב שבו Playwright זמין. בביקורת שרצה בלי Playwright, ארבע הסוויטות לא הצליחו להתחיל. אין סתירה בספירה — אבל הדוח לא הפריד, ולכן v1.0.5 מדפיס `BREAKDOWN` נפרד (Node unit / integration / hardening, דפדפן) וכל סוויטה מוצגת עם ספירת בדיקותיה. סוויטה שמסיימת עם 0 בדיקות נכשלת.
**אימות ההתקנה לאחר חילוץ ZIP:** בוצע בתיקייה נקייה, `NODE_PATH` מנוקה, עם `node_modules` מקומי; ראו `TEST_REPORT_v1.0.5.md` לתוצאה בפועל. **גבול האימות:** הרשת חסומה, ולכן `npm install` ו-`playwright install` עצמם לא הורצו; `node_modules` נבנה בהעתקת החבילות שהותקנו מראש בסביבה (Playwright 1.63.0) ו-`PLAYWRIGHT_BROWSERS_PATH` הצביע על Chromium המותקן מראש. זו הוכחה שהחבילה המחולצת פותרת את Playwright מ-`node_modules` שלה ושהפקודה `npm run test:strict` עובדת — לא הוכחה שהתקנה מאפס עם רשת מצליחה.
**מוטציות:** `node scripts/mutation_run.js [--ui]` — מחיל 29 שינויים מכוונים בעותק זמני, מריץ את הבדיקות ומדווח CAUGHT/SURVIVED; קוד יציאה 1 אם מוטציה שורדת. התוצאות נשמרות ב-`tests/mutation_results.json`.
**קוד יציאה של `npm run test:strict`:** 0 רק אם כל הסוויטות רצו ועברו; ≠0 על כישלון, על SKIP, על Playwright חסר, ועל סוויטה ללא בדיקות.
