const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const base = process.env.UI_BASE_URL || "http://localhost:3191";
const out = path.resolve(".impeccable/review/myip-globe");
const visitorIp = "192.0.2.8";

function source(name, latitude, longitude) {
  return {
    ip: visitorIp,
    location: {
      country: "Fixture country",
      ...(latitude === undefined ? {} : { latitude }),
      ...(longitude === undefined ? {} : { longitude }),
    },
    network: { asn: "AS64500", organization: `${name} network` },
    observation: { scope: "request-ip", source: name },
  };
}

function envelope(sources) {
  return {
    ip: visitorIp,
    ipSource: "x-forwarded-for",
    generation: "fixture-snapshot",
    timestamp: "2026-09-12T00:00:00.000Z",
    sources,
    observation: {
      semantics: "request-ip",
      requestIpSourceCount: Object.keys(sources).length,
      serverEgressSourceCount: 0,
      failures: [],
    },
  };
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  const passed = [];
  let hits = 0;
  let mode = "located";

  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/myip", (route) => {
    hits += 1;
    if (mode === "failure") {
      return route.fulfill({
        status: 500,
        json: { error: "fixture failure" },
      });
    }
    if (mode === "zero") {
      return route.fulfill({ json: envelope({ zero: source("Zero", 0, 0) }) });
    }
    if (mode === "no-coordinates") {
      return route.fulfill({
        json: envelope({ plain: source("No coordinates") }),
      });
    }
    if (mode === "reduced") {
      return route.fulfill({
        json: envelope({ london: source("London", 51.5, -0.1) }),
      });
    }
    return route.fulfill({
      json: envelope({
        alpha: source("Tokyo source", 35.6762, 139.6503),
        beta: source("Sydney source", -33.8688, 151.2093),
      }),
    });
  });

  await page.goto(`${base}/myip`);
  const canvas = page.locator(".orbit-globe canvas");
  await page.waitForFunction(
    () =>
      Math.abs(
        Number(
          document.querySelector(".orbit-globe canvas")?.dataset.longitude,
        ) - 139.6503,
      ) < 0.1,
  );
  assert.match(await canvas.getAttribute("aria-label"), /Tokyo source/);
  passed.push("successful visitor lookup automatically locates first source");
  await page.screenshot({
    path: path.join(out, "auto-location.png"),
    fullPage: true,
  });

  const sydneyRow = page
    .locator(".observation-group tbody tr")
    .filter({ hasText: "Sydney source" });
  await sydneyRow.locator("summary").click();
  await sydneyRow
    .getByRole("button", { name: "定位到此来源", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      Math.abs(
        Number(
          document.querySelector(".orbit-globe canvas")?.dataset.longitude,
        ) - 151.2093,
      ) < 0.1 &&
      Math.abs(
        Number(
          document.querySelector(".orbit-globe canvas")?.dataset.latitude,
        ) + 33.8688,
      ) < 0.1,
  );
  assert.match(await canvas.getAttribute("aria-label"), /Sydney source/);
  passed.push(
    "per-source control turns globe to a different database estimate",
  );
  await page.screenshot({
    path: path.join(out, "source-location.png"),
    fullPage: true,
  });

  const hitsBeforeLanguageSwitch = hits;
  await page.getByRole("button", { name: "切换为英文" }).click();
  await page.waitForFunction(() => document.documentElement.lang === "en");
  assert.equal(hits, hitsBeforeLanguageSwitch);
  assert.match(await canvas.getAttribute("aria-label"), /Sydney source/);
  await page.getByRole("button", { name: "Switch to Chinese" }).click();
  assert.equal(hits, hitsBeforeLanguageSwitch);
  passed.push("language switch preserves source selection without refetching");

  mode = "zero";
  await page.getByRole("button", { name: "重新查询", exact: true }).click();
  await page.waitForFunction(
    () =>
      Math.abs(
        Number(
          document.querySelector(".orbit-globe canvas")?.dataset.longitude,
        ),
      ) < 0.1 &&
      Math.abs(
        Number(document.querySelector(".orbit-globe canvas")?.dataset.latitude),
      ) < 0.1,
  );
  assert.match(await canvas.getAttribute("aria-label"), /纬度 0，经度 0/);
  passed.push("zero latitude and longitude are valid targets");

  mode = "no-coordinates";
  await page.getByRole("button", { name: "重新查询", exact: true }).click();
  await page.getByRole("heading", { name: visitorIp, exact: true }).waitFor();
  assert.equal(await canvas.getAttribute("aria-label"), "ASCII 地球地理视图");
  const heldWithoutCoordinates = await canvas.getAttribute("data-longitude");
  await page.waitForTimeout(350);
  assert.equal(
    await canvas.getAttribute("data-longitude"),
    heldWithoutCoordinates,
  );
  passed.push(
    "coordinate-free result clears target and holds the current view",
  );

  mode = "located";
  await page.getByRole("button", { name: "重新查询", exact: true }).click();
  await page.waitForFunction(
    () =>
      Math.abs(
        Number(
          document.querySelector(".orbit-globe canvas")?.dataset.longitude,
        ) - 139.6503,
      ) < 0.1,
  );
  mode = "failure";
  await page.getByRole("button", { name: "重新查询", exact: true }).click();
  await page.locator(".notice-error").waitFor();
  assert.equal(await canvas.getAttribute("aria-label"), "ASCII 地球地理视图");
  passed.push("failed retry clears the previous globe target");

  await page.emulateMedia({ reducedMotion: "reduce" });
  mode = "reduced";
  await page.getByRole("button", { name: "重新查询", exact: true }).click();
  await page.waitForFunction(
    () =>
      Math.abs(Number(document.querySelector(".orbit-globe canvas")?.dataset.longitude) + 0.1) < 0.1 &&
      Math.abs(Number(document.querySelector(".orbit-globe canvas")?.dataset.latitude) - 51.5) < 0.1,
  );
  passed.push("globe still locates the new target with system reduced motion enabled");

  await page.setViewportSize({ width: 390, height: 812 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: path.join(out, "mobile.png"), fullPage: true });
  passed.push("mobile visitor results have no horizontal overflow");

  assert.deepEqual(errors, []);
  passed.push("no page runtime exceptions");
  fs.writeFileSync(
    path.join(out, "checks.json"),
    JSON.stringify(
      {
        kind: "mocked /myip globe browser regression",
        base,
        passed,
        requestCount: hits,
        capturedAt: new Date().toISOString(),
        browser: "installed Chrome, headless Playwright; viewport emulation",
      },
      null,
      2,
    ),
  );
  await browser.close();
  console.log(`${passed.length} /myip globe checks passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
