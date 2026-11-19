# CHANGELOG_BATCH — product-dev6.2-uxqa1 (from product-dev6.1)
**src/ changed deliberately (ledger pinned by tests/src_identity.js):** added `Analytics.gs`, `EmergencyContact.gs`; changed `Attendance.gs, Code.gs, Config.gs (version), FormPage.html, Forms.gs, Index.html, Reports.gs`. No other src file differs from dev6.1 (SHA-256 verified).
- Attendance: contract fix, commander-scope counts, dynamic absent/early-exit picker, event detail, safe save feedback.
- Emergency contact: `EmergencyContact.gs` (admin-only, private table `SoldierPersonalDetails`, no schema change), profile section, create/edit fields, FormPage fieldset with pending approval.
- Analytics: `analytics.insights` (local, explainable, group level); dashboard panel.
- Reports: analytic A4 RTL layout, default PDF (`reports.preview`; `layout:'tabular'` for the alternative).
- UI: design tokens, right sidebar / mobile drawer, wrapping sub-nav, FormPage restyle.
- Tests: +13 Node (`uxqa_server.js`), +25 browser (`ui_uxqa.js`), +8 mutations (M201–M208); existing tests adapted deliberately: `ui_pd1` (nav expectation now stricter: no inner scroll + drawer), `ui_form`/`ui_staging_smoke` (3 extra emergency inputs), `uihelp.js` + meetings/qa helpers (open drawer first), `v1_pentest` CMD_OK (2 new read endpoints, justified), `src_identity` (delta ledger), `v1_system` (version).
- NOT changed: scoring, thresholds, attendance policy, privacy/retention, commander visibility rules, `Auth.assertAdminCaller_`, OAuth scopes (`src/appsscript.json` untouched), no network/CDN/LLM.

## Final completion pass (owner execution order 2026-11-15)
- D1–D6 implemented (see DECISIONS_RECORD_uxqa1.md). Changed: `Analytics.gs` (N=5, complementary suppression, active-only, new `reportData`), `Dashboard.gs` (overview/groups/home/compare suppression; `groupsRaw_` internal), `Reports.gs` (analytic default, `layout:'tabular'`, `include_inactive`, paginated achievements, exact page footers), `Index.html` (suppression states, page headers, dates, report screen order, tabular button labels).
- UX-03 dates, UX-04 page headers/states, RPT-02 pagination: see AUDIT_FINDINGS.
- Tests adapted (deliberate, decision-driven; assertions about *behaviour that the owner changed*): `v1_dashboard`, `v105_missing` (tiny scopes are suppressed rather than null-navigation), `v1_reports`, `v1_migration`, `ui_pd1` (empty course shows the privacy notice, no KPI tiles), `ui_fitness` (dates dd.mm.yyyy), `ui_r3` (message element `#tabMsg` of the tabular builder), analytic preview button renamed "צפייה בדוח האנליטי". No assertion was removed to obtain PASS.
- New tests: `uxqa_server.js` +9 (D1–D6, pagination, active-only, no external call); mutations M209–M214 (all CAUGHT); `pdf_validate.js` now checks declared pages == PDF pages, clipping, per-page footer, large fixture.
- `tests/src_identity.js` ledger + `tests/src_manifest_dev62.txt` regenerated (Dashboard.gs added).

## Final review patch (2026-11-16)
- PDF: new packed-page layout (see AUDIT RPT-02); `Reports.PAGE_PX/ACH_ROW_PX`, `ACH_ROWS` removed; chart/table fonts and sizes enlarged; `pdf_validate.js` also checks per-page fill (near-empty = fail) and clipping.
- UX: see AUDIT UX-04 pass 2. `Index.html` only (plus CSS).
- Docs/comments: `EmergencyContact.gs` and `Analytics.gs` headers now state the approved decisions D1/D2/D4/D5; README, INSTALL docs, AUDIT, QA, API contracts cleaned of "open decision" / "5-page" / `npm ci` claims.
- Tests adapted to the new layout (page counts are no longer fixed at 5): `uxqa_server` RPT-01 and D2 pagination, `ui_uxqa` report preview. Assertions now check count == sections == footer "מתוך N".

## D5 round — adversarial pass (2026-11-16/17)
No QA report / DIFF file from the independent reviewer reached this session (nothing was attached), so nothing of it was merged; the round consisted of self-initiated probing. Findings F1–F3 (AUDIT_FINDINGS) fixed in `src/`: **`Navigation.gs`** (`groupSummary` now public + suppression, `groupSummaryRaw_`, active-only default), **`Snapshot.gs`** (active-only default), **`Analytics.gs`** (`scopeGate_`), **`Code.gs`** (six `*.summary` routes through the gate), **`Index.html`** (suppressed rows in the navigation snapshot), `Reports.gs` (one value: `include_inactive` ⇒ `onlyActive:false`). src ledger: `tests/src_identity.js` + manifest regenerated (adds Navigation.gs, Snapshot.gs).
Tests: +4 in `uxqa_server.js` (F1, F1b, F2, F3); adapted for the approved decisions D2/D4 only: `stage3` (numeric group checks call `groupSummaryRaw_`; out-of-scope checks accept `null`; inactive-in-history assertion uses explicit `onlyActive:false`), `v1_migration` (raw), `ui_smoke` (suppressed snapshot text). Mutations M218–M221 added (one survivor M221 exposed a missing complementary-suppression test → test added → CAUGHT).

## D6 round — GROUP ONLY privacy fix (2026-11-17)
Cause: an independent QA found that the analytic report still carried per-soldier elements.
- `src/Analytics.gs` `reportData`: `achievements` is always `[]`, `scatter` = `{available:false, group_only:true, points:[]}`, `radar` = `[]`; the internal per-row array no longer carries index/name (used only for department/course aggregates). Header comment updated.
- `src/Reports.gs` `analyticHtml_`: removed the achievements table (and its row-splitting), the scatter section and the radar profiles; removed `scatterSvg_`, `radarSvg_`, `ACH_ROW_PX`; the "not included" list now states that no per-soldier table / scatter / radar exists. KPIs, completeness, insights, definitions, department/course comparison bars, trends, N=5 threshold and complementary suppression are unchanged. Tabular report, `include_inactive` and scoring/permissions/history unchanged.
- Tests: D2 pagination test rewritten for a LARGE GROUP report (12 departments x 6 soldiers; pages >= 2, count == sections == footer "מתוך N", no names / ids / personal numbers in html+data, achievements/radar/scatter points empty); new `PRV-GROUP-ONLY`, `PRV-ROUTES` (all 172 routes enumerated and classified; every aggregate route swept as admin and commander) and `RPT-ESC`; D3 compares decoded PDF strings (the fake PDF encodes the html length, equal string lengths made the old assertion fragile); `pdf_validate.js` large fixture is now 12 departments x 6 soldiers.
- Mutations: +M222–M226 (achievements / scatter points / radar / scatter available / personal ids in report html), M217 retargeted to the page packer (the achievements splitter no longer exists). Total 138.
- Counts: 795 tests (Node 587 + browser 208), 55 suites; 138 mutations.
- NOT integrated: `D5_QA_SUPPLEMENT_v2.diff` was not received (no such file in the session uploads). No test was invented in its name.

## D7 round — F6 closure + authorization audit (2026-11-17)
Owner decision: ANALYTICS = GROUP ONLY without exception; OPERATIONAL = admin everywhere, commander only inside courseScope; no new roles, no widened permissions, identity/scope server-side only.
- Audit of exams.summary, dash.overview.exams, readiness.summary, nav.groups, fitness.completion, fitness.quality: all already guarded server-side (`Records.guardCourse_` scope + Policy, `Soldiers.visibleFn_`). **No `src/` change** (source identity and `src_manifest_dev62.txt` unchanged vs D6).
- New `tests/d7_authz.js` (9 tests, suite 56): D7-MATRIX, D7-SPOOF, D7-SOLDIER-ID, D7-LEAK-F6, D7-GROUP-NAV, D7-ROUTE-MAP, D7-SWEEP-GROUP, D7-SWEEP-OPERATIONAL, D7-REPORT-PATHS. `tests/route_classes.json` = explicit class for each of the 172 routes (docs/ROUTE_MAP_D7.md). The recursive scan reads every nested array/object/key of every response.
- Sweep corrections of my first classification (no permission changed): ai.ask/ai.draft/ai.drafts -> O, settings.list and forms.generalLink -> N.
- Mutations +M227–M234 (guards of readiness/exams/dash.overview removed, fitness.quality opened to commanders, scope check widened, visibility filters removed). Total 146.
- New runbooks: GOOGLE_TEST_RUNBOOK_D7.md, WINDOWS10_RUNBOOK_D7.md, PACKAGE_LOCK_RUNBOOK_D7.md. Counts: 804 tests (Node 596 + browser 208), 56 suites.


## R5.2.1 — orphan emergency-contact recovery (2026-11-17)
- Reproduced compound failure: partial `pending:` emergency-contact rows can remain in `SoldierPersonalDetails` when staging fails and cleanup also fails. Synthetic-only reproduction; no Google data accessed.
- Added `EmergencyContact.reconcileOrphans(ctx, courseId, apply)` and API route `emergency.orphans` (class A / admin-only). Default is read-only preview; cleanup requires explicit `apply:true`. It scans only strict pending contact field keys, identifies groups with no request row anywhere, and deliberately skips request-ID collisions / mismatched request records.
- Cleanup blanks values and moves keys to `orphan_discarded:<requestId>:<rowId>`, verifies no matching pending key remains, records an audit intent before mutation and a completion audit after. Partial failures return `PENDING_RECONCILIATION_PARTIAL`; a later run can finish remaining rows. Audit payload contains counts only, never contact values.
- Added four focused recovery tests (preview + admin-only + valid-request preservation; pre-commit cleanup failure + retry; commit-then-lost-response + retry; ambiguous collision + audit failure). `tests/route_classes.json` and `docs/ROUTE_MAP_D7.md` now classify 173 routes; source identity ledger and dev6.2 manifest updated for intentional source delta.
- Targeted suites run: `v1_forms` 22/22, `uxqa_server` 29/29, `d7_authz` 9/9, `v1_pentest` 11/11, `v1_private` 6/6, `src_identity` 4/4, `v1_card` 2/2, `v1_reports` 3/3, `v1_backup` 4/4 = **90/90 PASS**. Syntax checks: `EmergencyContact.gs`, `Code.gs` PASS.
- Not run: full regression, Playwright/Chromium browser suites, Windows 10, Google TEST, Apps Script/Sheets/Drive/LockService real runtime, external InfoSec. Endpoint is backend-only in this candidate; no admin UI button added. Not approved for TEST write or deployment.

## 2026-11-18 — R5.2.2 approval integrity
- Added strict validation of emergency-contact staging rows before any part of a mixed soldier/contact request is applied.
- Rejects missing, empty, or duplicate pending contact rows with `EMERGENCY_CONTACT_INCOMPLETE`; request remains pending for admin review/rejection.
- Preserves safe retry after a previous attempt applied the canonical contact but stopped during pending-row cleanup; retry requires a resolved marker, a complete unique canonical set, and all remaining pending values matching canonical values.
- Added regression coverage for incomplete and duplicate staging, no partial ordinary-field application, and reject cleanup.
- Full Node regression: 618/618 passed, 44/56 suites executed, 12 browser suites skipped (Playwright/Chromium unavailable).


## R5.2.4 — duplicate request-ID ambiguity hardening (2026-11-18)
- `EmergencyContact.reconcileOrphans` now groups all `SoldierUpdateRequests` rows by ID instead of letting the last row overwrite earlier matches. Any duplicate ID is classified as ambiguous and is never cleanup-eligible, even if duplicate rows share course/soldier scope.
- Added regression test proving duplicate IDs cannot be classified by iteration order and no pending third-party data is cleared.
- No scoring, permissions, schema, retention, or deployment configuration changed.
