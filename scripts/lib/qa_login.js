'use strict';
// UI login helper for the QA scripts: fills e-mail and PIN and VERIFIES the field values before submitting (a lost keystroke would otherwise send a wrong PIN and count toward the account lock).
async function vfill(p, sel, v) { for (let i = 0; i < 6; i++) { await p.locator(sel).fill(v); await p.waitForTimeout(60); if ((await p.locator(sel).inputValue().catch(() => null)) === v) return; await p.waitForTimeout(250); } throw new Error('could not set ' + sel); }
async function uiLogin(p, base, email, pin, timeout) { await p.goto(base + '/'); await p.waitForSelector('#auEmail'); await p.waitForLoadState('networkidle'); await vfill(p, '#auEmail', email); await vfill(p, '#auCode', pin); await p.click('#auGo');
  await p.waitForFunction(() => window.__app && window.__app.state && window.__app.state.course && window.__app.state.org, null, { timeout: timeout || 45000 }); }
module.exports = { vfill, uiLogin };
