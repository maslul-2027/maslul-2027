# R5.2.4 — Duplicate request-ID ambiguity hardening
Date: 2026-11-18

## Finding
The orphan recovery scan previously stored request rows in a single-value map keyed by request ID. If a damaged/imported `SoldierUpdateRequests` table contained duplicate IDs, the last row returned by the store silently overwrote earlier rows. Cleanup eligibility could therefore depend on sheet iteration order.

## Change
- Build a multi-value index of all request rows by ID.
- A staging group with no request row remains an eligible unlinked orphan candidate.
- A staging group with more than one request row sharing its ID is classified as ambiguous, regardless of whether duplicate rows agree on course, soldier, status, or payload.
- Ambiguous groups are never included in cleanup candidates.
- No contact values are returned in preview metadata.

## Regression
Added a test that inserts two request rows with the same ID and conflicting statuses/payloads, then verifies:
- preview reports one ambiguous group and zero cleanup candidates;
- response contains no staged contact values;
- explicit cleanup does not clear any of the three pending rows.

## Scope
Only `src/EmergencyContact.gs` and `tests/v1_forms.js` changed in this hardening increment. No schema, scoring, retention, role policy, or deployment settings changed.
