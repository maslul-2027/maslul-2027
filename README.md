# MASLUL 2027

Hebrew RTL course-tracking web app (Google Apps Script + Sheets). This repository holds the source and the automated tests. It does **not** authorize public access to the web app or its data — see `SECURITY.md`.

- `src/` — Apps Script sources (`*.gs`) and the single-page UI (`Index.html`)
- `tests/` — Node + Playwright suites (`npm run test:ci`; Node 22, Playwright 1.63.0)
- `test_only/` — manifest for the personal TEST project (access MYSELF); `src/appsscript.json` is the production-style manifest
- `docs/` — status, decisions, privacy exception register, deployment plan (deployment is disabled), Google TEST smoke + rollback plan

Work happens on feature branches via pull requests (never directly on `main`). Synthetic data only.
