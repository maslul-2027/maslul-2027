> **HISTORICAL D7 EVIDENCE ONLY.** The 804/804 and 56/56 results below are not R5 results. Current R5 status is in the addendum and `OWNER_ACTIONS.md`.

# QA_REPORT_D7 — F6 closure, authorization audit, release gates (2026-11-17)
Environment: Linux, Node v22.23.4, Playwright/Chromium; local Node harness (in-memory Db, faked identity). NOT Apps Script / Sheets / Windows. Synthetic data only.

## Outcome
The six F6 routes were audited and were already authorized server-side; **no production code changed** (src identical to D6). Evidence = 9 new tests + 8 new mutations + explicit route map.

## Results
| Check | Result |
|---|---|
| `node tests/run_all.js --ui --strict` (logs/d7_strict.txt) | **PASS** 56/56 suites, **804/804** tests, 0 FAIL, 0 SKIP (Node 596 + Chromium 208) |
| Mutations (3 shards `--ui`; logs/mutation_*) | **146/146 CAUGHT**, 0 SURVIVED, 0 NOT_APPLIED, 0 NOT_RUN (incl. M222–M226 and new M227–M234). During the round M230/M232 first survived (they removed one of 2–3 redundant scope checks); they were retargeted to the visibility logic and are caught. A double-removal experiment (both redundant guards removed) made D7-MATRIX/SPOOF/SWEEP fail, i.e. the tests are sensitive. |
| Authorization matrix, 6 routes, direct API calls (D7-MATRIX) | PASS: ADMIN both courses; COMMANDER in scope ok (fitness.quality: refused, admin-only); out of scope FORBIDDEN with no body; unknown / inactive / empty identity refused |
| Spoofing role/email/courseScope/ctx/nested courseId (D7-SPOOF), foreign soldier_id (D7-SOLDIER-ID) | PASS |
| Leak scans, recursive over every array/object/key: dash.overview, nav.groups (group levels), fitness.completion/quality, exams/readiness summaries | PASS; non-vacuity asserted (admin sees all soldiers, team commander a strict non-empty subset) |
| 172-route classification (docs/ROUTE_MAP_D7.md) | PASS: every route classified G/O/P/A/N; G+N swept for soldier identity (admin + 4 commanders × 6 argument shapes); A refused to every commander; O/P refused out of scope and limited to visible soldiers |
| GROUP ONLY on all analytic report paths, N=5 suppression, complementary suppression | PASS (D7-REPORT-PATHS + uxqa_server D1–D6, PRV-*) |
| Real PDF (pdf_samples/) | PASS: full 2 pages, sparse 1, large 3; no clipping; exact footers |
| Performance, 60/300/1000 synthetic soldiers (perf/perf.json, run on an idle machine) | insights 11/21/85 ms, analytic preview 16/35/120 ms, html 7 KB (Node in-memory, not Sheets) |
| ZIP integrity, SHA256SUMS, SOURCE_SHA256 | see the delivery message and SHA256SUMS |
| Screenshots | reused from D6 (src unchanged); not regenerated |
| Google TEST G-01..G-07 | **NOT_RUN** (runbook ready) |
| Windows 10 clean install | **NOT_RUN** (runbook ready) |
| package-lock.json | **BLOCKED_NETWORK** (runbook ready; check_lock exit 3) |

## Limits of the sweeps
Write routes of classes O/P/A are classified but not called with real payloads by the sweeps (they would mutate the fixture); their authorization is covered by v1_pentest (every route × every role × unknown/inactive/empty identity), domain suites and M227–M234. Classification is the author's; the owner should review docs/ROUTE_MAP_D7.md.

## Open (historical D7 snapshot; not current owner-decision status)
At the time of the D7 report, F7 and F4 were listed as open. They were subsequently closed by owner decision in the R5 project record (`OWNER_ACTIONS.md`). Remaining current gates: Google TEST, Windows 10, package-lock, `D5_QA_SUPPLEMENT_v2.diff` (not received in this session), axe/Lighthouse/screen reader/real devices.
Release recommendation: NOT ready for release; ready to START Google TEST on synthetic data.


## R5 candidate addendum (2026-11-17; separate from historical D7 result)
The 804/804 and 56/56 figures above describe the historical D7 run, not the integrated R5 candidate. R5 changes `Backup.gs`, `Migration.gs`, `Adapters.gs` and `Index.html`. Latest local rerun of the four focused R5 repair suites: 21/21 PASS. Additional targeted API/authz/pentest/UI compatibility suites: 31/31 PASS (52/52 across seven targeted suites). A full integrated R5 regression was attempted in the current environment but exceeded the 10-minute execution limit without a complete summary; status **INCOMPLETE / NOT PASS**. Playwright and Chromium are missing in this environment. Google TEST, Windows 10, InfoSec, accessibility and physical-device checks remain NOT_RUN.
