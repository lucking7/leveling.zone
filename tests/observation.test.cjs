const assert = require('node:assert/strict');
const test = require('node:test');

const { observeExternalIp, requireOk } = require('../src/modules/observation/engine.ts');
const { resolveRequestIp } = require('../src/modules/observation/request-ip.ts');

function adapter(key, scope, observe) {
  return { key, name: key, scope, observe };
}

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

test('observeExternalIp preserves adapter order and caps concurrency', async () => {
  let active = 0;
  let maximum = 0;
  const adapters = Array.from({ length: 5 }, (_, index) =>
    adapter(`source-${index}`, 'server-egress', async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { ip: `192.0.2.${index}` };
    }),
  );

  const result = await observeExternalIp({
    requestedIp: '203.0.113.1',
    adapters,
    concurrency: 2,
  });

  assert.equal(maximum, 2);
  assert.deepEqual(Object.keys(result.sources), adapters.map(({ key }) => key));
  assert.equal(result.observation.serverEgressSourceCount, 5);
});

test('observeExternalIp returns partial data with provenance and stable failure reasons', async () => {
  const adapters = [
    adapter('targeted', 'request-ip', async ({ requestedIp }) => ({ ip: requestedIp })),
    adapter('egress', 'server-egress', async () => ({ ip: '192.0.2.9' })),
    adapter('http', 'server-egress', async ({ request }) => {
      await requireOk(await request('https://example.test/http'));
      return null;
    }),
    adapter('invalid', 'server-egress', async () => null),
    adapter('timeout', 'server-egress', async ({ request }) => {
      await request('https://example.test/timeout');
      return null;
    }),
  ];
  const fetcher = async (url, init) => {
    if (url.endsWith('/http')) return new Response('', { status: 503 });
    return new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  };

  const result = await observeExternalIp({
    requestedIp: '203.0.113.5',
    adapters,
    fetcher,
    timeoutMs: 10,
    concurrency: 5,
  });

  assert.equal(result.sources.targeted.observation.scope, 'request-ip');
  assert.equal(result.sources.egress.observation.scope, 'server-egress');
  assert.equal(result.observation.requestIpSourceCount, 1);
  assert.equal(result.observation.serverEgressSourceCount, 1);
  assert.deepEqual(result.observation.failures, [
    { source: 'http', reason: 'http-error' },
    { source: 'invalid', reason: 'invalid-response' },
    { source: 'timeout', reason: 'timeout' },
  ]);
});

test('adapter deadline returns when work ignores abort and blocks fetches started after timeout', async () => {
  let lateFetches = 0;
  const adapters = [
    adapter('stalled-body', 'server-egress', async () => new Promise(() => {})),
    adapter('late-fetch', 'server-egress', async ({ request }) => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      await request('https://example.test/late');
      return { ip: '192.0.2.7' };
    }),
  ];
  const fetcher = async () => {
    lateFetches += 1;
    return new Response('{}');
  };

  const startedAt = Date.now();
  const result = await observeExternalIp({
    requestedIp: '203.0.113.5',
    adapters,
    fetcher,
    timeoutMs: 5,
    concurrency: 2,
  });

  assert.ok(Date.now() - startedAt < 100);
  assert.deepEqual(result.observation.failures, [
    { source: 'stalled-body', reason: 'timeout' },
    { source: 'late-fetch', reason: 'timeout' },
  ]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(lateFetches, 0);
});
