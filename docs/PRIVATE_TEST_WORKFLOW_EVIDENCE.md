# מטריצת ראיות לפי זרימת עבודה — שרת TEST פרטי מקומי (HTTPS, נתונים סינתטיים)

> נוצר אוטומטית מ-`scripts/e2e_private_workflows.js` (ריצת Chromium) ב-`scripts/build_private_workflow_matrix.js`. אין לערוך ידנית.

## מה זה ומה זה לא
- **כן:** קליקים אמיתיים בממשק המקומי מול שרת HTTPS אמיתי (תעודה עצמית, loopback בלבד), בארבעה הקשרי דפדפן נפרדים (מנהל, מפקד צוות 1, מפקד צוות 2 זר, צופה) ועוד סשן מנהל שני, מול **מסד נתונים מתמיד אחד**, כולל אתחול שרת ושחזור מגיבוי.
- **לא:** שני טלפונים פיזיים; סביבת TEST מתארחת; אימות בעלות על מספר טלפון (**אין OTP/גורם שני — הכניסות הן כניסות בדיקה סינתטיות בלבד**); iPhone/VoiceOver; חבילת Windows על מחשב נקי של אדם (חבילת ה-Windows נבדקת ב-CI); נתוני אמת.
- **WebKit:** מנוע Safari **מדומה** של Playwright עם חלון בגודל טלפון (לא iPhone). אותה בדיקה רצה על Chromium ועל WebKit ב-CI.
- ראיות קודמות שנשארות נפרדות ולא נספרות כאן: 17 בדיקות הדפדפן המאובטחות הקיימות (`scripts/e2e_secure_browser.js`), 10/10 בדיקות שני סשנים ברמת API (`tests/ab_sessions_server.js`, ב-PR #88).

## תוצאת הריצה המתועדת
Chromium: pass=18 fail=0 — Chromium, phone-sized viewport (390x800) — NOT a physical phone.

## כניסה, אישור משתמשים והיקף
- **מה נבדק בממשק:** הרשמה בממשק (ממתין, לא נכנס) → אישור חד-פעמי על ידי מנהל בממשק (מפקד צוות 1, מפקד צוות 2, צופה) → כניסה, היקף צוות נשמר אחרי יציאה וכניסה, צופה לקריאה בלבד
- **התמדה:** מצב ההרשמה/אישור/סשנים בקובץ המצב המוצפן של השרת
- **נתיבי API שהממשק עצמו קרא (UI-origin):** `alerts.counts`, `analytics.insights`, `assignments.mine`, `attendance.events`, `courses.list`, `courses.org`, `followups.list`, `marches.list`, `soldiers.list`, `tasks.indicators`, `tasks.list`, `whoAmI`
- **נתיבים שהבדיקה קראה ישירות (אימות/ניסיונות אסורים, לא קליק):** `marches.create`, `soldiers.list`
- **ניסיונות ישירים אסורים שנדחו:**
  - viewer marches.create → denied
- **בדיקות:** ✔ W1 register three synthetic users through the UI (pending, cannot enter) — NO OTP/phone verification exists · ✔ W1 admin approves ONCE through the UI: team-1 commander, team-2 commander (different team), viewer · ✔ W1 commander logs in; scope is team-only; logout + relogin keeps exactly the same scope; viewer enters read-only

## מסע, נוכחות ותיקון משתתף
- **מה נבדק בממשק:** מפקד יוצר מסע עם שני חסרים בממשק; מנהל בהקשר נפרד קורא אותו; מנהל מתקן אחד עם סיבה; שני הצדדים רואים חסר אחד אחרי רענון; מפקד צוות זר לא רואה; צופה לא משנה; מפקד רק מבקש תיקון והמנהל מאשר
- **התמדה:** שורות המסע והנוכחות בקובץ המצב; יומן ביקורת מנוע + שער
- **נתיבי API שהממשק עצמו קרא (UI-origin):** `alerts.counts`, `analytics.insights`, `assignments.mine`, `attendance.events`, `correction.request`, `courses.list`, `courses.org`, `followups.list`, `marches.create`, `marches.list`, `record.edit`, `soldiers.list`, `tasks.indicators`, `tasks.list`, `whoAmI`
- **נתיבים שהבדיקה קראה ישירות (אימות/ניסיונות אסורים, לא קליק):** `audit.list`, `correction.list`, `correction.request`, `correction.review`, `marches.list`, `record.edit`, `record.history`
- **ניסיונות ישירים אסורים שנדחו:**
  - foreign commander record.edit → NOT_FOUND
  - foreign commander correction.request → NOT_FOUND
  - foreign commander record.history → NOT_FOUND
  - viewer record.edit → FORBIDDEN
  - anonymous /api → 401; no-CSRF /api → 403
- **בדיקות:** ✔ W2 team-1 COMMANDER creates a march through the UI with two absent; the persisted roster shows 2 missing · ✔ W2 admin in a SEPARATE context reads the SAME persisted march/roster (2 missing) · ✔ W2 admin corrects ONE participant in the UI with a reason; BOTH sessions see ONE missing after reload; audit records it; no duplicate rows · ✔ W2 foreign team-2 commander: no march/name/count/row in UI or API; cannot edit or request; direct unauthorized calls denied · ✔ W2 viewer: read-only (no edit/request buttons); direct write denied; commander can only REQUEST (admin approves) — never edits directly · ✔ W2 transport safety: unauthenticated and CSRF-less direct requests are refused; scope switching (C1 reads team-2 march) finds nothing

## משימות וישיבות
- **מה נבדק בממשק:** הוספת משימה מהכפתור "+" עם לחיצה כפולה (משימה אחת); שמירה שנכשלה משאירה טיוטה ללא הודעת הצלחה; ישיבה עם שלוש משימות מעקב; עריכה מקבילה מסשן שני נכשלת בבאנר טעינה מחדש; אתחול שרת; משתמש מושבת נחסם
- **התמדה:** משימות וישיבות בקובץ המצב; שורדות אתחול שרת
- **נתיבי API שהממשק עצמו קרא (UI-origin):** `alerts.counts`, `analytics.insights`, `assignments.mine`, `attendance.events`, `courses.list`, `courses.org`, `followups.list`, `marches.list`, `meetings.get`, `meetings.integrity`, `meetings.list`, `meetings.options`, `meetings.save`, `soldiers.list`, `tasks.indicators`, `tasks.list`, `whoAmI`
- **נתיבים שהבדיקה קראה ישירות (אימות/ניסיונות אסורים, לא קליק):** `marches.list`, `meetings.get`, `meetings.list`, `meetings.save`, `tasks.list`
- **ניסיונות ישירים אסורים שנדחו:**
  - deactivated user: write refused, login refused
- **בדיקות:** ✔ W3 commander quick-adds a task with "+"; double-submit creates ONE; a failed save keeps the draft and shows NO success toast; retry saves exactly once · ✔ W3 admin (other context) meeting editor: 3 follow-up rows saved once; commander and admin both read them · ✔ W3 concurrent edit by a SECOND admin session fails closed: stale save shows the reload banner, draft stays on screen, nothing overwritten · ✔ W3 SERVER RESTART: tasks, meeting follow-ups and the corrected march survive; sessions are honoured or require a fresh login (never stale data) · ✔ W3 revoked user: admin deactivates the commander in the UI → his next action fails closed, nothing is saved, he cannot log in; reactivation restores access

## דוחות, מסמכים, גיבוי ושחזור
- **מה נבדק בממשק:** הורדת PDF ו-XLSX אמיתיים בממשק; העלאת מסמך PDF מוצפן והורדה זהה בייט-לבייט; גיבוי → שינוי → שחזור בממשק; כל הסשנים מבוטלים והכניסה נדרשת מחדש; הקבצים והדוחות חוזרים זהים
- **התמדה:** קבצים מוצפנים בדיסק (.enc) וגיבוי מלא עם מניפסט וסיכומי ביקורת
- **נתיבי API שהממשק עצמו קרא (UI-origin):** `alerts.counts`, `analytics.insights`, `assignments.mine`, `attendance.events`, `backup.create`, `backup.list`, `backup.plan`, `backup.restore`, `backup.verify`, `courses.list`, `courses.org`, `docs.list`, `docs.pendingLinks`, `docs.upload`, `followups.list`, `marches.list`, `meetings.get`, `meetings.list`, `meetings.options`, `meetings.save`, `preflight.last`, `reports.generate`, `reports.jobs`, `reports.preview`, `soldiers.list`, `tasks.indicators`, `tasks.list`, `whoAmI`
- **נתיבים שהבדיקה קראה ישירות (אימות/ניסיונות אסורים, לא קליק):** `docs.list`, `marches.list`, `reports.jobs`, `soldiers.list`, `tasks.list`
- **ניסיונות ישירים אסורים שנדחו:**
  - commander GET /api/download/report → 404
  - viewer GET /api/download/report → 404
  - foreign commander GET /api/download/report → 404
  - foreign commander GET /api/download/document → 404
  - viewer GET /api/download/document → 403
  - commander (not the uploader) GET /api/download/document → 404
- **בדיקות:** ✔ W4 admin downloads a real PDF and XLSX through the UI; commander and viewer have no export UI and direct download is refused · ✔ W4 admin uploads an encrypted PDF document for a team-1 trainee through the UI; byte-identical download; other team / viewer / commander-not-uploader denied · ✔ W4 BACKUP through the UI → change data → RESTORE through the UI: all sessions revoked, data and files return exactly, re-login works · ✔ no page errors in any context

## סיכום כיסוי בשרת המאובטח
- נתיבים שנגעו בהם הזרימות האלה (UI-origin או קריאה ישירה לצורך אימות): **35** מתוך 185.
- **NOT_RUN בשרת המאובטח בזרימות אלה: 150 נתיבים.** הראיות הקיימות עבורם בדמו הציבורי (`docs/route-evidence-ledger.json`) או בסוויטות שרת אחרות **אינן** מועתקות לכאן.

<details><summary>רשימת הנתיבים ש-NOT_RUN כאן</summary>

`acttypes.create`, `acttypes.list`, `acttypes.rename`, `acttypes.setActive`, `ai.ask`, `ai.draft`, `ai.drafts`, `ai.reviewDraft`, `alerts.handle`, `alerts.list`, `alerts.refresh`, `assess.add`, `assess.list`, `assignments.create`, `assignments.list`, `assignments.setActive`, `assignments.update`, `attendance.create`, `attendance.roll`, `attendance.summary`, `backup.prune`, `backup.recover`, `courses.archive`, `courses.create`, `courses.rename`, `courses.reopen`, `dash.compareCourses`, `dash.groups`, `dash.home`, `dash.overview`, `dash.strengthsGaps`, `dash.trends`, `docs.attachEvidence`, `docs.download`, `docs.evidence`, `docs.requestLink`, `docs.reviewLink`, `emergency.get`, `emergency.orphans`, `emergency.set`, `events.create`, `events.list`, `exams.attempt`, `exams.attempts`, `exams.defCreate`, `exams.defPass`, `exams.defs`, `exams.meetings`, `exams.summary`, `favorites.list`, `favorites.toggle`, `fitness.addTable`, `fitness.approve`, `fitness.completion`, `fitness.create`, `fitness.draftSource`, `fitness.editRow`, `fitness.importDraft`, `fitness.list`, `fitness.preview`, `fitness.quality`, `fitness.recompute`, `fitness.reference`, `fitness.summary`, `fitness.typeActive`, `fitness.typeCreate`, `fitness.typeVariant`, `fitness.typeWeights`, `fitness.types`, `fitness.versions`, `followups.create`, `followups.update`, `forms.createLink`, `forms.generalLink`, `forms.list`, `forms.review`, `import.cancel`, `import.commit`, `import.decide`, `import.jobs`, `import.preview`, `import.start`, `marches.summary`, `meetings.auditRepair`, `migration.run`, `mk.create`, `mk.list`, `mk.summary`, `nav.create`, `nav.groups`, `nav.list`, `nav.summary`, `navevents.adopt`, `navevents.create`, `navevents.get`, `navevents.legacy`, `navevents.list`, `navevents.setStatus`, `navevents.update`, `navtypes.create`, `navtypes.list`, `navtypes.rename`, `navtypes.setActive`, `notes.list`, `notes.save`, `ocr.approveRow`, `ocr.editRow`, `ocr.rejectRow`, `ocr.rows`, `ocr.start`, `preflight.run`, `qual.assignments`, `qual.define`, `qual.dueHistory`, `qual.list`, `qual.postpone`, `qual.requestExclusion`, `qual.reviewExclusion`, `qual.setActive`, `qual.summary`, `qual.update`, `readiness.assess`, `readiness.list`, `readiness.notEntered`, `readiness.summary`, `record.cancel`, `record.restore`, `reports.build`, `reports.download`, `reports.exportAuthorize`, `reports.exportComplete`, `reports.fullExport`, `settings.list`, `settings.set`, `snote.add`, `snote.cancel`, `snote.list`, `soldiers.cancel`, `soldiers.card`, `soldiers.create`, `soldiers.private`, `soldiers.reassign`, `soldiers.restore`, `soldiers.setActive`, `soldiers.update`, `tasks.get`, `tasks.setStatus`, `users.add`, `users.list`, `users.set`

</details>

## שערים חיצוניים לפיילוט משותף בשני טלפונים — חסמים שנותרו (לא בוצעו; לא ניתנים לביצוע מתוך הקוד)
1. מארח/רשת פרטיים מאושרים (אין קשירה לרשת מקומית/ציבורית מהשרת הזה; הוא נקשר ל-127.0.0.1 בלבד).
2. תעודת TLS מהימנה לטלפונים (התעודה כאן עצמית; לא מתקינים CA על טלפונים).
3. אחסון מאובטח למפתחות וגיבויים (מפתח המצב והגיבויים כיום על דיסק מקומי).
4. אימות בעלות על הטלפון / גורם שני (**לא קיים**; אין OTP, אין SMS) והחלטת זהות מתאימה.
5. אישור IT/InfoSec ואישור הבעלים.

**NOT_RUN:** שני טלפונים פיזיים, Windows נקי אצל אדם, iPhone אמיתי/VoiceOver, שימוש בנתוני אמת, שרת מתארח משותף.

בדיקת עשן מקומית בלחיצה אחת (ללא פקודות): `SMOKE-TEST.cmd` בחבילת ה-Windows או `node release/launcher.js --smoke`; היא משתמשת בתיקייה זמנית, אינה נוגעת בנתונים ואינה תחליף לפיילוט.
