'use strict';
// MASLUL next-backend: durable PRIVATE-TEST state adapter (synthetic data only; NOT a production database — see docs/AUTH_TEST_ADAPTER_PLAN.md).
// Properties: atomic file replace (tmp + fsync + rename), serialized writers, AES-256-GCM encryption at rest, tamper-evident audit hash chain,
// encrypted integrity-checked backup/restore that fails closed. Single process only: multiple instances need a real transactional database (open gate).
const fs = require('fs'), crypto = require('crypto'), path = require('path');
class StoreError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }
const EMPTY = () => ({ v: 1, users: [], requests: [], sessions: [], ipHits: {}, resets: [], audit: [], records: [] });
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const entryHash = (prev, e) => sha(prev + '|' + JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'h' && k !== 'prev').sort())));
/** Add prev/h to entries that lack them and verify the whole chain. @throws StoreError AUDIT_TAMPERED */
function chainAudit(audit) {
  let prev = '0'.repeat(64);
  for (const e of audit) {
    if (e.h === undefined) { e.prev = prev; e.h = entryHash(prev, e); }
    else if (e.prev !== prev || e.h !== entryHash(prev, e)) throw new StoreError('AUDIT_TAMPERED', 'שרשרת היומן נפגעה.');
    prev = e.h;
  }
  return prev;
}
function seal(key, plain) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv), ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]); return Buffer.concat([Buffer.from('MSL1'), iv, c.getAuthTag(), ct]); }
function unseal(key, buf) {
  if (buf.length < 4 + 12 + 16 || buf.subarray(0, 4).toString() !== 'MSL1') throw new StoreError('CORRUPT', 'קובץ פגום או בפורמט לא מוכר.');
  try { const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(4, 16)); d.setAuthTag(buf.subarray(16, 32)); return Buffer.concat([d.update(buf.subarray(32)), d.final()]).toString('utf8'); }
  catch (e) { throw new StoreError('CORRUPT', 'פענוח נכשל (מפתח שגוי או קובץ שנפגע).'); }
}
function open(opts) {
  opts = opts || {}; const file = opts.file; if (!file) throw new Error('file is required');
  const key = opts.key ? Buffer.from(opts.key) : null; if (!key || key.length !== 32) throw new Error('a 32-byte encryption key is required (from a secret store, never committed)');
  let queue = Promise.resolve();
  const serial = fn => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };
  const write = (target, data) => { const tmp = target + '.tmp-' + process.pid + '-' + crypto.randomBytes(4).toString('hex'), fd = fs.openSync(tmp, 'w', 0o600); try { fs.writeSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } fs.renameSync(tmp, target); };
  const S = {
    /** Load (or initialise) the state. Verifies the audit chain; refuses to start on corruption instead of silently resetting. */
    load() { if (!fs.existsSync(file)) return EMPTY(); const st = JSON.parse(unseal(key, fs.readFileSync(file))); chainAudit(st.audit); return Object.assign(EMPTY(), st); },
    /** Serialized atomic save. */
    save(state) { return serial(() => S.saveNow(state)); },
    /** Unserialized save: ONLY for callers already inside serial() (the gateway holds the lock for the whole request). */
    saveNow(state) { chainAudit(state.audit); write(file, seal(key, JSON.stringify(state))); },
    /** Encrypted backup bundle: payload + SHA-256 inside the AEAD envelope. */
    backup(state, dest) { return serial(() => { chainAudit(state.audit); const payload = JSON.stringify(state); write(dest, seal(key, JSON.stringify({ kind: 'maslul-backup', v: 1, created: new Date().toISOString(), sha: sha(payload), payload }))); return { sha: sha(payload) }; }); },
    /** Fail-closed restore: wrong key / truncation / tamper / bad checksum / broken audit chain -> StoreError, current state untouched. All sessions are revoked after a restore. */
    restore(src) {
      const b = JSON.parse(unseal(key, fs.readFileSync(src))); if (b.kind !== 'maslul-backup' || b.v !== 1 || sha(b.payload) !== b.sha) throw new StoreError('CORRUPT', 'גיבוי לא תקין (סכום ביקורת).');
      const st = Object.assign(EMPTY(), JSON.parse(b.payload)); chainAudit(st.audit); st.sessions.forEach(s => { s.revoked = true; });
      st.audit.push({ at: new Date().toISOString(), ev: 'restore', from: path.basename(src) }); chainAudit(st.audit); return st;
    },
    serial,
  };
  return S;
}
module.exports = { open, StoreError, chainAudit, EMPTY };
