> **STATUS NOTICE (2026-11-19, R5.2.16.4.4): NOT AN EXECUTABLE RUNBOOK.** This checklist lists checks to perform *only after* a separate explicit owner approval; wording such as "Deploy to the TEST project" below does not authorize `clasp push`/`clasp deploy`/setup/migration/trigger installation. The current permitted path is the read-only R10 clone/backup/diff in `docs/GOOGLE_TEST_RUNBOOK_D7.md`. All G-01..G-07 are NOT_RUN. Statuses: `docs/R5_2_16_STATUS_MATRIX.md`. If this notice conflicts with the text below, this notice controls.

# Consolidated Google TEST checklist — STATUS OF G-01..G-07: **NOT RUN** (nothing here was run; no Google access was used)
New since the owner decisions: in G-04 also check that the analytic PDF is the default and the tabular PDF only with `layout:'tabular'`; in G-03 check commander = FORBIDDEN for get and set; add to G-02 a scope of fewer than 5 soldiers (dashboard/report show only the privacy notice).
G-01 Deploy to the TEST project with `TEST_ONLY_appsscript.MYSELF.json` (same scopes; `access: MYSELF`); confirm the web app loads (HtmlService serves the new Index.html — IFRAME sandbox, `<base target=_top>`).
G-02 Attendance: create one event with several absentees in TEST (owner's instruction: do not create extra events beyond what the owner approves), open its detail, check counts vs list.
G-03 Emergency contact: set/read as admin; confirm commander gets FORBIDDEN; submit through the live FormPage; approve and reject; confirm values exist only in the private spreadsheet (`SoldierPersonalDetails`) and never in the main sheets/Audit log.
G-04 **PDF**: generate the analytic PDF through `Adapters.pdfFromHtml` and compare with `docs/…/analytic_full.pdf` (Chromium). Check inline SVG, A4 page count, RTL, footer. If SVG is dropped, the table fallbacks remain — report it.
G-05 Clipboard `tel:`/copy buttons inside the Apps Script iframe (clipboard permission differs).
G-06 Timing with real Sheets latency for `analytics.insights` / `reports.preview` (Node fixtures: 60→7 ms, 300→25 ms, 1000→88 ms; not representative of Sheets).
G-07 Mobile real-device check (iOS Safari/Android Chrome) of the drawer and the attendance picker.
