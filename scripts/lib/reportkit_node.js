'use strict';
// Loads native/reportkit.js (the SAME source the browser bundle contains) in Node with the font subset from backend_next/assets.
const fs = require('fs'), path = require('path'), root = path.resolve(__dirname, '..', '..');
const A = n => path.join(root, 'backend_next', 'assets', n);
const RK_FONTS = { metrics: JSON.parse(fs.readFileSync(A('font_metrics.json'), 'utf8')), regular: fs.readFileSync(A('report_font_regular.ttf')).toString('base64'), bold: fs.readFileSync(A('report_font_bold.ttf')).toString('base64') };
module.exports = new Function('RK_FONTS', fs.readFileSync(path.join(root, 'native', 'reportkit.js'), 'utf8') + '\nreturn RK;')(RK_FONTS);
module.exports.RK_FONTS = RK_FONTS;
