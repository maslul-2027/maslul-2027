'use strict';
// Hebrew quality regression over the native UI sources (labels, titles, messages, empty states, aria-labels). Free user content and historical data are never touched.
// Fails on known wrong forms (e.g. "צוותות") and on missing key terms; the key-term list keeps the vocabulary uniform across screens.
const fs = require('fs'), path = require('path'); const root = path.join(__dirname, '..'); let fail = 0, pass = 0;
const files = ['app.js', 'domains.js', 'bulk.js', 'mgmt.js', 'entry.js', 'insight.js', 'insight_exams.js', 'shell.html'].map(f => [f, fs.readFileSync(path.join(root, 'native', f), 'utf8')]);
const all = files.map(x => x[1]).join('\n');
const BANNED = [[/צוותות/, '"צוותות" — the plural is "צוותים"'], [/תוצאותים/, 'wrong plural'], [/מפו כל שדה/, 'unnatural imperative — use "התאימו"'], [/field\('החלטות'/, 'meeting field label must be "קווים מנחים"'], [/\bקבוצות הצוות\b/, 'use "צוותים"'], [/משימות מישיבות', 'מעקבים אישיים'/, 'trainee follow-ups and management tasks must not share one screen'], [/\bאנא\b/, 'stiff register'], [/\bנא ל[א-ת]+/, 'stiff register — use plain imperative']];
const REQUIRED = [['הזנה קבוצתית', 'entry centre group section'], ['הזנה אישית', 'entry centre personal section'], ['מעקבים אישיים', 'personal follow-ups under trainees'], ['קווים מנחים', 'meeting guidelines label'], ['ניהול וישיבות', 'management module name'], ['מעקבי חניכים', 'trainee follow-ups name'], ['כל הצוותים', 'all-teams filter'], ['כל המחלקות', 'all-departments filter'], ['עיקרי הדברים', 'meeting key points']];
function t(ok, name) { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name); } }
for (const [re, why] of BANNED) { const hits = files.filter(([, s]) => re.test(s)).map(x => x[0]); t(!hits.length, 'no ' + why + (hits.length ? ' — found in ' + hits.join(',') : '')); }
for (const [w, why] of REQUIRED) t(all.includes(w), 'term present: "' + w + '" (' + why + ')');
// every aria-label / placeholder / title that contains Hebrew must not end with a stray hyphen or double space
const stray = (all.match(/(?:aria-label|placeholder|title|text):\s*'[^']*[א-ת][^']*(?:\s{2,}|\s-\s*')'/g) || []); t(!stray.length, 'no stray spaces/hyphens in Hebrew UI strings' + (stray.length ? ': ' + stray[0] : ''));
console.log('\nHEBREW LINT pass=' + pass + ' fail=' + fail); process.exit(fail ? 1 : 0);
