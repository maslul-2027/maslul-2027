# UX sprint 1 — mobile / RTL / navigation feedback (issue #2)

Scope: `src/Index.html` only (+ tests/docs). No change to data contracts, API routes, permissions, privacy gates (D2) or scoring.
Hebrew RTL and the white/black/red/turquoise design are unchanged.

## What changed
| Area | Change |
|---|---|
| Context | The sticky header now shows a live line `קורס: <name> · <area> · <screen>`, so the selected course and place are visible on every screen (also while scrolled). |
| Perceived speed / feedback | Every server call raises a thin progress bar at the top and `aria-busy` on `<body>` until it settles (success **or** failure). |
| Duplicate reads | `call()` shares one in-flight promise only for identical **read-only** routes (list/get/summary…). Writes are never merged or suppressed (issue #7); double-submit protection stays with the existing button locks. No cache, so no stale data. |
| Connectivity | An offline banner appears when the browser goes offline and disappears when it returns. |
| Accessibility | Global `prefers-reduced-motion` rule (all animation/transition near-zero, drawer transition off); existing focus rings and 44px touch targets verified at 360/390. |
| Durable write protection (review on #9) | Writes carry a client idempotency key `idem_` (reused for identical retries/second taps for a short window, renewed after a server rejection). `api()` in `src/Code.gs` executes a keyed write at most once per user+route+key (Script cache, 5 min, successful results only) and returns the original result on a retry; `idem_` is stripped before routing. Best effort when the cache is unavailable. Tests: `tests/idempotency.js` (6). check -> execute -> store run under the re-entrant script lock (`Locks.run`), so two parallel same-key requests execute once (the loser waits, or gets a retryable `BUSY`, and the client keeps its key on `BUSY`). Residual window if the instance dies or the cache write fails after the commit; not a substitute for domain-specific uniqueness rules. Tests: `tests/idempotency.js` (8, incl. parallel interleaving with a negative control and lost-response). |
| Mobile navigation (issue #7 step 1) | Persistent bottom bar at <=900px: up to 4 area buttons (the current area is always included) + "עוד ☰" which opens the existing drawer. It only clicks the existing area buttons, so permissions/visibility rules are unchanged. Hidden on desktop and while the drawer is open. |
| Small phones | A `max-width:400px` block: tighter header/padding, 2-column KPI grid, media and long text cannot overflow. |

## Evidence (synthetic data only)
- Screenshots: `docs/ux-sprint1/before-*.png` vs `after-*.png` at 360 and 390 px (`node scripts/ux_screenshots.js <index.html> <label>`).
- New suite `tests/ui_ux_sprint1.js` (8 browser tests). Run against the old `Index.html` (`UX_INDEX=<path>`) it fails 5 of 7 (the new behaviours); on the new file 7/7 pass.
- Adjusted pins: `tests/src_manifest_dev62.txt` (Index.html hash), `EXP_SUITES` 59 -> 60 in `scripts/clean_machine_verify.*`.
- Full `node tests/run_all.js --ui --strict` passed locally (60/60 suites) and in CI on this branch.

## Not done / honest limits
- Not deployed anywhere. The change is **source only** until the TEST deployment is verified (see `docs/DEPLOY_AND_ROLLBACK.md`). No claim is made that the TEST `/exec` URL shows it.
- Real-device and real Apps Script HtmlService rendering are not tested; only Chromium against the local bridge.
- Further candidates (not in this PR): partial in-place screen updates instead of re-rendering, explicit back/close on every nested card, per-button success toasts where only inline text exists today.
