# Source import gate — R5.2.16.4.4

## Source package located

The available candidate archive is `MASLUL_2027_R5_2_16_4_4_PRIVACY_SUBCOHORT_CANDIDATE_REV3.zip`. It contains `project/package.json` and 44 files under `project/src/`. The package declares Node.js 22, Playwright 1.63.0 and `npm run test:ci` (`node tests/env_check.js && node tests/run_all.js --ui --strict`).

## Required checks before public import

- Review every published source and test file for credentials, real-person records, URLs or IDs that must remain private, and sample data that could identify people.
- Verify archive hashes and source baseline; exclude local `.clasp.json`, `.clasprc.json` and secrets.
- Reconcile live-only changes to `Setup.gs`, including synthetic pilot course and soldier-seeding helpers, before treating GitHub as the authoritative live source.
- Do not overwrite the existing TEST project or deploy until reconciliation and test gates pass.
- Preserve the existing private web app's execute-as and access settings.

**Status (import PR):** source imported on branch `claude/import-r5-2-16-4-4-final` with the scan in `docs/IMPORT_SCAN_REPORT.md`; the live `Setup.gs` reconciliation is still OPEN (live code not provided). GitHub is NOT yet the source of truth for the deployed app.
