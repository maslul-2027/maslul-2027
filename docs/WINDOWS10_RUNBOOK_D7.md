# Windows 10 clean install — status: NOT_RUN

This is the short checklist form of `docs/INSTALL_CLEAN_MACHINE.md` (which is the detailed, authoritative procedure, including the preflight step and the SHA-256 placeholder rules). It applies to the isolated candidate R5.2.16.4.4 and must be executed on a trusted Windows 10 machine. Synthetic data only. Statuses and numbers: `docs/R5_2_16_STATUS_MATRIX.md`.

1. Use a clean Windows 10 VM or machine with no prior project checkout. Record Windows build, PowerShell version, Node version and npm version. Node must be exactly v22.23.4 and npm 10.x (the preflight enforces this); run `windows_preflight.ps1` first, as described in `docs/INSTALL_CLEAN_MACHINE.md`.
2. Extract the R5 integrated candidate to a new directory. Verify its archive SHA-256 against the value in the external delivery message (it is deliberately not stored inside the ZIP) before extraction. Do not overwrite an existing checkout.
3. `package-lock.json` is currently **BLOCKED_NETWORK**. On a connected trusted machine only: run `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` (on Windows; `sh scripts/generate_lock.sh` is the POSIX equivalent), `node scripts/check_lock.js` (must print `LOCK OK`), then `npm ci`; do not hand-write or fabricate a lock. If this cannot be completed, stop and record BLOCKED_NETWORK.
4. Install the pinned browser dependency only after `npm ci`: `npx playwright install chromium`. Record the exact installed versions.
5. Run `npm run test:strict` and preserve the complete raw output plus `tests/last_run.json`. Report the observed suite/test totals; there is no hard-coded threshold (the R5.2.16.4.4 Linux run reported 57 suites / 853 tests as a reference value only, not a Windows result). PASS requires all requested suites to run, zero failures and zero skips.
6. Run the focused R5 repair suites listed in the R5 integration report. Record their results separately from the full regression.
7. Do not connect to Google or push/deploy code as part of this Windows-only validation. Google TEST is a separate gated procedure.
8. Save logs, environment details and checksums. Mark every step PASS / FAIL / BLOCKED / NOT_RUN; do not infer PASS from a partial run.
