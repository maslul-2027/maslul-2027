# דוח בדיקות v1.0.5 (נוצר מתוצאות ההרצה בפועל)

הרצה: `npm run test:strict` מתוך חילוץ נקי של ה-ZIP, Node v22.23.4, 2026-11-10T07:08:38.826Z.
**קוד יציאה: 0.** 32 סוויטות: 32 PASS, 0 FAIL, 0 SKIP.
**434 בדיקות עברו, 0 נכשלו.**

## ספירה נפרדת
| סוג | בדיקות |
|---|---|
| Node – יחידה | 78 |
| Node – אינטגרציה | 161 |
| Node – הקשחה/אבטחה | 135 |
| **Node סה״כ** | **374** |
| דפדפן (Playwright/Chromium, 390px ו-1280px) | 60 |
| **סה״כ** | **434** |

הפער 343 מול 393: 343 = בדיקות Node ב-v1.0.4; 50 = בדיקות דפדפן שלא רצו בסביבת הביקורת (אין Playwright). ב-v1.0.5 נוספו 31 בדיקות Node (23+8) ו-10 בדיקות דפדפן: 374 + 60 = 434.

## טבלת סוויטות
| סוויטה | עברו | נכשלו |
|---|---|---|
| run | 45 | 0 |
| integration | 29 | 0 |
| hardening | 53 | 0 |
| soldiers | 52 | 0 |
| stage3 | 43 | 0 |
| v1_tracking | 24 | 0 |
| v1_qual | 6 | 0 |
| v1_private | 6 | 0 |
| v1_alerts | 4 | 0 |
| v1_forms | 3 | 0 |
| v1_dashboard | 4 | 0 |
| v1_docs | 4 | 0 |
| v1_reports | 3 | 0 |
| v1_import | 3 | 0 |
| v1_ocr | 3 | 0 |
| v1_assistant | 3 | 0 |
| v1_backup | 4 | 0 |
| v1_migration | 3 | 0 |
| v1_card | 2 | 0 |
| v1_pentest | 11 | 0 |
| v1_system | 4 | 0 |
| v1_restore_fault | 7 | 0 |
| v1_replaceall_text | 5 | 0 |
| v1_preflight | 4 | 0 |
| v103_fitness | 11 | 0 |
| v104_audit | 7 | 0 |
| v105_missing | 23 | 0 |
| v105_fitness_governance | 8 | 0 |
| ui_smoke | 26 | 0 |
| ui_v1 | 9 | 0 |
| ui_form | 5 | 0 |
| ui_fitness | 20 | 0 |

## Mutation Testing (24 מוטציות)
נתפסו 24, שרדו 0, לא הוחלו 0, לא רצו 0.

| מוטציה | תוצאה | נתפסה ע״י |
|---|---|---|
| M01 validNumber accepts empty string as 0 | CAUGHT | v1_tracking, v104_audit, v105_missing, v105_fitness_governance |
| M02 validNumber accepts booleans | CAUGHT | v105_missing |
| M03 Snapshot.mean_ turns missing into 0 | CAUGHT | v1_tracking, v105_missing |
| M04 Calc.mean counts non-numbers as 0 | CAUGHT | run, v1_tracking, v105_missing |
| M05 per-soldier mean (groups) keeps unscored rows (both layers removed: Snapshot.mean_ also filters, so this needs a double mutation) | CAUGHT | v105_missing |
| M06 trends series keeps unscored rows | CAUGHT | v104_audit, v105_missing |
| M07 strengths/gaps keeps unscored rows | CAUGHT | v105_missing |
| M08 completeness counts unscored as scored | CAUGHT | v105_missing |
| M09 health index ignores missing domains | CAUGHT | v1_dashboard, v105_missing |
| M10 alerts keep unscored rows | CAUGHT | v105_missing |
| M11 fitness aggregate counts unscored as complete | CAUGHT | v104_audit, v105_missing |
| M12 marksmanship aggregate counts unscored | CAUGHT | v1_tracking, v105_missing |
| M13 navigation aggregate: blank final score -> 0 | CAUGHT | v105_missing |
| M14 report prints 0 for a missing score | CAUGHT | v105_missing |
| M15 fitness result stored with 0 when incomplete | CAUGHT | v1_tracking, v1_migration, v103_fitness, v104_audit, v105_fitness_governance |
| M16 missing component becomes 0 in the weighted total | CAUGHT | run, hardening, v1_tracking, v1_migration, v103_fitness, v104_audit |
| M17 not-entered component scored 0 | CAUGHT | v1_tracking, v103_fitness, v104_audit |
| M18 regular-test weights altered | CAUGHT | v1_tracking, v103_fitness, v104_audit, v105_fitness_governance |
| M19 DRAFT versions used for scoring | CAUGHT | v1_tracking, v105_fitness_governance |
| M20 approve without the verification flag | CAUGHT | v1_tracking, v104_audit |
| M21 time given as a bare number is accepted | CAUGHT | v1_tracking, v103_fitness |
| M23 data-quality report writes data (read-only violated) | CAUGHT | v104_audit, v105_fitness_governance |
| M24 retroactive: approving a version rescored old results | CAUGHT | v104_audit, v105_fitness_governance |
| M22 UI: approve without the verification tick | CAUGHT | approve WITHOUT the verification tick is refused and the version stays |

## חמש הקטגוריות
**1. נבדק ועבר:** כל 434 הבדיקות לעיל; 24/24 מוטציות; הוכחת קריאה-בלבד של דוח איכות הנתונים; ללא השפעה רטרואקטיבית של גרסת ניקוד; בדיקות API ישירות (מנהל/מפקד, הפרדת קורסים וצוותים); זהות ct/‏, ct_v1.0.3/‏, ct_v1.0.4/‏ מול ה-ZIP שנמסרו (diff -r); כישלון strict (יציאה 1) כשאין Playwright.
**2. נבדק ונכשל:** אין. (בשלב הפיתוח נתגלו ותוקנו: מוטציות M05 ו-M07 ששרדו תחילה; סקריפט המוטציות שדילג בשקט על בדיקת הדפדפן כשאין Playwright — תוקן.)
**3. לא נבדק:** `npm install` / `npx playwright install` אמיתיים (הרשת חסומה בסביבה זו; node_modules הועתק מהתקנה קיימת); UI לעריכת שורות טיוטה (לא קיים, BACKLOG B16); דפדפנים שאינם Chromium; מכשיר נייד פיזי.
**4. ממתין להכרעה מקצועית:** N1 (מתח בנות: חזרה אחת/אפס/מעבר לטווח), N6 (סוג ביצוע מתח בבנים), N7 (Trap Bar: טבלה מול נוסחה ישנה); N2, N5 ממתינים לאישור סופי. ראו docs/OPEN_BLOCKERS.md.
**5. ממתין לבדיקת Apps Script/Google אמיתית:** הרצת הקוד ב-Apps Script; Sheets/Drive אמיתיים; LockService ו-Triggers; חשבונות והרשאות Google אמיתיים; יצוא PDF/Excel; גיבוי ושחזור ב-Drive; Preflight בסביבה חיה; בדיקת ביצועים בנפח אמיתי.

**המערכת אינה מוכנה להפעלה מבצעית.** הבדיקות רצו על סימולציה בזיכרון ועל דפדפן מול Index.html עם שרת מדומה — לא על Google.
