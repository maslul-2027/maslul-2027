# דוח תשתית בדיקות — product-dev4-testinfra (גרסה 2, אחרי בדיקה עצמאית)

בסיס: **product-dev4** (ZIP `edcc0aabe51f12643bc060f27191e525ab2af3564b30387a76900d2fdf7b0f75`, לא שונה). שינוי רק ב-`tests/`, `scripts/`, `docs/`, `package.json`. **`src/` זהה בייט-לבייט ל-dev4** — מוכח אוטומטית ב-`tests/src_identity.js` מול `tests/src_manifest_dev4.txt` (41 קבצים; טביעת אצבע `sha256sum src/* | sha256sum` = `32de95b60cd64f7470ebee4ea24413dde6b0117d5f6e4091d9a7ee4d11f98a8f`) וגם ב-`diff -r` מול תיקיית dev4. לא Google, לא clasp, לא פריסה. הבדיקות מקומיות (Node + Chromium מול הקוד בזיכרון) — אינן Apps Script ואינן PASS של שער Staging.

## 1. ממצאי הבדיקה העצמאית — מה נעשה בכל אחד
| ממצא | טיפול | סטטוס |
|---|---|---|
| `EACCES` על `/tmp/export_model.json` (קובץ קבוע בבעלות root) | `tests/v1_reports.js` כותב לתיקיית temp **ייחודית להרצה** (`mkdtemp`), או ל-`EXPORT_MODEL_OUT` אם נקבע; `verify_export.py` ו-`verify_pdf.js` מקבלים/יוצרים נתיבי temp ייחודיים — אין עוד נתיב קבוע ב-`/tmp`. **הוכחה:** עם הקובץ הישן בבעלות root עדיין קיים, הרצת Node (ללא UI) כמשתמש `nobody` בעותק משלו: 463/463 עברו, 0 נכשלו (9 סוויטות UI דולגו לפי תכנון — לא הופעל `--ui`). | **תוקן ואומת** |
| כשל נוסף שנחשף בהרצה כמשתמש אחר: `stg_clean_machine_script` תלוי היה ב-Playwright גלובלי של המכונה (באג בשינוי שלי ב-`clean_machine_verify.sh`) | הבדיקה ב-stubs ל-npm/npx בלבד, ללא תלות במכונה; הסקריפט מבטל `NODE_PATH` לפני `npm ci` | **תוקן ואומת (גם כ-nobody)** |
| UI לא הורץ אצל הבודק (Playwright חסר) | נשאר תלוי בהתקנה אצלו. הפקודה: `npm install && npx playwright install chromium && npm run test:ci` | **BLOCKED אצלי להוכחה עצמאית** |
| אין `package-lock.json` | **BLOCKED.** ניסיתי `npm install --package-lock-only` — נכשל: הרשת לרגיסטרי חסומה, וה-cache המקומי ריק (`ENOTCACHED`). לא יצרתי lock ידנית. נוספו: `scripts/generate_lock.sh` (ממיר ל-lock אמיתי ב-npm ברשת פתוחה + בדיקה), `scripts/check_lock.js` / `npm run check-lock` (בודק התאמה ל-`package.json`, גרסת Playwright נעולה, integrity, מקור `registry.npmjs.org`; בלי lock מחזיר `BLOCKED` קוד 3). הבדיקה נוסתה על lock סינתטי בתיקיית temp (OK / חוסר-התאמה נתפס) — ה-lock הסינתטי **לא** נמסר. | **BLOCKED** |
| התקנה נקייה אמיתית לא בוצעה / `clean_machine_verify.sh` לא הורץ על מחשב נקי | הסקריפט חוזק (סעיף 3). הורץ כאן על ה-ZIP הסופי: ראו `clean_machine_verify_output.txt`. | **BLOCKED — לא מוצג כהתקנה נקייה** |

## 2. שינויים שהתבקשו
1. **בידוד קבצי פלט** — ראו שורה ראשונה למעלה.
2. **package-lock.json** — BLOCKED (למעלה).
3. **`clean_machine_verify.sh`**: מסרב לחבילה שמכילה `node_modules`; `npm ci` מה-lock בלבד (נכשל אם ה-lock וה-`package.json` לא מתאימים); בודק גרסאות Node (v22.23.4 בדיוק) ו-npm (10.x), גרסת Playwright מותקנת = 1.63.0, מוריד **Chromium לתיקייה חדשה** (`PLAYWRIGHT_BROWSERS_PATH` בתוך תיקיית העבודה — לא משתמש ב-cache של המכונה); מריץ `npm run test:ci`; עם `--mutations` גם 8 מוטציות Smoke ו-87 מוטציות מלאות. כשל הנובע מרשת בלבד מסומן **`BLOCKED_NETWORK` (יציאה 4)** — לא FAIL ולא PASS. `PASS` מלא רק עם lock שנשלח בחבילה.
4. **בדיקת זהות src**: `tests/src_identity.js` + `tests/src_manifest_dev4.txt` (נרשם ב-`run_all`, `npm run test:src`): קבוצת קבצים מדויקת (ללא חסר/עודף/תתי-תיקיות), SHA-256 לכל קובץ, וטביעת אצבע. הוכח: שינוי שורה אחת ב-`src/Soldiers.gs` → 2 כשלים; שחזור → PASS.
5. **STAGING_PREP**: הבסיס עודכן ל-dev4 ב-`docs/staging_prep_v6/` (**לא היה v6 קודם; נבנה מ-v5**): ZIP SHA, טביעת אצבע, מניפסט כלול בחבילה, `APP.VERSION`, טבלאות בדיקות/מוטציות. פירוט ב-`CHANGES_v6.md` שם. G01/C-17/D-9 נשארו חסומים; QA נקודות כניסה (158×7) סומנו "הורץ על dev2 בלבד".

## 3. תוצאות הרצה סופית (סביבת הבנייה; Node v22.23.4, Playwright 1.63.0, Chromium 153)
| בדיקה | תוצאה |
|---|---|
| `node tests/run_all.js --ui --strict` | **48/48 סוויטות, 608/608 בדיקות (Node 463, דפדפן 145), 0 SKIP, יציאה 0** — ללא דילוג על אף סוויטה |
| הערה על המספר | 603 קודם + 4 `src_identity` + 1 בדיקת BLOCKED_NETWORK = 608; סוויטה אחת נוספה (48) |
| Smoke (`ui_staging_smoke`) | 17/17 (חלק מהריצה למעלה) |
| 8 מוטציות Smoke (`scripts/smoke_mutations.sh`) | 8 CAUGHT, 0 SURVIVED, 0 NOT_APPLIED |
| ביקורת נתוני דמו | 3/3 |
| Node בלבד כמשתמש `nobody` | 463/463, יציאה 0 |
| 87 מוטציות מלאות | לא הורצו שוב (לא שונה קוד מוצר ולא סוויטות קיימות מלבד `v1_reports`/`stg_clean_machine_script` — בידוד פלט/stubs); 87 CAUGHT ב-dev4 נשאר כפי שדווח |

## 4. קבצים ששונו / נוספו (לעומת product-dev4)
נוספו: `tests/ui_staging_smoke.js`, `tests/demo_data_audit.js`, `tests/src_identity.js`, `tests/src_manifest_dev4.txt`, `scripts/smoke_mutations.sh`, `scripts/check_lock.js`, `scripts/generate_lock.sh`, `docs/RUN_TESTS_CI.md`, `docs/TEST_INFRA_REPORT_product-dev4-testinfra.md`, `docs/staging_prep_v6/*` (5 מסמכי תפעול + CHANGES_v2–v6 + CHANGES_QA_v3 + GOOGLE_WORKSPACE_REQUIREMENTS + המניפסט). שונו: `tests/run_all.js`, `tests/v1_reports.js`, `tests/verify_export.py`, `tests/verify_pdf.js`, `tests/stg_clean_machine_script.js`, `package.json`, `scripts/clean_machine_verify.sh`, `docs/INSTALL_CLEAN_MACHINE.md`. **`src/` — ללא שינוי.**

## 5. חסמים פתוחים
1. **`package-lock.json`** — דורש `sh scripts/generate_lock.sh` ברשת פתוחה, סקירה, והוספה לחבילה (v1.0.7).
2. **התקנה נקייה אמיתית** + `clean_machine_verify.sh` על מחשב נקי עם רשת — לא בוצעו; נדרש להחזיר `return/`. עד אז אין טענה "מאומת על מחשב אחר".
3. **UI אצל הבודק** — תלוי בהתקנת Playwright/Chromium אצלו.
4. כל שערי Google — NOT RUN; C-17/D-9/C-18 — החלטתך.
