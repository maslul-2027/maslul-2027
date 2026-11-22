#!/usr/bin/env bash
# Clean-machine verification for the Course Tracker staging-prep package. Fail-fast: any failed step stops the run (exit != 0, RESULT: FAIL).
# Usage: bash scripts/clean_machine_verify.sh <package.zip> <expected_sha256> [--mutations]
# Result values (return/STATUS.txt, last "RESULT:" line; exit code): PASS (0) = every step ran AND package-lock.json came inside the package;
#   PASS_WITH_UNVERIFIED_LOCK (3) = every step ran but the lock was GENERATED in this run (ALLOW_NEW_LOCK=1) — it has not been reviewed, so this is NOT a full PASS;
#   BLOCKED_NETWORK (4) = a step failed only because npm/Playwright could not be downloaded (nothing verified); FAIL (1) = a step failed; usage / leftover-evidence refusal = exit 2.
# All outputs go to ABSOLUTE paths fixed at start (return/ and work/ next to the directory the script was started from), also after "cd" into the project.
# Needs: Node v22.23.4 exactly, npm 10.x, unzip, sha256sum (or shasum), network to registry.npmjs.org + the Playwright CDN.
# Fresh-install proof: refuses a package that already contains node_modules; npm ci from the lock only; pinned Playwright re-checked; Chromium downloaded into a NEW folder; then npm run test:ci.
# NOT YET EXECUTED on a real clean machine (see docs/INSTALL_CLEAN_MACHINE.md). Only the failure paths were exercised in the build environment.
set -u
EXP_NODE="v22.23.4"; EXP_SUITES=74; EXP_MUT=167
ZIP="${1:-}"; SHA="${2:-}"; MUT="${3:-}"
ORIG="$(pwd -P)"; OUT="$ORIG/return"; WORK="$ORIG/work"          # absolute, fixed BEFORE any cd
case "$ZIP" in /*|"") ;; *) ZIP="$ORIG/$ZIP";; esac
# test hook (used only by tests/stg_clean_machine_script.js): CT_INJECT_FAIL=<step number> fails that step on purpose
inject() { [ "${CT_INJECT_FAIL:-}" != "$1" ] || stop "injected failure at step $1 (test hook)"; }
stop() { echo "FAILED at step: $1"; mkdir -p "$OUT"
  # a failure caused only by the network (registry / Playwright CDN unreachable) is BLOCKED, not a product/test failure and never a PASS
  NETLOGS=""; for f in "$OUT"/npm_*.log "$OUT"/playwright_install.log; do [ -f "$f" ] && NETLOGS="$NETLOGS $f"; done
  if [ -n "$NETLOGS" ] && grep -qE "ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTCACHED|getaddrinfo|npm error network|403 Forbidden|Download failed" $NETLOGS 2>/dev/null; then
    { echo "FAILED at step: $1"; echo "RESULT: BLOCKED_NETWORK — the install could not reach the registry / Playwright CDN; nothing was verified"; } > "$OUT/STATUS.txt"; echo "RESULT: BLOCKED_NETWORK — stopped at step: $1 (no network to npm/Playwright). This is NOT a pass. Return '$OUT/'."; exit 4; fi
  { echo "FAILED at step: $1"; echo "RESULT: FAIL"; } > "$OUT/STATUS.txt"; echo "RESULT: FAIL — stopped; return the folder '$OUT/' for analysis"; exit 1; }
[ -n "$ZIP" ] && [ -n "$SHA" ] || { echo "usage: $0 <package.zip> <expected_sha256> [--mutations]"; exit 2; }
[ ! -e "$OUT" ] && [ ! -e "$WORK" ] || { echo "'$OUT' or '$WORK' already exists from a previous run — archive them first (mv return return_old; mv work work_old). Nothing deleted or overwritten."; exit 2; }
mkdir -p "$OUT" "$WORK" || stop "mkdir"
log() { echo "== $*" | tee -a "$OUT/steps.log"; }
log "1 sha256 of the package"
[ -f "$ZIP" ] || stop "package file not found"
if command -v sha256sum >/dev/null 2>&1; then GOT="$(sha256sum "$ZIP" | cut -d' ' -f1)"; else GOT="$(shasum -a 256 "$ZIP" | cut -d' ' -f1)"; fi
echo "$GOT  $(basename "$ZIP")" > "$OUT/SHA256SUMS_package.txt"
[ "$GOT" = "$SHA" ] || stop "sha256 mismatch (got $GOT)"
log "2 tool versions"
{ echo "node $(node -v)"; echo "npm $(npm -v)"; uname -a; echo "user $(id -un) uid=$(id -u)"; } > "$OUT/versions.txt" 2>&1 || stop "node/npm not found"
[ "$(node -v)" = "$EXP_NODE" ] || stop "node version is $(node -v), required $EXP_NODE"
case "$(npm -v)" in 10.*) ;; *) stop "npm version is $(npm -v), required 10.x";; esac
inject 2
log "3 extract"
unzip -q "$ZIP" -d "$WORK" || stop "unzip"
PROJ="$(find "$WORK" -maxdepth 2 -name package.json -not -path '*/node_modules/*' | head -1 | xargs -r dirname)"
[ -n "$PROJ" ] || stop "package.json not found in the archive"
PROJ="$(cd "$PROJ" && pwd -P)" || stop "resolve project path"
cd "$PROJ" || stop "cd project"
[ ! -e node_modules ] || stop "node_modules is present in the extracted package — this would not be a clean install"
inject 3
log "4 package-lock.json"
if [ ! -f package-lock.json ]; then
  [ "${ALLOW_NEW_LOCK:-0}" = "1" ] || stop "no package-lock.json in the package (generate it via the lock-transfer flow, or rerun with ALLOW_NEW_LOCK=1 to create one here — it will be UNVERIFIED and must be returned)"
  npm install --package-lock-only --ignore-scripts > "$OUT"/npm_lock.log 2>&1 || stop "npm install --package-lock-only"
  LOCK_STATE="UNVERIFIED"
else LOCK_STATE="SHIPPED"; fi
[ -f package-lock.json ] || stop "package-lock.json missing after step 4"
cp package-lock.json "$OUT"/package-lock.json || stop "saving package-lock.json to $OUT"
{ if command -v sha256sum >/dev/null 2>&1; then sha256sum package-lock.json; else shasum -a 256 package-lock.json; fi; } > "$OUT/package-lock.sha256.txt"
inject 4
log "5 npm ci (installs ONLY from the lock; fails if package.json and the lock disagree)"
unset NODE_PATH PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD     # nothing from the machine-wide environment may satisfy the install
npm ci > "$OUT"/npm_ci.log 2>&1 || stop "npm ci"
{ npm ls playwright playwright-core --depth=0; npx --no-install playwright --version; } > "$OUT"/npm_ls.log 2>&1 || stop "npm ls playwright"
grep -q "1\.63\.0" "$OUT"/npm_ls.log || stop "installed playwright is not the pinned 1.63.0"
inject 5
log "6 playwright chromium (downloaded into a fresh browsers folder inside the work dir — no machine-wide cache is reused)"
unset PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD NODE_PATH; export PLAYWRIGHT_BROWSERS_PATH="$WORK/pw-browsers"
npx playwright install chromium > "$OUT"/playwright_install.log 2>&1 || stop "playwright install chromium"
inject 6
log "7 env check"
env -u NODE_PATH node tests/env_check.js > "$OUT"/env_check.log 2>&1 || stop "env_check"
grep -q "ENV: OK" "$OUT"/env_check.log || stop "env_check did not report ENV: OK"
inject 7
log "8 test:ci (= env check + run_all --ui --strict)"
env -u NODE_PATH npm run test:ci > "$OUT"/test_strict.log 2>&1; RC=$?
[ $RC -eq 0 ] || stop "test:ci exit code $RC"
SUITE_LINE="$(grep -E '^SUITES: [0-9]+ total — [0-9]+ PASS, 0 FAIL, 0 SKIP$' "$OUT"/test_strict.log || true)"
[ "$SUITE_LINE" = "SUITES: $EXP_SUITES total — $EXP_SUITES PASS, 0 FAIL, 0 SKIP" ] || stop "suite summary differs from expected all-pass state ($EXP_SUITES suites)"
TEST_LINE="$(grep -E '^TESTS RUN: [0-9]+ — passed [0-9]+, failed 0$' "$OUT"/test_strict.log || true)"
TEST_TOTAL="$(printf '%s' "$TEST_LINE" | sed -nE 's/^TESTS RUN: ([0-9]+) — passed ([0-9]+), failed 0$/\1/p')"
TEST_PASS="$(printf '%s' "$TEST_LINE" | sed -nE 's/^TESTS RUN: ([0-9]+) — passed ([0-9]+), failed 0$/\2/p')"
[ -n "$TEST_TOTAL" ] && [ "$TEST_TOTAL" -gt 0 ] && [ "$TEST_TOTAL" = "$TEST_PASS" ] || stop "test summary is missing, empty, or not all-pass"
BROWSER="$(grep -Eo '\| browser [0-9]+ \| suites run: [0-9]+/[0-9]+' "$OUT"/test_strict.log | tail -1 || true)"
printf '%s' "$BROWSER" | grep -Eq "\| browser [1-9][0-9]* \| suites run: $EXP_SUITES/$EXP_SUITES$" || stop "browser suites did not run or suite breakdown is inconsistent"
grep -q "RESULT: ALL SUITES RAN AND PASSED" "$OUT"/test_strict.log || stop "missing final PASS line"
! grep -qE "^(FAIL|SKIP) " "$OUT"/test_strict.log || stop "FAIL/SKIP line present"
inject 8
if [ "$MUT" = "--mutations" ]; then
  log "9 mutations (slow)"
  cp tests/mutation_results.json "$OUT"/mutation_results_shipped.json 2>/dev/null; mv tests/mutation_results.json tests/mutation_results.shipped.bak 2>/dev/null
  env -u NODE_PATH bash scripts/smoke_mutations.sh > "$OUT"/smoke_mutations.log 2>&1 || stop "smoke mutations"
  grep -q "SMOKE MUTATIONS: 8 CAUGHT, 0 SURVIVED, 0 NOT_APPLIED" "$OUT"/smoke_mutations.log || stop "smoke mutation summary differs from expected (8)"
  env -u NODE_PATH node scripts/mutation_run.js --ui > "$OUT"/mutations.log 2>&1 || stop "mutation run exit code"
  grep -q "MUTATIONS: $EXP_MUT — CAUGHT $EXP_MUT, SURVIVED 0, NOT_APPLIED 0, NOT_RUN 0" "$OUT"/mutations.log || stop "mutation summary differs from expected ($EXP_MUT)"
fi
inject 9
log "10 package unchanged by the run"
cd "$ORIG" || stop "cd back"
( cd "$WORK" && find . -path '*/node_modules' -prune -o -type f -print | sort | xargs sha256sum ) > "$OUT/SHA256SUMS_tree_after.txt" 2>/dev/null
if [ "$LOCK_STATE" = "SHIPPED" ]; then
  { echo "LOCK: SHIPPED_IN_PACKAGE (sha256 in package-lock.sha256.txt) — not generated by this run"; echo "RESULT: PASS (all steps completed on THIS machine, with the package's own lock)"; } | tee "$OUT/STATUS.txt"
  echo "DONE — return the folder '$OUT/' (zip it)."; exit 0
else
  { echo "LOCK: UNVERIFIED — package-lock.json was GENERATED in this run (ALLOW_NEW_LOCK=1); it must be reviewed/compared (lock-transfer flow) before it is trusted or added to a package"; echo "RESULT: PASS_WITH_UNVERIFIED_LOCK (all steps ran, but this is NOT a full PASS)"; } | tee "$OUT/STATUS.txt"
  echo "DONE — return '$OUT/' INCLUDING package-lock.json and package-lock.sha256.txt; a full PASS requires the reviewed lock."; exit 3
fi
