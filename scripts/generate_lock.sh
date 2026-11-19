#!/bin/sh
# Generates package-lock.json with REAL npm (needs network to registry.npmjs.org), then checks it against package.json. Run on a machine with open network, review, and add the file to the package.
# Does not install node_modules and runs no package scripts.
set -e; cd "$(dirname "$0")/.."
node -e "if(!/^v22\./.test(process.version)){console.error('Need Node 22.x, found '+process.version);process.exit(1)}"
[ ! -e package-lock.json ] || { echo "package-lock.json already exists — move it away first (nothing overwritten)"; exit 2; }
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
node scripts/check_lock.js
npm ci --dry-run --ignore-scripts >/dev/null && echo "npm ci --dry-run: lock and package.json agree"
echo "Now: review package-lock.json, include it in the package, and run: npm run check-lock"
