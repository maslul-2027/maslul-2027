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
