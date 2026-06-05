import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3002";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectText(page, text) {
  const locator = page.getByText(text, { exact: false });
  assert((await locator.count()) > 0, `expected text: ${text}`);
}

async function expectNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: window.innerWidth,
  }));
  assert(
    metrics.body <= metrics.viewport + 4,
    `${label} has horizontal overflow: body=${metrics.body}, viewport=${metrics.viewport}`,
  );
}

async function expectRoute(page, path, expectedTexts) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  for (const text of expectedTexts) {
    await expectText(page, text);
  }
  await expectNoHorizontalOverflow(page, path);
}

async function expectCollateral(path, contentType, expectedText) {
  const response = await fetch(`${baseUrl}${path}`);
  assert(response.ok, `${path} returned ${response.status}`);
  const receivedType = response.headers.get("content-type") || "";
  assert(receivedType.includes(contentType), `${path} returned ${receivedType}, expected ${contentType}`);
  const disposition = response.headers.get("content-disposition") || "";
  assert(disposition.includes("attachment"), `${path} should be an attachment`);
  const body = await response.text();
  assert(body.includes(expectedText), `${path} did not include ${expectedText}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const consoleErrors = [];
  const resourceErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      resourceErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await expectRoute(page, "/site", [
    "Enterprise AI Enablement OS",
    "A complete operating loop for enterprise AI",
    "Use Case Factory",
    "AI Harness",
    "Evidence Ledger",
  ]);

  const heroBackground = await page
    .locator("main section")
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  assert(
    heroBackground.includes("/marketing/enablement-os-command-center.png"),
    "landing page hero should use the generated product visual",
  );

  await expectRoute(page, "/site/implementation", [
    "Connect the company stack",
    "Day-one connection map",
    "SSO/OIDC",
    "Slack or Teams",
    "First 90 days",
    "Connectors",
  ]);

  await expectRoute(page, "/site/security", [
    "The model is not the system",
    "Trust controls",
    "Framework evidence",
    "NIST AI RMF",
    "OWASP LLM/MCP",
  ]);

  await expectRoute(page, "/site/collateral", [
    "Buyer collateral",
    "Executive One-Pager",
    "Security & Governance Brief",
    "90-Day Implementation Plan",
    "Pilot Scorecard Schema",
  ]);

  await expectCollateral(
    "/api/collateral/one-pager",
    "text/markdown",
    "Enterprise AI Enablement OS is the command system",
  );
  await expectCollateral(
    "/api/collateral/security-brief",
    "text/markdown",
    "Security & Governance Brief",
  );
  await expectCollateral(
    "/api/collateral/implementation-plan",
    "text/markdown",
    "90-Day Implementation Plan",
  );
  await expectCollateral(
    "/api/collateral/pilot-scorecard",
    "application/json",
    "enterprise-ai-enablement-os.pilot-scorecard.v1",
  );

  const imageResponse = await fetch(`${baseUrl}/marketing/enablement-os-command-center.png`);
  assert(imageResponse.ok, "marketing hero image should be fetchable");
  assert(
    (imageResponse.headers.get("content-type") || "").includes("image/png"),
    "marketing hero image should be served as PNG",
  );

  assert(consoleErrors.length === 0, `console errors:\n${consoleErrors.join("\n")}`);
  assert(resourceErrors.length === 0, `resource errors:\n${resourceErrors.join("\n")}`);

  await browser.close();
  console.log("marketing smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
