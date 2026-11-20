/**
 * Store — data access. Two Spreadsheets: MAIN and PRIVATE (private notes / assessments / personal details).
 * The spreadsheets are owned by the deploying admin and are NOT shared with commanders: the Web App runs as
 * the deployer (executeAs USER_DEPLOYING), so every read/write passes through server-side Policy checks.
 * Tests replace the store with an in-memory implementation exposing the same methods.
 */

const Locks = {
  _held: 0,
  /** Re-entrant: a nested run() inside a held lock just runs (the Apps Script ScriptLock is NOT re-entrant and would deadlock for 30s). */
  run(fn) {
    if (Locks._held > 0) return fn();
    if (typeof LockService === 'undefined') { Locks._held++; try { return fn(); } finally { Locks._held--; } }
    const lock = LockService.getScriptLock();
    try { lock.waitLock(30000); } catch (e) { throw new AppError('BUSY', 'המערכת עסוקה, נסו שוב בעוד רגע.'); }
    Locks._held++;
    try { return fn(); } finally { Locks._held--; lock.releaseLock(); }
  }
};

const SheetsStore = {
  _ss: {},

  ss_(storeName) {
    if (SheetsStore._ss[storeName]) return SheetsStore._ss[storeName];
    const key = storeName === 'private' ? APP.PROP.PRIVATE_DB : APP.PROP.MAIN_DB;
    const id = PropertiesService.getScriptProperties().getProperty(key);
    if (!id) throw new AppError('NOT_INSTALLED', 'המערכת טרם הותקנה (יש להריץ setupDatabase).');
    SheetsStore._ss[storeName] = SpreadsheetApp.openById(id);
    return SheetsStore._ss[storeName];
  },

  sheet_(table) {
    const sh = SheetsStore.ss_(TABLES[table].store).getSheetByName(table);
    if (!sh) throw new AppError('NOT_INSTALLED', 'חסרה לשונית ' + table + ' (יש להריץ setupDatabase).');
    return sh;
  },

  headers_(sh) {
    const lc = sh.getLastColumn();
    return lc < 1 ? [] : sh.getRange(1, 1, 1, lc).getValues()[0].map(String);
  },

  norm_(table, header, v) {
    const def = TABLES[table];
    if (v instanceof Date) return Util.cellToIsoDate(v);
    if (def.textCols && def.textCols.indexOf(header) !== -1) return v === '' || v === null ? '' : String(v);
    return v;
  },

  readAll(table) {
    const sh = SheetsStore.sheet_(table);
    const last = sh.getLastRow();
    if (last < 2) return [];
    const values = sh.getRange(1, 1, last, sh.getLastColumn()).getValues();
    const headers = values.shift().map(String);
    const idIdx = headers.indexOf('id');
    const out = [];
    values.forEach(function (row) {
      if (row[idIdx] === '' || row[idIdx] === null) return;
      const o = {};
      headers.forEach(function (h, j) { o[h] = SheetsStore.norm_(table, h, row[j]); });
      out.push(o);
    });
    return out;
  },

  /**
   * v0.2.2 write policy: EVERY non-empty string is written as plain text (number format '@' set BEFORE the write),
   * not only strings starting with a few known prefixes (space / LF / TAB / CR / NBSP / zero-width + = - + @ ... are all covered).
   * isFormulaLike_ is kept only to flag risky values (for tests / diagnostics); it no longer decides whether text-format is applied.
   * The '@' behaviour is NOT verified in real Apps Script — so every write is READ BACK (getFormulas + getValues) and the
   * operation FAILS CLOSED (cells cleared + error) if a formula appeared or the value was altered. See STAGING_TEST_PLAN S23.
   */
  isFormulaLike_(v) { return typeof v === 'string' && /^[\s\u00a0\u200b-\u200d\u2060\ufeff]*[=+\-@]/.test(v); },

  /** Pure: decides, per column, the value to write and whether the cell must be forced to plain text. */
  cellPlan_(table, headers, obj) {
    const def = TABLES[table];
    const textCols = def.textCols || [];
    return headers.map(function (h) {
      const raw = obj[h] === undefined || obj[h] === null ? '' : obj[h];
      const forceText = (typeof raw === 'string' && raw !== '') || textCols.indexOf(h) !== -1;
      return { header: h, value: forceText && raw !== '' ? String(raw) : raw, forceText: forceText };
    });
  },

  /** Reads the just-written cells back; returns the header of the first bad cell (formula appeared / text altered) or null. */
  findBadWrite_(range, plan) {
    const formulas = range.getFormulas()[0], values = range.getValues()[0];
    let bad = null;
    plan.forEach(function (c, j) {
      if (bad !== null) return;
      if (formulas[j] !== undefined && formulas[j] !== null && String(formulas[j]) !== '') bad = c.header;
      else if (typeof c.value === 'string' && c.value !== '' && String(values[j]) !== c.value) bad = c.header;
    });
    return bad;
  },

  /** insert: clears the (new) row and throws if the written cells are not exactly the intended text. */
  verifyWrite_(range, plan) {
    const bad = SheetsStore.findBadWrite_(range, plan);
    if (bad !== null) {
      range.clearContent();
      throw new Error('UNSAFE_WRITE: ערך נכתב שלא כטקסט בעמודה ' + bad + ' — הכתיבה בוטלה.');
    }
  },

  insert(table, obj) {
    const sh = SheetsStore.sheet_(table);
    const headers = SheetsStore.headers_(sh);
    Object.keys(obj).forEach(function (k) {
      if (headers.indexOf(k) === -1) throw new Error('Schema mismatch: ' + table + '.' + k);
    });
    const plan = SheetsStore.cellPlan_(table, headers, obj);
    const rowNo = sh.getLastRow() + 1;
    if (rowNo > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), Math.max(rowNo - sh.getMaxRows(), 100));   // writing past the grid would throw
    plan.forEach(function (c, j) { if (c.forceText) sh.getRange(rowNo, j + 1).setNumberFormat('@'); });
    const range = sh.getRange(rowNo, 1, 1, headers.length);
    range.setValues([plan.map(function (c) { return c.value; })]);
    SheetsStore.verifyWrite_(range, plan);
    return obj;
  },

  updateById(table, id, patch) {
    const sh = SheetsStore.sheet_(table);
    const headers = SheetsStore.headers_(sh);
    const last = sh.getLastRow();
    if (last < 2) throw new AppError('NOT_FOUND', 'הרשומה לא נמצאה.');
    const idIdx = headers.indexOf('id');
    const ids = sh.getRange(2, idIdx + 1, last - 1, 1).getValues();
    let rowNo = -1;
    for (let i = 0; i < ids.length; i++) { if (String(ids[i][0]) === String(id)) { rowNo = i + 2; break; } }
    if (rowNo < 0) throw new AppError('NOT_FOUND', 'הרשומה לא נמצאה.');
    Object.keys(patch).forEach(function (k) {
      if (k === 'id') throw new Error('id is immutable');
      const c = headers.indexOf(k);
      if (c === -1) throw new Error('Schema mismatch: ' + table + '.' + k);
    });
    // v0.2.3: all-or-nothing. Snapshot every target cell (value + number format), write all, verify all;
    // on ANY failure restore every touched cell and verify the restore. If the restore itself fails: ROLLBACK_FAILED (severe).
    const keys = Object.keys(patch);
    const snap = keys.map(function (k) {
      const cell = sh.getRange(rowNo, headers.indexOf(k) + 1);
      return { key: k, cell: cell, value: cell.getValue(), fmt: cell.getNumberFormat(), plan: SheetsStore.cellPlan_(table, [k], patch)[0] };
    });
    let failure = null;
    try {
      snap.forEach(function (x) {
        if (x.plan.forceText) x.cell.setNumberFormat('@');
        x.cell.setValue(x.plan.value);
      });
      snap.forEach(function (x) {
        if (failure === null && SheetsStore.findBadWrite_(x.cell, [x.plan]) !== null) failure = new Error('UNSAFE_WRITE: ערך נכתב שלא כטקסט בעמודה ' + x.key + ' — כל העדכון בוטל.');
      });
    } catch (e) { failure = e; }
    if (failure === null) return;
    let restoreError = null;
    try {
      snap.forEach(function (x) {
        if (typeof x.value === 'string') x.cell.setNumberFormat('@');   // so a restored string is not re-parsed
        x.cell.setValue(x.value);
        x.cell.setNumberFormat(x.fmt);
      });
      snap.forEach(function (x) {
        if (String(x.cell.getValue()) !== String(x.value) || x.cell.getNumberFormat() !== x.fmt) restoreError = new Error('mismatch in ' + x.key);
      });
    } catch (e) { restoreError = e; }
    if (restoreError !== null) throw new Error('ROLLBACK_FAILED: העדכון נכשל והשחזור נכשל (' + restoreError.message + ') — נדרשת בדיקה ידנית של הרשומה ' + id + ' בטבלה ' + table + '. סיבת הכשל: ' + failure.message);
    throw failure;
  },

  /**
   * v1.0.1 — validates + converts rows for replaceAll WITHOUT touching the sheet: the sheet must exist, EVERY column of the schema must be present in the live header
   * (structure check), every key of every row must be a header. Throws before any write. Returns the cell plans.
   */
  prepare(table, rows) {
    const sh = SheetsStore.sheet_(table), headers = SheetsStore.headers_(sh), def = TABLES[table];
    const lost = def.cols.filter(function (c) { return headers.indexOf(c) === -1; });
    if (lost.length) throw new Error('Structure mismatch: ' + table + ' is missing columns ' + lost.join(','));
    const plans = rows.map(function (r) { Object.keys(r).forEach(function (k) { if (headers.indexOf(k) === -1) throw new Error('Schema mismatch: ' + table + '.' + k); }); return SheetsStore.cellPlan_(table, headers, r); });
    return { sh: sh, headers: headers, plans: plans };
  },

  /**
   * Point-in-time restore of ONE table (used only by Backup.restore / recover). v1.0.1 write order — NEVER "delete first, then write":
   *   1. prepare (all validation/conversion; nothing written yet)  2. grow the grid if needed  3. text formats  4. overwrite rows 2..n+1 in ONE setValues
   *   5. read back and verify EVERY row (formula/altered text => throw)  6. only then clear the leftover tail (old rows beyond the new count).
   * Headers, column order, frozen row and column formats are never touched. A failure at any step leaves the table partly written — which is why
   * Backup.restore records the table as "touched" BEFORE calling this and rolls it back from the in-memory pre-restore snapshot.
   */
  replaceAll(table, rows) {
    const pr = SheetsStore.prepare(table, rows), sh = pr.sh, headers = pr.headers, plans = pr.plans, last = sh.getLastRow(), n = rows.length;
    if (n) {
      const need = n + 1; if (need > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows() + 100);
      // v1.0.2: the text format of a column depends on ALL planned rows (the first cell may be empty while a later one is "00123" or "=x").
      // A column holding at least one forced-text cell is set to text BEFORE writing; real numbers/booleans in such a column are then put back
      // to General (run by run) so they stay real values and are never turned into text.
      headers.forEach(function (h, j) {
        let needs = false; for (let i = 0; i < n && !needs; i++) if (plans[i][j].forceText) needs = true;
        if (!needs) return;
        sh.getRange(2, j + 1, n, 1).setNumberFormat('@');
        let i = 0; while (i < n) {
          const v = plans[i][j].value; if (plans[i][j].forceText || (typeof v !== 'number' && typeof v !== 'boolean')) { i++; continue; }
          let k = i; while (k + 1 < n && !plans[k + 1][j].forceText && (typeof plans[k + 1][j].value === 'number' || typeof plans[k + 1][j].value === 'boolean')) k++;
          sh.getRange(2 + i, j + 1, k - i + 1, 1).setNumberFormat('General'); i = k + 1;
        }
      });
      const range = sh.getRange(2, 1, n, headers.length);
      range.setValues(plans.map(function (pl) { return pl.map(function (c) { return c.value; }); }));
      const forms = range.getFormulas(), vals = range.getValues();
      for (let i = 0; i < n; i++) for (let j = 0; j < headers.length; j++) {
        const c = plans[i][j];
        if (String(forms[i][j] || '') !== '' || (typeof c.value === 'string' && c.value !== '' && String(vals[i][j]) !== c.value) || ((typeof c.value === 'number' || typeof c.value === 'boolean') && vals[i][j] !== c.value)) throw new Error('UNSAFE_WRITE: ' + table + ' row ' + (i + 2) + ' column ' + c.header + ' — השחזור בוטל.');
      }
    }
    if (last > n + 1) sh.getRange(n + 2, 1, last - n - 1, headers.length).clearContent();
  },

  /** Creates the sheet / header, or appends MISSING columns at the end (never reorders or drops). */
  ensureTable(table) {
    const def = TABLES[table];
    const ss = SheetsStore.ss_(def.store);
    let sh = ss.getSheetByName(table);
    let created = false;
    if (!sh) { sh = ss.insertSheet(table); created = true; }
    const headers = SheetsStore.headers_(sh);
    const missing = def.cols.filter(function (c) { return headers.indexOf(c) === -1; });
    if (missing.length) {
      sh.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
      sh.getRange(1, 1, 1, headers.length + missing.length).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    const all = headers.concat(missing);
    (def.textCols || []).forEach(function (c) {
      const idx = all.indexOf(c);
      if (idx !== -1) sh.getRange(2, idx + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
    });
    return { created: created, addedCols: missing };
  }
};

/** Facade used by services; swapped for an in-memory store in tests. */
const Db = {
  _s: null,
  use(store) { Db._s = store; },
  store() { return Db._s || SheetsStore; },

  all(table) { return Db.store().readAll(table); },
  get(table, id) {
    const rows = Db.store().readAll(table);
    for (let i = 0; i < rows.length; i++) { if (String(rows[i].id) === String(id)) return rows[i]; }
    return null;
  },
  where(table, pred) { return Db.store().readAll(table).filter(pred); },
  insert(table, obj) { return Db.store().insert(table, obj); },
  update(table, id, patch) { return Db.store().updateById(table, id, patch); },
  ensureTable(table) { return Db.store().ensureTable(table); },
  replaceAll(table, rows) { return Db.store().replaceAll(table, rows); },
  /** Validates/converts rows for replaceAll without writing (v1.0.1). In-memory stores may omit it. */
  prepare(table, rows) { const s = Db.store(); return s.prepare ? s.prepare(table, rows) : true; }
};
