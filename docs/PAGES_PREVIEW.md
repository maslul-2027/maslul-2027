# תצוגה מקדימה ציבורית (GitHub Pages) — סינתטית בלבד

כתובת: `https://maslul-2027.github.io/maslul-2027/` (נפרסת אוטומטית אחרי כל מיזוג ל-`main` שנוגע בתצוגה). **זו אינה אפליקציה עם נתונים משותפים** — אין שרת, אין התחברות, הנתונים נשמרים בדפדפן בלבד והם סינתטיים.

מה נבדק לפני כל פריסה (`.github/workflows/preview-pages.yml`):
1. בנייה משחזרת: ה-`preview/` שב-git שווה לבנייה טרייה.
2. `scripts/test_pages_scan.js` — בדיקות שלילית לסורק הפרטיות (מפתחות, URL של Apps Script, אימיילים/טלפונים אמיתיים, פנימיות אימות, סמלינקים, קבצים לא ברשימה).
3. `scripts/scan_pages_artifact.js` על תיקיית האתר הסופית: רק קבצים מרשימה סגורה; אין קוד שרת, צילומי מסך או חפצי CI.
4. `build-info.json` נחתם ב-SHA, וה-workflow בודק אחרי הפריסה שה-URL החי מגיש בדיוק את ה-SHA שנבדק (נכשל בגלוי אם לא).

**Rollback:** Actions ← "Deploy synthetic PWA preview" ← Run workflow, `ref` = SHA תקין קודם. אפשר לאמת ב-`<כתובת>/build-info.json`.

**לא נבדק מהסביבה שלי:** גישה חיה מטלפונים פיזיים וגישה לרשת הציבורית — זו בדיקת אישור ידנית של הבעלים/מנהל (פתיחת הכתובת בטלפון והשוואת ה-SHA ב-`build-info.json`).

## עדכון אחרי ביקורת המנהל (PR #62)
- **בדיקות לפני מיזוג:** `.github/workflows/pages-release-checks.yml` רץ ב-PR: בנייה משחזרת, 12 בדיקות הסורק, סריקת `preview/` האמיתי אחרי הכנה (staging), `scripts/test_pages_release.sh` (קבלה של main/קודמים, דחיית commit לא ממוזג/שם ענף/SHA לא קיים, staging רק מרשימה סגורה), ושה-head של ה-PR עצמו נדחה כ"לא ניתן לפרסום".
- **Rollback בטוח:** `ref` חייב להיות commit שכבר בהיסטוריית `main` (`scripts/assert_main_ancestor.sh`, נבדק לפני בנייה); ענפים/commits לא ממוזגים נדחים. ה-workflow רץ רק מ-`main` והכלים נלקחים מה-commit הנבדק של ה-workflow, לא מהיעד.
- **מה שמתפרסם:** רק `index.html, engine.js, sw.js, manifest.webmanifest, icon.svg, capabilities.json, build-info.json`. לעולם לא `server_public/`, `backend_next/`, סודות, צילומי CI.
- **Service Worker:** network-first (`cache:'no-cache'`), גרסת מטמון נפרדת — עדכון לא נתקע על גרסה ישנה; `build-info.json` נמשך מהרשת.
- **פעולת אדמין חד-פעמית (לא ניתנת לבדיקה מהסביבה שלי):** Settings ← Pages ← Source = **GitHub Actions**. הרצות פריסה קודמות הסתיימו ב-success, מה שמרמז שזה כבר מוגדר, אך אין טענת "חי" עד שה-job `deploy` עובר וה-`build-info.json` הציבורי מחזיר את ה-SHA ופתיחה מטלפון.
