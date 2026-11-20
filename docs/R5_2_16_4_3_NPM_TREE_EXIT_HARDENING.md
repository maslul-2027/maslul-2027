# R5.2.16.4.3 — npm dependency-tree exit hardening

Date: 2026-11-18

## Finding
The Windows-capable clean-machine verifier executed `npm ls playwright playwright-core --depth=0` but discarded its exit status. It then relied on the following `npx playwright --version` result and a version-string search in the combined log. A dependency-tree validation failure could therefore be masked if the npx version command succeeded and printed the expected version.

## Change
- Capture and require a zero exit status from `npm ls`.
- Report a distinct failing step and preserve the existing FAIL semantics.
- Keep the subsequent `npx --no-install playwright --version` check separate.
- No application source, scoring, authorization, data schema, Google integration, or Windows preflight behavior changed.

## Verification
- `node tests/stg_clean_machine_script.js`: PASS 14/14 (including new regression that makes npm ls fail while npx reports the expected Playwright version).
- `node tests/src_identity.js`: PASS 4/4; product source identity unchanged.
- `node --check scripts/clean_machine_verify.js`: PASS.
- `node --check tests/stg_clean_machine_script.js`: PASS.
- Windows 10 runtime: NOT_RUN.
- Full strict/browser regression: NOT_RUN in this environment.
- Google TEST: NOT_RUN. Production: NOT APPROVED.

Synthetic data only. Do not deploy, push, or connect to Google TEST without separate explicit approval.
