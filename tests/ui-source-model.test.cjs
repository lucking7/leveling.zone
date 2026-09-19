const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sourceEntries, sourceOptions, bestSource, coordinates, isSourceResult } = require('../src/components/source-model.ts');
const { parseObservation } = require('../src/components/visitor-model.ts');
const { normalizeLocal } = require('../src/modules/query/normalize.ts');
const { ipFamily } = require('../src/lib/ip-address.ts');
const { isIP } = require('node:net');

const t = (_zh, en) => en;
const fixture = () => {
  const sources = normalizeLocal({ 'ip2location-px11': { isProxy: 0 } });
  return { ip: '192.0.2.1', ipSource: 'x-real-ip', generation: 'test', sources: {
    ip2location: { ...sources.ip2location, ip: '192.0.2.1', observation: { scope: 'request-ip', source: 'IP2Location' } },
  }, observation: { semantics: 'request-ip', requestIpSourceCount: 1, serverEgressSourceCount: 0, failures: [] } };
};

test('security-only canonical database records remain selectable and retain false values', () => {
  const record = fixture();
  const entries = sourceEntries(record.sources);
  assert.equal(entries.length, 1);
  assert.equal(bestSource(entries), 'ip2location');
  assert.equal(entries[0][1].security.isProxy, false);
  assert.deepEqual(sourceOptions(entries, t), [{ id: 'ip2location', label: 'IP2Location', network: 'Not provided', location: 'Not provided', countryCode: undefined }]);
  assert.deepEqual(parseObservation(record), record);
});

test('source presentation preserves zero coordinates and excludes genuinely empty sources', () => {
  const empty = { label: 'Empty', location: {}, network: {} };
  const geo = { label: 'Geo', location: { latitude: 0, longitude: 0, country: 'Test' }, network: {} };
  assert.deepEqual(sourceEntries({ empty, geo }).map(([key]) => key), ['geo']);
  assert.equal(coordinates(geo), '0, 0');
  assert.equal(bestSource(sourceEntries({ empty, geo })), 'geo');
  assert.equal(isSourceResult({ ...geo, security: { proxy: {} } }), false);
  assert.equal(isSourceResult({ ...geo, location: { latitude: '0' } }), false);
});

test('security flags establish validity without outranking location or network summaries', () => {
  const flags = { label: 'Flags', location: {}, network: {}, security: { proxy: false, threat: 'none', score: 0 } };
  const network = { label: 'Network', location: {}, network: { asn: 'AS15169' } };
  const entries = sourceEntries({ flags, network });
  assert.equal(entries.length, 2);
  assert.equal(bestSource(entries), 'network');
});

test('visitor decoding rejects wrong IP, scope, counts, malformed sources and failures', () => {
  const mutations = [
    x => { x.sources.ip2location.ip = '198.51.100.1'; },
    x => { x.sources.ip2location.observation.scope = 'server-egress'; },
    x => { x.observation.semantics = 'mixed'; },
    x => { x.observation.serverEgressSourceCount = 1; },
    x => { x.observation.requestIpSourceCount = 2; },
    x => { x.observation.requestIpSourceCount = 0.5; },
    x => { x.sources.ip2location.network = { isp: {} }; },
    x => { x.sources.ip2location.observation.source = ''; },
    x => { x.observation.failures = [{ source: 'test', reason: 'anything' }]; },
  ];
  for (const mutate of mutations) { const value = fixture(); mutate(value); assert.equal(parseObservation(value), null); }
  const valid = fixture(); valid.observation.failures.push({ source: 'maxmind', reason: 'not-installed' });
  assert.deepEqual(parseObservation(valid), valid);
});

test('shared browser IP grammar matches Node for supported unscoped literals', () => {
  const corpus = [
    '0.0.0.0', '255.255.255.255', '01.2.3.4', '256.1.2.3', '1.2.3', '', 'foo',
    '::', '::1', '2001:db8::1', '2001:DB8:0:1:2:3:4:5', '::ffff:192.0.2.1',
    '1:2:3:4:5:6:192.0.2.1', '1:2:3:4:5:6:7:8', '1:2:3:4:5:6:7:8:9',
    '1::2::3', ':::1', '1.2.3.4::', '2001:db8:1', '::ffff:192.00.2.1',
  ];
  for (const ip of corpus) assert.equal(ipFamily(ip), ({ 4: 'ipv4', 6: 'ipv6' })[isIP(ip)] ?? null, ip);
  assert.equal(ipFamily('fe80::1%eth0'), null);
});
