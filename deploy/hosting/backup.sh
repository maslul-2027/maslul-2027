#!/usr/bin/env bash
# Full encrypted backup (app state + stored files, integrity-checked) with retention, plus an optional age-encrypted copy of secrets.json for an off-box location.
# The .mbk carries NO key: restoring needs the SAME secrets.json (kept separately). Synthetic data only.
set -euo pipefail
ENV="${MASLUL_ENV_FILE:-/etc/maslul/maslul.env}"; [ -r "$ENV" ] && set -a && . "$ENV" && set +a
DATA="${MASLUL_DATA_DIR:-/var/lib/maslul}/server"; OUT="${BACKUP_DIR:-/var/backups/maslul}"; KEEP="${BACKUP_KEEP:-14}"; NODE="${NODE_BIN:-/opt/node/bin/node}"; APP="${MASLUL_APP_DIR:-/opt/maslul}"
umask 077; mkdir -p "$OUT"
TXT="$("$NODE" "$APP/release/launcher.js" --backup --data "$DATA")" || { echo "$TXT" >&2; echo "BACKUP FAILED" >&2; exit 1; }; echo "$TXT"
LINE="$(printf '%s\n' "$TXT" | grep -o '/[^ ]*\.mbk' | head -1)"; [ -n "$LINE" ] && [ -s "$LINE" ] || { echo "BACKUP FAILED: no archive produced" >&2; exit 1; }
mv "$LINE" "$OUT/"; F="$OUT/$(basename "$LINE")"; sha256sum "$F" > "$F.sha256"
if [ -n "${BACKUP_AGE_RECIPIENT:-}" ] && command -v age >/dev/null; then age -r "$BACKUP_AGE_RECIPIENT" -o "$OUT/secrets-$(date -u +%Y%m%dT%H%M%S).json.age" "$DATA/secrets.json"; fi
ls -1t "$OUT"/full-backup-*.mbk 2>/dev/null | tail -n +"$((KEEP+1))" | while read -r old; do rm -f "$old" "$old.sha256"; done
if [ -n "${BACKUP_REMOTE:-}" ]; then rclone copy "$OUT" "$BACKUP_REMOTE" --include 'full-backup-*.mbk*' --include 'secrets-*.age' && echo "off-box copy done"; else echo "NOTE: BACKUP_REMOTE is empty — backups exist only on this server (a server loss loses them). Set an approved off-box destination."; fi
echo "BACKUP OK: $F"
