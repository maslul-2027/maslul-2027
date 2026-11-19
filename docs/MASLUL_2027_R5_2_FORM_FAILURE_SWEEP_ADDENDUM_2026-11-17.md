# MASLUL 2027 — R5.2 Form Failure Sweep Addendum
Date: 2026-11-17

## Scope
Extended the existing R5.2 isolated candidate with three additional fault-injection tests in `tests/v1_forms.js`. No application source (`src/`) was changed.

## New cases
1. Pending emergency-contact staging: second private-row insert commits and then throws. Verified cleanup leaves no `pending:` rows and no request row.
2. Approval apply: second canonical emergency-contact insert commits and then throws. Verified request remains pending; retry completes all three canonical fields and removes pending rows.
3. Approval cleanup: pending-row cleanup partially commits and then throws. Verified retry completes approval and the already-applied complete canonical contact remains intact, with no pending rows.

## Test results
- `tests/v1_forms.js`: 18/18 PASS (15 prior + 3 new).
- `tests/critical_commit_faults.js`: 6/6 PASS.
- `tests/v1_backup.js`: 4/4 PASS.
- `tests/v1_restore_fault.js`: 7/7 PASS.
- `tests/v1_migration.js`: 4/4 PASS.
- `tests/d7_authz.js`: 9/9 PASS.
- `tests/v1_pentest.js`: 11/11 PASS.
- `tests/v1_reports.js`: 3/3 PASS.
- `tests/v1_private.js`: 6/6 PASS.
- `tests/v1_card.js`: 2/2 PASS.
- Total focused suites: **70/70 PASS**.

## Integrity
- Rebuilt `SHA256SUMS` for the candidate package after modifying the test file and adding this addendum.
- `SOURCE_SHA256.txt` remains unchanged because no `src/` files changed.
- ZIP integrity and manifest verification are to be performed on the resulting archive.

## Not verified
Full integrated regression remains INCOMPLETE. Playwright/Chromium, actual Apps Script/Sheets/Drive/LockService, Google TEST G-01..G-07, Windows 10/PowerShell, and external InfoSec remain NOT_RUN / NOT_VERIFIED.

## Safety
Isolated QA candidate only. No Google project was accessed or modified. No push, deploy, migration, trigger installation, or real soldier data was used. Not approved for TEST write/deploy or operational use.
