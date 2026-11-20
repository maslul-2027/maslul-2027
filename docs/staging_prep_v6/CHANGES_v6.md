# CHANGES_v6 — חבילת הכנת Staging v6 מול v5 (מסמכים בלבד)

> מבוסס על `course_tracker_STAGING_PREP_docs_v5.zip` (SHA-256 `272fff3ab3bb5ec811d18476843b067826100e6545a82fe337bfe954a5e9124f`). (לא היה v6 קודם; v6 נבנה מ-v5.) **לא שונה קוד; לא התחברנו ל-Google; לא הורץ clasp; לא נפרס.** כל 25 בדיקות Staging = NOT RUN.

## 1. מה שונה: הבסיס עבר מ-`product-dev2-docfix` ל-`product-dev4`
| פריט | v5 | v6 |
|---|---|---|
| ZIP SHA-256 | `1cd034ae…d7e1…` (docfix) | `edcc0aabe51f12643bc060f27191e525ab2af3564b30387a76900d2fdf7b0f75` (`course_tracker_v1.0.6_b7b8_r3_product-dev4.zip`) |
| טביעת אצבע `src/` (41 קבצים) | `413f534a…cbd8` | `32de95b60cd64f7470ebee4ea24413dde6b0117d5f6e4091d9a7ee4d11f98a8f` — שיטה: מתיקיית השורש `sha256sum src/* \| sha256sum` |
| מניפסט | `qa/src_manifest.txt` מחבילת QA v3 (לא בחבילה; D-4/C-7/P15 פתוחים) | `src_manifest_dev4.txt` **כלול בחבילה**; SHA-256 של הקובץ עצמו = טביעת האצבע. נבדק אוטומטית ב-`tests/src_identity.js` |
| `APP.VERSION` | `1.0.6-b7b8-r3-product-dev2` | `1.0.6-b7b8-r3-product-dev4` (G06, G07, מדריך שלב 14) |
| קוד שונה מול docfix | — | רק `src/Import.gs` (כפילויות ייבוא) ו-`src/Config.gs` (גרסה); 39 קבצים זהים |
| גרסת תיקון עתידית | dev3 | **dev5** (dev3/dev4 כבר קיימות) — בעותק חדש בלבד, לפי נוהל התקלות |
| בדיקות/מוטציות | 567 / 70 | מוצר dev4: 583 (Node 455 + דפדפן 128), 87 מוטציות CAUGHT; עם תשתית: 608, 48 סוויטות, + 8 מוטציות Smoke |

## 2. מה לא שונה (במכוון)
C-17/P16/D-9/C-18 נשארים **חסם פתוח** והחלטתך; G01 אינו יכול לקבל PASS בלי התאמת 41 קבצי מקור **וגם** תוכן הפרויקט שהורד (אסור clasp/Apps Script API לפני אישור D-9). כללי G02 (3 מקרים), G14, P6 (רק G18(א)) — ללא שינוי.

## 3. מה לא נבדק מחדש על dev4 (גילוי נאות)
QA נקודות כניסה (158 מסלולים × 7 זהויות), שינוי-DB-אחרי-קריאה-לא-מורשית, שחזור גיבוי ישן, מדידת עלות קריאות — הורצו על dev2 בלבד; הסקריפטים אינם בחבילה זו; השתנה רק `Import.gs`. סימון בטבלת התוצאות.

## 4. קבצים ששונו
`STAGING_SETUP_GUIDE.md`, `STAGING_EXECUTION_PLAN.md`, `STAGING_TEST_EXECUTION_TABLE.md`, `STAGING_READINESS_v3.md`, `STAGING_ISSUE_PROCEDURE.md` (dev3→dev5 בלבד), `CHANGES_v6.md` (חדש), `src_manifest_dev4.txt` (חדש). ללא שינוי: `GOOGLE_WORKSPACE_REQUIREMENTS.md` (אין אזכורי בסיס), `CHANGES_v2–v5`, `CHANGES_QA_v3`.

## 5. חסמים פתוחים — ללא שינוי מ-v5, פרט ל-D-4/C-7/P15 (נסגרו)
C-17/P16/D-9/C-18 · P1/C-4/D-6 · P2–P4 · P6 (רק G18(א)) · P7/C-10/D-5 · C-2/D-1 · C-3/D-2 · C-9/D-3 · C-13/D-7 · D-8.
