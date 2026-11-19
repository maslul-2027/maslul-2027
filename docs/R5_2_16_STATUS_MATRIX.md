# R5.2.16.4.4 — מטריצת סטטוס מחייבת (מקור יחיד למספרים ולסטטוסים)

> כל מסמך הפעלה בחבילה מפנה לכאן. אם מסמך אחר סותר — מטריצה זו קובעת. שם הקובץ נשמר (R5_2_16) ליציבות קישורים; התוכן הוא של **R5.2.16.4.4**. מסמכים היסטוריים (דוחות QA/TEST/CHANGES וקובצי סטטוס של גרסאות קודמות) נשמרים כראיה בלבד ואינם מסמכי הפעלה.
> תאריך: 2026-11-19 · מועמד: **R5.2.16.4.4** — הקשחת פירוק ZIP (`scripts/lib/zipnode.js`, `tests/stg_clean_machine_script.js`) + יישור תיעוד. אין שינוי ב-`src/`, ניקוד, הרשאות, סכמה, אינטגרציית Google או לוגיקת ה-Preflight.

## א. תוצאות — לפי מקור הראיה

| רכיב | תוצאה | מקור | הערה |
|---|---|---|---|
| שלמות ה-ZIP המסופק | PASS | QA עצמאי + סבב יישור זה | ה-SHA-256 והגודל של ה-ZIP הסופי מופיעים **רק** בהודעת המסירה החיצונית (self-reference — אינם נכתבים בתוך החבילה). |
| בדיקת clean-machine (`stg_clean_machine_script`) | **PASS 15/15** | QA עצמאי; סבב יישור זה | שניהם |
| שער R5 ממוקד (`test:r5-focused`) | **PASS 124/124** (12 suites) | QA עצמאי; סבב יישור זה | ממוקד בלבד; `full_regression: NOT_ESTABLISHED` by design |
| Node רחב (ללא דפדפן) | **PASS 654/654** | סבב REV3 (654 בתוך ריצת strict; 59 suites) | |
| Source identity | **PASS 4/4** | QA עצמאי; סבב יישור זה | `src/` שונה במכוון ב-REV3 וב-FINAL (דיכוי תת-קבוצות); ה-ledger וה-manifests עודכנו |
| Apps Script syntax / Inline JavaScript | PASS 41/41 / 3/3 | סבב יישור זה | |
| **Strict Chromium run** (`--ui --strict`) | **PASS — 59/59 suites, 880/880 בדיקות** (Node 654 + דפדפן 226) — הורץ מחדש אחרי תיקון REV3; הריצה הישנה (57/853) אינה מאמתת אותו, 0 FAIL, 0 SKIP | **סבב יישור זה, 2026-11-19: Linux, Node v22.23.4 (מדויק), npm 10.9.9, Playwright 1.63.0, Chromium 153.0.8010.12** | **לא** התקנה נקייה: `node_modules` קיים מראש, אין lock. **לא** שוחזר בסביבת ה-QA העצמאית (Node 22.16.0, ללא Playwright/Chromium) |
| UX/a11y (`ui_uxqa`) | PASS 43/43 | בתוך ריצת ה-strict שלעיל | |
| package-lock.json | **BLOCKED_NETWORK** — חסר בכוונה; אסור לייצר ידנית; `npm ci` לא הורץ | `node scripts/check_lock.js` → exit 3 | |
| Windows 10 נקי | **NOT_RUN** | — | |
| PowerShell preflight | **NOT_RUN** | — | |
| NVDA / VoiceOver / TalkBack / JAWS, axe-core | **NOT_RUN** | — | |
| מכשירים פיזיים, Safari / Firefox / Edge | **NOT_RUN** | — | |
| Google TEST (G-01..G-07); Apps Script/Sheets/Drive/LockService אמיתיים | **NOT_RUN / NOT_VERIFIED** | — | |
| Production readiness | **NOT APPROVED** | — | |

## ב. כללי ניסוח (מחייבים)
1. סביבת ה-QA העצמאית הייתה Node 22.16.0 / npm 10.9.2 — **אינה** מקיימת את שער Node המדויק (v22.23.4). אין להציג את תוצאותיה כמקיימות אותו. ריצת ה-strict המלאה בוצעה בסבב יישור זה תחת Node v22.23.4 מדויק, ולכן היא מדווחת כך — ולא כ"אומתה עצמאית".
2. אסור לספור suites שדולגו כ-PASS. ריצה בלי `--ui` או בלי Playwright היא **אינה** רגרסיה מלאה.
3. ה-strict PASS לעיל הוא ראיה מסביבת Linux. הוא **אינו** מחליף ריצת Windows 10 נקייה עם lock אמיתי; עד אז הרגרסיה המלאה נחשבת **INCOMPLETE לצורכי שחרור**.
4. מספרי בדיקות בהרצת Windows דינמיים: דווחו את מה שנצפה. 59 / 880 הם ערכי ייחוס. הסף ל-PASS: כל ה-suites רצו, אפס FAIL, אפס SKIP.
5. מספרים ישנים (850/850 של R5.2.16, 13/13 ו-14/14 של 4.x הקודמים, 52/52, 804/56, 832, "Playwright חסר", R5.2.9) הם היסטוריה בלבד.

## ג. גרסאות ושלשלת
- 
- R5.2.10 — ביקורת בלבד; R5.2.11–R5.2.14 — תיעוד/תשתית QA.
- שינויי `src/` ב-R5.2.16: `Index.html` ו-`FormPage.html` בלבד; קבצי `.gs` ללא שינוי מול R5.2.15. מאז R5.2.16.1 `src/` זהה בייט-לבייט (הוכחה: `reconciliation/R5_2_16_4_4_RECONCILIATION_REPORT.md`).

## ד. סביבה
- שער Windows: Node **v22.23.4 בדיוק**, npm **10.x**. `engines`: `>=22 <23` (פיתוח); `.nvmrc`: `22.23.4`; Playwright **1.63.0** (מקובע ב-`package.json`).
- `scripts/windows_preflight.ps1` — SHA-256 של הסקריפט: `aa3e4352d2f6e6015a36770f9f432eef384ef26bcfd0b42ba48e587f72dc653c`. הערת ה-Usage בראש הסקריפט מציינת את שם הקובץ של המועמד הנוכחי (`MASLUL_2027_R5_2_16_4_4_FINAL_TEST_CANDIDATE.zip`); העותק העצמאי והעותק שבתוך החבילה זהים בייט-לבייט.
- ה-SHA-256 של ה-ZIP הסופי מופיע **רק** בהודעת המסירה החיצונית ולא בתוך ה-ZIP (self-reference).
- היעדר `package-lock.json` מכוון ומתועד (BLOCKED_NETWORK; `scripts/check_lock.js` מחזיר exit 3 ויוצר חסימה מפורשת).
