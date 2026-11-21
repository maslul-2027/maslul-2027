# Real report export — private TEST server (Issue #72, part 1) — SYNTHETIC DATA ONLY

Scope of this change: exactly three routes work for real **in the private TEST server** (and therefore in the Windows TEST package, which runs the same server):
`reports.generate`, `reports.fullExport`, `reports.download`. Documents (`docs.*`), backups (`backup.*`), OCR and `migration.run` are **unchanged** (still not connected / policy-blocked; later PRs).

## What is real
| Piece | Implementation | Proof |
|---|---|---|
| PDF (A4, RTL Hebrew) | `backend_next/export_formats.js` — pure Node, no network; embedded **subset of Liberation Sans** (SIL OFL, `backend_next/assets/OFL-LICENSE-font-source.txt`), simplified bidi, Identity-H + ToUnicode (text is selectable/searchable) | `tests/report_export.js` validates xref/fonts/pages; `scripts/e2e_report_export_browser.js` real browser download; extracted with `pdftotext` (Hebrew correct) and rendered with `pdftoppm` |
| XLSX (RTL sheets) | OOXML written directly (zip + deflate, CRC) — opens in Excel/LibreOffice; formula-injection neutralised by the engine (`Reports.safe_`) | zip CRC + sheet XML parsed in tests; loaded with `openpyxl` |
| Encrypted storage | `backend_next/file_store.js` — AES-256-GCM per file, HKDF key from the server store key, random file ids, `0600`, outside the engine state | test: no plaintext/Hebrew/trainee name on disk; tampering → fail closed; survives restart |
| Download | `GET /api/download/report/:id` — session required, **engine decides** (`reports.download`), binary response, `Content-Disposition: attachment` with a fixed ASCII name derived from the validated id, `nosniff`, `no-store`, audited (allow + deny) | role/scope tests, unknown/foreign ids indistinguishable |
| UI | Reports screen (More → דוחות וייצוא): three admin buttons that generate **and download**, and a list of generated files (tap = download). 320–414px verified | browser E2E (real `download` event) |

## Permissions (unchanged)
`report.generate` is **admin-only** in `src/Policy.gs` (not touched). So: **admin** generates/downloads; **commander** (course/team scope) and **viewer** are refused (`FORBIDDEN`/404, no job, no file, no bytes) — covered for generate, fullExport, jobs and download, including a commander of another team. The group-only analytics rule (N≥5) is untouched: the analytic PDF is built from `Analytics.reportData`, which suppresses small groups.

## Honest format limits (TEST adapters)
* PDF contains headings, paragraphs, KPI lines, bullet lists and **tables**. **Charts (inline SVG) are not drawn**; every chart in the analytic report is followed by its data table, which is rendered. Fonts: Hebrew + Latin + digits + common punctuation only (other scripts render as `?`).
* One PDF paragraph direction (RTL); simplified bidi (Hebrew / Latin / numbers), not full UAX#9.
* Files are limited to 25 MB. No Drive/Google/OCR/PDF-service involved; all of that stays NOT_CONNECTED.
* Generated files live in `<data>/files/` (encrypted). The launcher's `--backup/--restore` covers the **state file only**; file-level backups are the separate backups PR. After restoring an older state, a report row whose file is missing answers 404 (no crash, no bytes); reports can simply be generated again.
* The **public demo** (GitHub Pages) has no server: there these three routes remain `NOT_CONNECTED` and no file is faked.

## Truth table (route-by-route)
| Route | Before | After (private TEST server) | Public demo |
|---|---|---|---|
| `reports.generate` | NOT_CONNECTED | real PDF/XLSX stored encrypted (admin); commander/viewer refused | NOT_CONNECTED (unchanged) |
| `reports.fullExport` | NOT_CONNECTED | real multi-sheet XLSX (admin) | NOT_CONNECTED (unchanged) |
| `reports.download` | NOT_CONNECTED | real binary download, audited | NOT_CONNECTED (unchanged) |
| `reports.preview`, `reports.jobs` | working | working | working / n.a. |
| `reports.build` | POLICY_BLOCKED | POLICY_BLOCKED | POLICY_BLOCKED |
| other 10 `BLOCKED_NOT_CONNECTED` routes | not connected | **unchanged** | unchanged |

The 176-route public-demo ledger (158 PASS_SYNTH_E2E / 5 POLICY_BLOCKED / 13 BLOCKED_NOT_CONNECTED) is **not changed** — it is generated from the *public demo* browser run, where these routes truly are not connected. The private-server evidence for the three routes is `tests/report_export.js` (16 tests) and `scripts/e2e_report_export_browser.js` (UI-origin successes recorded by the client for all three routes).

## NOT_RUN / open
Physical two-phone acceptance · clean user Windows PC run of the new files (CI Windows job covers the package) · scoring tables N1–N8 (DRAFT, unchanged) · documents / backups / OCR / migration (next PRs).
