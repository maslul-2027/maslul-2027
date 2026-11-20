# הרצת הבדיקות המקומיות — הוראות מדויקות (CI / מחשב נקי)

> סטטוס ומספרים עדכניים: `docs/R5_2_16_STATUS_MATRIX.md`. מסמך זה מתאר פקודות ודרישות בלבד; מספרי בדיקות ישנים שמופיעים בו (אם יש) הם היסטוריים. נוהל Windows נקי: `docs/INSTALL_CLEAN_MACHINE.md`.

מה זה: בדיקות מקומיות של קוד השרת (Node, זיכרון בלבד) ושל ה-UI (Chromium אמיתי + `src/Index.html` / `FormPage.html`), עם נתוני **דמו בלבד**.
מה זה **לא**: Apps Script, HtmlService, כניסת Google, Sheets/Drive, פריסה. שום בדיקה כאן לא מתחברת ל-Google, לא משתמשת ב-clasp ולא מפרסת. PASS מקומי ≠ PASS של שער Staging כלשהו.

## דרישות
| רכיב | גרסה | הערה |
|---|---|---|
| Node.js | **v22.x לפיתוח** (`engines: >=22 <23`); **v22.23.4 בדיוק בשער Windows / clean-machine** (`.nvmrc` נעוץ ל-22.23.4) | |
| npm | 10.x | |
| Playwright | **1.63.0** (נעול ב-`package.json`) | |
| Chromium | מגיע עם Playwright 1.63.0 (נבדק 153) | נדרשות ספריות מערכת (ראו Linux) |
| רשת | registry.npmjs.org + CDN של Playwright — **רק בהתקנה** | ההרצה עצמה לא צריכה רשת חיצונית |

## התקנה (פעם אחת, ברשת פתוחה)
```
unzip <חבילה>.zip && cd <תיקיית הפרויקט>
node -v                      # חייב להיות v22.x
npm install --no-audit --no-fund
npx playwright install chromium            # Linux נקי: npx playwright install --with-deps chromium  (דורש root/sudo)
npm run check-env            # ENV: OK (all suites can run)
```
חלופה: `sh scripts/setup_tests.sh` (אותם צעדים + אימות).
CI בשרת מוגבל-רשת: מקבעים `PLAYWRIGHT_BROWSERS_PATH=<נתיב>` ל-cache של דפדפנים שהותקן מראש; `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` מדלג על הורדה.

## פקודות הרצה
| מטרה | פקודה | משך (בסביבת הבנייה) |
|---|---|---|
| בדיקת סביבה בלבד | `npm run check-env` | שניות |
| **Smoke Staging בלבד** (טעינה, זהות, ADMIN/מפקד, ניווט, טפסים) | `npm run test:smoke` | ~20 שניות |
| ביקורת נתוני-דמו / אי-חיבור ל-Google | `npm run test:demo-audit` | <1 שנייה |
| Node בלבד (ללא דפדפן) | `npm test` | ~40 שניות |
| הכול כולל דפדפן | `npm run test:ui` | ~1.5 דקות |
| **מלא ומחמיר (מומלץ ל-CI)**: כל suite חייב לרוץ, SKIP = כשל | `npm run test:ci` (= check-env + `node tests/run_all.js --ui --strict`) | ~1.5 דקות |
| הוכחה שה-Smoke תופס רגרסיות (8 מוטציות בעותק זמני) | `bash scripts/smoke_mutations.sh` | ~2 דקות |
| מוטציות מלאות (87) | `node scripts/mutation_run.js --ui` | ארוך (עשרות דקות) |

קוד יציאה: `0` = הכול רץ ועבר; `≠0` = כשל (או, עם `--strict`, suite שדולג). בלי `--ui` suites של הדפדפן מסומנים SKIP והסיכום **לא** אומר "הכול עבר".
תוצאה נשמרת ב-`tests/last_run.json`.

## תוצאה צפויה (product-dev4 + תשתית זו)
`SUITES: 48 total — 48 PASS, 0 FAIL, 0 SKIP` · `TESTS RUN: 608 — passed 608` (Node 463 + דפדפן 145) · `RESULT: ALL SUITES RAN AND PASSED`.
Smoke לבד: `UI STAGING SMOKE TOTAL pass=17 fail=0`.

## מה ה-Smoke בודק (`tests/ui_staging_smoke.js`)
1. **טעינה**: ADMIN פותח את האפליקציה — שם, תפקיד וגרסה בכותרת, כפתורי אזורים, קורס, בלי שגיאות דף.
2. **זהות ("התחברות")**: זר, משתמש לא-פעיל, וזהות ריקה — אין שם/תפקיד, אין נתונים בדף, השרת מסרב לכל קריאה. (הזהות מוזרקת כמשתנה; אין התחברות Google.)
3. **הרשאות**: למפקד תת-קבוצה ממשית של מסכי ADMIN; רואה רק את הצוות שלו; קריאות ניהול ישירות מוחזרות `FORBIDDEN` ולא משנות כלום; אין שדות admin-only בתשובות; חייל של צוות אחר נחסם.
4. **ניווט**: כל מסך, ל-ADMIN ולמפקד, בשולחן 1280 ובטלפון 390 — בלי `undefined` / `[object Object]` / `NaN`, בלי גלילה אופקית, בלי שגיאות דף.
5. **טפסים**: טופס חייל ריק נחסם בהודעה; תקין נשמר ונפתח כרטיס; למפקד אין הוספה/עריכה; דף הטופס החד-פעמי (טוקן שגוי, שדות מורשים בלבד, שליחה = בקשה ממתינה, טוקן חד-פעמי).

## נתוני דמו
כל הנתונים נוצרים בזיכרון בתוך הבדיקה (מיילים `@x.com`, שמות "חייל דמה", מספרים 9001…). `tests/demo_data_audit.js` סורק את כל קבצי הבדיקה והסקריפטים ונכשל על מייל לא-סינתטי, כתובת לא-מקומית, מזהה/כתובת Google, מודול רשת/לקוח Google, או הזכרת `clasp` בקוד. חריגים מוכרים (קלטים סינתטיים לבדיקות ולידציה/תקיפה) ברשימה מפורשת עם נימוק בראש הקובץ.

## פתרון תקלות
| סימפטום | פעולה |
|---|---|
| `playwright is not installed` | `npm install` |
| `chromium ... MISSING / not launchable` | `npx playwright install chromium` (Linux: `--with-deps`); בדקו `PLAYWRIGHT_BROWSERS_PATH` |
| `Need Node 22.x` | `nvm use` (קובץ `.nvmrc`) |
| כשל `libnss3` / `libatk` וכד' ב-Linux | `npx playwright install-deps chromium` (root) |
| `RESULT: FAILED (strict: skipped suites)` | suite דולג — תקנו סביבה; אל תציגו כ-PASS |
