# MASLUL 2027 — R5.2.16.4.4 Candidate Status

Status: FINAL TEST CANDIDATE (personal-Gmail TEST stage, owner approval required before any Google action) — NOT RELEASE APPROVED
Base: R5.2.16.4.3.

Change scope: `project/scripts/lib/zipnode.js` and `project/tests/stg_clean_machine_script.js`, plus status/manifest documentation. Application `src/`, scoring, authorization, data schema, Google integration, and Windows preflight logic are unchanged.

Security fix: decompression now uses zlib's `maxOutputLength` ceiling before output allocation, bounded by both the per-entry limit and remaining total extraction budget. The extractor also validates compressed-data bounds before reading/inflating. This closes the forged-central-directory-size case where a ZIP entry declared a tiny uncompressed size but expanded to a much larger payload before the previous post-decompression check.

Verified locally on 2026-11-18:
- Focused clean-machine script suite: PASS 15/15.
- Product source identity: PASS 4/4.
- Changed JavaScript syntax: PASS.
- Windows 10 execution: NOT_RUN.
- Full strict/browser regression: NOT_RUN.
- Google TEST: NOT_RUN. Production: NOT APPROVED.

Use synthetic data only. Do not deploy, push, or connect to Google TEST without separate explicit approval. The candidate must first pass clean Windows 10 installation and full strict/browser regression.


## 2026-11-19 — documentation reconciliation & QA closure (still R5.2.16.4.4)
No code, test, script or configuration change; the version label is unchanged (single authoritative version: R5.2.16.4.4). Active documents (README, both OWNER_ACTIONS, docs/R5_2_16_STATUS_MATRIX.md, INSTALL_CLEAN_MACHINE, WINDOWS10_RUNBOOK_D7, GOOGLE_TEST_RUNBOOK_D7, INSTALL_ROLLBACK_uxqa1 ×2, DOCUMENT_STATUS_INDEX) were aligned to it; older 4.x status files are history only.

| Gate | Status |
|---|---|
| ZIP integrity | PASS |
| Clean-machine script suite | PASS 15/15 |
| R5 focused gate | PASS 124/124 (12 suites; not a full regression) |
| Broad Node suites | PASS 654/654 |
| Source identity | PASS 4/4 (`src/` changed deliberately in REV3; ledger + manifests regenerated) |
| Syntax (41 `.gs`, 3 inline scripts) | PASS |
| Strict Chromium regression (Linux, exact Node v22.23.4, Chromium 153) | PASS 59/59 suites, 880/880 tests, 0 SKIP (run on the FINAL tree; earlier runs do NOT validate it) |
| package-lock / `npm ci` | BLOCKED_NETWORK (intentionally absent) |
| Windows 10 clean machine / PowerShell preflight | NOT_RUN |
| Google TEST | NOT_RUN |
| Production | NOT APPROVED |

Details: `docs/R5_2_16_STATUS_MATRIX.md`.


### REV3 (2026-11-19) — privacy sub-cohort suppression
Source + tests changed (see `CHANGELOG.md`): D2 (MIN_GROUP = 5) now also applies to sub-cohorts inside a larger scope (have/missing, scored/unscored, present/absent, early exit, active/inactive); either side 1-4 distinct soldiers => both counts suppressed with a generic reason. New suite `r5_privacy_subcohort` (14 tests); suite count 57 -> 58. Google runtime: NOT_RUN; Windows 10: NOT_RUN; production: NOT APPROVED. Personal-Gmail TEST stage keeps `test_only/TEST_ONLY_appsscript.MYSELF.json`.

### REV2 (2026-11-19) — QA correction
Documentation/comment-only: stale ZIP identity removed from the status matrix (final ZIP SHA/size are in the external delivery message only); `windows_preflight.ps1` Usage comment now names `MASLUL_2027_R5_2_16_4_4_DOCUMENTATION_RECONCILED_CANDIDATE_REV2.zip` (runtime unchanged). Version label remains R5.2.16.4.4. Windows 10, Google TEST, live Apps Script services: NOT_RUN; production: NOT APPROVED.


### FINAL TEST CANDIDATE (2026-11-19) — closure of the D2 rounds
Source + tests changed (see `CHANGELOG.md`, top section): `readiness.summary` split into a group route and the operational `readiness.notEntered`; alert counts, `dash.groups`, `monthly_`, report bars, the group-gap insight and `attendance.events` brought under the sub-cohort rule; min/max removed from the fitness distribution. Exceptions: `docs/PRIVACY_EXCEPTION_REGISTER.md`. Google TEST plan + rollback: `docs/GOOGLE_TEST_SMOKE_AND_ROLLBACK_PLAN.md`. Windows runtime: NOT RUN. Google runtime: NOT RUN. Production: NOT APPROVED.
