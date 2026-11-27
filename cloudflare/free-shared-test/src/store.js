// D1 data layer for the REAL engine. The engine is synchronous and works on in-memory tables; D1 is asynchronous. So each request:
//   1. loads only the tables the method needs (ONE batch: versions + rows),  2. runs the engine on a private copy,
//   3. diffs the copy against what was loaded and commits ONE atomic batch, guarded by per-table versions (optimistic concurrency: a concurrent writer => retry).
// Rows are JSON documents keyed (table,id). Statement count per request is small and fixed (see tests/cf_worker.js budget assertions): D1 Free allows 50 queries per invocation.
const GUARD_FAIL = 'integer overflow';   // abs(-9223372036854775808) raises this inside the batch => the whole batch rolls back
export class NeedTables extends Error { constructor(t) { super('NEED_TABLE ' + t); this.tables = t; } }

export async function loadTables(db, tables) {
  const names = Array.from(new Set(tables)).sort(); if (!names.length) return { mem: {}, orig: {}, vers: {} };
  if (names.length > 90) throw new Error('too many tables for one query');
  const ph = names.map(() => '?').join(',');
  const [m, r] = await db.batch([db.prepare('SELECT tbl, ver FROM meta WHERE tbl IN (' + ph + ')').bind(...names), db.prepare('SELECT tbl, id, json FROM rows WHERE tbl IN (' + ph + ') ORDER BY ord').bind(...names)]);
  const vers = {}, mem = {}, orig = {}; names.forEach(n => { vers[n] = 0; mem[n] = []; orig[n] = new Map(); });
  for (const x of m.results) vers[x.tbl] = x.ver;
  for (const x of r.results) { orig[x.tbl].set(x.id, x.json); mem[x.tbl].push(JSON.parse(x.json)); }
  return { mem, orig, vers };
}
/** Compute the change set between what was loaded and what the engine left behind. */
export function diff(loaded, mem, dirty) {
  const ch = [];
  for (const t of Object.keys(loaded.orig)) {
    const dt = dirty && dirty[t]; if (dirty && !dt) continue;   // the host records every row it touches: untouched tables are not even compared (a read-only table costs no stringify)
    const rows = mem[t] || [], seen = new Set(), up = [], del = [];
    for (const r of rows) { const id = r && r.id; if (dt && !dt.all && !dt.ids.has(String(id))) { seen.add(id); continue; } if (typeof id !== 'string' || !id) throw new Error('row without string id in ' + t); if (seen.has(id)) throw new Error('duplicate id in ' + t); seen.add(id); const j = JSON.stringify(r), o = loaded.orig[t].get(id); if (o !== j && (o === undefined || JSON.stringify(JSON.parse(o)) !== j)) up.push(j); }   // D1/SQLite may re-render JSON text: compare normalised before declaring a change
    for (const id of loaded.orig[t].keys()) if (!seen.has(id)) del.push(id);
    if (up.length || del.length) ch.push({ t, up, del });
  }
  return ch;
}
const MAX_PARAM = 900000;   // D1 limits page: a string/BLOB/row is limited to 1,000,000 bytes — stay under it per bound value value
/** items are pre-serialised strings; returns JSON-array strings each below MAX_PARAM. */
export function chunkJson(list) { const out = []; let cur = [], size = 2; for (const j of list) { if (j.length + 1 > MAX_PARAM) throw new Error('row too large for D1'); if (size + j.length + 1 > MAX_PARAM) { out.push('[' + cur.join(',') + ']'); cur = []; size = 2; } cur.push(j); size += j.length + 1; } if (cur.length) out.push('[' + cur.join(',') + ']'); return out; }
export const upsertSql = "INSERT INTO rows (tbl, id, json) SELECT json_extract(value, '$.t'), json_extract(value, '$.j.id'), json_extract(value, '$.j') FROM json_each(?1) WHERE true ON CONFLICT (tbl, id) DO UPDATE SET json = excluded.json";
const deleteSql = "DELETE FROM rows WHERE (tbl, id) IN (SELECT json_extract(value, '$.t'), json_extract(value, '$.id') FROM json_each(?1))";
const bumpSql = "INSERT INTO meta (tbl, ver) SELECT value, 1 FROM json_each(?1) WHERE true ON CONFLICT (tbl) DO UPDATE SET ver = ver + 1";
/** Statements that apply a change set: ALL tables travel together — one upsert statement, one delete statement, one version-bump statement (not one per row or per table). */
export function writeStatements(db, changes) {
  const st = [], ups = [], dels = [];
  for (const c of changes) { const t = JSON.stringify(c.t); c.up.forEach(j => ups.push('{"t":' + t + ',"j":' + j + '}')); c.del.forEach(id => dels.push('{"t":' + t + ',"id":' + JSON.stringify(id) + '}')); }
  for (const part of chunkJson(ups)) st.push(db.prepare(upsertSql).bind(part));
  for (const part of chunkJson(dels)) st.push(db.prepare(deleteSql).bind(part));
  if (changes.length) st.push(db.prepare(bumpSql).bind(JSON.stringify(changes.map(c => c.t))));
  return st;
}
/** Version guard: aborts (rolls back) the batch when ANY table the request depended on changed since it was loaded. */
export function guardStatement(db, vers) {
  const t = Object.keys(vers); if (!t.length) return null; const conds = [], args = [];
  t.forEach((n, i) => { conds.push('COALESCE((SELECT ver FROM meta WHERE tbl = ?' + (2 * i + 1) + '), 0) = ?' + (2 * i + 2)); args.push(n, vers[n]); });
  return db.prepare('SELECT CASE WHEN ' + conds.join(' AND ') + ' THEN 1 ELSE abs(-9223372036854775808) END AS ok').bind(...args);
}
export const isConflict = e => /integer overflow/i.test(String(e && (e.message || e)));
/** Commit changes atomically with the guard; `extra` statements (users, sessions, audit) ride in the same transaction. Returns false on a version conflict. */
export async function commit(db, loaded, changes, extra) {
  const g = changes.length ? guardStatement(db, loaded.vers) : null, st = [].concat(g ? [g] : [], writeStatements(db, changes), extra || []);
  if (!st.length) return true;
  try { await db.batch(st); return true; } catch (e) { if (isConflict(e)) return false; throw e; }
}
export { GUARD_FAIL };
