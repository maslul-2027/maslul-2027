#!/usr/bin/env bash
# Proves the staging smoke test (tests/ui_staging_smoke.js) is not decorative: applies 8 product-code mutations, ONE AT A TIME, to a TEMP COPY and expects the smoke to fail on each.
# The project itself is never modified. Needs Playwright + Chromium (same as the UI suites). Output: one line per mutation; exit 1 if any mutation SURVIVED or was NOT_APPLIED.
# Usage: bash scripts/smoke_mutations.sh
set -u; SRC="$(cd "$(dirname "$0")/.." && pwd -P)"; TMP="$(mktemp -d)"; BAD=0
m() { # name file old new
  local W="$TMP/$1"; mkdir -p "$W"; (cd "$SRC" && tar cf - --exclude=node_modules --exclude=return --exclude=work .) | (cd "$W" && tar xf -); [ -e "$SRC/node_modules" ] && ln -s "$SRC/node_modules" "$W/node_modules"
  python3 - "$W/$2" "$3" "$4" <<'PY' || { echo "$1 NOT_APPLIED"; BAD=1; return; }
import sys; p,o,n=sys.argv[1:4]; s=open(p,encoding='utf8').read(); assert o in s, "pattern not found"; open(p,'w',encoding='utf8').write(s.replace(o,n,1))
PY
  (cd "$W" && node tests/ui_staging_smoke.js > out.log 2>&1); local r=$?; if [ $r -ne 0 ]; then echo "$1 CAUGHT"; else echo "$1 SURVIVED"; BAD=1; fi; }
m SM1 src/Courses.gs "Policy.require(ctx, 'user.manage', {});
    return Db.all('Users')" "return Db.all('Users')"
m SM2 src/AuthAudit.gs "if (user && !Util.isTrue(user.active) && !bootstrapAdmin) return null;" ""
m SM3 src/Index.html "(r.data.role==='admin'?'מנהל מערכת':'מפקד')" "'מנהל מערכת'"
m SM4 src/Index.html "bar.appendChild(el('button',{id:'addBtn'" "bar.appendChild(el('button',{id:'addBtnX'"
m SM5 src/Code.gs "'backup.create': function (ctx, a) { return Backup.create(" "'backup.create': function (ctx, a) { ctx = {email:'admin@x.com',role:'admin',courseScope:'*'}; return Backup.create("
m SM6 src/Index.html "function isAdmin(){return S.ctx&&S.ctx.role==='admin';}" "function isAdmin(){return true;}"
m SM7 src/Soldiers.gs "if (ctx.role === ROLES.ADMIN) {
      out.record_status" "if (true) {
      out.record_status"
m SM8 src/Forms.gs "FORM_FIELDS: ['full_name', 'pakal', 'enlistment_date']" "FORM_FIELDS: ['full_name', 'pakal', 'enlistment_date', 'personal_number']"
rm -rf "$TMP"; [ $BAD -eq 0 ] && echo "SMOKE MUTATIONS: 8 CAUGHT, 0 SURVIVED, 0 NOT_APPLIED" || echo "SMOKE MUTATIONS: PROBLEM (see above)"; exit $BAD
