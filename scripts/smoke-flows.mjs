import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3002";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectText(page, text, options = {}) {
  const locator = typeof text === "string" ? page.getByText(text, { exact: false }) : page.getByText(text);
  await locator.first().waitFor({ state: "visible", timeout: options.timeout ?? 5000 }).catch(() => {});
  assert((await locator.count()) > 0, `expected text: ${String(text)}`);
}

async function clickNav(page, name) {
  const navItem = navButton(page, name);
  let count = await navItem.count();
  if (count === 0) {
    await expandAllNavHubs(page);
    count = await navItem.count();
  }
  assert(count === 1, `expected one nav item named ${name}; found ${count}`);
  await navItem.click();
}

function navButton(page, name) {
  return page.locator("nav").getByRole("button", { name: new RegExp(`^${escapeRegExp(name)}(?:\\b|\\s|$)`) });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function expandAllNavHubs(page) {
  const allSections = page.getByTestId("nav-all-sections");
  if ((await allSections.count()) === 1) {
    const isOpen = await allSections.evaluate((element) => element.getAttribute("data-open") === "true");
    if (!isOpen) {
      await allSections.getByRole("button").click();
      await page.waitForTimeout(100);
    }
  }
  const hubs = page.locator('nav [data-testid^="nav-hub-"]');
  const count = await hubs.count();
  for (let index = 0; index < count; index += 1) {
    const hub = hubs.nth(index);
    if ((await hub.getAttribute("aria-expanded")) !== "true") {
      await hub.click();
    }
  }
}

async function clickButton(page, name, options = {}) {
  const locator = page.getByRole("button", { name, exact: options.exact ?? true });
  const count = await locator.count();
  assert(count >= 1, `expected button named ${String(name)}`);
  await locator.first().click();
}

async function clickTab(page, name, scope = page.locator("main")) {
  const tab = scope.getByRole("tab", { name, exact: true });
  if ((await tab.count()) > 0) {
    await tab.first().click();
    return;
  }

  const button = scope.getByRole("button", { name, exact: true });
  const count = await button.count();
  assert(count >= 1, `expected tab named ${String(name)}`);
  await button.first().click();
}

async function expectButtonDownload(page, name, extension) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    clickButton(page, name),
  ]);
  const filename = download.suggestedFilename();
  assert(filename.endsWith(extension), `expected ${name} to download ${extension}; got ${filename}`);
  await download.delete().catch(() => {});
  return filename;
}

async function dismissOnboardingIfOpen(page) {
  const wizard = page.getByTestId("onboarding-wizard");
  if ((await wizard.count()) > 0) {
    const skip = page.getByRole("button", { name: "Skip for now", exact: true });
    if ((await skip.count()) > 0) {
      await skip.click();
      await page.waitForTimeout(250);
    }
  }
}

async function openAdmin(page) {
  await dismissOnboardingIfOpen(page);
  const adminNav = page.locator("nav").getByRole("button", { name: "Admin", exact: true });
  if ((await adminNav.count()) === 1) {
    await adminNav.click();
    await page.waitForTimeout(400);
    return;
  }
  const workspaceAdmin = page.getByRole("button", { name: /Workspace Admin/i });
  if ((await workspaceAdmin.count()) > 0) {
    await workspaceAdmin.first().click();
    await page.waitForTimeout(400);
    return;
  }
  await clickNav(page, "Settings");
  await page.waitForTimeout(400);
}

async function ensureDemoMode(page) {
  await openAdmin(page);
  await expectText(page, "Workspace Mode");
  const demoMode = page.getByRole("button", { name: /Demo sandbox/i });
  assert((await demoMode.count()) === 1, "demo sandbox mode should be available");
  const alreadyDemo = (await page.getByText("Demo sandbox active", { exact: false }).count()) > 0;
  if (!alreadyDemo) {
    await demoMode.click();
    await page.waitForTimeout(900);
    await expectText(page, "Demo workspace loaded");
  } else {
    const liveMode = page.getByRole("button", { name: /Live production/i });
    assert((await liveMode.count()) === 1, "live production mode should be available");
    await liveMode.click();
    await confirmIfVisible(page, "production-mode-confirmation", "Switch to Live Mode");
    await page.waitForTimeout(900);
    await demoMode.click();
    await page.waitForTimeout(900);
    await expectText(page, "Demo workspace loaded");
  }
  await expectText(page, "Demo sandbox");
}

async function restoreCleanProduction(page) {
  await openAdmin(page);
  const reset = page.getByRole("button", { name: "Reset Workspace", exact: true });
  assert((await reset.count()) === 1, "reset workspace should be available");
  await reset.click();
  await confirmIfVisible(page, "reset-workspace-confirmation", "Clear Workspace");
  await page.waitForTimeout(900);
  await expectText(page, "Live production active");
}

async function confirmIfVisible(page, testId, buttonLabel) {
  await page.waitForTimeout(250);
  const modal = page.getByTestId(testId);
  if ((await modal.count()) === 0) return;

  assert((await modal.getAttribute("role")) === "dialog", `${testId} should render as a dialog`);
  assert((await modal.getAttribute("aria-modal")) === "true", `${testId} should mark the background modal`);
  const confirm = modal.getByRole("button", { name: buttonLabel, exact: true });
  assert((await confirm.count()) === 1, `${testId} should expose ${buttonLabel}`);
  await confirm.click();
}

async function exerciseTopBar(page) {
  const search = page.getByPlaceholder(/Search anything/i);
  assert((await search.count()) >= 1, "global search input should exist");
  await search.first().fill("governance");
  await page.waitForTimeout(250);
  assert(
    (await page.getByTestId("command-menu-input").count()) === 1,
    "command menu search input should open from the top bar",
  );
  await expectText(page, "Governance");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await clickButton(page, "Notifications");
  await page.waitForTimeout(250);
  await expectText(page, "Action Inbox");
  await clickButton(page, "Close notifications");
  await page.waitForTimeout(200);

  await clickButton(page, "AI settings");
  await page.waitForTimeout(250);
  await expectText(page, "AI Provider Settings");
  const settingsRail = page.getByTestId("settings-sidebar-scroll");
  assert((await settingsRail.count()) === 1, "settings sidebar should expose a dedicated scroll region");
  const railMetrics = await settingsRail.evaluate((rail) => {
    const before = rail.scrollTop;
    rail.scrollTop = rail.scrollHeight;
    const after = rail.scrollTop;
    rail.scrollTop = before;

    return {
      clientHeight: rail.clientHeight,
      scrollHeight: rail.scrollHeight,
      overflowY: getComputedStyle(rail).overflowY,
      canScroll: rail.scrollHeight <= rail.clientHeight || after > before,
    };
  });
  assert(railMetrics.overflowY === "auto", "settings sidebar must own vertical scrolling");
  assert(railMetrics.canScroll, "settings sidebar scroll region should respond to scroll");
  const settingsNav = page.locator('[data-testid="company-setup-modal"] nav[aria-label="Workspace settings sections"]');
  await settingsNav.getByRole("button", { name: /Identity & access/ }).click();
  await page.waitForTimeout(150);
  await expectText(page, "Identity and access");
  await settingsNav.getByRole("button", { name: /Audit & export/ }).click();
  await page.waitForTimeout(150);
  await expectText(page, "Audit and export");
  await settingsNav.getByRole("button", { name: /AI Provider Settings/ }).click();
  await page.waitForTimeout(150);
  await expectText(page, "OpenAI Base URL");
  await expectText(page, "Anthropic Base URL");
  await expectText(page, "Gemini / Google Base URL");
  await expectText(page, "Kimi / Moonshot");
  await expectText(page, "DeepSeek");
  await clickButton(page, "Save Settings");
  await page.waitForTimeout(300);
  assert((await page.getByText("AI Provider Settings", { exact: true }).count()) === 0, "AI settings modal should close after save");
}

async function exerciseCommandCenter(page) {
  await clickNav(page, "Home");
  await page.waitForTimeout(300);
  await expectText(page, "Enterprise AI Control Tower");
  await expectText(page, "Download packet");
  await expectText(page, "Workflow redesign plays");
  await expectText(page, "AI literacy operating model");
  await expectText(page, "Today's command orders");
  await expectText(page, "Proof needed:");
  const newUseCase = page.locator("main button").filter({ hasText: /New Use Case|New Intake/i });
  if ((await newUseCase.count()) < 1) {
    const buttons = await page.locator("main button").evaluateAll((items) =>
      items.slice(0, 24).map((button) => button.textContent?.trim().replace(/\s+/g, " ") || "[icon]").join(" | "),
    );
    throw new Error(`command center should expose a new use case action; visible buttons: ${buttons}`);
  }
  await newUseCase.first().click();
  await page.waitForTimeout(300);
  await expectText(page, "Use Cases");
  await expectText(page, "Use Case Title");

  await clickNav(page, "Home");
  await page.waitForTimeout(300);
  const briefButton = page.getByRole("button", { name: /Generate executive brief|Generate Exec Brief/i });
  assert((await briefButton.count()) >= 1, "home should expose an executive brief generation action");
  await briefButton.first().click();
  await page.waitForTimeout(300);
  await expectText(page, "Executive brief generated");
  await expectText(page, "Weekly AI Enablement Brief");

  await clickNav(page, "AI Inventory");
  await page.waitForTimeout(350);
  await expectText(page, "AI Control Tower");
  await expectText(page, "Shadow AI Intake");
  await expectText(page, "Agent Permission Graph");
  await expectText(page, "Vendor & Model Risk");

  await clickNav(page, "Home");
  await page.waitForTimeout(250);
}

async function exerciseUseCaseFactory(page) {
  await clickNav(page, "Use Cases");
  await page.waitForTimeout(400);
  await expectText(page, "Factory Operating System");
  const factoryTabExpectations = [
    ["New idea", "Use Case Title"],
    ["Backlog", "Total use cases"],
    ["Prioritize", "Compare value, feasibility, reuse, data readiness, and risk"],
    ["Brief", "Discovery Evidence"],
    ["Pilot", "Pilot Operating Plan"],
    ["Value", "ROI Model"],
    ["Start", "Factory Operating System"],
  ];
  for (const [tab, expectedText] of factoryTabExpectations) {
    await clickTab(page, tab);
    await page.waitForTimeout(150);
    await expectText(page, expectedText);
  }

  await clickTab(page, "New idea");
  await page.waitForTimeout(250);
  await page.getByLabel("Use Case Title").fill("QA Intake Routing Assistant");
  await page.getByLabel("Business Problem").fill("Operations receives repeated routing requests and leaders cannot see cycle-time bottlenecks.");
  await page.getByLabel("Current Process").fill("Requests arrive through email and tickets, then analysts manually classify, route, and follow up.");
  await page.getByLabel("Which function is this for?").selectOption("Operations");
  await clickButton(page, "Next");
  await page.getByLabel("Desired Outcome").fill("Route requests with governed recommendations, citations, and clear owner handoffs.");
  await page.getByLabel("What should AI help with?").fill("Classify incoming requests, draft routing notes, and prepare follow-up tasks.");
  await page.getByLabel("What should AI not do?").fill("Make commitments, send external messages, or change production records without approval.");
  await clickButton(page, "Next");
  await page.getByLabel("Data Sources").fill("ServiceNow metadata, operations SOPs, approved knowledge base.");
  await clickButton(page, "Human review is required");
  await clickButton(page, "Next");
  await page.getByLabel("Monthly Volume").fill("900");
  await page.getByLabel("Avg Handling Time").fill("14");
  await page.getByLabel("Estimated Users").fill("80");
  await clickButton(page, "Next");
  await clickButton(page, "Submit & Score");
  await page.waitForTimeout(500);
  await expectText(page, "Use case submitted and priority score calculated");
  await expectText(page, "QA Intake Routing Assistant");

  await clickTab(page, "Backlog");
  await page.waitForTimeout(300);
  await expectText(page, "Total use cases");
  const backlogPage2 = page.locator("main").getByRole("button", { name: "2", exact: true });
  if ((await backlogPage2.count()) > 0) {
    await backlogPage2.first().click();
    await page.waitForTimeout(250);
    await expectText(page, "Page 2 selected");
    await page.locator("main").getByRole("button", { name: "1", exact: true }).first().click();
    await page.waitForTimeout(250);
    await expectText(page, "Page 1 selected");
  }
  const factoryCrumb = page.locator("main").getByRole("button", { name: "Use Cases", exact: true });
  assert((await factoryCrumb.count()) === 1, "factory parent breadcrumb should be clickable");
  await factoryCrumb.click();
  await page.waitForTimeout(250);
  await expectText(page, "Factory Operating System");
  await clickTab(page, "Backlog");
  await page.waitForTimeout(250);
  const pilotBrief = page.getByRole("button", { name: "Generate Pilot Brief", exact: true });
  if ((await pilotBrief.count()) > 0) {
    await pilotBrief.first().click();
    await page.waitForTimeout(250);
    await expectText(page, "Pilot Plan");
  }
}

async function exerciseSkillsAndHarness(page) {
  await clickNav(page, "AI Skills");
  await page.waitForTimeout(400);
  await expectText(page, "Pattern Marketplace");
  await expectText(page, "AI Skill Catalog");
  await clickButton(page, "Open selected Skill");
  await page.waitForTimeout(300);
  await expectText(page, "Skill launch guide");

  await clickTab(page, "Prompt");
  await page.waitForTimeout(150);
  await expectText(page, "Prompt Contract");
  await clickTab(page, "Setup");
  await page.waitForTimeout(150);
  await expectText(page, "Runtime Contract");
  await clickTab(page, "Tools");
  await page.waitForTimeout(150);
  const toolRows = page
    .locator('main button[aria-label^="Toggle tool"]')
    .filter({ hasText: "Approval" });
  if ((await toolRows.count()) > 0) {
    await toolRows.first().click();
    await page.waitForTimeout(250);
    await expectText(page, "Tool policy updated");
  }
  await clickTab(page, "Knowledge");
  await page.waitForTimeout(150);
  await expectText(page, "Context Source Catalog");
  const attachSource = page.getByRole("button", { name: "Attach Source", exact: true });
  if ((await attachSource.count()) > 0) {
    await attachSource.first().click();
    await page.waitForTimeout(250);
    await expectText(page, "attached to the Skill contract");
  }
  await clickButton(page, "Run Permission Simulation");
  await page.waitForTimeout(250);
  await expectText(page, "Permission simulation");
  await clickTab(page, "Quality");
  await page.waitForTimeout(150);
  await expectText(page, "Launch Evaluation Matrix");
  await clickTab(page, "Value");
  await page.waitForTimeout(150);
  await expectText(page, "Measurement Contract");
  await clickTab(page, "Runs");
  await page.waitForTimeout(150);
  await expectText(page, /run history|No runs for this Skill yet/i);

  await clickTab(page, "Spec");
  await page.waitForTimeout(150);
  await clickButton(page, "Copy YAML");
  await page.waitForTimeout(300);
  await expectText(page, /SkillSpec YAML (copied|downloaded)/);
  await clickTab(page, "Versions");
  await page.waitForTimeout(150);
  await expectText(page, "Current live configuration");

  await clickButton(page, "Run quality checks");
  await page.waitForTimeout(300);
  await expectText(page, "Eval suite completed");
  const runSkillTest = page.getByRole("button", { name: "Run test", exact: true });
  const runSkillTestCount = await runSkillTest.count();
  assert(runSkillTestCount >= 1, "expected Run test action");
  let sessionOpened = false;
  for (let index = 0; index < runSkillTestCount; index += 1) {
    await runSkillTest.nth(index).click();
    await page.waitForURL(/view=session/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    sessionOpened =
      new URL(page.url()).searchParams.get("view") === "session" ||
      (await page.getByText("Skill session", { exact: false }).count()) > 0;
    if (sessionOpened) break;
  }
  assert(sessionOpened, "Run test should open a Skill session");
  await page.waitForTimeout(500);
  await expectText(page, "Skill session");
  await expectText(page, "Harness trace");
  await expectText(page, "Current answer");

  const traceLink = page.getByRole("button", { name: "View full trace", exact: true });
  assert((await traceLink.count()) === 1, "skill session should expose full trace action");
  await traceLink.click();
  await page.waitForTimeout(500);
  await expectText(page, "Execution Trace");
  await clickNav(page, "AI Harness");
  await page.waitForTimeout(400);
  await expectText(page, "Agent Identity Governance");
}

async function exerciseWorkflowBuilder(page) {
  await clickNav(page, "Workflow Builder");
  await page.waitForTimeout(400);
  await expectText(page, "Workflow Builder");
  await clickButton(page, "Advanced canvas");
  await page.waitForTimeout(400);
  await expectText(page, "Saved to workspace");
  const workflowCrumb = page.locator("main").getByRole("button", { name: "Workflow Builder", exact: true });
  assert((await workflowCrumb.count()) === 1, "workflow parent breadcrumb should be clickable");
  await workflowCrumb.click();
  await page.waitForTimeout(250);
  await expectText(page, "Workflow Builder");
  await clickButton(page, "Advanced canvas");
  await page.waitForTimeout(300);

  const knowledgeTemplate = page.locator("main").getByRole("button", { name: "Knowledge", exact: true });
  if ((await knowledgeTemplate.count()) > 0) {
    await knowledgeTemplate.click();
    await page.waitForTimeout(350);
    await expectText(page, "Workflow template loaded");
  }

  await clickButton(page, "Spec");
  await page.waitForTimeout(200);
  await expectText(page, "WorkflowSpec");
  await expectButtonDownload(page, "Download spec", ".json");
  await expectText(page, "Workflow spec downloaded");
  await clickButton(page, "Validate");
  await page.waitForTimeout(250);
  await expectText(page, "Workflow validated");
  await clickButton(page, "Test Run");
  await page.waitForTimeout(700);
  await expectText(page, "Workflow test completed");
  await clickButton(page, "Publish");
  await page.waitForTimeout(300);
  await expectText(page, "Workflow published");
  for (const tab of ["Runs", "Versions", "Settings", "Builder"]) {
    await clickTab(page, tab);
    await page.waitForTimeout(150);
  }
}

async function exerciseBrokerContextEvalsGovernance(page) {
  await clickNav(page, "Tool Permissions");
  await page.waitForTimeout(350);
  await expectText(page, "Connector Control Plane");
  const approve = page.getByRole("button", { name: "Approve", exact: true });
  if ((await approve.count()) > 0) {
    await approve.first().click();
    await page.waitForTimeout(300);
    await expectText(page, "Approval granted");
  }

  await clickNav(page, "Knowledge Sources");
  await page.waitForTimeout(300);
  await expectText(page, "Retrieval Test");
  await page.getByLabel("Knowledge check question").fill("Which approved sources would answer PTO or routing policy questions?");
  await clickButton(page, "Run safe retrieval test");
  await page.waitForTimeout(300);
  await expectText(page, "Retrieval test completed");

  await clickNav(page, "Quality Evals");
  await page.waitForTimeout(300);
  await expectText(page, "Quality Evals");
  await clickButton(page, "Run evals");
  await page.waitForTimeout(300);
  await expectText(page, "Eval suite completed");

  await clickNav(page, "Risk Review");
  await page.waitForTimeout(300);
  await expectText(page, "Compliance Packs");
  await expectText(page, "AI Incident Response");
  await expectText(page, "Risk Taxonomy");
  const openRiskReview = page.getByTestId("compliance-pack-action-nist-ai-rmf");
  assert((await openRiskReview.count()) === 1, "NIST compliance pack should expose a direct Open Risk Review action");
  await openRiskReview.click();
  await page.waitForTimeout(300);
  assert(await page.getByTestId("governance-primary-decision").isVisible(), "Open Risk Review should focus the active governance decision panel");
  const conditions = page.getByRole("button", { name: "Approve with Conditions", exact: true });
  if ((await conditions.count()) > 0) {
    await conditions.first().click();
    await page.waitForTimeout(300);
    await expectText(page, "Skill approved with conditions");
  }
}

async function exerciseExportSurfaces(page) {
  await clickNav(page, "Proof Ledger");
  await page.waitForTimeout(300);
  await expectText(page, "Live Ledger");
  await expectText(page, "Evidence Graph");
  await expectButtonDownload(page, "Export JSON", ".json");
  await page.waitForTimeout(200);
  await expectText(page, "Evidence ledger export JSON staged for download");
  const sourceRecord = page.getByRole("button", { name: "Open Source Record", exact: true });
  assert((await sourceRecord.count()) === 1, "evidence source record action should be available");
  await sourceRecord.click();
  await page.waitForTimeout(350);
  const sourceRecordStayedInLedger =
    new URL(page.url()).searchParams.get("view") === "evidence" &&
    (await page.getByText(/native ledger audit event|full provenance/i).count()) > 0;
  const sourceRecordOpenedView = new URL(page.url()).searchParams.get("view") !== "evidence";
  assert(sourceRecordStayedInLedger || sourceRecordOpenedView, "Open Source Record should navigate or show native ledger provenance");

  await openAdmin(page);
  await expectText(page, "Workspace Operations");
  const workspaceExportFilename = await expectButtonDownload(page, "Export Workspace", ".json");
  assert(workspaceExportFilename.includes("workspace-export"), `workspace export filename should identify the packet; got ${workspaceExportFilename}`);
  await page.waitForTimeout(300);
}

async function exerciseReportsAndOrchestrator(page) {
  await clickNav(page, "Value & ROI");
  await page.waitForTimeout(250);
  await expectText(page, "Finance-Grade Value Controls");
  await expectText(page, "Use Case Economics");
  await clickNav(page, "Adoption Plan");
  await page.waitForTimeout(250);
  await expectText(page, "AI Literacy Tracks");
  await expectText(page, "Adoption Campaigns");

  await clickNav(page, "Reports");
  await page.waitForTimeout(300);
  await clickButton(page, "Generate Report");
  await page.waitForTimeout(300);
  await expectText(page, "Executive brief generated");
  await clickButton(page, "Copy");
  await page.waitForTimeout(300);
  await expectText(page, /Report copied to clipboard|report markdown downloaded/i);
  await expectButtonDownload(page, "Stage PDF Export", ".html");
  await page.waitForTimeout(300);
  await expectText(page, "Printable report package downloaded");

  await clickNav(page, "AI Assistant");
  await page.waitForTimeout(400);
  const composer = page.getByTestId("orchestrator-composer");
  assert((await composer.count()) === 1, "orchestrator composer should exist");
  const textarea = composer.locator("textarea");
  assert((await textarea.count()) === 1, "orchestrator composer should expose one textarea");
  await textarea.fill("What is the next best action for this workspace?");
  await page.getByTestId("orchestrator-send-button").click();
  await page.waitForTimeout(900);
  await expectText(page, "AI Assistant");
  await expectText(page, "Recommended move");
  await expectText(page, "Action plan");
  await textarea.fill("Guide connector setup");
  await page.getByTestId("orchestrator-send-button").click();
  await page.waitForTimeout(900);
  await expectText(page, "Connector posture:");
  await expectText(page, "Open Connect Apps");

  await textarea.fill("Capture a work signal");
  await page.getByTestId("orchestrator-send-button").click();
  await page.waitForTimeout(900);
  await expectText(page, "Work signal form:");
  await textarea.fill("Finance AP invoice exceptions repeat 800 times per month, each takes 20 minutes, source is Coupa and SharePoint, aggregate only with no individual scoring.");
  await page.getByTestId("orchestrator-send-button").click();
  await page.waitForTimeout(900);
  await expectText(page, "privacy-safe aggregate signal");
  const signalActions = page.getByText("3 actions", { exact: true });
  assert((await signalActions.count()) >= 1, "work signal capture should expose an action drawer");
  await signalActions.last().click();
  const captureSignal = page.getByRole("button", { name: /Capture work signal/ });
  assert((await captureSignal.count()) === 1, "work signal capture action should be available");
  await captureSignal.click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Work Signals"),
    null,
    { timeout: 8000 },
  );
  await expectText(page, "invoice exceptions");
  await expectText(page, "Individual scoring");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const nativeDialogs = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("dialog", (dialog) => {
    nativeDialogs.push({ type: dialog.type(), message: dialog.message() });
    dialog.accept();
  });

  await page.goto(`${baseUrl}/?flow-smoke=${Date.now()}`, { waitUntil: "load" });
  await page.waitForTimeout(900);

  await ensureDemoMode(page);
  await exerciseTopBar(page);
  await exerciseCommandCenter(page);
  await exerciseUseCaseFactory(page);
  await exerciseSkillsAndHarness(page);
  await exerciseWorkflowBuilder(page);
  await exerciseBrokerContextEvalsGovernance(page);
  await exerciseExportSurfaces(page);
  await exerciseReportsAndOrchestrator(page);
  await restoreCleanProduction(page);

  assert(consoleErrors.length === 0, `browser console errors: ${consoleErrors.slice(0, 5).join("\n")}`);
  assert(nativeDialogs.length === 0, `native browser dialogs should not appear in flow smoke: ${JSON.stringify(nativeDialogs)}`);
  await browser.close();

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    checked: [
      "top bar command menu",
      "notifications drawer",
      "AI settings modal",
      "command center actions",
      "command center command orders",
      "use case intake submit and score",
      "factory tabs, backlog, and pagination",
      "skill detail tabs",
      "skill runs and versions tabs",
      "SkillSpec YAML copy/export fallback",
      "skill eval and test run",
      "skill session trace link",
      "workflow template, spec, validate, test, publish",
      "MCP broker approval",
      "context retrieval test",
      "evaluation suite run",
      "governance decision",
      "compliance pack Open Risk Review action",
      "evidence ledger JSON export",
      "evidence source record action",
      "workspace JSON export",
      "metrics, training, reports, and printable export",
      "orchestrator send",
      "orchestrator connector setup command",
      "orchestrator work signal capture",
      "workspace cleanup confirmations",
      "workspace reset to live production",
      "browser console clean",
    ],
  }, null, 2));
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
