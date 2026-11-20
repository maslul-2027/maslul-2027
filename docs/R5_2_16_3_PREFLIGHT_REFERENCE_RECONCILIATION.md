# R5.2.16.3 — Preflight reference reconciliation

Date: 2026-11-18

## Finding
An independent inspection of the R5.2.16.2 archive found that the embedded `scripts/windows_preflight.ps1` and `docs/INSTALL_CLEAN_MACHINE.md` still named the R5.2.16.1 archive, despite the external handoff using R5.2.16.2. The script bytes matched the standalone script, but its usage comment and banner were stale. The install guide also had stale archive names in both command examples.

## Change
Documentation/operational-reference-only correction:
- Updated the PowerShell usage example to the exact R5.2.16.2 archive filename.
- Updated the script banner to R5.2.16.2.
- Updated both archive filename examples in `docs/INSTALL_CLEAN_MACHINE.md`.
- No product source, tests, scoring, permissions, Google configuration, package metadata, or runtime logic changed.

## Verification
- Exact stale active references to `R5_2_16_1_DOCUMENTATION_RECONCILED_CANDIDATE.zip` in active Windows preflight/install instructions: 0.
- The standalone script and embedded script are byte-identical after correction.
- PowerShell runtime execution remains NOT_RUN (no Windows/PowerShell runtime in this environment).
- ZIP integrity verified after packaging.

## Status
This is a small operational documentation correction, not a Windows test pass and not production approval. Windows 10 preflight, npm lock generation, Playwright installation, full strict regression, Google TEST, screen-reader/device testing and external InfoSec remain separate gates.
