# התקנה ובדיקת מועמד R5.2.16.4.4 על מחשב Windows 10 נקי

**סטטוס נוכחי (19.11.2026):** מקור המספרים והסטטוסים: `docs/R5_2_16_STATUS_MATRIX.md`. בקצרה: ריצת strict Chromium מלאה (59/59 suites, 880/880 בדיקות, אפס SKIP) עברה בסבב REV3 של 2026-11-19 (אחרי תיקון דיכוי תת-קבוצות) ב-Linux תחת Node v22.23.4 מדויק, ללא התקנה נקייה וללא lock; Node רחב 641/641, clean-machine 15/15, שער R5 ממוקד 111/111, source identity 4/4. מטרת מסמך זה היא לשחזר זאת על **Windows 10 נקי עם lock אמיתי** — עדיין NOT_RUN. סביבת ה-QA העצמאית (Node 22.16.0) אינה מקיימת את שער Node המדויק. `package-lock.json` חסר בכוונה (BLOCKED_NETWORK) ואסור לייצר אותו ידנית. PowerShell preflight, קוראי מסך, axe-core, מכשירים פיזיים ו-Google TEST: NOT_RUN. Production readiness: NOT APPROVED.

## 1. תנאים

- Windows 10 אמיתי או VM נקי ומהימן.
- PowerShell 5.1 ומעלה.
- Node **v22.23.4 בדיוק** ו־npm **10.x**.
- חיבור לרגיסטרי npm ול־Playwright CDN לצורך התקנת התלויות והדפדפן.
- נתוני בדיקה סינתטיים בלבד. אין להתחבר לפרויקט Google ואין לבצע פריסה במסגרת בדיקה זו.

## 2. אימות מקדים — ללא שינוי במחשב

ה-SHA-256 של ה-ZIP **אינו כתוב בתוך החבילה** (זה היה יוצר self-reference). הוא מופיע בהודעת המסירה החיצונית שליוותה את הקובץ. בהוראות להלן מסומן `<ZIP_SHA256_FROM_DELIVERY_MESSAGE>` — יש להחליף בערך בן 64 התווים מההודעה. אם הערך אינו בידיכם — עצרו.

הסקריפט `windows_preflight.ps1` נמסר **גם כקובץ עצמאי לצד ה-ZIP** (זהה בייט-לבייט ל-`scripts/windows_preflight.ps1` שבתוך החבילה), כדי שאפשר להריץ אותו לפני החילוץ. SHA-256 של הסקריפט: `aa3e4352d2f6e6015a36770f9f432eef384ef26bcfd0b42ba48e587f72dc653c`.

1. שמרו את ה-ZIP ואת `windows_preflight.ps1` באותה תיקייה ופתחו שם PowerShell.
2. ודאו את זהות הסקריפט:

```powershell
Get-FileHash .\windows_preflight.ps1 -Algorithm SHA256
```

   הערך חייב להיות `aa3e4352d2f6e6015a36770f9f432eef384ef26bcfd0b42ba48e587f72dc653c`.
3. הריצו (ללא חילוץ):

```powershell
.\windows_preflight.ps1 `
  -ZipPath .\MASLUL_2027_R5_2_16_4_4_FINAL_TEST_CANDIDATE.zip `
  -ExpectedSha256 <ZIP_SHA256_FROM_DELIVERY_MESSAGE>
```

הסקריפט בודק Windows 10, PowerShell 5.1+, Node v22.23.4 בדיוק, npm 10.x ו-SHA-256 של ה-ZIP. הוא read-only: אינו מחלץ ZIP, מתקין חבילות, משנה הגדרות או נוגע ב-Google. `PREFLIGHT: PASS` מאשר רק את סביבת הבסיס ואת זהות הקובץ — לא את תקינות המערכת.

בדיקת ה-hash אפשרית גם ידנית:

```powershell
Get-FileHash .\MASLUL_2027_R5_2_16_4_4_FINAL_TEST_CANDIDATE.zip -Algorithm SHA256
```

## 3. חילוץ והתקנת תלויות

1. חלץ את ה־ZIP לתיקייה חדשה וריקה. אל תחליף checkout קודם ואל תערבב קבצים בין גרסאות.
2. היכנס לתיקיית הפרויקט שבה נמצא `package.json`.
3. בדוק ש־`node_modules` ו־`package-lock.json` אינם קיימים.
4. צור lock אמיתי באמצעות npm (לא לערוך או לכתוב אותו ידנית). ב-Windows משתמשים בפקודת npm ישירות; `scripts/generate_lock.sh` הוא מקבילה ל-POSIX בלבד (שלוש הפקודות שבו: `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, `node scripts/check_lock.js`, `npm ci --dry-run`):

```powershell
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
node scripts/check_lock.js
```

`check_lock.js` חייב להחזיר `LOCK OK`. אם אין רשת, עצור וסמן `BLOCKED_NETWORK`; אל תמשיך כאילו ההתקנה הוכחה.

5. התקן בדיוק לפי ה־lock:

```powershell
npm ci
npx playwright install chromium
```

6. ודא שהסביבה מוכנה:

```powershell
npm run check-env
```

נדרש `ENV: OK`. אם לא התקבל, עצור ושמור את הפלט.

## 4. רגרסיה מלאה

```powershell
npm run test:strict
```

PASS מלא מחייב שכל 59 ה־suites יסתיימו ב־PASS, אפס FAIL, אפס SKIP, מספר בדיקות חיובי, וכל בדיקות הדפדפן הורצו. מספרי הבדיקות עצמם דינמיים: דווחו את מה שנצפה. ערך הייחוס מריצת Linux של R5.2.16.4.4 הוא 853 בדיקות (Node 627 + דפדפן 226) — לא סף קשיח, ולא תוצאת Windows. אין להשתמש במספרים ההיסטוריים 804/208 כסף. יש לשמור את הפלט המלא ואת `tests/last_run.json`.

בנוסף, הרץ את שער R5 הממוקד:

```powershell
npm run test:r5-focused
```

דווח בנפרד על הרגרסיה המלאה ועל הבדיקות הממוקדות; אין לספור אותן כאותו שער.

## 5. מה להחזיר לביקורת

- פלט `windows_preflight.ps1` ופרטי Windows/PowerShell/Node/npm.
- `package-lock.json` שנוצר על ידי npm, יחד עם תוצאת `node scripts/check_lock.js`.
- פלט `npm ci`, `npx playwright install chromium`, `npm run check-env` ו־`npm run test:strict`.
- `tests/last_run.json`.
- פלט `npm run test:r5-focused`.

אין לשלוח סיסמאות, cookies, OAuth tokens או מזהים/נתונים של חיילים. לפני העברת ה־lock, יש לוודא שאינו מכיל פרטי גישה (lock תקין לא אמור להכיל אותם).

## 6. גבולות והרשאות

- בדיקת Windows אינה בדיקת Google Apps Script, Sheets, Drive, LockService או טריגרים.
- אין להריץ `clasp push`, `clasp deploy`, `setupDatabase()`, `migrateToV1()` או `installDailyTrigger()` במסגרת זו.
- Google TEST הוא שער נפרד, עם clone, backup ו־diff, ודורש אישור נפרד לפני כל כתיבה.
- אין להשתמש בנתוני אמת ואין לפרוס לייצור.
- `--mutations` נתמך רק במסלול POSIX המתועד; הוא אינו חלק משער Windows.
- סביבה: Node v22.23.4 בדיוק (`.nvmrc`; שער ה-preflight וסקריפטי clean-machine דורשים זאת; `engines` ב-`package.json` הוא `>=22 <23` לפיתוח בלבד) ו-npm 10.x. אין להקל על השער.

## 7. פירוש תוצאות

| סטטוס | פירוש |
|---|---|
| PASS | רק אם כל שלבי השער המסוים הושלמו ועברו. |
| FAIL | בדיקה רצה ונכשלה או הסתיימה בשגיאה. |
| BLOCKED_NETWORK | לא ניתן להתקין/להוריד תלות בגלל רשת; אין להסיק הצלחה. |
| NOT_RUN | השלב לא הורץ בפועל. |
| INCOMPLETE | חלק מהבדיקות עברו אך לפחות שער נדרש לא הורץ. |

החבילה היא מועמד QA מבודד בלבד. אין כאן אישור שימוש מבצעי או פריסה.
