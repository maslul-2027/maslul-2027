# OWNER_ACTIONS — MASLUL 2027 R5.2.16.4.4 (checkpoint 2026-11-19)

> מקור יחיד למספרים ולסטטוסים: `docs/R5_2_16_STATUS_MATRIX.md`. מסמך זה אינו מחזיק מספרים משלו מעבר לטבלה שלהלן. הקובץ `docs/OWNER_ACTIONS.md` הוא גרסה באנגלית של אותו תוכן (שני הקבצים חייבים להישאר זהים בתוכנם).

## מצב עדכני ומדויק

- מועמד **R5.2.16.4.4** (קובץ סטטוס `R5_2_16_4_4_CANDIDATE_STATUS.md`). QA עצמאי (Node 22.16.0 / npm 10.9.2 — **אינו** מקיים את שער Node המדויק v22.23.4; ללא Playwright/Chromium): שלמות ZIP PASS, clean-machine 15/15, שער R5 ממוקד 97/97, Node רחב 627/627 (45/57 suites; 12 סוויטות דפדפן דולגו — אינה רגרסיה מלאה). ריצת יישור 2026-11-19 (Linux, Node v22.23.4 מדויק, npm 10.9.9, Playwright 1.63.0, Chromium 153; node_modules קיים מראש, ללא lock): ריצת strict **57/57 suites, 853/853 בדיקות PASS, אפס SKIP**, source identity 4/4, syntax 41/41 ו-3/3. זו ראיה מ-Linux ולא ריצת Windows נקייה. package-lock: BLOCKED_NETWORK (חסר בכוונה). Windows 10, PowerShell preflight, קוראי מסך, axe-core, מכשירים, Google TEST: NOT_RUN. Production readiness: NOT APPROVED.
- **קוד המוצר:** ב-`src/` השתנו (מאז R5.2.15) רק `Index.html` ו-`FormPage.html`; קבצי `.gs` ללא שינוי; `src/` זהה בייט-לבייט מאז R5.2.16.1. R5.2.16.4.x שינו רק אריזה/QA (`scripts/lib/zipnode.js`, `scripts/clean_machine_verify.js`, בדיקותיהם) ותיעוד.
- **Production readiness: NOT APPROVED.**

## הפעולות הבאות — בסדר מחייב

1. **Windows preflight — read-only.** להשתמש בעותק העצמאי `windows_preflight.ps1` שנמסר לצד ה-ZIP (זהה בייט-לבייט ל-`scripts/windows_preflight.ps1`; SHA-256: `aa3e4352d2f6e6015a36770f9f432eef384ef26bcfd0b42ba48e587f72dc653c`), עם ה-SHA-256 של ה-ZIP מהודעת המסירה. פירוט מלא: `docs/INSTALL_CLEAN_MACHINE.md`. אם Windows/Node/npm/hash אינם תואמים — לעצור.
2. **Lock אמיתי.** במחשב מחובר, מתוך תיקיית הפרויקט: `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, ואז `node scripts/check_lock.js`. נדרש `LOCK OK`. אין לייצר ידנית.
3. **התקנה והרצת דפדפן.** `npm ci`, `npx playwright install chromium`, `npm run check-env`, `npm run test:strict`. נדרש `ENV: OK` וכל 59 suites PASS, אפס FAIL/SKIP, כולל browser. ספירת הבדיקות נצפית ומדווחת כפי שהיא (867 הוא ערך ייחוס, לא סף).
4. **שער R5 ממוקד.** `npm run test:r5-focused`; לדווח בנפרד מתוצאות הרגרסיה.
5. **החזרת ראיות.** לשמור פלטים מלאים, `tests/last_run.json`, ה-lock ו-hash שלו, ולוגי התקנה. אין לשלוח סודות או נתוני חיילים.
6. **Google TEST — נפרד ומותנה.** להשתמש בערכת ההעברה R10 במצב קריאה בלבד, עם clone/backup/diff (`docs/GOOGLE_TEST_RUNBOOK_D7.md`). אין לבצע `clasp push`, `clasp deploy`, `setupDatabase()`, `migrateToV1()` או `installDailyTrigger()` ללא אישור מפורש נפרד לאחר סקירת התוכנית והגיבוי.
7. **שערי אבטחה ושימושיות.** ביקורת InfoSec חיצונית, קורא מסך (NVDA/VoiceOver/TalkBack/JAWS), axe-core, בדיקות במכשירים פיזיים ובדפדפנים נוספים.

## החלטות מוצר סגורות — לא לפתוח מחדש ללא סיבה

- **F4:** חיילים לא פעילים נשארים בהיסטוריה; אינם נכללים במדדים/דוחות שוטפים למעט מסלולי היסטוריה מורשים למנהל.
- **F6:** סיכומים תפעוליים פרטניים מותרים רק לפי תפקיד, courseScope ובדיקות נראות בצד השרת. אנליטיקה נשארת GROUP ONLY.
- **F7:** `fitness.quality` נשאר admin-only (`config.edit`).

## הגבלות

מועמד QA מבודד בלבד. אין שימוש מבצעי, נתוני אמת או פריסה לייצור. בדיקות מקומיות אינן מוכיחות תקינות Apps Script/Sheets/Drive/LockService או תאימות Windows עד להרצה בפועל.
