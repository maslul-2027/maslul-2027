#!/usr/bin/env bash
# CI helper: runs the Worker under workerd (`wrangler dev --local`, local D1 from migrations) and drives it over HTTP. LOOPBACK ONLY, random secrets, no Cloudflare account.
# Server and tests live in ONE shell on purpose: background processes started in an earlier workflow step are not guaranteed to survive into the next one.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; PKG="$ROOT/cloudflare/free-shared-test"; TMP="${RUNNER_TEMP:-/tmp}"; PORT=8787; BASE="http://127.0.0.1:$PORT"
SERVER_PID=""
stop() { if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null || true; pkill -x workerd 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; SERVER_PID=""; fi; sleep 2; }
trap stop EXIT
start() {  # $1 = log file, $2 = persist dir (fresh)
  rm -rf "$2"; mkdir -p "$2"
  BOOT="$(openssl rand -hex 24)"; SECRET="$(openssl rand -hex 32)"; echo "::add-mask::$BOOT"; echo "::add-mask::$SECRET"
  printf 'APP_SECRET=%s\nBOOTSTRAP_TOKEN=%s\nALLOW_LOCAL_HTTP=1\n' "$SECRET" "$BOOT" > "$PKG/.dev.vars"; export CF_BOOTSTRAP_TOKEN="$BOOT"
  (cd "$PKG" && npx wrangler d1 migrations apply DB --local --persist-to "$2" >> "$1" 2>&1)
  (cd "$PKG" && exec npx wrangler dev --local --ip 127.0.0.1 --port "$PORT" --persist-to "$2" >> "$1" 2>&1) &
  SERVER_PID=$!
  for i in $(seq 1 90); do curl -fsS "$BASE/auth/status" >/dev/null 2>&1 && return 0; sleep 2; done
  echo "workerd did not become ready"; tail -n 80 "$1"; return 1
}
RC=0
echo "== 1/2 scenarios over HTTP against workerd =="
start "$TMP/wrangler.log" "$TMP/d1a" || exit 1
curl -fsS "$BASE/auth/status"; echo
node "$ROOT/scripts/cf_ci_smoke.js" "$BASE" | tee "$TMP/smoke_local.txt"; grep -q '^RESULT=READY$' "$TMP/smoke_local.txt" || { echo "local workerd smoke is not READY"; RC=1; }
( cd "$ROOT" && CF_BASE_URL="$BASE" timeout 600 node tests/cf_worker.js ) || { RC=1; echo "--- wrangler log ---"; tail -n 120 "$TMP/wrangler.log"; }
stop
echo "== 2/2 two-phone browser E2E on one database (fresh state) =="
start "$TMP/wrangler2.log" "$TMP/d1b" || exit 1
( cd "$ROOT" && CF_BASE_URL="$BASE" timeout 600 node scripts/e2e_cf_browser.js artifacts/cf_browser ) || { RC=1; echo "--- wrangler log ---"; tail -n 120 "$TMP/wrangler2.log"; }
echo "== auth screen: 5 viewports x 3 modes + not-configured state (screenshots, layout, keyboard, reduced motion) =="
( cd "$ROOT" && timeout 300 node scripts/cf_auth_screens.js artifacts/cf_screens ) || RC=1
exit $RC
