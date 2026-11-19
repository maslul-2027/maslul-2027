// Minimal ZIP reader/writer in pure Node (zlib + fs only). No zip/unzip/tar binaries — works on Windows 10 without Bash.
// Reader: methods 0 (stored) and 8 (deflate), CRC-32 verified, no ZIP64, no encryption, symlinks refused, "zip-slip" paths refused.
// Writer: used by the tests to build fixtures; method 8 or 0.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const crc = b => zlib.crc32(b) >>> 0;
const DEFAULT_LIMITS = Object.freeze({ maxEntries: 10000, maxEntryBytes: 64*1024*1024, maxTotalBytes: 512*1024*1024 });
function safeName(n) {
  if (typeof n !== 'string' || !n || n.includes('\\') || /[\x00-\x1f\x7f]/.test(n)) throw new Error('unsafe name in archive: ' + JSON.stringify(n));
  // Normalize before collision checks so canonically equivalent Unicode names share one identity.
  n = n.normalize('NFC');
  if (n.startsWith('/') || /^[A-Za-z]:/.test(n)) throw new Error('absolute path in archive: ' + n);
  if (n.includes(':') || /[<>"|?*]/.test(n)) throw new Error('Windows-invalid path in archive: ' + n);
  const parts = n.split('/');
  if (n.endsWith('/')) parts.pop(); // one final empty segment is the directory marker
  if (!parts.length || parts.some(x => !x || x === '.' || x === '..' || x.endsWith('.') || x.endsWith(' '))) throw new Error('unsafe path component in archive: ' + n);
  for (const x of parts) { const base=x.split('.')[0].toUpperCase(); if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(base)) throw new Error('reserved Windows device name in archive: '+n); }
  return n;
}
function validateEntries(es, lim=DEFAULT_LIMITS) {
  if(es.length>lim.maxEntries) throw new Error('ZIP entry count limit exceeded');
  let total=0; const seen=new Set(), kinds=new Map();
  for(const e of es){ const n=safeName(e.name), key=n.toLowerCase(), dir=n.endsWith('/'); if(seen.has(key)) throw new Error('duplicate or case-insensitive path collision: '+n); seen.add(key);
    if(e.us>lim.maxEntryBytes) throw new Error('ZIP entry size limit exceeded: '+n); total+=e.us; if(total>lim.maxTotalBytes) throw new Error('ZIP total uncompressed size limit exceeded');
    const clean=dir?n.slice(0,-1):n, parts=clean.split('/');
    for(let i=1;i<parts.length;i++){const par=parts.slice(0,i).join('/').toLowerCase(); if(kinds.get(par)==='file') throw new Error('file/directory prefix conflict: '+n); kinds.set(par,'dir');}
    const old=kinds.get(key); if(old && old!==(dir?'dir':'file')) throw new Error('file/directory conflict: '+n); kinds.set(key,dir?'dir':'file');
    if(!dir && [...seen].some(k=>k.startsWith(key+'/'))) throw new Error('file/directory prefix conflict: '+n);
  }
}
function readEntries(buf) {
  let e = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('not a zip file (end-of-central-directory not found)');
  const n = buf.readUInt16LE(e + 10), cdOff = buf.readUInt32LE(e + 16); if (n === 0xffff || cdOff === 0xffffffff) throw new Error('ZIP64 is not supported');
  const out = []; let p = cdOff;
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10), crc32 = buf.readUInt32LE(p + 16), cs = buf.readUInt32LE(p + 20), us = buf.readUInt32LE(p + 24), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), ext = buf.readUInt32LE(p + 38), lo = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl); if (flags & 1) throw new Error('encrypted entry: ' + name); if (cs === 0xffffffff || us === 0xffffffff) throw new Error('ZIP64 is not supported');
    out.push({ name, method, crc32, cs, us, lo, mode: ext >>> 16 }); p += 46 + nl + el + cl;
  }
  return out;
}
function entryData(buf, en, maxOutputBytes = en.us) {
  if (buf.readUInt32LE(en.lo) !== 0x04034b50) throw new Error('bad local header: ' + en.name);
  if (!Number.isSafeInteger(en.cs) || en.cs < 0 || en.lo + 30 > buf.length) throw new Error('invalid compressed size or local header: ' + en.name);
  const start = en.lo + 30 + buf.readUInt16LE(en.lo + 26) + buf.readUInt16LE(en.lo + 28);
  if (start > buf.length || en.cs > buf.length - start) throw new Error('compressed data exceeds archive bounds: ' + en.name);
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 0 || en.us > maxOutputBytes) throw new Error('ZIP entry size limit exceeded before decompression: ' + en.name);
  const raw = buf.subarray(start, start + en.cs);
  // Enforce the output ceiling inside zlib. Checking d.length afterwards is too late:
  // a forged central-directory size could otherwise trigger an unbounded allocation.
  const d = en.method === 0 ? raw : en.method === 8 ? zlib.inflateRawSync(raw, { maxOutputLength: maxOutputBytes }) : (() => { throw new Error('unsupported compression method ' + en.method + ': ' + en.name); })();
  if (d.length > maxOutputBytes) throw new Error('ZIP entry size limit exceeded after decompression: ' + en.name);
  if (d.length !== en.us) throw new Error('size mismatch: ' + en.name); if (crc(d) !== en.crc32) throw new Error('CRC mismatch: ' + en.name); return d;
}
// list: [{name, size}] without writing anything
function listZip(zipPath) { const buf = fs.readFileSync(zipPath); return readEntries(buf).map(e => ({ name: e.name, size: e.us, dir: e.name.endsWith('/') })); }
// extract into destDir (created); never writes outside destDir; refuses symlinks
function extractZip(zipPath, destDir, limits = DEFAULT_LIMITS) {
  const buf = fs.readFileSync(zipPath), entries = readEntries(buf); validateEntries(entries, limits); const root = path.resolve(destDir);
  let remaining = limits.maxTotalBytes;
  const decoded = entries.map(en => {
    const nm = safeName(en.name), target = path.resolve(root, ...nm.split('/')); if (target !== root && !target.startsWith(root + path.sep)) throw new Error('path escapes the target: ' + nm);
    if ((en.mode & 0o170000) === 0o120000) throw new Error('symlink entries are not supported: ' + nm);
    if (nm.endsWith('/')) return { nm, target, data: null };
    const ceiling = Math.min(limits.maxEntryBytes, remaining);
    const data = entryData(buf, en, ceiling); remaining -= data.length;
    return { nm, target, data };
  });
  fs.mkdirSync(root, { recursive: true });
  for (const x of decoded) { if (x.nm.endsWith('/')) fs.mkdirSync(x.target, { recursive: true }); else { fs.mkdirSync(path.dirname(x.target), { recursive: true }); fs.writeFileSync(x.target, x.data, { flag: 'wx' }); } }
}
// files: [{name:'dir/file.txt', data:Buffer|string}] ; directories are implied. method 'deflate'|'store'
function buildZip(files, method) {
  const parts = [], cds = []; let off = 0; const m = method === 'store' ? 0 : 8;
  for (const f of files) {
    const nameB = Buffer.from(f.name, 'utf8'), data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data)), body = m ? zlib.deflateRawSync(data) : data, c = crc(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(m, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(c, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameB.length, 26);
    parts.push(lh, nameB, body);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(0x031e, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(m, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(c, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameB.length, 28); ch.writeUInt32LE((0o100644 << 16) >>> 0, 38); ch.writeUInt32LE(off, 42);
    cds.push(ch, nameB); off += 30 + nameB.length + body.length;
  }
  const cd = Buffer.concat(cds), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
// all files under dir (relative, '/'-separated, sorted), skipping directories named in skip
function walk(dir, skip) { const out = []; (function w(d, rel) { fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1).forEach(e => { if (e.isDirectory()) { if (!(skip || []).includes(e.name)) w(path.join(d, e.name), rel + e.name + '/'); } else if (e.isFile()) out.push(rel + e.name); }); })(dir, ''); return out; }
module.exports = { listZip, extractZip, buildZip, walk, readEntries, crc, safeName, validateEntries, DEFAULT_LIMITS };
