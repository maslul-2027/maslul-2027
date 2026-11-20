# PIN authentication — design and threat model (issue #6)

Code: `backend_next/pin_auth.js` · Tests: `tests/pin_auth.js` (10). **Not wired into the live Apps Script TEST; synthetic use only.**

## Flow (all enforced server-side)
register (name, phone, 4-digit PIN) -> pending -> admin approve/reject with role + course + unit -> login -> scoped session -> logout / revocation.
Roles: `admin`, `commander`, `user`, `viewer` (read-only owner account; **every write is denied in `authorize`**, including direct API calls).

## Controls
| Threat | Control |
|---|---|
| PIN guessing (only 10^4 values) | scrypt + server pepper; 5 failures -> lockout 15 min, doubling per repeated lockout (cap 24h); per-IP window limit; uniform errors; equal work for unknown users |
| User enumeration | identical error for unknown / wrong PIN / pending; duplicate registration looks identical |
| Weak PINs | 4 digits only, repeated/sequential/common PINs rejected |
| Stolen DB | only scrypt hashes + salts; session tokens stored as SHA-256; tokens/PINs never logged |
| Stolen session | idle 60 min, absolute 12 h, revoked on logout / deactivation / scope change / reset |
| Privilege escalation | admin-only approval and scope changes; commander/user limited to assigned courses/units |
| Recovery abuse | admin-issued one-time 8-digit code, 15 min, 3 tries, single use, revokes live sessions |
| Bootstrap | first admin only with a deployment-secret token and only while no users exist |
| Accountability | audit trail of register/approve/reject/login/lockout/logout/revoke/denied viewer writes |

## Known gaps — must be closed before ANY real data
- **A 4-digit PIN is weak by itself**; a security review (and likely a second factor or device binding, or longer PIN) is required (as stated in #6).
- Storage is in-memory here; the production adapter, HTTPS/cookie handling (HttpOnly, SameSite), CSRF, IP derivation behind a proxy, rate-limit persistence across instances, and secret storage (pepper, bootstrap token) are not implemented.
- Not integrated with the existing API (`api()` still uses Google identity). Wiring requires owner approval of the migration path (#8).

## Update — synthetic private-TEST gateway (issue #43, branch `claude/synthetic-auth-43`)
New (synthetic only, **not deployed, not wired to the Apps Script API or to the native app**): `backend_next/gateway.js` (request boundary), `backend_next/store.js` (durable adapter), `tests/auth_gateway.js` (13 checks, in `run_all`). `authorize` in `pin_auth.js` is now **fail-closed** (a non-admin request with no resolvable course — or no unit for unit-scoped users — is denied and audited).

| Gate raised in the manager review (#43, 20.11) | State |
|---|---|
| 2. Identity/context derived only from a validated, unrevoked session; no role/course/unit from the client | **Implemented + tested** (cookie-only session; body `role/courseIds/userId` ignored; self-approval/scope-change/foreign-course create denied) |
| 3. Fail-closed record scope; IDOR/cross-course on read, write, export, evidence, audit | **Implemented + tested** (server resolves each record to course/unit; unresolved => deny; unknown ids indistinguishable from foreign ids for non-admins; export/audit admin-only; viewer never writes) |
| 4. Durable private security state; races; encrypted backup/restore; audit integrity | **Implemented for a single-process synthetic store + tested**: AES-256-GCM at rest, atomic replace, serialised writers, sessions/lockouts/rate counters persist across restart, 25-way concurrent guessing locks exactly once, double approval/registration yields one row, backup/restore fails closed (tamper/truncate/wrong key/checksum), audit SHA-256 chain detects edit/delete/reorder. **Open:** multi-instance consistency needs a real transactional database. |
| 5. HTTP/host boundary: HttpOnly/Secure/SameSite cookie, CSRF, trusted-proxy IP, TLS | **Implemented in the gateway + tested** (`__Host-` cookie, Origin + per-session double-submit token, 426 without TLS, X-Forwarded-* honoured only from configured proxies). **Open:** approved HTTPS hosting, secret storage/rotation (pepper, store key), independent security review. |
| 1. Verified phone/identity (ownership of the number) | **NOT implemented — blocker.** Needs an owner/InfoSec-approved verification mechanism and provider; no fake OTP was built. Admin approval alone does not prove number ownership. |
| 6. Full E2E register→approve→login→scoped **UI** action→refresh/restart→logout against the private TEST server | **NOT done** — no private TEST server exists and the native app is not connected to this gateway. The gateway flow is proven at the request-boundary level only. |

Residual risks unchanged: a 4-digit PIN is weak even with scrypt+pepper+lockout (device binding / second factor / longer secret recommended); no real users, no real data, release remains blocked until written InfoSec + owner authorization.
