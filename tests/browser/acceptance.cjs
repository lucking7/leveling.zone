// Run against a started production server. Set PLAYWRIGHT_MODULE if not installed locally.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const sourceFiles = [
  "src/app/page.tsx",
  "src/app/myip/page.tsx",
  "src/components/workspace.tsx",
  "src/app/globals.css",
  "src/app/layout.tsx",
];
const path = require("node:path");
const base = process.env.UI_BASE_URL || "http://localhost:3187";
const out = path.resolve(process.env.UI_EVIDENCE_DIR || ".impeccable/review");
const fixture = (ip) => ({
  ip,
  status: "partial",
  generation: "fixture-snapshot",
  timestamp: "2026-09-12T00:00:00.000Z",
  sources: {
    maxmind: {
      label: "MaxMind",
      location: { country: "美国", latitude: 0, longitude: 0 },
      network: { asn: "AS15169", organization: "Google LLC" },
    },
    dbip: {
      label: "DB-IP",
      location: { country: "美国" },
      network: {
        asn: "AS15169",
        organization:
          "Long organization name for narrow viewport wrapping verification",
      },
    },
  },
  errors: { ipapi: "Source unavailable" },
});
const observation = {
  ip: "192.0.2.8",
  ipSource: "x-real-ip",
  timestamp: "2026-09-12T00:00:00.000Z",
  sources: {
    ipify: {
      ip: "192.0.2.8",
      network: { asn: 15169, organization: "Example network" },
      location: { country: "美国" },
      observation: { scope: "request-ip", source: "ipify" },
    },
    cloudflare: {
      ip: "192.0.2.8",
      network: { organization: "Visitor network" },
      observation: { scope: "request-ip", source: "cloudflare" },
    },
  },
  observation: {
    semantics: "request-ip",
    requestIpSourceCount: 2,
    serverEgressSourceCount: 0,
    failures: [{ source: "example", reason: "timeout" }],
  },
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const passed = [];
  async function shot(name) {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((i) => i.decode().catch(() => {})),
      );
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(out, name + ".png"),
      fullPage: true,
    });
  }
  async function overflow() {
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  async function send(ip) {
    await page.locator("#ip-address").fill(ip);
    await page.getByRole("button", { name: "查询", exact: true }).click();
  }
  let mode = "partial",
    hits = 0;
  await page.route("**/api/ip/**", async (route) => {
    hits++;
    const ip = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop(),
    );
    if (mode === "network") return route.abort();
    if (mode === "400")
      return route.fulfill({
        status: 400,
        json: { error: "Invalid IP address" },
      });
    if (mode === "500")
      return route.fulfill({ status: 500, body: "upstream unavailable" });
    if (mode === "malformed")
      return route.fulfill({
        json: {
          ...fixture(ip),
          sources: {
            broken: { label: "broken", network: { asn: {} }, location: {} },
          },
        },
      });
    if (mode === "five")
      return route.fulfill({
        json: {
          ...fixture(ip),
          sources: Object.fromEntries(
            ["a", "b", "c", "d", "e"].map((id) => [
              id,
              fixture(ip).sources.maxmind,
            ]),
          ),
        },
      });
    if (mode === "race")
      await new Promise((r) => setTimeout(r, ip === "1.1.1.1" ? 500 : 25));
    if (mode === "503")
      return route.fulfill({
        status: 503,
        json: { ...fixture(ip), status: "unavailable", sources: {} },
      });
    return route.fulfill({ json: fixture(ip) });
  });
  await page.goto(base);
  await page.locator("#ip-address").waitFor();
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator(".skip-link")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "main");
  passed.push("keyboard skip link reaches main");
  await page.evaluate(() => document.activeElement?.blur());
  assert.equal(await page.locator('.preview-results, .examples').count(), 0);
  assert.equal(await page.locator('.result-table tbody tr').count(), 0);
  await shot("empty-desktop");
  await page.screenshot({path:path.join(out,'hero-viewport.png'),fullPage:false});
  assert.equal(
    await page
      .locator(".orbit-globe canvas")
      .evaluate((i) => i.width > 0 && Boolean(i.dataset.longitude)),
    true,
  );
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await overflow();
    await shot("hero-" + width);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  passed.push("dynamic globe renders at desktop, mobile and tablet widths");
  assert.equal(hits, 0);
  passed.push("empty page has no sample data or automatic request");
  await page.locator("#ip-address").fill("not-an-ip");
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await page.locator(".notice-error").waitFor();
  assert.equal(hits, 0);
  passed.push("invalid input sends no request");
  await send("8.8.8.8");
  await page.getByRole("heading", { name: "8.8.8.8", exact: true }).waitFor();
  assert.equal(hits, 1);
  await overflow();
  assert.equal(
    await page
      .locator(".coordinate-readout")
      .innerText()
      .then((s) => s.includes("0.0000, 0.0000")),
    true,
  );
  await shot("desktop");
  await page.locator('.observation-disclosure > summary').evaluate(e=>e.click());
  assert.equal(await page.locator('.observation-disclosure').getAttribute('open'),'');
  passed.push("desktop observation semantics stay expanded");
  assert.equal(await page.locator('.source-problems, .state-partial, .notice-warning').count(), 0);
  passed.push("partial response silently omits missing sources and preserves valid results");
  await page.getByRole("button", { name: "复制 IP", exact: true }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    "8.8.8.8",
  );
  passed.push("clipboard actual IP");
  await page.setViewportSize({ width: 390, height: 812 });
  await overflow();
  assert.equal(
    await page.locator(".observation-disclosure").getAttribute("open"),
    null,
  );
  await shot("mobile");
  await page.getByText("观测视图", { exact: true }).click();
  assert.equal(await page.locator(".coordinate-readout").isVisible(), true);
  passed.push("mobile disclosure and layout");
  await send("2001:4860:4860::8888");
  await page
    .getByRole("heading", { name: "2001:4860:4860::8888", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 320, height: 812 });
  await overflow();
  await shot("ipv6-320");
  passed.push("IPv6 complete at 320px");
  assert.equal(
    await page
      .getByRole("button", { name: "复制 IP", exact: true })
      .locator(".lucide-check")
      .count(),
    0,
  );
  passed.push("copy status resets when result changes");
  mode = "network";
  await send("1.1.1.1");
  await page.locator(".notice-error").waitFor();
  assert.ok(
    (await page.locator(".result-heading").innerText()).includes(
      "上次查询结果",
    ),
  );
  assert.ok(
    (await page.locator(".result-heading").innerText()).includes(
      "2001:4860:4860::8888",
    ),
  );
  await shot("network-failure-mobile");
  passed.push("failed B preserves and labels old A");
  mode = "503";
  await send("8.8.8.8");
  await page
    .getByRole("heading", { name: "暂无结果", exact: true })
    .waitFor();
  assert.ok(
    (await page.locator(".result-heading").innerText()).includes("8.8.8.8"),
  );
  await page.getByRole("button", { name: "复制 JSON", exact: true }).click();
  assert.equal(
    JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))
      .status,
    "unavailable",
  );
  await shot("unavailable-mobile");
  passed.push("503 envelope and JSON preserved");
  mode = "race";
  await send("1.1.1.1");
  await page.locator("#ip-address").fill("8.8.8.8");
  await page.getByRole("button", { name: "重新查询", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".result-ip")?.textContent === "8.8.8.8" &&
      !document.querySelector("[aria-busy=true]"),
  );
  await page.waitForTimeout(550);
  assert.equal(await page.locator(".result-ip").innerText(), "8.8.8.8");
  passed.push("late response does not overwrite newer result");
  mode = "partial";
  await page.goto(base + "/?ip=8.8.8.8&external=false");
  await send("8.8.8.8");
  await page.waitForFunction(() =>
    document
      .querySelector(".result-heading")
      ?.textContent.includes("仅本地数据库"),
  );
  assert.ok(page.url().includes("external=false"));
  await page.reload();
  assert.equal(await page.locator('.query-options, #query-help, input[type="checkbox"]').count(), 0);
  assert.equal(await page.locator("#ip-address").inputValue(), "8.8.8.8");
  passed.push("URL restores IP and mode without auto-query");
  mode = "five";
  await page.setViewportSize({ width: 1440, height: 900 });
  await send("8.8.8.8");
  await page.waitForFunction(
    () => document.querySelectorAll(".result-table tbody tr").length === 5,
  );
  assert.ok(
    await page
      .locator(".result-table tbody tr")
      .nth(4)
      .evaluate((e) => e.getBoundingClientRect().bottom <= 900),
  );
  await page.screenshot({
    path: path.join(out, "five-rows-desktop.png"),
    fullPage: false,
  });
  passed.push("five complete desktop rows within 900px");
  for (const failure of ["400", "500", "malformed"]) {
    mode = failure;
    await send("999.1.1.1");
    await page.locator(".notice-error").waitFor();
    assert.ok(
      (await page.locator(".result-heading").innerText()).includes(
        "上次查询结果",
      ),
    );
  }
  passed.push(
    "400, non-JSON 500 and malformed payload retain old result safely",
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: async () => {
        throw new Error("denied");
      },
    }),
  );
  await page.getByRole("button", { name: "复制 IP", exact: true }).click();
  await page.locator(".copy-error").waitFor();
  passed.push("clipboard denial shows actionable failure");
  let obsMode = "partial";
  await page.route("**/api/myip", (route) =>
    obsMode === "network"
      ? route.abort()
      : obsMode === "500"
        ? route.fulfill({ status: 500, body: "unavailable" })
        : obsMode === "400"
          ? route.fulfill({
              status: 400,
              json: { error: "unknown", ip: "", ipSource: "unavailable" },
            })
          : route.fulfill({
              status: obsMode === "503" ? 503 : 200,
              json:
                obsMode === "503"
                  ? {
                      ...observation,
                      sources: {},
                      error: "全部不可用",
                      observation: {
                        semantics: "request-ip",
                        requestIpSourceCount: 0,
                        serverEgressSourceCount: 0,
                        failures: [{ source: "example", reason: "timeout" }],
                      },
                    }
                  : obsMode === "host"
                    ? {...observation, sources: {...observation.sources, cloudflare: {...observation.sources.cloudflare, ip:"198.51.100.4"}}}
                    : obsMode === "mixed"
                      ? {...observation, observation: {...observation.observation, semantics:"mixed"}}
                      : observation,
            }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + "/myip");
  await page.getByRole("heading", { name: "192.0.2.8", exact: true }).waitFor();
  assert.ok(!(await page.locator("main").innerText()).includes("198.51.100.4"));
  assert.equal(await page.locator("#egress-observation-heading").count(), 0);
  assert.equal(await page.locator(".source-problems, .notice-warning").count(), 0);
  await overflow();
  await shot("myip-desktop");
  await page.setViewportSize({ width: 390, height: 812 });
  await overflow();
  await shot("myip-mobile");
  passed.push("observation shows visitor results only on desktop/mobile");
  for (const invalidMode of ["host", "mixed"]) {
    obsMode = invalidMode;
    await page.getByRole("button", { name: "重新查询" }).click();
    await page.locator(".notice-error").waitFor();
    assert.equal(await page.locator(".observation-group tbody tr").count(), 0);
    assert.ok(!(await page.locator("main").innerText()).includes("198.51.100.4"));
  }
  passed.push("myip rejects mismatched IP and old mixed-scope payloads");
  obsMode = "503";
  await page.getByRole("button", { name: "重新查询" }).click();
  await page.locator(".notice-error").waitFor();
  assert.ok((await page.locator("main").innerText()).includes("192.0.2.8"));
  await shot("myip-unavailable");
  passed.push("myip 503 preserves provenance and retry state");
  obsMode = "400";
  await page.getByRole("button", { name: "重新查询" }).click();
  await page.getByText("无法识别当前 IP，请重试。", { exact: true }).waitFor();
  await shot("myip-unidentified");
  passed.push("myip unidentified address state");
  for (const failure of ["network", "500"]) {
    obsMode = failure;
    await page.getByRole("button", { name: "重新查询" }).click();
    await page.locator(".notice-error").waitFor();
    assert.equal(
      await page.getByRole("button", { name: "重新查询" }).isEnabled(),
      true,
    );
  }
  await shot("myip-service-failure");
  passed.push("myip network and non-JSON 500 offer retry");
  assert.deepEqual(errors, []);
  passed.push("no page runtime exceptions");
  fs.writeFileSync(
    path.join(out, "acceptance.json"),
    JSON.stringify(
      {
        kind: "mocked browser acceptance",
        base,
        passed,
        capturedAt: new Date().toISOString(),
        revision: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        workingTree: "uncommitted UI changes",
        designVersion: "v0.5",
        sourceHashes: Object.fromEntries(
          sourceFiles.map((file) => [
            file,
            createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
          ]),
        ),
        viewports: ["1440x900", "390x812", "320x812"],
        browser: "installed Chrome, headless Playwright; viewport emulation",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
