# R5.2.2 — Emergency-contact approval integrity
Date: 2026-11-18

## Change
Approval of a SoldierUpdateRequest carrying the `_emergency` marker now validates the private staging rows before applying any ordinary soldier-field changes.

The approval path requires exactly one non-empty row for each approved emergency-contact field: name, relation, and phone. Missing, empty, or duplicate rows produce `EMERGENCY_CONTACT_INCOMPLETE`; the request remains pending and no ordinary soldier fields are applied. An administrator can reject the request to clear the staged values.

## Retry behavior
A prior approval attempt may have applied the complete canonical emergency contact and then failed while moving pending rows to `resolved:<requestId>`. A retry is accepted only when:
- at least one `resolved:<requestId>` marker exists;
- the canonical contact has exactly one non-empty row for each of the three fields; and
- every remaining pending row is unique and matches its corresponding canonical value.

In that narrowly defined state, the canonical values are treated as already applied and the remaining pending rows are cleared. Ambiguous or conflicting data remains blocked for administrator review.

## Tests
- New regression: incomplete pending field blocks approval before any ordinary soldier-field update.
- New regression: duplicate pending field blocks approval.
- New regression: rejection still clears all pending rows.
- Existing regression: retry after partial pending-row cleanup preserves the already-applied complete contact.
- Full Node regression: 618/618 tests passed, 44/56 suites executed, 0 failures; 12 browser suites skipped because Playwright/Chromium are unavailable.

## Boundaries
- Changes are limited to `src/EmergencyContact.gs`, `src/Forms.gs`, and tests/metadata.
- No schema migration.
- No Google TEST or production project was accessed or modified.
- No real soldier data was used.
- Browser UI, Windows 10, real Apps Script/Sheets/LockService, and external InfoSec remain NOT RUN.
- This is an isolated candidate, not an approved deployment.
