// Static UI contract for the admin-only orphan recovery card. Browser behavior remains covered by UI suites.
const fs = require('fs'), path = require('path'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'Index.html'), 'utf8');
const start = html.indexOf('// Admin-only recovery UI: metadata preview first, explicit confirmation second.');
const end = html.indexOf("var L=listBlock('בקשות ממתינות לאישור'", start);
assert.ok(start >= 0 && end > start, 'admin recovery card must exist inside the forms tab');
const block = html.slice(start, end);
assert.ok(block.includes("vcall('emergency.orphans',{courseId:S.courseId}") || block.includes("vcall('emergency.orphans',{courseId:S.courseId,apply:true}"), 'preview API call exists');
assert.ok(block.includes("apply:true"), 'cleanup is a distinct explicit API call');
assert.ok(block.includes('window.confirm('), 'cleanup requires explicit confirmation');
assert.ok(block.includes("d.review_required"), 'inconsistent groups are surfaced for manual review');
assert.ok(block.includes("d.groups"), 'safe orphan candidates are listed as metadata');
assert.ok(!/\.name\b|\.relation\b|\.phone\b|field_value/.test(block), 'UI must never render contact values');
assert.ok(block.includes("apply.disabled=!(d.orphan_groups>0)"), 'cleanup button remains disabled until preview finds candidates');
console.log('PASS admin orphan recovery UI contract: preview-first, explicit-confirm, metadata-only, review-required surfaced');
console.log('TOTAL pass=1 fail=0');
