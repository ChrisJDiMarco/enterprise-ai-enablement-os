import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3002";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 820 } });
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(`${baseUrl}/?ui-smoke=${Date.now()}`, { waitUntil: "load" });
  await page.waitForTimeout(1000);

  await expectNav(page, "Command Center");
  await clickNav(page, "Strategy & Roadmap");
  await page.waitForTimeout(300);
  await expectText(page, "Enterprise AI Roadmap");
  await expectText(page, "Director Operating Loop");

  await clickNav(page, "Process Studio");
  await page.waitForTimeout(300);
  await expectText(page, "Process Redesign Studio");

  await clickNav(page, "Workflow Builder");
  await page.waitForTimeout(500);

  const paletteMetrics = await page.getByTestId("workflow-block-palette").evaluate((palette) => {
    const before = palette.scrollTop;
    palette.scrollTop = palette.scrollHeight;
    const after = palette.scrollTop;

    return {
      clientHeight: palette.clientHeight,
      scrollHeight: palette.scrollHeight,
      overflowY: getComputedStyle(palette).overflowY,
      independentScrollWorked: palette.scrollHeight > palette.clientHeight && after > before,
    };
  });

  assert(paletteMetrics.overflowY === "auto", "workflow block palette must use overflow-y auto");
  assert(paletteMetrics.independentScrollWorked, "workflow block palette did not scroll independently");

  await clickNav(page, "Admin");
  await page.waitForTimeout(500);
  await expectText(page, "Production Readiness");
  await expectText(page, "Tenant Branding");
  await expectText(page, "Workspace Operations");

  const companyInput = page.getByLabel("Company Name");
  assert((await companyInput.count()) === 1, "company name field should be accessible by label");
  const primaryColor = page.getByLabel("Tenant primary color");
  assert((await primaryColor.count()) === 1, "tenant primary color field should be accessible by label");

  await clickNav(page, "AI Orchestrator");
  await page.waitForTimeout(500);
  await expectText(page, "AI Orchestrator");

  assert(consoleErrors.length === 0, `browser console errors: ${consoleErrors.slice(0, 3).join("\n")}`);
  await browser.close();

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    checked: [
      "shell navigation",
      "strategy roadmap surface",
      "process redesign surface",
      "workflow builder independent palette scroll",
      "admin branding controls",
      "admin readiness panel",
      "orchestrator surface",
      "browser console clean",
    ],
  }, null, 2));
}

async function clickNav(page, name) {
  const navItem = page.locator("nav").getByRole("button", { name, exact: true });
  const count = await navItem.count();
  assert(count === 1, `expected one nav item named ${name}; found ${count}`);
  await navItem.click();
}

async function expectNav(page, name) {
  const navItem = page.locator("nav").getByRole("button", { name, exact: true });
  assert((await navItem.count()) === 1, `missing nav item named ${name}`);
}

async function expectText(page, text) {
  const locator = page.getByText(text, { exact: false });
  assert((await locator.count()) > 0, `missing visible text: ${text}`);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
