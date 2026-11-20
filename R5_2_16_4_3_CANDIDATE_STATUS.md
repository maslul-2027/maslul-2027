# MASLUL 2027 — R5.2.16.4.3 Candidate Status

Status: LOCAL VERIFICATION-HARNESS HARDENING CANDIDATE — NOT RELEASE APPROVED
Base: R5.2.16.4.2. This increment requires a successful `npm ls playwright playwright-core --depth=0` exit before continuing the clean-machine verification. It adds a regression test for the case where npm ls fails but npx reports the expected Playwright version.

Changed files: `project/scripts/clean_machine_verify.js`, `project/tests/stg_clean_machine_script.js`, this status/report/manifest documentation only. Application `src/`, scoring, authorization, data schema, Google integration, and Windows preflight logic are unchanged.

Verified locally on 2026-11-18:
- Focused clean-machine script suite: PASS 14/14.
- Product source identity: PASS 4/4.
- JavaScript syntax checks for changed JS files: PASS.
- ZIP integrity and manifests: see handoff report.
- Windows 10 execution: NOT_RUN.
- Full strict/browser regression: NOT_RUN in this environment.
- Google TEST: NOT_RUN. Production: NOT APPROVED.

Use synthetic data only. Do not deploy, push, or connect to Google TEST without separate explicit approval. The candidate must first pass the documented clean Windows 10 installation and full strict/browser regression.
