'use strict';
// Negative tests for the Pages artifact scan: every violation class must fail the gate; the real preview must pass.
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process'), assert = require('assert/strict');
const run = d => cp.spawnSync('node', [path.join(__dirname, 'scan_pages_artifact.js'), d], { encoding: 'utf8' });
const mk = (files) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-')); fs.writeFileSync(path.join(d, 'index.html'), '<html></html>'); Object.entries(files).forEach(([k, v]) => { fs.mkdirSync(path.dirname(path.join(d, k)), { recursive: true }); fs.writeFileSync(path.join(d, k), v); }); return d; };
let n = 0; const T = (name, f) => { f(); console.log('PASS', name); n++; };
T('clean synthetic site passes', () => assert.equal(run(mk({ 'engine.js': 'var a="demo-admin@x.com"', 'build-info.json': '{"sha":"abc"}' })).status, 0));
for (const [name, files] of Object.entries({ 'unlisted file (screenshot)': { 'shot.png': 'x' }, 'server code': { 'server_public/client.js': 'x' }, 'private key': { 'engine.js': '-----BEGIN PRIVATE KEY-----' }, 'apps script url': { 'engine.js': 'https://script.google.com/macros/s/x/exec' }, 'real-looking e-mail': { 'engine.js': 'person@gmail.com' }, 'israeli phone': { 'engine.js': 'call 0501234567' }, 'auth internals': { 'engine.js': '__Host-maslul_sid' }, 'github token': { 'engine.js': 'ghp_' + 'a'.repeat(36) }, 'sheet id': { 'engine.js': 'spreadsheets/d/' + 'A'.repeat(40) } })) T('rejects: ' + name, () => { const r = run(mk(files)); assert.equal(r.status, 1, name + ' ' + r.stdout); });
T('rejects a symlink', () => { const d = mk({}); fs.symlinkSync('/etc/hostname', path.join(d, 'engine.js')); assert.equal(run(d).status, 1); });
const real = path.join(__dirname, '..', 'preview'); if (fs.existsSync(real)) T('the real preview passes', () => assert.equal(run(real).status, 0));
console.log('PAGES SCAN TESTS ' + n + ' passed');
