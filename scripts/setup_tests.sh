#!/bin/sh
# Reproducible test environment. Needs network access to the npm registry and the Playwright CDN.
# 1) Node 22.x (pinned in .nvmrc: 22.23.4)  2) pinned Playwright (package.json)  3) Chromium  4) verify.
set -e
cd "$(dirname "$0")/.."
node -e "if(!/^v22\./.test(process.version)){console.error('Need Node 22.x, found '+process.version+' (nvm use)');process.exit(1)}"
npm install --no-audit --no-fund
npx playwright install chromium
node tests/env_check.js
echo "Now run: npm run test:strict"
