// Focused regression for the five findings in mobile-20260912/report.md.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'http://localhost:3191';
const out = path.resolve(process.env.UI_EVIDENCE_DIR || '.impeccable/review/mobile-five-fixes');
const ip = '8.8.8.8';
const sources = Object.fromEntries(Array.from({length:12}, (_, i) => [`source${String(i).padStart(2,'0')}`, {
  label: `Source ${i + 1}`, ip,
  network: {asn:'AS15169', organization:'Google LLC'},
  location: {country:'United States',region:'California',city:'Mountain View',latitude:37+i,longitude:-122+i},
  observation: {scope:'request-ip',source:`Source ${i + 1}`}
}]));
const query = {ip,status:'ok',generation:'fixture',timestamp:'2026-09-12T00:00:00Z',sources,errors:{}};
const observation = {...query,ipSource:'x-real-ip',observation:{semantics:'request-ip',requestIpSourceCount:12,serverEgressSourceCount:0,failures:[]}};
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[], measurements=[];let myipFailure=false, hits=0;
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/ip/**',r=>{hits++;return r.fulfill({json:query});});
 await page.route('**/api/myip',r=>{hits++;return r.fulfill(myipFailure?{status:503,json:{error:'Lookup unavailable'}}:{json:observation});});
 for (const route of ['/', '/myip']) {
  await page.goto(base+route);
  if(route==='/') {await page.locator('#ip-address').fill(ip);await page.getByRole('button',{name:'查询',exact:true}).click();}
  await page.locator('tbody tr').first().waitFor();
  assert.equal(await page.locator('tbody tr').count(),12);
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.motion==='settled');
  for(const locale of ['zh','en']) {
   if(locale==='en') {const before=hits;await page.getByRole('button',{name:'切换为英文'}).click();assert.equal(hits,before);}
   for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
    const layout=await page.evaluate(()=>({width:innerWidth,height:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth,credit:parseFloat(getComputedStyle(document.querySelector('.database-credit')).fontSize),subtitle:parseFloat(getComputedStyle(document.querySelector('.brand-subtitle')).fontSize)}));
    assert.equal(layout.overflow,false);if(width<=767){assert.ok(layout.credit>=12);if(width>=360)assert.ok(layout.subtitle>=12);assert.ok(layout.height<(width===320?3800:3300),`${route} ${locale} ${width}: ${layout.height}`);}
    measurements.push({route,locale,...layout});
    if(width===390 || (width===320&&locale==='en') || (width===1440&&locale==='en'))await page.screenshot({path:path.join(out,`${route==='/'?'query':'myip'}-${locale}-${width}.png`),fullPage:true});
   }
  }
  await page.setViewportSize({width:390,height:844});
  const second=page.locator('tbody tr').nth(1);await second.locator('summary').click();await second.getByRole('button',{name:'Locate this source'}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.motion==='settled' && +document.querySelector('canvas').dataset.latitude===38);
  assert.equal(await second.getAttribute('class'),'is-selected');
  assert.equal(await second.getByRole('button',{name:'Locate this source'}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('tbody .source-selection').count(),1);
  await second.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${route==='/'?'query':'myip'}-selected.png`)});
  await page.getByRole('button',{name:'Switch to Chinese'}).click();assert.equal(await second.getByRole('button',{name:'定位到此来源'}).getAttribute('aria-pressed'),'true');
 }
 myipFailure=true;
 await page.goto(base+'/myip');await page.locator('.notice-error').waitFor();
 for(const locale of ['zh','en']) {
  if(locale==='en')await page.getByRole('button',{name:'切换为英文'}).click();
  const order=await page.evaluate(()=>{const notice=document.querySelector('.notice-error').getBoundingClientRect();const retry=document.querySelector('.orbit-hero .primary-button').getBoundingClientRect();return {noticeTop:notice.top,noticeBottom:notice.bottom,retryTop:retry.top,caption:document.querySelector('.globe-controls').textContent};});
  assert.equal(await page.locator('.notice-error').count(),1);assert.ok(order.noticeBottom<=order.retryTop);assert.ok(order.noticeTop<400);assert.doesNotMatch(order.caption,/等待定位|Waiting for location/);
  await page.screenshot({path:path.join(out,`failure-${locale}.png`),fullPage:true});
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({measurements,passed:['12 sources preserved and compact','320/390/768/1440 no overflow','mobile auxiliary type >=12px','persistent selected source and aria-pressed','language switch preserves selection without refetch','failure precedes retry with truthful caption','no runtime errors']},null,2));
 await browser.close();console.log(JSON.stringify({passed:7,measurements},null,2));
})().catch(error=>{console.error(error);process.exit(1)});
