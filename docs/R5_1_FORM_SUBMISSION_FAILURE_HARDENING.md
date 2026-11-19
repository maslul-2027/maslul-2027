# R5.1 — Form submission failure hardening

Date: 2026-11-17
Scope: isolated R5 candidate only; synthetic Node/in-memory tests. No Google project was accessed.

## Confirmed defects addressed

1. `Forms.submit` staged three emergency-contact rows in the private store before inserting the request row. A failure during staging or request insertion could leave pending third-party personal data without a valid request.
2. If the request row committed but token consumption failed, a retry could create a second request.
3. If Audit logging failed after the request committed, the endpoint could report failure even though the request existed and the token had been consumed.

## Changes

- `EmergencyContact.stagePending_` now catches partial-write failures and clears any staged rows for that request. `discardPending_` blanks values, changes the field key to a non-pending tombstone, and verifies that no pending rows remain.
- `Forms.submit` now reads back a generated request ID after an insert exception to distinguish a failed write from a write-that-landed-before-the-error. It only discards staged private data when the request row is confirmed absent.
- `Forms.submit` uses `token_id` as a durable idempotency key. A replay of the same bearer token confirms the existing request rather than creating another request or another private-contact set. This confirmation also works after the token has been consumed.
- Token-consumption failure after request commit is represented as `token_status: reconciliation_required`; the durable request remains successful and replay-safe.
- Audit failure after request commit returns `received: true` with `audit_status: failed` and fixed `warning_code: FORM_AUDIT_WRITE_FAILED`; it does not falsely report that the submission itself failed.
- Review is idempotent for the same final decision. It applies only soldier fields that remain different, safely retries after a committed soldier-row update, reads back a request-status write that may have landed before throwing, and returns a warning rather than a false failure if review Audit fails after commit.

## Focused verification

| Suite | PASS | FAIL |
|---|---:|---:|
| `v1_forms.js` | 10 | 0 |
| `critical_commit_faults.js` | 6 | 0 |
| `v1_backup.js` | 4 | 0 |
| `v1_restore_fault.js` | 7 | 0 |
| `v1_migration.js` | 4 | 0 |
| `d7_authz.js` | 9 | 0 |
| `v1_pentest.js` | 11 | 0 |
| `v1_reports.js` | 3 | 0 |
| `v1_private.js` | 6 | 0 |
| `v1_card.js` | 2 | 0 |
| **Total** | **62** | **0** |

New fault cases include partial private-row staging failure, request insert failure, write-landed-then-threw, token-consumption failure, Audit outage after commit, review status-write failure after soldier update, and review Audit outage.

## Limits / disposition

- Full `tests/run_all.js` was attempted but exceeded the 180-second execution limit; result is `INCOMPLETE`, not PASS.
- Playwright and Chromium are missing; browser suites were not run.
- Apps Script, Google Sheets/Drive, LockService, deployment identity/access, Windows 10, Google TEST G-01..G-07, and external InfoSec review remain NOT_RUN/BLOCKED.
- This is an isolated candidate patch, not approved for TEST or production.
- D7 baseline remains immutable.
