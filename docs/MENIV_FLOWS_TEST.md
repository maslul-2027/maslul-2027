# Meniv-inspired flows — what is really in the app (Issue #76)

**Principles only.** The original white / graphite / turquoise design, the 4 tabs and RTL are unchanged. Nothing here claims Meniv's technology, timing measurements or performance, and the public synthetic demo is not the private shared server. The owner's real iPhone acceptance is **NOT_RUN** (Chromium ≠ iPhone Safari).

## Owner journeys now present (each is a browser test in `scripts/e2e_native_flows.js` and `scripts/e2e_native_marches.js`)
| Principle (issue #76) | What exists | Proof |
|---|---|---|
| Contextual next action on Home | Home cards "מסע חדש", "אירוע נוכחות חדש", "הוספת חניך", "מעקבים לטיפול" (hidden for a server viewer); hero CTA from live counts | flows test 1 |
| Live numbers after confirmed writes | Home KPI tiles + new "פעילות אחרונה" strip (newest event / march, counts inside the caller's scope, suppressed small groups stay hidden) refresh on every Home render | flows test 3 |
| Guided stepwise creation, one screen | march + attendance forms: numbered steps 1 פרטים → 2 מי חסר (everyone else present) → 3 סקירה ושמירה; the review names the chosen absentees and counts live; scope list restricted to what the commander may act on | flows tests 2, 4; marches test 1 |
| Save once, never "saved" before the server answers | submit is busy-guarded (double click → exactly one record); after saving, the card opens the **persisted, editable participant list read back from the server** (#80 `participantEditor`: `marches.list` with `includeRoster` / `attendance.roll`), not an echo of the form | flows test 3, 4 |
| Press / dialog / route feedback | existing PR63 tokens verified live: press 150 ms, dialog entrance animation, route-in; `prefers-reduced-motion` turns animations off | flows test 6 |
| States | skeleton → data / error+retry / empty / permission (viewer sees no write cards; direct URL → read-only; server denies); offline banner (`role=status`) | flows test 5 + manager's viewer tests |
| Accessibility | Space toggles a trainee, Escape closes a sheet, 44 px rows, no horizontal overflow at 200 / 320 / 360 / 390 / 414 px | flows tests 7, 8 |
| Every working operation discoverable | march / attendance from Home **and** More; participants editable from the saved march / event card; march details from the separate "עריכת פרטי המסע" control | marches tests 1–3 |

## Not claimed / still open
* Offline *write* behaviour in server mode is the existing `NETWORK` error path; only the banner is browser-asserted in the public demo (its engine is local).
* Tasks "+" and fitness flows keep their existing screens (covered by their own suites); no new stepper was added there.
* No video recording was produced in this environment; screenshots are attached to the PR.
