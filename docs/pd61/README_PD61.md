# product-dev6.1 — תיקוני QA-01 ו-QA-02 (לא מבצעית)
בסיס: product-dev6 (לא שונה; ZIP `a27319fc…7b3c`, fingerprint src `f7f440f2…4c70`). גרסה `1.0.6-b7b8-r3-product-dev6.1`, SCHEMA 3 (ללא שינוי סכמה).
fingerprint src של dev6.1: `ff1dbad7ef7380025aa302caf0c9c85483f0dc2b937fbe9860bd511fa46e936d` (42 קבצים; `tests/src_manifest_dev6_1.txt`).
לא שונו: מדיניות חשיפת משימות למפקדים, הרשאות עריכת משימות/מועדים/שיוך/סטטוס, ניקוד/קבצים מצורפים/התראות/צוות/יצירת משימה עצמאית.

## QA-01 — הרשאות וסינון לפי מחלקה (`Meetings.gs`)
- חדש `authDepts_(L)`: המחלקות שבסמכות המבקש (מנהל: כל מחלקות הקורס; מפקד: המחלקות שהשיוכים שלו נוגעים בהן; שיוך לכל הקורס = כולן).
- `taskView_`: `department_ids` = החיתוך של מחלקות האחראי עם סמכות המבקש. אחראי ברמת קורס לא חושף עוד מחלקות זרות.
- `list_`: `departmentId` מחוץ לסמכות → `FORBIDDEN` (אותה תשובה גם ל-id שאינו קיים — אין ניחוש); למנהל id לא קיים → `VALIDATION`.
- תוצאות, `counts`, `total_matching`, `truncated`, אפשרויות סינון — כולם נגזרים מקבוצת המשימות הגלויה בלבד (כפי שהיו); נוספו בדיקות שמוכיחות זאת. אין תלות בסינון לקוח.
## QA-02 — עקביות Audit ו-Save (`Meetings.gs`, `Code.gs`, `Policy.gs`, `Index.html`)
- אירוע ההצלחה (`MEETING_CREATE`/`MEETING_EDIT`) נבנה לפני ה-commit (ערכים ישנים) **ונכתב רק אחריו**. בכשל לפני commit לא נרשם אירוע הצלחה (נרשם רק `MEETING_SAVE_FAILED`).
- התנהגות מוגדרת:
  | מצב | תוצאה |
  |---|---|
  | יצירת פגישה נכשלה | `SAVE_FAILED`, אין שורות, אין אירוע הצלחה |
  | עריכה נכשלה (משימה/אירוע) | שחזור הערכים הישנים, `SAVE_FAILED`, אין אירוע הצלחה |
  | כתיבת ה-commit נכשלה | `SAVE_FAILED`; השורות מסומנות rolled_back; נשארת שורת סיכום מוסתרת `committed_rev=0` (orphan) שניסיון חוזר עם אותו request_id משתמש בה |
  | כתיבת ה-commit זרקה שגיאה **אך נחתה** | מזוהה (קריאה חוזרת של השורה) → הצלחה, לא `SAVE_FAILED` |
  | Audit נכשל אחרי commit | `ok:true` + `audit:{recorded:false, code:'AUDIT_FAILED', meeting_id, rev, message}`; ה-UI מציג הצלחה + אזהרה |
  | רישום `MEETING_SAVE_FAILED` עצמו נכשל | נשאר `SAVE_FAILED` נקי (לא `SAVE_PARTIAL`) |
  | שחזור נכשל | `SAVE_PARTIAL`, השורות נשארות מוסתרות |
- איתור וטיפול (מנהל בלבד, פעולה חדשה `meeting.audit` ב-ADMIN_ONLY): `meetings.integrity` מחזיר `audit_gaps` (גרסאות שנשמרו ללא אירוע ביקורת) ו-`orphans` (committed_rev=0); `meetings.auditRepair` (id, rev, reason חובה) כותב אירוע `MEETING_AUDIT_REPAIR` (הוספה בלבד, מי תיקן + מי כתב במקור). ב-UI: כפתור "בדיקת שלמות (מנהל)" ברשימת הסיכומים.
- orphans: מוסתרים מכל קורא (רשימה, פרטים, KPI, אפשרויות), לא ניתנים לעריכה (`NOT_FOUND`), לא נמחקים פיזית; מוצגים למנהל בלבד.
## שינויים ארכיטקטוניים
1. סדר commit→audit (במקום audit→commit). 2. זיהוי "commit שנחת" אחרי חריגה. 3. תוצאת שמירה מורחבת (`audit`). 4. שתי נקודות API ופעולת Policy ADMIN_ONLY חדשות (אין נקודת יצירת משימה). 5. `authDepts_` כמקור יחיד לסמכות מחלקתית. אין שינוי סכמה/הגירה.
## הוראות הרצה
`cd` לשורש הפרויקט; `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/run_all.js --ui --strict` (Node 22, Playwright 1.63.0 מוצמד, Chromium מקומי). רק PD6/PD61: `node tests/pd6_meetings_tasks.js && node tests/pd61_qa_fixes.js`; UI: `node tests/ui_pd6_meetings.js` (צילומים ל-`docs/pd6/screens/`); זהות מקור: `node tests/src_identity.js`. fingerprint: `sha256sum src/* | sha256sum`.
