# שינויים: v1.0.6-b7b8 → v1.0.6-b7b8-r2 (תיקון ממצא ביקורת B7)
**ממצא:** `stateOf` החזירה `na` לכל רכיב שחסר ב-`component_scores_json`, גם אם סוג המבחן דורש אותו → חייל יכול היה להיראות "הושלם" עם נתון חסר.
**תיקון (`src/Fitness.gs`, `Fitness.completion` בלבד):** רכיבים נדרשים לפי `FitnessTestTypes.weights_json` (גיבוי: `components_json`); `na` רק לרכיב שהסוג אינו דורש; נדרש וחסר → `missing`; סוג לא קיים / JSON פגום / בלי רכיבים נדרשים / `ok` בלי ציון → `blocked`; `complete` רק כשכל הנדרשים `complete`. ההבחנה missing/review/blocked נשמרה.
**לא שונה:** לוגיקת שרת של שמירה/ולידציה, ניקוד, טבלאות, הרשאות, ממשק (B8), `package.json`.
**בדיקות:** `b7_gaps` 9→20; `ui_b7b8` 25→26 (מיקוד); מוטציות M39–M43; סה״כ 491 בדיקות. `Config.VERSION` ו-`v1_system` → `1.0.6-b7b8-r2`.
