"use client";

import type { ComponentProps, Dispatch, SetStateAction } from "react";
import type { Connection, Edge, Node } from "@xyflow/react";

import type { ActionInboxItem } from "@/lib/action-inbox";
import type { CommandOrderRecord } from "@/lib/command-orders";
import type {
  AuditLog,
  ContextSource,
  EvalResult,
  GovernanceReview,
  Run,
  Skill,
  ToolRequest,
  UseCase,
  User,
  WorkSignal,
} from "@/lib/enterprise-ai-data";
import type { AIProviderSettings } from "@/lib/model-router";
import type { PatternMarketplaceItem } from "@/lib/pattern-marketplace";
import type { ProviderReadiness } from "@/lib/provider-registry";
import type { ReportGenerationMeta } from "@/components/views/Reports";
import type {
  InstalledLaunchPackRecord,
  LaunchPackTemplateId,
  NormalizedRuntimeAssetRecord,
  ReportScheduleRecord,
  RuntimeAdapterManifestId,
  RuntimeAdapterRecord,
  RuntimeImportAuditRecord,
  RuntimeImportJobRecord,
} from "@/lib/runtime-control-plane";
import type {
  HarnessMode,
  IntakeForm,
  OrchestratorAction,
  OrchestratorMessage,
  ProductionReadiness,
  View,
} from "@/lib/ui/types";
import type { OrganizationSettings, WorkspaceMode } from "@/lib/workspace-schema";
import type { AuditIntegrityVerification } from "@/lib/audit-integrity";
import { EmptyState } from "@/components/ui";
import { PageHeader } from "./PageHeader";
import {
  Admin,
  AIEstate,
  AIOrchestrator,
  Broker,
  CommandCenter,
  CompanyBlueprint,
  ConnectorSetup,
  ContextFabric,
  Evaluations,
  EvidenceLedger,
  Governance,
  Harness,
  LaunchCenter,
  MetricsRoi,
  ProcessRedesignStudio,
  Reports,
  SkillSession,
  SkillsLibrary,
  StrategyRoadmap,
  TrainingAdoption,
  UseCaseFactory,
  WorkIntelligence,
  WorkflowBuilder,
} from "@/components/views";

type WorkflowBuilderProps = ComponentProps<typeof WorkflowBuilder>;
type CommandCenterProps = ComponentProps<typeof CommandCenter>;
type WorkIntelligenceProps = ComponentProps<typeof WorkIntelligence>;

type AppViewRouterProps = {
  activeView: View;
  organization: OrganizationSettings;
  metrics: CommandCenterProps["metrics"];
  monthlyBudgetUsd: CommandCenterProps["monthlyBudgetUsd"];
  functionData: CommandCenterProps["functionData"];
  statusData: CommandCenterProps["statusData"];
  useCases: UseCase[];
  skills: Skill[];
  governanceReviews: GovernanceReview[];
  evalResults: EvalResult[];
  runs: Run[];
  toolRequests: ToolRequest[];
  auditLogs: AuditLog[];
  users: User[];
  report: string;
  reportGenerationMeta: ReportGenerationMeta | null;
  workflowStatus: CommandCenterProps["workflowStatus"];
  enterpriseMaturity: CommandCenterProps["enterpriseMaturity"];
  integrationBlueprint: CommandCenterProps["integrationBlueprint"];
  compoundLearningLoop: CommandCenterProps["compoundLearningLoop"];
  transformationCommand: CommandCenterProps["transformationCommand"];
  commandOrders: CommandOrderRecord[];
  runtimeAdapters: RuntimeAdapterRecord[];
  runtimeImportJobs: RuntimeImportJobRecord[];
  normalizedRuntimeAssets: NormalizedRuntimeAssetRecord[];
  installedLaunchPacks: InstalledLaunchPackRecord[];
  reportSchedules: ReportScheduleRecord[];
  runtimeImportAudits: RuntimeImportAuditRecord[];
  orchestratorMessages: OrchestratorMessage[];
  orchestratorInput: string;
  orchestratorBusy: boolean;
  setOrchestratorInput: Dispatch<SetStateAction<string>>;
  workflowValidation: ComponentProps<typeof AIOrchestrator>["workflowValidation"];
  selectedUseCase: UseCase | null;
  selectedSkill: Skill | null;
  selectedRun: Run | null;
  productionReadiness: ProductionReadiness | null;
  providerVault: ProviderReadiness[];
  actionInboxItems: ActionInboxItem[];
  primetimeLaunchGate: ComponentProps<typeof Admin>["primetimeLaunchGate"];
  companyBlueprint: ComponentProps<typeof CompanyBlueprint>["blueprint"];
  workSignals: WorkSignal[];
  contextSources: ContextSource[];
  factoryTab: string;
  intakeStep: number;
  intake: IntakeForm;
  skillMode: "overview" | "detail";
  skillTab: string;
  harnessMode: HarnessMode;
  workflowMode: WorkflowBuilderProps["mode"];
  nodes: Node[];
  edges: Edge[];
  retrievalQuery: string;
  workspaceMode: WorkspaceMode;
  aiSettings: AIProviderSettings;
  providerVaultCheckedAt: string;
  testOutput: string;
  sessionFollowUp: string;
  sessionReplies: string[];
  setActiveView: Dispatch<SetStateAction<View>>;
  setFactoryTab: Dispatch<SetStateAction<string>>;
  setIntakeStep: Dispatch<SetStateAction<number>>;
  setIntake: Dispatch<SetStateAction<IntakeForm>>;
  setSelectedUseCaseId: Dispatch<SetStateAction<string>>;
  setSelectedSkillId: Dispatch<SetStateAction<string>>;
  setSelectedRunId: Dispatch<SetStateAction<string>>;
  setSkillMode: Dispatch<SetStateAction<"overview" | "detail">>;
  setSkillTab: Dispatch<SetStateAction<string>>;
  setHarnessMode: Dispatch<SetStateAction<HarnessMode>>;
  setWorkflowMode: WorkflowBuilderProps["setMode"];
  setNodes: WorkflowBuilderProps["setNodes"];
  setEdges: WorkflowBuilderProps["setEdges"];
  setRetrievalQuery: Dispatch<SetStateAction<string>>;
  setSessionFollowUp: Dispatch<SetStateAction<string>>;
  setImportOpen: Dispatch<SetStateAction<boolean>>;
  setOnboardingOpen: Dispatch<SetStateAction<boolean>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  openView: (view: View) => void;
  openCommandOrder: CommandCenterProps["onOpenCommandOrder"];
  completeCommandOrderRecord: CommandCenterProps["onCompleteCommandOrder"];
  generateExecBrief: (templateId?: string) => Promise<ReportGenerationMeta | null | void> | ReportGenerationMeta | null | void;
  clearOrchestratorChat: () => void;
  sendOrchestratorMessage: (override?: string) => void | Promise<void>;
  executeOrchestratorAction: (action: OrchestratorAction) => void | Promise<void>;
  submitUseCase: () => void;
  createUseCaseFromWorkOpportunity: WorkIntelligenceProps["onCreateOpportunityFromSignal"];
  convertUseCaseToSkill: (useCase: UseCase) => void;
  requestUseCaseGovernance: (useCase: UseCase) => void;
  updateSkillPrompt: (value: string) => void;
  updateSkill: (skillId: string, patch: Partial<Skill> | ((skill: Skill) => Skill)) => void;
  toggleSkillTool: (toolId: string) => void;
  runSkillTest: (skill?: Skill | null, destination?: "session" | "harness") => void | Promise<void>;
  runEvalSuite: (skill?: Skill | null) => void;
  submitGovernanceReview: (skill?: Skill | null) => void;
  installPattern: (pattern: PatternMarketplaceItem) => void;
  decideToolRequest: (request: ToolRequest, decision: "approved" | "rejected") => void;
  toggleSkillKillSwitch: (skill: Skill) => void;
  onNodesChange: WorkflowBuilderProps["onNodesChange"];
  onEdgesChange: WorkflowBuilderProps["onEdgesChange"];
  onConnect: (connection: Connection) => void;
  testWorkflow: () => void | Promise<void>;
  validateWorkflow: () => void;
  addWorkflowBlock: (blockIdOrLabel: string) => void;
  loadWorkflowTemplate: (template: "knowledge" | "approval") => void;
  clearWorkflow: WorkflowBuilderProps["onClearWorkflow"];
  publishWorkflow: () => void;
  decideGovernance: (review: GovernanceReview, status: GovernanceReview["status"]) => void;
  copyReport: () => Promise<string>;
  updateOrganization: (nextSettings: Partial<OrganizationSettings>) => void;
  upsertWorkspaceUser: (user: User) => void;
  removeWorkspaceUser: (userId: string) => void;
  exportWorkspace: () => void;
  loadDemoWorkspace: () => void;
  changeWorkspaceMode: (nextMode: WorkspaceMode) => void;
  sealLegacyAuditChain: () => Promise<void>;
  verifyAuditChain: () => Promise<void>;
  auditIntegrity: AuditIntegrityVerification | null;
  resetWorkspace: () => void;
  saveConnectorSecrets: (secrets: Record<string, string>) => Promise<void>;
  onTestRuntimeAdapter: (manifestId: RuntimeAdapterManifestId) => void;
  onCommitRuntimeImport: (manifestId: RuntimeAdapterManifestId) => void;
  onInstallLaunchPack: (templateId: LaunchPackTemplateId) => void;
  onCreateDefaultReportSchedules: () => void;
  onToggleReportSchedule: (scheduleId: string) => void;
  sendSessionFollowUp: () => void;
};

export function AppViewRouter({
  activeView,
  organization,
  metrics,
  monthlyBudgetUsd,
  functionData,
  statusData,
  useCases,
  skills,
  governanceReviews,
  evalResults,
  runs,
  toolRequests,
  auditLogs,
  users,
  report,
  reportGenerationMeta,
  workflowStatus,
  enterpriseMaturity,
  integrationBlueprint,
  compoundLearningLoop,
  transformationCommand,
  commandOrders,
  runtimeAdapters,
  runtimeImportJobs,
  normalizedRuntimeAssets,
  installedLaunchPacks,
  reportSchedules,
  runtimeImportAudits,
  orchestratorMessages,
  orchestratorInput,
  orchestratorBusy,
  setOrchestratorInput,
  workflowValidation,
  selectedUseCase,
  selectedSkill,
  selectedRun,
  productionReadiness,
  providerVault,
  actionInboxItems,
  primetimeLaunchGate,
  companyBlueprint,
  workSignals,
  contextSources,
  factoryTab,
  intakeStep,
  intake,
  skillMode,
  skillTab,
  harnessMode,
  workflowMode,
  nodes,
  edges,
  retrievalQuery,
  workspaceMode,
  aiSettings,
  providerVaultCheckedAt,
  testOutput,
  sessionFollowUp,
  sessionReplies,
  setActiveView,
  setFactoryTab,
  setIntakeStep,
  setIntake,
  setSelectedUseCaseId,
  setSelectedSkillId,
  setSelectedRunId,
  setSkillMode,
  setSkillTab,
  setHarnessMode,
  setWorkflowMode,
  setNodes,
  setEdges,
  setRetrievalQuery,
  setSessionFollowUp,
  setImportOpen,
  setOnboardingOpen,
  setSettingsOpen,
  openView,
  openCommandOrder,
  completeCommandOrderRecord,
  generateExecBrief,
  clearOrchestratorChat,
  sendOrchestratorMessage,
  executeOrchestratorAction,
  submitUseCase,
  createUseCaseFromWorkOpportunity,
  convertUseCaseToSkill,
  requestUseCaseGovernance,
  updateSkillPrompt,
  updateSkill,
  toggleSkillTool,
  runSkillTest,
  runEvalSuite,
  submitGovernanceReview,
  installPattern,
  decideToolRequest,
  toggleSkillKillSwitch,
  onNodesChange,
  onEdgesChange,
  onConnect,
  testWorkflow,
  validateWorkflow,
  addWorkflowBlock,
  loadWorkflowTemplate,
  clearWorkflow,
  publishWorkflow,
  decideGovernance,
  copyReport,
  updateOrganization,
  upsertWorkspaceUser,
  removeWorkspaceUser,
  exportWorkspace,
  loadDemoWorkspace,
  changeWorkspaceMode,
  sealLegacyAuditChain,
  verifyAuditChain,
  auditIntegrity,
  resetWorkspace,
  saveConnectorSecrets,
  onTestRuntimeAdapter,
  onCommitRuntimeImport,
  onInstallLaunchPack,
  onCreateDefaultReportSchedules,
  onToggleReportSchedule,
  sendSessionFollowUp,
}: AppViewRouterProps) {
  return (
    <>
      {activeView === "command" ? (
        <CommandCenter
          organization={organization}
          metrics={metrics}
          monthlyBudgetUsd={monthlyBudgetUsd}
          functionData={functionData}
          statusData={statusData}
          useCases={useCases}
          skills={skills}
          governanceReviews={governanceReviews}
          evalResults={evalResults}
          runs={runs}
          toolRequests={toolRequests}
          auditLogs={auditLogs}
          workSignals={workSignals}
          contextSources={contextSources}
          productionReadiness={productionReadiness}
          selectedUseCase={selectedUseCase}
          selectedSkill={selectedSkill}
          report={report}
          workflowStatus={workflowStatus}
          workflowNodeCount={nodes.length}
          enterpriseMaturity={enterpriseMaturity}
          integrationBlueprint={integrationBlueprint}
          compoundLearningLoop={compoundLearningLoop}
          transformationCommand={transformationCommand}
          commandOrders={commandOrders}
          onOpenCommandOrder={openCommandOrder}
          onCompleteCommandOrder={completeCommandOrderRecord}
          onOpenCommand={() => openView("command")}
          onOpenSetup={() => setOnboardingOpen(true)}
          onOpenEstate={() => openView("estate")}
          onOpenOrchestrator={() => openView("orchestrator")}
          onOpenBlueprint={() => openView("blueprint")}
          onOpenStrategy={() => openView("strategy")}
          onOpenProcess={() => openView("process")}
          onOpenWork={() => openView("work")}
          onOpenSkills={() => openView("skills")}
          onOpenWorkflow={() => openView("workflow")}
          onOpenHarness={() => openView("harness")}
          onOpenConnectors={() => openView("connectors")}
          onOpenBroker={() => openView("broker")}
          onOpenContext={() => openView("context")}
          onOpenGovernance={() => openView("governance")}
          onOpenLaunch={() => openView("launch")}
          onOpenEvidence={() => openView("evidence")}
          onOpenEvals={() => openView("evals")}
          onOpenMetrics={() => openView("roi")}
          onOpenTraining={() => openView("training")}
          onOpenReports={() => openView("reports")}
          onOpenAdmin={() => openView("admin")}
          onOpenUseCase={(id) => {
            setSelectedUseCaseId(id);
            setFactoryTab("detail");
            setActiveView("factory");
          }}
          onViewBacklog={() => {
            setFactoryTab("backlog");
            setActiveView("factory");
          }}
          onNewUseCase={() => {
            setFactoryTab("intake");
            setActiveView("factory");
          }}
          onGenerateBrief={generateExecBrief}
          workspaceMode={workspaceMode}
          onLoadDemo={loadDemoWorkspace}
          onWorkspaceModeChange={changeWorkspaceMode}
        />
      ) : null}

      {activeView === "orchestrator" ? (
        <AIOrchestrator
          messages={orchestratorMessages}
          input={orchestratorInput}
          isBusy={orchestratorBusy}
          setInput={setOrchestratorInput}
          onSend={sendOrchestratorMessage}
          onAction={executeOrchestratorAction}
          onClear={clearOrchestratorChat}
          metrics={metrics}
          useCases={useCases}
          skills={skills}
          runs={runs}
          toolRequests={toolRequests}
          auditLogs={auditLogs}
          governanceReviews={governanceReviews}
          evalResults={evalResults}
          workSignals={workSignals}
          workflowStatus={workflowStatus}
          workflowValidation={workflowValidation}
          selectedUseCase={selectedUseCase}
          selectedSkill={selectedSkill}
          productionReadiness={productionReadiness}
          providerVault={providerVault}
          actionInboxItems={actionInboxItems}
          primetimeLaunchGate={primetimeLaunchGate}
          transformationCommand={transformationCommand}
          commandOrders={commandOrders}
        />
      ) : null}

      {activeView === "estate" ? (
        <AIEstate
          useCases={useCases}
          skills={skills}
          runs={runs}
          evalResults={evalResults}
          governanceReviews={governanceReviews}
          toolRequests={toolRequests}
          auditLogs={auditLogs}
          workSignals={workSignals}
          contextSources={contextSources}
          users={users}
          report={report}
          providerVault={providerVault}
          productionReadiness={productionReadiness}
          integrationBlueprint={integrationBlueprint}
          runtimeAdapters={runtimeAdapters}
          runtimeImportJobs={runtimeImportJobs}
          normalizedRuntimeAssets={normalizedRuntimeAssets}
          installedLaunchPacks={installedLaunchPacks}
          reportSchedules={reportSchedules}
          runtimeImportAudits={runtimeImportAudits}
          onOpenView={openView}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : null}

      {activeView === "blueprint" ? (
        <CompanyBlueprint
          blueprint={companyBlueprint}
          onOpenView={openView}
          onOpenSetup={() => setOnboardingOpen(true)}
          onNewUseCase={() => {
            setFactoryTab("intake");
            setActiveView("factory");
          }}
        />
      ) : null}

      {activeView === "strategy" ? (
        <StrategyRoadmap
          metrics={metrics}
          useCases={useCases}
          skills={skills}
          governanceReviews={governanceReviews}
          evalResults={evalResults}
          runs={runs}
          workSignals={workSignals}
          contextSources={contextSources}
          onNewUseCase={() => {
            setFactoryTab("intake");
            setActiveView("factory");
          }}
          onOpenFactory={() => {
            setFactoryTab("backlog");
            setActiveView("factory");
          }}
          onOpenGovernance={() => setActiveView("governance")}
          onOpenSkills={() => {
            setSkillMode("overview");
            setActiveView("skills");
          }}
          onOpenEvals={() => setActiveView("evals")}
          onOpenRoi={() => setActiveView("roi")}
          onOpenReports={() => setActiveView("reports")}
          onOpenView={openView}
        />
      ) : null}

      {activeView === "process" ? (
        <ProcessRedesignStudio
          useCases={useCases}
          selectedUseCase={selectedUseCase}
          skills={skills}
          workSignals={workSignals}
          setSelectedUseCaseId={setSelectedUseCaseId}
          onOpenFactory={() => {
            setFactoryTab(useCases.length ? "detail" : "intake");
            setActiveView("factory");
          }}
          onOpenWorkflow={() => openView("workflow")}
          onOpenSkills={() => {
            setSkillMode("overview");
            setActiveView("skills");
          }}
          onOpenTraining={() => openView("training")}
          onOpenOrchestrator={() => openView("orchestrator")}
        />
      ) : null}

      {activeView === "work" ? (
        <WorkIntelligence
          workSignals={workSignals}
          useCases={useCases}
          skills={skills}
          runs={runs}
          contextSources={contextSources}
          onOpenFactory={() => {
            setFactoryTab("backlog");
            setActiveView("factory");
          }}
          onOpenProcess={() => setActiveView("process")}
          onOpenContext={() => setActiveView("context")}
          onOpenTraining={() => setActiveView("training")}
          onOpenGovernance={() => setActiveView("governance")}
          onCreateOpportunityFromSignal={createUseCaseFromWorkOpportunity}
        />
      ) : null}

      {activeView === "factory" ? (
        <UseCaseFactory
          tab={factoryTab}
          setTab={setFactoryTab}
          intakeStep={intakeStep}
          setIntakeStep={setIntakeStep}
          intake={intake}
          setIntake={setIntake}
          onSubmit={submitUseCase}
          useCases={useCases}
          selectedUseCase={selectedUseCase}
          setSelectedUseCaseId={setSelectedUseCaseId}
          onConvert={convertUseCaseToSkill}
          onImport={() => setImportOpen(true)}
          onGovernance={requestUseCaseGovernance}
        />
      ) : null}

      {activeView === "skills" ? (
        <SkillsLibrary
          skills={skills}
          runs={runs}
          selectedSkill={selectedSkill}
          setSelectedSkillId={setSelectedSkillId}
          mode={skillMode}
          setMode={setSkillMode}
          skillTab={skillTab}
          setSkillTab={setSkillTab}
          onPromptChange={updateSkillPrompt}
          onSkillUpdate={updateSkill}
          onToggleTool={toggleSkillTool}
          onRunTest={runSkillTest}
          onRunEval={runEvalSuite}
          onSubmitGovernance={submitGovernanceReview}
          onCreateFromUseCase={() => {
            setFactoryTab(useCases.length ? "backlog" : "intake");
            setActiveView("factory");
          }}
          useCases={useCases}
          evalResults={evalResults}
          governanceReviews={governanceReviews}
          onInstallPattern={installPattern}
        />
      ) : null}

      {activeView === "harness" ? (
        <Harness
          runs={runs}
          selectedRun={selectedRun}
          mode={harnessMode}
          setMode={setHarnessMode}
          setSelectedRunId={setSelectedRunId}
          skills={skills}
          toolRequests={toolRequests}
          auditLogs={auditLogs}
          users={users}
          onDecision={decideToolRequest}
          onRerun={(skill) => runSkillTest(skill ?? selectedSkill, "harness")}
          onOpenSkills={() => openView("skills")}
          onOpenSkill={(skill) => {
            setSelectedSkillId(skill.id);
            setSkillMode("detail");
            setSkillTab("overview");
            openView("skills");
          }}
          onOpenBroker={() => setActiveView("broker")}
          onToggleSkillKillSwitch={toggleSkillKillSwitch}
        />
      ) : null}

      {activeView === "workflow" ? (
        <WorkflowBuilder
          mode={workflowMode}
          setMode={setWorkflowMode}
          skills={skills}
          nodes={nodes}
          edges={edges}
          setNodes={setNodes}
          setEdges={setEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          status={workflowStatus}
          onTest={testWorkflow}
          onValidate={validateWorkflow}
          onAddBlock={addWorkflowBlock}
          onLoadTemplate={loadWorkflowTemplate}
          onClearWorkflow={clearWorkflow}
          onOpenSkills={() => openView("skills")}
          onManageTools={() => setActiveView("broker")}
          onPublish={publishWorkflow}
          output={testOutput}
        />
      ) : null}

      {activeView === "connectors" ? (
        <ConnectorSetup
          productionReadiness={productionReadiness}
          integrationBlueprint={integrationBlueprint}
          providerVault={providerVault}
          runtimeAdapters={runtimeAdapters}
          runtimeImportJobs={runtimeImportJobs}
          normalizedRuntimeAssets={normalizedRuntimeAssets}
          runtimeImportAudits={runtimeImportAudits}
          onTestRuntimeAdapter={onTestRuntimeAdapter}
          onCommitRuntimeImport={onCommitRuntimeImport}
          onSaveConnectorSecrets={saveConnectorSecrets}
          onOpenView={openView}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : null}

      {activeView === "broker" ? (
        <Broker
          toolRequests={toolRequests}
          auditLogs={auditLogs}
          onDecision={decideToolRequest}
          onOpenConnectors={() => setActiveView("connectors")}
          integrationBlueprint={integrationBlueprint}
          productionReadiness={productionReadiness}
        />
      ) : null}

      {activeView === "context" ? (
        <ContextFabric
          query={retrievalQuery}
          setQuery={setRetrievalQuery}
          selectedSkill={selectedSkill}
          skills={skills}
          sources={contextSources}
          onSelectSkill={setSelectedSkillId}
          onOpenAdmin={() => setActiveView("admin")}
          onOpenSkills={() => {
            setSkillMode("detail");
            setSkillTab("context");
            setActiveView("skills");
          }}
        />
      ) : null}

      {activeView === "evals" ? (
        <Evaluations
          skills={skills}
          selectedSkill={selectedSkill}
          evalResults={evalResults}
          runs={runs}
          workSignals={workSignals}
          onRunEval={runEvalSuite}
          onOpenSkills={() => {
            setSkillMode("overview");
            setActiveView("skills");
          }}
        />
      ) : null}

      {activeView === "governance" ? (
        <Governance
          reviews={governanceReviews}
          onDecision={decideGovernance}
          onOpenSkills={() => openView("skills")}
          onOpenView={openView}
        />
      ) : null}

      {activeView === "launch" ? (
        <LaunchCenter
          productionReadiness={productionReadiness}
          primetimeLaunchGate={primetimeLaunchGate}
          providerVault={providerVault}
          workspaceMode={workspaceMode}
          installedLaunchPacks={installedLaunchPacks}
          reportSchedules={reportSchedules}
          onInstallLaunchPack={onInstallLaunchPack}
          onOpenView={openView}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenSetup={() => setOnboardingOpen(true)}
        />
      ) : null}

      {activeView === "evidence" ? (
        <EvidenceLedger
          auditLogs={auditLogs}
          evalResults={evalResults}
          governanceReviews={governanceReviews}
          runs={runs}
          skills={skills}
          toolRequests={toolRequests}
          useCases={useCases}
          workSignals={workSignals}
          selectedUseCase={selectedUseCase}
          selectedSkill={selectedSkill}
          auditIntegrity={auditIntegrity}
          onVerifyAuditChain={verifyAuditChain}
          onOpenView={openView}
          onOpenRun={(runId) => {
            setSelectedRunId(runId);
            setHarnessMode("detail");
            setActiveView("harness");
          }}
          onOpenUseCase={(useCaseId) => {
            setSelectedUseCaseId(useCaseId);
            setFactoryTab("detail");
            setActiveView("factory");
          }}
          onOpenSkill={(skillId) => {
            setSelectedSkillId(skillId);
            setSkillMode("detail");
            setActiveView("skills");
          }}
        />
      ) : null}

      {activeView === "roi" ? (
        <MetricsRoi
          useCases={useCases}
          skills={skills}
          workspaceMode={workspaceMode}
          onOpenFactory={() => {
            setFactoryTab("intake");
            setActiveView("factory");
          }}
          onOpenSkills={() => {
            setSkillMode("overview");
            setActiveView("skills");
          }}
          onOpenTests={() => {
            setHarnessMode("overview");
            setActiveView("harness");
          }}
          onOpenEvidence={() => setActiveView("evidence")}
          onOpenGovernance={() => setActiveView("governance")}
          onOpenLaunch={() => setActiveView("launch")}
          onOpenReports={() => setActiveView("reports")}
        />
      ) : null}

      {activeView === "training" ? (
        <TrainingAdoption
          skills={skills}
          useCases={useCases}
          workSignals={workSignals}
          onOpenSkills={() => openView("skills")}
          onOpenWork={() => openView("work")}
          onOpenFactory={() => {
            setFactoryTab("intake");
            setActiveView("factory");
          }}
          onOpenReports={() => openView("reports")}
          onOpenView={openView}
        />
      ) : null}

      {activeView === "reports" ? (
        <Reports
          report={report}
          generationMeta={reportGenerationMeta}
          useCases={useCases}
          skills={skills}
          governanceReviews={governanceReviews}
          workSignals={workSignals}
          runs={runs}
          evalResults={evalResults}
          reportSchedules={reportSchedules}
          onCreateDefaultReportSchedules={onCreateDefaultReportSchedules}
          onToggleReportSchedule={onToggleReportSchedule}
          onGenerate={generateExecBrief}
          onCopy={copyReport}
        />
      ) : null}

      {activeView === "admin" ? (
        <Admin
          organization={organization}
          workspaceMode={workspaceMode}
          aiSettings={aiSettings}
          providerVault={providerVault}
          providerVaultCheckedAt={providerVaultCheckedAt}
          users={users}
          productionReadiness={productionReadiness}
          enterpriseMaturity={enterpriseMaturity}
          primetimeLaunchGate={primetimeLaunchGate}
          onSaveOrganization={updateOrganization}
          onUpsertUser={upsertWorkspaceUser}
          onRemoveUser={removeWorkspaceUser}
          onOpenOnboarding={() => setOnboardingOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onExport={exportWorkspace}
          onImport={() => setImportOpen(true)}
          onLoadDemo={loadDemoWorkspace}
          onWorkspaceModeChange={changeWorkspaceMode}
          onSealLegacyAuditChain={sealLegacyAuditChain}
          onReset={resetWorkspace}
        />
      ) : null}

      {activeView === "session" ? (
        selectedSkill && selectedRun ? (
          <SkillSession
            skill={selectedSkill}
            run={selectedRun}
            toolRequests={toolRequests}
            auditLogs={auditLogs}
            followUp={sessionFollowUp}
            setFollowUp={setSessionFollowUp}
            replies={sessionReplies}
            onSendFollowUp={sendSessionFollowUp}
            onNewConversation={() => runSkillTest(selectedSkill)}
            onViewTrace={() => {
              setHarnessMode("detail");
              setActiveView("harness");
            }}
            onOpenSettings={() => setSettingsOpen(true)}
            onViewBroker={() => setActiveView("broker")}
          />
        ) : (
          <div>
            <PageHeader
              title="Skill Session"
              subtitle="Run a governed Skill, inspect the live answer, and keep trace, broker, and source policy evidence close."
            />
            <EmptyState
              title="No active Skill session"
              body="Create or import a Skill, run it through the Harness, and the governed session view will appear here."
              action="Open AI Skills"
              onAction={() => openView("skills")}
            />
          </div>
        )
      ) : null}
    </>
  );
}
