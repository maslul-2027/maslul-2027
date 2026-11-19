// Run the original Apps Script UI against the in-memory test fixture.
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('../tests/harness');

const host = '127.0.0.1';
const port = Number(process.env.MASLUL_PREVIEW_PORT || 8787);
const origin = 'http://' + host + ':' + port;
const app = load();
const email = 'admin@example.invalid';
const admin = { email, role: 'admin', courseScope: '*' };
app.Courses.addUser(admin, { email, role: 'admin', display_name: 'מנהל הדגמה' });
app.Auth._emailProvider = () => email;
const course = app.Courses.create(admin, { name: 'קורס לדוגמה', start_date: '2027-03-01' }).id;
const org = app.Courses.org(admin, course);
org.teams.forEach((team, index) => {
  app.Soldiers.create(admin, course, {
    full_name: 'חניך לדוגמה ' + (index + 1), personal_number: String(9001 + index),
    gender: 'M', department_id: team.department_id, team_id: team.id,
  });
});

const bridge = `<script>
window.google = {script: {get run() {
  let success, failure;
  const runner = {
    withSuccessHandler(fn) { success = fn; return runner; },
    withFailureHandler(fn) { failure = fn; return runner; }
  };
  for (const name of ['api', 'whoAmI']) {
    runner[name] = (...args) => {
      fetch('/rpc', {method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({name, args})})
        .then(response => {
          if (!response.ok) throw Error('הבקשה נכשלה');
          return response.json();
        }).then(success, failure);
    };
  }
  return runner;
}}};
</script><p dir="rtl" role="status">תצוגה מקומית עם נתונים סינתטיים. השינויים נשמרים עד לסגירת התהליך. <a href="/actions">מפת הפעולות</a></p>`;
const original = fs.readFileSync(path.join(__dirname, '../src/Index.html'), 'utf8');
const routes = Object.keys(app.API_).sort();
const actions = fs.readFileSync(path.join(__dirname, 'local_course_actions.html'), 'utf8')
  .replace('__ROUTE_OPTIONS__', routes.map(route => '<option>' + route + '</option>').join(''));
const html = original.replace(/<body[^>]*>/i, match => match + bridge);

http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.headers.host !== host + ':' + port) return res.writeHead(403).end();
  if (req.method === 'GET' && req.url === '/') {
    return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
  }
  if (req.method === 'GET' && req.url === '/actions') {
    return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(actions);
  }
  if (req.method !== 'POST' || req.url !== '/rpc') return res.writeHead(404).end();
  if (req.headers.origin !== origin) return res.writeHead(403).end();
  try {
    req.setEncoding("utf8");
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 4_000_000) return res.writeHead(413).end();
    }
    const { name, args } = JSON.parse(body);
    if (!Array.isArray(args) || !['api', 'whoAmI'].includes(name)) return res.writeHead(400).end();
    const result = name === 'api' ? app.api(args[0], args[1]) : app.whoAmI();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(result));
  } catch {
    res.writeHead(400).end();
  }
}).listen(port, host, () => console.log(origin));
