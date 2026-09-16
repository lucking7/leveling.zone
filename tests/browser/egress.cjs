const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:3192';
const out = path.resolve('.impeccable/review/source-alignment/egress');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    let calls = 0, mode = 'ok';
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin) return route.continue();
      calls++;
      if (url.hostname === 'v6.ident.me' && mode === 'ok') return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ip: '2001:4860:4860:0000:0000:0000:0000:8888', country: 'United States', cc: 'US', city: 'Mountain View', aso: 'Google LLC international network operations' }) });
      if (url.hostname === 'api.ipquery.io' && mode === 'ok') return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ip: '8.8.8.8', location: { country: 'United States', country_code: 'US', state: 'California', city: 'Mountain View' }, isp: { asn: 'AS15169', org: 'Google LLC', isp: 'Google LLC' } }) });
      return route.abort('failed');
    });
    await page.goto(base + '/egress');
    await page.locator('#egress-start').waitFor();
    assert.equal(calls, 0, 'no probes before user starts');
    const checks = ['entry does not probe before explicit start'];
    await page.locator('#egress-start').click();
    await page.locator('.egress-table tbody tr').first().waitFor();
    await page.waitForFunction(() => !document.querySelector('#egress-start').disabled);
    assert.equal(await page.locator('.egress-table tbody tr').count(), 2);
    assert.match(await page.locator('.egress-table').innerText(), /8\.8\.8\.8/);
    assert.match(await page.locator('.egress-table').innerText(), /ipquery/i);
    assert.match(await page.locator('.egress-table').innerText(), /IPv6/);
    assert.equal(await page.locator('.egress-table a').filter({ hasText: '2001:4860' }).getAttribute('href'), '/geoip/2001%3A4860%3A4860%3A0000%3A0000%3A0000%3A0000%3A8888');
    checks.push('partial success shows only valid remote IP and silently omits failed probes');
    const before = calls;
    await page.locator('.language-switch').click();
    await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
    assert.equal(calls, before);
    assert.match(await page.locator('.egress-table').innerText(), /8\.8\.8\.8/);
    checks.push('locale changes preserve results and do not probe again');
    for (const width of [320, 390, 768, 769, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no overflow at ' + width);
      const button = await page.locator('#egress-start').boundingBox();
      if (width <= 768) assert.ok(button.height >= 44);
      if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(out, 'results-' + width + '.png'), fullPage: true });
    }
    checks.push('320/390/768/769/1440 layouts fit with mobile touch targets');
    await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
    await page.screenshot({ path: path.join(out, 'dark.png'), fullPage: true });
    mode = 'fail';
    await page.locator('#egress-start').click();
    await page.waitForFunction(() => !document.querySelector('#egress-start').disabled);
    await page.locator('.egress-empty').waitFor();
    assert.equal(await page.locator('.egress-table tbody tr').count(), 0);
    checks.push('all failures expose a retryable empty state without stale addresses');
    mode = 'ok';
    await page.locator('#egress-start').click();
    await page.locator('.egress-table tbody tr').first().waitFor();
    await page.waitForFunction(() => !document.querySelector('#egress-start').disabled);
    checks.push('retry restores actual successful probe data');
    assert.deepEqual(pageErrors, []);
    checks.push('no browser runtime errors');
    fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify({ checks, remoteCalls: calls, mocked: true, pageErrors }, null, 2));
    console.log(JSON.stringify({ checks }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
