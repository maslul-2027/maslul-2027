/* ReportKit — dependency-free PDF (A4, RTL Hebrew, embedded subset fonts, VECTOR charts) and XLSX writer that runs in the browser AND in Node (tests).
   Fonts/metrics come from the OFL subset already shipped in backend_next/assets (injected by scripts/build_native_app.js as RK_FONTS).
   Honest scope: text, KPI cards, tables, bar / histogram / diverging / line charts drawn as vector paths, optional JPEG emblems supplied by the owner. No network, no external service, no compression
   (streams are stored: files stay small because the content is text and paths). Data comes only from the caller (the authorized app model); this module never reads storage or the server. */
var RK = (function () {
  'use strict';
  var FM = RK_FONTS.metrics;
  function b64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  var FONT = { regular: b64(RK_FONTS.regular), bold: b64(RK_FONTS.bold) };
  var enc = function (s) { var u = new TextEncoder().encode(s); return u; };
  function cat(parts) { var n = 0, i; for (i = 0; i < parts.length; i++) n += parts[i].length; var o = new Uint8Array(n), p = 0; for (i = 0; i < parts.length; i++) { o.set(parts[i], p); p += parts[i].length; } return o; }
  var lat = function (s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };

  /* ---------- bidi: one RTL paragraph, simplified UBA (same rules as backend_next/export_formats.js plus attached number signs; a test asserts identical output on text without signed numbers) ---------- */
  var isHeb = function (c) { return (c >= 0x590 && c <= 0x5ff) || c === 0x200f; }, isLat = function (c) { return (c >= 65 && c <= 90) || (c >= 97 && c <= 122); }, isDig = function (c) { return c >= 48 && c <= 57; };
  var MIRROR = { 40: 41, 41: 40, 91: 93, 93: 91, 60: 62, 62: 60, 123: 125, 125: 123 };
  function bidiVisual(str) {
    var cp = Array.from(str).map(function (ch) { return ch.codePointAt(0); }).filter(function (c) { return c !== 0x200e && c !== 0x200f; }), n = cp.length, t = new Array(n), i;
    for (i = 0; i < n; i++) t[i] = isHeb(cp[i]) ? 'R' : isLat(cp[i]) ? 'L' : isDig(cp[i]) ? 'N' : 'O';
    for (i = 1; i < n - 1; i++) if (t[i] === 'O' && [46, 44, 58, 47, 45, 43, 0x2013].indexOf(cp[i]) !== -1 && t[i - 1] === 'N' && t[i + 1] === 'N') t[i] = 'N';
    for (i = 0; i < n - 1; i++) if (t[i] === 'O' && (cp[i] === 43 || cp[i] === 45 || cp[i] === 0x2212) && t[i + 1] === 'N' && (i === 0 || cp[i - 1] === 32 || cp[i - 1] === 40)) t[i] = 'N';   // leading sign of a number (+3.2, −1.5) stays attached to it (the only deliberate difference from backend_next/export_formats.js)
    for (i = 0; i < n; i++) if (t[i] === 'O' && (cp[i] === 37 || cp[i] === 36) && ((i > 0 && t[i - 1] === 'N') || (i < n - 1 && t[i + 1] === 'N'))) t[i] = 'N';
    var lvl = new Array(n);
    for (i = 0; i < n; i++) lvl[i] = t[i] === 'R' ? 1 : (t[i] === 'L' || t[i] === 'N') ? 2 : 0;
    for (i = 0; i < n; i++) if (lvl[i] === 0) { var a = i - 1; while (a >= 0 && lvl[a] === 0) a--; var b = i + 1; while (b < n && lvl[b] === 0) b++; var l = a >= 0 ? lvl[a] : 1, r = b < n ? lvl[b] : 1; lvl[i] = l === 2 && r === 2 ? 2 : 1; }
    var runs = []; for (i = 0; i < n; i++) { var last = runs[runs.length - 1]; if (last && last.l === lvl[i]) last.c.push(cp[i]); else runs.push({ l: lvl[i], c: [cp[i]] }); }
    var out = []; for (var k = runs.length - 1; k >= 0; k--) { var ru = runs[k]; if (ru.l === 1) for (var j = ru.c.length - 1; j >= 0; j--) out.push(MIRROR[ru.c[j]] || ru.c[j]); else ru.c.forEach(function (c) { out.push(c); }); }
    return out;
  }
  var glyphOf = function (font, cp) { return FM[font].glyphs[String(cp)] || FM[font].glyphs['63'] || FM[font].glyphs['32']; };
  var adv = function (font, cp, size) { return glyphOf(font, cp)[1] * size / FM[font].upm; };
  var wText = function (font, s, size) { var w = 0; Array.from(String(s)).forEach(function (ch) { var c = ch.codePointAt(0); if (c !== 0x200e && c !== 0x200f) w += adv(font, c, size); }); return w; };
  var hex4 = function (n) { return ('0000' + n.toString(16)).slice(-4); };
  var f2 = function (n) { return (Math.round(n * 100) / 100).toString(); };
  function wrap(font, s, size, maxW) {
    var words = String(s).split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) {
      while (wText(font, w, size) > maxW) { var k = 1; while (k < w.length && wText(font, w.slice(0, k + 1), size) <= maxW) k++; if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, k)); w = w.slice(k); }
      var cand = cur ? cur + ' ' + w : w; if (cur && wText(font, cand, size) > maxW) { lines.push(cur); cur = w; } else cur = cand;
    });
    if (cur) lines.push(cur); return lines.length ? lines : [''];
  }
  var TEAL = [0, 0.498, 0.514], RED = [0.773, 0.176, 0.212], INK = [0.086, 0.106, 0.125], GREY = [0.36, 0.41, 0.44], LIGHT = [0.93, 0.95, 0.96], LINE = [0.8, 0.84, 0.86], WHITE = [1, 1, 1];
  var rg = function (c) { return c.map(f2).join(' ') + ' rg '; }, RG = function (c) { return c.map(f2).join(' ') + ' RG '; };
  var pdfStr = function (s) { var h = ['feff']; Array.from(String(s)).forEach(function (ch) { var c = ch.codePointAt(0); if (c > 0xffff) c = 63; h.push(hex4(c)); }); return '<' + h.join('') + '>'; };

  /* ---------- PDF document ---------- */
  function Pdf(opts) {
    opts = opts || {};
    var PW = 595.28, PH = 841.89, MX = 36, MTOP = 62, MBOT = 50, W = PW - 2 * MX, X = PW - MX, pages = [], ops, y, title = String(opts.title || 'דוח'), logos = (opts.logos || []).slice(0, 3), self = {};
    function newPage() { ops = []; pages.push(ops); y = PH - MTOP; ops.push(rg(TEAL) + '0 ' + f2(PH - 5) + ' ' + f2(PW) + ' 5 re f ' + rg(RED) + f2(PW - 90) + ' ' + f2(PH - 5) + ' 90 5 re f 0 g'); }
    function ensure(h) { if (!ops || y - h < MBOT) newPage(); }
    function drawLine(font, size, s, xRight, yy, col) {
      var vis = bidiVisual(s), f = font === 'bold' ? 'F2' : 'F1', gl = vis.map(function (c) { return hex4(glyphOf(font, c)[0]); }).join(''), w = 0; vis.forEach(function (c) { w += adv(font, c, size); });
      ops.push(rg(col || INK) + 'BT /' + f + ' ' + size + ' Tf ' + f2(xRight - w) + ' ' + f2(yy) + ' Td <' + gl + '> Tj ET 0 g');
    }
    function drawLeft(font, size, s, xLeft, yy, col) { var w = wText(font, s, size); drawLine(font, size, s, xLeft + w, yy, col); }
    function drawCentre(font, size, s, xc, yy, col) { var w = wText(font, s, size); drawLine(font, size, s, xc + w / 2, yy, col); }
    function para(font, size, s, o) {
      o = o || {}; var maxW = (o.width || W) - (o.indent || 0), L = wrap(font, s, size, maxW), lh = size * 1.4, xr = o.xRight || X;
      L.forEach(function (ln) { ensure(lh); y -= lh; drawLine(font, size, ln, xr - (o.indent || 0), y + size * 0.28, o.color); }); y -= (o.gap === undefined ? 3 : o.gap);
    }
    function rect(x, yy, w, h, fill, stroke) { ops.push((fill ? rg(fill) : '') + (stroke ? RG(stroke) + '0.6 w ' : '') + f2(x) + ' ' + f2(yy) + ' ' + f2(Math.max(w, 0)) + ' ' + f2(Math.max(h, 0)) + ' re ' + (fill && stroke ? 'B' : fill ? 'f' : 'S') + ' 0 g 0 G'); }
    function path(pts, stroke, wd, dash) { if (pts.length < 2) return; ops.push(RG(stroke) + (wd || 1) + ' w ' + (dash ? '[3 2] 0 d ' : '') + pts.map(function (p, i) { return f2(p[0]) + ' ' + f2(p[1]) + (i ? ' l' : ' m'); }).join(' ') + ' S [] 0 d 0 G'); }
    function dot(x, yy, r, fill) { var k = 0.5523 * r; ops.push(rg(fill) + f2(x + r) + ' ' + f2(yy) + ' m ' + f2(x + r) + ' ' + f2(yy + k) + ' ' + f2(x + k) + ' ' + f2(yy + r) + ' ' + f2(x) + ' ' + f2(yy + r) + ' c ' + f2(x - k) + ' ' + f2(yy + r) + ' ' + f2(x - r) + ' ' + f2(yy + k) + ' ' + f2(x - r) + ' ' + f2(yy) + ' c ' + f2(x - r) + ' ' + f2(yy - k) + ' ' + f2(x - k) + ' ' + f2(yy - r) + ' ' + f2(x) + ' ' + f2(yy - r) + ' c ' + f2(x + k) + ' ' + f2(yy - r) + ' ' + f2(x + r) + ' ' + f2(yy - k) + ' ' + f2(x + r) + ' ' + f2(yy) + ' c f 0 g'); }

    self.header = function (head, sub, meta) {                      // brand header: owner emblems (only if supplied) on the left, title block on the right
      ensure(110); var top = y;
      logos.forEach(function (lg, i) { var hh = 34, ww = hh * lg.w / lg.h; ops.push('q ' + f2(ww) + ' 0 0 ' + f2(hh) + ' ' + f2(MX + i * (ww + 10)) + ' ' + f2(top - hh) + ' cm /Im' + (i + 1) + ' Do Q'); lg.used = true; });
      y -= 4; para('bold', 20, head, { gap: 2 }); if (sub) para('regular', 10.5, sub, { color: GREY, gap: 2 });
      (meta || []).forEach(function (m) { para('regular', 8.5, m, { color: GREY, gap: 0 }); });
      y -= 6; ops.push(RG(LINE) + '0.8 w ' + MX + ' ' + f2(y) + ' m ' + f2(X) + ' ' + f2(y) + ' l S 0 G'); y -= 10;
    };
    self.h2 = function (s) { ensure(46); y -= 8; rect(X - 4, y - 14, 4, 15, TEAL); para('bold', 12.5, s, { indent: 10, gap: 4 }); };
    self.p = function (s, o) { para('regular', (o && o.size) || 9.5, s, o); };
    self.bullets = function (arr) { arr.forEach(function (s) { para('regular', 9.5, '• ' + s, { indent: 8, gap: 1.5 }); }); y -= 3; };
    self.space = function (h) { y -= h; };
    self.pageBreak = function () { newPage(); };
    self.kpis = function (cards) {
      var n = cards.length, gap = 8, cw = (W - gap * (n - 1)) / n, hh = 62; ensure(hh + 8); var top = y;
      cards.forEach(function (c, i) {
        var xr = X - i * (cw + gap), xl = xr - cw; rect(xl, top - hh, cw, hh, LIGHT); rect(xl, top - 3, cw, 3, c.accent || TEAL);
        drawLine('regular', 8, c.label, xr - 7, top - 17, GREY); drawLine('bold', 19, String(c.value), xr - 7, top - 40, INK);
        if (c.note) { var ln = wrap('regular', c.note, 7.5, cw - 12); drawLine('regular', 7.5, ln[0], xr - 7, top - 54, c.noteColor || GREY); }
      });
      y -= hh + 10;
    };
    self.table = function (head, rows, o) {
      o = o || {}; var nc = head.length, size = 8.5, pad = 4, lh = size * 1.35, avail = W, want = head.map(function (hd) { return wText('bold', hd, size) + 2 * pad + 4; });
      rows.forEach(function (r) { r.forEach(function (c, i) { var w = Math.min(wText('regular', String(c), size) + 2 * pad + 4, avail * 0.5); if (w > want[i]) want[i] = w; }); });
      var tot = want.reduce(function (a, b) { return a + b; }, 0), sc = tot > avail ? avail / tot : 1, cw = want.map(function (w) { return w * sc + (tot < avail ? (avail - tot) / nc : 0); });
      function rowH(r, bold) { return Math.max.apply(null, r.map(function (c, i) { return wrap(bold ? 'bold' : 'regular', String(c), size, cw[i] - 2 * pad).length; })) * lh + 2 * pad; }
      function drawRow(r, bold, fill) { var hh = rowH(r, bold); if (y - hh < MBOT) { newPage(); if (!bold) drawRow(head, true, LIGHT); } var top = y, x = X; if (fill) rect(MX, top - hh, avail, hh, fill); r.forEach(function (c, i) { wrap(bold ? 'bold' : 'regular', String(c), size, cw[i] - 2 * pad).forEach(function (ln, k) { drawLine(bold ? 'bold' : 'regular', size, ln, x - pad, top - pad - (k + 1) * lh + size * 0.32, (o.colors && o.colors[rows.indexOf(r)] && o.colors[rows.indexOf(r)][i]) || INK); }); x -= cw[i]; }); path([[MX, top - hh], [X, top - hh]], LINE, 0.5); y -= hh; }
      ensure(rowH(head, true) + (rows.length ? rowH(rows[0], false) : 0) + 24); y -= 2; drawRow(head, true, LIGHT); rows.forEach(function (r) { drawRow(r, false); }); y -= 8;
    };
    function chartTitle(t, note) { ensure(40); para('bold', 10.5, t, { gap: 1 }); if (note) para('regular', 8, note, { color: GREY, gap: 4 }); }
    self.hbars = function (o) {                                     // horizontal bars from the right edge; value label at the bar end
      chartTitle(o.title, o.note); var rows = o.rows, lw = 130, bw = W - lw - 40, rh = 17, max = o.max || Math.max.apply(null, rows.map(function (r) { return r.value || 0; }).concat([1]));
      ensure(rows.length * rh + 6); rows.forEach(function (r) {
        ensure(rh); y -= rh; drawLine('regular', 8.5, r.label, X, y + 4, INK); var bx = X - lw, v = r.value; rect(bx - bw, y + 2, bw, 11, LIGHT);
        if (v !== null && v !== undefined) { var w = Math.max(1.5, bw * Math.min(v, max) / max); rect(bx - w, y + 2, w, 11, r.color || TEAL); drawLine('bold', 8, r.text !== undefined ? r.text : f2(v), bx - bw - 4, y + 4.5, INK); }
        else drawLine('regular', 8, r.text || '—', bx - bw - 4, y + 4.5, GREY);
      }); y -= 8;
    };
    self.histogram = function (o) {                                 // numeric bins low → high from LEFT to RIGHT (number line); bin counts above the bars
      chartTitle(o.title, o.note); var bins = o.bins, n = bins.length, ch = 110, gap = 6, bw = (W - 30 - gap * (n - 1)) / n, max = Math.max.apply(null, bins.map(function (b) { return b.n; }).concat([1]));
      ensure(ch + 36); var base = y - ch - 6, x0 = MX + 30; path([[x0 - 4, base], [X, base]], LINE, 0.8); path([[x0 - 4, base], [x0 - 4, base + ch]], LINE, 0.8);
      drawLine('regular', 7.5, String(max), x0 - 8, base + ch - 6, GREY); drawLine('regular', 7.5, '0', x0 - 8, base - 3, GREY);
      bins.forEach(function (b, i) { var bx = x0 + i * (bw + gap), hh = ch * b.n / max; rect(bx, base, bw, hh, b.color || TEAL); drawCentre('bold', 8, String(b.n), bx + bw / 2, base + hh + 3, INK); drawCentre('regular', 7.5, b.label, bx + bw / 2, base - 12, GREY); });
      y = base - 24;
    };
    self.diverging = function (o) {                                 // delta per group: red = decline (left), teal = improvement (right); axis in the middle
      chartTitle(o.title, o.note); var rows = o.rows, lw = 130, aw = W - lw - 10, mid = MX + aw / 2, rh = 17, max = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.value || 0); }).concat([0.01]));
      rows.forEach(function (r) { ensure(rh); y -= rh; drawLine('regular', 8.5, r.label, X, y + 4, INK); if (r.value === null || r.value === undefined) { drawCentre('regular', 8, r.text || '—', mid, y + 4.5, GREY); return; }
        var w = Math.max(1.5, (aw / 2 - 28) * Math.abs(r.value) / max), pos = r.value >= 0; rect(pos ? mid : mid - w, y + 2, w, 11, pos ? TEAL : RED); drawLine('bold', 8, r.text, pos ? mid + w + 24 : mid - w - 3, y + 4.5, INK); });
      path([[mid, y], [mid, y + rows.length * rh]], GREY, 0.7); y -= 8;
    };
    self.lines = function (o) {                                     // time runs RIGHT → LEFT (OLDEST at the right edge, newest at the left — the reading direction of Hebrew), markers + value labels, gaps for missing values
      chartTitle(o.title, o.note); var ch = 120, ensureH = ch + 40; ensure(ensureH); var base = y - ch - 6, x0 = MX + 34, aw = W - 44, labels = o.labels, n = labels.length, lo = o.yMin, hi = o.yMax;
      path([[x0, base], [X, base]], LINE, 0.8); path([[x0, base], [x0, base + ch]], LINE, 0.8);
      [0, 0.5, 1].forEach(function (f) { var yy = base + ch * f; if (f) path([[x0, yy], [X, yy]], LINE, 0.4, true); drawLine('regular', 7.5, f2(lo + (hi - lo) * f), x0 - 4, yy - 3, GREY); });
      var xs = labels.map(function (_, i) { return n === 1 ? x0 + aw / 2 : X - 8 - i * ((aw - 16) / (n - 1)); });
      labels.forEach(function (lb, i) { drawCentre('regular', 7.5, lb, xs[i], base - 12, GREY); });
      o.series.forEach(function (s) { var seg = []; s.values.forEach(function (v, i) { if (v === null || v === undefined) { path(seg, s.color || TEAL, 1.6); seg = []; return; } var py = base + ch * (v - lo) / (hi - lo || 1); seg.push([xs[i], py]); }); path(seg, s.color || TEAL, 1.6);
        s.values.forEach(function (v, i) { if (v === null || v === undefined) return; var py = base + ch * (v - lo) / (hi - lo || 1); dot(xs[i], py, 2.6, s.color || TEAL); drawCentre('bold', 7.5, f2(v), xs[i], py + 5, INK); }); });
      y = base - 24;
    };
    self.build = function () {
      if (!pages.length) newPage();
      var objs = [], add = function (b) { objs.push(b); return objs.length; }, fontObjs = {};
      ['regular', 'bold'].forEach(function (fn) {
        var ff = FONT[fn], file = add({ dict: '<< /Length ' + ff.length + ' /Length1 ' + ff.length + ' >>', stream: ff }), bb = FM[fn].bbox, sc = 1000 / FM[fn].upm, nm = 'ReportSubset' + (fn === 'bold' ? 'Bold' : 'Regular');
        var desc = add('<< /Type /FontDescriptor /FontName /' + nm + ' /Flags 4 /FontBBox [' + bb.map(function (v) { return Math.round(v * sc); }).join(' ') + '] /ItalicAngle 0 /Ascent ' + Math.round(FM[fn].ascent * sc) + ' /Descent ' + Math.round(FM[fn].descent * sc) + ' /CapHeight ' + Math.round(FM[fn].ascent * sc * 0.7) + ' /StemV 80 /FontFile2 ' + file + ' 0 R >>');
        var gid = {}; Object.keys(FM[fn].glyphs).forEach(function (cp) { var g = FM[fn].glyphs[cp][0]; if (!(g in gid)) gid[g] = Number(cp); });
        var gs = Object.keys(gid).map(Number).sort(function (a, b) { return a - b; }), W2 = gs.map(function (g) { return g + ' [' + Math.round(FM[fn].glyphs[String(gid[g])][1] * sc) + ']'; }).join(' '), bf = gs.map(function (g) { return '<' + hex4(g) + '> <' + hex4(gid[g] > 0xffff ? 63 : gid[g]) + '>'; }).join('\n');
        var cmap = lat('/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange ' + gs.length + ' beginbfchar\n' + bf + '\nendbfchar endcmap CMapName currentdict /CMap defineresource pop end end'), tu = add({ dict: '<< /Length ' + cmap.length + ' >>', stream: cmap });
        var cid = add('<< /Type /Font /Subtype /CIDFontType2 /BaseFont /' + nm + ' /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ' + desc + ' 0 R /CIDToGIDMap /Identity /DW 600 /W [' + W2 + '] >>');
        fontObjs[fn] = add('<< /Type /Font /Subtype /Type0 /BaseFont /' + nm + ' /Encoding /Identity-H /DescendantFonts [' + cid + ' 0 R] /ToUnicode ' + tu + ' 0 R >>');
      });
      var imgObjs = logos.map(function (lg) { return add({ dict: '<< /Type /XObject /Subtype /Image /Width ' + lg.w + ' /Height ' + lg.h + ' /ColorSpace /' + (lg.gray ? 'DeviceGray' : 'DeviceRGB') + ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + lg.bytes.length + ' >>', stream: lg.bytes }); });
      var total = pages.length, pageIds = [], pagesIdx = objs.length + 1 + total * 2, xo = imgObjs.map(function (o, i) { return '/Im' + (i + 1) + ' ' + o + ' 0 R'; }).join(' ');
      pages.forEach(function (p, i) {
        ops = p; var foot = 'עמוד ' + (i + 1) + ' מתוך ' + total + ' · ' + title.slice(0, 70) + ' · ' + (opts.footer || 'נתונים סינתטיים (סביבת בדיקה)'); path([[MX, 38], [X, 38]], LINE, 0.5); drawLine('regular', 8, foot, X, 26, GREY);
        var cb = lat(p.join('\n')), c = add({ dict: '<< /Length ' + cb.length + ' >>', stream: cb });
        pageIds.push(add('<< /Type /Page /Parent ' + pagesIdx + ' 0 R /MediaBox [0 0 ' + f2(PW) + ' ' + f2(PH) + '] /Resources << /Font << /F1 ' + fontObjs.regular + ' 0 R /F2 ' + fontObjs.bold + ' 0 R >>' + (xo ? ' /XObject << ' + xo + ' >>' : '') + ' >> /Contents ' + c + ' 0 R >>'));
      });
      var pagesObj = add('<< /Type /Pages /Kids [' + pageIds.map(function (i) { return i + ' 0 R'; }).join(' ') + '] /Count ' + pageIds.length + ' >>'); if (pagesObj !== pagesIdx) throw new Error('internal: pages object index');
      var info = add('<< /Title ' + pdfStr(title) + ' /Producer (MASLUL ReportKit, synthetic data only) /CreationDate (D:' + (opts.stamp || '20260101000000') + 'Z) >>'), root = add('<< /Type /Catalog /Pages ' + pagesObj + ' 0 R /Lang (he) /ViewerPreferences << /Direction /R2L /DisplayDocTitle true >> >>');
      var parts = [lat('%PDF-1.5\n%\xE2\xE3\xCF\xD3\n')], offs = [], pos = parts[0].length;
      objs.forEach(function (o, i) { var head = lat((i + 1) + ' 0 obj\n'), body = typeof o === 'string' ? lat(o + '\nendobj\n') : cat([lat(o.dict + '\nstream\n'), o.stream, lat('\nendstream\nendobj\n')]); offs.push(pos); parts.push(head, body); pos += head.length + body.length; });
      parts.push(lat('xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(function (o) { return ('0000000000' + o).slice(-10) + ' 00000 n \n'; }).join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + root + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + pos + '\n%%EOF\n'));
      return cat(parts);
    };
    self.pageCount = function () { return pages.length; };
    return self;
  }

  /* ---------- XLSX (OOXML in a stored ZIP; typed numbers; RTL sheets) ---------- */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  var crc32 = function (u) { var c = 0xffffffff; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(files) {
    var local = [], central = [], off = 0, D = (1 << 5) | 1;
    files.forEach(function (f) {
      var nameB = enc(f.name), raw = f.data, crc = crc32(raw), lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, D, true); lh.setUint32(14, crc, true); lh.setUint32(18, raw.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, nameB.length, true); lh.setUint16(28, 0, true);
      local.push(new Uint8Array(lh.buffer), nameB, raw);
      var ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, D, true); ch.setUint32(16, crc, true); ch.setUint32(20, raw.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, nameB.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nameB); off += 30 + nameB.length + raw.length;
    });
    var cd = cat(central), end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cd.length, true); end.setUint32(16, off, true);
    return cat(local.concat([cd, new Uint8Array(end.buffer)]));
  }
  var xe = function (s) { return String(s === null || s === undefined ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var colName = function (i) { var s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  function xlsx(model) {                                            // model.sheets = [{name, header:[], rows:[[]], note?}]
    var used = {}, sheets = model.sheets.map(function (s, i) { var n = String(s.name || 'גיליון ' + (i + 1)).replace(/[\[\]*?\/\\:]/g, ' ').trim().slice(0, 31) || 'גיליון ' + (i + 1), b = n, k = 2; while (used[n]) n = b.slice(0, 28) + ' ' + k++; used[n] = 1; return { name: n, header: s.header, rows: s.rows }; });
    var cell = function (r, c, v, st) { var ref = colName(c) + r; if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + (st ? ' s="1"' : '') + '><v>' + v + '</v></c>'; return '<c r="' + ref + '" t="inlineStr"' + (st ? ' s="1"' : '') + '><is><t xml:space="preserve">' + xe(v) + '</t></is></c>'; };
    var sheetXml = function (s) {
      var nc = Math.max(s.header.length, 1), widths = new Array(nc).fill(10); [s.header].concat(s.rows.slice(0, 300)).forEach(function (r) { r.forEach(function (v, i) { if (i < nc) widths[i] = Math.max(widths[i], Math.min(60, String(v === null || v === undefined ? '' : v).length * 1.2 + 3)); }); });
      var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + Math.round(w) + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>';
      x += '<row r="1">' + s.header.map(function (v, i) { return cell(1, i, v, 1); }).join('') + '</row>'; s.rows.forEach(function (r, k) { x += '<row r="' + (k + 2) + '">' + r.map(function (v, i) { return cell(k + 2, i, v, 0); }).join('') + '</row>'; });
      return x + '</sheetData></worksheet>';
    };
    var H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', R = 'http://schemas.openxmlformats.org/', files = [
      { name: '[Content_Types].xml', data: H + '<Types xmlns="' + R + 'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (_, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' },
      { name: '_rels/.rels', data: H + '<Relationships xmlns="' + R + 'package/2006/relationships"><Relationship Id="rId1" Type="' + R + 'officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: H + '<workbook xmlns="' + R + 'spreadsheetml/2006/main" xmlns:r="' + R + 'officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' + sheets.map(function (s, i) { return '<sheet name="' + xe(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: H + '<Relationships xmlns="' + R + 'package/2006/relationships">' + sheets.map(function (_, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="' + R + 'officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="' + R + 'officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: H + '<styleSheet xmlns="' + R + 'spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF0"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' }
    ].concat(sheets.map(function (s, i) { return { name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s) }; }));
    return zip(files.map(function (f) { return { name: f.name, data: enc(f.data) }; }));
  }
  return { Pdf: Pdf, xlsx: xlsx, bidiVisual: bidiVisual, wText: wText, crc32: crc32, colors: { TEAL: TEAL, RED: RED, INK: INK, GREY: GREY } };
})();
