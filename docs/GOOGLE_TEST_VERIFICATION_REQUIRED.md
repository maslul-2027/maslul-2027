# Requires verification against Google TEST (NOT done; no Google action was taken)

Everything below is unverified because it can only be checked on the real Apps Script / Sheets TEST. Do it with synthetic data only, and only after owner approval of credentials.

## A. `Setup.gs` — the two live-only synthetic seed helpers
- The repository's `src/Setup.gs` (from `c9bc782`) defines only `setupDatabase`, `createFirstCourse`, `installDailyTrigger`, `migrateToV1`.
- The two live-only synthetic helpers are named in the owner charter (`docs/OWNER_CURRENT_CHARTER_2026-11-20.md`): `createSyntheticPilotCourseOnce()` and `seedSyntheticSoldiersBatch()`. They are **not in the repo and their code was never provided**; signatures, what they write and idempotency are **unknown**; nothing was reconstructed. They must not be overwritten by `clasp push`.
- Needed: an authorised export of the live TEST project's `Setup.gs`; then diff against `src/Setup.gs`, check they write only synthetic rows, check they do not touch permissions/OAuth scopes, and add them (with a Node test against the fake store) before any `clasp push` that would overwrite them.

## B. Behaviour that Node/Chromium cannot prove
| Area | What to verify on TEST |
|---|---|
| Idempotency (`api()` in `src/Code.gs`) | `CacheService` + `Locks.run` behave as assumed with two real parallel requests; cache TTL (300s); `BUSY` is returned (not a hang) under contention; lost-response retry returns the stored original. Residual window: instance dies or cache write fails after the write commits and before the result is stored. |
| `LockService` | real multi-user lock behaviour (`Preflight` marks `lock.service` NOT_VERIFIED). |
| HtmlService rendering | bottom navigation, sticky header, safe-area padding, progress bar and `prefers-reduced-motion` inside the Apps Script iframe on iPhone Safari and Android Chrome. |
| `google.script.run` | failure handler path (network drop) and `aria-busy` release; offline banner in the iframe. |
| Deployment | versioned `/exec` update and rollback per `docs/DEPLOY_AND_ROLLBACK.md`; unchanged `src/appsscript.json` scopes/access. |
| Privacy gates (D2) | group-only/min-group-5 results on real Sheets-backed data shapes (synthetic). |
| Daily trigger | `dailyJob_` installable as a trigger handler (documented as NOT_VERIFIED). |
| Seed/permissions | roles/course scope enforced by real `Session` identity (the Node tests inject the e-mail). |

## C. Not applicable to Google TEST (separate approvals)
`backend_next/pin_auth.js` is not wired to Apps Script; wiring, hosting, HTTPS/cookies and a security review are prerequisites (see `docs/PIN_AUTH_THREAT_MODEL.md`).
