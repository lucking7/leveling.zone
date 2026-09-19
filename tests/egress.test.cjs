const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createJsonpRequest,
  fetchEgressSource,
  ipFamily,
  normalizeEgressResult,
  runEgressSources,
} = require('../src/modules/egress/runner.ts');

const baseSource = {
  id: 'fixture',
  name: 'Fixture',
  endpoint: 'https://example.test/ip',
  parse: value => value,
};

test('strict IP parsing accepts compressed IPv6 and rejects malformed addresses', () => {
  assert.equal(ipFamily('203.0.113.8'), 'ipv4');
  assert.equal(ipFamily('::1'), 'ipv6');
  assert.equal(ipFamily('2001:db8::8'), 'ipv6');
  assert.equal(ipFamily('::ffff:192.0.2.1'), 'ipv6');
  for (const value of ['999.999.999.999', '01.2.3.4', '1.2.3', '1.2.3.4::', '2001:db8::1::2', '2001:db8:1', 'hello']) {
    assert.equal(ipFamily(value), null, value);
    assert.throws(() => normalizeEgressResult(baseSource, { ip: value }), /invalid response/);
  }
});

test('family-specific sources reject an address from the other family', () => {
  assert.throws(() => normalizeEgressResult({ ...baseSource, expectedFamily: 'ipv4' }, { ip: '2001:db8::8' }), /invalid response/);
  assert.throws(() => normalizeEgressResult({ ...baseSource, expectedFamily: 'ipv6' }, { ip: '203.0.113.8' }), /invalid response/);
  assert.equal(normalizeEgressResult({ ...baseSource, expectedFamily: 'ipv6' }, { ip: '::1' }).family, 'ipv6');
});

test('deadline covers a response body that never resolves', async () => {
  const controller = new AbortController();
  const fetcher = async () => ({
    ok: true,
    text: () => new Promise(() => {}),
  });
  await assert.rejects(
    fetchEgressSource(baseSource, { signal: controller.signal, fetcher, timeoutMs: 15 }),
    error => error.name === 'TimeoutError',
  );
});

test('parent abort rejects immediately even when the fetcher ignores its signal', async () => {
  const controller = new AbortController();
  const pending = runEgressSources({
    sources: [baseSource],
    signal: controller.signal,
    fetcher: () => new Promise(() => {}),
    timeoutMs: 1000,
  });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
});

test('JSONP abort removes its script, callback, and listener-visible state', async () => {
  const previousWindow = global.window;
  const previousDocument = global.document;
  let script;
  let removed = false;
  global.window = {};
  global.document = {
    createElement() {
      script = { remove() { removed = true; } };
      return script;
    },
    head: { append(value) { assert.equal(value, script); } },
  };
  const controller = new AbortController();
  const pending = createJsonpRequest({ ...baseSource, format: 'jsonp' }, controller.signal);
  const callbackName = Object.keys(global.window)[0];
  assert.ok(callbackName.startsWith('orbitEgress_'));
  assert.match(script.src, new RegExp(`callback=${callbackName}`));
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(removed, true);
  assert.equal(callbackName in global.window, false);
  global.window = previousWindow;
  global.document = previousDocument;
});

test('runner caps concurrency at eight and silently omits failed sources', async () => {
  let active = 0;
  let maximum = 0;
  const sources = Array.from({ length: 12 }, (_, index) => ({
    ...baseSource,
    id: String(index),
    endpoint: `https://example.test/${index}`,
  }));
  const results = await runEgressSources({
    sources,
    signal: new AbortController().signal,
    concurrency: 99,
    fetcher: async url => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, 2));
      active -= 1;
      const index = Number(String(url).split('/').at(-1));
      return { ok: true, text: async () => JSON.stringify({ ip: index === 11 ? 'bad' : `192.0.2.${index + 1}` }) };
    },
  });
  assert.equal(maximum, 8);
  assert.equal(results.length, 11);
});

test('native fetch closes unread HTTP error responses after rejection', async () => {
  const http = require('node:http');
  let resolveClosed;
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  const server = http.createServer((_request, response) => {
    response.once('close', resolveClosed);
    response.writeHead(503);
    response.write('unfinished body');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let timer;
  try {
    await assert.rejects(fetchEgressSource({
      ...baseSource, endpoint: `http://127.0.0.1:${server.address().port}/`,
    }, { signal: new AbortController().signal }), /request failed/);
    await Promise.race([
      closed,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Error response remained open after rejection')), 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
