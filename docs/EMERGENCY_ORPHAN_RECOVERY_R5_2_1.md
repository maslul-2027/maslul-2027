# Emergency-contact orphan recovery — R5.2.1

**Status:** isolated QA candidate only. Do not run against production or real soldier data.

## Why this exists
A compound storage failure can leave `pending:<requestId>:<field>` rows in `SoldierPersonalDetails` without a corresponding `SoldierUpdateRequests` row. The row values are third-party sensitive contact data. This recovery tool is designed for synthetic TEST verification and ADMIN-only use.

## API contract
- `emergency.orphans` with `{ courseId }` is a read-only preview.
- `emergency.orphans` with `{ courseId, apply: true }` performs explicit cleanup.
- Server identity is derived by `Auth.context()`; client role/email fields are ignored. `Private.guard_(ctx, 'private.write', courseId)` keeps the action ADMIN-only.
- Response includes request ID, soldier ID and row counts for ADMIN maintenance; it never includes contact field values.
- Groups with no matching request row are candidates. If a request ID exists but belongs to a different course/soldier, it is treated as ambiguous and skipped. Valid pending requests are preserved.

## Cleanup behavior
- Values are blanked and field keys move to `orphan_discarded:<requestId>:<rowId>`.
- An audit intent with counts only is written before mutation. A completion audit is written after successful verification.
- If a write fails, the endpoint returns `PENDING_RECONCILIATION_PARTIAL`; run a fresh preview and retry after the storage problem is resolved. Already-cleared rows are not reintroduced.
- Audit failure after successful cleanup returns success with `audit_status: failed` and `EMERGENCY_ORPHAN_AUDIT_WRITE_FAILED`; do not repeat cleanup to try to restore anything.

## Important limitations
- This is a backend API endpoint; no admin UI button is included in R5.2.1.
- Node in-memory tests do not prove Google Sheets / Apps Script runtime behavior.
- Before any Google TEST write, require a separate review of the TEST clone, backup, diff and explicit owner approval.
