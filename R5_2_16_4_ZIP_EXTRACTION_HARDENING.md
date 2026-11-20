# R5.2.16.4 — ZIP extraction hardening

Date: 2026-11-18

Scope: packaging/preflight ZIP reader only (`scripts/lib/zipnode.js`) and focused regression test (`tests/stg_clean_machine_script.js`). No application `.gs` files, scoring rules, authorization, data schema, or Google integration changed.

## Changes
- Reject Windows-invalid path characters, control characters, ADS colon syntax, trailing dots/spaces, reserved DOS device basenames (including extensions), traversal, absolute paths, and backslashes.
- Reject duplicate names and case-insensitive collisions, plus file/directory prefix conflicts.
- Enforce configurable entry-count, per-entry uncompressed-size, and total uncompressed-size limits (defaults: 10,000 entries; 64 MiB per entry; 512 MiB total).
- Validate central-directory and local-header bounds and require local/central member names to match.
- Decode and CRC-check all file entries before creating the destination tree; use exclusive file creation.
- Preserve existing CRC and symlink rejection behavior.

## Verification
- `node tests/stg_clean_machine_script.js`: PASS, 13/13 (3 unit, 3 integration, 7 hardening).
- `node tests/src_identity.js`: PASS, 4/4; product source identity unchanged.
- Synthetic runtime probes: PASS for rejection of reserved names, trailing dot/space, ADS, duplicates, case-fold collisions, prefix conflicts; valid nested round-trip passed.
- Full `node tests/run_all.js`: NOT VERIFIED. Environment reported Playwright and Chromium missing; command did not complete within the execution window.
- Windows 10 runtime: NOT_RUN.
- Google TEST / production: NOT_RUN / NOT APPROVED.

This is a packaging hardening candidate, not a release approval. Continue with full strict regression on a clean Windows 10 machine before any Google TEST gate.
