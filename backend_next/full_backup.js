'use strict';
// FULL offline backup / restore of a private-TEST data folder: the encrypted state (users, sessions, audit chain, engine tables) AND every stored file (generated reports) in ONE integrity-protected container.
// Container "MBK1": magic | u32 header length | header JSON {v, created, entries:[{name,size,sha256}], mac} | blobs. Everything inside is still AES-GCM ciphertext from the live installation; the container carries
// NO key. The header MAC is an HMAC keyed from the installation's store key, so a bundle only verifies against THE SAME installation (same secrets.json) — a wrong/missing key fails closed.
// Restore (app must be stopped): verify everything first -> stage -> durable rollback copy + marker -> move files into place -> state.bin LAST -> marker removed. Any failure (or a crash, recovered at the next
// run) rolls back to the exact previous state + files. All sessions are revoked by the restore. Files are only added/repaired, never deleted; replaced files go to <data>/.quarantine.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const MAX_FILES = 5000, MAX_BYTES = 500 * 1024 * 1024, NAME = /^(state\.bin|f_[0-9a-f]{32}\.enc)$/, sha = b => crypto.createHash('sha256').update(b).digest('hex');
const err = (code, msg) => Object.assign(new Error(msg), { code });
function open(o) {
  const MF = o.maxFiles || MAX_FILES, MB = o.maxBytes || MAX_BYTES, dir = path.resolve(o.dataDir), S = o.store, FS = o.files, FD = FS.dir, marker = path.join(dir, 'restore-in-progress.json'), state = path.join(dir, 'state.bin');
  const macOf = h => FS.mac(JSON.stringify({ v: h.v, created: h.created, entries: h.entries }));
  const atomic = (t, d) => { const tmp = t + '.tmp-' + crypto.randomBytes(4).toString('hex'); fs.writeFileSync(tmp, d, { mode: 0o600, flag: 'wx' }); fs.renameSync(tmp, t); };
  function create(dest) {
    if (!fs.existsSync(state)) throw err('EMPTY', 'nothing to back up yet');
    const entries = [], blobs = []; let bytes = 0;
    const add = (name, buf) => { if (entries.length > MF || (bytes += buf.length) > MB) throw err('TOO_LARGE', 'backup would exceed the size bound'); entries.push({ name, size: buf.length, sha256: sha(buf) }); blobs.push(buf); };
    add('state.bin', fs.readFileSync(state));                                   // state FIRST, files after: a report created in between is in the files but its row is not in the state — never the other way round
    let skipped = 0; for (const id of FS.list()) { const raw = fs.readFileSync(FS.rawPath(id)); let meta; try { meta = FS.decryptRaw(id, raw).meta; } catch (e) { skipped++; continue; } if (meta.bucket === 'backups') continue; add(id + '.enc', raw); }
    const h = { v: 1, created: new Date().toISOString(), entries }; h.mac = macOf(h); const hb = Buffer.from(JSON.stringify(h)), lb = Buffer.alloc(4); lb.writeUInt32BE(hb.length);
    atomic(dest, Buffer.concat([Buffer.from('MBK1'), lb, hb].concat(blobs))); return { files: entries.length - 1, bytes, skipped_corrupt: skipped, sha: sha(fs.readFileSync(dest)) };
  }
  /** Parse + fully verify a container WITHOUT touching the data folder. Returns {header, blobs:Map(name->Buffer), state}. Throws {code:'CORRUPT'} on anything wrong. */
  function read(src) {
    const buf = fs.readFileSync(src); if (buf.length < 12 || buf.subarray(0, 4).toString('latin1') !== 'MBK1') throw err('CORRUPT', 'not a full MASLUL backup');
    const hl = buf.readUInt32BE(4); if (hl < 2 || hl > 4 * 1024 * 1024 || 8 + hl > buf.length) throw err('CORRUPT', 'bad header'); let h; try { h = JSON.parse(buf.subarray(8, 8 + hl).toString('utf8')); } catch (e) { throw err('CORRUPT', 'bad header'); }
    if (!h || h.v !== 1 || !Array.isArray(h.entries) || h.entries.length < 1 || h.entries.length > MAX_FILES + 1) throw err('CORRUPT', 'bad header'); if (h.mac !== macOf(h)) throw err('CORRUPT', 'header authentication failed (damaged, or from a different installation / wrong secrets.json)');
    let pos = 8 + hl, total = 0; const blobs = new Map();
    for (const e of h.entries) {
      if (!e || !NAME.test(String(e.name)) || blobs.has(e.name) || !Number.isInteger(e.size) || e.size < 0 || pos + e.size > buf.length) throw err('CORRUPT', 'bad entry'); total += e.size; if (total > MAX_BYTES) throw err('CORRUPT', 'too large');
      const b = buf.subarray(pos, pos + e.size); pos += e.size; if (sha(b) !== e.sha256) throw err('CORRUPT', 'entry modified: ' + (e.name === 'state.bin' ? 'state' : e.name.slice(0, 8) + '…')); blobs.set(e.name, b);
    }
    if (pos !== buf.length) throw err('CORRUPT', 'unexpected trailing data'); if (!blobs.has('state.bin')) throw err('CORRUPT', 'no state in backup');
    let st; try { st = S.parseSealed(blobs.get('state.bin')); } catch (e) { throw err('CORRUPT', 'state not authentic with this installation\'s key'); }
    for (const [n, b] of blobs) if (n !== 'state.bin') { try { FS.decryptRaw(n.slice(0, -4), b); } catch (e) { throw err('CORRUPT', 'file not authentic: ' + n.slice(0, 8) + '…'); } }
    return { header: h, blobs, state: st };
  }
  function rollbackFrom(rb) {
    const m = JSON.parse(fs.readFileSync(path.join(rb, 'undo.json'), 'utf8'));
    for (const id of m.added) { try { fs.unlinkSync(FS.rawPath(id.slice(0, -4))); } catch (e) { /* not placed */ } }
    for (const id of m.replaced) { const src = path.join(rb, 'replaced', id); if (fs.existsSync(src)) fs.copyFileSync(src, FS.rawPath(id.slice(0, -4))); }
    fs.copyFileSync(path.join(rb, 'state.bin'), state); return m;
  }
  /** Finish or undo a restore that was interrupted (crash / power loss). Safe to call at any start. */
  function recover() {
    if (!fs.existsSync(marker)) return { action: 'none' };
    let mk; try { mk = JSON.parse(fs.readFileSync(marker, 'utf8')); } catch (e) { return { action: 'unreadable-marker' }; }
    const rb = path.join(dir, mk.rollback); if (!fs.existsSync(path.join(rb, 'undo.json'))) { fs.unlinkSync(marker); return { action: 'cleared' }; }
    const done = fs.existsSync(state) && sha(fs.readFileSync(state)) === mk.newStateSha;
    if (!done) rollbackFrom(rb); fs.rmSync(path.join(dir, mk.staging), { recursive: true, force: true }); fs.unlinkSync(marker); return { action: done ? 'completed' : 'rolled-back' };
  }
  function restore(src, opts) {
    opts = opts || {}; const pre = recover(); const { header, blobs, state: st } = read(src);
    st.sessions.forEach(s => { s.revoked = true; }); st.audit.push({ at: new Date().toISOString(), ev: 'restore_full', from: path.basename(src), files: header.entries.length - 1 }); const newState = S.sealState(st), newSha = sha(newState);
    const ts = Date.now(), staging = '.restore-staging-' + ts, rbName = 'restore-rollback-' + ts, sd = path.join(dir, staging), rb = path.join(dir, rbName); fs.mkdirSync(sd, { mode: 0o700 }); fs.mkdirSync(path.join(rb, 'replaced'), { recursive: true, mode: 0o700 });
    try {
      const add = [], rep = []; for (const [n, b] of blobs) { if (n === 'state.bin') continue; fs.writeFileSync(path.join(sd, n), b, { mode: 0o600 }); const f = FS.rawPath(n.slice(0, -4)); if (!fs.existsSync(f)) add.push(n); else if (sha(fs.readFileSync(f)) !== sha(b)) rep.push(n); }
      fs.writeFileSync(path.join(sd, 'state.new'), newState, { mode: 0o600 });
      if (fs.existsSync(state)) fs.copyFileSync(state, path.join(rb, 'state.bin')); else fs.writeFileSync(path.join(rb, 'state.bin'), '');
      for (const n of rep) fs.copyFileSync(FS.rawPath(n.slice(0, -4)), path.join(rb, 'replaced', n)); atomic(path.join(rb, 'undo.json'), JSON.stringify({ added: add, replaced: rep }));
      atomic(marker, JSON.stringify({ at: new Date().toISOString(), staging, rollback: rbName, newStateSha: newSha }));                       // durable rollback exists BEFORE any live byte changes
      if (opts.crashAfterMarker) throw Object.assign(new Error('simulated crash'), { simulated: true });
      for (const n of add.concat(rep)) { const dst = FS.rawPath(n.slice(0, -4)); if (fs.existsSync(dst)) { const q = path.join(dir, '.quarantine'); fs.mkdirSync(q, { recursive: true, mode: 0o700 }); fs.copyFileSync(dst, path.join(q, n + '.' + ts)); } fs.renameSync(path.join(sd, n), dst); }
      if (opts.failBeforeState) throw new Error('simulated failure before state swap');
      fs.renameSync(path.join(sd, 'state.new'), state);                                                                                          // state LAST
      fs.rmSync(sd, { recursive: true, force: true }); fs.unlinkSync(marker); return { files: header.entries.length - 1, added: add.length, repaired: rep.length, rollback: rbName, recovered_before: pre.action };
    } catch (e) {
      if (e.simulated) throw e;                                                                                                                 // a (simulated) crash leaves the marker for recover()
      try { rollbackFrom(rb); } catch (e2) { throw err('ROLLBACK_FAILED', 'restore failed AND rollback failed: ' + e2.message + ' — keep ' + rbName); } fs.rmSync(sd, { recursive: true, force: true }); try { fs.unlinkSync(marker); } catch (x) { /* none */ }
      throw err('RESTORE_FAILED', 'restore failed; previous state and files were put back (' + String(e.message).slice(0, 100) + ')');
    }
  }
  return { create, read, restore, recover, marker };
}
module.exports = { open, MAX_FILES, MAX_BYTES };
