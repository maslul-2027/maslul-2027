#!/usr/bin/env node
'use strict';
// Privacy/secret gate for the PUBLIC synthetic preview (GitHub Pages). Usage: node scripts/scan_pages_artifact.js <dir>
// The public site must contain ONLY the synthetic static preview: an exact file allow-list, no backend/server code, no secrets, no real-looking contact data, no screenshots/CI artifacts.
const fs = require('fs'), path = require('path'); const dir = path.resolve(process.argv[2] || 'site');
const ALLOWED = new Set(['index.html', 'engine.js', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'capabilities.json', 'build-info.json']);
const bad = [], files = [];
(function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const f = path.join(d, e.name); if (e.isSymbolicLink()) bad.push('symlink: ' + e.name); else if (e.isDirectory()) walk(f); else files.push(f); }); })(dir);
files.forEach(f => { const rel = path.relative(dir, f); if (!ALLOWED.has(rel)) bad.push('file not on the allow-list: ' + rel); if (fs.statSync(f).size > 4e6) bad.push('file too large: ' + rel); });
const RULES = [
  [/BEGIN [A-Z ]*PRIVATE KEY/, 'private key'], [/AKfycb[A-Za-z0-9_-]{20,}/, 'Apps Script deployment id'], [/script\.google\.com\/macros/i, 'Apps Script URL'], [/client_secret|refresh_token|access_token\s*[:=]/i, 'OAuth secret material'],
  [/__Host-maslul_sid|x-csrf-token|\bpepper\b|\bstoreKey\b|MASLUL_SEED_ADMIN|secrets\.json|state\.bin|\.test-server|server_public/, 'server/auth internals'], [/\b05\d[- ]?\d{7}\b|\+972[- ]?5\d[- ]?\d{7}\b/, 'phone-number-like value'],
  [/\b\d{9}\b(?=[^0-9]*(?:ת\.ז|תעודת זהות|id_number))/, 'ID-number-like value'], [/spreadsheets\/d\/[A-Za-z0-9_-]{30,}/, 'real Google Sheet id'], [/\bghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|\bsk-[A-Za-z0-9]{30,}/, 'API token'] ];
const MAIL_OK = /@(x\.com|example\.(com|org)|test\.maslul\.invalid)$/i;
files.forEach(f => { const rel = path.relative(dir, f); if (!/\.(html|js|json|svg|webmanifest)$/.test(rel)) return; const t = fs.readFileSync(f, 'utf8');
  RULES.forEach(([re, what]) => { if (re.test(t)) bad.push(rel + ': ' + what); });
  (t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).forEach(m => { if (!MAIL_OK.test(m) && !/^[a-z0-9_.-]+@\d/.test(m)) bad.push(rel + ': non-synthetic e-mail ' + m); }); });
const sw = path.join(dir, 'index.html'); if (!fs.existsSync(sw)) bad.push('index.html missing');
if (bad.length) { console.error('PAGES ARTIFACT SCAN FAILED:\n - ' + Array.from(new Set(bad)).join('\n - ')); process.exit(1); }
console.log('PAGES ARTIFACT SCAN OK: ' + files.length + ' files, all on the allow-list, no secrets / real-looking contacts / server internals (' + files.map(f => path.relative(dir, f)).sort().join(', ') + ')');
