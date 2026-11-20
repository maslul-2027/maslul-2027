// preview/index.html is a BUILD OUTPUT of src/Index.html + src/*.gs (scripts/build_synthetic_app.js --pwa). It must never drift from the source it claims to be.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os'), assert = require('assert'), crypto = require('crypto');
const tmp = path.join(os.tmpdir(), 'maslul_preview_' + process.pid + '.html'); cp.execFileSync('node', [path.join(__dirname, '..', 'scripts', 'build_synthetic_app.js'), '--pwa', '--out=' + tmp], { stdio: 'ignore' });
const h = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); let ok = true, msg = '';
try { assert.strictEqual(h(tmp), h(path.join(__dirname, '..', 'preview', 'index.html'))); } catch (e) { ok = false; msg = 'preview/index.html is stale: run `node scripts/build_synthetic_app.js --pwa` and commit'; } finally { fs.unlinkSync(tmp); }
console.log((ok ? 'PASS' : 'FAIL') + ' [integration] preview/index.html equals the build of the current source' + (ok ? '' : '\n   ' + msg)); console.log('\nPREVIEW FRESH TOTAL pass=' + (ok ? 1 : 0) + ' fail=' + (ok ? 0 : 1)); process.exit(ok ? 0 : 1);
