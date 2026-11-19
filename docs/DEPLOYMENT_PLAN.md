# Deployment plan — not yet enabled

1. Import and review the verified R5.2.16.4.4 source, excluding local clasp bindings and secrets.
2. Keep the current live TEST Apps Script project untouched while setting up version control.
3. Run automated tests on every proposed change.
4. Configure a dedicated, restricted Google Apps Script deployment credential as a GitHub Actions secret (never in repository files).
5. Deploy only to the isolated TEST script after tests pass, with a version/rollback mechanism and smoke tests.
6. Verify whether the existing /exec URL points to a versioned deployment; update that deployment deliberately rather than assuming `clasp push` updates it.

**Current status:** repository bootstrap only. No GitHub Actions deploy credentials configured. No code uploaded to Apps Script by this repository.
