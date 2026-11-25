'use strict';
// Local ENCRYPTED file store for the private SYNTHETIC TEST server (generated report files; later documents/backups use the same primitive).
// - AES-256-GCM per file, key derived (HKDF-SHA256) from the server store key; the file name on disk is a random id (never user input) so there is no path traversal surface.
// - Files live outside the engine's state object (binary blobs are not JSON); the engine only keeps the opaque id.
// - Authorization is NOT done here: callers (engine `reports.download`) decide who may read; this layer only guarantees confidentiality at rest and integrity (GCM tag).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ID = /^f_[0-9a-f]{32}$/, MAX_BYTES = 25 * 1024 * 1024;
function open(o) {
  const dir = path.resolve(o.dir); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const key = Buffer.from(crypto.hkdfSync('sha256', Buffer.from(o.key), Buffer.from('maslul-file-store-v1'), Buffer.from('files'), 32));
  const macKey = Buffer.from(crypto.hkdfSync('sha256', Buffer.from(o.key), Buffer.from('maslul-file-store-v1'), Buffer.from('bundle-mac'), 32));
  const fp = id => { if (typeof id !== 'string' || !ID.test(id)) throw Object.assign(new Error('bad file id'), { code: 'NOT_FOUND' }); return path.join(dir, id + '.enc'); };
  function decryptRaw(id, raw) {
    if (!ID.test(String(id)) || !Buffer.isBuffer(raw) || raw.length < 12 + 16 + 4) throw Object.assign(new Error('file corrupt'), { code: 'INTEGRITY' });
    const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12)); d.setAAD(Buffer.from(id)); d.setAuthTag(raw.subarray(12, 28));
    let p; try { p = Buffer.concat([d.update(raw.subarray(28)), d.final()]); } catch (e) { throw Object.assign(new Error('file integrity check failed'), { code: 'INTEGRITY' }); }
    const ml = p.readUInt32BE(0), meta = JSON.parse(p.subarray(4, 4 + ml).toString('utf8')); return { meta, buf: p.subarray(4 + ml) };
  }
  return {
    dir, mac: d => crypto.createHmac('sha256', macKey).update(d).digest('hex'),
    save(bucket, name, mime, buf) {
      if (!Buffer.isBuffer(buf) || buf.length === 0 || buf.length > MAX_BYTES) throw Object.assign(new Error('file size not allowed'), { code: 'VALIDATION' });
      const id = 'f_' + crypto.randomBytes(16).toString('hex'), iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
      const meta = Buffer.from(JSON.stringify({ bucket: String(bucket), name: String(name).slice(0, 120), mime: String(mime).slice(0, 100), size: buf.length }), 'utf8'), ml = Buffer.alloc(4); ml.writeUInt32BE(meta.length);
      c.setAAD(Buffer.from(id)); const enc = Buffer.concat([c.update(Buffer.concat([ml, meta, buf])), c.final()]), tag = c.getAuthTag();
      const tmp = fp(id) + '.tmp'; fs.writeFileSync(tmp, Buffer.concat([iv, tag, enc]), { mode: 0o600, flag: 'wx' }); fs.renameSync(tmp, fp(id)); return { id };
    },
    read(id) { const f = fp(id); let raw; try { raw = fs.readFileSync(f); } catch (e) { throw Object.assign(new Error('file not found'), { code: 'NOT_FOUND' }); } return decryptRaw(id, raw); },
    /** Decrypt + authenticate an encrypted blob (e.g. a copy inside a backup) WITHOUT touching the live files. Wrong key / tamper -> INTEGRITY. */
    decryptRaw,
    /** All stored ids (sorted). Staging/quarantine/temp names are never listed. */
    list() { return fs.readdirSync(dir).filter(n => /^f_[0-9a-f]{32}\.enc$/.test(n)).map(n => n.slice(0, -4)).sort(); },
    rawPath(id) { return fp(id); },
    /** Atomically place an already-encrypted blob (restore). The caller must have authenticated it with decryptRaw first. */
    putRaw(id, raw) { const f = fp(id), tmp = f + '.tmp-' + crypto.randomBytes(4).toString('hex'); fs.writeFileSync(tmp, raw, { mode: 0o600, flag: 'wx' }); fs.renameSync(tmp, f); },
    trash(id) { try { fs.unlinkSync(fp(id)); } catch (e) { /* already gone */ } },
    state(id) { try { return fs.existsSync(fp(id)) ? 'exists' : 'unknown'; } catch (e) { return 'unknown'; } }
  };
}
module.exports = { open, ID, MAX_BYTES };
