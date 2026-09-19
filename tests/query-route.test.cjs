const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('../src/modules/query/http.ts');
const { POST } = require('../src/app/api/query/route.ts');

test('compatibility POST uses the shared request-address precedence and normalization', async t => {
  const calls = [];
  t.mock.method(http, 'queryResponse', async (...args) => {
    calls.push(args);
    return Response.json({ ip: args[0] });
  });
  const cases = [
    [{}, { 'cf-connecting-ip': '2001:db8::1', 'x-real-ip': '192.0.2.1' }, undefined, '2001:db8::1'],
    [{}, { 'x-real-ip': '192.0.2.1', 'x-forwarded-for': '203.0.113.1, 10.0.0.1' }, undefined, '192.0.2.1'],
    [{}, { 'cf-connecting-ip': 'invalid', 'x-real-ip': '[2001:db8::2]:443' }, undefined, '2001:db8::2'],
    [{}, { 'x-forwarded-for': 'invalid' }, '192.0.2.2', '192.0.2.2'],
    [{ ip: '203.0.113.3' }, { 'x-real-ip': '192.0.2.1' }, undefined, '203.0.113.3'],
  ];
  for (const [body, headers, ip, expected] of cases) {
    const response = await POST({ json: async () => body, headers: new Headers(headers), ip });
    assert.equal((await response.json()).ip, expected);
    assert.deepEqual(calls.at(-1), [expected, true, false]);
  }
});

test('compatibility POST rejects malformed bodies before querying', async t => {
  const query = t.mock.method(http, 'queryResponse', () => { throw new Error('must not query'); });
  for (const json of [async () => null, async () => [], async () => { throw new SyntaxError(); }]) {
    const response = await POST({ json, headers: new Headers() });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid JSON body' });
  }
  assert.equal(query.mock.callCount(), 0);
});
