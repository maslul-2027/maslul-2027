// Schema applied idempotently by the Worker on first use (so the owner never runs a migration command) and mirrored to migrations/0001_init.sql by scripts/build_cf_worker.js.
export const SCHEMA_VERSION = 1;
export const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS rows (ord INTEGER PRIMARY KEY AUTOINCREMENT, tbl TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, UNIQUE (tbl, id))',
  'CREATE TABLE IF NOT EXISTS meta (tbl TEXT PRIMARY KEY, ver INTEGER NOT NULL DEFAULT 0)',
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email_h TEXT NOT NULL UNIQUE, email TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'commander', grant_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, access_h TEXT, totp_box TEXT, totp_last INTEGER NOT NULL DEFAULT 0, fails INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, lock_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, approved_by TEXT)",
  'CREATE TABLE IF NOT EXISTS sessions (h TEXT PRIMARY KEY, user_id TEXT NOT NULL, csrf TEXT NOT NULL, created INTEGER NOT NULL, last INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)',
  'CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)',
  'CREATE TABLE IF NOT EXISTS enroll (h TEXT PRIMARY KEY, user_id TEXT NOT NULL, exp INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, totp_box TEXT, access_h TEXT)',
  'CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, ev TEXT NOT NULL, data TEXT)',
  'CREATE TABLE IF NOT EXISTS rate (k TEXT PRIMARY KEY, n INTEGER NOT NULL, win INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, vers TEXT NOT NULL, body TEXT NOT NULL, exp INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS cache_exp ON cache (exp)',
  'CREATE TABLE IF NOT EXISTS schema_version (id INTEGER PRIMARY KEY CHECK (id = 1), v INTEGER NOT NULL)',
  'INSERT OR IGNORE INTO schema_version (id, v) VALUES (1, ' + SCHEMA_VERSION + ')',
];
let ready = false;
export async function ensureSchema(db) {
  if (ready) return;
  let v = 0; try { const r = await db.prepare('SELECT v FROM schema_version WHERE id = 1').first(); v = r ? r.v : 0; } catch (e) { v = 0; }
  if (v < SCHEMA_VERSION) await db.batch(SCHEMA.map(s => db.prepare(s)));
  ready = true;
}
export const resetSchemaCache = () => { ready = false; };
