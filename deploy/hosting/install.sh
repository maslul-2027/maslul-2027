#!/usr/bin/env bash
# MASLUL private TEST — one-shot host bootstrap for a FRESH Ubuntu 24.04 server (SYNTHETIC DATA ONLY). Idempotent: safe to re-run.
# What it does: Node 22 (pinned, checksum-verified) -> app at a pinned commit -> service user -> WireGuard (10.8.0.1) -> firewall (deny all inbound except SSH + UDP 51820; app port only on wg0)
#               -> systemd units (app, backup timer, cert renewal timer) -> first-admin PIN. It does NOT create the server, buy anything, touch DNS, or enrol phones (add-phone.sh does that).
# usage (as root, on the new server):  MASLUL_SHA=<40-hex commit> MASLUL_NAME=<private dns name> ./install.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 2; }
. /etc/os-release; [ "${VERSION_ID:-}" = "24.04" ] || { echo "Ubuntu 24.04 required (found ${PRETTY_NAME:-unknown})"; exit 2; }
SHA="${MASLUL_SHA:?set MASLUL_SHA to the reviewed 40-hex commit}"; [[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "MASLUL_SHA must be 40 hex chars"; exit 2; }
NAME="${MASLUL_NAME:?set MASLUL_NAME, e.g. maslul-test.<your-domain>}"; [[ "$NAME" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || { echo "bad MASLUL_NAME"; exit 2; }
NODE_V="v22.23.4"; REPO="${MASLUL_REPO:-https://github.com/maslul-2027/maslul-2027.git}"
export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get install -y -qq wireguard qrencode ufw git curl ca-certificates openssl xz-utils python3 age rclone >/dev/null
# Node (pinned + checksum)
if [ ! -x /opt/node/bin/node ] || [ "$(/opt/node/bin/node -v)" != "$NODE_V" ]; then T="$(mktemp -d)"; cd "$T"; curl -fsSLO "https://nodejs.org/dist/$NODE_V/node-$NODE_V-linux-x64.tar.xz"; curl -fsSLO "https://nodejs.org/dist/$NODE_V/SHASUMS256.txt"; grep " node-$NODE_V-linux-x64.tar.xz\$" SHASUMS256.txt | sha256sum -c -; rm -rf /opt/node; mkdir -p /opt/node; tar -xJf "node-$NODE_V-linux-x64.tar.xz" -C /opt/node --strip-components=1; cd /; rm -rf "$T"; fi
# service user + dirs
id maslul >/dev/null 2>&1 || useradd --system --home /var/lib/maslul --shell /usr/sbin/nologin maslul
install -d -m 700 -o maslul -g maslul /var/lib/maslul; install -d -m 700 -o maslul -g maslul /var/backups/maslul; install -d -m 750 -o root -g maslul /etc/maslul /etc/maslul/tls
# app at the pinned commit (root-owned, read-only for the service)
if [ ! -d /opt/maslul/.git ]; then git clone -q "$REPO" /opt/maslul; fi; git -C /opt/maslul fetch -q origin "$SHA"; git -C /opt/maslul checkout -q --detach "$SHA"; [ "$(git -C /opt/maslul rev-parse HEAD)" = "$SHA" ] || { echo "commit mismatch"; exit 1; }
(cd /opt/maslul && /opt/node/bin/node scripts/build_native_app.js --server >/dev/null); chown -R root:root /opt/maslul; chmod -R go-w /opt/maslul
# WireGuard (server side)
umask 077; install -d -m 700 /etc/wireguard /etc/wireguard/clients
if [ ! -s /etc/wireguard/wg0.conf ]; then K="$(wg genkey)"; sed "s|__SERVER_PRIVATE_KEY__|$K|" /opt/maslul/deploy/hosting/wg0.conf.template > /etc/wireguard/wg0.conf; fi; chmod 600 /etc/wireguard/wg0.conf
systemctl enable --now wg-quick@wg0 >/dev/null
# Firewall: nothing inbound except SSH and WireGuard; the app port is reachable ONLY from inside the tunnel
ufw --force reset >/dev/null; ufw default deny incoming >/dev/null; ufw default allow outgoing >/dev/null; ufw limit 22/tcp >/dev/null; ufw allow 51820/udp >/dev/null; ufw allow in on wg0 to 10.8.0.1 port 8443 proto tcp >/dev/null; ufw --force enable >/dev/null
# SSH: keys only (refuses to lock you out if no key is installed)
if [ -s /root/.ssh/authorized_keys ]; then printf 'PasswordAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/90-maslul.conf; systemctl reload ssh || true; else echo "WARNING: no SSH key in /root/.ssh/authorized_keys — password SSH left as is. Install a key, then re-run."; fi
# env (first run only): random synthetic admin PIN, never printed to logs
if [ ! -s /etc/maslul/maslul.env ]; then PIN="$(python3 -c 'import secrets;print(next(p for p in (("%04d"%secrets.randbelow(10000)) for _ in iter(int,1)) if len(set(p))>=3 and p not in ("1234","0123","2345","3456","4567","5678","6789")))')"
  sed -e "s|^MASLUL_NAME=.*|MASLUL_NAME=$NAME|" -e "s|^MASLUL_SEED_ADMIN_PIN=.*|MASLUL_SEED_ADMIN_PIN=$PIN|" /opt/maslul/deploy/hosting/env.example > /etc/maslul/maslul.env; chown root:maslul /etc/maslul/maslul.env; chmod 640 /etc/maslul/maslul.env
  printf 'MASLUL TEST SYNTHETIC admin\nphone 0500000001\nPIN %s\n(delete this file after the first login)\n' "$PIN" > /root/ADMIN-LOGIN-SYNTHETIC.txt; chmod 600 /root/ADMIN-LOGIN-SYNTHETIC.txt; fi
# units
for u in maslul-test.service maslul-backup.service maslul-backup.timer maslul-cert-renew.service maslul-cert-renew.timer; do install -m 644 /opt/maslul/deploy/hosting/$u /etc/systemd/system/$u; done; systemctl daemon-reload
systemctl enable --now maslul-backup.timer >/dev/null
if [ -s /etc/maslul/acme.env ] && [ ! -s /etc/maslul/tls/fullchain.pem ]; then /opt/maslul/deploy/hosting/issue-cert.sh; fi
if [ -s /etc/maslul/tls/fullchain.pem ]; then systemctl enable --now maslul-cert-renew.timer >/dev/null; systemctl enable --now maslul-test.service; sleep 3; systemctl --no-pager --lines=5 status maslul-test.service || true
  grep -q '^MASLUL_SEED_ADMIN_PIN=CHANGE' /etc/maslul/maslul.env || { [ -s /var/lib/maslul/server/state.bin ] && sed -i 's|^MASLUL_SEED_ADMIN_PIN=.*|MASLUL_SEED_ADMIN_PIN=REMOVED_AFTER_FIRST_START|' /etc/maslul/maslul.env; }
else echo; echo "NEXT: the certificate is missing. Put the DNS API token + ACME_EMAIL in /etc/maslul/acme.env (mode 600) and run: /opt/maslul/deploy/hosting/issue-cert.sh  — then re-run this script."; fi
echo; echo "Enrol each phone:  /opt/maslul/deploy/hosting/add-phone.sh phone-a   (then phone-b)   DNS: create  A  $NAME -> 10.8.0.1  (DNS only, not proxied)"
