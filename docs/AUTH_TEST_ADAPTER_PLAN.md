# Private-TEST auth adapter plan (issue #43) — synthetic only

Status: code exists (`backend_next/gateway.js`, `store.js`), tested at the request boundary; **nothing is deployed and the native app does not use it**.

## What is built
Cookie session (HttpOnly/Secure/SameSite=Strict, `__Host-`), CSRF (Origin + per-session token), TLS requirement, proxy-aware client IP, fail-closed scope resolution, admin-only export/audit, read-only viewer, encrypted durable single-process store, audit hash chain, encrypted backup/restore with fault tests.

## Decisions / approvals needed (blockers — not guessed)
1. **Identity verification of the phone number** (OTP/SMS/other) — provider and policy: owner + InfoSec.
2. **Where the private server runs** (HTTPS host, network exposure, region) and **database** (multi-instance, transactional) — owner + InfoSec. The file store is a test adapter only.
3. **Secrets** (pepper, store encryption key, bootstrap token): secret store, rotation, who holds them.
4. **PIN strength** — keep 4 digits (approved UX) only with compensating controls chosen by InfoSec (device binding / second factor / network restriction).
5. **Independent security review** and pen-test before any real identity.

## Next code steps once (2)–(3) are decided
Connect the native app's `api()` to the gateway through an adapter (identity from session, no Google identity), mirror the 174 contracts server-side, and run the full UI E2E (register→approve→login→scoped click→refresh/restart→logout) against the private TEST server.
