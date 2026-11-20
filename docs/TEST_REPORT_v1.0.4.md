# דוח בדיקות v1.0.4 — תוצאות ריצה בפועל

**ריצה:** `node tests/run_all.js --ui --strict` בחבילה **מחולצת מתיקייה נקייה** (לא בתיקיית העבודה), 2026-11-10T06:12:37.020Z, Node v22.23.4, Playwright 1.63.0, Chromium 153.0.8010.12.
**תוצאה:** 30 סוויטות — **30 PASS, 0 FAIL, 0 SKIP**. 393 בדיקות: עברו 393, נכשלו 0, דולגו 0 (Node 343 + דפדפן 50). סטטוס כללי: COMPLETE_PASS.
(הדוח עצמו נוסף לחבילה אחרי הריצה; אין שינוי נוסף בקוד או בבדיקות.)

## הרצות נלוות (בפועל)
| הרצה | תוצאה |
|---|---|
| `--ui --strict` בלי Playwright (NODE_PATH ריק) | קוד יציאה 1 — 3 סוויטות דפדפן + ui_fitness נכשלות עם הסיבה ("UI was requested… playwright not available") |
| בלי `--ui`, בלי `--strict` | קוד יציאה 0, אבל הסיכום: "NO FAILURES, BUT n SUITE(S) WERE SKIPPED — this is NOT a complete pass" |
| בלי `--ui`, עם `--strict` | קוד יציאה 1 |
| `--ui --strict` מלא (הטבלה למטה) | קוד יציאה 0 |

## לפי סוויטה
| סוויטה | סוג | מצב | עברו | נכשלו |
|---|---|---|---|---|
| run | Node | PASS | 45 | 0 |
| integration | Node | PASS | 29 | 0 |
| hardening | Node | PASS | 53 | 0 |
| soldiers | Node | PASS | 52 | 0 |
| stage3 | Node | PASS | 43 | 0 |
| v1_tracking | Node | PASS | 24 | 0 |
| v1_qual | Node | PASS | 6 | 0 |
| v1_private | Node | PASS | 6 | 0 |
| v1_alerts | Node | PASS | 4 | 0 |
| v1_forms | Node | PASS | 3 | 0 |
| v1_dashboard | Node | PASS | 4 | 0 |
| v1_docs | Node | PASS | 4 | 0 |
| v1_reports | Node | PASS | 3 | 0 |
| v1_import | Node | PASS | 3 | 0 |
| v1_ocr | Node | PASS | 3 | 0 |
| v1_assistant | Node | PASS | 3 | 0 |
| v1_backup | Node | PASS | 4 | 0 |
| v1_migration | Node | PASS | 3 | 0 |
| v1_card | Node | PASS | 2 | 0 |
| v1_pentest | Node | PASS | 11 | 0 |
| v1_system | Node | PASS | 4 | 0 |
| v1_restore_fault | Node | PASS | 7 | 0 |
| v1_replaceall_text | Node | PASS | 5 | 0 |
| v1_preflight | Node | PASS | 4 | 0 |
| v103_fitness | Node | PASS | 11 | 0 |
| v104_audit | Node | PASS | 7 | 0 |
| ui_smoke | דפדפן | PASS | 26 | 0 |
| ui_v1 | דפדפן | PASS | 9 | 0 |
| ui_form | דפדפן | PASS | 5 | 0 |
| ui_fitness | דפדפן | PASS | 10 | 0 |

## מה נוסף ב-v1.0.4
- `v104_audit` (7): חסר≠0 (שמירה, דשבורד, סיכום, טרנדים, דוח), משקלים רגיל/פתיחה, הרשאות מפקד ובידוד קורסים, DRAFT לא בשימוש ואישור דורש דגל+נימוק, דוח איכות נתונים (קריאה בלבד).
- `ui_fitness` (10): תהליך הפעלה מלא בדפדפן — מקרה 09/11/2026 לפני הפעלה (ממתין + סיבה בעברית), ייבוא = DRAFT בלבד, אישור בלי סימון נדחה, אישור עם סימון, סיבת "לא הוגדר סוג ביצוע מתח", הגדרת סוג ביצוע ← ציון 86.8, דסקטופ 1280 וניד 390 (`isMobile`, כפתורים ≥40px, ללא גלישה אופקית), מפקד ללא פקדי מנהל.
- **בדיקות מוטציה (בפועל):** שמירת חסר כ-0 ב-`Fitness.gs` → נתפס ב-4 בדיקות (A, B, C, G); הסרת בדיקת דגל האימות בממשק → נתפס ב-`ui_fitness`. מוטציה ב-`Snapshot.mean_` (ריק→0) **לא** נתפסה — השכבה הזו מוגנת גם במקום אחר (הערך מגיע כבר ריק), כלומר הבדיקה אינה מוכיחה את השכבה הזו בנפרד.

## מה לא נבדק
Apps Script / Sheets / Drive / LockService / טריגרים / חשבונות Google אמיתיים; פריסה; ביצועים אמיתיים; התקנת Playwright מאפס עם `setup_tests.sh` (הרשת חסומה בסביבה זו; ראו `TEST_ENVIRONMENT.md`); הנתונים החיים של המקרה מ-09/11/2026; קריאת התמונות בוצעה ויזואלית (N1–N8 ממתינים לאישורך).
