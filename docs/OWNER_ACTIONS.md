# OWNER_ACTIONS — R5.2.16.4.4 (2026-11-19)

> Single source for numbers and statuses: `docs/R5_2_16_STATUS_MATRIX.md`. The root `OWNER_ACTIONS.md` is the Hebrew version of this file; both must say the same thing.

## Current state
- Candidate **R5.2.16.4.4** (status file `R5_2_16_4_4_CANDIDATE_STATUS.md`). **REV3 (privacy sub-cohort suppression, source + tests changed):** the previous 57/853 runs do NOT validate it. Rerun 2026-11-19 (Linux, exact Node v22.23.4, npm 10.9.9, Playwright 1.63.0, Chromium 153; pre-existing node_modules, no lock): strict run **59/59 suites, 880/880 tests PASS, 0 SKIP**, R5 focused 111/111, clean-machine 15/15, source identity 4/4, syntax 41/41 + inline scripts. Earlier independent QA (Node 22.16.0, no Chromium) predates REV3. This is Linux evidence, not a Windows clean-machine run. package-lock BLOCKED_NETWORK (intentionally absent). Windows 10, PowerShell preflight, screen readers, axe-core, devices, Google TEST: NOT_RUN. Production readiness: NOT APPROVED.
- **Product code:** versus R5.2.15 only `src/Index.html` and `src/FormPage.html` changed; all `.gs` files unchanged; `src/` is byte-identical since R5.2.16.1. R5.2.16.4.x changed only packaging/QA tooling (`scripts/lib/zipnode.js`, `scripts/clean_machine_verify.js`, their tests) and documentation.
- **Production readiness: NOT APPROVED.**

## Closed owner decisions — do not reopen
- **F4:** inactive soldiers remain visible in historical lists; they are excluded from current metrics/reports except explicitly permitted admin history/report paths.
- **F6:** operational individual-level summaries remain available under server-enforced role, course-scope and visible-soldier checks. GROUP ONLY remains mandatory for analytic outputs.
- **F7:** `fitness.quality` remains admin-only (`config.edit`); no commander permission expansion.

## Remaining owner / environment actions (in this order)
1. **Windows clean-machine validation — NOT_RUN.** Follow `docs/INSTALL_CLEAN_MACHINE.md` (preflight → real lock → `npm ci` → Playwright Chromium → `npm run check-env` → `npm run test:strict` → `npm run test:r5-focused`) and `docs/WINDOWS10_RUNBOOK_D7.md`. Record the observed suite/test counts; 57/850 are reference values, not thresholds. Node must be exactly v22.23.4 and npm 10.x.
2. **package-lock — BLOCKED_NETWORK.** Generate only on a connected trusted machine with real npm (`npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, or `sh scripts/generate_lock.sh` on POSIX), then `node scripts/check_lock.js` (must print `LOCK OK`), then `npm ci`. Never hand-write the lock.
3. **Google TEST — NOT_RUN.** Use the separate `MASLUL_2027_GOOGLE_TEST_TRANSFER_KIT_R10` staging kit for read-only clone, local backup, integrity verification and diff. It does not push or deploy. Do not run `clasp push`, `clasp deploy`, `setupDatabase()`, `migrateToV1()` or `installDailyTrigger()` without a separate explicit approval after reviewing the clone, backup and diff. Synthetic data only.
4. **Full regression — INCOMPLETE for release purposes** until step 1 is done on Windows with a real lock. The strict Chromium result above is creation-environment evidence only.
5. **Security and usability gates — NOT_RUN:** independent InfoSec review, accessibility (axe-core/Lighthouse), screen-reader testing (NVDA, VoiceOver, TalkBack, JAWS), physical iOS/Android checks, Safari/Firefox/Edge.
6. **D5_QA_SUPPLEMENT_v2.diff — NOT_RECEIVED**; its tests are not integrated unless the actual diff is supplied and reviewed.

## Release restriction
This is an isolated QA candidate only. No production data, production deployment, or operational use is authorized by these test results.
