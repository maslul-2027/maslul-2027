# שינויים v1.0.5 → v1.0.6

בסיס: v1.0.5 (ZIP המקורי לא שונה). `ct/` (v1.0.2), `ct_v1.0.3/`, `ct_v1.0.4/`, `ct_v1.0.5/` זהים לגרסאות שנמסרו (אומת ב-`diff -r`; ראו `TEST_REPORT_v1.0.6.md`).

## החלטות מחייבות שמומשו
| החלטה | מימוש |
|---|---|
| בנים — מתח: רק "אפוד אישי · 7 ק״ג", בכל סוגי המבחנים | `Fitness.componentScore_`: לבנים+מתח הווריאנט קבוע (`Fitness.VEST_VARIANT`), בלי תלות בהגדרת סוג מבחן |
| "ללא משקל חיצוני" אינו מסלול ניקוד לבנים | `typeSetVariant` דוחה; `addTable` דוחה טבלת מתח לבנים שאינה אפוד; `versionIssues_` חוסם אישור; `importDraft` מדלג על טבלה מסומנת `excluded`; הגדרות ישנות ב-`variants_json` מתעלמות |
| טבלת האפוד מסתיימת ב-15; מעבר = בדיקה | `out_of_range`, בלי חיתוך ובלי מעבר לטבלה אחרת |
| בנות — חזרה אחת = 40 (החלטה מקצועית מאושרת; לא ערך מהמקור) | שורה `[40,1,1]` במקום `[45,1,1]`; סימון `PROF_DECISION_N1` בשורה, `meta.professional_decision` בטיוטה ובתמלול |
| בנות — אפס חזרות | `out_of_range`: אין ציון אוטומטי, נדרשת בדיקה |
| N5 / N7 | מחוץ לטווח = בלי ציון אוטומטי; התמונות הן הסמכות (הנוסחה הישנה לא בשימוש) |
| אין fallback שקט; הפרדה בין חסר / אפס / מחוץ לטווח | הוסר `variant_unset`; בלי טבלה מתאימה → `no_table`; `not_entered` / `out_of_range` נפרדים (בדיקה 6) |

## קבצים ששונו / נוספו (ct_v1.0.6 מול ct_v1.0.5)
- `CHANGELOG.md`
- `README.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS_NEEDED.md`
- `docs/FITNESS_SCORING_TRANSCRIPTION_v1.0.3.md`
- `docs/INSTALL_AND_SETUP.md`
- `docs/OPEN_BLOCKERS.md`
- `docs/REMAINING_GAPS.md`
- `docs/STAGING_GUIDE.md`
- `docs/TEST_ENVIRONMENT.md`
- `package.json`
- `scoring/fitness_scoring_v103.csv`
- `scoring/fitness_scoring_v103.json`
- `scoring/transcribe_v103.py`
- `scripts/mutation_run.js`
- `src/Config.gs`
- `src/Fitness.gs`
- `src/FitnessDraft.gs`
- `src/Index.html`
- `tests/fixtures/fitness_scoring_v105_frozen.json` (חדש)
- `tests/run_all.js`
- `tests/ui_fitness.js`
- `tests/v103_fitness.js`
- `tests/v104_audit.js`
- `tests/v105_fitness_governance.js`
- `tests/v106_pullups.js` (חדש)
- `tests/v1_system.js`
- `tests/v1_tracking.js`
- `tests/mutation_results.json` (פלט הרצה — נכתב מחדש)

קבצי הקוד היחידים שהשתנו: `src/Fitness.gs`, `src/FitnessDraft.gs` (נוצר מ-`scoring/transcribe_v103.py`), `src/Index.html`, `src/Config.gs` (מספר גרסה). אין שינוי ב-`Code.gs` (נקודת הקצה `fitness.typeVariant` נשארה, אך דוחה כל ערך שאינו אפוד/ריק ואין לה השפעה על הניקוד).

## מה לא שונה
שאר טבלאות הניקוד (3 ק״מ, 300 מ׳, Trap Bar, מקבילים, מתח בנות מלבד חזרה אחת) — מוקפאות מול v1.0.5 בבדיקה (`tests/fixtures/fitness_scoring_v105_frozen.json`; ההבדל היחיד בערכים: `pullups_F_band` שורה 12 `[45,1,1]→[40,1,1]`, ושולי הטבלה היסטורית שהוצאה מהייבוא). משקלים, הרשאות, מדיניות נתונים, תוצאות שמורות — ללא שינוי.
## השפעה על ציונים
ציונים שמורים אינם משתנים (בדיקה 10). תוצאות חדשות של בנים: אפוד 7 ק״ג (למשל 15 מתח = 100; כדוגמה המקרה 09/11/2026: 90.8 במקום 86.8 ב-v1.0.5 עם "ללא משקל"). חישוב מחדש גורף לא בוצע ולא ימומש בלי אישורך.
