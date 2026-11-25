'use strict';
// Real, dependency-free export formats for the private SYNTHETIC TEST server: PDF (A4, RTL Hebrew, embedded subset font) and XLSX (OOXML, RTL sheets).
// Pure Node (zlib only): works on the Windows package too. No network, no external service, no temp files.
// PDF scope (honest): headings, paragraphs, KPI lines, bullet lists and TABLES of the report HTML that the engine builds. Inline SVG charts are NOT drawn (every chart in the analytic report is
// followed by its data table, which IS rendered) and arbitrary HTML/CSS is not supported — the input is only the engine's own report markup, never user HTML.
const zlib = require('zlib'), fs = require('fs'), path = require('path');
const FM = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', 'font_metrics.json'), 'utf8'));
const FONT_FILES = { regular: fs.readFileSync(path.join(__dirname, 'assets', 'report_font_regular.ttf')), bold: fs.readFileSync(path.join(__dirname, 'assets', 'report_font_bold.ttf')) };

// ---------------------------------------------------------------- bidi (one RTL paragraph, simplified UBA: R / L / EN / neutrals) ----------------------------------------------------------------
const isHeb = c => (c >= 0x590 && c <= 0x5ff) || c === 0x200f, isLat = c => (c >= 65 && c <= 90) || (c >= 97 && c <= 122), isDig = c => c >= 48 && c <= 57;
const MIRROR = { 40: 41, 41: 40, 91: 93, 93: 91, 60: 62, 62: 60, 123: 125, 125: 123 };
function bidiVisual(str) {                // returns code points in left-to-right DRAW order for a paragraph whose base direction is RTL
  const cp = Array.from(str).map(ch => ch.codePointAt(0)).filter(c => c !== 0x200e && c !== 0x200f), n = cp.length, t = new Array(n);
  for (let i = 0; i < n; i++) t[i] = isHeb(cp[i]) ? 'R' : isLat(cp[i]) ? 'L' : isDig(cp[i]) ? 'N' : 'O';
  for (let i = 1; i < n - 1; i++) if (t[i] === 'O' && [46, 44, 58, 47, 45, 43].includes(cp[i]) && t[i - 1] === 'N' && t[i + 1] === 'N') t[i] = 'N';   // 12.5  1,000  12:30  2026-11-21
  for (let i = 0; i < n; i++) if (t[i] === 'O' && (cp[i] === 37 || cp[i] === 36) && ((i > 0 && t[i - 1] === 'N') || (i < n - 1 && t[i + 1] === 'N'))) t[i] = 'N';   // % $ next to digits
  const lvl = new Array(n);
  for (let i = 0; i < n; i++) lvl[i] = t[i] === 'R' ? 1 : (t[i] === 'L' || t[i] === 'N') ? 2 : 0;
  for (let i = 0; i < n; i++) if (lvl[i] === 0) { let a = i - 1; while (a >= 0 && lvl[a] === 0) a--; let b = i + 1; while (b < n && lvl[b] === 0) b++; const l = a >= 0 ? lvl[a] : 1, r = b < n ? lvl[b] : 1; lvl[i] = l === 2 && r === 2 ? 2 : 1; }
  const runs = []; for (let i = 0; i < n; i++) { const last = runs[runs.length - 1]; if (last && last.l === lvl[i]) last.c.push(cp[i]); else runs.push({ l: lvl[i], c: [cp[i]] }); }
  const out = []; for (let k = runs.length - 1; k >= 0; k--) { const r = runs[k]; if (r.l === 1) for (let j = r.c.length - 1; j >= 0; j--) out.push(MIRROR[r.c[j]] || r.c[j]); else r.c.forEach(c => out.push(c)); }
  return out;
}

// ---------------------------------------------------------------- HTML (the engine's own report markup) -> blocks ----------------------------------------------------------------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const dec = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] !== undefined ? ENT[e.toLowerCase()] : m));
const txt = h => dec(h.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
function blocks(html) {
  let h = String(html).replace(/<!--[\s\S]*?-->/g, '').replace(/<(style|script|svg|head)\b[\s\S]*?<\/\1>/gi, ' ');
  const out = [], re = /<(h1|h2|h3|table|ul|ol|p|div)\b([^>]*)>/gi; let m;
  const takeTable = (s) => { const rows = []; (s.match(/<tr\b[\s\S]*?<\/tr>/gi) || []).forEach(tr => { const cells = (tr.match(/<(th|td)\b[\s\S]*?<\/\1>/gi) || []).map(c => txt(c)); const head = /^<th/i.test((tr.match(/<(th|td)\b/i) || [''])[0]); if (cells.length) rows.push({ cells, head }); }); return rows; };
  let i = 0;
  while ((m = re.exec(h))) {
    const tag = m[1].toLowerCase(), attrs = m[2], start = m.index;
    if (tag === 'table') { const end = h.indexOf('</table>', start); const body = h.slice(start, end < 0 ? h.length : end); out.push({ k: 'table', rows: takeTable(body) }); re.lastIndex = end < 0 ? h.length : end + 8; continue; }
    if (tag === 'ul' || tag === 'ol') { const end = h.indexOf('</' + tag + '>', start); const body = h.slice(start, end < 0 ? h.length : end); (body.match(/<li\b[\s\S]*?<\/li>/gi) || []).forEach(li => { const t = txt(li); if (t) out.push({ k: 'li', t }); }); re.lastIndex = end < 0 ? h.length : end + 5; continue; }
    if (tag === 'div' && /class="[^"]*\bk\b[^"]*"/.test(attrs)) { const end = h.indexOf('</div>', start); const body = h.slice(start, end < 0 ? h.length : end); const lab = txt((/<small\b[\s\S]*?<\/small>/i.exec(body) || [''])[0]), val = txt((/<b\b[\s\S]*?<\/b>/i.exec(body) || [''])[0]); if (lab || val) out.push({ k: 'kpi', t: (lab ? lab + ': ' : '') + val }); re.lastIndex = end < 0 ? h.length : end + 6; continue; }
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'p') { const end = h.indexOf('</' + tag + '>', start); const t = txt(h.slice(start, end < 0 ? h.length : end)); if (t) out.push({ k: tag === 'p' ? 'p' : tag, t }); re.lastIndex = end < 0 ? h.length : end + tag.length + 3; continue; }
    if (tag === 'div') { // leaf text div (captions, "no data", footer lines): take text up to the next block-level open/close tag
      const end = h.indexOf('</div>', start), inner = h.slice(start + m[0].length, end < 0 ? h.length : end); if (!/<(div|table|ul|h\d|section)\b/i.test(inner)) { const t = txt(inner); if (t && !/class="[^"]*\b(ft|run)\b/.test(attrs)) out.push({ k: 'p', t }); re.lastIndex = end < 0 ? h.length : end + 6; }
    }
  }
  return out;
}

// ---------------------------------------------------------------- PDF writer ----------------------------------------------------------------
const PW = 595.28, PH = 841.89, MX = 36, MTOP = 40, MBOT = 46;
const glyphOf = (font, cp) => { const g = FM[font].glyphs[String(cp)] || FM[font].glyphs['63'] || FM[font].glyphs['32']; return g; };
const adv = (font, cp, size) => glyphOf(font, cp)[1] * size / FM[font].upm;
const wText = (font, s, size) => { let w = 0; for (const ch of s) { const c = ch.codePointAt(0); if (c === 0x200e || c === 0x200f) continue; w += adv(font, c, size); } return w; };
function wrap(font, s, size, maxW) {
  const words = s.split(' ').filter(Boolean), lines = []; let cur = '';
  const push = () => { if (cur) lines.push(cur); cur = ''; };
  for (const w0 of words) {
    let w = w0;
    while (wText(font, w, size) > maxW) { let k = 1; while (k < w.length && wText(font, w.slice(0, k + 1), size) <= maxW) k++; push(); lines.push(w.slice(0, k)); w = w.slice(k); }
    const cand = cur ? cur + ' ' + w : w; if (cur && wText(font, cand, size) > maxW) { push(); cur = w; } else cur = cand;
  }
  push(); return lines.length ? lines : [''];
}
const hex4 = n => ('0000' + n.toString(16)).slice(-4);
const pdfStr = s => '<FEFF' + Array.from(String(s)).map(ch => { const c = ch.codePointAt(0); return c > 0xffff ? hex4(0xd800 + ((c - 0x10000) >> 10)) + hex4(0xdc00 + ((c - 0x10000) & 1023)) : hex4(c); }).join('') + '>';
function pdfFromHtml(html, opts) {
  opts = opts || {}; const B = blocks(html), pages = []; let ops = null, y = 0;
  const newPage = () => { ops = []; pages.push(ops); y = PH - MTOP; };
  const ensure = hh => { if (!ops || y - hh < MBOT) newPage(); };
  const drawLine = (font, size, s, xRight, yy) => { const vis = bidiVisual(s), f = font === 'bold' ? 'F2' : 'F1'; const gl = vis.map(c => hex4(glyphOf(font, c)[0])).join(''); let w = 0; vis.forEach(c => { w += adv(font, c, size); }); ops.push('BT /' + f + ' ' + size + ' Tf ' + (xRight - w).toFixed(2) + ' ' + yy.toFixed(2) + ' Td <' + gl + '> Tj ET'); };
  const paragraph = (font, size, s, gap, indent) => { const maxW = PW - 2 * MX - (indent || 0), L = wrap(font, s, size, maxW), lh = size * 1.35; for (const ln of L) { ensure(lh); y -= lh; drawLine(font, size, ln, PW - MX, y + size * 0.25); } y -= gap || 0; };
  newPage();
  for (const b of B) {
    if (b.k === 'h1') paragraph('bold', 16, b.t, 6); else if (b.k === 'h2') { ensure(40); y -= 8; paragraph('bold', 12.5, b.t, 4); } else if (b.k === 'h3') paragraph('bold', 11, b.t, 3);
    else if (b.k === 'p' || b.k === 'kpi') paragraph('regular', 10, b.t, 2); else if (b.k === 'li') paragraph('regular', 10, '• ' + b.t, 1, 10);
    else if (b.k === 'table' && b.rows.length) {
      const nc = Math.max.apply(null, b.rows.map(r => r.cells.length)), avail = PW - 2 * MX, size = 8.5, pad = 3, lh = size * 1.3;
      const want = new Array(nc).fill(24); b.rows.forEach(r => r.cells.forEach((c, i) => { if (r.cells.length === 1 && nc > 1) return; const w = Math.min(wText(r.head ? 'bold' : 'regular', c, size) + 2 * pad + 2, avail * 0.6); if (w > want[i]) want[i] = w; }));
      let tot = want.reduce((a, c) => a + c, 0); const sc = tot > avail ? avail / tot : 1; let cw = want.map(w => w * sc); if (tot < avail) cw = cw.map(w => w * (avail / tot) > w ? w : w);
      const fill = tot < avail ? (avail - tot) / nc : 0; cw = cw.map(w => w + fill);
      const rowH = r => { const f = r.head ? 'bold' : 'regular'; if (r.cells.length === 1 && nc > 1) return wrap(f, r.cells[0], size, avail - 2 * pad).length * lh + 2 * pad; return Math.max.apply(null, r.cells.map((c, i) => wrap(f, c, size, cw[i] - 2 * pad).length)) * lh + 2 * pad; };
      const drawRow = r => {
        const f = r.head ? 'bold' : 'regular', hh = rowH(r); if (y - hh < MBOT) { newPage(); if (headRow && r !== headRow) drawRow(headRow); }
        const top = y; let x = PW - MX;
        if (r.head) ops.push('0.91 0.93 0.94 rg ' + (MX).toFixed(2) + ' ' + (top - hh).toFixed(2) + ' ' + avail.toFixed(2) + ' ' + hh.toFixed(2) + ' re f 0 g');
        if (r.cells.length === 1 && nc > 1) { wrap(f, r.cells[0], size, avail - 2 * pad).forEach((ln, k) => drawLine(f, size, ln, PW - MX - pad, top - pad - (k + 1) * lh + size * 0.3)); ops.push('0.75 G 0.5 w ' + MX + ' ' + (top - hh).toFixed(2) + ' ' + avail.toFixed(2) + ' ' + hh.toFixed(2) + ' re S 0 G'); }
        else r.cells.forEach((c, i) => { wrap(f, c, size, cw[i] - 2 * pad).forEach((ln, k) => drawLine(f, size, ln, x - pad, top - pad - (k + 1) * lh + size * 0.3)); ops.push('0.75 G 0.5 w ' + (x - cw[i]).toFixed(2) + ' ' + (top - hh).toFixed(2) + ' ' + cw[i].toFixed(2) + ' ' + hh.toFixed(2) + ' re S 0 G'); x -= cw[i]; });
        y -= hh;
      };
      const headRow = b.rows.find(r => r.head) || null; y -= 2; b.rows.forEach(r => drawRow(r)); y -= 8;
    }
  }
  // ---- assemble objects ----
  const objs = []; const add = (body) => { objs.push(body); return objs.length; };
  const used = { regular: new Set(), bold: new Set() };
  // fonts: 1=catalog 2=pages (patched later); allocate font objects first
  const fontObjs = {}; ['regular', 'bold'].forEach(fn => {
    const ff = FONT_FILES[fn], z = zlib.deflateSync(ff, { level: 9 });
    const file = add({ dict: '<< /Length ' + z.length + ' /Length1 ' + ff.length + ' /Filter /FlateDecode >>', stream: z });
    const bb = FM[fn].bbox, sc = 1000 / FM[fn].upm;
    const desc = add('<< /Type /FontDescriptor /FontName /ReportSubset' + (fn === 'bold' ? 'Bold' : 'Regular') + ' /Flags 4 /FontBBox [' + bb.map(v => Math.round(v * sc)).join(' ') + '] /ItalicAngle 0 /Ascent ' + Math.round(FM[fn].ascent * sc) + ' /Descent ' + Math.round(FM[fn].descent * sc) + ' /CapHeight ' + Math.round(FM[fn].ascent * sc * 0.7) + ' /StemV 80 /FontFile2 ' + file + ' 0 R >>');
    const gl = Object.entries(FM[fn].glyphs), gid = {}; gl.forEach(([cp, [g]]) => { if (!(g in gid)) gid[g] = Number(cp); });
    const W = Object.keys(gid).map(Number).sort((a, b) => a - b).map(g => g + ' [' + Math.round(FM[fn].glyphs[String(gid[g])][1] * sc) + ']').join(' ');
    const bf = Object.keys(gid).map(Number).sort((a, b) => a - b).map(g => '<' + hex4(g) + '> <' + hex4(gid[g] > 0xffff ? 63 : gid[g]) + '>').join('\n');
    const cmap = '/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange ' + Object.keys(gid).length + ' beginbfchar\n' + bf + '\nendbfchar endcmap CMapName currentdict /CMap defineresource pop end end';
    const tu = zlib.deflateSync(Buffer.from(cmap)), tuObj = add({ dict: '<< /Length ' + tu.length + ' /Filter /FlateDecode >>', stream: tu });
    const cid = add('<< /Type /Font /Subtype /CIDFontType2 /BaseFont /ReportSubset' + (fn === 'bold' ? 'Bold' : 'Regular') + ' /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ' + desc + ' 0 R /CIDToGIDMap /Identity /DW 600 /W [' + W + '] >>');
    fontObjs[fn] = add('<< /Type /Font /Subtype /Type0 /BaseFont /ReportSubset' + (fn === 'bold' ? 'Bold' : 'Regular') + ' /Encoding /Identity-H /DescendantFonts [' + cid + ' 0 R] /ToUnicode ' + tuObj + ' 0 R >>');
  });
  const total = pages.length, pageIds = [], title = String(opts.title || (B.find(x => x.k === 'h1') || {}).t || 'דוח');
  const pagesIdx = objs.length + 1 + pages.length * 2;      // pages-tree object number (allocated after page objects)
  pages.forEach((p, i) => {
    const foot = 'עמוד ' + (i + 1) + ' מתוך ' + total + ' · ' + title.slice(0, 80) + ' · נתונים סינתטיים (סביבת בדיקה)'; ops = p; drawLine('regular', 8, foot, PW - MX, 24);
    const content = zlib.deflateSync(Buffer.from(p.join('\n'), 'latin1')), c = add({ dict: '<< /Length ' + content.length + ' /Filter /FlateDecode >>', stream: content });
    pageIds.push(add('<< /Type /Page /Parent ' + pagesIdx + ' 0 R /MediaBox [0 0 ' + PW.toFixed(2) + ' ' + PH.toFixed(2) + '] /Resources << /Font << /F1 ' + fontObjs.regular + ' 0 R /F2 ' + fontObjs.bold + ' 0 R >> >> /Contents ' + c + ' 0 R >>'));
  });
  const pagesObj = add('<< /Type /Pages /Kids [' + pageIds.map(i => i + ' 0 R').join(' ') + '] /Count ' + pageIds.length + ' >>'); if (pagesObj !== pagesIdx) throw new Error('internal: pages object index');
  const info = add('<< /Title ' + pdfStr(title) + ' /Producer (MASLUL TEST export, synthetic data only) >>'), cat = add('<< /Type /Catalog /Pages ' + pagesObj + ' 0 R /Lang (he) /ViewerPreferences << /Direction /R2L >> >>');
  const parts = [Buffer.from('%PDF-1.5\n%\xE2\xE3\xCF\xD3\n', 'latin1')], offs = []; let pos = parts[0].length;
  objs.forEach((o, i) => { const head = Buffer.from((i + 1) + ' 0 obj\n', 'latin1'); let body; if (typeof o === 'string') body = Buffer.from(o + '\nendobj\n', 'latin1'); else body = Buffer.concat([Buffer.from(o.dict + '\nstream\n', 'latin1'), o.stream, Buffer.from('\nendstream\nendobj\n', 'latin1')]); offs.push(pos); parts.push(head, body); pos += head.length + body.length; });
  let x = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => ('0000000000' + o).slice(-10) + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + cat + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + pos + '\n%%EOF\n';
  parts.push(Buffer.from(x, 'latin1')); return Buffer.concat(parts);
}

// ---------------------------------------------------------------- XLSX writer (OOXML in a ZIP, deflate, fixed timestamps => deterministic) ----------------------------------------------------------------
const xe = s => String(s === null || s === undefined ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
function zip(files) {                 // files: [{name, data(Buffer)}]
  const D = (1 << 5) | 1, T = 0;      // 1980-01-01 00:00:00
  const local = [], central = []; let off = 0;
  for (const f of files) {
    const nameB = Buffer.from(f.name, 'utf8'), raw = f.data, def = zlib.deflateRawSync(raw, { level: 9 }), crc = zlib.crc32(raw) >>> 0;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8); lh.writeUInt16LE(T, 10); lh.writeUInt16LE(D, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(def.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nameB.length, 26); lh.writeUInt16LE(0, 28);
    local.push(lh, nameB, def);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(T, 12); ch.writeUInt16LE(D, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(def.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nameB.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, nameB); off += 30 + nameB.length + def.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat(local.concat([cd, end]));
}
function xlsxFromModel(model) {
  const names = []; const sheets = (model.sheets && model.sheets.length ? model.sheets : [{ name: 'דוח', header: [], rows: [] }]).map((s, i) => { let n = String(s.name || 'גיליון ' + (i + 1)).replace(/[\[\]*?\/\\:]/g, ' ').trim().slice(0, 31) || 'גיליון ' + (i + 1), b = n, k = 2; while (names.includes(n.toLowerCase())) n = b.slice(0, 28) + ' ' + k++; names.push(n.toLowerCase()); return { name: n, header: s.header || [], rows: s.rows || [] }; });
  const cell = (r, c, v, style) => { const ref = colName(c) + r; if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + (style ? ' s="' + style + '"' : '') + '><v>' + v + '</v></c>'; if (typeof v === 'boolean') v = v ? 'כן' : 'לא'; return '<c r="' + ref + '" t="inlineStr"' + (style ? ' s="' + style + '"' : '') + '><is><t xml:space="preserve">' + xe(v) + '</t></is></c>'; };
  const sheetXml = s => {
    const nc = Math.max(s.header.length, ...s.rows.map(r => r.length), 1), widths = new Array(nc).fill(8); [s.header].concat(s.rows.slice(0, 500)).forEach(r => r.forEach((v, i) => { const l = Math.min(60, String(v === null || v === undefined ? '' : v).length * 1.15 + 2); if (l > widths[i]) widths[i] = l; }));
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w.toFixed(1) + '" customWidth="1"/>').join('') + '</cols><sheetData>';
    x += '<row r="1">' + s.header.map((v, i) => cell(1, i, v, 1)).join('') + '</row>'; s.rows.forEach((r, k) => { x += '<row r="' + (k + 2) + '">' + r.map((v, i) => cell(k + 2, i, v, 0)).join('') + '</row>'; });
    return x + '</sheetData></worksheet>';
  };
  const files = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' + sheets.map((s, i) => '<sheet name="' + xe(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EDF0"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="right"/></xf></cellXfs></styleSheet>' }
  ].concat(sheets.map((s, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s) })));
  return zip(files.map(f => ({ name: f.name, data: Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8') })));
}
module.exports = { pdfFromHtml, xlsxFromModel, bidiVisual, blocks, zip };
