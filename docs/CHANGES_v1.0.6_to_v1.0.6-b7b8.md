# שינויים: v1.0.6 → v1.0.6-b7b8 (B7 + B8)

## קבצים ששונו
| קובץ | שינוי |
|---|---|
| `src/Fitness.gs` | פונקציה חדשה `completion` (קריאה בלבד) |
| `src/Code.gs` | נתיב `fitness.completion` |
| `src/Index.html` | מסך "חסרים בכש״ג" (`fitgaps`); בדיקת mm:ss מקומית (`mmssError`, `checkTimes`, שדות `fmt:'mmss'`, CSS) |
| `src/Config.gs` | `VERSION: '1.0.6-b7b8'` |
| `tests/v1_pentest.js` | רישום הנתיב החדש כנתיב קריאה (`result.read`) |
| `tests/v1_system.js` | גרסה צפויה |
| `tests/ui_fitness.js` | איתור הודעת השגיאה של שעון לא תקין עודכן לשגיאה שליד השדה (אותן הקביעות) |
| `tests/run_all.js` | רישום הסוויטות החדשות |
| `scripts/mutation_run.js` | 9 מוטציות חדשות (M30–M38) |

## קבצים חדשים
`tests/b7_gaps.js` (Node), `tests/ui_b7b8.js` (דפדפן 390/1280), `docs/B7_B8_DEFINITIONS.md`, מסמך זה, `docs/TEST_REPORT_v1.0.6-b7b8.md`.

## לא שונה
ניקוד/טבלאות/משקלים, `Policy.gs` וההרשאות, מדיניות נתונים, `package.json` (נשאר 1.0.6 כדי שחבילת ה-lock תישאר תקפה), v1.0.6 וה-ZIP שלה, חבילת ההעברה.

## החלטה פתוחה
"תוצאה שנפסלה" — אין הגדרה במערכת. ראו `B7_B8_DEFINITIONS.md`. לא יושם.
