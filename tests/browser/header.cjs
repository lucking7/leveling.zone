const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.UI_BASE_URL || 'http://localhost:3192';
const out = path.resolve(process.env.UI_EVIDENCE_DIR || '.impeccable/review/header-build');
const widths = [320, 390, 768, 769, 1024, 1440];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const measurements = [];
  const passed = [];

  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/ip/**', route => route.fulfill({ status: 503, json: { error: 'Header test fixture' } }));
  await page.route('**/api/rdap/**', route => route.fulfill({ status: 503, json: { error: 'Header test fixture' } }));

  const goto = async pathname => {
    await page.goto(base + pathname);
    await page.locator('.site-header').waitFor();
  };
  const toggle = () => page.locator('.menu-toggle');
  const mobileNavigation = () => page.locator('.mobile-navigation');
  const openMenu = async () => {
    assert.equal(await toggle().getAttribute('aria-expanded'), 'false');
    await toggle().click();
    assert.equal(await toggle().getAttribute('aria-expanded'), 'true');
    await mobileNavigation().waitFor({ state: 'visible' });
  };
  const assertMenuClosed = async () => {
    await page.waitForFunction(() => document.querySelector('.menu-toggle')?.getAttribute('aria-expanded') === 'false');
    await mobileNavigation().waitFor({ state: 'hidden' });
  };

  await goto('/geoip');
  assert.equal(await page.locator('.desktop-navigation').count(), 1);
  assert.equal(await mobileNavigation().count(), 1);
  assert.equal(await mobileNavigation().getAttribute('id'), 'primary-navigation-mobile');
  assert.equal(await toggle().getAttribute('aria-controls'), 'primary-navigation-mobile');
  assert.equal(await page.locator('.desktop-navigation').getAttribute('aria-label'), '主导航');
  assert.equal(await mobileNavigation().getAttribute('aria-label'), '主导航');

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => {
      const rect = selector => {
        const value = document.querySelector(selector).getBoundingClientRect();
        return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
      };
      const header = document.querySelector('.site-header');
      const desktop = document.querySelector('.desktop-navigation');
      const mobile = document.querySelector('.mobile-navigation');
      const actions = document.querySelector('.header-actions');
      const wordmark = document.querySelector('.wordmark');
      const search = document.querySelector('.header-search');
      const toggleButton = document.querySelector('.menu-toggle');
      const language = document.querySelector('.language-switch');
      const theme = document.querySelector('.theme-switch');
      const styles = getComputedStyle(header);
      return {
        viewport: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
        header: rect('.site-header'),
        wordmark: rect('.wordmark'),
        desktop: rect('.desktop-navigation'),
        mobile: rect('.mobile-navigation'),
        search: rect('.header-search'),
        actions: rect('.header-actions'),
        toggle: rect('.menu-toggle'),
        language: rect('.language-switch'),
        theme: rect('.theme-switch'),
        desktopVisible: desktop.getClientRects().length > 0,
        mobileVisible: mobile.getClientRects().length > 0,
        toggleVisible: toggleButton.getClientRects().length > 0,
        headerPaddingRight: parseFloat(styles.paddingRight),
        wordmarkFlexShrink: getComputedStyle(wordmark).flexShrink,
        desktopGap: parseFloat(getComputedStyle(desktop).columnGap),
        searchDisplay: getComputedStyle(search).display,
        actionsDisplay: getComputedStyle(actions).display,
        languageDisplay: getComputedStyle(language).display,
        themeDisplay: getComputedStyle(theme).display,
      };
    });
    measurements.push(layout);
    assert.equal(layout.overflow, false, `${width}px header must not overflow`);
    assert.equal(layout.actionsDisplay, 'flex');
    assert.notEqual(layout.languageDisplay, 'none');
    assert.notEqual(layout.themeDisplay, 'none');

    if (width <= 768) {
      assert.equal(layout.desktopVisible, false, `${width}px desktop navigation must be hidden`);
      assert.equal(layout.mobileVisible, false, `${width}px mobile navigation must start collapsed`);
      assert.equal(layout.toggleVisible, true, `${width}px menu toggle must be visible`);
      for (const [name, control] of [['language', layout.language], ['theme', layout.theme], ['menu', layout.toggle]]) {
        assert.ok(control.width >= 44 && control.height >= 44, `${width}px ${name} control must be at least 44px`);
      }
      assert.ok(layout.wordmark.right <= layout.actions.x, `${width}px actions must not overlap the logo`);
      assert.equal(layout.wordmarkFlexShrink, '0', `${width}px logo must not shrink`);
      const expectedActionsRight = layout.header.right - layout.headerPaddingRight;
      assert.ok(Math.abs(layout.actions.right - expectedActionsRight) <= 1, `${width}px actions must stay right aligned`);
    } else {
      assert.equal(layout.desktopVisible, true, `${width}px desktop navigation must be visible`);
      assert.equal(layout.mobileVisible, false, `${width}px mobile navigation must be hidden`);
      assert.equal(layout.toggleVisible, false, `${width}px menu toggle must be hidden`);
      assert.equal(layout.desktopGap, 20, `${width}px desktop navigation gap`);
      assert.ok(layout.wordmark.right <= layout.desktop.x, `${width}px navigation must follow the logo`);
      if (width <= 1000) {
        assert.equal(layout.searchDisplay, 'none', `${width}px quick search must remain hidden at the intermediate width`);
        assert.ok(layout.desktop.right <= layout.actions.x, `${width}px actions must follow navigation`);
      } else {
        assert.equal(layout.searchDisplay, 'flex', `${width}px quick search must be visible`);
        assert.ok(layout.desktop.right <= layout.search.x, `${width}px search must follow navigation`);
        assert.ok(layout.search.right <= layout.actions.x, `${width}px actions must follow search`);
        assert.ok(Math.abs(layout.search.width - 280) <= 1, 'wide quick search must be 280px');
        assert.ok(Math.abs(layout.search.height - 36) <= 1, 'wide quick search must be 36px high');
      }
    }
  }
  passed.push('320/390/768/769/1024/1440 responsive boundary and no overflow');
  passed.push('mobile actions remain right aligned with 44px targets and an unshrunk logo');
  passed.push('desktop logo and navigation remain ordered with 20px gaps; 1024/1440 search is 280x36');

  await page.setViewportSize({ width: 390, height: 844 });
  await goto('/geoip');
  await openMenu();
  const mobileMenu = await mobileNavigation().evaluate(nav => {
    const links = [...nav.querySelectorAll('a')];
    const rectangles = links.map(link => {
      const rect = link.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom };
    });
    const dividers = links.slice(0, -1).map((link, index) => {
      const current = getComputedStyle(link);
      const next = getComputedStyle(links[index + 1]);
      return parseFloat(current.borderBottomWidth) > 0 || parseFloat(next.borderTopWidth) > 0;
    });
    return {
      text: links.map(link => link.textContent.trim()),
      href: links.map(link => link.getAttribute('href')),
      rectangles,
      dividers,
      direction: getComputedStyle(nav).flexDirection,
    };
  });
  assert.deepEqual(mobileMenu.text, ['我的 IP', 'GeoIP', 'Whois', '出口检测', 'GitHub']);
  assert.deepEqual(mobileMenu.href, ['/myip', '/geoip', '/whois', '/egress', 'https://github.com/lucking7/leveling.zone']);
  assert.equal(mobileMenu.direction, 'column');
  assert.equal(mobileMenu.rectangles.length, 5);
  for (const item of mobileMenu.rectangles) assert.ok(Math.abs(item.height - 46) <= 1, 'mobile links must be 46px high');
  for (let index = 1; index < mobileMenu.rectangles.length; index++) {
    const previous = mobileMenu.rectangles[index - 1];
    const current = mobileMenu.rectangles[index];
    assert.ok(Math.abs(current.x - previous.x) <= 1 && Math.abs(current.width - previous.width) <= 1, 'mobile links must form one aligned column');
    assert.ok(Math.abs(current.y - previous.bottom) <= 1, 'mobile links must be contiguous');
  }
  assert.ok(mobileMenu.dividers.every(Boolean), 'mobile links must have separators');
  await page.screenshot({ path: path.join(out, 'mobile-menu-390.png'), fullPage: true });
  passed.push('mobile menu contains five links including Egress in one divided 46px column');

  await page.keyboard.press('Escape');
  await assertMenuClosed();
  assert.equal(await toggle().evaluate(element => document.activeElement === element), true);
  passed.push('Escape closes the menu and restores toggle focus');

  await openMenu();
  await page.locator('main h1').click();
  await assertMenuClosed();
  passed.push('outside click closes the menu');

  await openMenu();
  await mobileNavigation().getByRole('link', { name: 'GeoIP', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/geoip');
  await assertMenuClosed();
  passed.push('same-route link closes the menu and preserves navigation');

  await openMenu();
  await mobileNavigation().getByRole('link', { name: 'Whois', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/whois');
  await assertMenuClosed();
  passed.push('new-route link closes the menu and navigates');

  await openMenu();
  await page.setViewportSize({ width: 769, height: 844 });
  await assertMenuClosed();
  await page.setViewportSize({ width: 390, height: 844 });
  await assertMenuClosed();
  passed.push('resizing above 768 clears mobile menu state');

  await page.locator('.language-switch').click();await page.getByRole('menuitemradio',{name:'English',exact:true}).click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  assert.equal(await page.locator('.desktop-navigation').getAttribute('aria-label'), 'Main navigation');
  assert.equal(await mobileNavigation().getAttribute('aria-label'), 'Main navigation');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  assert.equal(await page.getByRole('button', { name: 'Select language' }).count(), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('orbit.locale')), 'en');
  passed.push('language toggle updates both navigation labels and persists after reload');

  await page.locator('.language-switch').click();await page.getByRole('menuitemradio',{name:'简体中文',exact:true}).click();
  await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
  await page.getByRole('button', { name: '切换深色' }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  assert.equal(await page.evaluate(() => localStorage.getItem('orbit.theme')), 'dark');
  assert.equal(await page.getByRole('button', { name: '切换浅色' }).count(), 1);
  passed.push('theme toggle persists after reload');

  await page.setViewportSize({ width: 1440, height: 900 });
  await goto('/geoip');
  await page.locator('.header-search input').fill('8.8.8.8');
  await page.locator('.header-search input').press('Enter');
  await page.waitForURL(url => url.pathname === '/geoip/8.8.8.8');
  assert.equal(new URL(page.url()).pathname, '/geoip/8.8.8.8');
  await goto('/whois');
  await page.locator('.header-search input').fill('8.8.4.4');
  await page.locator('.header-search input').press('Enter');
  await page.waitForURL(url => url.pathname === '/whois/8.8.4.4');
  assert.equal(new URL(page.url()).pathname, '/whois/8.8.4.4');
  passed.push('header quick search keeps GeoIP and Whois routes valid');

  await page.screenshot({ path: path.join(out, 'desktop-header-1440.png'), fullPage: true });

  const languageTrigger = page.locator('.language-switch');
  await languageTrigger.focus();await page.keyboard.press('ArrowDown');
  assert.equal(await page.getByRole('menuitemradio',{name:'简体中文',exact:true}).evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('End');assert.equal(await page.getByRole('menuitemradio',{name:'English',exact:true}).evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('ArrowDown');assert.equal(await page.getByRole('menuitemradio',{name:'简体中文',exact:true}).evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Escape');assert.equal(await languageTrigger.getAttribute('aria-expanded'),'false');assert.equal(await languageTrigger.evaluate(e=>e===document.activeElement),true);
  await languageTrigger.click();await page.keyboard.press('Tab');assert.equal(await languageTrigger.getAttribute('aria-expanded'),'false');assert.equal(await page.locator('.theme-switch').evaluate(e=>e===document.activeElement),true);
  passed.push('Language menu keyboard navigation, Escape restoration and Tab exit');
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});await languageTrigger.click();const r=await page.getByRole('menu').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width);assert.equal(await page.getByRole('menuitemradio',{checked:true}).count(),1);await page.locator('main').click({position:{x:5,y:5}});assert.equal(await languageTrigger.getAttribute('aria-expanded'),'false');}
  await page.setViewportSize({width:390,height:844});await page.locator('.menu-toggle').click();await languageTrigger.click();assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');await page.locator('.menu-toggle').click();assert.equal(await languageTrigger.getAttribute('aria-expanded'),'false');await page.locator('.menu-toggle').click();
  passed.push('Language menu bounds, checked option, outside dismissal and mobile navigation exclusion');

  assert.deepEqual(errors, []);
  passed.push('no browser runtime exceptions');
  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify({ passed, measurements }, null, 2));
  await browser.close();
  console.log(JSON.stringify({ passed }, null, 2));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
