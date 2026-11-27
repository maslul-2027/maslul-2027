'use strict';
// Independent readers for generated report files: a REAL PDF text extraction (pdftotext, exit status + non-empty enforced) and a REAL XLSX parse (openpyxl in a child process, not our own writer).
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'filecheck-'));
const BIDI = /[‎‏‪-‮⁦-⁩]/g;
function save(bytes, ext) { const f = path.join(tmp, 'f' + Math.random().toString(36).slice(2) + ext); fs.writeFileSync(f, Buffer.from(bytes)); return f; }
function pdfText(bytes) {
  const f = save(bytes, '.pdf'), q = cp.spawnSync('qpdf', ['--check', f], { encoding: 'utf8' }); if (q.error || q.status !== 0) throw new Error('qpdf --check failed: ' + (q.error ? q.error.message : q.stderr || q.stdout));
  const r = cp.spawnSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }); if (r.error) throw new Error('pdftotext not runnable: ' + r.error.message); if (r.status !== 0) throw new Error('pdftotext exit ' + r.status + ': ' + r.stderr);
  const txt = r.stdout.replace(BIDI, ''); if (txt.replace(/\s/g, '').length < 200) throw new Error('PDF text is empty/too short (' + txt.length + ' chars)'); return txt;
}
function xlsxSheets(bytes) {
  const f = save(bytes, '.xlsx'), py = 'import sys,json,openpyxl\nwb=openpyxl.load_workbook(sys.argv[1],data_only=True)\nprint(json.dumps({ws.title:[[c for c in row] for row in ws.iter_rows(values_only=True)] for ws in wb.worksheets},ensure_ascii=False))';
  const r = cp.spawnSync('python3', ['-I', '-c', py, f], { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.error || r.status !== 0) throw new Error('openpyxl parse failed: ' + (r.error ? r.error.message : r.stderr)); const o = JSON.parse(r.stdout); if (!Object.keys(o).length) throw new Error('XLSX has no sheets'); return o;
}
const cellsOf = sheets => Object.keys(sheets).reduce((a, k) => a.concat(sheets[k].reduce((b, r) => b.concat(r), [])), []).filter(v => v !== null && v !== undefined);
module.exports = { pdfText, xlsxSheets, cellsOf, BIDI };
