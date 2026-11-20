// Builds synthetic_app/index.html: the REAL Apps Script UI (src/Index.html) + the REAL server code (src/*.gs, same order as tests/harness.js)
// running inside the browser against an in-memory store persisted in localStorage. SYNTHETIC DEMO ONLY: no network, no Google, no login, no real data;
// every visitor has a private copy of the data in their own browser. Not an operational app. Usage: node scripts/build_synthetic_app.js
const fs = require('fs'), path = require('path'); const root = path.join(__dirname, '..');
const ARGS = process.argv.slice(2), PWA = ARGS.includes('--pwa'), OUT = (ARGS.find(a => a.startsWith('--out=')) || '').slice(6) || (PWA ? 'preview/index.html' : 'synthetic_app/index.html');
const hs = fs.readFileSync(path.join(root, 'tests', 'harness.js'), 'utf8'); const order = JSON.parse(/const order = (\[[^\]]*\]);/.exec(hs)[1].replace(/'/g, '"'));
const srcs = order.filter(f => fs.existsSync(path.join(root, 'src', f + '.gs'))).map(f => fs.readFileSync(path.join(root, 'src', f + '.gs'), 'utf8'));
const TOP = s => Array.from(s.matchAll(/^(?:const|class) ([A-Za-z_][A-Za-z0-9_]*)/gm)).map(m => m[1]);
const names = Array.from(new Set(srcs.flatMap(TOP))).concat(['api', 'whoAmI', 'formOpen', 'formSubmit']);
const server = srcs.join('\n;\n') + '\n;return {' + names.join(',') + '};';
const GOOGLE = ['DriveApp', 'SpreadsheetApp', 'UrlFetchApp', 'ScriptApp', 'HtmlService', 'MailApp', 'GmailApp'];
const boot = `
(function(){
  var KEY='maslul_synthetic_v1', EMAIL='demo-admin@x.com';
  var X;function nc(){throw new X.AppError('NOT_CONNECTED','טרם חובר להדגמה: פעולה זו דורשת שירות חיצוני (Google) שאינו זמין בהדגמה הסינתטית.');}
  var gs=new Proxy({},{get:function(){return nc;}}),cacheMem={};
  var CacheService={getScriptCache:function(){return {get:function(k){return k in cacheMem&&cacheMem[k].e>Date.now()?cacheMem[k].v:null;},put:function(k,v,t){cacheMem[k]={v:v,e:Date.now()+(t||60)*1000};}};}};
  var PropertiesService={getScriptProperties:function(){return {getProperty:function(){return null;},setProperty:nc,setProperties:nc,deleteProperty:nc};}};
  var lastErr='';var scon={log:function(){console.log.apply(console,arguments);},warn:function(){console.warn.apply(console,arguments);},info:function(){},error:function(m){lastErr=String(m);console.error.apply(console,arguments);}};
  X=new Function('console','CacheService','PropertiesService',${JSON.stringify(GOOGLE.join(','))},${JSON.stringify(server)})(scon,CacheService,PropertiesService,gs,gs,gs,gs,gs,gs,gs);
  var tick=0,base=Date.now();X.Util._clock=function(){return new Date(Math.max(Date.now(),base)+(++tick));};
  var mem={};try{mem=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){mem={};}
  var clone=function(o){return JSON.parse(JSON.stringify(o));};
  function save(){try{localStorage.setItem(KEY,JSON.stringify(mem));}catch(e){}}
  X.Db.use({readAll:function(t){return (mem[t]=mem[t]||[]).map(clone);},insert:function(t,o){(mem[t]=mem[t]||[]).push(clone(o));return o;},
    updateById:function(t,id,p){var r=(mem[t]||[]).find(function(x){return String(x.id)===String(id);});if(!r)throw new X.AppError('NOT_FOUND','x');Object.assign(r,clone(p));},
    replaceAll:function(t,rows){mem[t]=rows.map(clone);},prepare:function(){return true;},ensureTable:function(){return {};}});
  X.Auth._emailProvider=function(){return EMAIL;};
  var admin={email:EMAIL,role:'admin',courseScope:'*'};
  if(!(mem.Users&&mem.Users.length)){ // synthetic seed (invented names/numbers)
    X.Courses.addUser(admin,{email:EMAIL,role:'admin',display_name:'מנהל הדגמה'});
    var c=X.Courses.create(admin,{name:'קורס הדגמה (סינתטי)',start_date:'2099-01-01'}).id,o=X.Courses.org(admin,c);
    var N=['אלון לוי','בן כהן','גיל מזרחי','דור פרץ','הדס אביב','ורד שגיא','זיו ברק','חן דגן','טל אורן','יובל נחום','כרמל זיו','לירן עמית'];
    N.forEach(function(n,i){var t=o.teams[i%o.teams.length];X.Soldiers.create(admin,c,{full_name:n,personal_number:'9000'+(10+i),gender:i%4===3?'F':'M',department_id:t.department_id,team_id:t.id});});
    save();
  }
  function run(fn){return function(){var a=[].slice.call(arguments).map(clone);var r;lastErr='';try{r=fn.apply(null,a);}catch(e){r={ok:false,code:'INTERNAL',message:String(e&&e.message||e)};}
    if(r&&r.ok===false&&r.code==='INTERNAL'&&/(Utilities|DriveApp|SpreadsheetApp|UrlFetchApp|ScriptApp|HtmlService|MailApp|GmailApp) is not defined|NOT_CONNECTED/.test(lastErr))r={ok:false,code:'NOT_CONNECTED',message:'טרם חובר להדגמה: פעולה זו דורשת שירות חיצוני (Google) שאינו זמין בהדגמה הסינתטית.'};save();return clone(r);};}
  var H={api:run(X.api),whoAmI:run(function(){var r=X.whoAmI();return r;}),formOpen:run(X.formOpen),formSubmit:run(X.formSubmit)};
  window.__synthetic={reset:function(){localStorage.removeItem(KEY);location.reload();},export:function(){return clone(mem);}};
  function mk(){var ok,bad;var o={withSuccessHandler:function(f){ok=f;return o;},withFailureHandler:function(f){bad=f;return o;}};
    Object.keys(H).forEach(function(m){o[m]=function(){var a=arguments;setTimeout(function(){var r;try{r=H[m].apply(null,a);}catch(e){if(bad)bad(e);return;}if(ok)ok(r);},15);};});return o;}
  window.google={script:{get run(){return mk();}}};
  document.addEventListener('DOMContentLoaded',function(){var b=document.createElement('details');b.id='synthbar';
    b.style.cssText='background:#fff7e0;color:#5a4300;border-bottom:1px solid #e6c870;font-size:13px';
    b.innerHTML='<summary style="min-height:44px;display:flex;align-items:center;padding:0 12px;cursor:pointer">הדגמה סינתטית — נתוני הדגמה בלבד, נשמרים במכשיר הזה בלבד (אפשרויות ▾)</summary><div style="padding:4px 12px 10px">ללא התחברות ובלי שרת. אין להזין נתונים אמיתיים. <button type="button" id="synthreset" style="min-height:44px;margin-inline-start:8px;background:#fff;color:#202428;border:1px solid #999">איפוס הדגמה</button>${PWA ? '<button type="button" id="refresh-app" style="min-height:44px;margin-inline-start:8px;background:#fff;color:#202428;border:1px solid #999">בדיקת עדכון</button>' : ''}</div>';
    document.body.insertBefore(b,document.body.firstChild);var ra=document.getElementById('refresh-app');if(ra)ra.onclick=function(){if(navigator.serviceWorker){navigator.serviceWorker.getRegistration().then(function(registration){return registration?.update();}).finally(function(){var url=new URL(location.href);url.searchParams.set('v',String(Date.now()));location.replace(url);});}else location.reload();};document.getElementById('synthreset').onclick=function(){if(confirm('למחוק את נתוני ההדגמה ולהתחיל מחדש?'))window.__synthetic.reset();};});
})();`;
const html = fs.readFileSync(path.join(root, 'src', 'Index.html'), 'utf8');
if (!html.includes('<head>')) throw new Error('Index.html has no <head>');
const bootJs = boot.replace(/<\/script/gi, '<\\/script');
let out = html.replace('<head>', () => '<head>\n<script>' + bootJs + '</script>');
if (PWA) {
  const tags = '<meta name="theme-color" content="#ffffff">\n<meta name="description" content="MASLUL 2027 — אפליקציה מלאה, נתוני הדגמה סינתטיים בלבד">\n<link rel="manifest" href="./manifest.webmanifest">\n<link rel="icon" href="./icon.svg" type="image/svg+xml">\n';
  const reg = '<script>if(\'serviceWorker\' in navigator){window.addEventListener(\'load\',function(){navigator.serviceWorker.register(\'./sw.js\',{updateViaCache:\'none\'}).catch(function(){});});}</script>\n';
  out = out; const hi = out.indexOf('<head>') + 6; out = out.slice(0, hi) + '\n' + tags + out.slice(hi); const bi = out.lastIndexOf('</body>'); out = out.slice(0, bi) + reg + out.slice(bi);
}
const dest = path.isAbsolute(OUT) ? OUT : path.join(root, OUT); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, out);
console.log(OUT, (out.length / 1024).toFixed(0) + ' KB, routes:', 'server files ' + srcs.length);
