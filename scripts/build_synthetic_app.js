// Builds synthetic_app/index.html: the REAL Apps Script UI (src/Index.html) + the REAL server code (src/*.gs, same order as tests/harness.js)
// running inside the browser against an in-memory store persisted in localStorage. SYNTHETIC DEMO ONLY: no network, no Google, no login, no real data;
// every visitor has a private copy of the data in their own browser. Not an operational app. Usage: node scripts/build_synthetic_app.js
const fs = require('fs'), path = require('path'); const root = path.join(__dirname, '..');
const hs = fs.readFileSync(path.join(root, 'tests', 'harness.js'), 'utf8'); const order = JSON.parse(/const order = (\[[^\]]*\]);/.exec(hs)[1].replace(/'/g, '"'));
const srcs = order.filter(f => fs.existsSync(path.join(root, 'src', f + '.gs'))).map(f => fs.readFileSync(path.join(root, 'src', f + '.gs'), 'utf8'));
const TOP = s => Array.from(s.matchAll(/^(?:const|class) ([A-Za-z_][A-Za-z0-9_]*)/gm)).map(m => m[1]);
const names = Array.from(new Set(srcs.flatMap(TOP))).concat(['api', 'whoAmI', 'formOpen', 'formSubmit']);
const server = srcs.join('\n;\n') + '\n;return {' + names.join(',') + '};';
const boot = `
(function(){
  var KEY='maslul_synthetic_v1', EMAIL='demo-admin@x.com';
  var X=new Function('console',${JSON.stringify(server)})(console);
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
  function run(fn){return function(){var a=[].slice.call(arguments).map(clone);var r;try{r=fn.apply(null,a);}catch(e){r={ok:false,code:'INTERNAL',message:String(e&&e.message||e)};}save();return clone(r);};}
  var H={api:run(X.api),whoAmI:run(function(){var r=X.whoAmI();return r;}),formOpen:run(X.formOpen),formSubmit:run(X.formSubmit)};
  window.__synthetic={reset:function(){localStorage.removeItem(KEY);location.reload();},export:function(){return clone(mem);}};
  function mk(){var ok,bad;var o={withSuccessHandler:function(f){ok=f;return o;},withFailureHandler:function(f){bad=f;return o;}};
    Object.keys(H).forEach(function(m){o[m]=function(){var a=arguments;setTimeout(function(){var r;try{r=H[m].apply(null,a);}catch(e){if(bad)bad(e);return;}if(ok)ok(r);},15);};});return o;}
  window.google={script:{get run(){return mk();}}};
  document.addEventListener('DOMContentLoaded',function(){var b=document.createElement('div');b.id='synthbar';b.setAttribute('role','note');
    b.style.cssText='background:#fff7e0;color:#5a4300;border-bottom:1px solid #e6c870;padding:6px 10px;font-size:13px;text-align:center';
    b.innerHTML='הדגמה סינתטית בלבד — נתוני דמה, נשמרים בדפדפן שלך בלבד, ללא התחברות ובלי שרת. אין להזין נתונים אמיתיים. <button type="button" id="synthreset" style="min-height:36px;margin-inline-start:8px;background:#fff;color:#202428;border:1px solid #999">איפוס נתוני הדגמה</button>';
    document.body.insertBefore(b,document.body.firstChild);document.getElementById('synthreset').onclick=function(){if(confirm('למחוק את נתוני ההדגמה ולהתחיל מחדש?'))window.__synthetic.reset();};});
})();`;
const html = fs.readFileSync(path.join(root, 'src', 'Index.html'), 'utf8');
if (!html.includes('<head>')) throw new Error('Index.html has no <head>');
const out = html.replace('<head>', '<head>\n<script>' + boot.replace(/<\/script/gi, '<\\/script') + '</script>');
fs.mkdirSync(path.join(root, 'synthetic_app'), { recursive: true }); fs.writeFileSync(path.join(root, 'synthetic_app', 'index.html'), out);
console.log('synthetic_app/index.html', (out.length / 1024).toFixed(0) + ' KB, routes:', 'server files ' + srcs.length);
