#!/usr/bin/env node
'use strict';
// Stage the PUBLIC site: only the allow-listed static preview files + build-info.json (SHA-stamped). Usage: node scripts/stage_pages_site.js <previewDir> <outDir> <sha> [runId]
const fs = require('fs'), path = require('path'); const [src, out, sha, run] = [process.argv[2], process.argv[3], process.argv[4], process.argv[5] || 'local'];
if (!src || !out || !/^[0-9a-f]{40}$/.test(sha || '')) { console.error('usage: stage_pages_site.js <previewDir> <outDir> <40-hex sha> [runId]'); process.exit(2); }
const FILES = ['index.html', 'engine.js', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'capabilities.json'];
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
FILES.forEach(f => { const p = path.join(src, f); if (!fs.existsSync(p) || fs.lstatSync(p).isSymbolicLink()) { console.error('missing or symlink: ' + f); process.exit(1); } fs.copyFileSync(p, path.join(out, f)); });
fs.writeFileSync(path.join(out, 'build-info.json'), JSON.stringify({ sha, run: String(run), built_at: new Date().toISOString(), kind: 'synthetic-preview-only' }) + '\n');
console.log('staged ' + (FILES.length + 1) + ' files for ' + sha);
