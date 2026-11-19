# R5.2.16.4.4 source inspection — 2026-11-19

**Input:** `MASLUL_2027_R5_2_16_4_4_PRIVACY_SUBCOHORT_CANDIDATE_REV3.zip` (local candidate, not the live Google Apps Script HEAD).

## Verified archive structure
- Archive contains 790 entries.
- `project/src/` contains 44 deployable files: 41 `.gs`, 2 `.html`, 1 `appsscript.json`.
- `Index.html` is approximately 199 KB; this is a substantial single-file UI and should be changed in small, regression-tested steps.

## Preliminary automated string checks
Scanned `project/src/`, `project/package.json` and `project/package-lock.json` for common private-key headers, Google API key patterns, GitHub token prefixes, Google OAuth client secret prefixes, email-like strings, Google script ID-like strings, and Google Apps Script web app URLs. **Zero matches** for those patterns.

This is **not** a comprehensive secret/PII audit. It does not cover all archive files, encoded secrets, credentials with different patterns, or sensitive data implied by business logic. A public import still requires full review.

## UI observations from candidate source
- `Index.html` declares `lang="he"`, `dir="rtl"`, and a responsive viewport.
- It contains a reduced-motion media query and some ARIA live/status semantics.
- Existing behavior must be measured before assuming missing accessibility or performance support.

## Deployment blockers
1. Reconcile the live-only `Setup.gs` pilot-course and synthetic-soldier helper functions with the candidate archive.
2. Publish only reviewed source; never include clasp auth or local script binding files.
3. Run the actual CI suite after source import.
4. Establish authorized Google Apps Script deployment credentials and update the **versioned** existing `/exec` deployment with rollback.

**Result:** candidate inspected; no source published and no live TEST deployment performed in this step.
