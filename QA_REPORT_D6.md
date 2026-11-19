# QA_REPORT_D6 — GROUP ONLY privacy fix & release gate (2026-11-17)
Environment: Linux, Node v22.23.4, Playwright 1.63 / Chromium (real `page.pdf`), local Node harness. NOT Apps Script / Sheets / Windows 10. Synthetic data only.

## Defect and fix
Independent QA: the analytic report still returned/printed personal achievements, scatter points and radar profiles. Fixed in `src/Analytics.gs` and `src/Reports.gs` (see CHANGELOG_BATCH "D6 round"). N=5 threshold, complementary suppression, scoring, permissions and history are unchanged.

## Results
| Check | Result |
|---|---|
| `node tests/run_all.js --ui --strict` (raw: logs/final_strict.txt) | **PASS** 55/55 suites, 795/795 tests, 0 FAIL, 0 SKIP (Node 587 + Chromium 208). All UI suites ran in Chromium here (the independent QA could not run 12 UI suites in its environment). |
| Mutations (3 shards `--ui`, logs/mutation_*.log, logs/mutation_merged.json) | **138 — 138 CAUGHT, 0 SURVIVED, 0 NOT_APPLIED, 0 NOT_RUN** (new M222–M226; M217 retargeted). During the round M205 survived (names no longer in the report) -> new RPT-ESC test, now caught. |
| Leak checks: admin + commander, preview html/data, insights, dash.*, analytics.*, *.summary, nav.groups levels (names/ids/personal numbers) | PASS (`PRV-GROUP-ONLY`, `PRV-ROUTES`, D2) |
| All 172 API routes enumerated and classified (aggregate / per-soldier / config) | PASS; per-soldier routes are intentionally excluded from the leak sweep (they are the soldier screens); `v1_pentest` still sweeps every route against every role for authorization |
| Real PDF, all pages (pdf_samples/) | PASS: full 2 pages (fill 85/41 %), sparse 1 page, large 3 pages (79/61/58 %); no clipping, exact footers "עמוד i מתוך N"; PDF text grep for soldier names: none. Page 1 of "large" viewed. |
| Screens admin/commander 1280+390 (screenshots/) | captured, no JS error / horizontal overflow (generated before a comment-only edit in Analytics.gs) |
| Clean install / `npm ci` | **BLOCKED_NETWORK** — `package-lock.json` absent, never hand-written; `check_lock` exits 3 |
| Windows 10 clean install | **NOT_RUN** |
| Google TEST (G-01..G-07) | **NOT_RUN** |
| `D5_QA_SUPPLEMENT_v2.diff` | **NOT RECEIVED** — nothing integrated; please resend |

## Open items
F4 (inactive soldiers' records visible in history lists; owner decision), **F6** (operational summaries still list per-soldier status rows / the Navigation soldier list; owner decision — see AUDIT_FINDINGS), lock file, Windows 10, Google TEST, axe/Lighthouse/screen reader/real devices not run.

## Release recommendation
NOT ready for release. Locally all 795 tests and 138 mutations pass and the GROUP ONLY defect is closed, but Google TEST, Windows 10 and the lock proof are unrun, and F6 awaits a decision.
