// Browser E2E: every native domain form saves through the real backend and the record is read back in the list (synthetic data).
const OUT=process.env.E2E_CALLS_OUT;const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');const {chromium}=require('playwright');
const dir=path.resolve(process.argv[2]||'preview'),M={'.html':'text/html;charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0],f=path.join(dir,u==='/'?'index.html':u);if(!fs.existsSync(f)){r.statusCode=404;return r.end('')}r.setHeader('content-type',M[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f))});
const T='2026-11-15';
const CASES=[
 {d:'attendance',i:1,fill:{x_name:'פעילות בדיקה'}},
 {d:'attendance',i:0,fill:{x_event_date:T,x_activity_type_id:{i:1}},tick:'#x_absent input',read:T},
 {d:'fitness',i:1,fill:{x_soldier_id:{i:1},x_test_type_id:{i:1},x_test_date:T,x_pullups:'8',x_parallel_bars:'20',x_trap_bar:'10',x_run150x2:'00:55',x_run3km:'13:30'},read:T},
 {d:'exams',i:1,fill:{x_name:'מבחן בדיקה'}},
 {d:'exams',i:2,fill:{x_soldier_id:{i:1},x_exam_id:{i:1},x_attempt:'A',x_attempt_date:T,x_score:'85'},read:'ציון 85'},
 {d:'nav',i:2,fill:{x_name:'ניווט בדיקה'}},
 {d:'nav',i:1,fill:{x_soldier_id:{i:1},x_navigation_type_id:{i:1},x_test_date:T,x_distance_km:'3',x_plan_score:'4',x_debrief_score:'4',x_points_completed:'4',x_points_total:'5'},read:T},
 {d:'mk',i:2,fill:{x_soldier_id:{i:1},x_test_date:T,x_weapon_type:'M16',x_distance_m:'100',x_examiner_score:'80'},read:T},
 {d:'marches',i:0,fill:{x_march_date:T,x_location:'מסע בדיקה',x_km_no_stretcher:'10',x_km_stretcher:'2'},tick:'#x_absent input',read:'מסע בדיקה'},
 {d:'readiness',i:0,fill:{x_soldier_id:{i:1},x_status:{i:1},x_start_date:T}},
 {d:'events',i:0,fill:{x_soldier_id:{i:1},x_event_date:T,x_event_type:'achievement',x_description:'הישג בדיקה'},read:'הישג בדיקה'},
 {d:'qual',i:0,fill:{x_name:'הסמכת בדיקה',x_completion_terms:'תנאי',x_scope_type:'course'},read:'הסמכת בדיקה'},
 {d:'notes',i:0,fill:{x_soldier_id:{i:1},x_note_text:'הערת בדיקה'}},
 {d:'admin',i:0,fill:{x_email:'cmd1@x.com',x_display_name:'מפקד בדיקה',x_role:'commander'},read:'מפקד בדיקה'},
 {d:'admin',i:1,fill:{x_name:'קורס שני',x_start_date:'2099-02-01'},read:'קורס שני'}];
(async()=>{await new Promise(r=>srv.listen(0,r));const base='http://127.0.0.1:'+srv.address().port,b=await chromium.launch(),p=await (await b.newContext({viewport:{width:390,height:780}})).newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(base+'/');await p.waitForSelector('#k1');let pass=0,fail=0;
for(const c of CASES){const name=c.d+'#'+c.i;try{await p.evaluate(h=>{location.hash=h},'#/d/'+c.d+'/'+c.i);await p.waitForSelector('form',{timeout:8000});
 for(const[k,v] of Object.entries(c.fill)){const sel='#'+k;if(v&&v.i!==undefined)await p.selectOption(sel,{index:v.i});else if((await p.getAttribute(sel,'type'))==='date'||(await p.evaluate(s=>document.querySelector(s).tagName,sel))==='INPUT'||(await p.evaluate(s=>document.querySelector(s).tagName,sel))==='TEXTAREA')await p.fill(sel,v);else await p.selectOption(sel,v);}
 if(c.tick){await p.waitForSelector(c.tick,{timeout:8000});const bx=await p.$$(c.tick);assert.ok(bx.length,'missing-trainee checkboxes exist');await bx[0].check();if(c.d==='marches')assert.match(await p.textContent('#view'),/חסרים 1 מתוך/);}
 await p.click('button[type=submit]');await p.waitForFunction(()=>/#\/d\/[a-z]+$/.test(location.hash)||document.querySelector('.msg.err'),null,{timeout:8000});
 const err=await p.$('.msg.err');if(err)throw new Error('backend: '+(await err.textContent()));
 await p.waitForSelector('.section',{timeout:5000});await p.waitForTimeout(400);
 if(c.read){await p.waitForFunction(t=>document.getElementById('view').textContent.includes(t),c.read,{timeout:6000}).catch(async()=>{throw new Error('read-back missing: '+c.read+' | view='+(await p.textContent('#view')).slice(0,300))});}
 if(c.d==='marches'){
   const z=await p.evaluate(async()=>appClient.api('marches.list',{courseId:window.__app.state.course.id}));assert.ok(z.ok,'marches.list');
   const m=z.data.find(x=>x.location==='מסע בדיקה');assert.ok(m && m.total>0,'march persisted');
   const roll=await p.evaluate(async id=>appClient.api('marches.list',{courseId:window.__app.state.course.id,opts:{marchId:id,includeRoster:true}}),m.id);
   assert.ok(roll.ok && roll.data.length===1 && roll.data[0].roster.filter(x=>!x.present).length===1,'one missing trainee saved in scoped operational roster');
   await p.click('#view button.card:has-text("מסע בדיקה")');
   await p.waitForSelector('#participantRoster .card',{timeout:6000}).catch(async err=>{
      const d=await p.evaluate(()=>({roster:document.querySelector('#participantRoster')?.textContent.slice(0,800),dialog:[...document.querySelectorAll('dialog')].map(x=>({open:x.open,text:x.textContent.slice(0,350)})),hash:location.hash}));
      throw new Error('Saved roster UI did not populate: '+JSON.stringify(d)+'; pageerrors='+errs.join('|')+'; '+err.message.split('\n')[0]);
   });
   const absentCard=p.locator('#participantRoster .card').filter({hasText:'חסר'}).first();
   await absentCard.getByRole('button',{name:'שינוי נוכחות'}).click();
   await p.selectOption('#rosterPresent','true');await p.fill('#rosterReason','תיקון בדיקה סינתטית');
   await p.getByRole('button',{name:'שמירת שינוי'}).click();
   await p.waitForFunction(()=>document.querySelector('#participantRoster')?.textContent.includes('חסרים 0'),null,{timeout:7000});
   const newRoll=await p.evaluate(async id=>appClient.api('marches.list',{courseId:window.__app.state.course.id,opts:{marchId:id,includeRoster:true}}),m.id);
   assert.equal(newRoll.data[0].roster.filter(x=>!x.present).length,0,'saved roster edit persists without new march');
   await p.locator('dialog[open]').getByRole('button',{name:'סגירה'}).click();
 }
 if(c.d==='attendance' && c.i===0){const z=await p.evaluate(async()=>appClient.api('attendance.events',{courseId:window.__app.state.course.id}));assert.ok(z.ok);const e=z.data.find(x=>x.event_date==='2026-11-15');assert.ok(e,'attendance event created');const v=await p.evaluate(async eventId=>appClient.api('attendance.roll',{courseId:window.__app.state.course.id,eventId}),e.id);assert.ok(v.ok && v.data.some(x=>!x.present),'one absent attendee persisted');}
 pass++;console.log('PASS',name);}catch(e){fail++;console.log('FAIL',name,String(e.message).split('\n')[0]);await p.evaluate(()=>{[...document.querySelectorAll('dialog[open]')].forEach(d=>{try{d._rawClose?d._rawClose():d.close()}catch(x){}})});}}
try{await p.evaluate(()=>{location.hash='#/attendance'});await p.waitForSelector('button:has-text("+ אירוע נוכחות חדש")',{timeout:6000});pass++;console.log('PASS attendance main entry opens canonical event creation');}catch(e){fail++;console.log('FAIL attendance main entry',String(e.message).split('\n')[0]);}
try{await p.evaluate(()=>{location.hash='#/home'});await p.getByRole('button',{name:/מסע חדש/}).waitFor({timeout:8000});await p.getByRole('button',{name:/מסע חדש/}).click();await p.waitForSelector('#x_absent input[type=checkbox]',{timeout:8000});pass++;console.log('PASS Home → new march exposes missing-trainee selection');}catch(e){fail++;console.log('FAIL Home → march',String(e.message).split('\n')[0]);}
try{await p.evaluate(()=>{location.hash='#/home'});await p.getByRole('button',{name:/אירוע נוכחות חדש/}).waitFor({timeout:8000});await p.getByRole('button',{name:/אירוע נוכחות חדש/}).click();await p.waitForSelector('#x_absent input[type=checkbox]',{timeout:8000});pass++;console.log('PASS Home → new attendance event exposes missing-trainee selection');}catch(e){fail++;console.log('FAIL Home → attendance',String(e.message).split('\n')[0]);}
assert.deepEqual(errs,[]);console.log('DOMAINS E2E pass='+pass+' fail='+fail);if(OUT)fs.writeFileSync(OUT,JSON.stringify(await p.evaluate(()=>appClient.calls)));await b.close();srv.close();process.exit(fail?1:0);})();
