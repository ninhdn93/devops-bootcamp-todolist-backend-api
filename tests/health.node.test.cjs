const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const app = require('../dist/app.js').default;

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
});

test('GET /health returns HTTP 200', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.status, 'ok');
  assert.ok(data.timestamp);
});

test('GET /unknown returns HTTP 404', async () => {
  const response = await fetch(`${baseUrl}/unknown`);
  const data = await response.json();

  assert.equal(response.status, 404);
  assert.deepEqual(data, {
    error: 'Route not found'
  });
});