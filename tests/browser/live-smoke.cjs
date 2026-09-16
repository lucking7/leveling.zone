// Requires a running app with a real database snapshot. /myip looks up the visitor in local databases.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
(async () => {
  const out = path.resolve(process.env.UI_EVIDENCE_DIR || ".impeccable/review");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const base = process.env.UI_BASE_URL || "http://localhost:3187";
  await page.goto(base + "/?external=false");
  await page.locator("#ip-address").fill("8.8.8.8");
  const queryResponse = page.waitForResponse((r) =>
    r.url().includes("/api/ip/8.8.8.8"),
  );
  await page.getByRole("button", { name: "查询", exact: true }).click();
  const query = await (await queryResponse).json();
  await page.waitForFunction(
    () =>
      document.querySelector(".result-ip")?.textContent === "8.8.8.8" &&
      !document.querySelector("[aria-busy=true]"),
  );
  assert.ok(Object.keys(query.sources).length > 0);
  assert.ok((await page.locator("main").innerText()).includes("Google"));
  await page.screenshot({
    path: path.join(out, "real-query.png"),
    fullPage: true,
  });
  const observationResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/myip"),
  );
  await page.goto(base + "/myip");
  const response = await observationResponse;
  const observation = await response.json();
  await page.waitForFunction(
    () =>
      !document.querySelector("[aria-busy=true]") &&
      document.querySelector("#request-address-heading"),
  );
  assert.equal(
    await page.locator("#request-address-heading").innerText(),
    observation.ip,
  );
  assert.equal(observation.observation.semantics, 'request-ip');
  assert.equal(observation.observation.serverEgressSourceCount, 0);
  assert.ok(Object.values(observation.sources).every(s => s.ip === observation.ip && s.observation.scope === 'request-ip'));
  assert.equal(await page.locator('#egress-observation-heading').count(), 0);
  const count = Object.keys(observation.sources).length;
  assert.equal(
    await page.locator(".observation-group tbody tr").count(),
    count,
  );
  await page.screenshot({
    path: path.join(out, "real-myip.png"),
    fullPage: true,
  });
  const sourceFiles = [
    "src/app/page.tsx",
    "src/app/myip/page.tsx",
    "src/components/workspace.tsx",
    "src/app/globals.css",
    "src/app/layout.tsx",
  ];
  const evidence = {
    kind: "live API browser smoke",
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
    viewport: "1440x900",
    browser: "installed Chrome, headless Playwright",
    query: {
      status: query.status,
      sourceIds: Object.keys(query.sources),
      generation: query.generation,
    },
    observation: {
      httpStatus: response.status(),
      requestIpSource: observation.ipSource,
      requestIpSourceCount: observation.observation.requestIpSourceCount,
      serverEgressSourceCount: observation.observation.serverEgressSourceCount,
      failureCount: observation.observation.failures.length,
    },
    assertions: [
      "real local query renders Google",
      "request heading matches response",
      "all successful observation rows rendered",
    ],
  };
  fs.writeFileSync(
    path.join(out, "live-smoke.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
