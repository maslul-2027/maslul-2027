# MASLUL 2027

מערכת ניהול מסלול — ממשק עברי RTL, חניכים, מפקדים, מעקבים, מדדים ודוחות.

**בעל המוצר:** המשתמש · **מנהל הפיתוח והקבלה:** ChatGPT · **מפתח ראשי:** Claude Code.

## נקודת הכניסה לצוות

- [חוזה ניהול וביצוע — מהדורת 20.11.2026](docs/PROJECT_MANAGEMENT_CONTRACT.md)
- [לוח המשימות וסדר השחרור להיום](docs/TODAY_EXECUTION_BOARD_2026-11-20.md)
- [עיצוב הזהב המקורי — PR #10](https://github.com/maslul-2027/maslul-2027/pull/10)
- [הנחיות UX וחסמי שימוש אמת](docs/RESTORE_ORIGINAL_UX_AND_TODAY_RELEASE_GATES.md)
- [החלטות הבעלים העדכניות](docs/OWNER_CURRENT_CHARTER_2026-11-20.md)
- [מיפוי 174 פעולות API](docs/capability-inventory.json)
- [שערי שלמות/Parity](docs/FEATURE_PARITY_GATE.md)
- [לוח התיאום החי — Issue #28](https://github.com/maslul-2027/maslul-2027/issues/28)
- [סביבת הדגמה ציבורית סינתטית](https://maslul-2027.github.io/maslul-2027/)

> **אזהרה:** GitHub Pages היא סביבת הדגמה עם נתונים מומצאים. אין להזין נתוני אמת/חיילים או מידע פרטי; אין לטעון שמערכת מבצעית מוכנה בלי בדיקות ואישורי אבטחה/ארגון.

## מבנה טכני

Hebrew RTL course-tracking web app (Google Apps Script + Sheets). This repository holds the source and the automated tests. It does **not** authorize public access to the web app or its data — see `SECURITY.md`.

- `src/` — Apps Script sources (`*.gs`) and the single-page UI (`Index.html`)
- `tests/` — Node + Playwright suites (`npm run test:ci`; Node 22, Playwright 1.63.0)
- `test_only/` — manifest for the personal TEST project (access MYSELF); `src/appsscript.json` is the production-style manifest
- `docs/` — status, decisions, privacy exception register, deployment plan (deployment is disabled), Google TEST smoke + rollback plan

Work happens on feature branches via pull requests (never directly on `main`). Synthetic data only.
