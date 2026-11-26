# MASLUL 2027 — Data → Insight → Decision → Report (Issue #95, vertical slice 1: NAVIGATION)

Synthetic data only. No deploy, no login/PIN/secret change, no permission change, no data deletion. Branch `claude/data-to-decision` (base `cloudflare/free-shared-test` @ `0be0358`).

## 1. What the slice proves (working code, not a mock)

```
group entry (הזנה → ניווט)  ──►  verified save (id + soldier + every value, server re-read)  ──►  buttons: ניתוח הניווט · יצירת דוח PDF · ייצוא נתונים
        │                                                                                                  │
single-soldier form ──► lands on the dashboard of THAT event with a read-back banner ◄─────────────────────────┘
                                                      │
              per-event dashboard (nav.list fresh read, same-type history only) ──► PDF (A4 RTL, vector charts) + XLSX (6 typed sheets)
```

* One model per event (`native/insight.js:inBuildModel`) feeds the screen, the PDF and the Excel file. There is no second calculation (data lineage: `nav.list` + `soldiers.list` → `inBuildModel` → `inNavPdf` / `inNavXlsx` / SVG charts).
* The download is announced only after the bytes pass a check (`%PDF-` + `%%EOF`, size; `PK` for xlsx). A failed generation shows an error and no "downloaded" toast.
* "Verified" banner after a single save: the record id returned by the create call must be present in a fresh read; otherwise "לא אומתה" and no success.

## 2. Architecture decision (Issue #95 §D)

| Option | Result |
|---|---|
| Node export engine (`backend_next/export_formats.js`, `file_store.js`, `/api/download/report/:id`) | Private TEST server only; admin-only; **no charts**; uses `fs`/`zlib` — not usable inside a Worker. Kept untouched. |
| PDF inside the Cloudflare Worker (Free plan) | Rejected: 10 ms CPU limit, no file storage binding (R2/KV not part of the free TEST), `reports.generate/fullExport` are deliberately `NOT_CONNECTED` (`worker.js` FILE_ROUTES). |
| Cloudflare Browser Run / any paid or third-party renderer | Not used (no budget approval; Issue forbids). |
| **Chosen:** generate in the browser from the data the server already authorized for this session | Dependency-free `native/reportkit.js` (≈250 lines, OFL font subset already in `backend_next/assets`), vector charts, no network, no new recurring cost, works on the hosted Worker with the existing routes. |

Consequences, stated plainly: (a) permission enforcement is the existing server scope on the **reads** (`nav.list`, `soldiers.list`); the export button itself is shown only to `admin` (the existing report policy — not widened). (b) A server-side audit record for the *download event* does not exist (no route); the reads are audited by the engine as before. **BLOCKED until a server route + policy are approved.** (c) The file is not stored server-side; each download is regenerated from a fresh read.

## 3. Privacy rules implemented (client side, same N as the engine)

* N ≥ 5 for every aggregate (mean, median, distribution, unit rows, trend point, component means, deltas). Below: "אין מספיק נתונים" — never a number.
* Complementary suppression among sibling units: if exactly one sibling is hidden, the smallest visible sibling is hidden too, with the reason shown.
* Deltas only versus an earlier event of the **same navigation type**, both with N ≥ 5; matched-cohort delta only if ≥ 5 soldiers appear in both; different distance is flagged.
* PDF/XLSX contain aggregates only. Test asserts no soldier name/personal number appears in either file. Individual rows exist only in the on-screen operational list (the same records the account already sees in "ניווט").
* Descriptive deterministic sentences only; no thresholds (none approved), no AI, no ranking.
* Not enforced here (server-side authoritative metric service, server-side suppression of URL/hover/export): **NOT DONE** — see §7.

## 4. MetricDefinition registry (`MD` in `native/insight.js`)
`nav.coverage`, `nav.final`, `nav.plan`, `nav.debrief`, `nav.points`: label, unit, source table/route, numerator, denominator, direction, null semantics, comparison eligibility, method version `insight-1`. The same registry prints the in-app "הגדרות ושיטה" panel, the PDF glossary page and the Excel sheet "מילון מדדים".

## 5. Screens added
`עוד → תובנות ודוחות` (reports hub: navigation template live; five other templates visibly **חסום**), `insight/nav/<type>/<date>[/<savedId>]` (dashboard), soldier card → "תמונת התקדמות" (navigation series; fitness/exams/shooting/attendance rows visibly blocked). Four tabs, authorizations and existing rows are unchanged.

Dashboard: verified-state banner, KPI cards (coverage, mean/median, change vs previous comparable, needs attention), findings, attention items (clickable), histogram (bar = click / Enter filters the operational list), components, unit table with suppression, trend line (point = link to that event), table alternative for every chart (`aria-expanded` toggle), definitions. Charts: turquoise `#007f83` primary, red `#c52d36` only for decline/attention, no rainbow. Time axis in RTL: oldest at the right.

## 6. Design language (shared tokens, applied in this slice)
Cards `.in-kpi` / `.card` (14px radius, 1px `--line`), accent bar top (teal, red for attention), 44px minimum targets, one primary action per view (`primary` = PDF), secondary = Excel/refresh, empty/loading/error states (`skeleton`, `emptyBox`, `errBox` + retry), press feedback via existing `--t-press`, reduced-motion honoured by the global rule, RTL typography, no icon-only controls. Rolling this to every other screen is **not done** (P1).

## 7. Status matrix

| Item | Local (preview engine) | Real Worker + D1 (local runtime) | Hosted TEST | Physical phone |
|---|---|---|---|---|
| Entry → verified save → dashboard → PDF/XLSX → reload | PASS (`e2e_native_insight.js`, 15) | PASS (`e2e_cf_bulk.js` INSIGHT test) | NOT_RUN (no deploy, no browser/credentials for Claude) | NOT_RUN |
| PDF bytes/structure/Hebrew/numbers/pages | PASS (qpdf, pdfinfo, pdftotext, pdftoppm) | PASS | NOT_RUN | NOT_RUN |
| XLSX typed cells, RTL, 6 sheets | PASS (openpyxl) | PASS | NOT_RUN | NOT_RUN |
| N<5 honest state; no individual data in files | PASS | PASS (no names) | NOT_RUN | — |
| Commander gets no export buttons | PASS | — | NOT_RUN | — |
| 320/360/414/desktop, 195px (≈200% zoom), 44px | PASS | — | NOT_RUN | NOT_RUN |
| VoiceOver / TalkBack | NOT_RUN | — | — | NOT_RUN |
| Mobile Safari download | NOT_RUN locally; WebKit in CI only for existing suites | — | NOT_RUN | NOT_RUN |
| Three owner emblems in the PDF header | **BLOCKED** — the images are not available to Claude; `Pdf({logos:[{bytes,w,h}]})` (JPEG) is implemented and unused. Never recreated. | | | |
| Download audit event, server-side metric service, role/scope policy for non-admin export | **BLOCKED / NOT DONE** (needs approved route + policy) | | | |
| Course dashboard (journey 4), other domains (journey P1), group Q&A (P2), scatter/radar | NOT DONE | | | |
| Concurrent-create uniqueness (atomic, server) | still open (listed since #92) | | | |


## 8. Update after manager QA (SHA of this update in PR #96)
* **P0 privacy fixed by construction:** the model now has two projections. `m.pub` (group-facing) feeds the on-screen summary, charts, tables, findings, PDF and Excel; `m.ops` (exact numbers + roster) is rendered only in the dashboard's marked operational zone and is never exported. Rules (documented in code, `inCell`/`inMergeBins`/`inSuppressUnits`): person-counts shown are ≥5 or "פחות מ-5"; event with <5 results hides coverage numerator, scores, units, components and counts; no min/max; histogram buckets are merged until each holds ≥5 (so [4,1,0,0,0] cannot appear); sibling units <5 are hidden and, while (parent total − Σ visible) < 5, the smallest visible sibling is hidden too (complementary suppression); a hidden parent hides its children; hidden trend events show no N; matched-cohort N only if ≥5. Absence counts (eligible − recorded) are coverage metrics and stay derivable by design — a policy choice to confirm.
* **Regression:** `scripts/e2e_native_insight_privacy.js` (8 attack scenarios: N=1..4, singleton bucket, one small sibling, two nested levels, repeated dates, export parity, inactive/cancelled/historical, soldier missing from the list) searches `pub`, the real PDF text and the XLSX cells. Test 9 of `e2e_native_insight.js` now asserts the true count is absent from DOM group zone, PDF and XLSX.
* **Denominator:** eligible = soldiers active today ∪ soldiers with a record in the event (coverage can never exceed 100%); cancelled soldiers' records are excluded and counted separately; inactive-today soldiers' records stay; stated on screen and in the PDF ("אין תיעוד היסטורי של הרכב הקורס"). `soldiers.list` is re-read fresh with every load (no cached roster).
* **Download wording:** "הקובץ נוצר ונבדק — ההורדה החלה"; no claim of delivery.
* **Export gating, honestly:** the PDF/Excel buttons are hidden for non-admins in the UI. This is NOT server-side enforcement of a download and there is no server audit of the download event; the underlying reads are scoped/audited by the server as before. Stated in the UI and here; a server route + approved policy is required to claim more.
* **Reports:** 3-page PDF (KPI row, finding cards, unit bars + matrix, distribution/components, comparison/trend, data quality + glossary, banner headers); single-bucket distributions are replaced by an explanatory card. **Course dashboard** (`insight/course[/domain]`): domain chips, what changed / needs attention / data quality, built only from the engine's group-safe routes, PDF + Excel from the same model; failed reads are shown as missing, never as zero. **Soldier card:** "תמונת התקדמות" now sits under the details, with a chart per navigation type, all measurements table (delta vs previous), read stamp and links to source records.
* **Still BLOCKED / not done:** the three owner emblems (no files reached the environment; `Pdf({logos})` ready); server-side audit/authorization of downloads; fitness/exams/shooting/attendance/marches have course-level summaries (server-suppressed) but no per-event dashboards or soldier time series; unified design system for every other screen; hosted TEST / physical phone / VoiceOver NOT_RUN.
