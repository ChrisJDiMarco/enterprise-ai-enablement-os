import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3002";
const smokeTenantId = process.env.SMOKE_ORG_ID || `ui-smoke-org-${Date.now()}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 820 },
    extraHTTPHeaders: { "X-EAIEOS-Tenant": smokeTenantId },
  });
  const consoleErrors = [];
  const chartWarnings = [];
  const resourceErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
    if (message.type() === "warning" && message.text().includes("width(-1) and height(-1) of chart")) {
      chartWarnings.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      resourceErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto(`${baseUrl}/?ui-smoke=${Date.now()}`, { waitUntil: "load" });
  await page.waitForTimeout(1000);

  await exerciseGuidedSetup(page);
  await expectNav(page, "Home");
  await expectText(page, "What to do next");
  await expectAnyText(page, [
    "Capture the first work signal",
    "Shape the first AI opportunity",
    "Build the first AI Skill",
    "Map the workflow before launch",
    "Run the first governed test",
    "Run the launch quality checks",
    "Clear the risk review",
    "Package the proof for reviewers",
    "Measure value and draft the brief",
    "Brief leaders and scale the pattern",
  ]);
  await expectText(page, "Proof status");
  await expectText(page, "Top Priority Use Cases");
  await expectText(page, "Upcoming Governance Reviews");
  await exerciseActionInbox(page);
  await exerciseHelpWalkthrough(page);
  await exerciseWorkspaceProfileMenu(page);
  await clickNav(page, "AI Inventory");
  await page.waitForTimeout(400);
  await expectText(page, "AI Inventory");
  await expectText(page, "inventory control plane");
  await expectText(page, "Inventory map");
  await expectText(page, "Full registry");
  await expectText(page, "Inventory Standard");
  await expectDataTables(page, ["AI estate registry"]);

  await clickNav(page, "Connect Apps");
  await page.waitForTimeout(400);
  await expectText(page, "Connector Setup");
  await expectText(page, "Connect Slack");
  await expectText(page, "Implementation playbook");
  await expectText(page, "Tenant vault");
  await expectText(page, "Day-One Stack Plan");
  await expectText(page, "Provider Defaults");
  await expectDataTables(page, ["Enterprise connector setup catalog"]);

  await clickNav(page, "AI Roadmap");
  await page.waitForTimeout(300);
  await expectText(page, "Enterprise AI Roadmap");
  await expectText(page, "Director Operating Loop");

  await clickNav(page, "Process Redesign");
  await page.waitForTimeout(300);
  await expectText(page, "Turn a use case into a clear human and AI workflow before anything launches.");

  await clickNav(page, "Workflow Builder");
  await page.waitForTimeout(500);
  await expectText(page, "Turn an approved Skill into a clear, testable execution plan");
  await expectText(page, "Workflow health");
  await expectText(page, "How this becomes safe to run");
  await expectText(page, "Templates, readiness details, and Harness contract");

  const openBuilder = page.getByRole("button", { name: "Advanced canvas", exact: true });
  assert((await openBuilder.count()) === 1, "workflow overview should expose an Advanced canvas action");
  await openBuilder.click();
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

  await clickNav(page, "Settings");
  await page.waitForTimeout(500);
  await expectText(page, "Production Readiness");
  await expectText(page, "Primetime Launch Gate");
  await expectText(page, "Enterprise AI OS Maturity");
  await expectText(page, "Workspace Mode");
  await expectText(page, "Live production active");
  await expectText(page, "Tenant Branding");
  await expectText(page, "Workspace Operations");
  await expectText(page, "Production Cutover Sequence");
  await expectText(page, "Launch Fix List");
  await expectText(page, "Copy Checklist");
  await expectText(page, "Copy Env Template");
  await expectText(page, "Team & Access");
  await expectText(page, "Invite or Update Member");

  await page.getByPlaceholder("Jane Smith").fill("Smoke Reviewer");
  await page.getByPlaceholder("jane.smith@company.com").fill("smoke.reviewer@example.com");
  await page.getByPlaceholder("Security Reviewer").fill("Security Reviewer");
  const addMember = page.getByRole("button", { name: "Add Member", exact: true });
  assert((await addMember.count()) === 1, "admin should expose an Add Member action");
  await addMember.click();
  await page.waitForTimeout(500);
  await page.getByTestId("member-search").fill("smoke.reviewer@example.com");
  await expectText(page, "Smoke Reviewer");
  const removeMember = page.getByTestId("remove-member-user-smoke-reviewer-example-com");
  assert((await removeMember.count()) === 1, "admin should expose a scoped Remove action for the staged tenant member");
  await removeMember.click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="remove-member-user-smoke-reviewer-example-com"]'), null, { timeout: 4000 });
  assert((await page.getByTestId("remove-member-user-smoke-reviewer-example-com").count()) === 0, "admin member remove action should remove the staged tenant member");

  const companyInput = page.getByLabel("Company Name");
  assert((await companyInput.count()) === 1, "company name field should be accessible by label");
  const primaryColor = page.getByLabel("Tenant primary color");
  assert((await primaryColor.count()) === 1, "tenant primary color field should be accessible by label");

  const demoMode = page.getByRole("button", { name: /Demo sandbox/i });
  assert((await demoMode.count()) === 1, "admin demo sandbox mode should be available");
  await demoMode.click();
  await page.waitForTimeout(800);
  await expectText(page, "Demo workspace loaded");

  await clickNav(page, "Company Plan");
  await page.waitForTimeout(500);
  await expectText(page, "This is how the company should implement AI");
  await expectText(page, "Activation Modes");
  await expectText(page, "Executive Decision Packet");
  await expectText(page, "Function Rollout Map");
  await expectText(page, "90-Day Implementation Path");
  const blueprintExport = page.getByRole("button", { name: "Export", exact: true });
  assert((await blueprintExport.count()) === 1, "company blueprint should expose one export action");
  const blueprintExportFilename = await expectButtonDownload(page, "Export", ".json");
  assert(
    blueprintExportFilename.includes("ai-blueprint"),
    `blueprint export filename should identify the artifact; got ${blueprintExportFilename}`,
  );
  await page.waitForTimeout(300);
  await expectText(page, "Blueprint JSON exported as");
  assert(
    (await page.getByTestId("blueprint-export-status").count()) === 1,
    "company blueprint export should expose an accessible status confirmation",
  );
  await assertVisibleButtonsAreNamed(page, "Company Blueprint");

  await clickNav(page, "Use Cases");
  await page.waitForTimeout(500);
  await expectText(page, "Factory Operating System");
  await expectText(page, "Priority Queue");
  await expectText(page, "Scoring Model");
  await clickTab(page, "Backlog");
  await page.waitForTimeout(400);
  await expectText(page, "Discover, evaluate, and prioritize AI opportunities");
  await expectText(page, "Total use cases");
  await expectDataTables(page, ["Use case opportunity backlog"]);

  await clickNav(page, "Work Signals");
  await page.waitForTimeout(500);
  await expectText(page, "Work Signals");
  await expectText(page, "Signal health");
  await expectText(page, "Signal-to-use-case proof path");
  await expectText(page, "Other ranked opportunities and decisions");
  await expectText(page, "Privacy guardrails and signal details");
  await page.getByText("Privacy guardrails and signal details", { exact: true }).click();
  await page.waitForTimeout(200);
  await expectDataTables(page, [
    "Privacy-filtered work signal ledger",
    "Adaptive Skill learning recommendations",
  ]);
  const promoteSignal = page.getByTestId("work-primary-opportunity").getByRole("button", { name: "Create use case", exact: true });
  assert((await promoteSignal.count()) === 1, "work signals should promote a signal into intake");
  await promoteSignal.click();
  await page.waitForTimeout(500);
  await expectText(page, "Use Cases");
  await expectText(page, "AI-generated brief");
  await expectText(page, "Submit & Score");

  await clickNav(page, "AI Skills");
  await page.waitForTimeout(500);
  await expectText(page, "AI Skills");
  await expectText(page, "Skill health");
  await expectText(page, "What makes this reusable?");
  await expectText(page, "Reusable templates and advanced marketplace");
  await expectText(page, "Pattern Marketplace");
  await expectText(page, "Activation plan");
  await expectText(page, "Skill catalog and portfolio diagnostics");
  await expectText(page, "AI Skill Catalog");
  await expectText(page, "Skill readiness checklist");
  await expectText(page, "Function Coverage");

  await clickNav(page, "Tool Permissions");
  await page.waitForTimeout(500);
  await expectText(page, "Connector Control Plane");
  await expectText(page, "Execution Ecosystem");
  await expectText(page, "Tool Requests Queue");
  await expectDataTables(page, ["MCP Broker tool catalog", "MCP Broker audit log"]);

  await clickNav(page, "Knowledge Sources");
  await page.waitForTimeout(500);
  await expectText(page, "Permission Simulation");
  await expectText(page, "Knowledge Gaps");

  await clickNav(page, "Quality Evals");
  await page.waitForTimeout(500);
  await expectText(page, "Quality Evals");
  await expectText(page, "Quality health");
  await expectText(page, "Quality path and proof");
  await expectText(page, "Skill quality report and fix list");
  await expectText(page, "Advanced eval monitors, coverage, and red-team example");
  await page.getByText("Skill quality report and fix list", { exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByText("Advanced eval monitors, coverage, and red-team example", { exact: true }).click();
  await page.waitForTimeout(200);
  await expectText(page, "Continuous eval and drift monitor");
  await expectText(page, "Evaluation coverage");
  await expectText(page, "Latest results");
  await expectDataTables(page, ["Quality eval report by Skill", "Continuous evaluation drift monitors"]);

  await clickNav(page, "Risk Review");
  await page.waitForTimeout(500);
  await expectText(page, "Risk Taxonomy");
  await expectText(page, "Approval Matrix");

  await clickNav(page, "Value & ROI");
  await page.waitForTimeout(500);
  await expectText(page, "Use Case Economics");

  await clickNav(page, "Adoption");
  await page.waitForTimeout(500);
  await expectText(page, "Adoption Campaigns");
  await expectText(page, "Office Hours");

  await clickNav(page, "Reports");
  await page.waitForTimeout(500);
  await expectText(page, "Briefing Workflow");

  await clickNav(page, "Run Tests");
  await page.waitForTimeout(500);
  await expectText(page, "Run Tests");
  await expectText(page, "What this test evidence proves");
  await expectText(page, "Run ledger and approval queue");
  await expectText(page, "Advanced controls, security operations, and identity governance");
  await page.getByText("Run ledger and approval queue", { exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByText("Advanced controls, security operations, and identity governance", { exact: true }).click();
  await page.waitForTimeout(200);
  await expectText(page, "Recent test results");
  await expectText(page, "Harness pipeline");
  await expectText(page, "Agent Ops Blueprint");
  await expectText(page, "Agent identity governance");
  await expectDataTables(page, ["Recent Harness test runs", "Agent identity governance records"]);

  const viewRuns = page.getByTestId("harness-primary-decision").getByRole("button", { name: "Run history", exact: true });
  assert((await viewRuns.count()) === 1, "AI Harness should expose a Run history action");
  await viewRuns.click();
  await page.waitForTimeout(500);
  await expectText(page, "Harness Runs");
  await expectText(page, "run-1001");
  await expectDataTables(page, ["Harness runs ledger"]);

  const run1001 = page.getByRole("button", { name: "run-1001", exact: true });
  assert((await run1001.count()) === 1, "run-1001 should be clickable from the Harness runs ledger");
  await run1001.click();
  await page.waitForTimeout(500);
  await expectText(page, "Run 1001");
  await expectText(page, "Execution Trace");
  await expectText(page, "David Chen");
  const harnessRunTabs = [
    ["Prompt", "Prompt Assembly"],
    ["Context", "Context Packet"],
    ["Tool Calls", "Tool Calls"],
    ["Security", "Agent Security Operations"],
    ["Approvals", "Approval Queue"],
    ["Output", "Run Output"],
    ["Evaluations", "Evaluation Snapshot"],
    ["Logs", "Runtime Logs"],
    ["Trace", "Execution Trace"],
  ];
  for (const [tabLabel, expectedText] of harnessRunTabs) {
    await clickTabContaining(page, tabLabel);
    await page.waitForTimeout(120);
    await expectText(page, expectedText);
  }

  await clickNav(page, "AI Assistant");
  await page.waitForTimeout(500);
  await expectText(page, "AI Assistant");
  await expectText(page, "What can you do?");
  await expectText(page, "Proof used");
  await expectText(page, "actions");
  await page.getByTestId("orchestrator-context-drawer").locator("summary").click();
  await page.waitForTimeout(200);
  await expectText(page, "Recommended move");
  await expectText(page, "Workspace health");
  await expectText(page, "Progress path");
  await expectText(page, "Helpful shortcuts");
  const orchestratorLayout = await page.evaluate(() => {
    const textarea = document.querySelector('textarea[placeholder^="Ask for the next move"]');
    const form = textarea?.closest("form");
    const messageScroller = Array.from(document.querySelectorAll("main *")).find((element) => {
      const className = String(element.getAttribute("class") || "");
      return className.includes("overflow-y-auto") && className.includes("bg-slate-50");
    });
    const formRect = form?.getBoundingClientRect();
    const scrollerStyle = messageScroller ? getComputedStyle(messageScroller) : null;

    return {
      hasRedundantPageHeading: Array.from(document.querySelectorAll("h1")).some((element) => element.textContent?.trim() === "AI Assistant" && !element.closest("header")),
      formVisible: Boolean(formRect && formRect.top >= 0 && formRect.bottom <= window.innerHeight + 1),
      formFlushToViewportBottom: Boolean(formRect && Math.abs(window.innerHeight - formRect.bottom) <= 1),
      pageCanScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight + 4,
      messageScrollerOverflow: scrollerStyle?.overflowY,
    };
  });
  assert(!orchestratorLayout.hasRedundantPageHeading, "AI Assistant should not render a redundant page heading above the console");
  assert(orchestratorLayout.formVisible, "AI Assistant composer must stay visible in the viewport");
  assert(orchestratorLayout.formFlushToViewportBottom, "AI Assistant composer should sit at the bottom of the viewport");
  assert(!orchestratorLayout.pageCanScroll, "AI Assistant page should not require document scrolling to reach the composer");
  assert(orchestratorLayout.messageScrollerOverflow === "auto", "AI Assistant transcript should own vertical scrolling");

  await clickNav(page, "Settings");
  await page.waitForTimeout(500);
  const liveMode = page.getByRole("button", { name: /Live production/i });
  assert((await liveMode.count()) === 1, "admin live production mode should be available");
  await liveMode.click();
  await page.waitForTimeout(1200);
  await expectText(page, "Live production active");

  assert(
    consoleErrors.length === 0,
    `browser console errors: ${consoleErrors.slice(0, 3).join("\n")}\nresources: ${resourceErrors.slice(0, 3).join("\n")}`,
  );
  assert(chartWarnings.length === 0, `chart container warnings: ${chartWarnings.slice(0, 3).join("\n")}`);
  await browser.close();

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    checked: [
      "shell navigation",
      "guided setup concierge",
      "post-generation launch handoff",
      "help walkthrough modal",
      "workspace profile menu",
      "hubbed operating navigation",
      "company blueprint implementation map",
      "company blueprint launch modes",
      "company blueprint decision packet",
      "company blueprint JSON export",
      "command center launch checklist",
      "command center market benchmark radar",
      "command center enterprise maturity model",
      "company integration blueprint",
      "action inbox notification center",
      "AI estate registry",
      "AI estate external inventory intake",
      "connector setup path",
      "connector setup activation command center",
      "connector setup day-one stack plan",
      "connector setup catalog",
      "strategy roadmap surface",
      "process redesign surface",
      "workflow studio overview",
      "workflow studio independent palette scroll",
      "admin branding controls",
      "admin readiness panel",
      "admin production cutover sequence",
      "admin team access member management",
      "admin primetime launch gate",
      "admin launch fix list",
      "admin maturity panel",
      "admin live/demo workspace mode",
      "demo workspace load",
      "use case factory overview",
      "use case factory backlog",
      "work intelligence radar",
      "work intelligence privacy guardrails",
      "skills library overview",
      "skills pattern marketplace",
      "MCP broker control plane",
      "MCP broker execution ecosystem",
      "context fabric permission simulation",
      "continuous eval drift monitor",
      "evaluations coverage",
      "governance taxonomy",
      "metrics ROI economics",
      "training adoption campaigns",
      "reports briefing workflow",
      "AI Harness overview",
      "AI Harness agent ops blueprint",
      "AI Harness agent identity governance",
      "AI Harness runs ledger",
      "AI Harness run detail",
      "AI Harness run detail tabs",
      "orchestrator surface",
      "orchestrator customer launch path",
      "orchestrator viewport-fit composer",
      "orchestrator internal transcript scroll",
      "smoke restores live production mode",
      "browser console clean",
    ],
  }, null, 2));
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

async function clickTabContaining(page, text, scope = page.locator("main")) {
  const tab = scope.getByRole("tab").filter({ hasText: text });
  if ((await tab.count()) > 0) {
    await tab.first().click();
    return;
  }

  const button = scope.getByRole("button").filter({ hasText: text });
  const count = await button.count();
  assert(count >= 1, `expected tab containing ${String(text)}`);
  await button.first().click();
}

async function expectButtonDownload(page, name, extension, options = {}) {
  const button = page.getByRole("button", { name, exact: options.exact ?? true });
  const count = await button.count();
  assert(count >= 1, `expected download button named ${String(name)}`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    button.first().click(),
  ]);
  const filename = download.suggestedFilename();
  assert(filename.endsWith(extension), `expected ${String(name)} to download ${extension}; got ${filename}`);
  await download.delete().catch(() => {});
  return filename;
}

async function assertVisibleButtonsAreNamed(page, surface) {
  const unnamedButtons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .filter((button) => {
        const style = window.getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
        if (!visible) return false;

        const name =
          button.textContent?.trim() ||
          button.getAttribute("aria-label") ||
          button.getAttribute("title");
        return !name?.trim();
      })
      .map((button) => button.outerHTML.slice(0, 180)),
  );

  assert(unnamedButtons.length === 0, `${surface} has visible unnamed buttons: ${unnamedButtons.join("\n")}`);
}

async function expectDataTables(page, expectedCaptions) {
  const result = await page.evaluate((captions) => {
    const tables = Array.from(document.querySelectorAll("table"));
    const labels = tables.map((table) => table.getAttribute("aria-label") || table.querySelector("caption")?.textContent?.trim() || "");
    const genericLabels = labels.filter((label) => !label || label === "Data table");
    const unscopedHeaders = tables.reduce((total, table) => {
      return total + Array.from(table.querySelectorAll("th")).filter((header) => header.getAttribute("scope") !== "col").length;
    }, 0);
    const recordFooters = Array.from(document.querySelectorAll("div"))
      .map((node) => node.textContent?.trim() || "")
      .filter((text) => /^Showing \d/.test(text));

    return {
      labels,
      missingCaptions: captions.filter((caption) => !labels.includes(caption)),
      genericLabels,
      unscopedHeaders,
      recordFooters,
      hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    };
  }, expectedCaptions);

  assert(result.missingCaptions.length === 0, `missing table captions: ${result.missingCaptions.join(", ")}`);
  assert(result.genericLabels.length === 0, `generic or missing table labels: ${result.labels.join(", ")}`);
  assert(result.unscopedHeaders === 0, "all table headers should use scope=col");
  assert(result.recordFooters.length >= expectedCaptions.length, "tables should expose visible record counts");
  assert(!result.hasHorizontalOverflow, "tables should not create page-level horizontal overflow");
}

async function expectNav(page, name) {
  const navItem = navButton(page, name);
  let count = await navItem.count();
  if (count === 0) {
    await expandAllNavHubs(page);
    count = await navItem.count();
  }
  assert(count === 1, `missing nav item named ${name}`);
}

async function expandAllNavHubs(page) {
  const allSections = page.getByTestId("nav-all-sections");
  if ((await allSections.count()) === 1) {
    const isOpen = await allSections.evaluate((element) => element.hasAttribute("open"));
    if (!isOpen) {
      await allSections.locator("summary").click();
      await page.waitForTimeout(100);
    }
  }
  const hubs = page.locator('nav [data-testid^="nav-hub-"]');
  const count = await hubs.count();
  for (let index = 0; index < count; index += 1) {
    const hub = hubs.nth(index);
    if (!(await hub.isVisible())) {
      continue;
    }
    if ((await hub.getAttribute("aria-expanded")) !== "true") {
      await hub.click();
    }
  }
}

async function exerciseGuidedSetup(page) {
  let wizard = page.getByTestId("onboarding-wizard");
  if ((await wizard.count()) === 0) {
    const setupButton = page.getByTestId("guided-setup-nav");
    assert((await setupButton.count()) === 1, "guided setup should be reachable from the shell");
    await setupButton.click();
    await page.waitForTimeout(300);
    wizard = page.getByTestId("onboarding-wizard");
  }
  assert((await wizard.count()) === 1, "guided setup wizard should open");
  await expectText(page, "Set up your AI workspace");
  await expectText(page, "Setup preview");
  await expectText(page, "Start with a pilot");
  await expectText(page, "Privacy stance");
  const skip = page.getByRole("button", { name: "Skip for now", exact: true });
  assert((await skip.count()) === 1, "guided setup should expose a safe skip action");
  await skip.click();
  await page.waitForTimeout(300);
  assert((await page.getByTestId("onboarding-wizard").count()) === 0, "guided setup should close cleanly");

  const setupButton = page.getByTestId("guided-setup-nav");
  await setupButton.click();
  await page.waitForTimeout(300);
  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForTimeout(150);
  }
  await page.getByRole("button", { name: /Generate workspace/i }).click();
  await page.waitForTimeout(600);

  const handoff = page.getByTestId("launch-handoff");
  assert((await handoff.count()) === 1, "workspace generation should open a launch handoff");
  await expectText(page, "Launch this workspace without guessing");
  await expectText(page, "Do this next");
  await expectText(page, "First work session");
  await expectText(page, "Reviewer proof packet");
  await expectText(page, "Launch packet");

  const closeHandoff = page.getByRole("button", { name: "Close launch handoff", exact: true });
  assert((await closeHandoff.count()) === 1, "launch handoff should expose a close action");
  await closeHandoff.click();
  await page.waitForTimeout(300);
  assert((await page.getByTestId("launch-handoff").count()) === 0, "launch handoff should close cleanly");
}

async function exerciseHelpWalkthrough(page) {
  const help = page.getByRole("button", { name: "Help", exact: true });
  assert((await help.count()) === 1, "top bar help action should be available");
  await help.click();
  await page.waitForTimeout(300);

  const guide = page.getByTestId("help-walkthrough");
  assert((await guide.count()) === 1, "help walkthrough should open");
  await expectText(page, "What are you trying to do?");
  await expectText(page, "The simple path");
  await expectText(page, "Plain-English glossary");
  await expectText(page, "Still not sure?");

  const close = guide.getByRole("button", { name: "Close help", exact: true });
  assert((await close.count()) === 1, "help walkthrough should expose close action");
  await close.click();
  await page.waitForTimeout(200);
  assert((await page.getByTestId("help-walkthrough").count()) === 0, "help walkthrough should close");
}

async function exerciseActionInbox(page) {
  const notifications = page.getByRole("button", { name: "Notifications", exact: true });
  assert((await notifications.count()) === 1, "top bar notifications action should be available");
  await notifications.click();
  await page.waitForTimeout(300);

  await expectText(page, "Needs attention");
  await expectText(page, "Start with the first item");
  await expectText(page, "do now");

  const close = page.getByRole("button", { name: "Close notifications", exact: true });
  assert((await close.count()) === 1, "action inbox should expose a close action");
  await close.click();
  await page.waitForTimeout(200);
  assert((await page.locator('section[aria-label="Notifications"]').count()) === 0, "action inbox should close cleanly");
}

async function exerciseWorkspaceProfileMenu(page) {
  const profile = page.getByRole("button", { name: "Workspace profile", exact: true });
  assert((await profile.count()) === 1, "top bar workspace profile action should be available");
  await profile.click();
  await page.waitForTimeout(250);

  const menu = page.getByTestId("workspace-profile-menu");
  assert((await menu.count()) === 1, "workspace profile menu should open");
  await expectText(page, "Workspace Admin");
  await expectText(page, "Company setup");
  await expectText(page, "This menu controls the current workspace shell");

  await menu.getByRole("button", { name: "Workspace admin", exact: true }).click();
  await page.waitForTimeout(300);
  await expectText(page, "Tenant Branding");
  assert((await page.getByTestId("workspace-profile-menu").count()) === 0, "workspace profile menu should close after navigation");
}

async function expectText(page, text) {
  const locator = page.getByText(text, { exact: false });
  assert((await locator.count()) > 0, `missing visible text: ${text}`);
}

async function expectAnyText(page, options) {
  for (const text of options) {
    if ((await page.getByText(text, { exact: false }).count()) > 0) return;
  }
  throw new Error(`missing one of visible texts: ${options.join(", ")}`);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
