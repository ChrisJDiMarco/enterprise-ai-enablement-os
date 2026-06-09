import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3002";
const smokeTenantId = process.env.SMOKE_ORG_ID || `ui-smoke-org-${Date.now()}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isExpectedSmokeHttpFailure(status, url) {
  try {
    const responseUrl = new URL(url);
    const expectedOrigin = new URL(baseUrl).origin;
    if (responseUrl.origin !== expectedOrigin) return false;

    return (
      (status === 401 && responseUrl.pathname === "/api/workspace") ||
      (status === 403 && responseUrl.pathname === "/api/auth/login") ||
      (status === 404 && responseUrl.pathname.startsWith("/ui-smoke-missing-route-"))
    );
  } catch {
    return false;
  }
}

function isExpectedSmokeConsoleError(text) {
  return (
    text.startsWith("Failed to load resource: the server responded with a status of 401") ||
    text.startsWith("Failed to load resource: the server responded with a status of 403") ||
    text.startsWith("Failed to load resource: the server responded with a status of 404")
  );
}

const nestedRouteSurfaceAuditRoutes = [
  { label: "Home", query: "?view=command", heading: "Home" },
  { label: "AI Assistant", query: "?view=orchestrator", heading: "AI Assistant" },
  { label: "AI Inventory", query: "?view=estate", heading: "AI Inventory" },
  { label: "Company Plan", query: "?view=blueprint", heading: "Company Plan" },
  { label: "AI Roadmap", query: "?view=strategy", heading: "AI Roadmap" },
  { label: "Process Redesign", query: "?view=process", heading: "Process Redesign" },
  { label: "Work Signals", query: "?view=work", heading: "Work Signals" },
  { label: "Use Cases overview", query: "?view=factory&factoryTab=overview", heading: "Use Cases" },
  { label: "Use Cases intake", query: "?view=factory&factoryTab=intake", heading: "Use Cases" },
  { label: "Use Cases backlog", query: "?view=factory&factoryTab=backlog", heading: "Use Cases" },
  { label: "Use Cases scoring", query: "?view=factory&factoryTab=scoring", heading: "Use Cases" },
  { label: "Use Cases detail", query: "?view=factory&factoryTab=detail", heading: "Use Cases" },
  { label: "Use Cases pilot", query: "?view=factory&factoryTab=pilot", heading: "Use Cases" },
  { label: "Use Cases value", query: "?view=factory&factoryTab=value", heading: "Use Cases" },
  { label: "AI Harness overview", query: "?view=harness&harnessMode=overview", heading: "AI Harness" },
  { label: "AI Harness runs", query: "?view=harness&harnessMode=runs", heading: "Harness Runs" },
  { label: "AI Harness detail", query: "?view=harness&harnessMode=detail", heading: ["Run", "AI Harness"] },
  { label: "AI Skills overview", query: "?view=skills&skillMode=overview", heading: "AI Skills" },
  { label: "AI Skills detail overview", query: "?view=skills&skillMode=detail&skillTab=overview", heading: "AI Skills" },
  { label: "AI Skills detail configuration", query: "?view=skills&skillMode=detail&skillTab=configuration", heading: "AI Skills" },
  { label: "AI Skills detail prompt", query: "?view=skills&skillMode=detail&skillTab=prompt", heading: "AI Skills" },
  { label: "AI Skills detail tools", query: "?view=skills&skillMode=detail&skillTab=tools", heading: "AI Skills" },
  { label: "AI Skills detail context", query: "?view=skills&skillMode=detail&skillTab=context", heading: "AI Skills" },
  { label: "AI Skills detail evals", query: "?view=skills&skillMode=detail&skillTab=evals", heading: "AI Skills" },
  { label: "AI Skills detail runs", query: "?view=skills&skillMode=detail&skillTab=runs", heading: "AI Skills" },
  { label: "AI Skills detail metrics", query: "?view=skills&skillMode=detail&skillTab=metrics", heading: "AI Skills" },
  { label: "AI Skills detail SkillSpec", query: "?view=skills&skillMode=detail&skillTab=skillspec", heading: "AI Skills" },
  { label: "AI Skills detail versions", query: "?view=skills&skillMode=detail&skillTab=versions", heading: "AI Skills" },
  { label: "Workflow overview", query: "?view=workflow&workflowMode=overview", heading: "Workflow Builder" },
  { label: "Workflow editor", query: "?view=workflow&workflowMode=editor", heading: "Guided Workflow Builder" },
  { label: "Connect Apps", query: "?view=connectors", heading: "Connect Apps" },
  { label: "Tool Permissions", query: "?view=broker", heading: "Tool Permissions" },
  { label: "Knowledge Sources", query: "?view=context", heading: "Knowledge Sources" },
  { label: "Quality Evals", query: "?view=evals", heading: "Quality Evals" },
  { label: "Risk Review", query: "?view=governance", heading: "Risk Review" },
  { label: "Launch Plan", query: "?view=launch", heading: "Launch Plan" },
  { label: "Proof Ledger", query: "?view=evidence", heading: "Proof Ledger" },
  { label: "Value & ROI", query: "?view=roi", heading: "Value & ROI" },
  { label: "Adoption Plan", query: "?view=training", heading: "Adoption Plan" },
  { label: "Reports", query: "?view=reports", heading: "Reports" },
  { label: "Settings", query: "?view=admin", heading: "Settings" },
  { label: "Skill Session", query: "?view=session&skillId=sk-hr-helpdesk", heading: ["HR Policy Helpdesk", "Skill Session"] },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 820 },
    extraHTTPHeaders: { "X-EAIEOS-Tenant": smokeTenantId },
  });
  const consoleErrors = [];
  const chartWarnings = [];
  const resourceErrors = [];
  const nativeDialogs = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!isExpectedSmokeConsoleError(text)) {
        consoleErrors.push(text);
      }
    }
    if (message.type() === "warning" && message.text().includes("width(-1) and height(-1) of chart")) {
      chartWarnings.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !isExpectedSmokeHttpFailure(response.status(), response.url())) {
      resourceErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("dialog", (dialog) => {
    nativeDialogs.push({ type: dialog.type(), message: dialog.message() });
    dialog.accept();
  });

  await expectBootShellLoadingState(page);
  await expectAuthGateAccessBoundary(page);
  await expectNotFoundRecoverySurface(page);
  await expectDirectUrlHydration(page);
  await expectBrowserHistoryNavigation(page);
  await expectScopedUrlStateClearing(page);
  await expectMobileHomeLayout(page);
  await expectMobileCoreSurfaceLayouts(page);
  await expectMobileRouteSurfaceAudit(page);
  await expectDesktopInteractionAffordanceAudit(page);
  await expectTabletShellHeaderLayout(page);
  await expectNavigationHeadingConsistency(page);
  await expectNestedRouteWayfinding(page);
  await expectHarnessRunsActionPrerequisites(page);
  await expectEmptyStateActionIconography(page);
  await expectWorkspaceShellAccessibility(page);
  await expectAdminAdaptiveSettingsGrids(page);
  await expectCommandMenuKeyboardFlow(page);
  await expectStreamlinedVisualSystem(page);
  await expectHomeActionControlLabels(page);

  await page.setViewportSize({ width: 1440, height: 820 });
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
  await exerciseSettingsModal(page);
  await exerciseWorkspaceProfileMenu(page);
  await clickNav(page, "AI Inventory");
  await page.waitForTimeout(400);
  await expectText(page, "AI Inventory");
  await expectText(page, "inventory control plane");
  await expectText(page, "Inventory map");
  await expectText(page, "Full registry");
  await expectText(page, "Inventory Standard");
  await expectDataTables(page, ["AI estate registry"]);
  const openClawProofLinkHitAreas = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="openclaw-agent-inventory"] button'))
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          label: button.textContent?.replace(/\s+/g, " ").trim() ?? "",
          ariaLabel: button.getAttribute("aria-label") ?? "",
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((button) => button.label.startsWith("proof-") && button.width > 0 && button.height > 0),
  );
  assert(openClawProofLinkHitAreas.length > 0, "OpenClaw inventory should expose proof links");
  for (const proofLink of openClawProofLinkHitAreas) {
    assert(
      proofLink.ariaLabel.includes("Proof Ledger"),
      `OpenClaw proof links should identify their destination: ${JSON.stringify(proofLink)}`,
    );
    assert(
      proofLink.width >= 32 && proofLink.height >= 32,
      `OpenClaw proof links should keep at least 32px hit areas: ${JSON.stringify(proofLink)}`,
    );
  }

  await clickNav(page, "Connect Apps");
  await page.waitForTimeout(400);
  await expectPageHeading(page, "Connect Apps");
  await expectText(page, "Connector Setup");
  await expectText(page, "Connect Slack");
  await expectText(page, "Implementation playbook");
  await expectText(page, "Tenant vault");
  await expectText(page, "Day-One Stack Plan");
  await expectText(page, "Provider Defaults");
  await expectDataTables(page, ["Enterprise connector setup catalog"]);
  const connectorSecretSaveState = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="connector-setup-save-secrets"]');
    const describedBy = button?.getAttribute("aria-describedby") ?? "";
    return {
      exists: Boolean(button),
      disabled: Boolean(button?.hasAttribute("disabled")),
      title: button?.getAttribute("title") ?? "",
      description: describedBy ? document.getElementById(describedBy)?.textContent?.replace(/\s+/g, " ").trim() ?? "" : "",
    };
  });
  assert(connectorSecretSaveState.exists, `Connect Apps should expose the connector vault save action: ${JSON.stringify(connectorSecretSaveState)}`);
  assert(connectorSecretSaveState.disabled, `empty connector vault should disable Save secrets: ${JSON.stringify(connectorSecretSaveState)}`);
  assert(
    connectorSecretSaveState.description.includes("connector secret"),
    `disabled connector Save secrets should explain how to enable it: ${JSON.stringify(connectorSecretSaveState)}`,
  );
  assert(
    connectorSecretSaveState.title.includes("connector secret"),
    `disabled connector Save secrets should expose a hover explanation: ${JSON.stringify(connectorSecretSaveState)}`,
  );

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
  await assertVisibleButtonsAreNamed(page, "Workflow Builder editor");
  await assertVisibleFormControlsAreNamed(page, "Workflow Builder editor");
  await expectVisibleControlSize(page, '[data-testid="workflow-overview-breadcrumb"]', "workflow overview breadcrumb");
  await expectVisibleControlSize(page, 'button[aria-label="Zoom workflow canvas out"]', "workflow zoom out");
  await expectVisibleControlSize(page, 'button[aria-label="Zoom workflow canvas in"]', "workflow zoom in");
  await expectVisibleControlSize(page, 'button[aria-label="Close block inspector"]', "workflow block inspector close");
  const workflowNativeCanvasControls = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".react-flow__controls-button")).map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        name: button.getAttribute("aria-label") ?? button.getAttribute("title") ?? "",
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }),
  );
  assert(workflowNativeCanvasControls.length >= 4, `workflow canvas should expose native pan/zoom controls: ${JSON.stringify(workflowNativeCanvasControls)}`);
  for (const control of workflowNativeCanvasControls) {
    assert(control.width >= 32 && control.height >= 32, `workflow native canvas control should keep at least 32px hit area: ${JSON.stringify(control)}`);
  }
  const workflowValidationStripLayout = await page.evaluate(() => {
    const strip = document.querySelector('[data-testid="workflow-validation-strip"]');
    const rect = strip ? strip.getBoundingClientRect() : null;
    const style = strip ? getComputedStyle(strip) : null;
    return {
      exists: Boolean(strip),
      flexDirection: style?.flexDirection ?? "",
      width: rect ? Math.round(rect.width) : 0,
      top: rect ? Math.round(rect.top) : 0,
      bottom: rect ? Math.round(rect.bottom) : 0,
      visibleInViewport: Boolean(rect && rect.bottom > 0 && rect.top < window.innerHeight),
    };
  });
  assert(workflowValidationStripLayout.exists, `workflow editor should render the validation strip: ${JSON.stringify(workflowValidationStripLayout)}`);
  assert(
    workflowValidationStripLayout.visibleInViewport,
    `workflow validation strip should be visible in the working viewport: ${JSON.stringify(workflowValidationStripLayout)}`,
  );
  assert(
    workflowValidationStripLayout.flexDirection === "column" || workflowValidationStripLayout.width >= 760,
    `workflow validation strip should stay stacked until the canvas is wide enough: ${JSON.stringify(workflowValidationStripLayout)}`,
  );
  const specToggle = page.locator("main").getByRole("button", { name: "Spec", exact: true });
  assert((await specToggle.count()) === 1, "workflow editor should expose one Spec toggle");
  await specToggle.click();
  await page.waitForFunction(() => document.querySelector('button[aria-label="Close workflow spec panel"]'), null, { timeout: 5000 });
  await expectVisibleControlSize(page, 'button[aria-label="Close workflow spec panel"]', "workflow spec panel close");
  const releaseGates = page.getByRole("button", { name: "Release gates", exact: true });
  assert((await releaseGates.count()) === 1, "workflow spec panel should expose release gates");
  await releaseGates.click();
  await page.waitForFunction(() => document.querySelector('button[aria-label="Close workflow release gates panel"]'), null, { timeout: 5000 });
  await expectVisibleControlSize(page, 'button[aria-label="Close workflow release gates panel"]', "workflow release gates close");
  await page.getByRole("button", { name: "Close workflow release gates panel", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Close workflow release gates panel"]'), null, { timeout: 5000 });
  await exerciseWorkflowBuilderTabs(page);

  const autosaveStatus = page.getByRole("button", { name: "Show autosave status", exact: true });
  assert((await autosaveStatus.count()) === 1, "workflow editor should expose an autosave status action");
  await autosaveStatus.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="workflow-builder-notice"]'), null, { timeout: 5000 });
  const workflowNotice = page.getByTestId("workflow-builder-notice");
  assert((await workflowNotice.getAttribute("role")) === "status", "workflow notice should announce as a status region");
  assert((await workflowNotice.getAttribute("aria-live")) === "polite", "workflow notice should announce politely");
  await expectVisibleControlSize(page, 'button[aria-label="Dismiss workflow notice"]', "workflow notice dismiss");
  await expectText(page, "Workflow persists automatically in the workspace snapshot");

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
  await exerciseProfessionalConfirmationModal(page, nativeDialogs);

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
  const openClawGatewayFieldLabels = await page.evaluate(() =>
    ["OpenClaw gateway URL", "OpenClaw version pin", "OpenClaw auth mode", "OpenClaw sandbox mode"].map((label) => ({
      label,
      count: document.querySelectorAll(`input[aria-label="${label}"], select[aria-label="${label}"]`).length,
    })),
  );
  for (const field of openClawGatewayFieldLabels) {
    assert(field.count === 1, `Settings OpenClaw gateway field should have a programmatic label: ${JSON.stringify(field)}`);
  }
  await exerciseImportWorkspaceModal(page);

  const addMember = page.getByRole("button", { name: "Add Member", exact: true });
  assert((await addMember.count()) === 1, "admin should expose an Add Member action");
  let addMemberState = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.replace(/\s+/g, " ").trim() === "Add Member",
    );
    const describedBy = button?.getAttribute("aria-describedby") ?? "";
    return {
      disabled: Boolean(button?.hasAttribute("disabled")),
      title: button?.getAttribute("title") ?? "",
      describedBy,
      description: describedBy ? document.getElementById(describedBy)?.textContent?.replace(/\s+/g, " ").trim() ?? "" : "",
    };
  });
  assert(addMemberState.disabled, `empty member form should disable Add Member: ${JSON.stringify(addMemberState)}`);
  assert(
    addMemberState.description.includes("member name"),
    `disabled Add Member should explain the missing field: ${JSON.stringify(addMemberState)}`,
  );
  assert(
    addMemberState.title.includes("member name"),
    `disabled Add Member should expose a hover explanation: ${JSON.stringify(addMemberState)}`,
  );

  await page.getByPlaceholder("Jane Smith").fill("Smoke Reviewer");
  await page.getByPlaceholder("jane.smith@company.com").fill("smoke.reviewer@example.com");
  await page.getByPlaceholder("Security Reviewer").fill("Security Reviewer");
  addMemberState = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.replace(/\s+/g, " ").trim() === "Add Member",
    );
    return {
      disabled: Boolean(button?.hasAttribute("disabled")),
      title: button?.getAttribute("title") ?? "",
      describedBy: button?.getAttribute("aria-describedby") ?? "",
    };
  });
  assert(!addMemberState.disabled, `valid member form should enable Add Member: ${JSON.stringify(addMemberState)}`);
  assert(addMemberState.title === "", `enabled Add Member should not keep stale disabled title: ${JSON.stringify(addMemberState)}`);
  assert(addMemberState.describedBy === "", `enabled Add Member should not keep stale disabled description: ${JSON.stringify(addMemberState)}`);
  await addMember.click();
  await page.waitForTimeout(500);
  await page.getByTestId("member-search").fill("smoke.reviewer@example.com");
  await expectText(page, "Smoke Reviewer");
  const editMember = page.getByTestId("edit-member-user-smoke-reviewer-example-com");
  assert((await editMember.count()) === 1, "admin should expose a scoped Edit action for the staged tenant member");
  assert(
    (await editMember.getAttribute("aria-label")) === "Edit Smoke Reviewer (smoke.reviewer@example.com)",
    "admin member edit action should include the member identity",
  );
  const removeMember = page.getByTestId("remove-member-user-smoke-reviewer-example-com");
  assert((await removeMember.count()) === 1, "admin should expose a scoped Remove action for the staged tenant member");
  assert(
    (await removeMember.getAttribute("aria-label")) === "Remove Smoke Reviewer (smoke.reviewer@example.com)",
    "admin member remove action should include the member identity",
  );
  await removeMember.click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="remove-member-user-smoke-reviewer-example-com"]'), null, { timeout: 4000 });
  assert((await page.getByTestId("remove-member-user-smoke-reviewer-example-com").count()) === 0, "admin member remove action should remove the staged tenant member");

  const companyInput = page.getByLabel("Company Name");
  assert((await companyInput.count()) === 1, "company name field should be accessible by label");
  const primaryColor = page.getByLabel("Tenant primary color");
  assert((await primaryColor.count()) === 1, "tenant primary color field should be accessible by label");

  const loadDemoTenant = page.locator("#admin-workspace").getByRole("button", { name: "Load Demo Tenant", exact: true });
  assert((await loadDemoTenant.count()) === 1, "admin demo tenant load action should be available");
  await loadDemoTenant.click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-toast"]')?.textContent?.includes("Demo workspace loaded"),
    null,
    { timeout: 5000 },
  );
  await expectAppToastStatus(page, "Demo workspace loaded");

  await clickNav(page, "Company Plan");
  await page.waitForTimeout(500);
  await expectPageHeading(page, "Company Plan");
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
  await exerciseUseCaseFactoryTabs(page);
  await clickTab(page, "Backlog");
  await page.waitForTimeout(400);
  await expectText(page, "Discover, evaluate, and prioritize AI opportunities");
  await expectText(page, "Total use cases");
  await expectDataTables(page, ["Use case opportunity backlog"]);
  await expectVisibleControlSize(page, '[data-testid="factory-overview-breadcrumb"]', "use case factory breadcrumb");
  const factoryPaginationState = await page.evaluate(() =>
    ["Previous page", "Next page"].map((label) => {
      const button = Array.from(document.querySelectorAll("button")).find((candidate) => candidate.getAttribute("aria-label") === label);
      const describedBy = button?.getAttribute("aria-describedby") ?? "";
      return {
        label,
        disabled: Boolean(button?.hasAttribute("disabled")),
        title: button?.getAttribute("title") ?? "",
        description: describedBy ? document.getElementById(describedBy)?.textContent?.replace(/\s+/g, " ").trim() ?? "" : "",
      };
    }),
  );
  for (const state of factoryPaginationState) {
    if (!state.disabled) continue;
    assert(state.title.length > 0, `disabled ${state.label} should expose a hover explanation: ${JSON.stringify(state)}`);
    assert(state.description.length > 0, `disabled ${state.label} should expose an accessible explanation: ${JSON.stringify(state)}`);
  }
  await exerciseUseCaseAdvancedFilterDisclosure(page);
  await exerciseUseCaseBacklogDetailTabs(page);

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
  await exerciseSkillDetailTabs(page);

  await clickNav(page, "Tool Permissions");
  await page.waitForTimeout(500);
  await expectText(page, "Connector Control Plane");
  await expectText(page, "Execution Ecosystem");
  await expectText(page, "Tool Requests Queue");
  await expectDataTables(page, ["MCP Broker tool catalog", "MCP Broker audit log"]);

  await clickNav(page, "Knowledge Sources");
  await page.waitForTimeout(500);
  await expectPageHeading(page, "Knowledge Sources");
  await expectText(page, "Permission Simulation");
  await expectText(page, "Knowledge Gaps");
  await exerciseContextStatusNotices(page);

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
  await expectGovernanceBlockedApprovalReason(page);

  await exerciseLaunchStatusNotices(page);
  await exerciseProofLedgerTabs(page);
  await exerciseProofLedgerStatusNotice(page);

  await clickNav(page, "Value & ROI");
  await page.waitForTimeout(500);
  await expectText(page, "Use Case Economics");

  await clickNav(page, "Adoption Plan");
  await page.waitForTimeout(500);
  await expectPageHeading(page, "Adoption Plan");
  await expectText(page, "Adoption Campaigns");
  await expectText(page, "Office Hours");

  await clickNav(page, "Reports");
  await page.waitForTimeout(500);
  await expectText(page, "Briefing Workflow");
  await expectReportsDisabledExportReasons(page);

  await clickNav(page, "AI Harness");
  await page.waitForTimeout(500);
  await expectPageHeading(page, "AI Harness");
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
  await expectVisibleControlSize(page, '[data-testid="harness-overview-breadcrumb"]', "AI Harness runs breadcrumb");

  const run1001 = page.getByRole("button", { name: "run-1001", exact: true });
  assert((await run1001.count()) === 1, "run-1001 should be clickable from the Harness runs ledger");
  await run1001.click();
  await page.waitForTimeout(500);
  await expectText(page, "Run 1001");
  await expectText(page, "Execution Trace");
  await expectText(page, "David Chen");
  const initialHarnessTabState = await readHarnessRunTabState(page);
  assert(initialHarnessTabState.selectedTab.includes("Trace"), `Harness run should start on Trace: ${JSON.stringify(initialHarnessTabState)}`);
  assertHarnessRunTabA11y(initialHarnessTabState, "Trace");
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
    const state = await readHarnessRunTabState(page);
    assert(state.selectedTab.includes(tabLabel), `${tabLabel} should become the selected Harness run tab: ${JSON.stringify(state)}`);
    assertHarnessRunTabA11y(state, tabLabel);
  }

  await clickNav(page, "AI Assistant");
  await page.waitForTimeout(500);
  await expectText(page, "AI Assistant");
  await expectText(page, "What can you do?");
  await expectText(page, "Proof used");
  await expectText(page, "actions");
  await page.getByTestId("orchestrator-context-toggle").click();
  await page.waitForTimeout(200);
  await expectText(page, "Recommended move");
  await expectText(page, "Workspace health");
  await expectText(page, "Progress path");
  await expectText(page, "Helpful shortcuts");
  const orchestratorLayout = await page.evaluate(() => {
    const textarea = document.querySelector('textarea[placeholder^="Ask for the next move"]');
    const form = textarea?.closest("form");
    const messageScroller = document.querySelector('[data-testid="orchestrator-transcript"]');
    const formRect = form?.getBoundingClientRect();
    const scrollerStyle = messageScroller ? getComputedStyle(messageScroller) : null;
    const promptRail = document.querySelector('[data-testid="orchestrator-context-prompt-rail"]');
    const promptRailRect = promptRail?.getBoundingClientRect();
    const promptButtons = Array.from(promptRail?.querySelectorAll("button") ?? []);
    const contextToggle = document.querySelector('[data-testid="orchestrator-context-toggle"]');
    const contextDrawer = document.querySelector('[data-testid="orchestrator-context-drawer"]');
    const contextControls = [
      contextToggle,
      ...Array.from(contextDrawer?.querySelectorAll("button") ?? []),
    ].filter(Boolean);
    const smallContextControls = contextControls
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          label: button.textContent?.replace(/\s+/g, " ").trim() ?? "",
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((button) => button.width < 32 || button.height < 32);
    const overflowingPromptButtons = promptButtons
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.left < -1 || rect.right > window.innerWidth + 1;
      })
      .map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? "");
    const sendButton = document.querySelector('[data-testid="orchestrator-send-button"]');
    const sendDescriptionId = sendButton?.getAttribute("aria-describedby") ?? "";

    return {
      hasRedundantPageHeading: Array.from(document.querySelectorAll("h1")).some((element) => element.textContent?.trim() === "AI Assistant" && !element.closest("header")),
      formVisible: Boolean(formRect && formRect.top >= 0 && formRect.bottom <= window.innerHeight + 1),
      formFlushToViewportBottom: Boolean(formRect && Math.abs(window.innerHeight - formRect.bottom) <= 1),
      pageCanScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight + 4,
      messageScrollerOverflow: scrollerStyle?.overflowY,
      promptRailVisible: Boolean(promptRailRect && promptRailRect.width > 0 && promptRailRect.height > 0),
      promptRailOverflowX: promptRail ? promptRail.scrollWidth - promptRail.clientWidth : null,
      overflowingPromptButtons,
      contextDrawerVisible: Boolean(contextDrawer),
      smallContextControls,
      sendDisabled: Boolean(sendButton?.hasAttribute("disabled")),
      sendDescriptionId,
      sendDescriptionText: sendDescriptionId ? document.getElementById(sendDescriptionId)?.textContent?.replace(/\s+/g, " ").trim() ?? "" : "",
      sendTitle: sendButton?.getAttribute("title") ?? "",
    };
  });
  assert(!orchestratorLayout.hasRedundantPageHeading, "AI Assistant should not render a redundant page heading above the console");
  assert(orchestratorLayout.formVisible, "AI Assistant composer must stay visible in the viewport");
  assert(orchestratorLayout.formFlushToViewportBottom, "AI Assistant composer should sit at the bottom of the viewport");
  assert(!orchestratorLayout.pageCanScroll, "AI Assistant page should not require document scrolling to reach the composer");
  assert(orchestratorLayout.messageScrollerOverflow === "auto", "AI Assistant transcript should own vertical scrolling");
  assert(orchestratorLayout.promptRailVisible, `AI Assistant prompt rail should be visible: ${JSON.stringify(orchestratorLayout)}`);
  assert((orchestratorLayout.promptRailOverflowX ?? 0) <= 1, `AI Assistant prompt rail should wrap without horizontal overflow: ${JSON.stringify(orchestratorLayout)}`);
  assert(
    orchestratorLayout.overflowingPromptButtons.length === 0,
    `AI Assistant prompt buttons should fit in the viewport: ${JSON.stringify(orchestratorLayout)}`,
  );
  assert(orchestratorLayout.contextDrawerVisible, `AI Assistant context drawer should open from the compact trigger: ${JSON.stringify(orchestratorLayout)}`);
  assert(
    orchestratorLayout.smallContextControls.length === 0,
    `AI Assistant context controls should keep at least 32px hit areas: ${JSON.stringify(orchestratorLayout)}`,
  );
  assert(orchestratorLayout.sendDisabled, `empty AI Assistant composer should disable Send: ${JSON.stringify(orchestratorLayout)}`);
  assert(
    orchestratorLayout.sendDescriptionText.includes("Type a message"),
    `disabled AI Assistant Send should explain how to enable it: ${JSON.stringify(orchestratorLayout)}`,
  );
  assert(
    orchestratorLayout.sendTitle.includes("Type a message"),
    `disabled AI Assistant Send should expose a hover explanation: ${JSON.stringify(orchestratorLayout)}`,
  );
  const minimizeContext = page.getByRole("button", { name: "Minimize context", exact: true });
  assert((await minimizeContext.count()) === 1, "AI Assistant context drawer should expose a minimize control");
  await minimizeContext.click();
  await page.waitForTimeout(120);

  await clickNav(page, "Settings");
  await page.waitForTimeout(500);
  const liveMode = page.getByRole("button", { name: /Live production/i });
  assert((await liveMode.count()) === 1, "admin live production mode should be available");
  const liveModeDialogCountBefore = nativeDialogs.length;
  await liveMode.click();
  await page.waitForTimeout(300);
  const productionConfirmation = page.getByTestId("production-mode-confirmation");
  if ((await productionConfirmation.count()) === 1) {
    assert((await productionConfirmation.getAttribute("role")) === "dialog", "production mode confirmation should render as a dialog");
    assert(
      nativeDialogs.length === liveModeDialogCountBefore,
      `switching to live mode should not use a native browser dialog: ${JSON.stringify(nativeDialogs)}`,
    );
    const confirmLiveMode = productionConfirmation.getByRole("button", { name: "Switch to Live Mode", exact: true });
    assert((await confirmLiveMode.count()) === 1, "production mode confirmation should expose the Switch to Live Mode action");
    await confirmLiveMode.click();
  }
  await page.waitForTimeout(1200);
  await expectText(page, "Live production active");

  assert(
    consoleErrors.length === 0,
    `browser console errors: ${consoleErrors.slice(0, 3).join("\n")}\nresources: ${resourceErrors.slice(0, 3).join("\n")}`,
  );
  assert(resourceErrors.length === 0, `browser resource errors: ${resourceErrors.slice(0, 5).join("\n")}`);
  assert(chartWarnings.length === 0, `chart container warnings: ${chartWarnings.slice(0, 3).join("\n")}`);
  assert(nativeDialogs.length === 0, `native browser dialogs should not appear in the app shell: ${JSON.stringify(nativeDialogs)}`);
  await browser.close();

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    checked: [
      "shell navigation",
      "accessible responsive loading shell",
      "auth gate access boundary",
      "not-found recovery boundary",
      "direct URL hydration",
      "browser back and forward navigation",
      "scoped URL state clearing",
      "mobile home layout constraints",
      "mobile core surface controls",
      "mobile direct route surface audit",
      "desktop interaction affordance audit",
      "tablet shell header controls",
      "navigation heading consistency",
      "nested route wayfinding",
      "AI Harness empty action prerequisites",
      "empty state action iconography",
      "workspace shell accessibility",
      "workspace autosave status",
      "command menu keyboard flow",
      "command menu trigger dialog state",
      "command menu visual polish",
      "streamlined visual system tokens",
      "home action control labels",
      "guided setup concierge",
      "guided setup accessible surface",
      "post-generation launch handoff",
      "launch handoff accessible surface",
      "help walkthrough modal",
      "help walkthrough accessible surface",
      "help trigger dialog state",
      "modal document scroll locking",
      "modal background isolation",
      "company setup editable secrets and read-only readiness facts",
      "AI settings trigger dialog state",
      "workspace profile menu",
      "workspace profile trigger menu state",
      "sidebar hubs default expanded",
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
      "action inbox accessible surface",
      "notification trigger dialog state",
      "AI estate registry",
      "AI estate external inventory intake",
      "connector setup path",
      "connector setup activation command center",
      "connector setup day-one stack plan",
      "connector setup catalog",
      "dense table scroll accessibility",
      "strategy roadmap surface",
      "process redesign surface",
      "workflow studio overview",
      "workflow studio tab semantics",
      "workflow inspector tab semantics",
      "workflow studio independent palette scroll",
      "professional confirmation modal",
      "admin branding controls",
      "admin readiness panel",
      "admin production cutover sequence",
      "admin adaptive settings grids",
      "admin team access member management",
      "admin primetime launch gate",
      "admin launch fix list",
      "admin import workspace modal",
      "admin maturity panel",
      "admin live/demo workspace mode",
      "demo workspace load",
      "shared app toast status announcements",
      "use case factory overview",
      "use case factory tab semantics",
      "use case factory backlog",
      "use case detail tab semantics",
      "work intelligence radar",
      "work intelligence privacy guardrails",
      "skills library overview",
      "skill detail tab semantics",
      "skills pattern marketplace",
      "MCP broker control plane",
      "MCP broker execution ecosystem",
      "context fabric permission simulation",
      "operational status notice semantics",
      "continuous eval drift monitor",
      "evaluations coverage",
      "governance taxonomy",
      "governance blocked approval reason",
      "proof ledger tab panels",
      "metrics ROI economics",
      "training adoption campaigns",
      "reports briefing workflow",
      "reports disabled export reasons",
      "AI Harness overview",
      "AI Harness agent ops blueprint",
      "AI Harness agent identity governance",
      "AI Harness runs ledger",
      "AI Harness run detail",
      "AI Harness run detail tabs",
      "AI Harness run detail tab semantics",
      "orchestrator surface",
      "orchestrator customer launch path",
      "orchestrator viewport-fit composer",
      "orchestrator prompt rail wrapping",
      "orchestrator internal transcript scroll",
      "smoke restores live production mode",
      "browser console clean",
    ],
  }, null, 2));
}

async function expectBootShellLoadingState(page) {
  let delayedWorkspaceRequest = false;
  const workspaceRoutePattern = "**/api/workspace";
  const delayWorkspaceOnce = async (route) => {
    if (!delayedWorkspaceRequest) {
      delayedWorkspaceRequest = true;
      await page.waitForTimeout(750);
    }
    await route.continue();
  };

  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(workspaceRoutePattern, delayWorkspaceOnce);
  try {
    await page.goto(`${baseUrl}/?view=launch&ui-smoke-boot=${Date.now()}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(document.querySelector('[data-testid="boot-shell"]')), null, { timeout: 5000 });

    const loadingState = await page.evaluate(() => {
      const boot = document.querySelector('[data-testid="boot-shell"]');
      const heading = boot?.querySelector("h1");
      const rect = boot?.getBoundingClientRect();

      return {
        exists: Boolean(boot),
        role: boot?.getAttribute("role") ?? "",
        busy: boot?.getAttribute("aria-busy") ?? "",
        labelledBy: boot?.getAttribute("aria-labelledby") ?? "",
        heading: heading?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        text: boot?.textContent?.replace(/\s+/g, " ").trim().slice(0, 240) ?? "",
        pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        width: rect ? Math.round(rect.width) : 0,
      };
    });

    assert(loadingState.exists, `Boot shell should render while workspace data is loading: ${JSON.stringify(loadingState)}`);
    assert(loadingState.role === "status", `Boot shell should announce loading status: ${JSON.stringify(loadingState)}`);
    assert(loadingState.busy === "true", `Boot shell should expose aria-busy while loading: ${JSON.stringify(loadingState)}`);
    assert(loadingState.labelledBy === "boot-shell-title", `Boot shell should be labelled by its heading: ${JSON.stringify(loadingState)}`);
    assert(loadingState.heading === "Preparing workspace", `Boot shell should expose a useful heading: ${JSON.stringify(loadingState)}`);
    assert(loadingState.text.includes("Loading tenant settings"), `Boot shell should explain what is loading: ${JSON.stringify(loadingState)}`);
    assert(loadingState.pageOverflowX <= 1, `Boot shell should not overflow on mobile: ${JSON.stringify(loadingState)}`);

    await page.waitForFunction(
      () =>
        !document.querySelector('[data-testid="boot-shell"]') &&
        Array.from(document.querySelectorAll("h1")).some((heading) => heading.textContent?.includes("Launch Plan")),
      null,
      { timeout: 12000 },
    );
  } finally {
    await page.unroute(workspaceRoutePattern, delayWorkspaceOnce);
    await page.setViewportSize({ width: 1440, height: 820 });
  }
}

async function expectAuthGateAccessBoundary(page) {
  const workspaceRoutePattern = "**/api/workspace";
  const readinessRoutePattern = "**/api/readiness";
  const loginRoutePattern = "**/api/auth/login";
  const workspaceUnauthorized = async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Authentication required." }),
    });
  };
  const readinessBlocked = async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schema: "enterprise-ai-enablement-os.readiness.v1",
        status: "blocked",
        generatedAt: new Date().toISOString(),
        auth: {
          authRequired: true,
          oidcConfigured: false,
          localLoginEnabled: true,
          mode: "local-break-glass",
          issueCount: 1,
          warningCount: 1,
        },
        blockers: [
          {
            id: "sso",
            label: "OIDC SSO",
            detail: "OIDC issuer/client credentials are not configured.",
            status: "fail",
          },
        ],
        warnings: [
          {
            id: "local-login",
            label: "Local admin",
            detail: "Local admin should only be used for development or break-glass recovery.",
            status: "warn",
          },
        ],
      }),
    });
  };
  const loginDenied = async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "Local login is not available for this environment." }),
    });
  };

  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(workspaceRoutePattern, workspaceUnauthorized);
  await page.route(readinessRoutePattern, readinessBlocked);
  await page.route(loginRoutePattern, loginDenied);
  try {
    await page.goto(`${baseUrl}/?view=command&ui-smoke-auth-gate=${Date.now()}`, { waitUntil: "load" });
    await page.waitForFunction(() => Boolean(document.querySelector('[data-testid="auth-gate"]')), null, { timeout: 8000 });

    const gateState = await page.evaluate(() => {
      const gate = document.querySelector('[data-testid="auth-gate"]');
      const blockers = document.querySelector('[data-testid="auth-gate-blockers"]');
      const warnings = document.querySelector('[data-testid="auth-gate-warnings"]');
      const localButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Use local admin session"),
      );

      return {
        exists: Boolean(gate),
        heading: gate?.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        text: gate?.textContent?.replace(/\s+/g, " ").trim().slice(0, 700) ?? "",
        blockersText: blockers?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        warningsText: warnings?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        localButtonExists: Boolean(localButton),
        localButtonDescribedBy: localButton?.getAttribute("aria-describedby") ?? "",
        pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    assert(gateState.exists, `auth gate should render for unauthorized workspace access: ${JSON.stringify(gateState)}`);
    assert(gateState.heading === "Sign in to the enterprise workspace", `auth gate should use a product-specific heading: ${JSON.stringify(gateState)}`);
    assert(gateState.text.includes("Tenant data"), `auth gate should explain why access is required: ${JSON.stringify(gateState)}`);
    assert(gateState.blockersText.includes("OIDC SSO"), `auth gate should surface readiness blockers: ${JSON.stringify(gateState)}`);
    assert(gateState.warningsText.includes("Local admin should only be used"), `auth gate should surface readiness warnings: ${JSON.stringify(gateState)}`);
    assert(gateState.localButtonExists, `auth gate should expose local admin when enabled: ${JSON.stringify(gateState)}`);
    assert(gateState.pageOverflowX <= 1, `auth gate should not overflow on mobile: ${JSON.stringify(gateState)}`);

    const localAdmin = page.getByRole("button", { name: "Use local admin session", exact: true });
    assert((await localAdmin.count()) === 1, "auth gate local admin action should be available");
    await localAdmin.click();
    await page.waitForFunction(() => document.querySelector('[data-testid="auth-gate-login-status"]'), null, { timeout: 5000 });

    const loginStatus = await page.evaluate(() => {
      const status = document.querySelector('[data-testid="auth-gate-login-status"]');
      const localButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Use local admin session") || button.textContent?.includes("Starting local session"),
      );

      return {
        role: status?.getAttribute("role") ?? "",
        live: status?.getAttribute("aria-live") ?? "",
        text: status?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        describedBy: localButton?.getAttribute("aria-describedby") ?? "",
      };
    });

    assert(loginStatus.role === "alert", `failed local login should announce as an alert: ${JSON.stringify(loginStatus)}`);
    assert(loginStatus.live === "assertive", `failed local login should use assertive live region: ${JSON.stringify(loginStatus)}`);
    assert(loginStatus.text.includes("Local login is not available"), `failed local login should show the server reason: ${JSON.stringify(loginStatus)}`);
    assert(loginStatus.describedBy === "auth-gate-status-message", `local login button should reference status copy: ${JSON.stringify(loginStatus)}`);
  } finally {
    await page.unroute(workspaceRoutePattern, workspaceUnauthorized);
    await page.unroute(readinessRoutePattern, readinessBlocked);
    await page.unroute(loginRoutePattern, loginDenied);
    await page.setViewportSize({ width: 1440, height: 820 });
  }
}

async function expectNotFoundRecoverySurface(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/ui-smoke-missing-route-${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(document.querySelector('[data-testid="not-found-boundary"]')), null, { timeout: 8000 });

  const recovery = await page.evaluate(() => {
    const boundary = document.querySelector('[data-testid="not-found-boundary"]');
    const links = Array.from(boundary?.querySelectorAll("a") ?? []).map((link) => ({
      href: link.getAttribute("href") ?? "",
      text: link.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));

    return {
      exists: Boolean(boundary),
      heading: boundary?.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      text: boundary?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      links,
      pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  assert(recovery.exists, `not-found recovery boundary should render: ${JSON.stringify(recovery)}`);
  assert(
    recovery.heading === "This workspace surface is not available",
    `not-found recovery should use product-specific heading: ${JSON.stringify(recovery)}`,
  );
  assert(recovery.text.includes("No workspace data was changed"), `not-found recovery should reassure operators: ${JSON.stringify(recovery)}`);
  assert(
    recovery.links.some((link) => link.href === "/?view=command" && link.text.includes("Command Center")),
    `not-found recovery should link back to Command Center: ${JSON.stringify(recovery)}`,
  );
  assert(
    recovery.links.some((link) => link.href === "/?view=orchestrator" && link.text.includes("Orchestrator")),
    `not-found recovery should link to Orchestrator routing: ${JSON.stringify(recovery)}`,
  );
  assert(recovery.pageOverflowX <= 1, `not-found recovery should not overflow on mobile: ${JSON.stringify(recovery)}`);

  await page.setViewportSize({ width: 1440, height: 820 });
}

async function expectDirectUrlHydration(page) {
  await page.addInitScript(() => {
    window.__eaieosHydrationStates = [];
    const record = () => {
      const h1 = document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.trim() || null;
      const activeNav = Array.from(document.querySelectorAll('aside nav [aria-current="page"]'))
        .map((element) => (element.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (!h1 && activeNav.length === 0) return;

      const next = { h1, activeNav };
      const previous = window.__eaieosHydrationStates.at(-1);
      if (!previous || previous.h1 !== next.h1 || previous.activeNav.join("|") !== next.activeNav.join("|")) {
        window.__eaieosHydrationStates.push(next);
      }
    };

    const install = () => {
      record();
      const observer = new MutationObserver(record);
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["aria-current"],
        characterData: true,
        childList: true,
        subtree: true,
      });
    };

    if (document.body) {
      install();
    } else {
      document.addEventListener("DOMContentLoaded", install, { once: true });
    }
  });

  await page.goto(`${baseUrl}/?view=evidence&ui-smoke-direct=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Proof Ledger"),
    null,
    { timeout: 8000 },
  );
  await expectText(page, "Proof Ledger");
  await page.waitForTimeout(300);

  const hydrationStates = await page.evaluate(() => window.__eaieosHydrationStates || []);
  const mismatchedStates = hydrationStates.filter((state) => {
    const h1Mismatch = state.h1 && state.h1 !== "Proof Ledger";
    const navMismatch =
      state.activeNav.length > 0 &&
      !state.activeNav.some((label) => label.startsWith("Proof Ledger"));
    return h1Mismatch || navMismatch;
  });

  assert(
    mismatchedStates.length === 0,
    `direct evidence URL should hydrate without showing another app view first: ${JSON.stringify(hydrationStates)}`,
  );
}

async function expectBrowserHistoryNavigation(page) {
  await page.goto(`${baseUrl}/?ui-smoke-history=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Home"),
    null,
    { timeout: 8000 },
  );

  await clickNav(page, "AI Inventory");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("AI Inventory"),
    null,
    { timeout: 8000 },
  );
  await clickNav(page, "Connect Apps");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Connect Apps"),
    null,
    { timeout: 8000 },
  );

  await page.goBack({ waitUntil: "load" });
  await page.waitForFunction(
    () =>
      new URL(window.location.href).searchParams.get("view") === "estate" &&
      document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("AI Inventory"),
    null,
    { timeout: 8000 },
  );
  await expectActiveNavVisible(page, "AI Inventory");

  await page.goForward({ waitUntil: "load" });
  await page.waitForFunction(
    () =>
      new URL(window.location.href).searchParams.get("view") === "connectors" &&
      document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Connect Apps"),
    null,
    { timeout: 8000 },
  );
  await expectActiveNavVisible(page, "Connect Apps");
}

async function expectScopedUrlStateClearing(page) {
  const cases = [
    {
      dirtyUrl: `${baseUrl}/?view=factory&factoryTab=detail&useCaseId=uc-stale&ui-smoke-scoped=${Date.now()}`,
      cleanPath: `/?view=factory&ui-smoke-scoped-clean=${Date.now()}`,
      expected: { view: "factory", factoryTab: "overview" },
      absent: ["useCaseId"],
    },
    {
      dirtyUrl: `${baseUrl}/?view=skills&skillMode=detail&skillTab=context&skillId=skill-stale&ui-smoke-scoped=${Date.now()}`,
      cleanPath: `/?view=skills&ui-smoke-scoped-clean=${Date.now()}`,
      expected: { view: "skills", skillMode: "overview" },
      absent: ["skillId", "skillTab"],
    },
    {
      dirtyUrl: `${baseUrl}/?view=harness&harnessMode=detail&runId=run-stale&ui-smoke-scoped=${Date.now()}`,
      cleanPath: `/?view=harness&ui-smoke-scoped-clean=${Date.now()}`,
      expected: { view: "harness", harnessMode: "overview" },
      absent: ["runId"],
    },
  ];

  for (const scenario of cases) {
    await page.goto(scenario.dirtyUrl, { waitUntil: "load" });
    await page.waitForFunction(
      (expectedView) => new URL(window.location.href).searchParams.get("view") === expectedView,
      scenario.expected.view,
      { timeout: 8000 },
    );

    await page.evaluate((cleanPath) => {
      window.history.pushState({ enterpriseAIEnablementOS: true }, "", cleanPath);
      window.dispatchEvent(new PopStateEvent("popstate", { state: { enterpriseAIEnablementOS: true } }));
    }, scenario.cleanPath);

    await page.waitForFunction(
      ({ expected, absent }) => {
        const params = new URL(window.location.href).searchParams;
        return (
          Object.entries(expected).every(([key, value]) => params.get(key) === value) &&
          absent.every((key) => !params.has(key))
        );
      },
      { expected: scenario.expected, absent: scenario.absent },
      { timeout: 8000 },
    );
  }
}

async function expectMobileHomeLayout(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/?view=command&ui-smoke-mobile=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Home"),
    null,
    { timeout: 8000 },
  );

  const layout = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const appScroller = document.querySelector('[data-testid="app-content-scroll"]');
    const bottomNav = document.querySelector('nav[aria-label="Primary mobile navigation"]');
    const header = document.querySelector("main header");
    const visibleOffenders = Array.from(document.querySelectorAll('[data-testid="app-content-scroll"] *'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left < viewportWidth &&
          rect.right > viewportWidth + 1 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          testId: element.getAttribute("data-testid"),
          className: String(element.getAttribute("class") || "").slice(0, 120),
          text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100),
          right: Math.round(rect.right * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
        };
      });

    const bottomNavRect = bottomNav?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    return {
      viewportWidth,
      scrollerOverflowX: appScroller ? appScroller.scrollWidth - appScroller.clientWidth : null,
      visibleOffenders,
      bottomNavVisible: Boolean(bottomNavRect && bottomNavRect.width > 0 && bottomNavRect.bottom <= window.innerHeight + 1),
      headerVisible: Boolean(headerRect && headerRect.width > 0 && headerRect.top >= -1),
    };
  });

  assert(layout.scrollerOverflowX !== null, "mobile home should expose the app content scroller");
  assert(layout.scrollerOverflowX <= 1, `mobile home scroller should not overflow horizontally: ${JSON.stringify(layout)}`);
  assert(layout.visibleOffenders.length === 0, `mobile home has clipped content: ${JSON.stringify(layout.visibleOffenders)}`);
  assert(layout.headerVisible, "mobile home header should be visible");
  assert(layout.bottomNavVisible, "mobile home bottom navigation should be visible");
}

async function expectMobileCoreSurfaceLayouts(page) {
  const surfaces = [
    {
      label: "AI Assistant",
      url: `${baseUrl}/?view=orchestrator&ui-smoke-mobile-surface=${Date.now()}`,
      heading: "AI Assistant",
    },
    {
      label: "Use Case Factory",
      url: `${baseUrl}/?view=factory&factoryTab=overview&ui-smoke-mobile-surface=${Date.now()}`,
      heading: "Use Cases",
    },
    {
      label: "Workspace Admin",
      url: `${baseUrl}/?view=admin&ui-smoke-mobile-surface=${Date.now()}`,
      heading: "Settings",
    },
  ];

  await page.setViewportSize({ width: 390, height: 844 });

  for (const surface of surfaces) {
    await page.goto(surface.url, { waitUntil: "load" });
    await page.waitForFunction(
      (heading) => document.body?.innerText.includes(heading),
      surface.heading,
      { timeout: 8000 },
    );
    await expectText(page, surface.heading);

    const layout = await page.evaluate((label) => {
      const viewportWidth = window.innerWidth;
      const appScroller = document.querySelector('[data-testid="app-content-scroll"]');
      const bottomNav = document.querySelector('nav[aria-label="Primary mobile navigation"]');

      function isVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left < viewportWidth &&
          rect.right > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0"
        );
      }

      function hasIntentionalHorizontalScrollAncestor(element) {
        let current = element.parentElement;
        while (current && current !== appScroller) {
          const style = window.getComputedStyle(current);
          const scrollable = style.overflowX === "auto" || style.overflowX === "scroll";
          if (scrollable && current.scrollWidth > current.clientWidth + 1) return true;
          current = current.parentElement;
        }
        return false;
      }

      const selector = [
        "button",
        "a[href]",
        "[role='tab']",
        "input",
        "textarea",
        "select",
        "summary",
      ].join(",");

      const clippedControls = Array.from(appScroller?.querySelectorAll(selector) ?? [])
        .filter((element) => {
          if (!isVisible(element) || hasIntentionalHorizontalScrollAncestor(element)) return false;
          const rect = element.getBoundingClientRect();
          return rect.left < viewportWidth && rect.right > viewportWidth + 1;
        })
        .slice(0, 8)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            role: element.getAttribute("role"),
            label: element.getAttribute("aria-label"),
            text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90),
            className: String(element.getAttribute("class") || "").slice(0, 120),
            left: Math.round(rect.left * 10) / 10,
            right: Math.round(rect.right * 10) / 10,
            width: Math.round(rect.width * 10) / 10,
          };
        });

      const bottomNavRect = bottomNav?.getBoundingClientRect();

      return {
        label,
        scrollerOverflowX: appScroller ? appScroller.scrollWidth - appScroller.clientWidth : null,
        pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        clippedControls,
        bottomNavVisible: Boolean(bottomNavRect && bottomNavRect.width > 0 && bottomNavRect.bottom <= window.innerHeight + 1),
      };
    }, surface.label);

    assert(layout.scrollerOverflowX !== null, `${surface.label} should expose the app content scroller`);
    assert(layout.scrollerOverflowX <= 1, `${surface.label} should not create app-level horizontal overflow: ${JSON.stringify(layout)}`);
    assert(layout.pageOverflowX <= 1, `${surface.label} should not create document horizontal overflow: ${JSON.stringify(layout)}`);
    assert(layout.clippedControls.length === 0, `${surface.label} has clipped mobile controls: ${JSON.stringify(layout.clippedControls)}`);
    assert(layout.bottomNavVisible, `${surface.label} bottom navigation should remain visible`);
    await expectVisibleControlSize(page, 'button[aria-label="Back to Home"]', `${surface.label} mobile Back to Home`);
  }
}

async function expectMobileRouteSurfaceAudit(page) {
  const routes = nestedRouteSurfaceAuditRoutes;

  await page.setViewportSize({ width: 390, height: 844 });

  for (const [index, route] of routes.entries()) {
    await page.goto(`${baseUrl}/${route.query}&ui-smoke-mobile-route=${Date.now()}-${index}`, { waitUntil: "load" });
    await page.waitForFunction(
      (heading) => {
        const headings = Array.isArray(heading) ? heading : [heading];
        return Array.from(document.querySelectorAll("h1")).some((h1) =>
          headings.some((expected) => h1.textContent?.includes(expected)),
        );
      },
      route.heading,
      { timeout: 8000 },
    );

    const audit = await page.evaluate((routeLabel) => {
      function intersect(a, b) {
        const left = Math.max(a.left, b.left);
        const top = Math.max(a.top, b.top);
        const right = Math.min(a.right, b.right);
        const bottom = Math.min(a.bottom, b.bottom);
        return {
          left,
          top,
          right,
          bottom,
          width: Math.max(0, right - left),
          height: Math.max(0, bottom - top),
        };
      }

      function visibleStyle(element) {
        const style = window.getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0.01
        );
      }

      function clippedRectFor(element) {
        const raw = element.getBoundingClientRect();
        let clip = {
          left: raw.left,
          top: raw.top,
          right: raw.right,
          bottom: raw.bottom,
          width: raw.width,
          height: raw.height,
        };
        clip = intersect(clip, { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight });

        let current = element.parentElement;
        while (current && current !== document.body && current !== document.documentElement) {
          const style = window.getComputedStyle(current);
          const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
          if (/auto|scroll|hidden|clip/.test(overflow)) {
            const parentRect = current.getBoundingClientRect();
            clip = intersect(clip, {
              left: parentRect.left,
              top: parentRect.top,
              right: parentRect.right,
              bottom: parentRect.bottom,
            });
          }
          current = current.parentElement;
        }

        return { raw, clip };
      }

      function isVisible(element) {
        if (!visibleStyle(element)) return false;
        const { raw, clip } = clippedRectFor(element);
        return raw.width > 0 && raw.height > 0 && clip.width > 1 && clip.height > 1;
      }

      function readableName(element) {
        return (
          element.getAttribute("aria-label") ||
          element.getAttribute("title") ||
          element.getAttribute("alt") ||
          element.getAttribute("placeholder") ||
          element.getAttribute("value") ||
          element.textContent ||
          ""
        ).replace(/\s+/g, " ").trim();
      }

      function describe(element) {
        const { raw } = clippedRectFor(element);
        return {
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute("role") || "",
          name: readableName(element).slice(0, 120),
          testId: element.getAttribute("data-testid") || "",
          className: String(element.getAttribute("class") || "").slice(0, 140),
          rect: {
            x: Math.round(raw.x),
            y: Math.round(raw.y),
            width: Math.round(raw.width),
            height: Math.round(raw.height),
          },
        };
      }

      function ignoredControl(element) {
        return Boolean(element.closest(".react-flow__attribution"));
      }

      function hasIntentionalHorizontalScrollAncestor(element) {
        const appScroller = document.querySelector('[data-testid="app-content-scroll"]');
        let current = element.parentElement;
        while (current && current !== appScroller && current !== document.body) {
          const style = window.getComputedStyle(current);
          const scrollable = style.overflowX === "auto" || style.overflowX === "scroll";
          if (scrollable && current.scrollWidth > current.clientWidth + 1) return true;
          current = current.parentElement;
        }
        return false;
      }

      function collect(position) {
        const appScroller = document.querySelector('[data-testid="app-content-scroll"]');
        const bottomNav = document.querySelector('nav[aria-label="Primary mobile navigation"]');
        const navRect = bottomNav && isVisible(bottomNav) ? bottomNav.getBoundingClientRect() : null;
        const controls = Array.from(
          document.querySelectorAll(
            "button, a[href], input, select, textarea, summary, [role='button'], [role='tab'], [role='menuitem'], [tabindex]:not([tabindex='-1'])",
          ),
        ).filter((element) => isVisible(element) && !ignoredControl(element) && !bottomNav?.contains(element));

        const smallControls = controls
          .filter((element) => {
            const { raw } = clippedRectFor(element);
            return raw.width < 32 || raw.height < 32;
          })
          .slice(0, 8)
          .map(describe);

        const unnamedControls = controls
          .filter((element) => {
            const tag = element.tagName.toLowerCase();
            const role = element.getAttribute("role");
            return (tag === "button" || tag === "a" || role === "button" || role === "tab") && !readableName(element);
          })
          .slice(0, 8)
          .map(describe);

        const clippedControls = controls
          .filter((element) => {
            if (hasIntentionalHorizontalScrollAncestor(element)) return false;
            const { raw } = clippedRectFor(element);
            return raw.left < -1 || raw.right > window.innerWidth + 1;
          })
          .slice(0, 8)
          .map(describe);

        const bottomNavOverlaps = controls
          .filter((element) => {
            if (!navRect) return false;
            const { clip } = clippedRectFor(element);
            const overlap = intersect(clip, {
              left: navRect.left,
              top: navRect.top,
              right: navRect.right,
              bottom: navRect.bottom,
            });
            return overlap.width > 2 && overlap.height > 2;
          })
          .slice(0, 8)
          .map(describe);

        return {
          position,
          scroll: appScroller
            ? {
                top: Math.round(appScroller.scrollTop),
                max: Math.round(appScroller.scrollHeight - appScroller.clientHeight),
              }
            : null,
          smallControls,
          unnamedControls,
          clippedControls,
          bottomNavOverlaps,
        };
      }

      const appScroller = document.querySelector('[data-testid="app-content-scroll"]');
      const top = collect("top");
      if (appScroller) appScroller.scrollTop = appScroller.scrollHeight;
      const bottom = collect("bottom");

      return {
        routeLabel,
        h1: Array.from(document.querySelectorAll("h1")).map((h1) => h1.textContent?.trim()).filter(Boolean),
        top,
        bottom,
      };
    }, route.label);

    for (const state of [audit.top, audit.bottom]) {
      assert(
        state.smallControls.length === 0,
        `${route.label} mobile ${state.position} state has visible controls below 32px: ${JSON.stringify(audit)}`,
      );
      assert(
        state.unnamedControls.length === 0,
        `${route.label} mobile ${state.position} state has unnamed visible controls: ${JSON.stringify(audit)}`,
      );
      assert(
        state.clippedControls.length === 0,
        `${route.label} mobile ${state.position} state has clipped visible controls: ${JSON.stringify(audit)}`,
      );
      assert(
        state.bottomNavOverlaps.length === 0,
        `${route.label} mobile ${state.position} state has controls hidden by bottom nav: ${JSON.stringify(audit)}`,
      );
    }
  }
}

async function expectDesktopInteractionAffordanceAudit(page) {
  const routes = nestedRouteSurfaceAuditRoutes;

  await page.setViewportSize({ width: 1440, height: 820 });

  for (const [index, route] of routes.entries()) {
    await page.goto(`${baseUrl}/${route.query}&ui-smoke-desktop-affordance=${Date.now()}-${index}`, { waitUntil: "load" });
    await page.waitForFunction(
      (heading) => {
        const headings = Array.isArray(heading) ? heading : [heading];
        return Array.from(document.querySelectorAll("h1")).some((h1) =>
          headings.some((expected) => h1.textContent?.includes(expected)),
        );
      },
      route.heading,
      { timeout: 8000 },
    );

    const audit = await page.evaluate((routeLabel) => {
      function isVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }

      function readableName(element) {
        return (
          element.getAttribute("aria-label") ||
          element.getAttribute("title") ||
          element.getAttribute("placeholder") ||
          element.getAttribute("value") ||
          element.textContent ||
          ""
        ).replace(/\s+/g, " ").trim();
      }

      function describedByText(element) {
        return (element.getAttribute("aria-describedby") || "")
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.replace(/\s+/g, " ").trim() || "")
          .filter(Boolean)
          .join(" ");
      }

      function describe(element) {
        const rect = element.getBoundingClientRect();
        const readable = readableName(element);
        return {
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute("role") || "",
          type: element.getAttribute("type") || "",
          name: readable.slice(0, 140),
          nameLength: readable.length,
          title: element.getAttribute("title") || "",
          href: element.tagName.toLowerCase() === "a" ? element.getAttribute("href") || "" : "",
          testId: element.getAttribute("data-testid") || "",
          ariaControls: element.getAttribute("aria-controls") || "",
          ariaSelected: element.getAttribute("aria-selected") || "",
          disabled: element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true",
          descriptionText: describedByText(element).slice(0, 180),
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      }

      function ignoredControl(element) {
        return Boolean(element.closest(".react-flow__attribution"));
      }

      const controls = Array.from(
        document.querySelectorAll(
          "button, a[href], input, select, textarea, summary, [role='button'], [role='tab'], [role='menuitem'], [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((element) => isVisible(element) && !ignoredControl(element));

      const unnamedControls = controls
        .filter((element) => {
          const tag = element.tagName.toLowerCase();
          const role = element.getAttribute("role") || "";
          return (tag === "button" || tag === "a" || tag === "summary" || role === "button" || role === "tab" || role === "menuitem") && !readableName(element);
        })
        .slice(0, 8)
        .map(describe);

      const smallControls = controls
        .filter((element) => {
          const tag = element.tagName.toLowerCase();
          const role = element.getAttribute("role") || "";
          const type = element.getAttribute("type") || "";
          if (tag === "input" && (type === "checkbox" || type === "radio")) return false;
          if (!(tag === "button" || tag === "a" || role === "button" || role === "tab")) return false;
          const rect = element.getBoundingClientRect();
          return rect.width < 32 || rect.height < 32;
        })
        .slice(0, 8)
        .map(describe);

      const disabledWithoutExplanation = controls
        .filter((element) => {
          const disabled = element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
          return disabled && !element.getAttribute("title") && !describedByText(element);
        })
        .slice(0, 8)
        .map(describe);

      const deadLinks = controls
        .filter((element) => {
          if (element.tagName.toLowerCase() !== "a") return false;
          const href = element.getAttribute("href") || "";
          return href === "#" || /^javascript:/i.test(href);
        })
        .slice(0, 8)
        .map(describe);

      const tabsMissingState = controls
        .filter((element) => element.getAttribute("role") === "tab" && !element.getAttribute("aria-selected"))
        .slice(0, 8)
        .map(describe);

      const selectedTabsWithoutMountedPanels = controls
        .filter((element) => {
          if (element.getAttribute("role") !== "tab" || element.getAttribute("aria-selected") !== "true") return false;
          const controlsId = element.getAttribute("aria-controls") || "";
          return !controlsId || !document.getElementById(controlsId);
        })
        .slice(0, 8)
        .map(describe);

      const invalidAriaReferences = controls
        .filter((element) => {
          const controlsId = element.getAttribute("aria-controls") || "";
          if (controlsId && !document.getElementById(controlsId)) return true;
          const labelledBy = element.getAttribute("aria-labelledby") || "";
          return labelledBy.split(/\s+/).some((id) => id && !document.getElementById(id));
        })
        .slice(0, 8)
        .map(describe);

      const longUnlabeledButtonNames = controls
        .filter((element) => {
          if (element.tagName.toLowerCase() !== "button") return false;
          if (element.getAttribute("aria-label")) return false;
          return readableName(element).length > 140;
        })
        .slice(0, 8)
        .map(describe);

      return {
        routeLabel,
        controlCount: controls.length,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        unnamedControls,
        smallControls,
        disabledWithoutExplanation,
        deadLinks,
        tabsMissingState,
        selectedTabsWithoutMountedPanels,
        invalidAriaReferences,
        longUnlabeledButtonNames,
      };
    }, route.label);

    assert(audit.overflowX <= 1, `${route.label} desktop page should not overflow horizontally: ${JSON.stringify(audit)}`);
    assert(audit.unnamedControls.length === 0, `${route.label} desktop controls should have readable names: ${JSON.stringify(audit)}`);
    assert(audit.smallControls.length === 0, `${route.label} desktop action controls should keep at least 32px hit areas: ${JSON.stringify(audit)}`);
    assert(
      audit.disabledWithoutExplanation.length === 0,
      `${route.label} disabled controls should explain why they are unavailable: ${JSON.stringify(audit)}`,
    );
    assert(audit.deadLinks.length === 0, `${route.label} desktop controls should not expose dead hash/javascript links: ${JSON.stringify(audit)}`);
    assert(audit.tabsMissingState.length === 0, `${route.label} desktop tabs should expose aria-selected: ${JSON.stringify(audit)}`);
    assert(
      audit.selectedTabsWithoutMountedPanels.length === 0,
      `${route.label} selected desktop tabs should control their mounted tabpanel: ${JSON.stringify(audit)}`,
    );
    assert(
      audit.invalidAriaReferences.length === 0,
      `${route.label} desktop controls should not point aria references at missing DOM: ${JSON.stringify(audit)}`,
    );
    assert(
      audit.longUnlabeledButtonNames.length === 0,
      `${route.label} desktop card buttons should use concise aria-labels instead of full card copy: ${JSON.stringify(audit)}`,
    );
  }
}

async function expectTabletShellHeaderLayout(page) {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`${baseUrl}/?view=evidence&ui-smoke-tablet-shell=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Proof Ledger"),
    null,
    { timeout: 8000 },
  );

  const layout = await page.evaluate(() => {
    const header = document.querySelector("main header");
    const fullSearch = document.querySelector('[data-testid="workspace-search-input"]');
    const compactSearch = Array.from(header?.querySelectorAll("button") ?? []).find(
      (button) => button.getAttribute("aria-label") === "Search",
    );

    function isVisible(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    }

    const clippedControls = Array.from(header?.querySelectorAll("button,input") ?? [])
      .filter((element) => {
        if (!isVisible(element)) return false;
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > window.innerWidth + 1;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label: element.getAttribute("aria-label") || element.textContent?.replace(/\s+/g, " ").trim() || "",
          left: Math.round(rect.left * 10) / 10,
          right: Math.round(rect.right * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
        };
      });

    return {
      headerExists: Boolean(header),
      headerOverflowX: header ? header.scrollWidth - header.clientWidth : null,
      fullSearchVisible: isVisible(fullSearch),
      compactSearchVisible: isVisible(compactSearch),
      clippedControls,
    };
  });

  assert(layout.headerExists, `tablet shell should render the workspace header: ${JSON.stringify(layout)}`);
  assert(layout.headerOverflowX !== null && layout.headerOverflowX <= 1, `tablet shell header should not overflow horizontally: ${JSON.stringify(layout)}`);
  assert(!layout.fullSearchVisible, `tablet shell should hide the full search input: ${JSON.stringify(layout)}`);
  assert(layout.compactSearchVisible, `tablet shell should expose the compact search action: ${JSON.stringify(layout)}`);
  assert(layout.clippedControls.length === 0, `tablet shell has clipped header controls: ${JSON.stringify(layout.clippedControls)}`);

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${baseUrl}/?view=admin&ui-smoke-tablet-page-header=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Settings"),
    null,
    { timeout: 8000 },
  );

  const pageHeaderLayout = await page.evaluate(() => {
    const header = document.querySelector('[data-testid="page-header"]');
    const copy = header?.firstElementChild;
    const action = header?.querySelector('[data-testid="page-header-actions"]');
    const title = header?.querySelector("h1");
    const headerRect = header?.getBoundingClientRect();
    const copyRect = copy?.getBoundingClientRect();
    const actionRect = action?.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    const overlaps =
      Boolean(copyRect && actionRect) &&
      copyRect.left < actionRect.right &&
      copyRect.right > actionRect.left &&
      copyRect.top < actionRect.bottom &&
      copyRect.bottom > actionRect.top;

    return {
      header: headerRect ? { width: Math.round(headerRect.width), height: Math.round(headerRect.height) } : null,
      title: titleRect ? { text: title?.textContent?.trim(), width: Math.round(titleRect.width), height: Math.round(titleRect.height) } : null,
      copy: copyRect ? { width: Math.round(copyRect.width), bottom: Math.round(copyRect.bottom) } : null,
      action: actionRect ? { width: Math.round(actionRect.width), top: Math.round(actionRect.top) } : null,
      overlaps,
    };
  });

  assert(pageHeaderLayout.header, `tablet page header should render: ${JSON.stringify(pageHeaderLayout)}`);
  assert(pageHeaderLayout.title?.width >= 240, `tablet page header title should not be squeezed: ${JSON.stringify(pageHeaderLayout)}`);
  assert(!pageHeaderLayout.overlaps, `tablet page header copy and actions should not overlap: ${JSON.stringify(pageHeaderLayout)}`);
}

async function expectNavigationHeadingConsistency(page) {
  const surfaces = [
    ["command", "Home"],
    ["orchestrator", "AI Assistant"],
    ["estate", "AI Inventory"],
    ["blueprint", "Company Plan"],
    ["strategy", "AI Roadmap"],
    ["process", "Process Redesign"],
    ["work", "Work Signals"],
    ["factory", "Use Cases"],
    ["harness", "AI Harness"],
    ["skills", "AI Skills"],
    ["workflow", "Workflow Builder"],
    ["connectors", "Connect Apps"],
    ["broker", "Tool Permissions"],
    ["context", "Knowledge Sources"],
    ["evals", "Quality Evals"],
    ["governance", "Risk Review"],
    ["launch", "Launch Plan"],
    ["evidence", "Proof Ledger"],
    ["roi", "Value & ROI"],
    ["training", "Adoption Plan"],
    ["reports", "Reports"],
    ["admin", "Settings"],
  ];

  await page.setViewportSize({ width: 1360, height: 860 });

  for (const [view, heading] of surfaces) {
    await page.goto(`${baseUrl}/?view=${view}&ui-smoke-ia=${Date.now()}`, { waitUntil: "load" });
    await page.waitForFunction(
      (expectedHeading) =>
        Array.from(document.querySelectorAll('[data-testid="app-content-scroll"] h1')).some(
          (element) => element.textContent?.replace(/\s+/g, " ").trim() === expectedHeading,
        ),
      heading,
      { timeout: 8000 },
    );
    await page.waitForFunction(
      (expectedHeading) =>
        document.title.includes(expectedHeading) && document.title.includes("Enterprise AI Enablement OS"),
      heading,
      { timeout: 8000 },
    );

    const layout = await page.evaluate((expectedHeading) => {
      const appScroller = document.querySelector('[data-testid="app-content-scroll"]');
      const h1s = Array.from(document.querySelectorAll('[data-testid="app-content-scroll"] h1'))
        .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const activeNav = Array.from(document.querySelectorAll('aside nav [aria-current="page"]'))
        .map((element) => (element.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const currentPageLabels = Array.from(document.querySelectorAll('[aria-current="page"]'))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        })
        .map((element) => (element.textContent || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim())
        .filter(Boolean);

      return {
        h1s,
        activeNav,
        currentPageLabels,
        pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        appOverflowX: appScroller ? appScroller.scrollWidth - appScroller.clientWidth : null,
        documentTitle: document.title,
        headingMatched: h1s.includes(expectedHeading),
        activeNavMatched: activeNav.some((label) => label.startsWith(expectedHeading)),
        titleMatched:
          document.title.includes(expectedHeading) && document.title.includes("Enterprise AI Enablement OS"),
      };
    }, heading);

    assert(layout.headingMatched, `${view} should render H1 ${heading}: ${JSON.stringify(layout)}`);
    assert(layout.activeNavMatched, `${view} should expose matching active nav ${heading}: ${JSON.stringify(layout)}`);
    assert(layout.currentPageLabels.length === 1, `${view} should expose exactly one current page target: ${JSON.stringify(layout)}`);
    assert(layout.titleMatched, `${view} should update document title for ${heading}: ${JSON.stringify(layout)}`);
    assert(layout.pageOverflowX <= 1, `${view} should not create document horizontal overflow: ${JSON.stringify(layout)}`);
    assert((layout.appOverflowX ?? 0) <= 1, `${view} should not create app horizontal overflow: ${JSON.stringify(layout)}`);
    await assertVisibleButtonsAreNamed(page, `${heading} surface`);
    await assertVisibleFormControlsAreNamed(page, `${heading} surface`);
  }
}

async function expectNestedRouteWayfinding(page) {
  const cases = [
    {
      label: "Use Case Intake",
      url: `${baseUrl}/?view=factory&factoryTab=intake&ui-smoke-nested=${Date.now()}-intake`,
      h1: "Use Cases",
      titleIncludes: "Use Case Intake",
      announcementIncludes: "Use Case Intake",
    },
    {
      label: "Use Case Backlog",
      url: `${baseUrl}/?view=factory&factoryTab=backlog&ui-smoke-nested=${Date.now()}-backlog`,
      h1: "Use Cases",
      titleIncludes: "Use Case Backlog",
      announcementIncludes: "Use Case Backlog",
    },
    {
      label: "Skill Prompt",
      url: `${baseUrl}/?view=skills&skillMode=detail&skillTab=prompt&ui-smoke-nested=${Date.now()}-skill-prompt`,
      h1: "AI Skills",
      titleIncludes: "Prompt",
      announcementIncludes: "Prompt",
    },
    {
      label: "Guided Workflow Builder",
      url: `${baseUrl}/?view=workflow&workflowMode=editor&ui-smoke-nested=${Date.now()}-workflow-editor`,
      h1: "Guided Workflow Builder",
      titleIncludes: "Guided Workflow Builder",
      announcementIncludes: "Guided Workflow Builder",
    },
    {
      label: "Harness Runs",
      url: `${baseUrl}/?view=harness&harnessMode=runs&ui-smoke-nested=${Date.now()}-harness-runs`,
      h1: "Harness Runs",
      titleIncludes: "Harness Runs",
      announcementIncludes: "Harness Runs",
    },
    {
      label: "Harness Run Detail",
      url: `${baseUrl}/?view=harness&harnessMode=detail&ui-smoke-nested=${Date.now()}-harness-detail`,
      h1: ["Run 1001", "AI Harness"],
      titleIncludes: "Harness Run",
      announcementIncludes: "Harness Run",
    },
    {
      label: "Skill Session",
      url: `${baseUrl}/?view=session&skillId=sk-hr-helpdesk&ui-smoke-nested=${Date.now()}-session`,
      h1: ["HR Policy Helpdesk", "Skill Session"],
      titleIncludes: "Session",
      announcementIncludes: "Session",
    },
  ];

  await page.setViewportSize({ width: 1360, height: 860 });

  for (const item of cases) {
    await page.goto(item.url, { waitUntil: "load" });
    await page.waitForFunction(
      (expectedHeading) => {
        const headings = Array.isArray(expectedHeading) ? expectedHeading : [expectedHeading];
        return Array.from(document.querySelectorAll('[data-testid="app-content-scroll"] h1')).some((element) => {
          const text = element.textContent?.replace(/\s+/g, " ").trim();
          return headings.includes(text ?? "");
        });
      },
      item.h1,
      { timeout: 8000 },
    );
    await page.waitForFunction(
      (titleIncludes) => document.title.includes(titleIncludes) && document.title.includes("Enterprise AI Enablement OS"),
      item.titleIncludes,
      { timeout: 8000 },
    );

    const state = await page.evaluate((expected) => {
      const announcement = document.querySelector('[data-testid="workspace-page-announcement"]')?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const shellLabel = document.querySelector("main header")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const currentPageLabels = Array.from(document.querySelectorAll('[aria-current="page"]'))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        })
        .map((element) => (element.textContent || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim())
        .filter(Boolean);

      return {
        title: document.title,
        announcement,
        shellLabel,
        currentPageLabels,
        titleMatched: document.title.includes(expected.titleIncludes),
        announcementMatched: announcement.includes(expected.announcementIncludes),
        shellMatched: shellLabel.includes(expected.announcementIncludes),
      };
    }, item);

    assert(state.titleMatched, `${item.label} should update the document title: ${JSON.stringify(state)}`);
    assert(state.announcementMatched, `${item.label} should update the live page announcement: ${JSON.stringify(state)}`);
    assert(state.shellMatched, `${item.label} should update the shell header label: ${JSON.stringify(state)}`);
    assert(state.currentPageLabels.length === 1, `${item.label} should expose one current page target: ${JSON.stringify(state)}`);
  }
}

async function expectHarnessRunsActionPrerequisites(page) {
  await page.setViewportSize({ width: 1360, height: 860 });
  await page.goto(`${baseUrl}/?view=harness&harnessMode=runs&ui-smoke-harness-runs-actions=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('[data-testid="app-content-scroll"] h1')).some(
        (element) => element.textContent?.replace(/\s+/g, " ").trim() === "Harness Runs",
      ),
    null,
    { timeout: 8000 },
  );

  const state = await page.evaluate(() => {
    const visibleText = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (rect.width <= 0 || rect.height <= 0 || style.display === "none" || style.visibility === "hidden") return "";
      return (element.textContent || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    };
    const headerActions = Array.from(document.querySelectorAll('[data-testid="page-header-actions"] button'))
      .map(visibleText)
      .filter(Boolean);
    const pageActions = Array.from(document.querySelectorAll('[data-testid="app-content-scroll"] button'))
      .map(visibleText)
      .filter(Boolean);
    const pageText = document.querySelector('[data-testid="app-content-scroll"]')?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const emptyAction = pageActions.find((label) => label === "Open AI Skills" || /Run selected Skill/i.test(label)) ?? "";

    return {
      headerActions,
      emptyAction,
      hasNoRunHistory: pageText.includes("No run history yet"),
      hasOpenSkillsAction: pageActions.includes("Open AI Skills"),
      hasRunSelectedAction: pageActions.some((label) => /Run selected Skill/i.test(label)),
    };
  });

  if (state.hasNoRunHistory && state.emptyAction === "Open AI Skills") {
    assert(
      state.headerActions.includes("Open AI Skills"),
      `empty Harness runs should route the header action to AI Skills when no runnable Skill exists: ${JSON.stringify(state)}`,
    );
    assert(
      !state.headerActions.some((label) => /Run selected Skill/i.test(label)),
      `empty Harness runs should not offer a misleading Run Selected Skill header action: ${JSON.stringify(state)}`,
    );
  }

  if (state.hasNoRunHistory && /Run selected Skill/i.test(state.emptyAction)) {
    assert(
      state.headerActions.some((label) => /Run selected Skill/i.test(label)),
      `Harness runs header should match the empty-state run action when a runnable Skill exists: ${JSON.stringify(state)}`,
    );
  }
}

async function expectEmptyStateActionIconography(page) {
  await page.setViewportSize({ width: 1360, height: 860 });
  await page.goto(`${baseUrl}/?view=harness&harnessMode=runs&ui-smoke-empty-icons=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('[data-testid="app-content-scroll"] h1')).some(
        (element) => element.textContent?.replace(/\s+/g, " ").trim() === "Harness Runs",
      ),
    null,
    { timeout: 8000 },
  );

  const state = await page.evaluate(() => {
    const emptyAction = Array.from(document.querySelectorAll('[data-empty-state-action-kind]')).find((element) =>
      ["Open AI Skills", "Run selected Skill"].includes(element.textContent?.replace(/\s+/g, " ").trim() ?? ""),
    );
    const firstRunAction = Array.from(document.querySelectorAll('table button')).find((element) =>
      /^run-\d+/i.test(element.textContent?.replace(/\s+/g, " ").trim() ?? ""),
    );
    const rect = emptyAction?.getBoundingClientRect();
    const runRect = firstRunAction?.getBoundingClientRect();
    return {
      found: Boolean(emptyAction),
      label: emptyAction?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      kind: emptyAction?.getAttribute("data-empty-state-action-kind") ?? "",
      width: rect ? Math.round(rect.width) : 0,
      height: rect ? Math.round(rect.height) : 0,
      hasRunLedgerAction: Boolean(firstRunAction),
      runActionLabel: firstRunAction?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      runActionWidth: runRect ? Math.round(runRect.width) : 0,
      runActionHeight: runRect ? Math.round(runRect.height) : 0,
    };
  });

  if (!state.found && state.hasRunLedgerAction) {
    assert(
      state.runActionWidth >= 32 && state.runActionHeight >= 32,
      `populated Harness runs ledger should expose reliable run actions: ${JSON.stringify(state)}`,
    );
    return;
  }

  assert(state.found, `Harness empty state should expose a useful action: ${JSON.stringify(state)}`);
  assert(
    (state.label === "Open AI Skills" && state.kind === "library") ||
      (state.label === "Run selected Skill" && state.kind === "run"),
    `Harness empty-state action should use the correct visual kind: ${JSON.stringify(state)}`,
  );
  assert(state.width >= 36 && state.height >= 36, `empty-state action should keep a reliable hit area: ${JSON.stringify(state)}`);
}

async function expectWorkspaceShellAccessibility(page) {
  await page.setViewportSize({ width: 1360, height: 860 });
  await page.goto(`${baseUrl}/?view=evidence&ui-smoke-a11y=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Proof Ledger"),
    null,
    { timeout: 8000 },
  );

  const shell = await page.evaluate(() => {
    const main = document.querySelector('main[aria-label="Enterprise AI workspace"]');
    const desktopNav = document.querySelector('aside nav[aria-label="Primary workspace navigation"]');
    const content = document.querySelector("#workspace-main-content");
    const skipLink = document.querySelector("a.ea-skip-link");
    const announcement = document.querySelector('[data-testid="workspace-page-announcement"]');
    const saveStatus = document.querySelector('[data-testid="workspace-save-status"]');
    const allSections = document.querySelector('[data-testid="nav-all-sections"]');
    const allSectionsToggle = document.querySelector('[data-testid="nav-all-sections"] button[aria-controls="primary-nav-scroll"]');
    const launchStatusButton = Array.from(document.querySelectorAll("main header button")).find((button) =>
      /launch (ready|warnings|blockers)/i.test(button.textContent?.replace(/\s+/g, " ").trim() ?? ""),
    );
    const backButton = document.querySelector('main header button[aria-label="Back to Home"]');
    const commandButton = document.querySelector('[data-testid="command-menu-opener"]');
    const wayfinderNextButton = document.querySelector('[data-testid="section-wayfinder-next"]');
    const hubButtons = Array.from(document.querySelectorAll('aside nav [data-testid^="nav-hub-"]'));
    const navScroller = document.querySelector('[data-testid="primary-nav-scroll"]');
    const navCard = document.querySelector('[data-testid="nav-intent-shortcuts"]');
    const adminButton = Array.from(document.querySelectorAll("aside button")).find(
      (button) => button.getAttribute("aria-label") === "Workspace Admin",
    );
    const adminLabel = adminButton?.querySelector('[data-testid="workspace-admin-label"]');
    const clippedNavLabels = Array.from(document.querySelectorAll("aside nav [data-nav-view] [data-nav-label]"))
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => ({
        label: element.textContent?.replace(/\s+/g, " ").trim() ?? "",
        width: Math.round(element.clientWidth),
        scrollWidth: Math.round(element.scrollWidth),
      }));
    const shellControlSize = (element) => {
      const rect = element?.getBoundingClientRect();
      return rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : { width: 0, height: 0 };
    };
    const navScrollerRect = navScroller?.getBoundingClientRect();
    const navCardRect = navCard?.getBoundingClientRect();
    const adminRect = adminButton?.getBoundingClientRect();
    const hiddenNavItems = Array.from(document.querySelectorAll("aside nav [data-nav-view]")).filter((element) => {
      const rect = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      return rect.width <= 0 || rect.height <= 0 || styles.display === "none" || styles.visibility === "hidden";
    });

    return {
      hasMain: Boolean(main),
      hasDesktopNav: Boolean(desktopNav),
      contentRole: content?.getAttribute("role"),
      contentLabel: content?.getAttribute("aria-label"),
      contentTabIndex: content?.getAttribute("tabindex"),
      skipText: skipLink?.textContent?.trim() ?? null,
      announcementText: announcement?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      saveStatusRole: saveStatus?.getAttribute("role") ?? "",
      saveStatusLive: saveStatus?.getAttribute("aria-live") ?? "",
      saveStatusAtomic: saveStatus?.getAttribute("aria-atomic") ?? "",
      saveStatusLabel: saveStatus?.getAttribute("aria-label") ?? "",
      saveStatusText: saveStatus?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      launchStatusButtonText: launchStatusButton?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      launchStatusButtonLabel: launchStatusButton?.getAttribute("aria-label") ?? "",
      launchStatusButtonTitle: launchStatusButton?.getAttribute("title") ?? "",
      backButtonSize: shellControlSize(backButton),
      launchStatusButtonSize: shellControlSize(launchStatusButton),
      commandButtonSize: shellControlSize(commandButton),
      wayfinderNextButtonSize: shellControlSize(wayfinderNextButton),
      allSectionsOpen: allSections?.getAttribute("data-open") === "true",
      allSectionsToggleExpanded: allSectionsToggle?.getAttribute("aria-expanded") ?? "",
      allSectionsToggleControls: allSectionsToggle?.getAttribute("aria-controls") ?? "",
      hubCount: hubButtons.length,
      collapsedHubLabels: hubButtons
        .filter((button) => button.getAttribute("aria-expanded") !== "true")
        .map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? ""),
      navItemCount: document.querySelectorAll("aside nav [data-nav-view]").length,
      hiddenNavItemCount: hiddenNavItems.length,
      navScrollerBounded:
        Boolean(navScrollerRect && navCardRect && navScrollerRect.bottom <= navCardRect.bottom + 1),
      navCardGapToAdmin:
        navCardRect && adminRect ? Math.round(adminRect.top - navCardRect.bottom) : null,
      adminLabelText: adminLabel?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      adminLabelClipped: adminLabel ? adminLabel.scrollWidth > adminLabel.clientWidth + 1 : true,
      clippedNavLabels,
    };
  });

  assert(shell.hasMain, `workspace should expose a named main landmark: ${JSON.stringify(shell)}`);
  assert(shell.hasDesktopNav, `desktop rail should expose a named primary navigation: ${JSON.stringify(shell)}`);
  assert(shell.contentRole === "region", `workspace content should be a named region: ${JSON.stringify(shell)}`);
  assert(shell.contentLabel === "Proof Ledger content", `workspace content label should match current surface: ${JSON.stringify(shell)}`);
  assert(shell.contentTabIndex === "-1", `workspace content should be programmatically focusable: ${JSON.stringify(shell)}`);
  assert(shell.skipText === "Skip to workspace content", `workspace should expose a skip link: ${JSON.stringify(shell)}`);
  assert(
    shell.announcementText?.startsWith("Proof Ledger loaded"),
    `workspace should announce the loaded surface: ${JSON.stringify(shell)}`,
  );
  assert(shell.saveStatusRole === "status", `workspace autosave should expose a status region: ${JSON.stringify(shell)}`);
  assert(shell.saveStatusLive === "polite", `workspace autosave status should announce politely: ${JSON.stringify(shell)}`);
  assert(shell.saveStatusAtomic === "true", `workspace autosave status should announce atomically: ${JSON.stringify(shell)}`);
  assert(
    /^(Ready|Saving|Saved|Local fallback|Sync delayed|Sync disabled)/.test(shell.saveStatusText),
    `workspace autosave status should expose current state text: ${JSON.stringify(shell)}`,
  );
  assert(
    /Workspace persistence|workspace snapshot|Server snapshot|Server sync failed|retry later|cannot write/.test(shell.saveStatusLabel),
    `workspace autosave status should describe what the state means: ${JSON.stringify(shell)}`,
  );
  assert(
    /^Open Launch Plan: .+launch (ready|warnings|blockers)$/i.test(shell.launchStatusButtonLabel),
    `workspace launch status control should announce its navigation action: ${JSON.stringify(shell)}`,
  );
  assert(
    shell.launchStatusButtonTitle === shell.launchStatusButtonLabel,
    `workspace launch status control should expose matching hover copy: ${JSON.stringify(shell)}`,
  );
  assert(
    shell.backButtonSize.width >= 36 && shell.backButtonSize.height >= 36,
    `workspace back control should keep a 36px shell target: ${JSON.stringify(shell)}`,
  );
  assert(
    shell.launchStatusButtonSize.width >= 36 && shell.launchStatusButtonSize.height >= 36,
    `workspace launch status control should keep a 36px shell target: ${JSON.stringify(shell)}`,
  );
  assert(
    shell.commandButtonSize.width >= 36 && shell.commandButtonSize.height >= 36,
    `workspace command menu control should keep a 36px shell target: ${JSON.stringify(shell)}`,
  );
  assert(
    shell.wayfinderNextButtonSize.width >= 36 && shell.wayfinderNextButtonSize.height >= 36,
    `workspace wayfinder next control should keep a 36px shell target: ${JSON.stringify(shell)}`,
  );
  assert(shell.allSectionsOpen, `workspace section map should be expanded by default: ${JSON.stringify(shell)}`);
  assert(shell.allSectionsToggleExpanded === "true", `workspace section map toggle should expose expanded state: ${JSON.stringify(shell)}`);
  assert(shell.allSectionsToggleControls === "primary-nav-scroll", `workspace section map toggle should own the scroll region: ${JSON.stringify(shell)}`);
  assert(shell.hubCount >= 5, `workspace should expose all desktop nav hubs: ${JSON.stringify(shell)}`);
  assert(shell.collapsedHubLabels.length === 0, `workspace nav hubs should start expanded: ${JSON.stringify(shell)}`);
  assert(shell.navItemCount >= 20, `workspace should render the full navigation map by default: ${JSON.stringify(shell)}`);
  assert(shell.hiddenNavItemCount === 0, `expanded workspace nav items should be visible: ${JSON.stringify(shell)}`);
  assert(shell.navScrollerBounded, `expanded workspace nav scroller should stay inside its rail card: ${JSON.stringify(shell)}`);
  assert((shell.navCardGapToAdmin ?? 0) >= 8, `expanded workspace nav card should reach the admin area without colliding: ${JSON.stringify(shell)}`);
  assert(shell.adminLabelText === "Workspace Admin", `workspace admin label should render fully: ${JSON.stringify(shell)}`);
  assert(!shell.adminLabelClipped, `workspace admin label should not be visually clipped: ${JSON.stringify(shell)}`);
  assert(shell.clippedNavLabels.length === 0, `workspace primary nav labels should not be clipped: ${JSON.stringify(shell)}`);

  const focusStops = [];
  let skipFocus = null;
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(180);
    skipFocus = await page.evaluate((tabIndex) => {
      const skipLink = document.querySelector("a.ea-skip-link");
      const rect = skipLink?.getBoundingClientRect();
      const activeElement = document.activeElement;
      return {
        tabIndex,
        activeTag: activeElement?.tagName ?? null,
        activeText: activeElement?.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ?? null,
        isSkipFocused: activeElement === skipLink,
        isVisible: Boolean(rect && rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0),
      };
    }, index + 1);
    focusStops.push(skipFocus);
    if (skipFocus.isSkipFocused) break;
  }

  assert(skipFocus?.isSkipFocused, `skip link should be reachable before app controls: ${JSON.stringify(focusStops)}`);
  assert(skipFocus.isVisible, `focused skip link should be visible: ${JSON.stringify(skipFocus)}`);

  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement?.id === "workspace-main-content", null, { timeout: 8000 });

  await clickNav(page, "AI Harness");
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("AI Harness") &&
      document.activeElement?.id === "workspace-main-content",
    null,
    { timeout: 8000 },
  );

  const focusAfterNavigation = await page.evaluate(() => ({
    activeId: document.activeElement?.id ?? null,
    contentLabel: document.querySelector("#workspace-main-content")?.getAttribute("aria-label"),
    announcementText:
      document.querySelector('[data-testid="workspace-page-announcement"]')?.textContent?.replace(/\s+/g, " ").trim() ??
      null,
  }));

  assert(
    focusAfterNavigation.activeId === "workspace-main-content",
    `view navigation should reset focus to workspace content: ${JSON.stringify(focusAfterNavigation)}`,
  );
  assert(
    focusAfterNavigation.contentLabel === "AI Harness content",
    `workspace content label should follow navigation: ${JSON.stringify(focusAfterNavigation)}`,
  );
  assert(
    focusAfterNavigation.announcementText?.startsWith("AI Harness loaded"),
    `workspace announcement should follow navigation: ${JSON.stringify(focusAfterNavigation)}`,
  );
}

async function expectAdminAdaptiveSettingsGrids(page) {
  await page.setViewportSize({ width: 1375, height: 939 });
  await page.goto(`${baseUrl}/?view=admin&ui-smoke-admin-grids=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Settings"),
    null,
    { timeout: 8000 },
  );

  const adminLayout = await page.evaluate(() => {
    const clean = (value) => value?.replace(/\s+/g, " ").trim() ?? "";
    const panelByHeading = (headingText) => {
      const heading = Array.from(document.querySelectorAll("h2")).find(
        (element) => clean(element.textContent) === headingText,
      );
      return heading?.closest(".ea-surface") ?? null;
    };
    const measureCards = (root, selector = ".bg-white.p-4") => {
      const cards = Array.from(root?.querySelectorAll(selector) ?? [])
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            text: clean(element.textContent).slice(0, 90),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
        .filter((card) => card.width > 0 && card.height > 0);

      return {
        count: cards.length,
        minWidth: cards.length ? Math.min(...cards.map((card) => card.width)) : 0,
        cards: cards.slice(0, 8),
      };
    };

    const requiredPanels = [
      { label: "cutover", root: document.querySelector("#admin-cutover"), minWidth: 180 },
      { label: "primetime launch gate", root: document.querySelector("#admin-maturity"), minWidth: 180 },
      { label: "enterprise maturity", root: panelByHeading("Enterprise AI OS Maturity"), minWidth: 170 },
      {
        label: "runtime operations",
        root: document.querySelector("#admin-runtime"),
        minWidth: 180,
        selector: ".rounded-xl.border",
      },
      {
        label: "customer launch infrastructure",
        root: document.querySelector('[data-testid="admin-customer-launch-infrastructure"]'),
        minWidth: 200,
        selector: '[data-testid="admin-infrastructure-card"]',
      },
    ];
    const optionalPanels = [
      { label: "customer capability map", root: panelByHeading("Customer-Ready Capability Map"), minWidth: 180 },
    ].filter((panel) => panel.root);
    const panelSpecs = [...requiredPanels, ...optionalPanels];
    const panels = panelSpecs.map((panel) => ({
      label: panel.label,
      exists: Boolean(panel.root),
      minimumReadableWidth: panel.minWidth,
      ...measureCards(panel.root, panel.selector),
    }));
    const inspectedRoots = panelSpecs
      .map((panel) => panel.root)
      .filter(Boolean);
    const narrowCopy = inspectedRoots.flatMap((root) =>
      Array.from(root.querySelectorAll("p"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            text: clean(element.textContent).slice(0, 100),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            className: clean(element.className),
          };
        })
        .filter((item) => item.text.length > 20 && item.width > 0 && item.width < 120),
    );

    return { panels, narrowCopy: narrowCopy.slice(0, 12), viewportWidth: innerWidth };
  });

  for (const panel of adminLayout.panels) {
    assert(panel.exists, `Settings ${panel.label} panel should exist: ${JSON.stringify(adminLayout)}`);
    assert(panel.count > 0, `Settings ${panel.label} panel should render measured cards: ${JSON.stringify(panel)}`);
    assert(
      panel.minWidth >= panel.minimumReadableWidth,
      `Settings ${panel.label} cards should keep a readable width: ${JSON.stringify(panel)}`,
    );
  }
  assert(
    adminLayout.panels.every((panel) => !panel.exists || panel.minWidth >= panel.minimumReadableWidth),
    `Settings adaptive card grids should keep readable card widths: ${JSON.stringify(adminLayout)}`,
  );
  assert(
    adminLayout.narrowCopy.length === 0,
    `Settings adaptive card grids should not squeeze important copy into narrow columns: ${JSON.stringify(adminLayout)}`,
  );
}

async function expectStreamlinedVisualSystem(page) {
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.goto(`${baseUrl}/?view=command&ui-smoke-design=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Home"),
    null,
    { timeout: 8000 },
  );

  const visualSystem = await page.evaluate(() => {
    const rootStyles = getComputedStyle(document.documentElement);
    const bodyStyles = getComputedStyle(document.body);
    const surface = document.querySelector(".ea-surface");
    const surfaceStyles = surface ? getComputedStyle(surface) : null;
    const homeActiveInitiative = document.querySelector('[data-testid="home-active-initiative"]');
    const homePrimaryMission = document.querySelector('[data-testid="home-primary-mission"]');
    const activeInitiativeStyles = homeActiveInitiative ? getComputedStyle(homeActiveInitiative) : null;
    const primaryMissionStyles = homePrimaryMission ? getComputedStyle(homePrimaryMission) : null;
    const content = document.querySelector('[data-testid="app-content-scroll"]');
    const commandTrigger = document.querySelector('[data-testid="command-menu-opener"]');
    const commandTriggerStyles = commandTrigger ? getComputedStyle(commandTrigger) : null;

    return {
      background: rootStyles.getPropertyValue("--background").trim(),
      surfacePanel: rootStyles.getPropertyValue("--surface-panel").trim(),
      shadowCard: rootStyles.getPropertyValue("--shadow-card").trim(),
      bodyBackgroundImage: bodyStyles.backgroundImage,
      hasSurface: Boolean(surface),
      surfaceBackground: surfaceStyles?.backgroundColor ?? "",
      surfaceBackdrop: surfaceStyles?.backdropFilter ?? "",
      homeActiveInitiativeBackground: activeInitiativeStyles?.backgroundColor ?? "",
      homePrimaryMissionBackground: primaryMissionStyles?.backgroundColor ?? "",
      commandTriggerTransition: commandTriggerStyles?.transitionProperty ?? "",
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      contentOverflowX: content ? content.scrollWidth - content.clientWidth : null,
    };
  });

  assert(visualSystem.background === "#f5f7fb", `workspace background token should use the streamlined neutral canvas: ${JSON.stringify(visualSystem)}`);
  assert(visualSystem.surfacePanel, `surface panel token should be defined: ${JSON.stringify(visualSystem)}`);
  assert(visualSystem.shadowCard.includes("10px 28px"), `card shadow token should use the refined layered shadow: ${JSON.stringify(visualSystem)}`);
  assert(visualSystem.bodyBackgroundImage.includes("linear-gradient"), `workspace should use the refined canvas gradient: ${JSON.stringify(visualSystem)}`);
  assert(visualSystem.hasSurface, `workspace should render shared ea-surface panels: ${JSON.stringify(visualSystem)}`);
  assert(visualSystem.surfaceBackground.includes("rgba"), `shared surfaces should use translucent panel backgrounds: ${JSON.stringify(visualSystem)}`);
  assert(visualSystem.surfaceBackdrop.includes("blur"), `shared surfaces should keep subtle backdrop depth: ${JSON.stringify(visualSystem)}`);
  assert(
    visualSystem.homeActiveInitiativeBackground.includes("rgba"),
    `Home active initiative should use the streamlined translucent panel surface: ${JSON.stringify(visualSystem)}`,
  );
  assert(
    visualSystem.homePrimaryMissionBackground.includes("rgba"),
    `Home primary mission should use the streamlined translucent panel surface: ${JSON.stringify(visualSystem)}`,
  );
  assert(
    !visualSystem.commandTriggerTransition.split(",").map((value) => value.trim()).includes("transform"),
    `command trigger should avoid hover-lift motion in the streamlined shell: ${JSON.stringify(visualSystem)}`,
  );
  assert(visualSystem.documentOverflowX <= 1, `streamlined shell should not create document horizontal overflow: ${JSON.stringify(visualSystem)}`);
  assert((visualSystem.contentOverflowX ?? 0) <= 1, `streamlined shell should not create content horizontal overflow: ${JSON.stringify(visualSystem)}`);
}

async function expectHomeActionControlLabels(page) {
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.goto(`${baseUrl}/?view=command&ui-smoke-home-actions=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Home"),
    null,
    { timeout: 8000 },
  );

  const state = await page.evaluate(() => {
    const groups = [
      { key: "operating", selector: '[data-testid="home-operating-stage-action"]', minimum: 10 },
      { key: "controlPlane", selector: '[data-testid="home-control-plane-summary-action"]', minimum: 6 },
      { key: "enablement", selector: '[data-testid="home-enablement-stage-action"]', minimum: 9 },
      { key: "transformation", selector: '[data-testid="home-transformation-stage-action"]', minimum: 8 },
      { key: "compound", selector: '[data-testid="home-compound-stage-action"]', minimum: 6 },
    ];

    return groups.map((group) => {
      const buttons = Array.from(document.querySelectorAll(group.selector));
      const labels = buttons.map((button) => button.getAttribute("aria-label") ?? "");
      return {
        key: group.key,
        count: buttons.length,
        minimum: group.minimum,
        missingLabels: labels.filter((label) => !label),
        labelsWithoutAction: labels.filter((label) => !/^(Open|Create|Capture|Inspect|Do|Run|Submit|Add)/.test(label)),
        labelsWithoutDestination: labels.filter((label) => !label.includes("Opens ")),
        compressedLabels: labels.filter((label) => /^\d+[A-Z]/.test(label) || /No signal yet$/.test(label)),
        labelsWithDoublePunctuation: labels.filter((label) => /[.!?]\s*[.!?]/.test(label)),
        sample: labels.slice(0, 3),
      };
    });
  });

  for (const group of state) {
    assert(group.count >= group.minimum, `${group.key} home actions should render enough controls: ${JSON.stringify(group)}`);
    assert(group.missingLabels.length === 0, `${group.key} home actions should expose explicit aria labels: ${JSON.stringify(group)}`);
    assert(group.labelsWithoutAction.length === 0, `${group.key} home action labels should start with an action verb: ${JSON.stringify(group)}`);
    assert(group.labelsWithoutDestination.length === 0, `${group.key} home action labels should include the destination: ${JSON.stringify(group)}`);
    assert(group.compressedLabels.length === 0, `${group.key} home action labels should not be compressed visual text: ${JSON.stringify(group)}`);
    assert(group.labelsWithDoublePunctuation.length === 0, `${group.key} home action labels should read cleanly: ${JSON.stringify(group)}`);
  }
}

async function expectCommandMenuKeyboardFlow(page) {
  await page.setViewportSize({ width: 1360, height: 860 });
  await page.goto(`${baseUrl}/?view=command&ui-smoke-command=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Home"),
    null,
    { timeout: 8000 },
  );
  let commandTriggerState = await readShellDialogTriggerState(page, "Open command menu");
  assert(
    commandTriggerState.controls === "",
    `closed command menu opener should not reference an unmounted dialog: ${JSON.stringify(commandTriggerState)}`,
  );
  assert(commandTriggerState.hasPopup === "dialog", `command menu opener should expose dialog popup semantics: ${JSON.stringify(commandTriggerState)}`);
  assert(commandTriggerState.expanded === "false", `command menu opener should start closed: ${JSON.stringify(commandTriggerState)}`);
  let searchInputTriggerState = await readCommandSearchInputTriggerState(page);
  assert(
    searchInputTriggerState.controls === "",
    `closed workspace search input should not reference an unmounted command dialog: ${JSON.stringify(searchInputTriggerState)}`,
  );
  assert(searchInputTriggerState.hasPopup === "dialog", `workspace search input should expose dialog popup semantics: ${JSON.stringify(searchInputTriggerState)}`);
  assert(searchInputTriggerState.dialogOpen === "false", `workspace search input should start with a closed dialog state: ${JSON.stringify(searchInputTriggerState)}`);

  const workspaceSearch = page.getByTestId("workspace-search-input");
  assert((await workspaceSearch.count()) === 1, "desktop shell should expose one workspace search command field");
  await workspaceSearch.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="command-menu"]'), null, { timeout: 8000 });
  assert((await page.getByLabel("Search workspace commands", { exact: true }).count()) === 1, "command menu search input should have a programmatic label");
  searchInputTriggerState = await readCommandSearchInputTriggerState(page);
  assert(
    searchInputTriggerState.controls === "command-menu-dialog",
    `open workspace search input should identify the mounted command dialog: ${JSON.stringify(searchInputTriggerState)}`,
  );
  assert(searchInputTriggerState.dialogOpen === "true", `workspace search input should expose open state after click: ${JSON.stringify(searchInputTriggerState)}`);
  let openedFocus = await commandMenuFocusState(page);
  assert(
    openedFocus.activeTestId === "command-menu-input",
    `clicking workspace search should hand focus to command input: ${JSON.stringify(openedFocus)}`,
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[data-testid="command-menu"]'), null, { timeout: 8000 });
  searchInputTriggerState = await readCommandSearchInputTriggerState(page);
  assert(
    searchInputTriggerState.controls === "",
    `closed workspace search input should clear aria-controls after Escape: ${JSON.stringify(searchInputTriggerState)}`,
  );
  assert(searchInputTriggerState.dialogOpen === "false", `workspace search input should expose closed state after Escape: ${JSON.stringify(searchInputTriggerState)}`);
  const searchRestoredFocus = await page.evaluate(() => ({
    activeLabel: document.activeElement?.getAttribute("aria-label") ?? "",
    activeTestId: document.activeElement?.getAttribute("data-testid") ?? "",
  }));
  assert(
    searchRestoredFocus.activeTestId === "workspace-search-input",
    `closing command menu from workspace search should restore focus to the search field: ${JSON.stringify(searchRestoredFocus)}`,
  );

  await page.keyboard.press("Control+K");
  await page.waitForFunction(() => document.querySelector('[data-testid="command-menu"]'), null, { timeout: 8000 });

  const input = page.getByTestId("command-menu-input");
  assert((await input.count()) === 1, "command menu should expose a searchable combobox input");
  commandTriggerState = await readShellDialogTriggerState(page, "Open command menu");
  assert(
    commandTriggerState.controls === "command-menu-dialog",
    `open command menu opener should identify the mounted dialog: ${JSON.stringify(commandTriggerState)}`,
  );
  assert(commandTriggerState.expanded === "true", `command menu opener should expose open state after keyboard shortcut: ${JSON.stringify(commandTriggerState)}`);
  assert((await page.locator("#command-menu-dialog").count()) === 1, "command menu should render with the id controlled by shell triggers");
  const commandDialog = page.getByTestId("command-menu");
  assert((await commandDialog.getAttribute("id")) === "command-menu-dialog", "command menu test target should be the controlled dialog");
  assert((await commandDialog.getAttribute("role")) === "dialog", "command menu controlled element should be a dialog");
  await expectVisibleControlSize(page, 'button[aria-label="Close command menu"]', "command menu close");
  const commandMenuVisualState = await readCommandMenuVisualState(page);
  assert(
    commandMenuVisualState.background.includes("rgba"),
    `command menu should use the streamlined translucent surface: ${JSON.stringify(commandMenuVisualState)}`,
  );
  assert(
    commandMenuVisualState.backdrop.includes("blur"),
    `command menu should keep subtle backdrop depth: ${JSON.stringify(commandMenuVisualState)}`,
  );
  assert(
    isTranslucentCssColor(commandMenuVisualState.resultsBackground),
    `command menu results drawer should use a softened panel surface: ${JSON.stringify(commandMenuVisualState)}`,
  );
  openedFocus = await commandMenuFocusState(page);
  assert(openedFocus.activeTestId === "command-menu-input", `command menu should focus the search input on open: ${JSON.stringify(openedFocus)}`);

  await page.keyboard.press("Shift+Tab");
  const wrappedBackward = await commandMenuFocusState(page);
  assert(
    wrappedBackward.insideDialog && wrappedBackward.activeTestId !== "command-menu-input",
    `Shift+Tab from command input should wrap to the last dialog control: ${JSON.stringify(wrappedBackward)}`,
  );

  await page.keyboard.press("Tab");
  const wrappedForward = await commandMenuFocusState(page);
  assert(
    wrappedForward.activeTestId === "command-menu-input",
    `Tab from the last command control should wrap to the input: ${JSON.stringify(wrappedForward)}`,
  );

  await input.fill("ai");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="command-menu-input"]')?.getAttribute("aria-activedescendant"),
    null,
    { timeout: 8000 },
  );

  const initialActive = await commandMenuActiveState(page);
  assert(initialActive.inputRole === "combobox", `command input should use combobox semantics: ${JSON.stringify(initialActive)}`);
  assert(initialActive.inputControls, `command input should point at its options: ${JSON.stringify(initialActive)}`);
  assert(initialActive.activeId, `command input should expose an active descendant: ${JSON.stringify(initialActive)}`);
  assert(initialActive.activeVisible, `active command option should be visible: ${JSON.stringify(initialActive)}`);

  await page.keyboard.press("ArrowDown");
  const afterDown = await commandMenuActiveState(page);
  assert(
    afterDown.activeId && afterDown.activeId !== initialActive.activeId,
    `ArrowDown should move the active command option: ${JSON.stringify({ initialActive, afterDown })}`,
  );

  await page.keyboard.press("ArrowUp");
  const afterUp = await commandMenuActiveState(page);
  assert(
    afterUp.activeId === initialActive.activeId,
    `ArrowUp should return to the original command option: ${JSON.stringify({ initialActive, afterUp })}`,
  );

  await input.fill("proof");
  await page.waitForFunction(
    () => document.querySelector('[data-command-active="true"]')?.textContent?.includes("Find proof"),
    null,
    { timeout: 8000 },
  );
  const proofActive = await commandMenuActiveState(page);
  assert(proofActive.activeText.includes("Find proof"), `proof query should highlight the proof intent: ${JSON.stringify(proofActive)}`);

  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      new URL(window.location.href).searchParams.get("view") === "evidence" &&
      document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Proof Ledger") &&
      !document.querySelector('[data-testid="command-menu"]'),
    null,
    { timeout: 8000 },
  );

  await page.keyboard.press("Control+K");
  await page.waitForFunction(() => document.querySelector('[data-testid="command-menu"]'), null, { timeout: 8000 });
  commandTriggerState = await readShellDialogTriggerState(page, "Open command menu");
  assert(commandTriggerState.expanded === "true", `command menu opener should expose open state before Escape: ${JSON.stringify(commandTriggerState)}`);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[data-testid="command-menu"]'), null, { timeout: 8000 });
  commandTriggerState = await readShellDialogTriggerState(page, "Open command menu");
  assert(commandTriggerState.expanded === "false", `command menu opener should expose closed state after Escape: ${JSON.stringify(commandTriggerState)}`);

  await page.goto(`${baseUrl}/?view=command&ui-smoke-command-restore=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Home"),
    null,
    { timeout: 8000 },
  );
  const commandButton = page.getByRole("button", { name: "Open command menu", exact: true });
  assert((await commandButton.count()) === 1, "shell should expose a command menu opener button");
  commandTriggerState = await readShellDialogTriggerState(page, "Open command menu");
  assert(commandTriggerState.expanded === "false", `command menu opener should start closed before click: ${JSON.stringify(commandTriggerState)}`);
  await commandButton.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="command-menu"]'), null, { timeout: 8000 });
  commandTriggerState = await readShellDialogTriggerState(page, "Open command menu");
  assert(commandTriggerState.expanded === "true", `command menu opener should expose open state after click: ${JSON.stringify(commandTriggerState)}`);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[data-testid="command-menu"]'), null, { timeout: 8000 });
  commandTriggerState = await readShellDialogTriggerState(page, "Open command menu");
  assert(commandTriggerState.expanded === "false", `command menu opener should expose closed state after click close: ${JSON.stringify(commandTriggerState)}`);
  const restoredFocus = await page.evaluate(() => ({
    activeLabel: document.activeElement?.getAttribute("aria-label") ?? "",
    activeText: document.activeElement?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  }));
  assert(
    restoredFocus.activeLabel === "Open command menu",
    `closing command menu should restore focus to its opener: ${JSON.stringify(restoredFocus)}`,
  );

  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto(`${baseUrl}/?view=command&ui-smoke-command-mobile=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="app-content-scroll"] h1')?.textContent?.includes("Home"),
    null,
    { timeout: 8000 },
  );
  let mobileSearchTriggerState = await readShellDialogTriggerState(page, "Search");
  assert(
    mobileSearchTriggerState.controls === "",
    `closed mobile search trigger should not reference an unmounted command dialog: ${JSON.stringify(mobileSearchTriggerState)}`,
  );
  assert(mobileSearchTriggerState.hasPopup === "dialog", `mobile search trigger should expose dialog popup semantics: ${JSON.stringify(mobileSearchTriggerState)}`);
  assert(mobileSearchTriggerState.expanded === "false", `mobile search trigger should start closed: ${JSON.stringify(mobileSearchTriggerState)}`);
  const mobileSearch = page.getByRole("button", { name: "Search", exact: true });
  assert((await mobileSearch.count()) === 1, "mobile shell should expose one visible Search command trigger");
  await mobileSearch.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="command-menu"]'), null, { timeout: 8000 });
  mobileSearchTriggerState = await readShellDialogTriggerState(page, "Search");
  assert(
    mobileSearchTriggerState.controls === "command-menu-dialog",
    `open mobile search trigger should identify the mounted command dialog: ${JSON.stringify(mobileSearchTriggerState)}`,
  );
  assert(mobileSearchTriggerState.expanded === "true", `mobile search trigger should expose open state: ${JSON.stringify(mobileSearchTriggerState)}`);
  assert((await page.locator("#command-menu-dialog").count()) === 1, "mobile command menu should render with the id controlled by the trigger");
  await expectVisibleControlSize(page, 'button[aria-label="Close command menu"]', "mobile command menu close");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[data-testid="command-menu"]'), null, { timeout: 8000 });
  mobileSearchTriggerState = await readShellDialogTriggerState(page, "Search");
  assert(mobileSearchTriggerState.expanded === "false", `mobile search trigger should expose closed state after Escape: ${JSON.stringify(mobileSearchTriggerState)}`);
  const mobileRestoredFocus = await page.evaluate(() => ({
    activeLabel: document.activeElement?.getAttribute("aria-label") ?? "",
    activeText: document.activeElement?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  }));
  assert(mobileRestoredFocus.activeLabel === "Search", `mobile command menu should restore focus to Search: ${JSON.stringify(mobileRestoredFocus)}`);
}

async function commandMenuActiveState(page) {
  return page.evaluate(() => {
    const input = document.querySelector('[data-testid="command-menu-input"]');
    const activeId = input?.getAttribute("aria-activedescendant") ?? "";
    const active = activeId ? document.getElementById(activeId) : null;
    const rect = active?.getBoundingClientRect();
    const controlsId = input?.getAttribute("aria-controls") ?? "";
    return {
      inputRole: input?.getAttribute("role") ?? "",
      inputControls: controlsId && Boolean(document.getElementById(controlsId)),
      activeId,
      activeText: active?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      activeVisible: Boolean(rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight),
      activeFlagged: active?.getAttribute("data-command-active") ?? "",
    };
  });
}

async function commandMenuFocusState(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[data-testid="command-menu"]');
    const activeElement = document.activeElement;
    return {
      insideDialog: Boolean(dialog && activeElement && dialog.contains(activeElement)),
      activeTag: activeElement?.tagName ?? "",
      activeLabel: activeElement?.getAttribute("aria-label") ?? "",
      activeTestId: activeElement?.getAttribute("data-testid") ?? "",
      activeText: activeElement?.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "",
    };
  });
}

async function readCommandMenuVisualState(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[data-testid="command-menu"]');
    const dialogStyles = dialog ? getComputedStyle(dialog) : null;
    const results = document.querySelector('[data-testid="command-results-drawer"]');
    const resultsStyles = results ? getComputedStyle(results) : null;
    return {
      exists: Boolean(dialog),
      background: dialogStyles?.backgroundColor ?? "",
      backdrop: dialogStyles?.backdropFilter ?? "",
      boxShadow: dialogStyles?.boxShadow ?? "",
      resultsBackground: resultsStyles?.backgroundColor ?? "",
    };
  });
}

function isTranslucentCssColor(value) {
  return value.includes("rgba") || value.includes(" / ");
}

async function readCommandSearchInputTriggerState(page) {
  return page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Search the workspace"]');
    return {
      exists: Boolean(input),
      controls: input?.getAttribute("aria-controls") ?? "",
      dialogOpen: input?.getAttribute("data-dialog-open") ?? "",
      hasPopup: input?.getAttribute("aria-haspopup") ?? "",
    };
  });
}

async function dialogFocusState(page, selector) {
  return page.evaluate((dialogSelector) => {
    const dialog = document.querySelector(dialogSelector);
    const activeElement = document.activeElement;
    return {
      insideDialog: Boolean(dialog && activeElement && dialog.contains(activeElement)),
      activeTag: activeElement?.tagName ?? "",
      activeLabel: activeElement?.getAttribute("aria-label") ?? "",
      activeTestId: activeElement?.getAttribute("data-testid") ?? "",
      activeText: activeElement?.textContent?.replace(/\s+/g, " ").trim().slice(0, 100) ?? "",
    };
  }, selector);
}

async function expectDocumentScrollLock(page, locked, context) {
  const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
  assert(
    locked ? bodyOverflow === "hidden" : bodyOverflow !== "hidden",
    `${context} should ${locked ? "lock" : "release"} document scrolling: ${JSON.stringify({ bodyOverflow })}`,
  );
}

async function expectDialogBackgroundIsolation(page, isolated, context) {
  const state = await page.evaluate(() => {
    const appContent = document.querySelector('[data-testid="app-content-scroll"]');
    const isolatedAncestor = appContent?.closest('[inert][aria-hidden="true"]');

    return {
      isolated: Boolean(isolatedAncestor),
      isolatedTag: isolatedAncestor?.tagName ?? "",
      isolatedTestId: isolatedAncestor?.getAttribute("data-testid") ?? "",
      isolatedRole: isolatedAncestor?.getAttribute("role") ?? "",
    };
  });

  assert(
    isolated ? state.isolated : !state.isolated,
    `${context} should ${isolated ? "isolate" : "release"} workspace background: ${JSON.stringify(state)}`,
  );
}

async function expectVisibleControlSize(page, selector, context, minimum = 32) {
  const state = await page.evaluate((controlSelector) => {
    const control = document.querySelector(controlSelector);
    const rect = control?.getBoundingClientRect();
    const styles = control ? getComputedStyle(control) : null;

    return {
      exists: Boolean(control),
      visible: Boolean(
        rect &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < window.innerHeight &&
          rect.left < window.innerWidth &&
          styles?.display !== "none" &&
          styles?.visibility !== "hidden"
      ),
      width: rect ? Math.round(rect.width) : 0,
      height: rect ? Math.round(rect.height) : 0,
      display: styles?.display ?? "",
      visibility: styles?.visibility ?? "",
    };
  }, selector);

  assert(state.exists, `${context} should exist: ${JSON.stringify(state)}`);
  assert(state.visible, `${context} should be visible in the viewport: ${JSON.stringify(state)}`);
  assert(
    state.width >= minimum && state.height >= minimum,
    `${context} should keep at least a ${minimum}px touch target: ${JSON.stringify(state)}`,
  );
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

async function exerciseProfessionalConfirmationModal(page, nativeDialogs) {
  const dialogCountBefore = nativeDialogs.length;
  const clearCanvas = page.getByRole("button", { name: "Clear canvas", exact: true });
  assert((await clearCanvas.count()) === 1, "workflow editor should expose one Clear canvas action");
  await clearCanvas.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="clear-workflow-confirmation"]'), null, { timeout: 5000 });

  const modal = page.getByTestId("clear-workflow-confirmation");
  assert((await modal.getAttribute("role")) === "dialog", "workflow clear confirmation should render as a dialog");
  assert((await modal.getAttribute("aria-modal")) === "true", "workflow clear confirmation should mark the background modal");
  await expectText(page, "Clear the execution blueprint?");
  await expectText(page, "Workflow specs, tests, and evidence generated before this point remain in audit history");
  assert(nativeDialogs.length === dialogCountBefore, `workflow clear should not use a native browser dialog: ${JSON.stringify(nativeDialogs)}`);

  const cancel = modal.getByRole("button", { name: "Cancel", exact: true });
  assert((await cancel.count()) === 1, "workflow clear confirmation should expose a cancel action");
  await cancel.click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="clear-workflow-confirmation"]'), null, { timeout: 5000 });
  assert(nativeDialogs.length === dialogCountBefore, `canceling workflow clear should not emit a native dialog: ${JSON.stringify(nativeDialogs)}`);
}

async function expectReportsDisabledExportReasons(page) {
  const state = await page.evaluate(() => {
    const buttonLabels = ["Copy", "Copy Markdown", "Stage PDF Export", "Download Launch Packet"];
    const controls = buttonLabels.map((label) => {
      const matches = Array.from(document.querySelectorAll("button")).filter(
        (button) => button.textContent?.replace(/\s+/g, " ").trim() === label,
      );
      const button = matches.find((candidate) => candidate.hasAttribute("disabled")) ?? matches[0] ?? null;
      const describedBy = button?.getAttribute("aria-describedby") ?? "";
      return {
        label,
        found: Boolean(button),
        disabled: Boolean(button?.hasAttribute("disabled")),
        title: button?.getAttribute("title") ?? "",
        describedBy,
        description: describedBy ? document.getElementById(describedBy)?.textContent?.replace(/\s+/g, " ").trim() ?? "" : "",
      };
    });
    const exactButtonCount = (label) =>
      Array.from(document.querySelectorAll("button")).filter(
        (button) => button.textContent?.replace(/\s+/g, " ").trim() === label,
      ).length;
    return {
      controls,
      generateReportButtons: exactButtonCount("Generate Report"),
      regenerateButtons: exactButtonCount("Regenerate"),
    };
  });

  for (const item of state.controls) {
    assert(item.found, `Reports should expose ${item.label}: ${JSON.stringify(state.controls)}`);
    if (!item.disabled) continue;
    assert(
      item.title.includes("Generate a report"),
      `disabled Reports ${item.label} should explain the prerequisite in title: ${JSON.stringify(item)}`,
    );
    assert(
      item.description.includes("Generate a report"),
      `disabled Reports ${item.label} should expose a programmatic prerequisite: ${JSON.stringify(item)}`,
    );
  }

  const hasDisabledExportControls = state.controls.some((item) => item.disabled);
  if (hasDisabledExportControls) {
    assert(state.generateReportButtons >= 1, `Reports empty state should offer Generate Report: ${JSON.stringify(state)}`);
    assert(state.regenerateButtons === 0, `Reports should not say Regenerate before a report exists: ${JSON.stringify(state)}`);
  }
}

async function exerciseWorkflowBuilderTabs(page) {
  await page.waitForFunction(() => document.querySelector('[data-testid="workflow-builder-tabs"]'), null, { timeout: 5000 });

  const builderInitial = await readWorkflowBuilderTabState(page);
  assert(builderInitial.selectedTab === "Builder", `Workflow Builder should start on Builder: ${JSON.stringify(builderInitial)}`);
  assert(builderInitial.panelTestId === "workflow-builder-panel-builder", `Builder panel should render: ${JSON.stringify(builderInitial)}`);
  assertWorkflowBuilderTabA11y(builderInitial, "Builder");

  const builderTabRegion = page.getByTestId("workflow-builder-tabs");
  for (const [label, panelSuffix, expectedText] of [
    ["Runs", "runs", "Workflow Runs"],
    ["Versions", "versions", "Blueprint Versions"],
    ["Settings", "settings", "Workflow Settings"],
    ["Builder", "builder", "Workflow validation"],
  ]) {
    await clickTab(page, label, builderTabRegion);
    await page.waitForTimeout(120);
    await expectText(page, expectedText);
    const state = await readWorkflowBuilderTabState(page);
    assert(state.selectedTab === label, `${label} should become the selected Workflow Builder tab: ${JSON.stringify(state)}`);
    assert(state.panelTestId === `workflow-builder-panel-${panelSuffix}`, `${label} panel should render: ${JSON.stringify(state)}`);
    assertWorkflowBuilderTabA11y(state, label);
  }

  const inspectorInitial = await readWorkflowInspectorTabState(page);
  assert(inspectorInitial.selectedTab === "Configuration", `Block inspector should start on Configuration: ${JSON.stringify(inspectorInitial)}`);
  assert(inspectorInitial.panelTestId === "workflow-inspector-panel-configuration", `Configuration panel should render: ${JSON.stringify(inspectorInitial)}`);
  assertWorkflowInspectorTabA11y(inspectorInitial, "Configuration");

  const inspectorTabs = page.getByTestId("workflow-inspector-tabs");
  await clickTab(page, "Advanced", inspectorTabs);
  await page.waitForTimeout(120);
  await expectText(page, "Require human approval");
  const advancedState = await readWorkflowInspectorTabState(page);
  assert(advancedState.selectedTab === "Advanced", `Advanced should become the selected inspector tab: ${JSON.stringify(advancedState)}`);
  assert(advancedState.panelTestId === "workflow-inspector-panel-advanced", `Advanced inspector panel should render: ${JSON.stringify(advancedState)}`);
  assertWorkflowInspectorTabA11y(advancedState, "Advanced");

  await clickTab(page, "Configuration", inspectorTabs);
  await page.waitForTimeout(120);
  await expectText(page, "Model Configuration");
  const configurationState = await readWorkflowInspectorTabState(page);
  assert(configurationState.selectedTab === "Configuration", `Configuration should become selected again: ${JSON.stringify(configurationState)}`);
  assert(configurationState.panelTestId === "workflow-inspector-panel-configuration", `Configuration inspector panel should render again: ${JSON.stringify(configurationState)}`);
  assertWorkflowInspectorTabA11y(configurationState, "Configuration");
}

async function readWorkflowBuilderTabState(page) {
  return page.evaluate(() => {
    const tabRegion = document.querySelector('[data-testid="workflow-builder-tabs"]');
    const selectedTab = tabRegion?.querySelector('[role="tab"][aria-selected="true"]');
    const visiblePanel = Array.from(document.querySelectorAll('[data-testid^="workflow-builder-panel-"]')).find((panel) => {
      const rect = panel.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    return {
      selectedTab: selectedTab?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      selectedTabId: selectedTab?.id ?? "",
      selectedControls: selectedTab?.getAttribute("aria-controls") ?? "",
      tabListLabel: tabRegion?.querySelector('[role="tablist"]')?.getAttribute("aria-label") ?? "",
      panelId: visiblePanel?.id ?? "",
      panelRole: visiblePanel?.getAttribute("role") ?? "",
      panelLabelledBy: visiblePanel?.getAttribute("aria-labelledby") ?? "",
      panelTestId: visiblePanel?.getAttribute("data-testid") ?? "",
    };
  });
}

function assertWorkflowBuilderTabA11y(state, label) {
  assert(state.tabListLabel === "Workflow builder sections", `${label} tabs should expose a specific tablist label: ${JSON.stringify(state)}`);
  assert(state.selectedTabId, `${label} selected tab should expose a stable id: ${JSON.stringify(state)}`);
  assert(state.panelId, `${label} panel should expose a stable id: ${JSON.stringify(state)}`);
  assert(state.selectedControls === state.panelId, `${label} tab should control its panel: ${JSON.stringify(state)}`);
  assert(state.panelRole === "tabpanel", `${label} content should expose tabpanel semantics: ${JSON.stringify(state)}`);
  assert(state.panelLabelledBy === state.selectedTabId, `${label} panel should be labelled by selected tab: ${JSON.stringify(state)}`);
}

async function readWorkflowInspectorTabState(page) {
  return page.evaluate(() => {
    const tabRegion = document.querySelector('[data-testid="workflow-inspector-tabs"]');
    const selectedTab = tabRegion?.querySelector('[role="tab"][aria-selected="true"]');
    const visiblePanel = Array.from(document.querySelectorAll('[data-testid^="workflow-inspector-panel-"]')).find((panel) => {
      const rect = panel.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    return {
      selectedTab: selectedTab?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      selectedTabId: selectedTab?.id ?? "",
      selectedControls: selectedTab?.getAttribute("aria-controls") ?? "",
      tabListLabel: tabRegion?.querySelector('[role="tablist"]')?.getAttribute("aria-label") ?? "",
      panelId: visiblePanel?.id ?? "",
      panelRole: visiblePanel?.getAttribute("role") ?? "",
      panelLabelledBy: visiblePanel?.getAttribute("aria-labelledby") ?? "",
      panelTestId: visiblePanel?.getAttribute("data-testid") ?? "",
    };
  });
}

function assertWorkflowInspectorTabA11y(state, label) {
  assert(state.tabListLabel === "Block inspector sections", `${label} tabs should expose a specific inspector tablist label: ${JSON.stringify(state)}`);
  assert(state.selectedTabId, `${label} selected inspector tab should expose a stable id: ${JSON.stringify(state)}`);
  assert(state.panelId, `${label} inspector panel should expose a stable id: ${JSON.stringify(state)}`);
  assert(state.selectedControls === state.panelId, `${label} inspector tab should control its panel: ${JSON.stringify(state)}`);
  assert(state.panelRole === "tabpanel", `${label} inspector content should expose tabpanel semantics: ${JSON.stringify(state)}`);
  assert(state.panelLabelledBy === state.selectedTabId, `${label} inspector panel should be labelled by selected tab: ${JSON.stringify(state)}`);
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
  const { unnamedButtons, genericButtons } = await page.evaluate(() => {
    const genericNames = new Set(["Open", "Done", "Close", "More", "Menu", "Action", "Actions"]);
    const visibleButtons = Array.from(document.querySelectorAll("button"))
      .filter((button) => {
        const style = window.getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((button) => {
        const name = (
          button.getAttribute("aria-label") ||
          button.getAttribute("title") ||
          button.textContent ||
          ""
        ).replace(/\s+/g, " ").trim();

        return {
          name,
          html: button.outerHTML.slice(0, 180),
        };
      });

    return {
      unnamedButtons: visibleButtons.filter((button) => !button.name).map((button) => button.html),
      genericButtons: visibleButtons
        .filter((button) => genericNames.has(button.name))
        .map((button) => `${button.name}: ${button.html}`),
    };
  });

  assert(unnamedButtons.length === 0, `${surface} has visible unnamed buttons: ${unnamedButtons.join("\n")}`);
  assert(genericButtons.length === 0, `${surface} has generic visible button names: ${genericButtons.join("\n")}`);
}

async function assertStatusNotice(locator, label) {
  const count = await locator.count();
  assert(count >= 1, `${label} should render a status notice`);
  const state = await locator.first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      role: element.getAttribute("role") ?? "",
      live: element.getAttribute("aria-live") ?? "",
      atomic: element.getAttribute("aria-atomic") ?? "",
      text: element.textContent?.replace(/\s+/g, " ").trim() ?? "",
      visible: rect.width > 0 && rect.height > 0,
    };
  });

  assert(state.visible, `${label} should be visible: ${JSON.stringify(state)}`);
  assert(state.role === "status", `${label} should expose role=status: ${JSON.stringify(state)}`);
  assert(state.live === "polite", `${label} should announce politely: ${JSON.stringify(state)}`);
  assert(state.atomic === "true", `${label} should announce atomically: ${JSON.stringify(state)}`);
  assert(state.text.length > 0, `${label} should include readable status text: ${JSON.stringify(state)}`);
}

async function assertVisibleStatusChoice(page, testIds, label) {
  const state = await page.evaluate((ids) => {
    const statuses = ids.map((id) => {
      const element = document.querySelector(`[data-testid="${id}"]`);
      const rect = element?.getBoundingClientRect();
      return {
        id,
        exists: Boolean(element),
        visible: Boolean(rect && rect.width > 0 && rect.height > 0),
        role: element?.getAttribute("role") ?? "",
        live: element?.getAttribute("aria-live") ?? "",
        atomic: element?.getAttribute("aria-atomic") ?? "",
        text: element?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      };
    });
    return statuses.find((status) => status.exists && status.visible) ?? statuses[0];
  }, testIds);

  assert(state?.exists && state.visible, `${label} should render one visible status notice: ${JSON.stringify(state)}`);
  assert(state.role === "status", `${label} should expose role=status: ${JSON.stringify(state)}`);
  assert(state.live === "polite", `${label} should announce politely: ${JSON.stringify(state)}`);
  assert(state.atomic === "true", `${label} should announce atomically: ${JSON.stringify(state)}`);
  assert(state.text.length > 0, `${label} should include readable status text: ${JSON.stringify(state)}`);
}

async function assertVisibleFormControlsAreNamed(page, surface) {
  const unnamedControls = await page.evaluate(() => {
    function isVisible(element) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    }

    function textFromIds(ids) {
      return ids
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ");
    }

    function hasAccessibleName(element) {
      if (element.getAttribute("aria-label")?.trim()) return true;

      const labelledBy = element.getAttribute("aria-labelledby");
      if (labelledBy && textFromIds(labelledBy).trim()) return true;

      if (element.getAttribute("title")?.trim()) return true;

      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) {
        if (Array.from(element.labels ?? []).some((label) => label.textContent?.trim())) return true;
      }

      if (element.closest("label")?.textContent?.trim()) return true;

      return false;
    }

    return Array.from(document.querySelectorAll("input, select, textarea"))
      .filter((element) => isVisible(element) && !hasAccessibleName(element))
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute("type") ?? "",
        placeholder: element.getAttribute("placeholder") ?? "",
        html: element.outerHTML.slice(0, 180),
      }));
  });

  assert(
    unnamedControls.length === 0,
    `${surface} has visible form controls without accessible names: ${JSON.stringify(unnamedControls, null, 2)}`,
  );
}

async function expectDataTables(page, expectedCaptions) {
  const result = await page.evaluate((captions) => {
    const tables = Array.from(document.querySelectorAll("table"));
    const labels = tables.map((table) => table.getAttribute("aria-label") || table.querySelector("caption")?.textContent?.trim() || "");
    const genericLabels = labels.filter((label) => !label || label === "Data table");
    const unscopedHeaders = tables.reduce((total, table) => {
      return total + Array.from(table.querySelectorAll("th")).filter((header) => header.getAttribute("scope") !== "col").length;
    }, 0);
    const tableLabel = (table) => table.getAttribute("aria-label") || table.querySelector("caption")?.textContent?.trim() || "";
    const closestScrollableTableRegion = (table) => {
      let current = table.parentElement;
      while (current && current !== document.body) {
        const style = getComputedStyle(current);
        if (["auto", "scroll"].includes(style.overflowX)) return current;
        current = current.parentElement;
      }
      return null;
    };
    const recordFooters = Array.from(document.querySelectorAll("div"))
      .map((node) => node.textContent?.trim() || "")
      .filter((text) => /^Showing \d/.test(text));
    const sharedScrollRegions = Array.from(document.querySelectorAll('[data-testid="data-table-scroll"]')).map((region) => {
      const table = region.querySelector("table");
      const tableLabel = table?.getAttribute("aria-label") || table?.querySelector("caption")?.textContent?.trim() || "";
      return {
        tableLabel,
        role: region.getAttribute("role") || "",
        tabIndex: region.getAttribute("tabindex") || "",
        label: region.getAttribute("aria-label") || "",
        overflowX: getComputedStyle(region).overflowX,
      };
    });
    const invalidSharedScrollRegions = sharedScrollRegions.filter((region) => {
      return (
        region.role !== "region" ||
        region.tabIndex !== "0" ||
        !region.label.includes(region.tableLabel) ||
        !["auto", "scroll"].includes(region.overflowX)
      );
    });
    const scrollableTableRegions = tables
      .map((table) => {
        const region = closestScrollableTableRegion(table);
        if (!region) return null;
        const label = tableLabel(table);
        return {
          tableLabel: label,
          role: region.getAttribute("role") || "",
          tabIndex: region.getAttribute("tabindex") || "",
          label: region.getAttribute("aria-label") || "",
          overflowX: getComputedStyle(region).overflowX,
        };
      })
      .filter(Boolean);
    const invalidScrollableTableRegions = scrollableTableRegions.filter((region) => {
      return (
        region.role !== "region" ||
        region.tabIndex !== "0" ||
        !region.label.includes(region.tableLabel) ||
        !["auto", "scroll"].includes(region.overflowX)
      );
    });

    return {
      labels,
      missingCaptions: captions.filter((caption) => !labels.includes(caption)),
      genericLabels,
      unscopedHeaders,
      recordFooters,
      sharedScrollRegions,
      invalidSharedScrollRegions,
      scrollableTableRegions,
      invalidScrollableTableRegions,
      hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    };
  }, expectedCaptions);

  assert(result.missingCaptions.length === 0, `missing table captions: ${result.missingCaptions.join(", ")}`);
  assert(result.genericLabels.length === 0, `generic or missing table labels: ${result.labels.join(", ")}`);
  assert(result.unscopedHeaders === 0, "all table headers should use scope=col");
  assert(result.recordFooters.length >= expectedCaptions.length, "tables should expose visible record counts");
  assert(
    result.invalidSharedScrollRegions.length === 0,
    `shared table scroll regions should be named and keyboard focusable: ${JSON.stringify(result.invalidSharedScrollRegions)}`,
  );
  assert(
    result.invalidScrollableTableRegions.length === 0,
    `table scroll regions should be named and keyboard focusable: ${JSON.stringify(result.invalidScrollableTableRegions)}`,
  );
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

async function expectActiveNavVisible(page, name) {
  const state = await page.evaluate((expectedName) => {
    const scroller = document.querySelector('[data-testid="primary-nav-scroll"]');
    const active = Array.from(document.querySelectorAll('aside nav [aria-current="page"]')).find((element) =>
      (element.textContent || "").trim().startsWith(expectedName),
    );
    if (!scroller || !active) return { ok: false, reason: !scroller ? "missing scroller" : "missing active item" };

    const scrollerRect = scroller.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    return {
      ok: activeRect.top >= scrollerRect.top - 1 && activeRect.bottom <= scrollerRect.bottom + 1,
      reason: "measured",
      activeText: (active.textContent || "").replace(/\s+/g, " ").trim(),
      scrollerTop: scrollerRect.top,
      scrollerBottom: scrollerRect.bottom,
      activeTop: activeRect.top,
      activeBottom: activeRect.bottom,
    };
  }, name);

  assert(
    state.ok,
    `active nav item ${name} should be visible in the sidebar scroller: ${JSON.stringify(state)}`,
  );
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
  assert((await wizard.getAttribute("aria-describedby")) === "onboarding-wizard-description", "guided setup should describe the dialog with current step helper copy");
  assert((await wizard.getByLabel("Company name", { exact: true }).count()) === 1, "guided setup company name field should have a programmatic label");
  assert((await wizard.getByLabel("Workspace label", { exact: true }).count()) === 1, "guided setup workspace label field should have a programmatic label");
  const guidedSetupVisualState = await readGuidedSetupVisualState(page);
  assert(
    guidedSetupVisualState.background.includes("rgba"),
    `guided setup should use the streamlined translucent surface: ${JSON.stringify(guidedSetupVisualState)}`,
  );
  assert(
    guidedSetupVisualState.backdrop.includes("blur"),
    `guided setup should keep subtle backdrop depth: ${JSON.stringify(guidedSetupVisualState)}`,
  );
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
  assert((await page.getByTestId("onboarding-wizard").count()) === 1, "guided setup should reopen from the shell");

  const setupFocus = await dialogFocusState(page, '[data-testid="onboarding-wizard"]');
  assert(
    setupFocus.insideDialog && setupFocus.activeLabel === "Close setup",
    `guided setup should focus the close control on open: ${JSON.stringify(setupFocus)}`,
  );
  await expectVisibleControlSize(page, 'button[aria-label="Close setup"]', "guided setup close");

  await page.keyboard.press("Shift+Tab");
  const setupWrappedBackward = await dialogFocusState(page, '[data-testid="onboarding-wizard"]');
  assert(
    setupWrappedBackward.insideDialog && setupWrappedBackward.activeLabel !== "Close setup",
    `guided setup should keep Shift+Tab inside the dialog: ${JSON.stringify(setupWrappedBackward)}`,
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  assert((await page.getByTestId("onboarding-wizard").count()) === 0, "guided setup should close with Escape");
  const setupRestoredFocus = await page.evaluate(() => ({
    activeTestId: document.activeElement?.getAttribute("data-testid") ?? "",
    activeText: document.activeElement?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  }));
  assert(
    setupRestoredFocus.activeTestId === "guided-setup-nav",
    `guided setup should restore focus to the setup button: ${JSON.stringify(setupRestoredFocus)}`,
  );

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
  assert((await handoff.getAttribute("aria-describedby")) === "launch-handoff-description", "launch handoff should describe the dialog with its summary");
  const launchHandoffVisualState = await readLaunchHandoffVisualState(page);
  assert(
    launchHandoffVisualState.background.includes("rgba"),
    `launch handoff should use the streamlined translucent surface: ${JSON.stringify(launchHandoffVisualState)}`,
  );
  assert(
    launchHandoffVisualState.backdrop.includes("blur"),
    `launch handoff should keep subtle backdrop depth: ${JSON.stringify(launchHandoffVisualState)}`,
  );
  await expectText(page, "Launch this workspace without guessing");
  await expectText(page, "Do this next");
  await expectText(page, "First work session");
  await expectText(page, "Reviewer proof packet");
  await expectText(page, "Launch packet");

  const handoffFocus = await dialogFocusState(page, '[data-testid="launch-handoff"]');
  assert(
    handoffFocus.insideDialog && handoffFocus.activeLabel === "Close launch handoff",
    `launch handoff should focus the close control on open: ${JSON.stringify(handoffFocus)}`,
  );
  await expectVisibleControlSize(page, 'button[aria-label="Close launch handoff"]', "launch handoff close");

  await page.keyboard.press("Shift+Tab");
  const handoffWrappedBackward = await dialogFocusState(page, '[data-testid="launch-handoff"]');
  assert(
    handoffWrappedBackward.insideDialog && handoffWrappedBackward.activeLabel !== "Close launch handoff",
    `launch handoff should keep Shift+Tab inside the dialog: ${JSON.stringify(handoffWrappedBackward)}`,
  );

  const closeHandoff = page.getByRole("button", { name: "Close launch handoff", exact: true });
  assert((await closeHandoff.count()) === 1, "launch handoff should expose a close action");
  await closeHandoff.click();
  await page.waitForTimeout(300);
  assert((await page.getByTestId("launch-handoff").count()) === 0, "launch handoff should close cleanly");
}

async function readGuidedSetupVisualState(page) {
  return page.evaluate(() => {
    const wizard = document.querySelector('[data-testid="onboarding-wizard"]');
    const styles = wizard ? getComputedStyle(wizard) : null;
    return {
      exists: Boolean(wizard),
      background: styles?.backgroundColor ?? "",
      backdrop: styles?.backdropFilter ?? "",
      boxShadow: styles?.boxShadow ?? "",
    };
  });
}

async function readLaunchHandoffVisualState(page) {
  return page.evaluate(() => {
    const handoff = document.querySelector('[data-testid="launch-handoff"]');
    const styles = handoff ? getComputedStyle(handoff) : null;
    return {
      exists: Boolean(handoff),
      background: styles?.backgroundColor ?? "",
      backdrop: styles?.backdropFilter ?? "",
      boxShadow: styles?.boxShadow ?? "",
    };
  });
}

async function exerciseSettingsModal(page) {
  const settings = page.getByRole("button", { name: "AI settings", exact: true });
  assert((await settings.count()) === 1, "top bar AI settings action should be available");
  let settingsTriggerState = await readShellDialogTriggerState(page, "AI settings");
  assert(
    settingsTriggerState.controls === "",
    `closed AI settings trigger should not reference an unmounted dialog: ${JSON.stringify(settingsTriggerState)}`,
  );
  assert(settingsTriggerState.hasPopup === "dialog", `AI settings trigger should expose dialog popup semantics: ${JSON.stringify(settingsTriggerState)}`);
  assert(settingsTriggerState.expanded === "false", `AI settings trigger should start closed: ${JSON.stringify(settingsTriggerState)}`);
  await settings.click();
  await page.waitForTimeout(300);

  const modal = page.getByTestId("company-setup-modal");
  assert((await modal.count()) === 1, "company setup modal should open");
  settingsTriggerState = await readShellDialogTriggerState(page, "AI settings");
  assert(
    settingsTriggerState.controls === "company-setup-dialog",
    `open AI settings trigger should identify the mounted dialog: ${JSON.stringify(settingsTriggerState)}`,
  );
  assert(settingsTriggerState.expanded === "true", `AI settings trigger should expose open state: ${JSON.stringify(settingsTriggerState)}`);
  assert((await page.locator("#company-setup-dialog").count()) === 1, "company setup dialog should render with the id controlled by the trigger");
  assert((await modal.getAttribute("id")) === "company-setup-dialog", "company setup test target should be the controlled dialog");
  assert((await modal.getAttribute("role")) === "dialog", "company setup controlled element should be a dialog");
  assert((await modal.getAttribute("aria-labelledby")) === "company-setup-title", "company setup dialog should be labelled by its title");
  assert((await modal.getAttribute("aria-describedby")) === "company-setup-description", "company setup dialog should describe its purpose");
  await expectVisibleControlSize(page, 'button[aria-label="Close company setup"]', "company setup close");
  await expectDocumentScrollLock(page, true, "company setup open");
  await expectDialogBackgroundIsolation(page, true, "company setup open");
  await expectText(page, "Workspace Settings");
  await expectText(page, "AI Provider Settings");

  const settingsFocus = await dialogFocusState(page, '[data-testid="company-setup-modal"]');
  assert(
    settingsFocus.insideDialog && settingsFocus.activeLabel === "Close company setup",
    `company setup should focus the close control on open: ${JSON.stringify(settingsFocus)}`,
  );

  const appsTab = page.getByTestId("company-setup-apps-tab");
  assert((await appsTab.count()) === 1, "company setup should expose connected apps tab");
  await appsTab.click();
  await page.waitForTimeout(200);
  await expectText(page, "Connected apps");
  await expectText(page, "Company app connections");
  const connectorSecretSaveState = await page.evaluate(() => {
    const saveButton = document.querySelector('[data-testid="save-connector-secrets"]');
    const describedBy = saveButton?.getAttribute("aria-describedby") ?? "";
    return {
      exists: Boolean(saveButton),
      disabled: Boolean(saveButton?.hasAttribute("disabled")),
      title: saveButton?.getAttribute("title") ?? "",
      describedBy,
      description: describedBy
        ? document.getElementById(describedBy)?.textContent?.replace(/\s+/g, " ").trim() ?? ""
        : "",
    };
  });
  assert(connectorSecretSaveState.exists, `connected apps should expose Save secrets: ${JSON.stringify(connectorSecretSaveState)}`);
  assert(connectorSecretSaveState.disabled, `empty tenant vault should disable Save secrets: ${JSON.stringify(connectorSecretSaveState)}`);
  assert(
    connectorSecretSaveState.description.includes("Enter at least one connector secret"),
    `disabled Save secrets should explain how to enable it: ${JSON.stringify(connectorSecretSaveState)}`,
  );
  assert(
    connectorSecretSaveState.title.includes("Enter at least one connector secret"),
    `disabled Save secrets should expose a hover explanation: ${JSON.stringify(connectorSecretSaveState)}`,
  );

  const identityTab = page.getByTestId("company-setup-identity-tab");
  assert((await identityTab.count()) === 1, "company setup should expose identity tab");
  await identityTab.click();
  await page.waitForTimeout(200);
  await page.getByLabel("OIDC client secret", { exact: true }).fill("smoke-oidc-secret");
  await page.getByLabel("SCIM bearer token", { exact: true }).fill("smoke-scim-token");
  const identityControls = await page.evaluate(() => {
    const passwordValues = Array.from(document.querySelectorAll("input[type='password']")).map(
      (input) => input instanceof HTMLInputElement ? input.value : "",
    );
    return {
      passwordValues,
      scimProvisioningButtons: Array.from(document.querySelectorAll("button")).filter(
        (button) => button.textContent?.replace(/\s+/g, " ").trim() === "Provision users through SCIM",
      ).length,
      hasScimStatus: Boolean(Array.from(document.querySelectorAll("*")).some(
        (element) => element.textContent?.replace(/\s+/g, " ").trim() === "SCIM provisioning",
      )),
    };
  });
  assert(identityControls.passwordValues.includes("smoke-oidc-secret"), `OIDC secret draft should be editable: ${JSON.stringify(identityControls)}`);
  assert(identityControls.passwordValues.includes("smoke-scim-token"), `SCIM token draft should be editable: ${JSON.stringify(identityControls)}`);
  assert(identityControls.scimProvisioningButtons === 0, `SCIM readiness should not be a dead toggle: ${JSON.stringify(identityControls)}`);
  assert(identityControls.hasScimStatus, `SCIM readiness should render as status copy: ${JSON.stringify(identityControls)}`);

  const securityTab = page.getByTestId("company-setup-security-tab");
  assert((await securityTab.count()) === 1, "company setup should expose security tab");
  await securityTab.click();
  await page.waitForTimeout(200);
  const securityControls = await page.evaluate(() => ({
    deadVaultButtons: Array.from(document.querySelectorAll("button")).filter((button) =>
      ["Encrypt tenant secrets", "Salt API credentials"].includes(button.textContent?.replace(/\s+/g, " ").trim() ?? ""),
    ).length,
    hasVaultStatus: Boolean(Array.from(document.querySelectorAll("*")).some(
      (element) => element.textContent?.replace(/\s+/g, " ").trim() === "Secret vault",
    )),
    hasApiSaltStatus: Boolean(Array.from(document.querySelectorAll("*")).some(
      (element) => element.textContent?.replace(/\s+/g, " ").trim() === "API credential salting",
    )),
  }));
  assert(securityControls.deadVaultButtons === 0, `vault/API readiness should not be dead toggles: ${JSON.stringify(securityControls)}`);
  assert(securityControls.hasVaultStatus, `secret vault readiness should render as status copy: ${JSON.stringify(securityControls)}`);
  assert(securityControls.hasApiSaltStatus, `API salt readiness should render as status copy: ${JSON.stringify(securityControls)}`);

  await page.keyboard.press("Shift+Tab");
  const settingsWrappedBackward = await dialogFocusState(page, '[data-testid="company-setup-modal"]');
  assert(
    settingsWrappedBackward.insideDialog,
    `company setup should keep Shift+Tab inside the dialog: ${JSON.stringify(settingsWrappedBackward)}`,
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  assert((await page.getByTestId("company-setup-modal").count()) === 0, "company setup should close with Escape");
  settingsTriggerState = await readShellDialogTriggerState(page, "AI settings");
  assert(settingsTriggerState.expanded === "false", `AI settings trigger should expose closed state after Escape: ${JSON.stringify(settingsTriggerState)}`);
  await expectDocumentScrollLock(page, false, "company setup closed");
  await expectDialogBackgroundIsolation(page, false, "company setup closed");
  const restoredFocus = await page.evaluate(() => ({
    activeLabel: document.activeElement?.getAttribute("aria-label") ?? "",
    activeText: document.activeElement?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  }));
  assert(
    restoredFocus.activeLabel === "AI settings",
    `company setup should restore focus to AI settings: ${JSON.stringify(restoredFocus)}`,
  );
}

async function exerciseHelpWalkthrough(page) {
  const help = page.getByRole("button", { name: "Help", exact: true });
  assert((await help.count()) === 1, "top bar help action should be available");
  let helpTriggerState = await readShellDialogTriggerState(page, "Help");
  assert(
    helpTriggerState.controls === "",
    `closed Help trigger should not reference an unmounted dialog: ${JSON.stringify(helpTriggerState)}`,
  );
  assert(helpTriggerState.hasPopup === "dialog", `Help trigger should expose dialog popup semantics: ${JSON.stringify(helpTriggerState)}`);
  assert(helpTriggerState.expanded === "false", `Help trigger should start closed: ${JSON.stringify(helpTriggerState)}`);
  await help.click();
  await page.waitForTimeout(300);

  const guide = page.getByTestId("help-walkthrough");
  assert((await guide.count()) === 1, "help walkthrough should open");
  helpTriggerState = await readShellDialogTriggerState(page, "Help");
  assert(
    helpTriggerState.controls === "help-walkthrough-dialog",
    `open Help trigger should identify the mounted dialog: ${JSON.stringify(helpTriggerState)}`,
  );
  assert(helpTriggerState.expanded === "true", `Help trigger should expose open state: ${JSON.stringify(helpTriggerState)}`);
  assert((await page.locator("#help-walkthrough-dialog").count()) === 1, "help walkthrough should render with the id controlled by the trigger");
  assert((await guide.getAttribute("id")) === "help-walkthrough-dialog", "help walkthrough test target should be the controlled dialog");
  assert((await guide.getAttribute("role")) === "dialog", "help walkthrough controlled element should be a dialog");
  assert((await guide.getAttribute("aria-labelledby")) === "help-walkthrough-title", "help walkthrough dialog should be labelled by its title");
  assert((await guide.getAttribute("aria-describedby")) === "help-walkthrough-description", "help walkthrough dialog should describe its purpose");
  await expectVisibleControlSize(page, 'button[aria-label="Close help"]', "help close");
  const helpVisualState = await readHelpWalkthroughVisualState(page);
  assert(
    helpVisualState.background.includes("rgba"),
    `help walkthrough should use the streamlined translucent surface: ${JSON.stringify(helpVisualState)}`,
  );
  assert(
    helpVisualState.backdrop.includes("blur"),
    `help walkthrough should keep subtle backdrop depth: ${JSON.stringify(helpVisualState)}`,
  );
  await expectText(page, "What are you trying to do?");
  await expectText(page, "The simple path");
  await expectText(page, "Plain-English glossary");
  await expectText(page, "Still not sure?");

  const helpFocus = await dialogFocusState(page, '[data-testid="help-walkthrough"]');
  assert(
    helpFocus.insideDialog && helpFocus.activeLabel === "Close help",
    `help walkthrough should focus the close control on open: ${JSON.stringify(helpFocus)}`,
  );

  await page.keyboard.press("Shift+Tab");
  const helpWrappedBackward = await dialogFocusState(page, '[data-testid="help-walkthrough"]');
  assert(
    helpWrappedBackward.insideDialog && helpWrappedBackward.activeLabel !== "Close help",
    `help walkthrough should keep Shift+Tab inside the dialog: ${JSON.stringify(helpWrappedBackward)}`,
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  assert((await page.getByTestId("help-walkthrough").count()) === 0, "help walkthrough should close with Escape");
  helpTriggerState = await readShellDialogTriggerState(page, "Help");
  assert(helpTriggerState.expanded === "false", `Help trigger should expose closed state after Escape: ${JSON.stringify(helpTriggerState)}`);
  const helpRestoredFocus = await page.evaluate(() => ({
    activeLabel: document.activeElement?.getAttribute("aria-label") ?? "",
    activeText: document.activeElement?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  }));
  assert(helpRestoredFocus.activeLabel === "Help", `help walkthrough should restore focus to Help: ${JSON.stringify(helpRestoredFocus)}`);

  await help.click();
  await page.waitForTimeout(200);
  const reopenedGuide = page.getByTestId("help-walkthrough");
  assert((await reopenedGuide.count()) === 1, "help walkthrough should reopen after Escape close");
  helpTriggerState = await readShellDialogTriggerState(page, "Help");
  assert(helpTriggerState.expanded === "true", `Help trigger should expose open state before close button: ${JSON.stringify(helpTriggerState)}`);

  const close = reopenedGuide.getByRole("button", { name: "Close help", exact: true });
  assert((await close.count()) === 1, "help walkthrough should expose close action");
  await close.click();
  await page.waitForTimeout(200);
  assert((await page.getByTestId("help-walkthrough").count()) === 0, "help walkthrough should close");
  helpTriggerState = await readShellDialogTriggerState(page, "Help");
  assert(helpTriggerState.expanded === "false", `Help trigger should expose closed state after close button: ${JSON.stringify(helpTriggerState)}`);
}

async function readHelpWalkthroughVisualState(page) {
  return page.evaluate(() => {
    const guide = document.querySelector('[data-testid="help-walkthrough"]');
    const styles = guide ? getComputedStyle(guide) : null;
    return {
      exists: Boolean(guide),
      background: styles?.backgroundColor ?? "",
      backdrop: styles?.backdropFilter ?? "",
      boxShadow: styles?.boxShadow ?? "",
    };
  });
}

async function exerciseActionInbox(page) {
  const notifications = page.getByRole("button", { name: "Notifications", exact: true });
  assert((await notifications.count()) === 1, "top bar notifications action should be available");
  let notificationsState = await readNotificationsTriggerState(page);
  assert(
    notificationsState.controls === "",
    `closed notifications trigger should not reference an unmounted dialog: ${JSON.stringify(notificationsState)}`,
  );
  assert(
    notificationsState.hasPopup === "dialog",
    `notifications trigger should expose dialog popup semantics: ${JSON.stringify(notificationsState)}`,
  );
  assert(notificationsState.expanded === "false", `notifications trigger should start closed: ${JSON.stringify(notificationsState)}`);
  await notifications.click();
  await page.waitForTimeout(300);

  await expectText(page, "Needs attention");
  await expectText(page, "Start with the first item");
  await expectText(page, "do now");
  notificationsState = await readNotificationsTriggerState(page);
  assert(
    notificationsState.controls === "action-inbox-dialog",
    `open notifications trigger should identify the mounted dialog: ${JSON.stringify(notificationsState)}`,
  );
  assert(notificationsState.expanded === "true", `notifications trigger should expose open state: ${JSON.stringify(notificationsState)}`);
  const actionInboxDialog = page.locator("#action-inbox-dialog");
  assert((await actionInboxDialog.count()) === 1, "action inbox dialog should render with the id controlled by the trigger");
  assert((await actionInboxDialog.getAttribute("role")) === "dialog", "action inbox controlled element should be a dialog");
  assert((await actionInboxDialog.getAttribute("aria-describedby")) === "action-inbox-description", "action inbox should describe the dialog with its helper copy");
  await expectVisibleControlSize(page, 'button[aria-label="Close notifications"]', "notifications close");
  const actionInboxVisualState = await readActionInboxVisualState(page);
  assert(
    actionInboxVisualState.background.includes("rgba"),
    `action inbox should use the streamlined translucent surface: ${JSON.stringify(actionInboxVisualState)}`,
  );
  assert(
    actionInboxVisualState.backdrop.includes("blur"),
    `action inbox should keep subtle backdrop depth: ${JSON.stringify(actionInboxVisualState)}`,
  );

  const openedFocus = await dialogFocusState(page, '[data-testid="action-inbox-dialog"]');
  assert(
    openedFocus.insideDialog && openedFocus.activeLabel === "Close notifications",
    `action inbox should focus the close control on open: ${JSON.stringify(openedFocus)}`,
  );

  await page.keyboard.press("Shift+Tab");
  const wrappedBackward = await dialogFocusState(page, '[data-testid="action-inbox-dialog"]');
  assert(
    wrappedBackward.insideDialog && wrappedBackward.activeLabel !== "Close notifications",
    `action inbox should keep Shift+Tab inside the dialog: ${JSON.stringify(wrappedBackward)}`,
  );

  await page.keyboard.press("Tab");
  const wrappedForward = await dialogFocusState(page, '[data-testid="action-inbox-dialog"]');
  assert(
    wrappedForward.insideDialog && wrappedForward.activeLabel === "Close notifications",
    `action inbox should wrap Tab back to close: ${JSON.stringify(wrappedForward)}`,
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  assert((await page.getByTestId("action-inbox-dialog").count()) === 0, "action inbox should close with Escape");
  notificationsState = await readNotificationsTriggerState(page);
  assert(notificationsState.expanded === "false", `notifications trigger should expose closed state after Escape: ${JSON.stringify(notificationsState)}`);
  const restoredFocus = await page.evaluate(() => ({
    activeLabel: document.activeElement?.getAttribute("aria-label") ?? "",
    activeText: document.activeElement?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  }));
  assert(
    restoredFocus.activeLabel === "Notifications",
    `action inbox should restore focus to notifications: ${JSON.stringify(restoredFocus)}`,
  );

  await notifications.click();
  await page.waitForTimeout(200);
  const close = page.getByRole("button", { name: "Close notifications", exact: true });
  assert((await close.count()) === 1, "action inbox should expose a close action");
  notificationsState = await readNotificationsTriggerState(page);
  assert(notificationsState.expanded === "true", `notifications trigger should expose open state before close button: ${JSON.stringify(notificationsState)}`);
  await close.click();
  await page.waitForTimeout(200);
  assert((await page.getByTestId("action-inbox-dialog").count()) === 0, "action inbox should close cleanly");
  notificationsState = await readNotificationsTriggerState(page);
  assert(notificationsState.expanded === "false", `notifications trigger should expose closed state after close button: ${JSON.stringify(notificationsState)}`);
}

async function exerciseImportWorkspaceModal(page) {
  const importButton = page.getByRole("button", { name: "Import", exact: true });
  assert((await importButton.count()) === 1, "settings header should expose a concise Import action");
  await importButton.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="import-workspace-modal"]'), null, { timeout: 8000 });

  const modal = page.getByTestId("import-workspace-modal");
  assert((await modal.getAttribute("role")) === "dialog", "import workspace should render as a dialog");
  assert((await modal.getAttribute("aria-describedby")) === "import-workspace-description import-workspace-warning", "import workspace should describe purpose and replacement warning");
  await expectVisibleControlSize(page, 'button[aria-label="Close import workspace"]', "import workspace close");
  assert((await modal.getByLabel("Paste exported workspace JSON", { exact: true }).count()) === 1, "import workspace JSON textarea should have a programmatic label");
  const importVisualState = await readImportWorkspaceVisualState(page);
  assert(
    importVisualState.background.includes("rgba"),
    `import workspace should use the streamlined translucent surface: ${JSON.stringify(importVisualState)}`,
  );
  assert(
    importVisualState.backdrop.includes("blur"),
    `import workspace should keep subtle backdrop depth: ${JSON.stringify(importVisualState)}`,
  );

  const importFocus = await dialogFocusState(page, '[data-testid="import-workspace-modal"]');
  assert(
    importFocus.insideDialog && importFocus.activeLabel === "Close import workspace",
    `import workspace should focus the close control on open: ${JSON.stringify(importFocus)}`,
  );

  const submit = page.getByTestId("import-workspace-submit");
  assert((await submit.getAttribute("disabled")) !== null, "import workspace action should stay disabled until JSON is present");
  let importSubmitState = await page.evaluate(() => {
    const submitButton = document.querySelector('[data-testid="import-workspace-submit"]');
    const describedBy = submitButton?.getAttribute("aria-describedby") ?? "";
    return {
      title: submitButton?.getAttribute("title") ?? "",
      describedBy,
      description: describedBy ? document.getElementById(describedBy)?.textContent?.replace(/\s+/g, " ").trim() ?? "" : "",
    };
  });
  assert(
    importSubmitState.description.includes("Choose a workspace JSON file"),
    `disabled import action should explain how to enable it: ${JSON.stringify(importSubmitState)}`,
  );
  assert(
    importSubmitState.title.includes("Choose a workspace JSON file"),
    `disabled import action should expose a hover explanation: ${JSON.stringify(importSubmitState)}`,
  );
  const paste = page.getByTestId("import-workspace-json");
  await paste.fill('{"schema":"enterprise-ai-enablement-os.workspace.v1"}');
  assert((await submit.getAttribute("disabled")) === null, "import workspace action should enable after pasted JSON is present");
  importSubmitState = await page.evaluate(() => ({
    title: document.querySelector('[data-testid="import-workspace-submit"]')?.getAttribute("title") ?? "",
    describedBy: document.querySelector('[data-testid="import-workspace-submit"]')?.getAttribute("aria-describedby") ?? "",
  }));
  assert(importSubmitState.title === "", `enabled import action should not keep stale disabled title: ${JSON.stringify(importSubmitState)}`);
  assert(importSubmitState.describedBy === "", `enabled import action should not keep stale disabled description: ${JSON.stringify(importSubmitState)}`);

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[data-testid="import-workspace-modal"]'), null, { timeout: 8000 });
  const restoredFocus = await page.evaluate(() => ({
    activeText: document.activeElement?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  }));
  assert(restoredFocus.activeText.includes("Import"), `import workspace should restore focus to the import trigger: ${JSON.stringify(restoredFocus)}`);
}

async function readImportWorkspaceVisualState(page) {
  return page.evaluate(() => {
    const modal = document.querySelector('[data-testid="import-workspace-modal"]');
    const styles = modal ? getComputedStyle(modal) : null;
    return {
      exists: Boolean(modal),
      background: styles?.backgroundColor ?? "",
      backdrop: styles?.backdropFilter ?? "",
      boxShadow: styles?.boxShadow ?? "",
    };
  });
}

async function readActionInboxVisualState(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[data-testid="action-inbox-dialog"]');
    const styles = dialog ? getComputedStyle(dialog) : null;
    return {
      exists: Boolean(dialog),
      background: styles?.backgroundColor ?? "",
      backdrop: styles?.backdropFilter ?? "",
      boxShadow: styles?.boxShadow ?? "",
    };
  });
}

async function readNotificationsTriggerState(page) {
  return readShellDialogTriggerState(page, "Notifications");
}

async function readShellDialogTriggerState(page, label) {
  return page.evaluate((accessibleName) => {
    const trigger = Array.from(document.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === accessibleName,
    );
    return {
      exists: Boolean(trigger),
      controls: trigger?.getAttribute("aria-controls") ?? "",
      expanded: trigger?.getAttribute("aria-expanded") ?? "",
      hasPopup: trigger?.getAttribute("aria-haspopup") ?? "",
    };
  }, label);
}

async function exerciseWorkspaceProfileMenu(page) {
  const profile = page.getByRole("button", { name: "Workspace profile", exact: true });
  assert((await profile.count()) === 1, "top bar workspace profile action should be available");
  let profileTriggerState = await readShellDialogTriggerState(page, "Workspace profile");
  assert(
    profileTriggerState.controls === "",
    `closed workspace profile trigger should not reference an unmounted menu: ${JSON.stringify(profileTriggerState)}`,
  );
  assert(
    profileTriggerState.hasPopup === "menu",
    `workspace profile trigger should expose menu popup semantics: ${JSON.stringify(profileTriggerState)}`,
  );
  assert(profileTriggerState.expanded === "false", `workspace profile trigger should start closed: ${JSON.stringify(profileTriggerState)}`);

  await profile.click();
  await page.waitForFunction(
    () => document.activeElement?.textContent?.replace(/\s+/g, " ").trim().includes("Workspace admin"),
    null,
    { timeout: 8000 },
  );

  const menu = page.getByTestId("workspace-profile-menu");
  assert((await menu.count()) === 1, "workspace profile menu should open");
  profileTriggerState = await readShellDialogTriggerState(page, "Workspace profile");
  assert(
    profileTriggerState.controls === "workspace-profile-menu",
    `open workspace profile trigger should identify the mounted menu: ${JSON.stringify(profileTriggerState)}`,
  );
  assert(profileTriggerState.expanded === "true", `workspace profile trigger should expose open state: ${JSON.stringify(profileTriggerState)}`);
  assert((await menu.getAttribute("id")) === "workspace-profile-menu", "workspace profile test target should be the controlled menu");
  assert((await menu.getAttribute("role")) === "menu", "workspace profile menu should expose menu semantics");
  assert(
    (await menu.getByRole("menuitem").count()) === 3,
    "workspace profile menu should expose its actions as menu items",
  );
  await expectText(page, "Workspace Admin");
  await expectText(page, "Company setup");
  await expectText(page, "This menu controls the current workspace shell");
  await page.keyboard.press("ArrowDown");
  let profileFocusState = await page.evaluate(() => ({
    role: document.activeElement?.getAttribute("role") ?? "",
    text: document.activeElement?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  }));
  assert(
    profileFocusState.role === "menuitem" &&
      (profileFocusState.text.includes("Launch handoff") || profileFocusState.text.includes("Guided setup")),
    `ArrowDown should move workspace profile focus to the next menu item: ${JSON.stringify(profileFocusState)}`,
  );
  await page.keyboard.press("End");
  profileFocusState = await page.evaluate(() => ({
    role: document.activeElement?.getAttribute("role") ?? "",
    text: document.activeElement?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  }));
  assert(
    profileFocusState.role === "menuitem" && profileFocusState.text.includes("Company setup"),
    `End should move workspace profile focus to the final menu item: ${JSON.stringify(profileFocusState)}`,
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  assert((await page.getByTestId("workspace-profile-menu").count()) === 0, "workspace profile menu should close with Escape");
  profileTriggerState = await readShellDialogTriggerState(page, "Workspace profile");
  assert(profileTriggerState.expanded === "false", `workspace profile trigger should expose closed state after Escape: ${JSON.stringify(profileTriggerState)}`);
  const restoredFocus = await page.evaluate(() => ({
    activeLabel: document.activeElement?.getAttribute("aria-label") ?? "",
    activeText: document.activeElement?.textContent?.replace(/\s+/g, " ").trim() ?? "",
  }));
  assert(
    restoredFocus.activeLabel === "Workspace profile",
    `workspace profile menu should restore focus to trigger: ${JSON.stringify(restoredFocus)}`,
  );

  await profile.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="workspace-profile-menu"]'), null, { timeout: 8000 });
  await page.locator("#workspace-main-content").click({ position: { x: 12, y: 12 } });
  await page.waitForTimeout(200);
  assert((await page.getByTestId("workspace-profile-menu").count()) === 0, "workspace profile menu should close on outside click");
  profileTriggerState = await readShellDialogTriggerState(page, "Workspace profile");
  assert(profileTriggerState.expanded === "false", `workspace profile trigger should expose closed state after outside click: ${JSON.stringify(profileTriggerState)}`);

  await profile.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="workspace-profile-menu"]'), null, { timeout: 8000 });
  await menu.getByRole("menuitem", { name: "Workspace admin", exact: true }).click();
  await page.waitForTimeout(300);
  await expectText(page, "Tenant Branding");
  assert((await page.getByTestId("workspace-profile-menu").count()) === 0, "workspace profile menu should close after navigation");
  profileTriggerState = await readShellDialogTriggerState(page, "Workspace profile");
  assert(profileTriggerState.expanded === "false", `workspace profile trigger should expose closed state after navigation: ${JSON.stringify(profileTriggerState)}`);
}

async function exerciseContextStatusNotices(page) {
  await page.waitForFunction(() => document.querySelector('[data-testid="context-index-status"]'), null, { timeout: 8000 });
  await assertStatusNotice(page.getByTestId("context-index-status"), "context index status");

  const question = page.getByLabel("Knowledge check question");
  assert((await question.count()) >= 1, "context fabric should expose a labelled knowledge check question");
  await question.fill("");
  const disabledRetrievalState = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.replace(/\s+/g, " ").trim() === "Run safe retrieval test",
    );
    const describedBy = button?.getAttribute("aria-describedby") ?? "";
    return {
      exists: Boolean(button),
      disabled: Boolean(button?.hasAttribute("disabled")),
      describedBy,
      description: describedBy ? document.getElementById(describedBy)?.textContent?.replace(/\s+/g, " ").trim() ?? "" : "",
      title: button?.getAttribute("title") ?? "",
    };
  });
  assert(disabledRetrievalState.exists, `context fabric should render the primary retrieval action: ${JSON.stringify(disabledRetrievalState)}`);
  assert(disabledRetrievalState.disabled, `empty context query should disable retrieval: ${JSON.stringify(disabledRetrievalState)}`);
  assert(
    disabledRetrievalState.description.includes("question") || disabledRetrievalState.description.includes("Skill"),
    `disabled retrieval should explain the missing prerequisite: ${JSON.stringify(disabledRetrievalState)}`,
  );
  assert(
    disabledRetrievalState.title === disabledRetrievalState.description,
    `disabled retrieval should expose the same hover and screen-reader explanation: ${JSON.stringify(disabledRetrievalState)}`,
  );
  await question.fill("What PTO carryover rules apply after three years?");

  const runSafeRetrieval = page.getByRole("button", { name: "Run safe retrieval test", exact: true });
  assert((await runSafeRetrieval.count()) === 1, "context fabric should expose a safe retrieval test action");
  await runSafeRetrieval.click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="context-retrieval-status"], [data-testid="context-retrieval-error"]'),
    null,
    { timeout: 10000 },
  );
  await assertVisibleStatusChoice(page, ["context-retrieval-status", "context-retrieval-error"], "context retrieval feedback");
}

async function exerciseLaunchStatusNotices(page) {
  await clickNav(page, "Launch Plan");
  await page.waitForTimeout(400);
  await expectPageHeading(page, "Launch Plan");

  const testReadiness = page.getByRole("button", { name: "Test Readiness", exact: true });
  assert((await testReadiness.count()) === 1, "launch plan should expose a readiness test action");
  await testReadiness.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="launch-readiness-status"]'), null, { timeout: 8000 });
  await assertStatusNotice(page.getByTestId("launch-readiness-status"), "launch readiness status");
}

async function exerciseProofLedgerStatusNotice(page) {
  const packetTab = page.getByTestId("evidence-tab-packet");
  assert((await packetTab.count()) === 1, "Proof Ledger should expose the Packet tab before export status checks");
  await packetTab.click();
  await page.waitForTimeout(160);

  const exportJson = page.getByRole("button", { name: "Export JSON", exact: true });
  assert((await exportJson.count()) === 1, "Proof Ledger should expose a JSON export action");
  await exportJson.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="evidence-packet-status"]'), null, { timeout: 8000 });
  await assertStatusNotice(page.getByTestId("evidence-packet-status"), "evidence packet export status");
}

async function expectGovernanceBlockedApprovalReason(page) {
  const state = await page.evaluate(() => {
    const approveButtons = Array.from(document.querySelectorAll("button")).filter(
      (button) => button.textContent?.replace(/\s+/g, " ").trim() === "Approve",
    );
    const disabledApprove = approveButtons.find((button) => button.hasAttribute("disabled")) ?? null;
    const describedBy = disabledApprove?.getAttribute("aria-describedby") ?? "";
    const description = describedBy ? document.getElementById(describedBy)?.textContent?.replace(/\s+/g, " ").trim() ?? "" : "";
    const descriptionRect = describedBy ? document.getElementById(describedBy)?.getBoundingClientRect() : null;
    return {
      disabledApproveFound: Boolean(disabledApprove),
      title: disabledApprove?.getAttribute("title") ?? "",
      describedBy,
      description,
      descriptionVisible:
        Boolean(descriptionRect && descriptionRect.width > 20 && descriptionRect.height > 10),
    };
  });

  if (!state.disabledApproveFound) return;

  assert(
    state.description.includes("Full approval is locked"),
    `blocked Governance approval should explain why full approval is unavailable: ${JSON.stringify(state)}`,
  );
  assert(
    state.description.includes("Request changes") && state.description.includes("approve with conditions"),
    `blocked Governance approval should name the available alternatives: ${JSON.stringify(state)}`,
  );
  assert(
    state.title === state.description,
    `blocked Governance approval should expose the same hover and screen-reader explanation: ${JSON.stringify(state)}`,
  );
  assert(
    state.descriptionVisible,
    `blocked Governance approval reason should be visible, not only a tooltip: ${JSON.stringify(state)}`,
  );
}

async function exerciseProofLedgerTabs(page) {
  await clickNav(page, "Proof Ledger");
  await page.waitForTimeout(500);
  await expectText(page, "Proof Ledger");
  await expectActiveNavVisible(page, "Proof Ledger");
  await expectOpenClawProofLedgerLayout(page);

  const packetState = await readProofLedgerState(page);
  assert(packetState.selectedTabs.includes("evidence-packet-tab"), "Proof Ledger should start on the Packet tab");
  assert(packetState.panels.length === 1, `Packet tab should render one panel, got ${packetState.panels.join(", ")}`);
  assert(packetState.panels[0] === "evidence-packet-panel", "Packet tab should render the packet panel");
  assert(packetState.recordsSearchInputs === 0, "Packet tab should not render the Records table search");

  const tabExpectations = [
    ["records", "evidence-records-panel", "Evidence records", 1],
    ["trace", "evidence-trace-panel", "Trace replay", 0],
    ["controls", "evidence-controls-panel", "Control coverage", 0],
  ];

  for (const [tabId, panelId, expectedText, expectedRecordSearchInputs] of tabExpectations) {
    const tab = page.getByTestId(`evidence-tab-${tabId}`);
    assert((await tab.count()) === 1, `Proof Ledger should expose ${tabId} tab`);
    await tab.click();
    await page.waitForTimeout(250);
    const state = await readProofLedgerState(page);
    assert(state.selectedTabs.includes(`evidence-${tabId}-tab`), `${tabId} tab should become selected`);
    assert(state.panels.length === 1, `${tabId} tab should render one panel, got ${state.panels.join(", ")}`);
    assert(state.panels[0] === panelId, `${tabId} tab should render ${panelId}`);
    assert(state.recordsSearchInputs === expectedRecordSearchInputs, `${tabId} tab rendered an unexpected records search count`);
    await expectText(page, expectedText);
    if (tabId === "records") {
      await expectDataTables(page, ["Evidence records"]);
      await exerciseProofLedgerRecordKeyboardSelection(page);
    }
  }

  await exerciseProofLedgerKeyboardNavigation(page);
}

async function expectOpenClawProofLedgerLayout(page) {
  const cardState = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="openclaw-proof-event-"]')).map((card) => {
      const rect = card.getBoundingClientRect();
      return {
        id: card.getAttribute("data-testid") ?? "",
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        clientWidth: card.clientWidth,
        scrollWidth: card.scrollWidth,
        overflowed: card.scrollWidth > card.clientWidth + 3,
        text: card.textContent?.replace(/\s+/g, " ").trim().slice(0, 90) ?? "",
      };
    }),
  );

  assert(cardState.length >= 5, `Proof Ledger should render OpenClaw proof event cards: ${JSON.stringify(cardState)}`);
  for (const card of cardState) {
    assert(card.width >= 160, `OpenClaw proof event cards should not collapse on desktop: ${JSON.stringify(cardState)}`);
    assert(card.height >= 120, `OpenClaw proof event cards should preserve useful vertical affordance: ${JSON.stringify(cardState)}`);
    assert(!card.overflowed, `OpenClaw proof event cards should not overflow their text containers: ${JSON.stringify(cardState)}`);
  }
}

async function exerciseProofLedgerRecordKeyboardSelection(page) {
  const tableState = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table[aria-label="Evidence records"] tbody tr'));
    return {
      rowCount: rows.length,
      focusableRows: rows.filter((row) => row.getAttribute("tabindex") === "0").length,
      labelledRows: rows.filter((row) => row.getAttribute("aria-label")?.startsWith("Select evidence record ")).length,
      selectedRows: rows.filter((row) => row.getAttribute("aria-selected") === "true").length,
      secondRecordTitle:
        rows[1]?.querySelector("td:first-child .text-slate-950")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    };
  });

  assert(tableState.rowCount >= 2, `Proof Ledger needs at least two records for keyboard row selection: ${JSON.stringify(tableState)}`);
  assert(tableState.focusableRows === tableState.rowCount, `evidence rows should be keyboard focusable: ${JSON.stringify(tableState)}`);
  assert(tableState.labelledRows === tableState.rowCount, `evidence rows should expose selection labels: ${JSON.stringify(tableState)}`);
  assert(tableState.selectedRows === 1, `one evidence row should start selected: ${JSON.stringify(tableState)}`);
  assert(tableState.secondRecordTitle, `second evidence row should expose a title: ${JSON.stringify(tableState)}`);

  const secondRow = page.locator('table[aria-label="Evidence records"] tbody tr').nth(1);
  await secondRow.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(160);

  const selectedAfterEnter = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table[aria-label="Evidence records"] tbody tr'));
    const selectedRow = rows.find((row) => row.getAttribute("aria-selected") === "true");
    return {
      selectedTitle:
        selectedRow?.querySelector("td:first-child .text-slate-950")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      selectedPanelTitle:
        document.querySelector('[data-testid="evidence-tabpanel-records"] aside h3')?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      focusedRowLabel: document.activeElement?.getAttribute("aria-label") ?? "",
    };
  });

  assert(
    selectedAfterEnter.selectedTitle === tableState.secondRecordTitle,
    `Enter should select the focused evidence row: ${JSON.stringify({ tableState, selectedAfterEnter })}`,
  );
  assert(
    selectedAfterEnter.selectedPanelTitle === tableState.secondRecordTitle,
    `Evidence detail panel should follow keyboard row selection: ${JSON.stringify({ tableState, selectedAfterEnter })}`,
  );
  assert(
    selectedAfterEnter.focusedRowLabel.includes(tableState.secondRecordTitle),
    `Keyboard selection should keep focus on the selected row: ${JSON.stringify({ tableState, selectedAfterEnter })}`,
  );
}

async function exerciseProofLedgerKeyboardNavigation(page) {
  const packetTab = page.getByTestId("evidence-tab-packet");
  assert((await packetTab.count()) === 1, "Proof Ledger should expose the Packet tab for keyboard navigation");
  await packetTab.click();
  await page.waitForTimeout(120);
  await packetTab.focus();

  let state = await readProofLedgerState(page);
  assert(state.focusedTabId === "evidence-packet-tab", `Packet tab should accept focus: ${JSON.stringify(state)}`);
  assert(state.tabIndexes["evidence-packet-tab"] === "0", `Packet tab should be tabbable when selected: ${JSON.stringify(state)}`);
  assert(state.tabIndexes["evidence-trace-tab"] === "-1", `Trace tab should not be in the tab order until selected: ${JSON.stringify(state)}`);

  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(120);
  state = await readProofLedgerState(page);
  assert(state.selectedTabs.includes("evidence-trace-tab"), `ArrowRight should select Trace: ${JSON.stringify(state)}`);
  assert(state.focusedTabId === "evidence-trace-tab", `ArrowRight should move focus to Trace: ${JSON.stringify(state)}`);
  assert(state.panels[0] === "evidence-trace-panel", `Trace panel should render after ArrowRight: ${JSON.stringify(state)}`);

  await page.keyboard.press("End");
  await page.waitForTimeout(120);
  state = await readProofLedgerState(page);
  assert(state.selectedTabs.includes("evidence-records-tab"), `End should select Records: ${JSON.stringify(state)}`);
  assert(state.focusedTabId === "evidence-records-tab", `End should move focus to Records: ${JSON.stringify(state)}`);
  assert(state.panels[0] === "evidence-records-panel", `Records panel should render after End: ${JSON.stringify(state)}`);

  await page.keyboard.press("Home");
  await page.waitForTimeout(120);
  state = await readProofLedgerState(page);
  assert(state.selectedTabs.includes("evidence-packet-tab"), `Home should return to Packet: ${JSON.stringify(state)}`);
  assert(state.focusedTabId === "evidence-packet-tab", `Home should move focus to Packet: ${JSON.stringify(state)}`);
  assert(state.panels[0] === "evidence-packet-panel", `Packet panel should render after Home: ${JSON.stringify(state)}`);

  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(120);
  state = await readProofLedgerState(page);
  assert(state.selectedTabs.includes("evidence-records-tab"), `ArrowLeft should wrap from Packet to Records: ${JSON.stringify(state)}`);
  assert(state.focusedTabId === "evidence-records-tab", `ArrowLeft should move focus to Records: ${JSON.stringify(state)}`);
  assert(state.panels[0] === "evidence-records-panel", `Records panel should render after ArrowLeft wrap: ${JSON.stringify(state)}`);
}

async function exerciseUseCaseAdvancedFilterDisclosure(page) {
  const iconToggle = page.getByRole("button", { name: "Toggle advanced filters", exact: true });
  assert((await iconToggle.count()) === 1, "use case backlog should expose the advanced filter icon toggle");
  assert(
    !(await iconToggle.getAttribute("aria-controls")),
    "closed advanced filter icon toggle should not point at an unmounted panel",
  );
  assert((await iconToggle.getAttribute("aria-expanded")) === "false", "advanced filter icon toggle should start closed");

  await iconToggle.click();
  await page.waitForFunction(() => document.querySelector("#use-case-advanced-filters"), null, { timeout: 5000 });

  const panel = page.locator("#use-case-advanced-filters");
  assert((await panel.count()) === 1, "advanced filter panel should open");
  assert((await panel.getAttribute("role")) === "region", "advanced filter panel should expose region semantics");
  assert(
    (await iconToggle.getAttribute("aria-controls")) === "use-case-advanced-filters",
    "open advanced filter icon toggle should identify its controlled panel",
  );
  assert((await iconToggle.getAttribute("aria-expanded")) === "true", "advanced filter icon toggle should expose open state");

  const textToggle = page.getByRole("button", { name: "More filters", exact: true });
  assert((await textToggle.count()) === 1, "use case backlog should expose a text advanced filter toggle");
  assert(
    (await textToggle.getAttribute("aria-controls")) === "use-case-advanced-filters",
    "advanced filter text toggle should identify its controlled panel",
  );
  assert((await textToggle.getAttribute("aria-expanded")) === "true", "advanced filter text toggle should expose open state");

  await textToggle.click();
  await page.waitForFunction(() => !document.querySelector("#use-case-advanced-filters"), null, { timeout: 5000 });
  assert((await iconToggle.getAttribute("aria-expanded")) === "false", "advanced filter icon toggle should expose closed state");
  assert((await textToggle.getAttribute("aria-expanded")) === "false", "advanced filter text toggle should expose closed state");
  assert(
    !(await iconToggle.getAttribute("aria-controls")) && !(await textToggle.getAttribute("aria-controls")),
    "closed advanced filter toggles should clear stale aria-controls references",
  );
}

async function exerciseUseCaseFactoryTabs(page) {
  await page.waitForFunction(() => document.querySelector('[data-testid="use-case-factory-tabs"]'), null, { timeout: 5000 });

  const tabChecks = [
    ["Start", "overview", ["Factory Operating System", "This is the operating front door"]],
    ["New idea", "intake", ["One-minute use case creator", "Business Problem"]],
    ["Backlog", "backlog", ["Use case opportunity backlog", "Total use cases"]],
    ["Prioritize", "scoring", ["Use case opportunity backlog", "Compare value, feasibility"]],
    ["Brief", "detail", ["Business Problem", "No brief selected"]],
    ["Pilot", "pilot", ["Pilot Operating Plan", "No pilot plan selected"]],
    ["Value", "value", ["ROI Model", "No value estimate selected"]],
    ["Backlog", "backlog", ["Use case opportunity backlog", "Total use cases"]],
  ];

  let initialState = await readUseCaseFactoryTabState(page);
  assert(initialState.selectedTab === "Start", `Use Case Factory should start on Start: ${JSON.stringify(initialState)}`);
  assertUseCaseFactoryTabA11y(initialState, "Start", "overview");

  for (const [label, panelSuffix, expectedTextOptions] of tabChecks.slice(1)) {
    await clickTab(page, label, page.getByTestId("use-case-factory-tabs"));
    await page.waitForTimeout(160);
    await expectAnyText(page, expectedTextOptions);
    const state = await readUseCaseFactoryTabState(page);
    assert(state.selectedTab === label, `${label} should become the selected Use Case Factory tab: ${JSON.stringify(state)}`);
    assertUseCaseFactoryTabA11y(state, label, panelSuffix);
  }

  initialState = await readUseCaseFactoryTabState(page);
  assert(initialState.selectedTab === "Backlog", `Use Case Factory tab exercise should leave Backlog selected: ${JSON.stringify(initialState)}`);
}

async function readUseCaseFactoryTabState(page) {
  return page.evaluate(() => {
    const tabRegion = document.querySelector('[data-testid="use-case-factory-tabs"]');
    const selectedTab = tabRegion?.querySelector('[role="tab"][aria-selected="true"]');
    const visiblePanel = Array.from(document.querySelectorAll('[data-testid^="use-case-factory-panel-"]')).find((panel) => {
      const rect = panel.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    return {
      selectedTab: selectedTab?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      selectedTabId: selectedTab?.id ?? "",
      selectedControls: selectedTab?.getAttribute("aria-controls") ?? "",
      tabListLabel: tabRegion?.querySelector('[role="tablist"]')?.getAttribute("aria-label") ?? "",
      panelId: visiblePanel?.id ?? "",
      panelRole: visiblePanel?.getAttribute("role") ?? "",
      panelLabelledBy: visiblePanel?.getAttribute("aria-labelledby") ?? "",
      panelTestId: visiblePanel?.getAttribute("data-testid") ?? "",
    };
  });
}

function assertUseCaseFactoryTabA11y(state, label, panelSuffix) {
  const expectedPanelId = `use-case-factory-panel-${panelSuffix}`;
  assert(state.tabListLabel === "Use case factory sections", `${label} tabs should expose a specific tablist label: ${JSON.stringify(state)}`);
  assert(state.selectedTabId, `${label} selected tab should expose a stable id: ${JSON.stringify(state)}`);
  assert(state.panelId === expectedPanelId, `${label} panel should expose the expected stable id: ${JSON.stringify(state)}`);
  assert(state.panelTestId === expectedPanelId, `${label} panel should expose a stable test id: ${JSON.stringify(state)}`);
  assert(state.selectedControls === state.panelId, `${label} tab should control its panel: ${JSON.stringify(state)}`);
  assert(state.panelRole === "tabpanel", `${label} content should expose tabpanel semantics: ${JSON.stringify(state)}`);
  assert(state.panelLabelledBy === state.selectedTabId, `${label} panel should be labelled by selected tab: ${JSON.stringify(state)}`);
}

async function exerciseUseCaseBacklogDetailTabs(page) {
  const firstUseCase = page
    .locator('table[aria-label="Use case opportunity backlog"] tbody tr td:nth-child(2) button')
    .first();
  assert((await firstUseCase.count()) === 1, "Use case backlog should expose a clickable first opportunity");
  await firstUseCase.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="use-case-detail-tabs"]'), null, { timeout: 5000 });

  const tabs = page.getByTestId("use-case-detail-tabs");
  const overview = tabs.getByRole("tab", { name: "Overview", exact: true });
  assert((await overview.count()) === 1, "use case detail should expose an Overview tab");
  await overview.focus();

  const initial = await readUseCaseBacklogDetailTabState(page);
  assert(initial.selectedTab === "Overview", `use case detail should start on Overview: ${JSON.stringify(initial)}`);
  assert(initial.panelTestId === "use-case-detail-panel-overview", `Overview panel should render: ${JSON.stringify(initial)}`);
  assertUseCaseDetailTabA11y(initial, "Overview");

  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(120);
  const afterArrow = await readUseCaseBacklogDetailTabState(page);
  assert(afterArrow.selectedTab === "Analysis", `ArrowRight should select Analysis: ${JSON.stringify(afterArrow)}`);
  assert(afterArrow.panelTestId === "use-case-detail-panel-analysis", `Analysis panel should render: ${JSON.stringify(afterArrow)}`);
  assert(afterArrow.focusedTab === "Analysis", `ArrowRight should move focus to Analysis: ${JSON.stringify(afterArrow)}`);
  assertUseCaseDetailTabA11y(afterArrow, "Analysis");

  await page.keyboard.press("End");
  await page.waitForTimeout(120);
  const afterEnd = await readUseCaseBacklogDetailTabState(page);
  assert(afterEnd.selectedTab === "History", `End should select History: ${JSON.stringify(afterEnd)}`);
  assert(afterEnd.panelTestId === "use-case-detail-panel-history", `History panel should render: ${JSON.stringify(afterEnd)}`);
  assertUseCaseDetailTabA11y(afterEnd, "History");

  await page.keyboard.press("Home");
  await page.waitForTimeout(120);
  const afterHome = await readUseCaseBacklogDetailTabState(page);
  assert(afterHome.selectedTab === "Overview", `Home should return to Overview: ${JSON.stringify(afterHome)}`);
  assert(afterHome.panelTestId === "use-case-detail-panel-overview", `Overview panel should render after Home: ${JSON.stringify(afterHome)}`);
  assertUseCaseDetailTabA11y(afterHome, "Overview");
}

async function readUseCaseBacklogDetailTabState(page) {
  return page.evaluate(() => {
    const tabRegion = document.querySelector('[data-testid="use-case-detail-tabs"]');
    const selectedTab = tabRegion?.querySelector('[role="tab"][aria-selected="true"]');
    const focusedTab = tabRegion?.contains(document.activeElement) ? document.activeElement : null;
    const visiblePanel = Array.from(document.querySelectorAll('[data-testid^="use-case-detail-panel-"]')).find((panel) => {
      const rect = panel.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    return {
      selectedTab: selectedTab?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      selectedTabId: selectedTab?.id ?? "",
      selectedControls: selectedTab?.getAttribute("aria-controls") ?? "",
      focusedTab: focusedTab?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      focusedTabId: focusedTab?.id ?? "",
      tabListLabel: tabRegion?.querySelector('[role="tablist"]')?.getAttribute("aria-label") ?? "",
      panelId: visiblePanel?.id ?? "",
      panelRole: visiblePanel?.getAttribute("role") ?? "",
      panelLabelledBy: visiblePanel?.getAttribute("aria-labelledby") ?? "",
      panelTestId: visiblePanel?.getAttribute("data-testid") ?? "",
    };
  });
}

function assertUseCaseDetailTabA11y(state, label) {
  assert(state.tabListLabel === "Use case detail sections", `${label} tabs should expose a specific tablist label: ${JSON.stringify(state)}`);
  assert(state.selectedTabId, `${label} selected tab should expose a stable id: ${JSON.stringify(state)}`);
  assert(state.panelId, `${label} panel should expose a stable id: ${JSON.stringify(state)}`);
  assert(state.selectedControls === state.panelId, `${label} tab should control its panel: ${JSON.stringify(state)}`);
  assert(state.panelRole === "tabpanel", `${label} content should expose tabpanel semantics: ${JSON.stringify(state)}`);
  assert(state.panelLabelledBy === state.selectedTabId, `${label} panel should be labelled by selected tab: ${JSON.stringify(state)}`);
}

async function exerciseSkillDetailTabs(page) {
  await page.goto(`${baseUrl}/?view=skills&skillMode=detail&skillTab=overview&ui-smoke-skill-tabs=${Date.now()}`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector('[data-testid="skill-detail-tabs"]'), null, { timeout: 8000 });

  const initial = await readSkillDetailTabState(page);
  assert(initial.selectedTab === "Overview", `Skill detail should start on Overview: ${JSON.stringify(initial)}`);
  assert(initial.panelTestId === "skill-detail-panel-overview", `Skill overview panel should render: ${JSON.stringify(initial)}`);
  assertSkillDetailTabA11y(initial, "Overview");

  const promptTab = page.getByTestId("skill-detail-tabs").getByRole("tab", { name: "Prompt", exact: true });
  assert((await promptTab.count()) === 1, "Skill detail should expose a Prompt tab");
  await promptTab.click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="skill-detail-panel-prompt"]'),
    null,
    { timeout: 5000 },
  );
  const promptState = await readSkillDetailTabState(page);
  assert(promptState.selectedTab === "Prompt", `Prompt tab should become selected: ${JSON.stringify(promptState)}`);
  assert(promptState.panelTestId === "skill-detail-panel-prompt", `Prompt panel should render: ${JSON.stringify(promptState)}`);
  assertSkillDetailTabA11y(promptState, "Prompt");

  await promptTab.focus();
  await page.keyboard.press("End");
  await page.waitForTimeout(120);
  const afterEnd = await readSkillDetailTabState(page);
  assert(afterEnd.selectedTab === "Versions", `End should select Versions: ${JSON.stringify(afterEnd)}`);
  assert(afterEnd.focusedTab === "Versions", `End should move focus to Versions: ${JSON.stringify(afterEnd)}`);
  assert(afterEnd.panelTestId === "skill-detail-panel-versions", `Versions panel should render: ${JSON.stringify(afterEnd)}`);
  assertSkillDetailTabA11y(afterEnd, "Versions");
}

async function readSkillDetailTabState(page) {
  return page.evaluate(() => {
    const tabRegion = document.querySelector('[data-testid="skill-detail-tabs"]');
    const selectedTab = tabRegion?.querySelector('[role="tab"][aria-selected="true"]');
    const focusedTab = tabRegion?.contains(document.activeElement) ? document.activeElement : null;
    const visiblePanel = Array.from(document.querySelectorAll('[data-testid^="skill-detail-panel-"]')).find((panel) => {
      const rect = panel.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    return {
      selectedTab: selectedTab?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      selectedTabId: selectedTab?.id ?? "",
      selectedControls: selectedTab?.getAttribute("aria-controls") ?? "",
      focusedTab: focusedTab?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      focusedTabId: focusedTab?.id ?? "",
      tabListLabel: tabRegion?.querySelector('[role="tablist"]')?.getAttribute("aria-label") ?? "",
      panelId: visiblePanel?.id ?? "",
      panelRole: visiblePanel?.getAttribute("role") ?? "",
      panelLabelledBy: visiblePanel?.getAttribute("aria-labelledby") ?? "",
      panelTestId: visiblePanel?.getAttribute("data-testid") ?? "",
    };
  });
}

function assertSkillDetailTabA11y(state, label) {
  assert(state.tabListLabel === "Skill detail sections", `${label} tabs should expose a specific tablist label: ${JSON.stringify(state)}`);
  assert(state.selectedTabId, `${label} selected tab should expose a stable id: ${JSON.stringify(state)}`);
  assert(state.panelId, `${label} panel should expose a stable id: ${JSON.stringify(state)}`);
  assert(state.selectedControls === state.panelId, `${label} tab should control its panel: ${JSON.stringify(state)}`);
  assert(state.panelRole === "tabpanel", `${label} content should expose tabpanel semantics: ${JSON.stringify(state)}`);
  assert(state.panelLabelledBy === state.selectedTabId, `${label} panel should be labelled by selected tab: ${JSON.stringify(state)}`);
}

async function readHarnessRunTabState(page) {
  return page.evaluate(() => {
    const tabRegion = document.querySelector('[data-testid="harness-run-tabs"]');
    const selectedTab = tabRegion?.querySelector('[role="tab"][aria-selected="true"]');
    const focusedTab = tabRegion?.contains(document.activeElement) ? document.activeElement : null;
    const visiblePanel = Array.from(document.querySelectorAll('[data-testid^="harness-run-panel-"]')).find((panel) => {
      const rect = panel.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    return {
      selectedTab: selectedTab?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      selectedTabId: selectedTab?.id ?? "",
      selectedControls: selectedTab?.getAttribute("aria-controls") ?? "",
      focusedTab: focusedTab?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      focusedTabId: focusedTab?.id ?? "",
      tabListLabel: tabRegion?.querySelector('[role="tablist"]')?.getAttribute("aria-label") ?? "",
      panelId: visiblePanel?.id ?? "",
      panelRole: visiblePanel?.getAttribute("role") ?? "",
      panelLabelledBy: visiblePanel?.getAttribute("aria-labelledby") ?? "",
      panelTestId: visiblePanel?.getAttribute("data-testid") ?? "",
    };
  });
}

function assertHarnessRunTabA11y(state, label) {
  assert(state.tabListLabel === "Harness run evidence sections", `${label} tabs should expose a specific tablist label: ${JSON.stringify(state)}`);
  assert(state.selectedTabId, `${label} selected tab should expose a stable id: ${JSON.stringify(state)}`);
  assert(state.panelId, `${label} panel should expose a stable id: ${JSON.stringify(state)}`);
  assert(state.selectedControls === state.panelId, `${label} tab should control its panel: ${JSON.stringify(state)}`);
  assert(state.panelRole === "tabpanel", `${label} content should expose tabpanel semantics: ${JSON.stringify(state)}`);
  assert(state.panelLabelledBy === state.selectedTabId, `${label} panel should be labelled by selected tab: ${JSON.stringify(state)}`);
}

async function readProofLedgerState(page) {
  return page.evaluate(() => ({
    selectedTabs: Array.from(document.querySelectorAll('[role="tab"][aria-selected="true"]')).map((element) => element.id),
    focusedTabId: document.activeElement?.getAttribute("role") === "tab" ? document.activeElement.id : "",
    tabIndexes: Object.fromEntries(
      Array.from(document.querySelectorAll('[role="tab"]')).map((element) => [element.id, element.getAttribute("tabindex") ?? ""]),
    ),
    panels: Array.from(document.querySelectorAll('[role="tabpanel"]')).map((element) => element.id),
    recordsSearchInputs: document.querySelectorAll('input[placeholder="Search records..."]').length,
  }));
}

async function expectText(page, text) {
  const locator = page.getByText(text, { exact: false });
  assert((await locator.count()) > 0, `missing visible text: ${text}`);
}

async function expectAppToastStatus(page, expectedText) {
  const toast = page.getByTestId("app-toast");
  assert((await toast.count()) === 1, `app toast should be visible for: ${expectedText}`);
  assert((await toast.getAttribute("role")) === "status", "app toast should announce as a status region");
  assert((await toast.getAttribute("aria-live")) === "polite", "app toast should announce politely");
  assert((await toast.getAttribute("aria-atomic")) === "true", "app toast should announce complete message updates");
  assert((await toast.getByText(expectedText, { exact: false }).count()) > 0, `app toast should include: ${expectedText}`);
}

async function expectPageHeading(page, text) {
  const heading = page.locator('[data-testid="app-content-scroll"] h1', { hasText: text });
  assert((await heading.count()) >= 1, `missing page heading: ${text}`);
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
