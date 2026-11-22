#!/usr/bin/env bash
# Remove ONE enrolled phone (lost/finished): its key stops working immediately. usage: sudo ./revoke-phone.sh phone-a
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 2; }
NAME="${1:?usage: revoke-phone.sh <label>}"; CONF=/etc/wireguard/wg0.conf; F=/etc/wireguard/clients/$NAME.conf; [ -e "$F" ] || { echo "unknown phone $NAME"; exit 2; }
PUB="$(grep '^PrivateKey' "$F" | awk '{print $3}' | wg pubkey)"; wg set wg0 peer "$PUB" remove || true
python3 - "$CONF" "$NAME" <<'PY'
import re,sys
p,n=sys.argv[1],sys.argv[2]; s=open(p).read(); s=re.sub(r'\n# '+re.escape(n)+r'\n\[Peer\]\n[^\[]*','\n',s); open(p,'w').write(s)
PY
shred -u "$F" 2>/dev/null || rm -f "$F"; echo "Revoked $NAME."
