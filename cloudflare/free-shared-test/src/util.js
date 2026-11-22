// Web-standard crypto helpers (Workers + Node 20+). No Node-only APIs, no eval. All secrets here are HIGH-ENTROPY (random tokens, 60-bit access codes, TOTP),
// so fast keyed hashes (HMAC-SHA-256) are appropriate — a password KDF would not fit the 10 ms Free-plan CPU budget and is not needed for random secrets.
const te = new TextEncoder(), td = new TextDecoder();
export const b64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const unb64u = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
export const hex = u8 => Array.from(u8, x => x.toString(16).padStart(2, '0')).join('');
export const rand = n => crypto.getRandomValues(new Uint8Array(n));
export const randToken = (n = 32) => b64u(rand(n));
export async function sha256Hex(s) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(String(s))))); }
async function hmacKey(keyBytes, alg = 'SHA-256') { return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: alg }, false, ['sign']); }
export async function hmacHex(secret, msg) { const k = await hmacKey(typeof secret === 'string' ? te.encode(secret) : secret); return hex(new Uint8Array(await crypto.subtle.sign('HMAC', k, te.encode(String(msg))))); }
export async function hmacBytes(secret, msg) { const k = await hmacKey(typeof secret === 'string' ? te.encode(secret) : secret); return new Uint8Array(await crypto.subtle.sign('HMAC', k, typeof msg === 'string' ? te.encode(msg) : msg)); }
/** constant-time string equality (length leak only) */
export function eq(a, b) { a = te.encode(String(a == null ? '' : a)); b = te.encode(String(b == null ? '' : b)); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; }
// ---- AES-GCM box for the per-user TOTP secret (key = HMAC(APP_SECRET, label)); a database copy alone does not reveal the second factor ----
async function aesKey(pepper, usage) { return crypto.subtle.importKey('raw', await hmacBytes(pepper, 'maslul-totp-box-v1'), 'AES-GCM', false, [usage]); }
export async function seal(pepper, aad, bytes) { const iv = rand(12), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad) }, await aesKey(pepper, 'encrypt'), bytes)); return b64u(iv) + '.' + b64u(ct); }
export async function open(pepper, aad, boxed) { const [iv, ct] = String(boxed).split('.'); return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv), additionalData: te.encode(aad) }, await aesKey(pepper, 'decrypt'), unb64u(ct))); }
// ---- RFC 4648 base32 + RFC 6238 TOTP (SHA-1, 6 digits, 30 s) ----
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(u8) { let bits = 0, v = 0, o = ''; for (const x of u8) { v = (v << 8) | x; bits += 8; while (bits >= 5) { o += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) o += B32[(v << (5 - bits)) & 31]; return o; }
export async function hotp(secret, counter) {
  const msg = new Uint8Array(8); let c = counter; for (let i = 7; i >= 0; i--) { msg[i] = c & 0xff; c = Math.floor(c / 256); }
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret, 'SHA-1'), msg)), o = h[19] & 15;
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1000000).padStart(6, '0');
}
/** @returns the matched 30-second step (accepting -1/0/+1 for clock drift) or -1. */
export async function totpMatch(secret, code, nowMs) { const step = Math.floor(nowMs / 30000), c = String(code || '').replace(/\s/g, ''); if (!/^\d{6}$/.test(c)) return -1; let hit = -1; for (const d of [-1, 0, 1]) if (eq(await hotp(secret, step + d), c) && hit < 0) hit = step + d; return hit; }
// ---- access code: 12 chars from an unambiguous 32-char alphabet (60 bits), grouped for reading ----
const AC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newAccessCode() { let o = ''; const r = rand(24); for (let i = 0; i < 12; i++) o += AC[r[i] % AC.length]; return o.slice(0, 4) + '-' + o.slice(4, 8) + '-' + o.slice(8); }
export const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const normEmail = s => { const e = String(s || '').trim().toLowerCase(); return e.length <= 120 && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(e) ? e : null; };
