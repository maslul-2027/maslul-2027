# Google TEST runbook (G-01..G-07) — status: NOT_RUN

> **Current candidate checkpoint (2026-11-19): R5.2.16.4.4** (lineage and one-version rule: `docs/R5_2_16_STATUS_MATRIX.md`; status file `R5_2_16_4_4_CANDIDATE_STATUS.md`). Only `src/Index.html` and `src/FormPage.html` changed versus R5.2.15 (all `.gs` unchanged; `src/` byte-identical since R5.2.16.1); R5.2.16.4.x changed packaging/QA tooling only. Independent QA (Node 22.16.0 / npm 10.9.2 — does **not** satisfy the exact Node v22.23.4 gate; Playwright/Chromium unavailable): ZIP integrity PASS, clean-machine 15/15, R5 focused 97/97, broad Node 627/627 (45/57 suites; 12 browser suites skipped — not a full regression). Reconciliation run 2026-11-19 (Linux, exact Node v22.23.4, npm 10.9.9, Playwright 1.63.0, Chromium 153; pre-existing node_modules, no lock): strict run **57/57 suites, 853/853 tests PASS, 0 SKIP**, source identity 4/4, syntax 41/41 + 3/3. This is Linux evidence, not a Windows clean-machine run. package-lock BLOCKED_NETWORK (intentionally absent). Windows 10, PowerShell preflight, screen readers, axe-core, devices, Google TEST: NOT_RUN. Production readiness: NOT APPROVED. This runbook is not an installation or deployment authorization.

**Purpose:** validate the R5 integrated candidate only in the dedicated Google TEST project, with synthetic data. Never use production or real soldier data.

## Preconditions
- A trusted Windows machine and a human operator with access to Apps Script.
- Verify the visible project name and Script ID in Apps Script Project Settings. The transfer script cannot cryptographically prove that a Script ID belongs to the named project.
- Use `MASLUL_2027_GOOGLE_TEST_TRANSFER_KIT_R10` for a read-only `clasp clone`, local backup, backup integrity verification, candidate staging and SHA-256 content diff. The kit does **not** push or deploy.
- Review the cloned project's identity, `.clasp.json`, manifest, Script Properties/Sheet IDs (without copying secrets into chat), backup ZIP and CSV diff. Stop on any unexpected file or setting.
- Full regression has **not** been proven on Windows or against Google. The historical D7 figure (804 tests / 56 suites) is not an R5 pass. Current evidence is in `docs/R5_2_16_STATUS_MATRIX.md` (strict Linux run under exact Node v22.23.4 on 2026-11-19: 57/57 suites, 853/853 — not a Windows run; focused gate 97/97 across 10 suites — targeted only). Windows clean-machine validation (`docs/INSTALL_CLEAN_MACHINE.md`) should be completed before Google TEST.
- Because R5.2.16 changed the web UI files, G-05 and G-07 must also check keyboard/touch behaviour of the new tabs, forms and mobile drawer on real devices; screen-reader checks remain NOT_RUN.

## Mandatory stop before any write
After the read-only clone and review, stop. Do not run `clasp push`, `clasp deploy`, `setupDatabase()`, `migrateToV1()` or `installDailyTrigger()` until a separate explicit owner approval is given after reviewing the exact diff and backup. No approval is implied by running the transfer kit.

## G-01..G-07 (execute only after separate approval)
1. **G-01 Source / manifest:** verify the TEST-only manifest (`USER_DEPLOYING`, `MYSELF`, `Asia/Jerusalem`); compare source hashes to the approved candidate (R5.2.16.4.4: `SOURCE_SHA256.txt`; `.gs` files identical to R5.2.15, `Index.html`/`FormPage.html` per R5.2.16); confirm the app loads in HtmlService.
2. **G-02 Attendance:** synthetic event with multiple absentees; verify detail counts and list agree. Test a scope under N=5 and confirm suppression.
3. **G-03 Emergency contact:** admin set/read; commander forbidden for get/set; self-service form submit/approve/reject; confirm values remain only in `SoldierPersonalDetails`, never main sheets or Audit.
4. **G-04 PDF:** analytic PDF through `Adapters.pdfFromHtml`; verify A4, RTL, footer `עמוד i מתוך N`, and SVG/chart fallback. Confirm GROUP ONLY output contains no soldier names/IDs. Tabular PDF only with `layout:'tabular'`.
5. **G-05 Clipboard / `tel:`:** verify actions inside the HtmlService iframe.
6. **G-06 Performance:** measure `analytics.insights` and `reports.preview` against real TEST Sheets; record raw timings and data volume. Node timings are not a substitute.
7. **G-07 Devices:** iOS Safari and Android Chrome; verify drawer, attendance picker and core screens.

## Authorization spot-check
With one admin and two commanders assigned to different courses, call the six F6 routes using synthetic records. Out-of-scope requests must return FORBIDDEN; a commander-supplied `role:'ADMIN'`, email, courseScope or soldier ID must not widen access. Confirm `fitness.quality` remains admin-only.

Stop and record PASS / FAIL / BLOCKED / NOT_RUN for every check. No fixes in TEST; any defect returns to the isolated candidate branch.
