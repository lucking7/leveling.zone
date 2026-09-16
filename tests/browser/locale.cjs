const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});
 let hits=0,fail=false,myhits=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/ip/**',r=>{hits++;return r.fulfill({status:fail?500:200,json:fail?{}:{ip:'8.8.8.8',status:'partial',generation:'fixture',timestamp:'2026-09-12T00:00:00Z',sources:{maxmind:{label:'MaxMind',location:{country:'美国',latitude:0,longitude:0},network:{organization:'Google LLC'}}},errors:{dbip:'Source unavailable'}}});});
 await page.route('**/api/myip',r=>{myhits++;return r.fulfill({json:{ip:'8.8.8.8',ipSource:'x-forwarded-for',sources:{},observation:{semantics:'request-ip',requestIpSourceCount:0,serverEgressSourceCount:0,failures:[{source:'fixture',reason:'timeout'}]},timestamp:'2026-09-12T00:00:00Z'}});});
 await page.goto('http://localhost:3191');await page.getByRole('button',{name:'切换为英文'}).click();
 await page.waitForFunction(()=>document.documentElement.lang==='en');assert.match(await page.locator('h1').innerText(),/See the address/);
 await page.locator('#ip-address').fill('8.8.8.8');await page.getByRole('button',{name:'Search',exact:true}).click();await page.locator('.result-ip').waitFor();
 assert.match(await page.locator('.result-table').innerText(),/美国/);const before=hits;
 await page.getByRole('button',{name:'Switch to Chinese'}).click();assert.equal(hits,before);assert.equal(await page.locator('#ip-address').inputValue(),'8.8.8.8');
 fail=true;await page.getByRole('button',{name:'查询',exact:true}).click();await page.locator('.notice-error').waitFor();await page.getByRole('button',{name:'切换为英文'}).click();assert.match(await page.locator('.notice-error').innerText(),/Could not query/);
 assert.match(await page.locator('.result-heading').innerText(),/Previous result/);
 fs.mkdirSync('.impeccable/review/locale',{recursive:true});await page.screenshot({path:'.impeccable/review/locale/english-result.png',fullPage:true});
 await page.reload();await page.waitForFunction(()=>document.documentElement.lang==='en');assert.equal(await page.locator('#ip-address').inputValue(),'8.8.8.8');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`.impeccable/review/locale/english-${width}.png`,fullPage:true});}
 await page.getByRole('link',{name:'My IP',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('#request-address-heading'));
 assert.match(await page.locator('h1').innerText(),/connection/i);assert.equal(await page.locator('#visitor-observation-heading').count(),0);assert.equal(await page.locator('.notice-error').count(),1);assert.equal(await page.locator('#observation-failure-heading').count(),1);assert.equal(await page.locator('#egress-observation-heading').count(),0);
 const m=myhits;await page.getByRole('button',{name:'Switch to Chinese'}).click();assert.equal(myhits,m);assert.match(await page.locator('h1').innerText(),/看见此刻/);
 await page.getByRole('button',{name:'切换为英文'}).click();await page.setViewportSize({width:390,height:812});await page.screenshot({path:'.impeccable/review/locale/myip-english.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);fs.writeFileSync('.impeccable/review/locale/checks.json',JSON.stringify({passed:['language switch and html lang','query data unchanged','switch preserves input/results without refetch','existing failure translates','reload remembers preference','320/390/768/1440 English layouts','myip route shares preference','unique bilingual observation IDs','myip switch does not refetch','no runtime exceptions'],capturedAt:new Date().toISOString()},null,2));await browser.close();console.log('10 locale checks passed');
})().catch(e=>{console.error(e);process.exit(1)});
