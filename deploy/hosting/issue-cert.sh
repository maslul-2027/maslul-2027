#!/usr/bin/env bash
# Trusted certificate for MASLUL_NAME via Let's Encrypt DNS-01 (acme.sh + Cloudflare DNS API). No inbound port is opened for validation, so the TEST stays private.
# Needs /etc/maslul/acme.env (mode 0600) containing:  CF_Token=<API token limited to "Zone:DNS:Edit" for the ONE zone>   (placeholder here, never commit it)
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 2; }
. /etc/maslul/maslul.env; . /etc/maslul/acme.env; export CF_Token
ACME=/opt/acme.sh/acme.sh; [ -x "$ACME" ] || { git clone --depth 1 --branch "${ACME_SH_REF:-3.1.1}" https://github.com/acmesh-official/acme.sh /opt/acme.sh.src && (cd /opt/acme.sh.src && ./acme.sh --install --home /opt/acme.sh --nocron --accountemail "${ACME_EMAIL:?set ACME_EMAIL in acme.env}") ; }
install -d -m 750 -o root -g maslul /etc/maslul/tls
"$ACME" --home /opt/acme.sh --issue --dns dns_cf -d "$MASLUL_NAME" --keylength ec-256 --server letsencrypt
"$ACME" --home /opt/acme.sh --install-cert -d "$MASLUL_NAME" --ecc --fullchain-file /etc/maslul/tls/fullchain.pem --key-file /etc/maslul/tls/privkey.pem --reloadcmd "chgrp maslul /etc/maslul/tls/*.pem && chmod 640 /etc/maslul/tls/privkey.pem && systemctl try-restart maslul-test"
echo "Certificate installed for $MASLUL_NAME. Renewal: maslul-cert-renew.timer (daily check, renews inside 30 days)."
