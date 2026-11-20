# package-lock.json — status: BLOCKED_NETWORK (never written by hand)
On a machine with open network (Windows gate: Node v22.23.4 exactly and npm 10.x; `sh scripts/generate_lock.sh` accepts any Node 22.x):
1. Unzip the package; `cd project`.
2. `sh scripts/generate_lock.sh` (= `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, then `node scripts/check_lock.js`, then `npm ci --dry-run`). Windows: run the same npm command and `node scripts\check_lock.js`.
3. Review `package-lock.json` (only the pinned devDependencies such as Playwright; no unexpected registries), add it to the package, run `npm run check-lock` (exit 0) and `npm ci` + `npm run test:strict`.
4. Commit the lock together with its SHA-256. Do not claim `npm ci` passed before it did.
