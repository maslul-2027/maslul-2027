# Unified app (owner charter 2026-11-20): what is connected and what is not

`preview/index.html` is now ONE app: the real legacy UI (`src/Index.html`, UX sprint 1) + the real server code (`src/*.gs`) running **inside the page** against ONE synthetic store (browser storage). It is a build output: `node scripts/build_synthetic_app.js --pwa` (guarded by `tests/preview_fresh.js`). Public GitHub Pages, **synthetic only, no login, no real data**.

## Owner contract (PR #33 `scripts/test_unified_mobile_contract.cjs`, run unchanged)
- no iframe / app-in-app; exactly 4 primary mobile tabs in `<nav aria-label="ניווט ראשי">` (בית / חיילים / הזנה ומעקב / ניהול); no second roster/tasks/attendance store; RTL; aria labels.
- The four tabs only choose the area. Inside an area the existing group strip and screen tabs remain; the drawer (#menuBtn) lists every area and screen, so **no function was removed**.
- Area map: **בית** = dash + התראות ודוחות · **חיילים** = חיילים/טפסים/פרטי מ״פ/מסמכים · **הזנה ומעקב** = כשירות ומדדים, נוכחות ואירועים, ישיבות ומשימות · **ניהול** = שיוך, ייבוא, OCR, עוזר, הגדרות, קורסים, גיבוי. The tab remembers the last screen per area.

## Connected (evidence)
- All screens/data-entry of the legacy app run on the real server logic (validation, permissions, scoring, privacy gates D2, meetings/tasks, idempotency). Browser tests: `ui_synthetic_app` (add soldier through the real form, duplicate refusal, persistence, reset, all data-entry areas open, no external request), `ui_ux_sprint1` (4-area navigation, 360/390 layouts), 60 legacy UI/Node suites.
- 174 API actions: 128 have a literal UI call site (`docs/ui-source-comparison.json`); 46 have none (same set as PR #17).

## NOT connected / not verified (do not count as done)
- **Google-service routes** answer `NOT_CONNECTED` ("טרם חובר להדגמה") instead of failing: confirmed by runtime probe with empty arguments for `backup.create`, `migration.run` (`docs/unified-app-route-status.json`). By static analysis the same applies to anything that reaches `Adapters` (Drive files, PDF/XLSX export, preflight, OCR provider): `backup.*`, `docs.upload/download/...`, `reports.generate/download/fullExport`, `preflight.run`, `ocr.start`. The empty-argument probe returns validation errors first for many routes, so "server logic runs" for 172/174 means **the route answers**, not that every workflow was exercised with real arguments.
- **Operational app independent of Google, PIN login, owner read-only viewer**: only `backend_next/pin_auth.js` (not wired); this app has NO authentication (single synthetic admin).
- Roles in this build: single synthetic admin; commander/viewer role switching is not offered in the public preview.
- Soldier Google Form flow, OCR provider, Drive documents, real backups: need Google/another approved backend.
- Group-only analytics rules are enforced by the server code (D2/N≥5) and its tests; no new analytics screens were added.
- Real-device checks (iPhone Safari/Android), Lighthouse performance numbers, and screen-reader runs were not performed; layout is covered only by Chromium at 360/390 px.
- `preview/course.html`, `course-engine.js`, `design.css`, `course-design.css` (previous demo engine, built by `preview-pages.yml`) are no longer linked from `index.html`; they are still deployed and should be removed in a follow-up so only one data source exists.

## Rollback
Revert the commit that regenerated `preview/index.html` (and `sw.js` cache v12): the previous demo returns at the next Pages deployment.
