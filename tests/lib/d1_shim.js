'use strict';
// Local stand-in for Cloudflare D1 built on node:sqlite (real SQLite, real transactions) with the same asynchronous prepare/bind/first/all/run/batch API.
// It lets the Worker code run in plain Node with NO network and NO account. It is NOT proof of Cloudflare behaviour: CI additionally runs the same tests against `wrangler dev` (workerd + local D1),
// and the 10 ms CPU limit exists only on Cloudflare (see docs/CLOUDFLARE_FREE_TEST.md). It also counts statements per "invocation" to assert the Free-plan budget (50 queries per Worker invocation).
const { DatabaseSync } = require('node:sqlite');
class Stmt {
  constructor(d, sql, args) { this.d = d; this.sql = sql; this.args = args || []; }
  bind(...a) { return new Stmt(this.d, this.sql, a); }
  _exec(mode) {
    const d = this.d; d.stats.statements++; d.inv.statements++; const c0 = process.cpuUsage(); try { return this._run(d); } finally { const c = process.cpuUsage(c0); d.cpuUs += c.user + c.system; }
  }
  _run(d) {
    const st = d.db.prepare(this.sql); this.args.forEach((a, i) => { if (a === undefined) throw new TypeError('D1 shim: undefined bound to parameter ' + (i + 1) + ' of: ' + this.sql.slice(0, 120)); });   // real D1 rejects undefined too
    if (/^\s*(select|with)/i.test(this.sql) || /\breturning\b/i.test(this.sql)) { const rows = st.all(...this.args); d.stats.rowsRead += rows.length; d.inv.rowsRead += rows.length; if (/^\s*(insert|update|delete)/i.test(this.sql)) { d.stats.rowsWritten += rows.length; d.inv.rowsWritten += rows.length; } return { results: rows.map(r => Object.assign({}, r)), success: true, meta: { changes: 0, rows_read: rows.length } }; }
    const r = st.run(...this.args); d.stats.rowsWritten += Number(r.changes); d.inv.rowsWritten += Number(r.changes); return { results: [], success: true, meta: { changes: Number(r.changes), rows_written: Number(r.changes) } };
  }
  async first(col) { const r = this._exec(); const row = r.results[0] || null; return col && row ? row[col] : row; }
  async all() { return this._exec(); }
  async run() { return this._exec(); }
  async raw() { return this._exec().results.map(r => Object.values(r)); }
}
class D1 {
  constructor(file) { this.db = new DatabaseSync(file || ':memory:'); this.stats = { statements: 0, rowsRead: 0, rowsWritten: 0 }; this.inv = { statements: 0, rowsRead: 0, rowsWritten: 0 }; this.batches = 0; this.cpuUs = 0; }
  prepare(sql) { return new Stmt(this, sql); }
  /** one Worker invocation = one counter window */
  resetInvocation() { const x = this.inv; this.inv = { statements: 0, rowsRead: 0, rowsWritten: 0 }; return x; }
  async batch(list) {
    this.batches++; this.db.exec('BEGIN');
    try { const out = list.map(s => s._exec()); this.db.exec('COMMIT'); return out; } catch (e) { try { this.db.exec('ROLLBACK'); } catch (x) { /* already rolled back */ } throw e; }
  }
  async exec(sql) { this.db.exec(sql); }
}
module.exports = { D1 };
