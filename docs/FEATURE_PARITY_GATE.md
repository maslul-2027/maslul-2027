# MASLUL 2027 — feature parity acceptance gate

This inventory is extracted from the `API_` whitelist in `src/Code.gs` on `claude/import-r5-2-16-4-4-final`, not from the public Pages demo. See [capability-inventory.json](./capability-inventory.json).

## Evidence
- 174 named API methods in 39 prefixes.
- The public `preview/` app is a synthetic, client-only UX prototype. It does **not** implement these API methods, server authorization, or persistent storage.
- A method's presence in the source does not prove that it is deployed, secure, or passing end-to-end tests.

## Definition of complete migration
For every API method, record: domain, existing user workflow, required role/course scope, UI screen, positive/negative authorization tests, data-contract test, failure/retry behavior, and release evidence. Mark a method as `preserved`, `replaced` (with approved equivalent), or `retired` (with explicit owner approval). No implicit omissions.

## Hard release gates
1. Reconcile TEST-only `Setup.gs` helpers with authorized live source before any push.
2. Validate 174 API contracts against synthetic TEST fixtures, including role denial and cross-course denial.
3. No real or military personnel data in GitHub Pages, public artifacts, screenshots or logs.
4. Preserve backend-side authorization and audit. Never use the four-digit PIN as the sole online defense; server hashing, throttling, lockouts, revocation, and session management are mandatory.
5. Public Pages stays synthetic only. Production-like preview requires a private authenticated backend and hosting access controls.
6. Verify iPhone Safari, Android Chrome, RTL, offline/slow network states, keyboard and screen reader basics.
7. Publish deployment SHA, CI logs, rollback, and clear release notes before calling a version ready.

## Delivery sequencing
First: source reconciliation, import PR integration and contract harness. Second: connect a secure read-only course overview and scoped search to the new UI. Third: writes, records, forms, fitness, assessments, reporting, backup and administrative flows with idempotency and permission tests. Keep the synthetic demo available during migration.
