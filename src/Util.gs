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

  /** UTF-8 string <-> base64 (pure JS). */
  b64encode(str) {
    const s = unescape(encodeURIComponent(String(str))), T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; let o = '';
    for (let i = 0; i < s.length; i += 3) { const a = s.charCodeAt(i), b = i + 1 < s.length ? s.charCodeAt(i + 1) : NaN, c = i + 2 < s.length ? s.charCodeAt(i + 2) : NaN; o += T[a >> 2] + T[((a & 3) << 4) | ((b || 0) >> 4)] + (isNaN(b) ? '=' : T[((b & 15) << 2) | ((c || 0) >> 6)]) + (isNaN(c) ? '=' : T[c & 63]); }
    return o;
  },
  b64decodeStr(b64) { const bytes = Util.b64bytes(b64, 0); let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return decodeURIComponent(escape(s)); },

  /** Base64 -> byte array (pure JS, works in Apps Script and Node). Throws VALIDATION on bad input or when larger than maxBytes. */
  b64bytes(str, maxBytes) {
    if (typeof str !== 'string' || !str || /[^A-Za-z0-9+\/=\r\n]/.test(str)) throw new AppError('VALIDATION', 'תוכן הקובץ אינו תקין.');
    const s = str.replace(/[\r\n]/g, ''); if (s.length % 4 !== 0) throw new AppError('VALIDATION', 'תוכן הקובץ אינו תקין.');
    const size = s.length / 4 * 3 - (s.endsWith('==') ? 2 : (s.endsWith('=') ? 1 : 0)); if (maxBytes && size > maxBytes) throw new AppError('VALIDATION', 'הקובץ גדול מדי.');
    const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', out = [];
    for (let i = 0; i < s.length; i += 4) { const a = T.indexOf(s[i]), b = T.indexOf(s[i + 1]), c = s[i + 2] === '=' ? 0 : T.indexOf(s[i + 2]), d = s[i + 3] === '=' ? 0 : T.indexOf(s[i + 3]); const n = (a << 18) | (b << 12) | (c << 6) | d; out.push((n >> 16) & 255); if (s[i + 2] !== '=') out.push((n >> 8) & 255); if (s[i + 3] !== '=') out.push(n & 255); }
    return out;
  },

  /** Unpredictable token (Apps Script: two random UUIDs; Node tests: Math.random fallback — TEST ONLY). */
  randomToken() {
    if (typeof Utilities !== 'undefined' && Utilities.getUuid) return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    let o = ''; for (let i = 0; i < 48; i++) o += Math.floor(Math.random() * 16).toString(16); return o;
  },
  /** SHA-256 hex (pure JS, identical in Apps Script and Node; used for form-token hashes and backup checksums). */
  sha256(str) {
    const bytes = []; const s = unescape(encodeURIComponent(String(str))); for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const l = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i * 8)) & 0xff);
    const rr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (let off = 0; off < bytes.length; off += 64) {
      const w = []; for (let i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
      for (let i = 16; i < 64; i++) { const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) { const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + w[i]) | 0, S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0; h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0; }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  },

  /** Strict: only literal true / 'TRUE' count as true. Blank/unknown => false (fail closed). */
  isTrue(v) { return v === true || String(v).trim().toUpperCase() === 'TRUE'; },

  isBlank(v) { return v === null || v === undefined || (typeof v === 'string' && v.trim() === ''); },

  str(v) { return Util.isBlank(v) ? '' : String(v).trim(); },

  /** null for blank, finite Number otherwise, throws AppError for garbage. Missing data is null, never 0. */
  numOrNull(v, label) {
    if (Util.isBlank(v)) return null;
    if (typeof v !== 'number' && typeof v !== 'string') throw new AppError('VALIDATION', 'ערך מספרי לא תקין: ' + (label || ''));
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
