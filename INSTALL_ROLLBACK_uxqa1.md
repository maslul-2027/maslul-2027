# Install / rollback status — R5.2.16.4.4 candidate (2026-11-19)

> **STOP: this is not an installation or rollback authorization.** No R5 upload, setup, migration, trigger installation, or deployment has been performed or approved.

## Current permitted step
Use only `MASLUL_2027_GOOGLE_TEST_TRANSFER_KIT_R10` for a read-only `clasp clone`, local backup, backup integrity verification, candidate staging, and SHA-256 content diff. Follow `docs/GOOGLE_TEST_RUNBOOK_D7.md` and `OWNER_ACTIONS.md`. The transfer kit deliberately does not execute `clasp push`, `clasp deploy`, `setupDatabase()`, `migrateToV1()`, or `installDailyTrigger()`.

## Rollback status
No R5 rollback has been executed or validated against real Apps Script, Sheets, or Drive. Do not assume the historical D7 rollback instructions are valid after R5 has created backup jobs, prune states, or run migration. Before any future write operation, preserve the exact current TEST source and data, export and inspect state, and approve a state-aware rollback plan separately.

## Historical notes
The D5/D6/D7 installation and rollback notes below are retained only as historical evidence. They are not current operating instructions and their old test totals are not R5 acceptance results.

## Verification gates (authoritative numbers: `docs/R5_2_16_STATUS_MATRIX.md`)
- Candidate **R5.2.16.4.4** (status file `R5_2_16_4_4_CANDIDATE_STATUS.md`). Independent QA (Node 22.16.0 / npm 10.9.2 — does **not** satisfy the exact Node v22.23.4 gate; Playwright/Chromium unavailable): ZIP integrity PASS, clean-machine 15/15, R5 focused 97/97, broad Node 627/627 (45/57 suites; 12 browser suites skipped — not a full regression). Reconciliation run 2026-11-19 (Linux, exact Node v22.23.4, npm 10.9.9, Playwright 1.63.0, Chromium 153; pre-existing node_modules, no lock): strict run **57/57 suites, 853/853 tests PASS, 0 SKIP**, source identity 4/4, syntax 41/41 + 3/3. This is Linux evidence, not a Windows clean-machine run. package-lock BLOCKED_NETWORK (intentionally absent). Windows 10, PowerShell preflight, screen readers, axe-core, devices, Google TEST: NOT_RUN. Production readiness: NOT APPROVED.
- Real Apps Script / Sheets / Drive / LockService behavior: NOT_VERIFIED. External InfoSec: NOT_RUN. Earlier figures (52/52, 850/850, 13/13, 14/14) are historical.
