'use strict';
// Loads the SAME native/reportkit.js + insight.js + insight_exams.js that the browser bundle contains into a Node vm (no DOM) so the pure model/export code can be attacked with REAL engine route outputs.
const fs = require('fs'), path = require('path'), vm = require('vm'), root = path.resolve(__dirname, '..', '..'); const RKN = require('./reportkit_node');
const src = ['reportkit.js', 'insight.js', 'insight_exams.js'].map(f => fs.readFileSync(path.join(root, 'native', f), 'utf8')).join('\n');
const win = {}, ctx = vm.createContext({ window: win, console, crypto: require('crypto').webcrypto, Promise, Uint8Array, DataView, ArrayBuffer, Math, JSON, Object, Array, String, Number, Date, RegExp, Error, isNaN, parseFloat, parseInt, Set, Map, TextEncoder, atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64'), RK_FONTS: RKN.RK_FONTS, document: {}, setTimeout });
vm.runInContext(src, ctx, { filename: 'insight-bundle.js' }); module.exports = win.__insight;
