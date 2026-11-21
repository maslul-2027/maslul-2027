# יכולות לפי סביבה (נוצר אוטומטית — אין לערוך ידנית)

מקור: `docs/route-evidence-ledger.json` (ראיות הדמו הציבורי) וסוויטות השרת הרשומות ב-`scripts/build_env_ledger.js`. מסמך זה **לא משדרג** שום סטטוס, ולא קובע ש-176/176 עובדים בכל סביבה.

## ארבע סביבות, ארבע רמות הוכחה
| סביבה | מה זה | הוכחה | מה אסור להסיק |
|---|---|---|---|
| 1. דמו ציבורי בדפדפן | מנוע מקומי ב-localStorage, נתונים סינתטיים, ללא שרת | 158 מתוך 176 נתיבים: PASS_SYNTH_E2E בדפדפן (קליקים בממשק) | לא מוכיח הרשאות שרת, התמדה בין מכשירים, קבצים או גיבוי |
| 2. שרת TEST מקומי מאומת (HTTPS, loopback / חבילת Windows) | אותו UI מול שרת אמיתי: כניסה, סשנים, הרשאות, קבצים מוצפנים | הרשאות כל 176 הנתיבים בטבלה ובבדיקות `tests/d7_authz.js` ו-`tests/route_table.js`; **70 נתיבים מוזכרים במפורש** בסוויטות השרת (הוזכר ≠ E2E פונקציונלי מלא); דוחות, מסמכים וגיבוי נבדקים בעצם ב-HTTPS | לא נגיש ממכשיר אחר; מחשב אחד בלבד |
| 3. שרת TEST פרטי משותף מתארח | אותו קוד על מארח מאושר, שני מכשירים | **NOT_DEPLOYED. אין הוכחה.** תסריט T1–T11 ב-`docs/PRIVATE_TEST_GO_NO_GO.md` מסומן NOT_RUN | לא ניתן לטעון שהוא קיים |
| 4. נתונים אמיתיים | | **אסור כרגע.** דורש אישורי בעלים, ארגון ואבטחה (go/no-go), ו-pen-test | אישור הדמו אינו אישור לכך |

## הסבר המספרים (176 / 158 / 5 / 13)
- **176** נתיבי API בקוד (`src/Code.gs`), זהה לטבלת הנתיבים בשרת.
- **158 PASS_SYNTH_E2E**: נקראים מהממשק בדמו הציבורי בבדיקות דפדפן, וכל קריאה מקושרת לתנועת משתמש.
- **5 POLICY_BLOCKED**: חסומים בכוונה בגבול הבקשה לכל התפקידים: `dash.trends`, `reports.build`, `ai.draft`, `ai.drafts`, `ai.reviewDraft`.
- **13 BLOCKED_NOT_CONNECTED בדמו הציבורי**: דורשים מנוע קבצים או חיבור חיצוני שאינם קיימים בדמו. מתוכם **11 עובדים באמת בשרת TEST המקומי/חבילת Windows** (דוחות, מסמכים וגיבוי), נבדקו ב-HTTPS, ולא מוצגים כעובדים בדמו. נותרו שניים שאינם עובדים באף סביבה: `ocr.start` (אין מנוע OCR) ו-`migration.run` (מושבת בכוונה).
- המשמעות: 158 + 5 + 13 = 176. "158/176" איננו "ציון מוכנות": נתיב שעבר בדמו אינו מוכח בשרת פרטי משותף.

## הנתיבים הלא-מחוברים (13), ומה מצבם בכל סביבה
| נתיב | דמו ציבורי | שרת TEST מקומי | פרטי משותף |
|---|---|---|---|
| `reports.generate` | NOT_CONNECTED | עובד (HTTPS; `docs/REPORT_EXPORT_TEST.md`) | NOT_DEPLOYED |
| `reports.fullExport` | NOT_CONNECTED | עובד (HTTPS; `docs/REPORT_EXPORT_TEST.md`) | NOT_DEPLOYED |
| `reports.download` | NOT_CONNECTED | עובד (HTTPS; `docs/REPORT_EXPORT_TEST.md`) | NOT_DEPLOYED |
| `docs.upload` | NOT_CONNECTED | עובד (HTTPS; `docs/DOCUMENTS_TEST.md`) | NOT_DEPLOYED |
| `docs.download` | NOT_CONNECTED | עובד (HTTPS; `docs/DOCUMENTS_TEST.md`) | NOT_DEPLOYED |
| `ocr.start` | NOT_CONNECTED | חסום: אין מנוע OCR | NOT_DEPLOYED |
| `backup.create` | NOT_CONNECTED | עובד (HTTPS; `docs/BACKUP_RESTORE_TEST.md`) | NOT_DEPLOYED |
| `backup.verify` | NOT_CONNECTED | עובד (HTTPS; `docs/BACKUP_RESTORE_TEST.md`) | NOT_DEPLOYED |
| `backup.plan` | NOT_CONNECTED | עובד (HTTPS; `docs/BACKUP_RESTORE_TEST.md`) | NOT_DEPLOYED |
| `backup.restore` | NOT_CONNECTED | עובד (HTTPS; `docs/BACKUP_RESTORE_TEST.md`) | NOT_DEPLOYED |
| `backup.recover` | NOT_CONNECTED | עובד (HTTPS; `docs/BACKUP_RESTORE_TEST.md`) | NOT_DEPLOYED |
| `backup.prune` | NOT_CONNECTED | עובד (HTTPS; `docs/BACKUP_RESTORE_TEST.md`) | NOT_DEPLOYED |
| `migration.run` | NOT_CONNECTED | חסום: מושבת בכוונה | NOT_DEPLOYED |

## כיסוי לפי קבוצה
| קבוצה | נתיבים | דמו PASS | מוזכרים בסוויטות שרת |
|---|---|---|---|
| acttypes | 4 | 4 | 1 |
| ai | 4 | 1 | 4 |
| alerts | 4 | 4 | 0 |
| analytics | 1 | 1 | 1 |
| assess | 2 | 2 | 1 |
| assignments | 5 | 5 | 0 |
| attendance | 4 | 4 | 3 |
| audit | 1 | 1 | 1 |
| backup | 7 | 1 | 7 |
| correction | 3 | 3 | 3 |
| courses | 6 | 6 | 3 |
| dash | 6 | 5 | 4 |
| docs | 8 | 6 | 3 |
| emergency | 3 | 3 | 3 |
| events | 2 | 2 | 1 |
| exams | 7 | 7 | 1 |
| favorites | 2 | 2 | 0 |
| fitness | 19 | 19 | 5 |
| followups | 3 | 3 | 0 |
| forms | 4 | 4 | 3 |
| import | 6 | 6 | 1 |
| marches | 3 | 3 | 2 |
| meetings | 6 | 6 | 4 |
| migration | 1 | 0 | 1 |
| mk | 3 | 3 | 0 |
| nav | 4 | 4 | 2 |
| navtypes | 4 | 4 | 0 |
| notes | 2 | 2 | 0 |
| ocr | 5 | 4 | 0 |
| preflight | 2 | 2 | 0 |
| qual | 10 | 10 | 0 |
| readiness | 4 | 4 | 0 |
| record | 4 | 4 | 2 |
| reports | 6 | 2 | 6 |
| settings | 2 | 2 | 1 |
| snote | 3 | 3 | 0 |
| soldiers | 9 | 9 | 5 |
| tasks | 4 | 4 | 1 |
| users | 3 | 3 | 1 |

## עדיין חסום (ללא שינוי)
OCR (אין ספק/מנוע), הגירה (`migration.run`), חיבורי Drive/Google, טבלאות ניקוד כש״ג N1–N8 (DRAFT, לא מאושרות מקצועית), שרת פרטי מתארח.
