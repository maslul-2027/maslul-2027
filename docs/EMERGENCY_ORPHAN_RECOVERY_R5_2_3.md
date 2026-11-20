# Emergency-contact orphan recovery — R5.2.3

## Purpose
The admin-only recovery scan distinguishes three classes of pending emergency-contact staging rows:

1. **Unlinked orphan** — no `SoldierUpdateRequests` row exists for the request ID. These rows may be included in explicit cleanup after preview and confirmation.
2. **Healthy linked request** — matching course and soldier, request remains `pending`, payload contains `_emergency: "pending"`, and there is exactly one non-empty row for each of name, relation and phone. These rows are preserved and are not shown as cleanup candidates.
3. **Review required / ambiguous** — request ID exists but scope/soldier does not match, request is terminal, emergency marker is absent, or staged rows are incomplete, duplicated or malformed. These rows are reported as metadata only and are never auto-cleared.

## Admin UI
The `עדכוני פרטים מחיילים` tab contains a preview-first recovery card. It displays request IDs, soldier IDs and row counts only; it never renders contact names, relations or phone numbers. The cleanup button remains disabled until a preview identifies eligible unlinked orphan groups. Cleanup requires a browser confirmation and the server rechecks authorization and current state under the lock.

## Safety properties
- Server-side `private.write` authorization is required for preview and cleanup; commander access is denied.
- Cleanup targets only groups with no request row anywhere. Review-required and healthy linked groups are not mutated.
- Audit records contain counts and operation identifiers only, never contact values.
- Partial cleanup remains retryable: already-renamed rows no longer match the pending prefix, while remaining rows are rediscovered on the next preview.
- Preview does not mutate data.

## Verification limits
Node/in-memory tests cover classification, authorization, metadata-only output and retry behavior. They do not prove Apps Script LockService concurrency or browser behavior. Google TEST, Windows 10, Playwright/Chromium and external InfoSec remain unverified.


## R5.2.4 addendum — duplicate request identifiers
All request rows are now grouped by ID. If more than one request row has the same ID, every staging group with that ID is classified as ambiguous, regardless of whether duplicate rows have matching or conflicting metadata. Ambiguous groups are metadata-only and excluded from cleanup. This avoids iteration-order-dependent cleanup eligibility in a damaged/imported request table.
