const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestOriginAllowed: allowed } = require('../.test-build/lib/request-origin');
test('development accepts either loopback host only for same-origin browser requests', () => {
  assert.equal(allowed('http://localhost:3000/api/auth/login', 'http://localhost:3000', 'http://127.0.0.1:3000', true), true);
  assert.equal(allowed('http://127.0.0.1:3000/api/auth/login', 'http://127.0.0.1:3000', 'http://localhost:3000', true), true);
  assert.equal(allowed('http://localhost:3000/api/auth/login', 'http://localhost:4000', 'http://127.0.0.1:3000', true), false);
  assert.equal(allowed('http://localhost:3000/api/auth/login', 'https://evil.example', 'http://127.0.0.1:3000', true), false);
  assert.equal(allowed('http://localhost:3000/api/auth/login', null, 'http://127.0.0.1:3000', true), false);
  assert.equal(allowed('https://evil.example/api/auth/login', 'https://evil.example', 'http://localhost:3000', true), false);
});
test('production keeps the configured origin exact and rejects dev aliases', () => {
  assert.equal(allowed('http://localhost:3000/api/auth/login', 'http://localhost:3000', 'http://127.0.0.1:3000', false), false);
  assert.equal(allowed('https://foods.example/api/auth/login', 'https://foods.example', 'https://foods.example', false), true);
  assert.equal(allowed('https://foods.example/api/auth/login', 'https://evil.example', 'https://foods.example', false), false);
});
