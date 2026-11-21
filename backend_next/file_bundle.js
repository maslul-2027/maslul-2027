'use strict';
// Consistent file snapshots for the private SYNTHETIC TEST server: every stored file (generated reports, later documents) is copied BYTE-FOR-BYTE (still AES-GCM encrypted) into
// <root>/<backupId>/ with an HMAC-protected manifest (ids, sizes, SHA-256 — no names, no record content). The manifest is written LAST and atomically: no manifest = incomplete = unusable.
// Restore is STAGED: everything is verified (manifest MAC, per-file SHA-256, GCM authentication with the current key) and copied to a staging folder first; only then are files moved
// into place (rename, same filesystem). Restore only ADDS or REPAIRS files; it never deletes a file. A divergent live file is moved to .quarantine, never overwritten silently.
// Same-installation scope: the key is not part of any backup (see docs/BACKUP_RESTORE_TEST.md) — a wrong/missing key makes verification fail closed.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const MAX_FILES = 5000, MAX_BYTES = 500 * 1024 * 1024, ID = /^f_[0-9a-f]{32}$/, sha = b => crypto.createHash('sha256').update(b).digest('hex');
const err = (code, msg) => Object.assign(new Error(msg), { code });
function open(o) {
  const MF = o.maxFiles || MAX_FILES, MB = o.maxBytes || MAX_BYTES, files = o.files, root = path.resolve(o.root), live = files.dir; fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const bdir = id => { if (!ID.test(String(id))) throw err('NOT_FOUND', 'bad backup id'); return path.join(root, id); };
  const atomic = (target, data) => { const tmp = target + '.tmp-' + crypto.randomBytes(4).toString('hex'); fs.writeFileSync(tmp, data, { mode: 0o600, flag: 'wx' }); fs.renameSync(tmp, target); };
  const manifestMac = m => files.mac(JSON.stringify({ v: m.v, count: m.count, bytes: m.bytes, entries: m.entries, skipped_corrupt: m.skipped_corrupt || [] }));
  function snapshot(backupId) {
    const dir = bdir(backupId); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { mode: 0o700 }); const entries = [], skipped = []; let bytes = 0;
    try {
      for (const id of files.list()) {
        const raw = fs.readFileSync(files.rawPath(id)); let meta; try { meta = files.decryptRaw(id, raw).meta; } catch (e) { skipped.push(id); continue; }      // a live file that fails authentication is NOT copied (a corrupt copy must never look like a good backup); it is listed so the gap is visible and a restore can repair it from an older backup
        if (meta.bucket === 'backups') continue;          // backup JSON blobs are not part of a snapshot of the data
        if (entries.length >= MF || (bytes += raw.length) > MB) throw err('TOO_LARGE', 'the snapshot would exceed the backup size bound');
        fs.writeFileSync(path.join(dir, id + '.enc'), raw, { mode: 0o600 }); entries.push({ id, size: raw.length, sha256: sha(raw) });
      }
      const m = { v: 1, created: new Date().toISOString(), count: entries.length, bytes, entries, skipped_corrupt: skipped }; m.mac = manifestMac(m); atomic(path.join(dir, 'manifest.json'), JSON.stringify(m)); return { count: entries.length, bytes, skipped_corrupt: skipped.length };
    } catch (e) { fs.rmSync(dir, { recursive: true, force: true }); throw e; }
  }
  function verify(backupId) {
    const dir = bdir(backupId), problems = []; let m; try { m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch (e) { return { ok: false, problems: ['manifest missing or unreadable'], entries: [] }; }
    if (!m || m.v !== 1 || !Array.isArray(m.entries) || m.mac !== manifestMac(m) || m.count !== m.entries.length) return { ok: false, problems: ['manifest authentication failed'], entries: [] };
    const seen = new Set();
    for (const e of m.entries) {
      if (!e || !ID.test(String(e.id)) || seen.has(e.id)) { problems.push('bad or duplicate entry'); continue; } seen.add(e.id);
      let raw; try { raw = fs.readFileSync(path.join(dir, e.id + '.enc')); } catch (x) { problems.push('missing file ' + e.id.slice(0, 6) + '…'); continue; }
      if (raw.length !== e.size || sha(raw) !== e.sha256) { problems.push('modified file ' + e.id.slice(0, 6) + '…'); continue; }
      try { files.decryptRaw(e.id, raw); } catch (x) { problems.push('file not authentic with this installation\'s key ' + e.id.slice(0, 6) + '…'); }
    }
    for (const n of fs.readdirSync(dir)) if (n !== 'manifest.json' && !(/^f_[0-9a-f]{32}\.enc$/.test(n) && seen.has(n.slice(0, -4)))) problems.push('unexpected entry in backup folder');
    return { ok: !problems.length, problems: problems.slice(0, 10), entries: m.entries, count: m.count, bytes: m.bytes, skipped_corrupt: (m.skipped_corrupt || []).length };
  }
  /** Differences between the snapshot and the live store (read-only): files that would be re-added / repaired, and live files newer than the snapshot (kept). */
  function diff(backupId) {
    const v = verify(backupId); if (!v.ok) return Object.assign(v, { missing: 0, divergent: 0, present: 0, newer: 0 });
    let missing = 0, divergent = 0, present = 0; const inSnap = new Set(v.entries.map(e => e.id));
    for (const e of v.entries) { const f = files.rawPath(e.id); if (!fs.existsSync(f)) missing++; else if (sha(fs.readFileSync(f)) !== e.sha256) divergent++; else present++; }
    const newer = files.list().filter(id => { if (inSnap.has(id)) return false; try { return files.read(id).meta.bucket !== 'backups'; } catch (e) { return true; } }).length; return Object.assign(v, { missing, divergent, present, newer });
  }
  function stage(backupId, stageId) {
    const v = verify(backupId); if (!v.ok) throw err('CORRUPT', 'backup file set failed verification: ' + v.problems[0]);
    const sd = path.join(live, '.staging-' + stageId); fs.rmSync(sd, { recursive: true, force: true }); fs.mkdirSync(sd, { mode: 0o700 }); const todo = [];
    try { for (const e of v.entries) { const f = files.rawPath(e.id); let state = 'missing'; if (fs.existsSync(f)) state = sha(fs.readFileSync(f)) === e.sha256 ? 'same' : 'divergent'; if (state !== 'same') { fs.copyFileSync(path.join(root, backupId, e.id + '.enc'), path.join(sd, e.id + '.enc')); todo.push({ id: e.id, state }); } }
      atomic(path.join(sd, 'plan.json'), JSON.stringify(todo)); } catch (e) { fs.rmSync(sd, { recursive: true, force: true }); throw e; }
    return { stageId, add: todo.filter(t => t.state === 'missing').length, repair: todo.filter(t => t.state === 'divergent').length };
  }
  function commit(stageId) {
    const sd = path.join(live, '.staging-' + stageId); if (!fs.existsSync(path.join(sd, 'plan.json'))) { fs.rmSync(sd, { recursive: true, force: true }); return { moved: 0 }; }
    const plan = JSON.parse(fs.readFileSync(path.join(sd, 'plan.json'), 'utf8')); let moved = 0, quarantined = 0;
    for (const t of plan) {
      if (!ID.test(t.id)) continue; const src = path.join(sd, t.id + '.enc'), dst = files.rawPath(t.id); if (!fs.existsSync(src)) continue;
      if (fs.existsSync(dst)) { const q = path.join(live, '.quarantine'); fs.mkdirSync(q, { recursive: true, mode: 0o700 }); fs.renameSync(dst, path.join(q, t.id + '.enc.' + Date.now())); quarantined++; }
      fs.renameSync(src, dst); moved++;
    }
    fs.rmSync(sd, { recursive: true, force: true }); return { moved, quarantined };
  }
  const abort = stageId => fs.rmSync(path.join(live, '.staging-' + stageId), { recursive: true, force: true });
  const remove = backupId => fs.rmSync(bdir(backupId), { recursive: true, force: true });
  const has = backupId => { try { return fs.existsSync(path.join(bdir(backupId), 'manifest.json')); } catch (e) { return false; } };
  return { snapshot, verify, diff, stage, commit, abort, remove, has, root };
}
module.exports = { open, MAX_FILES, MAX_BYTES };
