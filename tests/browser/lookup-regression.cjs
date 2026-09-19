// Run against a built local server. Playwright is supplied externally; no project dependency is needed.
// ORBIT_BASE=http://127.0.0.1:3107 PLAYWRIGHT_MODULE=/path/to/playwright BROWSER_EXECUTABLE=/path/to/chrome node tests/browser/lookup-regression.cjs
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ORBIT_BASE || 'http://127.0.0.1:3107';
const successful = new Set(['8.8.8.8', '2001:4860:4860::8888']);
const rdap = ip => ({
  ip, registry: 'ARIN', endpoint: `https://rdap.arin.net/registry/ip/${ip}`,
  network: { handle: 'NET-FIXTURE', name: `Network ${ip}`, type: 'DIRECT', startAddress: ip,
    endAddress: ip, ipVersion: ip.includes(':') ? 'v6' : 'v4', country: 'US', parentHandle: '', cidrs: [] },
  entities: [], events: [], remarks: [], notices: [], links: [], raw: { objectClassName: 'ip network', name: `Network ${ip}` },
});
const securitySource = { label: 'IP2Location', location: {}, network: {}, security: { isProxy: false } };
const geo = ip => ({ ip, generation: 'fixture', timestamp: '2026-01-01T00:00:00Z', status: 'ok', errors: {}, sources: { ip2location: securitySource } });
const visitor = () => ({
  ip: '192.0.2.1', ipSource: 'x-real-ip', generation: 'fixture',
  sources: { ip2location: { ...securitySource, ip: '192.0.2.1', observation: { scope: 'request-ip', source: 'IP2Location' } } },
  observation: { semantics: 'request-ip', requestIpSourceCount: 1, serverEgressSourceCount: 0, failures: [] },
});
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE && { executablePath: process.env.BROWSER_EXECUTABLE }) });
  try {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    const externalRequests = [];
    const apiRequests = [];
    const failedRequests = [];
    let delayedIp = null;
    let releaseDelayed;
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin !== new URL(base).origin) externalRequests.push(request.url());
      if (url.pathname.startsWith('/api/')) apiRequests.push(url.pathname);
    });
    page.on('requestfailed', request => failedRequests.push(new URL(request.url()).pathname));
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/rdap/**', async route => {
      const ip = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop());
      if (ip === delayedIp) await new Promise(resolve => { releaseDelayed = resolve; });
      return successful.has(ip) ? json(route, rdap(ip)) : json(route, { code: 'UPSTREAM_ERROR' }, 503);
    });
    let geoBody = geo('8.8.8.8');
    let visitorBody = visitor();
    await page.route('**/api/ip/**', route => json(route, geoBody));
    await page.route('**/api/myip', route => json(route, visitorBody));
    const main = page.locator('main');
    const network = ip => page.getByText(`Network ${ip}`, { exact: true });
    const submitWhois = async ip => {
      await page.locator('#whois-ip').fill(ip);
      await page.locator('#whois-ip').press('Enter');
    };

    await page.goto(`${base}/whois/8.8.8.8`);
    await network('8.8.8.8').waitFor();
    await submitWhois('1.1.1.1');
    await main.getByRole('alert').waitFor();
    assert.equal(await network('8.8.8.8').count(), 1, 'failed B must retain successful A');
    assert.match(await main.innerText(), /上次查询结果/);
    assert.equal(new URL(page.url()).pathname, '/whois/1.1.1.1');
    successful.add('1.1.1.1');
    await main.getByRole('button', { name: '重试', exact: true }).click();
    await network('1.1.1.1').waitFor();
    delayedIp = '8.8.8.8';
    const delayedRequest = page.waitForRequest(request => request.url().endsWith('/api/rdap/8.8.8.8'));
    await page.goBack();
    await delayedRequest;
    const supersededAbort = page.waitForEvent('requestfailed', { predicate: request => request.url().endsWith('/api/rdap/8.8.8.8') });
    await page.goForward();
    await supersededAbort;
    await page.waitForFunction(() => !document.querySelector('.lookup-form button').disabled);
    releaseDelayed();
    delayedIp = null;
    assert.equal(await network('1.1.1.1').count(), 1, 'late A must not overwrite B');
    await page.goBack();
    await network('8.8.8.8').waitFor();
    assert.equal(await page.locator('#whois-ip').inputValue(), '8.8.8.8');
    await page.goForward();
    await network('1.1.1.1').waitFor();
    await page.goto(`${base}/whois/${encodeURIComponent('2001:4860:4860::8888')}`);
    await network('2001:4860:4860::8888').waitFor();
    await page.goto(`${base}/whois`);
    await submitWhois('8.8.8.8');
    await network('8.8.8.8').waitFor();
    await page.goBack();
    await page.waitForFunction(() => document.querySelector('#whois-ip')?.value === '' && !document.querySelector('.data-panel'));
    await page.goForward();
    await network('8.8.8.8').waitFor();

    delayedIp = '203.0.113.1';
    const departingRequest = page.waitForRequest(request => request.url().endsWith('/api/rdap/203.0.113.1'));
    await submitWhois(delayedIp);
    await departingRequest;
    const departingAbort = page.waitForEvent('requestfailed', { predicate: request => request.url().endsWith('/api/rdap/203.0.113.1') });
    await page.locator('.desktop-navigation').getByRole('link', { name: 'GeoIP', exact: true }).click();
    await departingAbort;
    await page.locator('#geoip-address').waitFor();
    releaseDelayed();
    delayedIp = null;

    await page.goto(`${base}/geoip/8.8.8.8?external=false`);
    await page.locator('.single-source').waitFor();
    assert.equal(await main.getByRole('alert').count(), 0);
    assert.deepEqual(JSON.parse(await page.locator('.raw-json').textContent()), geoBody);
    await main.getByRole('button', { name: '复制完整 JSON', exact: true }).click();
    assert.deepEqual(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())), geoBody);
    geoBody = { ...geoBody, sources: { ...geoBody.sources, geo: { label: 'Coordinates', location: { latitude: 0, longitude: 0, country: 'Test' }, network: { organization: 'Fixture network' } } } };
    await page.reload();
    await page.getByText('0, 0', { exact: true }).waitFor();
    const countBeforeSelection = apiRequests.length;
    await page.getByLabel('数据来源', { exact: true }).selectOption('ip2location');
    assert.equal(await page.getByText('0, 0', { exact: true }).count(), 0);
    assert.deepEqual(JSON.parse(await page.locator('.raw-json').textContent()), geoBody);
    await page.getByRole('button', { name: '选择语言', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
    await page.getByText('Not provided', { exact: true }).first().waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(apiRequests.length, countBeforeSelection, 'source and locale changes must not refetch');
    await page.setViewportSize({ width: 320, height: 750 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto(`${base}/myip`);
    await page.locator('.single-source').waitFor();
    assert.deepEqual(JSON.parse(await page.locator('.raw-json').textContent()), visitorBody);
    await main.getByRole('button', { name: 'Copy full JSON', exact: true }).click();
    assert.deepEqual(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())), visitorBody);
    visitorBody = visitor();
    visitorBody.sources.ip2location.ip = '198.51.100.1';
    await main.getByRole('button', { name: 'Try again', exact: true }).click();
    await main.getByRole('alert').waitFor();
    assert.match(await main.innerText(), /previous result/);
    assert.equal(JSON.parse(await page.locator('.raw-json').textContent()).sources.ip2location.ip, '192.0.2.1');
    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests, [], 'fixtures must not call external providers');
    console.log(JSON.stringify({ browser: browser.version(), checks: ['Whois cross-address failure, retry, back, forward, IPv6 deep link, empty route history, superseded and unmounted abort', 'GeoIP security-only, source selection, zero coordinates, complete JSON copy, locale, 320px layout', 'MyIP security-only, complete JSON copy, invalid provenance preserves old result'], pageErrors: errors, externalRequests, failedRequests, apiRequestCount: apiRequests.length }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
