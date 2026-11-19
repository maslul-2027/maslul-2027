// In-memory fake of SpreadsheetApp / PropertiesService, detailed enough to run the REAL SheetsStore (Store.gs) in Node, with FAULT INJECTION.
// Node tests ONLY — this is a simulation, NOT evidence of real Google Sheets behaviour (formats, quotas, atomicity of setValues are assumptions).
function create() {
  const state = { sheets: {}, spreadsheets: {}, props: {}, n: 0, ops: [], hook: null };
  const fire = (op, sheet, info) => { state.ops.push(op + ':' + sheet); return state.hook ? state.hook(op, sheet, info || {}) : undefined; };
  class Range {
    constructor(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
    _each(fn) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) fn(this.r + i, this.c + j, i, j); }
    getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh._get(this.r + i, this.c + j)); o.push(row); } return o; }
    getFormulas() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh._f(this.r + i, this.c + j)); o.push(row); } return o; }
    getValue() { return this.sh._get(this.r, this.c); }
    getNumberFormat() { return this.sh._fmt(this.r, this.c); }
    setValues(v) { if (v.length !== this.nr || (v[0] || []).length !== this.nc) throw new Error('Dimension mismatch'); const act = fire('setValues', this.sh.name, { rows: this.nr, r: this.r, c: this.c });
      /* hook may return {partial:k} (write only the first k rows, then throw) or {corrupt:true} (write everything but silently alter the first cell) */
      if (act && typeof act.partial === 'number') { this._each((R, C, i, j) => { if (i < act.partial) this.sh._set(R, C, v[i][j]); }); throw new Error('INJECTED partial write'); }
      this._each((R, C, i, j) => this.sh._set(R, C, v[i][j])); if (act && act.corrupt) this.sh._put(this.r, this.c, 'CORRUPTED'); return this; }
    setValue(v) { fire('setValue', this.sh.name, { r: this.r, c: this.c }); this.sh._set(this.r, this.c, v); return this; }
    clearContent() { fire('clearContent', this.sh.name, { rows: this.nr, r: this.r }); this._each((R, C) => { this.sh._put(R, C, ''); this.sh._form[R + ',' + C] = ''; }); return this; }
    setNumberFormat(f) { fire('setNumberFormat', this.sh.name, { rows: this.nr }); this._each((R, C) => { this.sh.fmts[R + ',' + C] = f; }); return this; }
    setFontWeight() { return this; }
    offset(dr, dc, nr, nc) { return new Range(this.sh, this.r + dr, this.c + dc, nr || this.nr, nc || this.nc); }
  }
  class Sheet {
    constructor(name) { this.name = name; this.d = {}; this.fmts = {}; this._form = {}; this.maxRows = 1000; }
    _put(r, c, v) { this.d[r + ',' + c] = v; } _get(r, c) { const v = this.d[r + ',' + c]; return v === undefined ? '' : v; } _f(r, c) { return this._form[r + ',' + c] || ''; } _fmt(r, c) { return this.fmts[r + ',' + c] || 'General'; }
    _set(r, c, v) { if (v === null || v === undefined) v = ''; this._form[r + ',' + c] = '';
      if (typeof v === 'string' && v !== '' && this._fmt(r, c) !== '@') { if (v[0] === '=') { this._form[r + ',' + c] = v; this._put(r, c, ''); return; } if (/^-?\d+(\.\d+)?$/.test(v)) { this._put(r, c, Number(v)); return; } }
      this._put(r, c, v); }
    getLastRow() { let m = 0; Object.keys(this.d).forEach(k => { if (this.d[k] !== '' || this._form[k]) m = Math.max(m, +k.split(',')[0]); }); return m; }
    getLastColumn() { let m = 0; Object.keys(this.d).forEach(k => { if (this.d[k] !== '' || this._form[k]) m = Math.max(m, +k.split(',')[1]); }); return m; }
    getMaxRows() { return this.maxRows; }
    insertRowsAfter(after, n) { fire('insertRowsAfter', this.name, { n }); this.maxRows += n; }
    getRange(r, c, nr, nc) { return new Range(this, r, c, nr || 1, nc || 1); }
    setFrozenRows() {}
  }
  class Spreadsheet {
    constructor(title) { this.title = title; this.id = 'ss-' + (++state.n); this.sheets = []; state.spreadsheets[this.id] = this; this.insertSheet('Sheet1'); }
    getId() { return this.id; } getUrl() { return 'https://fake/' + this.id; } getSheets() { return this.sheets; }
    getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
    insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
    deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
  }
  const SpreadsheetApp = { create: t => new Spreadsheet(t), openById: id => { if (!state.spreadsheets[id]) throw new Error('no such spreadsheet'); return state.spreadsheets[id]; } };
  const PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in state.props ? state.props[k] : null), setProperty: (k, v) => { state.props[k] = v; } }) };
  return { state, SpreadsheetApp, PropertiesService, setHook: h => { state.hook = h; }, ops: () => state.ops };
}
module.exports = { create };
