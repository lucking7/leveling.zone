const { test } = require('node:test');
const assert = require('node:assert/strict');
const { queryRdap, RdapError } = require('../src/modules/rdap/index.ts');
const { rdapResponse } = require('../src/modules/rdap/http.ts');

const bootstrap4 = {
  version: '1.0',
  services: [
    [['1.0.0.0/8'], ['https://rdap.apnic.net/']],
    [['8.0.0.0/8'], ['https://rdap.arin.net/registry/', 'http://rdap.arin.net/registry/']],
  ],
};

const bootstrap6 = {
  version: '1.0',
  services: [
    [['2400::/12'], ['https://rdap.apnic.net/']],
    [['2001:4800::/23', '2600::/12'], ['https://rdap.arin.net/registry/']],
  ],
};

function json(value, init = {}) {
  return new Response(JSON.stringify(value), {
    status: init.status || 200,
    headers: { 'content-type': 'application/rdap+json', ...(init.headers || {}) },
  });
}

function network(overrides = {}) {
  return {
    rdapConformance: ['rdap_level_0', 'cidr0'],
    objectClassName: 'ip network',
    handle: 'NET-8-8-8-0-2',
    name: 'GOGL',
    type: 'DIRECT ALLOCATION',
    startAddress: '8.8.8.0',
    endAddress: '8.8.8.255',
    ipVersion: 'v4',
    parentHandle: 'NET-8-0-0-0-0',
    cidr0_cidrs: [{ v4prefix: '8.8.8.0', length: 24 }],
    entities: [{
      objectClassName: 'entity',
      handle: 'GOGL',
      roles: ['registrant'],
      vcardArray: ['vcard', [
        ['version', {}, 'text', '4.0'],
        ['fn', {}, 'text', 'Google LLC'],
        ['email', {}, 'text', 'network@example.test'],
        ['tel', {}, 'uri', 'tel:+1-555-0100'],
        ['adr', { label: '1600 Amphitheatre Parkway\nMountain View, CA' }, 'text', ['', '', '', '', '', '', '']],
      ]],
    }],
    events: [{ eventAction: 'registration', eventDate: '1992-12-01T00:00:00-05:00' }],
    remarks: [{ title: 'Registration Comments', description: ['Example remark'] }],
    notices: [{ title: 'Terms of Service', description: ['Example notice'] }],
    links: [{ rel: 'self', href: 'https://rdap.arin.net/registry/ip/8.8.8.8' }],
    ...overrides,
  };
}

test('queryRdap uses IANA bootstrap and returns the stable normalized shape', async () => {
  const seen = [];
  const fetcher = async (url, init) => {
    seen.push({ url: String(url), redirect: init.redirect });
    if (String(url).endsWith('/ipv4.json')) return json(bootstrap4);
    if (String(url) === 'https://rdap.arin.net/registry/ip/8.8.8.8') return json(network());
    throw new Error('unexpected URL');
  };

  const result = await queryRdap('8.8.8.8', { fetcher, cache: false });
  assert.equal(result.registry, 'ARIN');
  assert.equal(result.endpoint, 'https://rdap.arin.net/registry/ip/8.8.8.8');
  assert.deepEqual(result.network.cidrs, ['8.8.8.0/24']);
  assert.deepEqual(result.entities[0], {
    handle: 'GOGL', name: 'Google LLC', roles: ['registrant'],
    emails: ['network@example.test'], phones: ['+1-555-0100'],
    address: '1600 Amphitheatre Parkway\nMountain View, CA',
  });
  assert.deepEqual(result.events, [{ action: 'registration', date: '1992-12-01T00:00:00-05:00' }]);
  assert.deepEqual(result.remarks, [{ title: 'Registration Comments', description: ['Example remark'] }]);
  assert.deepEqual(result.notices, [{ title: 'Terms of Service', description: ['Example notice'] }]);
  assert.deepEqual(result.links, [{ title: 'self', href: 'https://rdap.arin.net/registry/ip/8.8.8.8' }]);
  assert.equal(result.raw.handle, 'NET-8-8-8-0-2');
  assert.deepEqual(seen.map(item => item.redirect), ['manual', 'manual']);
});

test('bootstrap selection covers APNIC IPv4 and IPv6 plus compressed ARIN IPv6', async () => {
  const endpoints = [];
  const fetcher = async url => {
    const value = String(url);
    if (value.endsWith('/ipv4.json')) return json(bootstrap4);
    if (value.endsWith('/ipv6.json')) return json(bootstrap6);
    endpoints.push(value);
    const isApnicV6 = value.includes('/ip/2404:');
    const isArinV6 = value.includes('/ip/2001:');
    const isV6 = isApnicV6 || isArinV6;
    return json(network({
      handle: value.includes('2404:') ? '2404:6800::/32' : value.includes('2001:') ? 'NET6-2001-4860-1' : '1.1.1.0 - 1.1.1.255',
      startAddress: isApnicV6 ? '2404:6800::' : isArinV6 ? '2001:4860::' : '1.1.1.0',
      endAddress: isApnicV6 ? '2404:6800:ffff:ffff:ffff:ffff:ffff:ffff' : isArinV6 ? '2001:4860:ffff:ffff:ffff:ffff:ffff:ffff' : '1.1.1.255',
      ipVersion: isV6 ? 'v6' : 'v4',
      cidr0_cidrs: [],
    }));
  };

  assert.equal((await queryRdap('1.1.1.1', { fetcher, cache: false })).registry, 'APNIC');
  assert.equal((await queryRdap('2404:6800:4003:c00::64', { fetcher, cache: false })).registry, 'APNIC');
  assert.equal((await queryRdap('2001:4860:4860::8888', { fetcher, cache: false })).registry, 'ARIN');
  assert.deepEqual(endpoints, [
    'https://rdap.apnic.net/ip/1.1.1.1',
    'https://rdap.apnic.net/ip/2404:6800:4003:c00::64',
    'https://rdap.arin.net/registry/ip/2001:4860:4860::8888',
  ]);
});

test('longest prefix wins and non-official bootstrap endpoints are ignored', async () => {
  const data = {
    services: [
      [['8.0.0.0/8'], ['https://rdap.arin.net/registry/']],
      [['8.8.8.0/24'], ['https://rdap.apnic.net/']],
      [['8.8.8.0/25'], ['https://attacker.example/rdap/']],
    ],
  };
  const fetcher = async url => String(url).endsWith('/ipv4.json')
    ? json(data)
    : (assert.equal(String(url), 'https://rdap.apnic.net/ip/8.8.8.8'), json(network()));
  assert.equal((await queryRdap('8.8.8.8', { fetcher, cache: false })).registry, 'APNIC');
});

test('invalid input is rejected before networking and route errors stay sanitized', async () => {
  for (const ip of ['host.example', '999.1.1.1', '1.2.3.4?next=https://attacker.example', 'fe80::1%en0', undefined]) {
    let calls = 0;
    await assert.rejects(queryRdap(ip, { fetcher: async () => { calls++; } }), error => {
      assert.ok(error instanceof RdapError);
      assert.equal(error.code, 'INVALID_IP');
      return true;
    });
    assert.equal(calls, 0);
  }
  const response = await rdapResponse('not-an-ip');
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid IP address', code: 'INVALID_IP' });
});

test('record 404 and rate limits retain public status without upstream bodies', async () => {
  for (const [upstreamStatus, expectedStatus, code] of [[404, 404, 'NOT_FOUND'], [429, 429, 'RATE_LIMITED']]) {
    const fetcher = async url => String(url).endsWith('/ipv4.json')
      ? json(bootstrap4)
      : json({ error: 'internal /srv/secret detail' }, { status: upstreamStatus });
    const response = await rdapResponse('8.8.8.8', { fetcher, cache: false });
    assert.equal(response.status, expectedStatus);
    const body = await response.json();
    assert.equal(body.code, code);
    assert.equal(JSON.stringify(body).includes('/srv/secret'), false);
  }
});

test('malicious redirect targets and oversized responses fail as upstream errors', async () => {
  for (const location of [
    'http://127.0.0.1/admin',
    'https://user@rdap.apnic.net/ip/8.8.8.8',
    'https://rdap.apnic.net/help/ip/8.8.8.8',
    'https://rdap.apnic.net/ip/1.1.1.1',
    'https://rdap.apnic.net/ip/8.8.8.8?next=https://127.0.0.1',
  ]) {
    const redirecting = async url => String(url).endsWith('/ipv4.json')
      ? json(bootstrap4)
      : new Response('', { status: 302, headers: { location } });
    const response = await rdapResponse('8.8.8.8', { fetcher: redirecting, cache: false });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'RDAP service unavailable', code: 'UPSTREAM_ERROR' });
  }

  const oversized = async url => String(url).endsWith('/ipv4.json')
    ? json(bootstrap4)
    : json(network());
  const response = await rdapResponse('8.8.8.8', { fetcher: oversized, cache: false, maxResponseBytes: 300 });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, 'UPSTREAM_ERROR');
});

test('an allowlisted cross-RIR redirect is followed and becomes the reported endpoint', async () => {
  const bootstrap = { services: [[['45.0.0.0/8'], ['https://rdap.arin.net/registry/']]] };
  const seen = [];
  const fetcher = async (url, init) => {
    const value = String(url);
    seen.push({ value, redirect: init.redirect });
    if (value.endsWith('/ipv4.json')) return json(bootstrap);
    if (value === 'https://rdap.arin.net/registry/ip/45.65.1.1') {
      return new Response(null, { status: 303, headers: { location: 'https://rdap.apnic.net/ip/45.65.1.1' } });
    }
    assert.equal(value, 'https://rdap.apnic.net/ip/45.65.1.1');
    return json(network({ startAddress: '45.65.0.0', endAddress: '45.65.255.255' }));
  };
  const result = await queryRdap('45.65.1.1', { fetcher, cache: false });
  assert.equal(result.registry, 'APNIC');
  assert.equal(result.endpoint, 'https://rdap.apnic.net/ip/45.65.1.1');
  assert.deepEqual(seen.map(item => item.redirect), ['manual', 'manual', 'manual']);
});

test('redirect loops and a fourth redirect are rejected', async () => {
  const loopFetcher = async url => {
    const value = String(url);
    if (value.endsWith('/ipv4.json')) return json(bootstrap4);
    const location = value.includes('rdap.arin.net')
      ? 'https://rdap.apnic.net/ip/8.8.8.8'
      : 'https://rdap.arin.net/registry/ip/8.8.8.8';
    return new Response(null, { status: 302, headers: { location } });
  };
  await assert.rejects(queryRdap('8.8.8.8', { fetcher: loopFetcher, cache: false }), error => error.code === 'UPSTREAM_ERROR');

  const redirectChain = [
    'https://rdap.apnic.net/ip/8.8.8.8',
    'https://rdap.db.ripe.net/ip/8.8.8.8',
    'https://rdap.lacnic.net/rdap/ip/8.8.8.8',
    'https://rdap.afrinic.net/rdap/ip/8.8.8.8',
  ];
  let requests = 0;
  const chainFetcher = async url => {
    if (String(url).endsWith('/ipv4.json')) return json(bootstrap4);
    return new Response(null, { status: 307, headers: { location: redirectChain[requests++] } });
  };
  await assert.rejects(queryRdap('8.8.8.8', { fetcher: chainFetcher, cache: false }), error => error.code === 'UPSTREAM_ERROR');
  assert.equal(requests, 4);
});

test('wrong RDAP object classes, address families and ranges are rejected', async () => {
  const invalidRecords = [
    network({ objectClassName: 'entity' }),
    network({ startAddress: 'not-an-ip' }),
    network({ startAddress: '2001:db8::', endAddress: '2001:db8::ffff', ipVersion: 'v6' }),
    network({ startAddress: '8.8.9.0', endAddress: '8.8.9.255' }),
    network({ startAddress: '8.8.8.255', endAddress: '8.8.8.0' }),
  ];
  for (const invalid of invalidRecords) {
    const fetcher = async url => String(url).endsWith('/ipv4.json') ? json(bootstrap4) : json(invalid);
    const response = await rdapResponse('8.8.8.8', { fetcher, cache: false });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'RDAP service unavailable', code: 'UPSTREAM_ERROR' });
  }
});

test('a hung upstream is aborted and reported as a timeout', async () => {
  const fetcher = async url => String(url).endsWith('/ipv4.json')
    ? json(bootstrap4)
    : new Promise(() => {});
  const response = await rdapResponse('8.8.8.8', { fetcher, cache: false, timeoutMs: 5 });
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), { error: 'RDAP request timed out', code: 'UPSTREAM_TIMEOUT' });
});

test('the whole lookup shares one total deadline', async () => {
  const fetcher = async url => String(url).endsWith('/ipv4.json')
    ? json(bootstrap4)
    : new Promise(() => {});
  const response = await rdapResponse('8.8.8.8', {
    fetcher, cache: false, timeoutMs: 1_000, totalTimeoutMs: 5,
  });
  assert.equal(response.status, 504);
  assert.equal((await response.json()).code, 'UPSTREAM_TIMEOUT');
});
