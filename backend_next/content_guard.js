'use strict';
// Upload content guard for the private SYNTHETIC TEST server (documents). Defence in depth ON TOP of the engine's size / extension / MIME / magic-byte checks (src/Documents.gs):
// refuses active or executable content and structurally invalid files. It is a strict ALLOW-structure + DENY-active-content check, NOT an antivirus: documents are additionally served only
// as attachments with `nosniff` and a sandbox CSP, never rendered by the app, never executed, never stored under a user-chosen path.
const zlib = require('zlib');
const bad = m => Object.assign(new Error(m), { code: 'VALIDATION' });
const MAX_ZIP_ENTRIES = 2000, MAX_UNPACKED = 60 * 1024 * 1024, MAX_RATIO = 200;
const EXEC_EXT = /\.(exe|dll|com|bat|cmd|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|scr|msi|msp|jar|lnk|sh|py|rb|pl|php|asp|aspx|cpl|reg|sys|ocx|so|dylib|app|apk|dmg|iso|docm|xlsm|pptm|xlam|dotm|xltm|swf)$/i;
function pdf(b) {
  const head = b.subarray(0, 8).toString('latin1'); if (!/^%PDF-1\.[0-7]/.test(head)) throw bad('קובץ PDF לא תקין.');
  if (b.lastIndexOf('%%EOF') < 0) throw bad('קובץ PDF פגום (חסר סוף קובץ).');
  const s = b.toString('latin1'); const hit = /\/(JavaScript|JS|Launch|EmbeddedFile|EmbeddedFiles|RichMedia|XFA|OpenAction|AA|GoToE|GoToR|SubmitForm|ImportData|Movie|Sound|Rendition|Screen|3D)(?![A-Za-z])/.exec(s);
  if (hit) throw bad('קובץ PDF עם תוכן פעיל/מוטמע אינו מותר (' + hit[1] + ').');
}
function crc32(buf) { return zlib.crc32 ? zlib.crc32(buf) >>> 0 : 0; }
function png(b) {
  if (b.length < 45 || b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) throw bad('קובץ PNG לא תקין.'); let p = 8, first = true, iend = false;
  while (p + 12 <= b.length) { const len = b.readUInt32BE(p), type = b.subarray(p + 4, p + 8).toString('latin1'); if (len > b.length || p + 12 + len > b.length) throw bad('קובץ PNG פגום.'); if (first && type !== 'IHDR') throw bad('קובץ PNG לא תקין.'); first = false;
    if (zlib.crc32 && crc32(b.subarray(p + 4, p + 8 + len)) !== b.readUInt32BE(p + 8 + len)) throw bad('קובץ PNG פגום (CRC).'); p += 12 + len; if (type === 'IEND') { iend = true; break; } }
  if (!iend) throw bad('קובץ PNG פגום.'); if (b.length - p > 0) throw bad('נתונים נוספים אחרי סוף ה-PNG אינם מותרים.');
}
function jpg(b) {
  if (b.length < 125 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) throw bad('קובץ JPEG לא תקין.'); let e = b.length; while (e > 2 && b[e - 1] === 0) e--; if (!(b[e - 2] === 0xff && b[e - 1] === 0xd9)) throw bad('קובץ JPEG פגום (חסר סוף).');
  if (b.length - e > 16) throw bad('נתונים נוספים אחרי סוף ה-JPEG אינם מותרים.');
}
/** Minimal strict ZIP reader (central directory). Returns [{name, flags, method, csize, usize, off}] or throws. */
function zipEntries(b) {
  const e = b.lastIndexOf(Buffer.from([0x50, 0x4b, 5, 6])); if (e < 0 || e + 22 > b.length) throw bad('קובץ Office פגום (אין ספריית ZIP).'); const n = b.readUInt16LE(e + 10), cdSize = b.readUInt32LE(e + 12), cdOff = b.readUInt32LE(e + 16);
  if (b.readUInt16LE(e + 4) !== 0 || n < 1 || n > MAX_ZIP_ENTRIES || cdOff + cdSize > e) throw bad('קובץ Office לא תקין (ZIP).'); const out = []; let p = cdOff, total = 0;
  for (let i = 0; i < n; i++) { if (p + 46 > b.length || b.readUInt32LE(p) !== 0x02014b50) throw bad('קובץ Office פגום.'); const flags = b.readUInt16LE(p + 8), method = b.readUInt16LE(p + 10), csize = b.readUInt32LE(p + 20), usize = b.readUInt32LE(p + 24), nl = b.readUInt16LE(p + 28), el = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), off = b.readUInt32LE(p + 42);
    const name = b.subarray(p + 46, p + 46 + nl).toString('utf8'); total += usize; if (total > MAX_UNPACKED || (csize > 0 && usize / csize > MAX_RATIO && usize > 1024 * 1024)) throw bad('קובץ Office חשוד כפצצת דחיסה.'); out.push({ name, flags, method, csize, usize, off }); p += 46 + nl + el + cl; }
  return out;
}
function office(b, kind) {
  const es = zipEntries(b), names = es.map(x => x.name);
  for (const x of es) {
    if (!x.name || x.name.includes('..') || x.name.startsWith('/') || x.name.includes('\\') || /[\x00-\x1f]/.test(x.name)) throw bad('שם רכיב לא בטוח בתוך הקובץ.'); if (x.flags & 1) throw bad('קובץ Office מוצפן אינו נתמך.');
    if (x.method !== 0 && x.method !== 8) throw bad('שיטת דחיסה לא נתמכת.'); if (EXEC_EXT.test(x.name) || /vbaProject|\/macros?\/|activeX|\/embeddings\/|oleObject|\.bin$/i.test(x.name)) throw bad('קובץ Office עם מאקרו/קוד/אובייקט מוטמע אינו מותר (' + x.name.slice(0, 40) + ').');
  }
  if (!names.includes('[Content_Types].xml')) throw bad('קובץ Office לא תקין.'); if (kind === 'docx' && !names.includes('word/document.xml')) throw bad('הקובץ אינו מסמך Word תקין.'); if (kind === 'xlsx' && !names.includes('xl/workbook.xml')) throw bad('הקובץ אינו גיליון Excel תקין.');
  for (const x of es) if (/\.rels$/i.test(x.name) || x.name === '[Content_Types].xml') {   // relationships: no external targets (remote templates / tracking / linked content)
    if (x.usize > 2 * 1024 * 1024) throw bad('רכיב גדול מדי.'); const lo = x.off; if (lo + 30 > b.length || b.readUInt32LE(lo) !== 0x04034b50) throw bad('קובץ Office פגום.'); const data = b.subarray(lo + 30 + b.readUInt16LE(lo + 26) + b.readUInt16LE(lo + 28), lo + 30 + b.readUInt16LE(lo + 26) + b.readUInt16LE(lo + 28) + x.csize);
    let xml; try { xml = (x.method === 8 ? zlib.inflateRawSync(data, { maxOutputLength: 3 * 1024 * 1024 }) : data).toString('utf8'); } catch (e) { throw bad('קובץ Office פגום.'); }
    if (/TargetMode\s*=\s*["']External["']/i.test(xml) || /relationships\/(oleObject|package|attachedTemplate|externalLink|hyperlink)/i.test(xml) && /TargetMode/i.test(xml)) throw bad('קישורים חיצוניים בתוך קובץ Office אינם מותרים.');
    if (/macroEnabled|vbaProject/i.test(xml)) throw bad('קובץ Office עם מאקרו אינו מותר.');
  }
}
/** @param ext lower-case extension without dot @param bytes Buffer. Throws {code:'VALIDATION', message(Hebrew)}. */
function inspect(ext, bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw bad('קובץ ריק.');
  if (ext === 'pdf') return pdf(bytes); if (ext === 'png') return png(bytes); if (ext === 'jpg' || ext === 'jpeg') return jpg(bytes); if (ext === 'docx' || ext === 'xlsx') return office(bytes, ext); throw bad('סוג קובץ לא נתמך.');
}
module.exports = { inspect };
