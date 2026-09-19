const { test } = require('node:test');
const assert = require('node:assert/strict');
const { externalIds, fetchExternal, ExternalError } = require('../src/modules/query/external.ts');
const { externalProviders } = require('../src/modules/query/external-providers.ts');

const IP = '8.8.8.8';
const jsonResponse = value => ({ ok: true, status: 200, json: async () => value });

test('catalog adds all 18 specified sources and records every html.zone relay', () => {
  const added = [
    'baidu_open', 'baidu_qifu', 'baidu_qifu_backup', 'taobao', 'cz88', 'ipip', 'amap', 'zxinc',
    'pconline', 'zhale', 'ipsb', 'ipapi_co', 'ip_api', 'ipwhois', 'ipgeolocation', 'freeipapi',
    'ipapi_is', 'apip_cc',
  ];
  assert.equal(externalIds.length, 25);
  assert.equal(new Set(externalIds).size, externalIds.length);
  assert.deepEqual(externalIds.slice(7), added);
  for (const id of ['baidu_open', 'taobao', 'ipip', 'ip_api', 'ipdata', 'ip2location_io', 'ipgeolocation', 'ipregistry']) {
    assert.equal(externalProviders[id].transport, 'html.zone relay');
  }
  assert.match(externalProviders.ipip.attempts(IP)[0].url, /^https:\/\/vercel\.html\.zone\/api\/ip\/ipip\?/);
});

test('all 18 new parsers accept their observed response shape and retain useful data', async () => {
  const previousKey = process.env.AMAP_API_KEY;
  process.env.AMAP_API_KEY = 'fixture-key';
  const cases = [
    ['baidu_open', { data: [{ origip: IP, location: '美国 Google LLC' }] }, 'location', 'country', '美国'],
    ['baidu_qifu', { ip: IP, data: { country: '美国', prov: '加州', city: '山景城', isp: 'Google' } }, 'location', 'city', '山景城'],
    ['baidu_qifu_backup', { ip: IP, data: { country: '美国', prov: '加州', city: '山景城', isp: 'Google' } }, 'network', 'isp', 'Google'],
    ['taobao', { data: { ip: IP, country_id: 'US', country: '美国', region: '加州', city: '山景城', isp: 'Google' } }, 'location', 'countryCode', 'US'],
    ['cz88', { data: { ip: IP, country: '美国', province: '加州', city: '山景城', isp: 'Google', netWorkType: 'IDC' } }, 'network', 'description', 'IDC'],
    ['ipip', { data: { ip: IP, country_name: '美国', region_name: '加州', city_name: '山景城', isp_domain: 'Google' } }, 'location', 'region', '加州'],
    ['amap', { status: '1', province: '北京市', city: '北京市' }, 'location', 'countryCode', 'CN'],
    ['zxinc', { data: { ip: { query: IP }, location: '美国 加利福尼亚州' } }, 'location', 'description', '美国 加利福尼亚州'],
    ['pconline', `IPCallBack({"ip":"${IP}","addr":"US California"});`, 'location', 'description', 'US California'],
    ['zhale', { Data: { IP, Country: 'United States', Region: 'California', City: 'Mountain View', ISP: 'Google' } }, 'network', 'isp', 'Google'],
    ['ipsb', { ip: IP, country: 'United States', country_code: 'US', organization: 'Google LLC', asn: 15169 }, 'network', 'asn', 'AS15169'],
    ['ipapi_co', { ip: IP, country_name: 'United States', country_code: 'US', region: 'California', org: 'Google LLC' }, 'location', 'countryCode', 'US'],
    ['ip_api', { status: 'success', query: IP, country: 'United States', countryCode: 'US', regionName: 'California', as: 'AS15169 Google LLC', org: 'Google LLC', isp: 'Google' }, 'network', 'asn', 'AS15169'],
    ['ipwhois', { success: true, ip: IP, country: 'United States', country_code: 'US', connection: { asn: 15169, isp: 'Google' } }, 'network', 'asn', 'AS15169'],
    ['ipgeolocation', { ip: IP, country_name: 'United States', country_code2: 'US', state_prov: 'California', isp: 'Google' }, 'location', 'countryCode', 'US'],
    ['freeipapi', { ipAddress: IP, countryName: 'United States', countryCode: 'US', regionName: 'California' }, 'location', 'country', 'United States'],
    ['ipapi_is', { ip: IP, location: { country: 'United States', country_code: 'US' }, asn: { asn: 15169, org: 'Google LLC' } }, 'network', 'organization', 'Google LLC'],
    ['apip_cc', { query: IP, CountryName: 'United States', CountryCode: 'US', RegionName: 'California', asn: 15169, org: 'Google LLC' }, 'location', 'countryCode', 'US'],
  ];
  try {
    for (const [id, payload, section, field, expected] of cases) {
      const fetcher = async () => id === 'pconline'
        ? new Response(payload)
        : jsonResponse(payload);
      const response = await fetchExternal(id, IP, fetcher);
      assert.equal(response[section][field], expected, id);
    }
  } finally {
    if (previousKey === undefined) delete process.env.AMAP_API_KEY;
    else process.env.AMAP_API_KEY = previousKey;
  }
});

test('IPinfo uses the official endpoint first, keeps demo fallback, and exposes countryCode', async () => {
  const urls = [];
  const response = await fetchExternal('ipinfo_demo', IP, async url => {
    urls.push(url);
    if (urls.length === 1) return { ok: false, status: 429, json: async () => ({}) };
    return jsonResponse({ data: { ip: IP, country: 'US', region: 'California', org: 'AS15169 Google LLC' } });
  });
  assert.equal(urls.length, 2);
  assert.equal(urls[0], `https://ipinfo.io/${IP}/json`);
  assert.equal(urls[1], `https://ipinfo.io/widget/demo/${IP}`);
  assert.equal(response.location.countryCode, 'US');
});

test('IP2Location prefers relay JSON, falls back to compatible HTML, and retains normalized data', async () => {
  const urls = [];
  const fixture = {
    ip: IP, country_name: 'United States', country_code: 'US', latitude: 0, longitude: 0,
    asn: 15169, as: 'Google LLC', usage_type: 'DCH', is_proxy: false,
  };
  const response = await fetchExternal('ip2location_io', IP, async url => {
    urls.push(url);
    if (urls.length === 1) return { ok: false, status: 502, text: async () => '' };
    return { ok: true, status: 200, text: async () => `<code data-x="1" class="sample language-json">${JSON.stringify(fixture)}</code>` };
  });
  assert.equal(urls.length, 2);
  assert.match(urls[0], /^https:\/\/cloudflare\.html\.zone\/api\/ip\/ip2location\?/);
  assert.equal(response.location.latitude, 0);
  assert.equal(response.location.longitude, 0);
  assert.equal(response.security.isProxy, false);
});

test('echo validation accepts equivalent IPv6 text and rejects a different address', async () => {
  const input = '2001:4860:0:0:0:0:0:8888';
  let requestedUrl;
  const response = await fetchExternal('ipsb', input, async url => {
    requestedUrl = url;
    return jsonResponse({ ip: '2001:4860::8888', country: 'United States' });
  });
  assert.equal(response.location.country, 'United States');
  assert.match(requestedUrl, /2001%3A4860%3A0%3A0%3A0%3A0%3A0%3A8888/);
  await assert.rejects(
    fetchExternal('ipsb', input, async () => jsonResponse({ ip: '2001:4860::8844', country: 'United States' })),
    /different IP/,
  );
});

test('IP-only, failure, malformed and mismatched responses cannot become successes', async () => {
  await assert.rejects(fetchExternal('ipapi_is', IP, async () => jsonResponse({ ip: IP })), /no record/);
  await assert.rejects(fetchExternal('ipwhois', IP, async () => jsonResponse({ success: false, ip: IP, country: 'United States' })));
  await assert.rejects(fetchExternal('pconline', IP, async () => ({ ok: true, status: 200, text: async () => 'callback([])' })));
  await assert.rejects(fetchExternal('ipsb', IP, async () => jsonResponse({ ip: '1.1.1.1', country: 'United States' })), /different IP/);
});

test('AMap does not infer China from an unmatched response with empty arrays', async () => {
  const previousKey = process.env.AMAP_API_KEY;
  process.env.AMAP_API_KEY = 'fixture-key';
  try {
    await assert.rejects(
      fetchExternal('amap', IP, async () => jsonResponse({ status: '1', province: [], city: [] })),
      /Invalid source response/,
    );
  } finally {
    if (previousKey === undefined) delete process.env.AMAP_API_KEY;
    else process.env.AMAP_API_KEY = previousKey;
  }
});

test('ip-api.com splits a combined AS field without losing organization', async () => {
  const response = await fetchExternal('ip_api', IP, async () => jsonResponse({
    status: 'success', query: IP, country: 'United States', as: 'AS15169 Google LLC', org: 'Google LLC',
  }));
  assert.equal(response.network.asn, 'AS15169');
  assert.equal(response.network.organization, 'Google LLC');
});

test('private targets and missing AMAP credentials fail before networking', async () => {
  let calls = 0;
  await assert.rejects(fetchExternal('ipsb', 'fd00::1', async () => { calls++; }));
  const previousKey = process.env.AMAP_API_KEY;
  delete process.env.AMAP_API_KEY;
  try {
    await assert.rejects(fetchExternal('amap', IP, async () => { calls++; }), /credentials unavailable/);
  } finally {
    if (previousKey !== undefined) process.env.AMAP_API_KEY = previousKey;
  }
  assert.equal(calls, 0);
});

test('fallbacks share one complete deadline and do not start work after it expires', async () => {
  let calls = 0;
  const started = Date.now();
  await assert.rejects(fetchExternal('ipinfo_demo', IP, async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 25));
    return jsonResponse({ ip: IP, country: 'US' });
  }, 8), /timed out/);
  assert.ok(Date.now() - started < 24);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(calls, 1);
});

test('network and credential failures never expose provider URLs or keys', async () => {
  const secret = 'fixture-secret';
  await assert.rejects(
    fetchExternal('ipsb', IP, async () => { throw new Error(`https://provider.invalid/?key=${secret}`); }),
    error => error instanceof ExternalError && !error.message.includes(secret) && !error.message.includes('provider.invalid'),
  );
  const previousKey = process.env.AMAP_API_KEY;
  process.env.AMAP_API_KEY = secret;
  try {
    await assert.rejects(
      fetchExternal('amap', IP, async () => ({ ok: false, status: 403, json: async () => ({}) })),
      error => !error.message.includes(secret) && !error.message.includes('restapi.amap.com'),
    );
  } finally {
    if (previousKey === undefined) delete process.env.AMAP_API_KEY;
    else process.env.AMAP_API_KEY = previousKey;
  }
});


test('business failure envelopes reject populated stale data', async () => {
  for (const [id, code] of [['baidu_qifu', 'Error'], ['baidu_qifu_backup', 'Error'], ['taobao', 1], ['cz88', 500], ['ipip', 1], ['zxinc', 1]]) {
    await assert.rejects(fetchExternal(id, IP, async () => jsonResponse({code, data: {
      ip: IP, country: '美国', country_name: '美国', location: '美国', city: '山景城',
    }})), /Invalid source response/, id);
  }
});

test('PCOnline decodes actual GBK bytes before parsing JSONP', async () => {
  const body = Buffer.concat([
    Buffer.from(`IPCallBack({"ip":"${IP}","addr":"`),
    Buffer.from('c3c0b9fa', 'hex'), Buffer.from('"});'),
  ]);
  const response = await fetchExternal('pconline', IP, async () => new Response(body));
  assert.equal(response.location.description, '美国');
});

test('native fetch releases a rejected response before attempting the fallback', async () => {
  const http = require('node:http');
  let resolveClosed;
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  let timer;
  let calls = 0;
  let closedBeforeFallback = false;
  const server = http.createServer((request, response) => {
    if (request.url === '/first') {
      response.once('close', resolveClosed);
      response.writeHead(429);
      response.write('unfinished error body');
      return;
    }
    response.end(JSON.stringify({ data: { ip: IP, country: 'US' } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const result = await fetchExternal('ipinfo_demo', IP, async (_url, init) => {
      calls++;
      if (calls === 2) {
        closedBeforeFallback = await Promise.race([
          closed.then(() => true),
          new Promise(resolve => {
            timer = setTimeout(() => resolve(false), 1_000);
          }),
        ]);
      }
      return fetch(base + (calls === 1 ? '/first' : '/fallback'), init);
    });
    assert.equal(calls, 2);
    assert.equal(closedBeforeFallback, true, 'previous response body remained open before fallback');
    assert.equal(result.location.countryCode, 'US');
  } finally {
    clearTimeout(timer);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
