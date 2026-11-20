# R5.2.16.4.4 — ZIP decompression boundary hardening

## Finding
The ZIP reader previously called `inflateRawSync(raw)` without an output ceiling and only compared the decompressed byte count with the central-directory `uncompressed size` after inflation. A crafted archive could under-report that size and cause allocation beyond the configured per-entry/aggregate limits before rejection.

## Change
- `entryData` accepts an explicit maximum output size.
- Deflate uses `zlib.inflateRawSync(raw, { maxOutputLength })`, so the ceiling is enforced during decompression, not after allocation.
- The ceiling is the minimum of `maxEntryBytes` and the remaining `maxTotalBytes` budget.
- Compressed-data offsets and lengths are checked against archive bounds before slicing/inflating.
- The existing exact-size and CRC checks remain in place.

## Regression
A synthetic ZIP is built with a 1 MiB highly compressible entry, then its central-directory uncompressed-size field is forged to 1 byte. Extraction with a 64-byte entry ceiling must throw and must not create the destination directory.

## Results
- `node tests/stg_clean_machine_script.js`: 15/15 PASS.
- `node tests/src_identity.js`: 4/4 PASS.
- Windows runtime, full Playwright strict suite, and Google TEST remain NOT_RUN.
