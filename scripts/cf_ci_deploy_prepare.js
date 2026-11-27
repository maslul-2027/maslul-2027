'use strict';
// CI helper for .github/workflows/cloudflare-deploy-test.yml (GitHub Actions -> Wrangler; NO Cloudflare GitHub App).
// Makes the D1 binding deterministic instead of relying on beta auto-provisioning:
//   1) `wrangler d1 list --json` -> find database "maslul-test-db"; 2) if missing: `wrangler d1 create` (idempotent: never touches an existing DB);
//   3) writes cloudflare/free-shared-test/wrangler.deploy.toml = wrangler.toml + database_id (generated file, git-ignored, never committed).
// The pure functions are unit-tested in tests/cf_static.js; the wrangler/network calls are NOT_RUN until a real account exists. Prints no secrets.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const NAME = 'maslul-test-db';
function findDb(listJson, name) { let a; try { a = JSON.parse(listJson); } catch (e) { throw new Error('wrangler d1 list --json did not return JSON'); } if (!Array.isArray(a)) throw new Error('unexpected d1 list shape'); const m = a.filter(x => x && x.name === name); if (m.length > 1) throw new Error('more than one database named ' + name); return m.length ? String(m[0].uuid || m[0].id || '') : ''; }
function patchToml(toml, uuid) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) throw new Error('database id is not a UUID');
  const re = /(\[\[d1_databases\]\][^\[]*?database_name\s*=\s*"maslul-test-db"[^\n]*\n)/; if (!re.test(toml)) throw new Error('d1_databases block for maslul-test-db not found');
  if (/database_id\s*=/.test(toml)) throw new Error('wrangler.toml must not carry a database_id (it is injected at deploy time only)');
  return toml.replace(re, '$1database_id = "' + uuid + '"\n');
}
module.exports = { findDb, patchToml, NAME };
if (require.main === module) {
  const dir = path.join(__dirname, '..', 'cloudflare', 'free-shared-test'), run = a => cp.execFileSync('npx', ['wrangler'].concat(a), { cwd: dir, encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'inherit'] });
  let id = findDb(run(['d1', 'list', '--json']), NAME);
  if (!id) { console.log('D1 "' + NAME + '" not found -> creating it (Free plan)'); run(['d1', 'create', NAME]); id = findDb(run(['d1', 'list', '--json']), NAME); }
  if (!id) throw new Error('database still not visible after create');
  fs.writeFileSync(path.join(dir, 'wrangler.deploy.toml'), patchToml(fs.readFileSync(path.join(dir, 'wrangler.toml'), 'utf8'), id)); console.log('D1 binding DB -> ' + NAME + ' (id ' + id.slice(0, 8) + '…) written to wrangler.deploy.toml');
}
