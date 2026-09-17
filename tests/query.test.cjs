const { test } = require('node:test');
const assert = require('node:assert/strict');
const { queryIP, InvalidIP } = require('../src/modules/query/index.ts');
const { fetchExternal } = require('../src/modules/query/external.ts');
const { queryResponse, legacy } = require('../src/modules/query/http.ts');
const databases = async () => ({
  records: { 'dbip-city': { country: { names: { en: 'United States' }, iso_code: 'US' }, location: { latitude: 0, longitude: 0 } },
    'iptoasn': { autonomous_system_number: 4001, autonomous_system_organization: 'Example Network LLC' },
    'as-info': [{ asn: '4001', handle: 'EXAMPLE', description: 'Example, Network LLC' }] },
  errors: { 'geolite2-city': 'Database unavailable' }, generation: 'fixture-v1',
});
test('partial lookup survives missing MaxMind and preserves zero coordinates and full ASN organization', async () => {
  const r = await queryIP('2001:4860:4860::8888', { databases, external: false });
  assert.equal(r.status, 'partial');
  assert.equal(r.sources.dbip.location.latitude, 0);
  assert.equal(r.sources.iptoasn.network.asn, 'AS4001');
  assert.equal(r.sources.iptoasn.network.organization, 'Example Network LLC');
  assert.equal(r.sources.asnInfo.network.description, 'Example, Network LLC');
  assert.equal(r.generation, 'fixture-v1');
  assert.equal(legacy(r).country, 'United States');
});
test('invalid input is rejected before any dependency runs', async () => {
  for (const ip of ['host.example', '999.1.1.1', '1.2.3.4?x=1', 'fe80::1%en0', undefined]) {
    await assert.rejects(queryIP(ip, { databases: () => { throw new Error('must not run'); } }), InvalidIP);
  }
  assert.equal((await queryResponse('999.1.1.1')).status, 400);
});
test('loopback remains loopback and an empty lookup is explicitly unavailable', async () => {
  let seen;
  const r = await queryIP('::1', { external: false, databases: async ip => { seen = ip; return { records: {}, errors: {}, generation: 'empty' }; } });
  assert.equal(seen, '::1');
  assert.equal(r.ip, '::1');
  assert.equal(r.status, 'unavailable');
});
test('a database without coverage for the address adds no source and no error', async () => {
  const r = await queryIP('8.8.8.8', { external: false, databases: async () => ({
    records: {
      geocn: null,
      'dbip-city': { country: { names: { en: 'United States' }, iso_code: 'US' }, location: { latitude: 0, longitude: 0 } },
    },
    errors: {},
    generation: 'fixture-v1',
  }) });
  assert.equal(r.status, 'ok');
  assert.equal(r.errors.geocn, undefined);
  assert.equal(r.sources.geocn, undefined);
  assert.equal(r.sources.dbip.location.country, 'United States');
});
test('external timeouts include response body and preserve local results', async () => {
  const r = await queryIP('8.8.8.8', { databases, timeoutMs: 10, fetcher: async () => ({ ok: true, json: () => new Promise(() => {}), text: () => new Promise(() => {}) }) });
  assert.equal(r.status, 'partial');
  assert.equal(r.sources.dbip.location.country, 'United States');
  assert.equal(r.errors.ipquery, 'Source unavailable');
});
test('expanded upstream catalog uses bounded concurrency and completes despite individual failures', async () => {
  let active = 0, peak = 0, attempts = 0;
  const result = await queryIP('8.8.8.8', { databases, fetcher: async () => {
    active++; attempts++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    throw new Error('upstream unavailable');
  } });
  assert.ok(peak <= 8, `maximum concurrent requests: ${peak}`);
  assert.ok(attempts >= require('../src/modules/query/external.ts').externalIds.length - 1);
  assert.equal(active, 0);
  assert.equal(result.sources.dbip.location.country, 'United States');
  assert.equal(result.status, 'partial');
});
test('malformed and empty external responses cannot masquerade as source success', async () => {
  for (const value of [{}, [], { error: 'secret' }, { location: {} }]) {
    await assert.rejects(fetchExternal('ipquery', '8.8.8.8', async () => ({ ok: true, json: async () => value })));
  }
});
test('external normalization hides raw shape and retains false flags', async () => {
  const r = await fetchExternal('ipquery', '8.8.8.8', async () => ({ ok: true, json: async () => ({
    location: { country: 'United States', country_code: 'US', latitude: 0, longitude: 0 },
    isp: { asn: 'AS15169', org: 'Google LLC' },
  }) }));
  assert.equal(r.normalized.network.asn, 'AS15169');
  assert.equal(r.normalized.location.latitude, 0);
  assert.equal(r.normalized.network.organization, 'Google LLC');
});
test('legacy GET and POST projections retain source-specific fields and numeric ASN', () => {
  const r = { ip: '8.8.8.8', status: 'ok', errors: {}, generation: 'v1', timestamp: 'fixture', sources: {
    dbip: { label: 'DB-IP', location: { country: 'United States', countryCode: 'US', continent: 'North America', latitude: 0, longitude: 0 }, network: { asn: 'AS15169', organization: 'Google LLC' }, security: { isEU: false } },
    geocn: { label: 'GeoCN', location: { country: '中国', region: '北京', city: '北京' }, network: { isp: 'Example' } },
  }};
  const projected = legacy(r);
  assert.equal(projected.dbip.country, 'US');
  assert.deepEqual(projected.dbip.country_names, { en: 'United States' });
  assert.equal(projected.dbip.continent.names.en, 'North America');
  assert.equal(projected.dbip.is_eu, false);
  assert.equal(projected.asn, 15169);
  assert.equal(projected.geoCn.province, '北京');
  assert.equal(typeof projected.network, 'object');
  assert.equal(projected.location.latitude, 0);
});
test('empty and sentinel GeoCN records never imply China', async () => {
  for (const geocn of [{}, { province: 'INVALID_IP_ADDRESS' }, { isp: '-' }]) {
    const r = await queryIP('8.8.8.8', { external: false, databases: async () => ({ records: { geocn }, errors: {}, generation: 'v1' }) });
    assert.equal(r.status, 'unavailable');
    assert.deepEqual(r.sources, {});
  }
});
test('private, loopback, documentation and mapped IPv6 stay local', async () => {
  let calls = 0;
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '100.64.1.1', '::1', 'fe80::1', 'fc00::1', '2001:db8::1', '::ffff:192.168.1.1']) {
    await queryIP(ip, { databases, fetcher: async () => { calls++; throw new Error('must not fetch'); } });
    await assert.rejects(fetchExternal('ipquery', ip, async () => { calls++; }));
  }
  assert.equal(calls, 0);
});
test('public query results never expose dependency exception text', async () => {
  const r = await queryIP('8.8.8.8', { external: false, databases: async () => ({
    records: {}, errors: { file: 'ENOENT /srv/secret/database.mmdb' }, generation: 'v1',
  }) });
  assert.equal(JSON.stringify(r).includes('/srv/secret'), false);
});
test('IP2Location supplier compatibility retains coordinates and security metadata', async () => {
  const fixture = {
    country_name: 'United States', country_code: 'US', latitude: 0, longitude: 0,
    asn: '15169', as: 'Google LLC', usage_type: 'DCH', is_proxy: false,
    proxy: { proxy_type: 'VPN', threat: 'TEST' }, fraud_score: 42, continent: { name: 'North America' },
  };
  const r = await fetchExternal('ip2location_io', '8.8.8.8', async () => ({
    ok: true, text: async () => '<code class="language-json">' + JSON.stringify(fixture) + '</code>',
  }));
  assert.equal(r.raw.location.coordinates, '0, 0');
  assert.equal(r.raw.network.type, 'DCH');
  assert.equal(r.raw.security.fraudScore, 42);
  assert.equal(r.raw.security.isProxy, false);
  assert.deepEqual(r.raw.meta.continent, fixture.continent);
});
