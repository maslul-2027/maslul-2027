> **ARCHIVED / NOT AN EXECUTABLE RUNBOOK (2026-11-17).** This document contains historical instructions and must not be followed to install, migrate, configure permissions, create triggers, or deploy the R5 candidate. The only current preparation path is the read-only `MASLUL_2027_GOOGLE_TEST_TRANSFER_KIT_R10` procedure described in `docs/GOOGLE_TEST_RUNBOOK_D7.md` and `OWNER_ACTIONS.md`. That procedure stops before any remote write. Any later upload, setup, migration, trigger installation, or deployment requires a separate explicit owner approval after reviewing the exact TEST clone, backup, and content diff. Synthetic data only. If this notice conflicts with text below, this notice controls.

# תוכנית סביבת Staging — עותק הכנה 1.0.6-b7b8-r3-product-dev2

> **סטטוס: תוכנית בלבד. דבר ממה שכתוב כאן לא בוצע ב-Google.** כל מה שנבדק עד כה רץ ב-Node/Chromium מול סימולציה. פירוט צעדי בדיקה ישנים (ST-01…ST-21): `STAGING_GUIDE.md` (נשמר כרקע; מסמך זה הוא הקובע לתכנון). נתוני חיילים אמיתיים אסורים. אין פריסה לייצור.

## 1. עקרון ההפרדה המלאה מייצור
| נושא | כלל |
|---|---|
| חשבון | חשבון Google **ייעודי ל-Staging** (או טננט Workspace נפרד לבדיקות). לא חשבון ייצור, לא חשבון אישי/עבודה |
| פרויקט Apps Script | פרויקט חדש בשם `CourseTracker-STAGING`; לא להעתיק Script Properties מייצור |
| גיליונות/Drive | נוצרים אוטומטית ע״י `setupDatabase` **בחשבון ה-Staging**; שמות כוללים "do not share"; אין שיתוף עם אף אחד (בכלל לא עם חשבונות הבדיקה של מפקדים — גישה רק דרך ה-Web App) |
| Google Form | טופס נפרד בחשבון ה-Staging; גיליון תשובות בחשבון ה-Staging; אין חיבור לטופס/גיליון של ייצור |
| נתונים | סינתטיים בלבד (`staging_demo/`); שמות/מספרים אישיים בדויים |
| ביטחון הפרדה | לפני כל שלב: אימות שחשבון הדפדפן הוא חשבון ה-Staging; אימות שמזהי `MAIN_SPREADSHEET_ID`/`PRIVATE_SPREADSHEET_ID`/`DRIVE_ROOT_ID` שייכים לקבצים שבבעלות חשבון ה-Staging; לא לפתוח את ה-Web App של ייצור באותו פרופיל דפדפן |

## 2. תנאי קדם — חסם א׳ (החלטה שלך)
המערכת מזהה משתמש לפי `Session.getActiveUser().getEmail()` ורצה כ-`USER_DEPLOYING`; מניפסט: `"access": "DOMAIN"`. מכאן:
- **Google Workspace (טננט בדיקות)** — נדרש כדי לבדוק מפקדים (תרחישי AT-U03…AT-U08, חלק מ-AT-D, AT-SEC-01). מומלץ: דומיין בדיקות עם 6 חשבונות (ראו `GOOGLE_ACCOUNT_ACTIONS.md`).
- **Gmail צרכני** — ניתן לבדוק רק את חוויית המנהל; מפקדים יקבלו זהות ריקה והמערכת נכשלת-סגור (זה מכוון). פריסה עם `Only myself`. תרחישי מפקד יסומנו BLOCKED.
- אל תעקפו (לא כתובת קשיחה, לא שיתוף גיליונות, לא "Anyone"). ההחלטה על סוג החשבון בידיך.

## 3. מה נדרש (משאבים)
| משאב | יוצר | הערות |
|---|---|---|
| פרויקט Apps Script `CourseTracker-STAGING` | ידני | 41 קבצים מתוך `src/` (38 `.gs`, `Index.html`, `FormPage.html`, `appsscript.json`); ללא `tests/`, `docs/` |
| גיליון ראשי + גיליון פרטי | `setupDatabase()` | נשמרים כ-Script Properties `MAIN_SPREADSHEET_ID`, `PRIVATE_SPREADSHEET_ID` |
| תיקיית שורש ב-Drive + `documents`, `backups`, `reports` | `setupDatabase`/Adapters | `DRIVE_ROOT_ID`; הרשאה פרטית (`Access.PRIVATE`) |
| טריגר יומי `dailyJob_` (02:00; פרטית — F-2; הרצה ידנית: `runDailyJobNow`) | `installDailyTrigger()` | בלעדיו אין גיבוי אוטומטי |
| Web App deployment | ידני | ראו §6 |
| Google Form (טופס פרטים אישיים) + גיליון תשובות | **ידני, בחשבון שלך** | ראו §7 |

## 4. Script Properties
| מאפיין | ערך | מי מגדיר |
|---|---|---|
| `ADMIN_EMAIL` | כתובת ה-Google של מנהל ה-Staging (אותיות קטנות) | ידני, **לפני** `setupDatabase` |
| `MAIN_SPREADSHEET_ID`, `PRIVATE_SPREADSHEET_ID`, `DRIVE_ROOT_ID` | נוצרים אוטומטית | `setupDatabase` — אל תערכו ידנית |
| `PERSONAL_FORM_URL` | קישור **מילוי** של הטופס (`…/forms/d/e/…/viewform` או `forms.gle/…`) | ידני, אחרי יצירת הטופס; **לא** קישור עריכה |

## 5. התקנת Apps Script (מחשב)
1. חשבון ה-Staging → `script.google.com` → פרויקט חדש `CourseTracker-STAGING`; Project Settings → הצגת `appsscript.json`.
2. העתקת 41 הקבצים בשמות מדויקים (`Index`, `FormPage` כ-HTML); מניפסט — ראו §6 על `access`. **ללא שינוי תוכן.** דחיית מניפסט → עצרו ותעדו (ST/R1 ב-`STAGING_GUIDE.md`).
3. Script Properties: `ADMIN_EMAIL`.
4. **מהעורך, כחשבון המנהל:** הרצת `setupDatabase()` (אישור הרשאות: Sheets, Drive, scriptapp, external_request, userinfo.email — מסך "unverified app" צפוי), ואז `createFirstCourse('קורס בדיקה','YYYY-MM-DD')` (או מהאפליקציה), ואז `installDailyTrigger()`.
   - **F-1:** פונקציות ההתקנה דורשות שהמריץ הוא `ADMIN_EMAIL`; אם נחסמתם ("רק למנהל המערכת") בהרצה מהעורך — עצרו ותעדו (לא לעקוף בקוד) — ייתכן שהזהות מהעורך ריקה בסביבה שלכם.
5. Preflight (מסך גיבוי) — צילום; כל סעיף שאינו PASS = ממצא, לא מתקנים הרשאות אוטומטית.

## 6. פריסת Web App
`Deploy → New deployment → Web app`; **Execute as: Me (המפרס)**. Access: Workspace — `Anyone within <domain>` (כפי שבמניפסט); Gmail — `Only myself`. **אסור** `Anyone` (אנונימי). שינוי מדיניות גישה אינו חלק מהתוכנית ודורש אישורך. שמרו את כתובת ה-`/exec`. פריסת טופס החיילים הפנימי (`?form=`) — לא מוקמת בשלב זה (החלטה ארגונית פתוחה; הטופס הכללי הוא Google Form חיצוני).

## 7. חיבור והגדרת Google Forms (פעולה שלך, בחשבון ה-Staging)
האפליקציה **לא** יוצרת/משנה טופס ולא מתחברת אליו. היא רק מציגה את קישור המילוי.
1. צרו טופס חדש. שדות מומלצים (תואמים לייבוא חיילים): **מספר אישי** (טקסט קצר, ספרות), **שם מלא**, **מין** (זכר/נקבה), **מחלקה**, **צוות** (שמות זהים לאלה שבקורס), **פק״ל** (אופציונלי), **תאריך גיוס** (אופציונלי).
2. הגדרות: לא לאסוף כתובות דוא״ל אם אינן נדרשות; להגביל לתשובה אחת — לפי החלטתכם.
3. **קישור מילוי:** Send → 🔗 → העתקת הקישור (`…/viewform`). לא להשתמש בקישור `…/edit`.
4. הגדרת `PERSONAL_FORM_URL` (§4). בדיקה: במסך החיילים מופיע "העתקת קישור לטופס פרטים אישיים"; פתיחה בחלון אנונימי (חשבון אחר) מציגה את הטופס **ללא** כפתורי עריכה.
5. **קליטה למערכת:** אין אינטגרציה אוטומטית. מגיליון התשובות מעתיקים את הטבלה (עם כותרות) למסך "ייבוא Excel" → יעד חיילים → תצוגה מקדימה → אישור (כפילויות מזוהות לפי מספר אישי; התנגשויות דורשות החלטה פרטנית).
6. אסור להזין נתוני אמת בטופס הבדיקות.

## 8. מניעת גישה לנתוני ייצור — רשימת בדיקה (לפני תחילת בדיקות ובסיומן)
☐ חשבון הדפדפן = חשבון ה-Staging · ☐ הפרויקט, הגיליונות, התיקייה והטופס בבעלות חשבון ה-Staging (צילום "Owner") · ☐ אין שיתוף של הקבצים עם חשבונות אחרים (General access = Restricted) · ☐ אין Script Properties/מזהים שהועתקו מייצור · ☐ שמות הקבצים מכילים STAGING/דמה · ☐ אין חיבור/טריגר לחשבון ייצור · ☐ בסיום: ביטול הרשאות הסקריפט (myaccount.google.com/permissions).

## 9. איפוס מלא של נתוני הבדיקה
**איפוס קשה (חזרה למצב נקי):** (1) לאמת בעלות/שם/תאריך יצירה של הקבצים (אם אי אפשר — לעצור); (2) מחיקת הטריגר היומי (Triggers → delete) ו-Deployments של ה-Web App; (3) העברת שני הגיליונות ותיקיית השורש (כולל `documents`/`backups`/`reports`) לאשפה — **ממוקד, לא ריקון אשפה כללי**; (4) הסרת `MAIN_SPREADSHEET_ID`, `PRIVATE_SPREADSHEET_ID`, `DRIVE_ROOT_ID` מ-Script Properties (להשאיר `ADMIN_EMAIL`, `PERSONAL_FORM_URL`); (5) מחיקת תשובות הטופס (Responses → Delete all) וגיליון התשובות של הבדיקות; (6) הרצה מחדש של `setupDatabase()` → סביבה ריקה.
**איפוס רך (בין סבבים):** גיבוי `before_test` לפני הבדיקות ושחזורו בסוף (ST-12); יצירת קורס חדש לכל סבב.
**חשוב:** המערכת עצמה אינה מוחקת פיזית (ביטול/ארכוב בלבד) — האיפוס הוא פעולה ידנית בחשבון ה-Staging.

## 10. הפעלת כש״ג בסביבת הבדיקה
מסך כש״ג (מנהל): טען טבלאות כטיוטה → בדיקה מול המקור → "אשר גרסה" (סימון אימות + נימוק). **אישור בסביבת Staging על נתוני דמה בלבד**; אישור גרסה בייצור ממתין להחלטותיך.
