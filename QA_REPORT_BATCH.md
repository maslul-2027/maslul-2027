# QA_REPORT_BATCH — product-dev6.2-uxqa1 (D5 round: adversarial pass on top of the final review patch, 2026-11-17)
**Scope note:** the independent reviewer's QA report and DIFF were announced but did NOT arrive (no attachment in the conversation); nothing from them was merged. This round is self-initiated probing; the two reviewer tests, when delivered, are still to be integrated (tests only).
Status vocabulary: PASS / FAIL / BLOCKED / NOT_RUN / STATIC_ONLY. Environment: Node v22.23.4, Playwright 1.63.0, Chromium 153, **local Node harness + Chromium with synthetic data only. Nothing ran on Google (Apps Script, Sheets, Drive, HtmlService PDF).** The numbers below are copied from logs/final_strict.txt and logs/mutation_merged.json of this package.

## Results
| Check | Result |
|---|---|
| `node tests/run_all.js --ui --strict` | **PASS** — 55/55 suites, **795/795 tests**, 0 FAIL, 0 SKIP (Node 587: unit 90, integration 276, hardening 188, unclassified 30; Chromium UI 208) |
| Mutation tests (`scripts/mutation_run.js --ui`, 2 shards) | **138 mutations — 138 CAUGHT, 0 SURVIVED, 0 NOT_APPLIED, 0 NOT_RUN** (incl. M209–M217 and new M218–M221 for F1–F3). Honest history: M221 first SURVIVED (no complementary-suppression test for nav.groups) → test F1b added → CAUGHT; M210 became an equivalent mutant after the Snapshot default change in F2 and was re-targeted and re-run (CAUGHT) — logs/mutation_merged.json marks it |
| Privacy / permission / unauthorized access | PASS — `v1_pentest` (real-id sweep, every API route against every role), `uxqa_server` D1 (every commander scope refused for emergency get/set), D2 (no count/name/total leak from insights, preview HTML, overview, groups, home, filtered insights), D4 (`include_inactive` refused for commander, invalid type refused), D6 (out-of-scope attendance refused) |
| All screens, Desktop 1280 + Mobile 390 | PASS (no JS error / no horizontal overflow; visual review of the main screens, not of every one of the 46 captures) — screenshot sweep of every screen: admin 27, commander 19, at both widths; 0 JS errors, 0 horizontal overflow (screenshots/final_*.log.json); UI suites also run both widths |
| PDF, all pages (real Chromium `page.pdf`, A4 594.96×841.92 pt; page images in pdf_samples/) | PASS — **full 3 pages** (body fill 96 / 82 / 38 %), **sparse 1 page** (a single notice-only page, 11 % fill — nothing more exists to show), **large (70 extra soldiers) 6 pages** (fill 79 / 98 / 94 / 75 / 82 / 56 %). Declared pages == PDF pages; no clipped page; footer "עמוד X מתוך N" verified per page from the PDF text; no NaN/undefined; RTL. Before the patch: full 5 pages with 2 pages ≈ half empty and tiny charts. pdf_samples/pdf_validation.json |
| Clean install (`scripts/clean_machine_verify.*`, `npm ci`) | **BLOCKED_NETWORK** — see below |
| Windows 10 clean install | **NOT_RUN** — the build environment is Linux; see OWNER_ACTIONS #5 |
| Google (G-01..G-07) | **NOT_RUN** |
| Adversarial probing (this round) | 3 real defects found and fixed (F1–F3), 1 open question (F4), see AUDIT_FINDINGS. Probes: sweep of 41 read routes for inactive soldiers; sweep of the aggregate routes as a 2-soldier commander; code search for group aggregations outside Dashboard/Analytics |

## Clean install / package-lock — BLOCKED_NETWORK
The environment has no access to the npm registry (`ENOTCACHED`), so `package-lock.json` cannot be generated, and it is not written by hand. `npm run check-lock` returns exit 3 = BLOCKED (not PASS). The extracted package does run offline here with the already-installed Playwright (clean-extract run of the whole suite: see logs/clean_extract_strict.txt). Owner step: OWNER_ACTIONS.md #2.

## Tests adapted because of the owner's decisions (not to obtain PASS)
v1_dashboard, v105_missing, v1_reports, v1_migration (small scopes are suppressed, D2), ui_pd1 (empty course shows the privacy notice), ui_fitness (dd.mm.yyyy), ui_r3 (`#tabMsg`); final review patch: uxqa_server RPT-01 and D2 pagination, ui_uxqa report preview (page count is no longer fixed at 5). Each changed assertion tests the new, approved behaviour; none was deleted or loosened — details in CHANGELOG_BATCH.md. Mutation testing earlier found 3 weak tests in my first draft; they were strengthened.

## New tests
uxqa_server.js (26 Node: attendance contract, emergency, analytics, D1–D6, pagination, active-only), ui_uxqa.js (25 browser), pdf_validate.js, perf_fixtures.js, mutations M201–M214.

## Performance (Node in-memory, not Sheets latency)
60 / 300 / 1000 soldiers → insights 7 / 25 / 88 ms; analytic preview 10 / 38 / 172 ms (perf/perf.json, measured before the packer change; the packer adds O(blocks) work only — not re-measured).

## NOT run / limits
Google deployment, Drive/HtmlService PDF engine (SVG support unknown — G-04) · real devices · axe/Lighthouse (no network) · screen-reader testing · contrast ratios by hand only (STATIC_ONLY) · Sheets latency · `package-lock.json` + `npm ci` proof (BLOCKED_NETWORK) · UX-04: two passes of shared-component redesign (see AUDIT_FINDINGS UX-04), not a bespoke layout per screen; no UI test of the new behaviours "show more" (tables > 25 rows) and the collapsible soldier filter beyond the existing suites passing; no new tests were added in this patch for UX/PDF other than the adapted ones and 3 mutations.

## D5 round — what changed in `src/` (delta vs the previous ZIP)
Navigation.gs, Snapshot.gs, Analytics.gs, Code.gs, Index.html, Reports.gs (one value). Details: CHANGELOG_BATCH.md. Tests adapted for decisions D2/D4 only: stage3, v1_migration, ui_smoke; uxqa_server +4.
## Remaining failures
None in the executed suites. Not executed: Windows 10 clean install, Google G-01..G-07, real devices, axe/Lighthouse, screen reader, package-lock/`npm ci` (BLOCKED_NETWORK).
## Release recommendation
**Not released to production — "ready for a Google TEST-project trial only", conditional.** Reasons it is not "ready for release": (1) nothing has run on Google (G-01..G-07 NOT RUN; PDF/SVG rendering in Apps Script is unverified); (2) no Windows 10 / clean-install proof for this version and no lock file; (3) this round found 3 real privacy/semantics defects with an existing test suite that had passed — evidence that further D2/D4 gaps may exist outside the probed surfaces (record lists F4, OCR/forms/export paths were only code-searched); (4) the independent QA's own findings are not yet integrated. Recommended next steps in order: integrate the reviewer's tests → Windows clean-install run → Google TEST trial G-01..G-07 with synthetic data → owner decision F4.


## Status note — superseded by D7 / R5 candidate evidence
This report is the historical D5/dev6.2 QA round (795 tests / 55 suites / 138 mutations). It is not the current R5 integrated-candidate report. D7 later reported 804 tests / 56 suites / 146 mutations, but those are historical D7 results and do not prove R5. R5 targeted synthetic suites are 52/52 PASS across seven suites (21 repair + 31 API/authz/pentest/UI compatibility); full integrated R5 regression remains INCOMPLETE. See `QA_REPORT_D7.md` addendum and the R5 integration audit.
