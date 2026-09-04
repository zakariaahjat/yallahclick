/* ============================================================
   YallahClick — Backend integration test
   Starts the app on a random port and exercises the REST API:
   health, auth login (valid/invalid), CRUD on a collection
   (create/read/update/delete), query filters, and the reset
   endpoint. Exits 0 on success, 1 on failure.
   ============================================================ */
'use strict';

const path = require('path');
const os = require('os');
const http = require('http');

// Point the DB at a throwaway temp DATA DIR BEFORE requiring the server/db.
// Each collection loads from its own JSON file inside this dir.
const SERVER_ID = 'yc-test-' + Date.now();
process.env.YC_DATA_DIR = path.join(os.tmpdir(), SERVER_ID);
const fs = require('fs');
fs.mkdirSync(process.env.YC_DATA_DIR, { recursive: true });

const app = require('./server');
const db = require('./db');

let passed = 0;
let failed = 0;

function ok(cond, label){
  if (cond){ passed++; console.log('  PASS | ' + label); }
  else { failed++; console.log('  FAIL | ' + label); }
}

function request(port, method, path, body, token){
  return new Promise((resolve, reject) => {
    const data = body !== undefined ? JSON.stringify(body) : null;
    const req = http.request({
      host: '127.0.0.1',
      port,
      method,
      path,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        let json = null;
        try{ json = JSON.parse(raw); }catch(e){}
        resolve({ status: res.statusCode, body: json, raw });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main(){
  // guaranteed fresh temp DB seeded from data/*.js
  await db.dropAll();
  db.persist();

  const server = http.createServer(app);
  db.init();

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  console.log('YallahClick backend tests on :' + port);

  // 0) health
  let r = await request(port, 'GET', '/api/health');
  ok(r.status === 200 && r.body.status === 'ok', 'GET /api/health returns ok');

  // 1) auth — invalid
  r = await request(port, 'POST', '/api/auth/login', { email: 'admin@yallahclick.com', password: 'wrong' });
  ok(r.status === 401, 'login with wrong password -> 401');

  // 2) auth — valid
  r = await request(port, 'POST', '/api/auth/login', { email: 'admin@yallahclick.com', password: 'admin123' });
  ok(r.status === 200 && r.body.data && r.body.data.token, 'login with valid creds -> token');
  const token = r.body.data.token;

  // 3) bookings POST is the PUBLIC inquiry endpoint (no token required),
  //    while all other collections stay admin-only
  r = await request(port, 'POST', '/api/bookings', { customerName: 'Public Form', email: 'p@x.com', serviceId: 'video-production' });
  ok(r.status === 201 && r.body.data && r.body.data.id, 'public booking (no token) -> 201');
  ok(r.body.data.status === 'pending' && /^YC-\d+$/.test(r.body.data.id), 'public booking normalized (status=pending, id=YC-*)');
  ok(r.body.data.createdAt, 'public booking gets createdAt');
  const pubId = r.body.data.id;
  r = await request(port, 'GET', '/api/bookings/' + pubId);
  ok(r.status === 200 && r.body.data.customerName === 'Public Form', 'public booking readable back');
  r = await request(port, 'DELETE', '/api/bookings/' + pubId, undefined, token);
  ok(r.status === 200, 'cleanup public booking');

  // 3b) non-bookings POST still requires auth
  r = await request(port, 'POST', '/api/prompts', { title: 'x' });
  ok(r.status === 401, 'POST /api/prompts without token rejected');
  r = await request(port, 'POST', '/api/bookings', { customerName: 'Auth Check', serviceId: 'video-production' }, token);
  ok(r.status === 201, 'authorized booking create still works');
  await request(port, 'DELETE', '/api/bookings/' + r.body.data.id, undefined, token);

  // 4) CRUD create (authorized)
  r = await request(port, 'POST', '/api/bookings', { customerName: 'CRUD Test', serviceId: 'video-production' }, token);
  ok(r.status === 201 && r.body.data && r.body.data.id, 'create booking -> 201 with id');
  const newId = r.body.data.id;

  // 5) read list contains it
  r = await request(port, 'GET', '/api/bookings');
  ok(r.status === 200 && Array.isArray(r.body.data), 'list bookings');
  ok(r.body.data.some((b) => b.id === newId), 'created booking present in list');

  // 6) read one
  r = await request(port, 'GET', '/api/bookings/' + newId);
  ok(r.status === 200 && r.body.data.customerName === 'CRUD Test', 'read one booking');

  // 7) update
  r = await request(port, 'PATCH', '/api/bookings/' + newId, { status: 'confirmed' }, token);
  ok(r.status === 200 && r.body.data.status === 'confirmed', 'PATCH booking status');

  // 8) PUT replace
  r = await request(port, 'PUT', '/api/bookings/' + newId, { id: newId, customerName: 'Replaced', serviceId: 'x' }, token);
  ok(r.status === 200 && r.body.data.customerName === 'Replaced', 'PUT booking replace');

  // 9) DELETE
  r = await request(port, 'DELETE', '/api/bookings/' + newId, undefined, token);
  ok(r.status === 200, 'DELETE booking');

  // 10) verify gone
  r = await request(port, 'GET', '/api/bookings/' + newId);
  ok(r.status === 404, 'deleted booking -> 404');

  // 11) query filters
  r = await request(port, 'GET', '/api/prompts?limit=3');
  ok(r.status === 200 && r.body.data.length === 3, 'prompts?limit=3');
  r = await request(port, 'GET', '/api/prompts?filters=' + encodeURIComponent(JSON.stringify({ featured: true })));
  ok(r.status === 200 && r.body.data.every((p) => p.featured === true), 'prompts filter featured');

  // 11b) per-section kebab-case aliases work (e.g. /api/psd-templates)
  r = await request(port, 'GET', '/api/psd-templates');
  ok(r.status === 200 && r.body.data.length >= 1, 'alias /api/psd-templates serves psdTemplates');
  r = await request(port, 'GET', '/api/video-templates');
  ok(r.status === 200 && Array.isArray(r.body.data), 'alias /api/video-templates works');

  // 12) reset to seed (requires auth)
  r = await request(port, 'POST', '/api/auth/reset-public', undefined, token);
  ok(r.status === 200 && r.body.data.ok === true, 'reset to seed (authed)');
  r = await request(port, 'GET', '/api/bookings');
  ok(r.status === 200 && r.body.data.length === 45, 'bookings back to 45 after reset');

  // 12b) reset is admin-only: unauthenticated reset rejected
  r = await request(port, 'POST', '/api/auth/reset-public');
  ok(r.status === 401, 'unauthenticated reset rejected');

  // 13) me
  r = await request(port, 'GET', '/api/auth/me', undefined, token);
  ok(r.status === 200 && r.body.data.email === 'admin@yallahclick.com', 'GET /api/auth/me returns admin');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  server.close();
  db.persist();
  try{ require('fs').rmSync(process.env.YC_DATA_DIR, { recursive: true, force: true }); }catch(e){}
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });