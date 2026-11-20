/** Utilities: errors, ids, dates, parsing. Pure except where an Apps Script global exists. */

class AppError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details || null;
  }
}

const Util = {
  _clock: null,           // tests may set a function returning a Date
  _counter: 0,

  now() { return Util._clock ? Util._clock() : new Date(); },
  nowIso() { return Util.now().toISOString(); },

  /** Today's date in the app time zone (YYYY-MM-DD). */
  todayIso() {
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) return Utilities.formatDate(Util.now(), APP.TZ, 'yyyy-MM-dd');
    return Util.nowIso().slice(0, 10);
  },

  uuid() {
    if (typeof Utilities !== 'undefined' && Utilities.getUuid) return Utilities.getUuid();
    Util._counter += 1;
    return 'id-' + Util._counter;
  },

  /** Strict: only literal true / 'TRUE' count as true. Blank/unknown => false (fail closed). */
  isTrue(v) { return v === true || String(v).trim().toUpperCase() === 'TRUE'; },

  isBlank(v) { return v === null || v === undefined || (typeof v === 'string' && v.trim() === ''); },

  str(v) { return Util.isBlank(v) ? '' : String(v).trim(); },

  /** null for blank, finite Number otherwise, throws AppError for garbage. Missing data is null, never 0. */
  numOrNull(v, label) {
    if (Util.isBlank(v)) return null;
    const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
    if (!Number.isFinite(n)) throw new AppError('VALIDATION', 'ערך מספרי לא תקין: ' + (label || ''));
    return n;
  },

  /** Valid real calendar date in YYYY-MM-DD, else throws. Returns the same string. */
  isoDate(v, label) {
    const s = Util.str(v);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) throw new AppError('VALIDATION', 'תאריך לא תקין (נדרש YYYY-MM-DD): ' + (label || ''));
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
      throw new AppError('VALIDATION', 'תאריך לא קיים בלוח השנה: ' + (label || ''));
    }
    return s;
  },

  /** Sheets may hand back Date objects for date-looking cells; normalise to YYYY-MM-DD (Asia/Jerusalem). */
  cellToIsoDate(v) {
    if (v instanceof Date) {
      if (typeof Utilities !== 'undefined' && Utilities.formatDate) return Utilities.formatDate(v, APP.TZ, 'yyyy-MM-dd');
      return v.toISOString().slice(0, 10);
    }
    return Util.str(v);
  },

  clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); },

  jsonCell(o) {
    if (o === null || o === undefined) return '';
    let s = JSON.stringify(o);
    if (s.length > APP.MAX_JSON_CELL) s = JSON.stringify({ _truncated: true, length: s.length, head: s.slice(0, 1000) });
    return s;
  },

  parseJson(s, fallback) {
    if (Util.isBlank(s)) return fallback;
    try { return JSON.parse(s); } catch (e) { return fallback; }
  },

  pick(o, keys) {
    const r = {};
    keys.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; });
    return r;
  },

  /** Stable, order-independent shallow equality for audit diffs. */
  changedKeys(before, after) {
    const keys = {};
    Object.keys(before || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(after || {}).forEach(function (k) { keys[k] = 1; });
    return Object.keys(keys).filter(function (k) { return String((before || {})[k]) !== String((after || {})[k]); });
  },

  /** Simple non-cryptographic hash for preview tokens (integrity of what the user previewed). */
  hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  },

  /** Display-only rounding (calculation is never rounded). 1 decimal, trailing .0 removed. */
  display1(n) {
    if (n === null || n === undefined || !Number.isFinite(n)) return null;
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
};
