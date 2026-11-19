// Renders Reports.html_ with real Chromium page.pdf (simulation of the HtmlService->PDF path; NOT Apps Script) and checks the text, RTL and escaping.
const { setup } = require('./fixture'); const { chromium } = require('playwright'); const { execFileSync } = require('child_process'); const fs = require('fs'); const assert = require('assert');
const PDF = require('path').join(fs.mkdtempSync(require('path').join(require('os').tmpdir(), 'ct-pdf-')), 'report_check.pdf');
(async () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; X.Soldiers.create(admin, c1, { full_name: '<script>window.__x=1</script>דנה', personal_number: '999', gender: 'F', department_id: S.dep(0), team_id: S.team(0, 0) });
  const model = X.Reports.build(admin, c1, { sections: ['soldiers', 'marksmanship'] }); const html = X.Reports.html_(model);
  assert.ok(!html.includes('<script>window.__x'), 'escaped'); assert.ok(/dir="rtl"/.test(html), 'rtl');
  const b = await chromium.launch(); const pg = await b.newPage(); await pg.setContent(html); await pg.pdf({ path: PDF, format: 'A4' }); await b.close();
  const txt = execFileSync('pdftotext', [PDF, '-']).toString(); assert.ok(fs.statSync(PDF).size > 1000); assert.ok(txt.includes('999') && txt.includes('script') , 'pdf has the data (script text shown as text)'); assert.ok(!txt.includes('undefined'));
  console.log('pdf ok: ' + fs.statSync(PDF).size + ' bytes, text chars ' + txt.length);
})().catch(e => { console.error('PDF FAIL', e.message); process.exit(1); });
