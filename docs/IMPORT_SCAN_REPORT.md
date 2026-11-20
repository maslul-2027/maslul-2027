# Import scan report — R5.2.16.4.4 FINAL TEST CANDIDATE (source import PR)

Imported: `src/` (44 files), `tests/`, `scripts/`, `test_only/` (personal-TEST manifest, `webapp.access` MYSELF), `scoring/`, `staging_demo/`, `docs/` (without screenshot evidence folders), `package.json`, `.nvmrc`, status / changelog documents.
NOT imported: `spec_original/` (legacy owner documents), `phase1/` (historical logs), `docs/pd6`, `docs/qa_dev61*` (screenshot evidence, ~11 MB), `SHA256SUMS`, `tests/last_run.json`.

Scan (before commit): no Google Script ID, deployment id (`AKfycb…`), Spreadsheet id, OAuth client / token, API key, private key, `.clasp*`, `.env*`, credentials file. Matches are deliberate synthetic leak-detector sentinels inside tests (`tests/demo_data_audit.js`, `tests/r3_forms_reports.js`, `tests/v1_preflight.js`). All e-mail addresses are synthetic (`@x.com`, a few `@gmail.com` sentinels in negative tests). No real personnel data.

Baseline: identical to the package verified earlier (strict 59/59 suites, 880/880 tests on the original tree; `src_manifest_dev62.txt` pins the 44 source hashes — `tests/src_identity.js`).

Known gaps (do not treat GitHub as the live source yet):
- **Live-only `Setup.gs` synthetic seed helpers are NOT in this import** — the issue asks to reconcile them, but the live code was never provided; it must be exported from the TEST project by an authorised person (do not reconstruct).
- `package-lock.json` absent by design; CI uses `npm install` against the exact pin and publishes the generated lock as an artifact.
- No deployment, no Google action.
