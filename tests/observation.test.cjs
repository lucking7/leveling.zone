const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveRequestIp } = require('../src/modules/observation/request-ip.ts');

test('resolveRequestIp uses deployment header precedence and rejects invalid values', () => {
  const headers = new Headers({
    'cf-connecting-ip': '2001:db8::1',
    'x-real-ip': '198.51.100.4',
    'x-forwarded-for': '203.0.113.8, 10.0.0.1',
  });
  assert.deepEqual(resolveRequestIp(headers, '192.0.2.1'), {
    ip: '2001:db8::1',
    source: 'cf-connecting-ip',
  });

  assert.deepEqual(resolveRequestIp(new Headers({ 'x-forwarded-for': 'not-an-ip' })), {
    ip: '未知',
    source: 'unavailable',
  });

  assert.deepEqual(
    resolveRequestIp(new Headers({
      'cf-connecting-ip': '1:2',
      'x-real-ip': '010.0.0.1',
      'x-forwarded-for': '203.0.113.8, 10.0.0.1',
    })),
    { ip: '203.0.113.8', source: 'x-forwarded-for' },
  );
  assert.equal(resolveRequestIp(new Headers({ 'x-real-ip': 'fe80::1%en0' })).source, 'unavailable');
});
