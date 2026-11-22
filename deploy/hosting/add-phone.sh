#!/usr/bin/env bash
# Enrol ONE phone: creates a WireGuard key pair, registers the peer (/32 only) and prints the phone's config as a QR code. The private key never leaves this server except as the QR/config for that phone.
# usage: sudo ./add-phone.sh phone-a [PUBLIC_IP_OR_NAME]
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 2; }
NAME="${1:?usage: add-phone.sh <label like phone-a> [server-public-ip-or-name]}"; [[ "$NAME" =~ ^[a-z0-9-]{1,20}$ ]] || { echo "label: a-z 0-9 - only"; exit 2; }
ENDPOINT="${2:-$(curl -fsS https://api.ipify.org || true)}"; [ -n "$ENDPOINT" ] || { echo "give the server public IP/name as 2nd argument"; exit 2; }
CONF=/etc/wireguard/wg0.conf; DIR=/etc/wireguard/clients; install -d -m 700 "$DIR"
[ ! -e "$DIR/$NAME.conf" ] || { echo "$NAME already enrolled (revoke-phone.sh first)"; exit 2; }
N=2; while grep -q "AllowedIPs = 10.8.0.$N/32" "$CONF"; do N=$((N+1)); done; [ "$N" -le 20 ] || { echo "limit: 19 phones for this TEST"; exit 2; }
umask 077; PRIV="$(wg genkey)"; PUB="$(printf %s "$PRIV" | wg pubkey)"; SRVPUB="$(wg show wg0 public-key 2>/dev/null || (grep '^PrivateKey' $CONF | awk '{print $3}' | wg pubkey))"
printf '\n# %s\n[Peer]\nPublicKey = %s\nAllowedIPs = 10.8.0.%s/32\n' "$NAME" "$PUB" "$N" >> "$CONF"; wg set wg0 peer "$PUB" allowed-ips "10.8.0.$N/32" 2>/dev/null || true
cat > "$DIR/$NAME.conf" <<CFG
[Interface]
PrivateKey = $PRIV
Address = 10.8.0.$N/32

[Peer]
PublicKey = $SRVPUB
Endpoint = $ENDPOINT:51820
# Only the TEST server's tunnel address goes through the tunnel; everything else on the phone is untouched.
AllowedIPs = 10.8.0.1/32
PersistentKeepalive = 25
CFG
echo "Enrolled $NAME as 10.8.0.$N. Scan this QR in the official WireGuard app on THAT phone only:"; qrencode -t ansiutf8 < "$DIR/$NAME.conf"; echo "(config also stored root-only at $DIR/$NAME.conf; delete it after scanning if you prefer)"
