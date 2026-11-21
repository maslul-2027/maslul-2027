#!/usr/bin/env node
'use strict';
// Builds the ONE-ACTION TEST package (ZIP) for a single Windows computer from the reviewed sources. SYNTHETIC ONLY, loopback only.
//   node scripts/build_release_package.js [--out dist] [--skip-build]
// Deterministic: sorted file list, fixed mtimes, zip -X. Prints the ZIP SHA-256 (also written to <zip>.sha256). Never includes tests, docs of real data, secrets, node_modules, .git, state files.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const root = path.join(__dirname, '..'), arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const out = path.resolve(arg('out', path.join(root, 'dist'))), sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
if (!process.argv.includes('--skip-build')) cp.execFileSync(process.execPath, [path.join(root, 'scripts', 'build_native_app.js'), '--server'], { cwd: root, stdio: 'ignore' });
const git = (...a) => cp.execFileSync('git', a, { cwd: root }).toString().trim();
const head = (() => { try { return git('rev-parse', 'HEAD'); } catch (e) { return 'unknown'; } })();
// provenance: CI passes the reviewed commit it checked out; a mismatch or a dirty tracked tree means the ZIP would not be built from that commit -> refuse
if (process.env.EXPECT_SHA && process.env.EXPECT_SHA !== head) throw new Error('refusing: HEAD ' + head + ' is not the expected reviewed commit ' + process.env.EXPECT_SHA);
if (process.argv.includes('--require-clean') && git('status', '--porcelain', '--untracked-files=no')) throw new Error('refusing: tracked files differ from the commit (build --server output must be gitignored/unchanged)');
const stage = path.join(out, 'MASLUL-TEST'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(stage, 'app'), { recursive: true });
const walk = (d, rel) => fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1).flatMap(e => { const r = rel ? rel + '/' + e.name : e.name, f = path.join(d, e.name); if (e.isSymbolicLink()) throw new Error('symlink in package source: ' + r); return e.isDirectory() ? walk(f, r) : [r]; });
const files = [];   // [source, destination relative to stage]
for (const d of ['backend_next', 'src', 'server_public', 'scripts/lib']) for (const r of walk(path.join(root, d), d)) if (!/\.(md)$/.test(r) && !/test_only|\.test-server/.test(r)) files.push([path.join(root, r), 'app/' + r]);
files.push([path.join(root, 'release', 'launcher.js'), 'app/release/launcher.js'], [path.join(root, 'tests', 'harness.js'), 'app/tests/harness.js']);   // engine_host reads the engine load order from harness.js (read as text, never executed)
for (const n of fs.readdirSync(path.join(root, 'release', 'windows')).sort()) files.push([path.join(root, 'release', 'windows', n), n]);
for (const [s, d] of files) { const t = path.join(stage, d); fs.mkdirSync(path.dirname(t), { recursive: true }); fs.copyFileSync(s, t); }
const rels = files.map(x => x[1]).sort();
const bad = rels.filter(r => /(^|\/)(secrets\.json|state\.bin|cert\.pem|key\.pem|\.env|node_modules)(\/|$)/.test(r)); if (bad.length) throw new Error('refusing: secret/state-like files staged: ' + bad.join(', '));
fs.writeFileSync(path.join(stage, 'SHA256SUMS.txt'), rels.map(r => sha(fs.readFileSync(path.join(stage, r))) + '  ' + r).join('\n') + '\n');
fs.writeFileSync(path.join(stage, 'MANIFEST.json'), JSON.stringify({ product: 'MASLUL 2027 TEST package (single Windows computer, loopback, synthetic only)', source_commit: head, files: rels.length, node_required: '22 (not bundled)', not_included: ['real data', 'secrets', 'multi-device access', 'installer / machine-wide changes'] }, null, 1) + '\n');
const all = [...rels, 'SHA256SUMS.txt', 'MANIFEST.json'].sort(); for (const r of all) fs.utimesSync(path.join(stage, r), new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));
const zip = path.join(out, 'MASLUL-TEST-' + head.slice(0, 7) + '-windows.zip');
cp.execFileSync('zip', ['-X', '-q', zip, '-@'], { cwd: stage, input: all.map(r => r).join('\n').replace(/^/, '').split('\n').map(r => r).join('\n') });
// zip stores paths relative to cwd=stage, so wrap them in a top folder on extraction by the user ("Extract All" creates a folder named after the ZIP)
const zh = sha(fs.readFileSync(zip)); fs.writeFileSync(zip + '.sha256', zh + '  ' + path.basename(zip) + '\n');
console.log(JSON.stringify({ zip, bytes: fs.statSync(zip).size, sha256: zh, files: all.length, source_commit: head }));
