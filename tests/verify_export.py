# Verifies the report MODEL (written by tests/v1_reports.js) can be turned into a real .xlsx and read back (openpyxl) — simulation of the Sheets export path, NOT Apps Script.
import json, sys, os, tempfile, openpyxl
SRC = os.environ.get('EXPORT_MODEL_OUT') or (sys.argv[1] if len(sys.argv) > 1 else None)
if not SRC: sys.exit('usage: EXPORT_MODEL_OUT=<model.json> python3 tests/verify_export.py   (or pass the path as argument; the model is written by tests/v1_reports.js when EXPORT_MODEL_OUT is set)')
TMP = tempfile.mkdtemp(prefix='ct-xlsx-')
m = json.load(open(SRC)); wb = openpyxl.Workbook(); wb.remove(wb.active)
for t in m['sheets']:
    ws = wb.create_sheet(t['name'][:31]); ws.append(t['header'])
    for r in t['rows']: ws.append(r)
XLSX = os.path.join(TMP, 'export_check.xlsx'); wb.save(XLSX); wb2 = openpyxl.load_workbook(XLSX)
assert len(wb2.sheetnames) == len(m['sheets']); bad = [n for n in wb2.sheetnames if len(n) > 31 or any(c in n for c in '[]:*?/\\')]; assert not bad, bad
n = sum(ws.max_row - 1 for ws in wb2.worksheets); print('xlsx ok: sheets=%d data_rows=%d' % (len(wb2.sheetnames), n))
# formula injection: no text cell may start with = + - @ unless prefixed by an apostrophe
for ws in wb2.worksheets:
    for row in ws.iter_rows(values_only=True):
        for v in row:
            if isinstance(v, str) and v[:1] in '=+-@': print('INJECTION RISK', ws.title, v[:30]); sys.exit(1)
print('no formula-injection cells')
