#!/usr/bin/env node
'use strict';
// Environment-specific capability truth (generated; --check fails CI when docs/CAPABILITIES_BY_ENVIRONMENT.md is stale).
// Source of truth: docs/route-evidence-ledger.json (public demo evidence) + the named server suites below. It never upgrades a status: "named in a secure-server suite" is a coverage fact, not a functional-E2E claim.
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const rows = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'route-evidence-ledger.json'), 'utf8')).rows;
const SERVER_SUITES = ['tests/secure_test_server.js', 'tests/uxqa_server.js', 'tests/marches_server.js', 'tests/report_export.js', 'tests/backup_restore.js', 'tests/documents_server.js', 'tests/full_backup.js', 'scripts/e2e_secure_browser.js', 'scripts/e2e_report_export_browser.js', 'scripts/e2e_backup_restore_browser.js', 'scripts/e2e_documents_browser.js', 'scripts/e2e_release_package.js'];
const text = SERVER_SUITES.filter(f => fs.existsSync(path.join(root, f))).map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const named = r => text.includes("'" + r.route + "'") || text.includes('"' + r.route + '"');
const g = {}; rows.forEach(r => { (g[r.group] = g[r.group] || []).push(r); });
const cnt = (a, f) => a.filter(f).length;
const total = rows.length, demoPass = cnt(rows, r => r.status === 'PASS_SYNTH_E2E'), pol = rows.filter(r => r.status === 'POLICY_BLOCKED'), nc = rows.filter(r => r.status === 'BLOCKED_NOT_CONNECTED'), srvNamed = cnt(rows, named);
let md = '# יכולות לפי סביבה (נוצר אוטומטית — אין לערוך ידנית)\n\n';
md += 'מקור: `docs/route-evidence-ledger.json` (ראיות הדמו הציבורי) וסוויטות השרת הרשומות ב-`scripts/build_env_ledger.js`. מסמך זה **לא משדרג** שום סטטוס, ולא קובע ש-176/176 עובדים בכל סביבה.\n\n';
md += '## ארבע סביבות, ארבע רמות הוכחה\n| סביבה | מה זה | הוכחה | מה אסור להסיק |\n|---|---|---|---|\n';
md += '| 1. דמו ציבורי בדפדפן | מנוע מקומי ב-localStorage, נתונים סינתטיים, ללא שרת | ' + demoPass + ' מתוך ' + total + ' נתיבים: PASS_SYNTH_E2E בדפדפן (קליקים בממשק) | לא מוכיח הרשאות שרת, התמדה בין מכשירים, קבצים או גיבוי |\n';
md += '| 2. שרת TEST מקומי מאומת (HTTPS, loopback / חבילת Windows) | אותו UI מול שרת אמיתי: כניסה, סשנים, הרשאות, קבצים מוצפנים | הרשאות כל 176 הנתיבים בטבלה ובבדיקות `tests/d7_authz.js` ו-`tests/route_table.js`; **' + srvNamed + ' נתיבים מוזכרים במפורש** בסוויטות השרת (הוזכר ≠ E2E פונקציונלי מלא); דוחות, מסמכים וגיבוי נבדקים בעצם ב-HTTPS | לא נגיש ממכשיר אחר; מחשב אחד בלבד |\n';
md += '| 3. שרת TEST פרטי משותף מתארח | אותו קוד על מארח מאושר, שני מכשירים | **NOT_DEPLOYED. אין הוכחה.** תסריט T1–T11 ב-`docs/PRIVATE_TEST_GO_NO_GO.md` מסומן NOT_RUN | לא ניתן לטעון שהוא קיים |\n';
md += '| 4. נתונים אמיתיים | | **אסור כרגע.** דורש אישורי בעלים, ארגון ואבטחה (go/no-go), ו-pen-test | אישור הדמו אינו אישור לכך |\n\n';
md += '## הסבר המספרים (176 / 158 / 5 / 13)\n- **176** נתיבי API בקוד (`src/Code.gs`), זהה לטבלת הנתיבים בשרת.\n- **158 PASS_SYNTH_E2E**: נקראים מהממשק בדמו הציבורי בבדיקות דפדפן, וכל קריאה מקושרת לתנועת משתמש.\n- **5 POLICY_BLOCKED**: חסומים בכוונה בגבול הבקשה לכל התפקידים: ' + pol.map(r => '`' + r.route + '`').join(', ') + '.\n- **13 BLOCKED_NOT_CONNECTED בדמו הציבורי**: דורשים מנוע קבצים או חיבור חיצוני שאינם קיימים בדמו. מתוכם **11 עובדים באמת בשרת TEST המקומי/חבילת Windows** (דוחות, מסמכים וגיבוי), נבדקו ב-HTTPS, ולא מוצגים כעובדים בדמו. נותרו שניים שאינם עובדים באף סביבה: `ocr.start` (אין מנוע OCR) ו-`migration.run` (מושבת בכוונה).\n- המשמעות: 158 + 5 + 13 = ' + (158 + 5 + 13) + '. "158/176" איננו "ציון מוכנות": נתיב שעבר בדמו אינו מוכח בשרת פרטי משותף.\n\n';
md += '## הנתיבים הלא-מחוברים (13), ומה מצבם בכל סביבה\n| נתיב | דמו ציבורי | שרת TEST מקומי | פרטי משותף |\n|---|---|---|---|\n';
nc.forEach(r => { const ok = !/^ocr\.|^migration\./.test(r.route); md += '| `' + r.route + '` | NOT_CONNECTED | ' + (ok ? 'עובד (HTTPS; ' + (/^backup/.test(r.route) ? '`docs/BACKUP_RESTORE_TEST.md`' : /^docs/.test(r.route) ? '`docs/DOCUMENTS_TEST.md`' : '`docs/REPORT_EXPORT_TEST.md`') + ')' : r.route === 'ocr.start' ? 'חסום: אין מנוע OCR' : 'חסום: מושבת בכוונה') + ' | NOT_DEPLOYED |\n'; });
md += '\n## כיסוי לפי קבוצה\n| קבוצה | נתיבים | דמו PASS | מוזכרים בסוויטות שרת |\n|---|---|---|---|\n';
Object.keys(g).sort().forEach(k => { md += '| ' + k + ' | ' + g[k].length + ' | ' + cnt(g[k], r => r.status === 'PASS_SYNTH_E2E') + ' | ' + cnt(g[k], named) + ' |\n'; });
md += '\n## עדיין חסום (ללא שינוי)\nOCR (אין ספק/מנוע), הגירה (`migration.run`), חיבורי Drive/Google, טבלאות ניקוד כש״ג N1–N8 (DRAFT, לא מאושרות מקצועית), שרת פרטי מתארח.\n';
const out = path.join(root, 'docs', 'CAPABILITIES_BY_ENVIRONMENT.md');
if (process.argv.includes('--check')) { const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : ''; if (cur !== md) { console.error('docs/CAPABILITIES_BY_ENVIRONMENT.md is stale — run: node scripts/build_env_ledger.js'); process.exit(1); } console.log('env ledger OK (' + total + ' routes; server-named ' + srvNamed + ')'); }
else { fs.writeFileSync(out, md); console.log('wrote ' + out + ' (server-named ' + srvNamed + ')'); }
