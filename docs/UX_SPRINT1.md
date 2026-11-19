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
| Small phones | A `max-width:400px` block: tighter header/padding, 2-column KPI grid, media and long text cannot overflow. |

## Evidence (synthetic data only)
- Screenshots: `docs/ux-sprint1/before-*.png` vs `after-*.png` at 360 and 390 px (`node scripts/ux_screenshots.js <index.html> <label>`).
- New suite `tests/ui_ux_sprint1.js` (7 browser tests). Run against the old `Index.html` (`UX_INDEX=<path>`) it fails 5 of 7 (the new behaviours); on the new file 7/7 pass.
- Adjusted pins: `tests/src_manifest_dev62.txt` (Index.html hash), `EXP_SUITES` 59 -> 60 in `scripts/clean_machine_verify.*`.
- Full `node tests/run_all.js --ui --strict` is re-run in CI (Node 22).

## Not done / honest limits
- Not deployed anywhere. The change is **source only** until the TEST deployment is verified (see `docs/DEPLOY_AND_ROLLBACK.md`). No claim is made that the TEST `/exec` URL shows it.
- Real-device and real Apps Script HtmlService rendering are not tested; only Chromium against the local bridge.
- Further candidates (not in this PR): partial in-place screen updates instead of re-rendering, explicit back/close on every nested card, per-button success toasts where only inline text exists today.
