# Secure, versioned Apps Script `/exec` redeploy and rollback (runbook — NOT executed)

**Status: no deployment is performed by this repository or by CI.** Credentials, target Script ID and permissions have not been verified. Do not run these steps until the owner confirms them.

## Key fact
`clasp push` only uploads source to the script's **HEAD**. The web-app `/exec` URL serves a **specific deployed version**, so a push alone does **not** change what `/exec` shows. The deployment must be updated deliberately.

## Preconditions (all must be true)
1. The owner confirms the target is the **TEST** project and gives its Script ID out-of-band (never commit it; `.clasp.json` / `.clasprc.json` stay git-ignored and CI rejects them).
2. A dedicated account/OAuth session on the owner's machine (not shared, not in CI, no tokens in the repo).
3. `npm run test:ci` is green on the commit being deployed; `src/appsscript.json` is unchanged (scopes/access are never changed by a UX deploy).
4. The existing TEST deployment ID is known (`clasp deployments`).

## Deploy (updates the SAME /exec URL)
1. `clasp push` (uploads HEAD).
2. `clasp version "ux-sprint-1 <git sha>"` (creates an immutable version N).
3. `clasp deploy --deploymentId <EXISTING_TEST_DEPLOYMENT_ID> --versionNumber N --description "ux-sprint-1 <sha>"` — re-points the existing deployment; the URL does not change. Never run `clasp deploy` without `--deploymentId` (that creates a *new* URL).
4. Verify on the same `/exec` URL: the header shows `קורס: … · …`, a progress bar appears during loading, 390px layout, and the smoke plan in `docs/GOOGLE_TEST_SMOKE_AND_ROLLBACK_PLAN.md`.

## Rollback
1. Note the previous version number M **before** step 3 (`clasp deployments` shows it).
2. `clasp deploy --deploymentId <EXISTING_TEST_DEPLOYMENT_ID> --versionNumber M` — the same URL serves the old version again (data is untouched; this change has no data migration).
3. Re-run the smoke plan. Optionally `git revert` the PR commit afterwards.

## Never
Production deployment, permission/OAuth/scope changes, real soldier data, or committing Script IDs, spreadsheet IDs, tokens or `.clasp*.json`.
