'use strict';
/** Acceptance gate for the owner's approved single-app mobile UX.
 * This WILL FAIL on the known broken legacy preview until migration is complete.
 * No production data, browser or network is used.
 */
const fs=require('node:fs');const assert=require('node:assert/strict');
const html=fs.readFileSync('preview/index.html','utf8');
const failures=[];
function check(ok,reason){if(!ok)failures.push(reason)}
check(/<html[^>]+dir=["']rtl["']/.test(html),'Document root must be RTL');
check(!/<iframe\b/i.test(html),'Nested iframe/app-in-app is forbidden');
const nav=html.match(/<nav\b[^>]*aria-label=["']ניווט ראשי["'][\s\S]*?<\/nav>/);
check(Boolean(nav),'Accessible primary mobile navigation must exist');
if(nav){const items=(nav[0].match(/class=["']tab["']/g)||[]).length;check(items===4,'Mobile primary navigation must contain exactly 4 tabs; found '+items)}
check(!/const names=\[/.test(html),'Legacy duplicate hardcoded roster must be removed from integrated UI');
check(!/const people=names\.map\(/.test(html),'Client-only shadow roster must not compete with course engine');
check(!/const WF_KEY='maslul2027-demo-workflows-v1'/.test(html),'Client-only attendance/fitness state must not compete with engine-backed records');
check(!/const tasks=\[\{name:/.test(html),'Shadow tasks collection must not compete with shared engine');
check(/aria-label/.test(html),'Accessible labels are required');
if(failures.length){for(const f of failures)console.error('FAIL: '+f);process.exitCode=1}
else console.log('PASS: one RTL app, 4-tab navigation, one shared data source, no embedded iframe');
