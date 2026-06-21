"use client";

import { Check } from "lucide-react";

import type { ActionInboxItem } from "@/lib/action-inbox";
import type { AIProviderSettings } from "@/lib/model-router";
import type { ProviderReadiness } from "@/lib/provider-registry";
import type { CommandItem, OnboardingDraft, ProductionReadiness, View } from "@/lib/ui/types";
import type { OrganizationSettings } from "@/lib/workspace-schema";
import type { LaunchHandoff, LaunchHandoffStep } from "@/lib/launch-handoff";
import {
  ActionInboxModal,
  AISettingsModal,
  CommandMenu,
  ConfirmActionModal,
  HelpWalkthroughModal,
  ImportWorkspaceModal,
  LaunchHandoffModal,
  OnboardingWizard,
  type ConfirmActionRequest,
} from "@/components/modals";

type AppOverlaysProps = {
  toast: string | null;
  notificationsOpen: boolean;
  actionInboxItems: ActionInboxItem[];
  actionInboxOpenCount: number;
  commandOpen: boolean;
  commandQuery: string;
  commandItems: CommandItem[];
  activeView: View;
  settingsOpen: boolean;
  aiSettings: AIProviderSettings;
  providerVault: ProviderReadiness[];
  productionReadiness: ProductionReadiness | null;
  helpOpen: boolean;
  launchHandoffOpen: boolean;
  launchHandoff: LaunchHandoff;
  importOpen: boolean;
  onboardingOpen: boolean;
  organization: OrganizationSettings;
  confirmationAction: ConfirmActionRequest | null;
  setCommandQuery: (query: string) => void;
  onCloseNotifications: () => void;
  onOpenInboxItem: (item: ActionInboxItem) => void;
  onCloseCommand: () => void;
  onCloseSettings: () => void;
  onSaveAISettings: (settings: AIProviderSettings) => Promise<void>;
  onSaveConnectorSecrets: (secrets: Record<string, string>) => Promise<void>;
  onDeleteTenantSecrets: (names: string[]) => Promise<void>;
  onOpenConnectors: () => void;
  onCloseHelp: () => void;
  onOpenHelpSetup: () => void;
  onOpenHelpView: (view: View) => void;
  onCloseLaunchHandoff: () => void;
  onOpenLaunchHandoffStep: (step: LaunchHandoffStep) => void | Promise<void>;
  onOpenLaunchOrchestrator: () => void;
  onCloseImport: () => void;
  onImportWorkspace: (contents: string) => void | Promise<void>;
  onCloseOnboarding: () => void;
  onCompleteOnboarding: (draft: OnboardingDraft) => void;
  onCloseConfirmation: () => void;
};

export function AppOverlays({
  toast,
  notificationsOpen,
  actionInboxItems,
  actionInboxOpenCount,
  commandOpen,
  commandQuery,
  commandItems,
  activeView,
  settingsOpen,
  aiSettings,
  providerVault,
  productionReadiness,
  helpOpen,
  launchHandoffOpen,
  launchHandoff,
  importOpen,
  onboardingOpen,
  organization,
  confirmationAction,
  setCommandQuery,
  onCloseNotifications,
  onOpenInboxItem,
  onCloseCommand,
  onCloseSettings,
  onSaveAISettings,
  onSaveConnectorSecrets,
  onDeleteTenantSecrets,
  onOpenConnectors,
  onCloseHelp,
  onOpenHelpSetup,
  onOpenHelpView,
  onCloseLaunchHandoff,
  onOpenLaunchHandoffStep,
  onOpenLaunchOrchestrator,
  onCloseImport,
  onImportWorkspace,
  onCloseOnboarding,
  onCompleteOnboarding,
  onCloseConfirmation,
}: AppOverlaysProps) {
  return (
    <>
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="app-toast"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text)] shadow-[0_16px_50px_rgba(15,23,42,0.16)]"
        >
          <Check size={16} aria-hidden="true" className="text-green-600" />
          <span>{toast}</span>
        </div>
      ) : null}

      {notificationsOpen ? (
        <ActionInboxModal
          items={actionInboxItems}
          openCount={actionInboxOpenCount}
          onClose={onCloseNotifications}
          onOpenItem={onOpenInboxItem}
        />
      ) : null}

      {commandOpen ? (
        <CommandMenu
          query={commandQuery}
          setQuery={setCommandQuery}
          items={commandItems}
          onClose={onCloseCommand}
        />
      ) : null}

      {settingsOpen ? (
        <AISettingsModal
          settings={aiSettings}
          providerVault={providerVault}
          productionReadiness={productionReadiness}
          onClose={onCloseSettings}
          onSave={onSaveAISettings}
          onSaveConnectorSecrets={onSaveConnectorSecrets}
          onDeleteTenantSecrets={onDeleteTenantSecrets}
          onOpenConnectors={onOpenConnectors}
        />
      ) : null}

      {helpOpen ? (
        <HelpWalkthroughModal
          activeView={activeView}
          onClose={onCloseHelp}
          onOpenSetup={onOpenHelpSetup}
          onOpenView={onOpenHelpView}
        />
      ) : null}

      {launchHandoffOpen ? (
        <LaunchHandoffModal
          handoff={launchHandoff}
          onClose={onCloseLaunchHandoff}
          onOpenStep={onOpenLaunchHandoffStep}
          onOpenOrchestrator={onOpenLaunchOrchestrator}
        />
      ) : null}

      {importOpen ? (
        <ImportWorkspaceModal
          onClose={onCloseImport}
          onImport={onImportWorkspace}
        />
      ) : null}

      {onboardingOpen ? (
        <OnboardingWizard
          organization={organization}
          onClose={onCloseOnboarding}
          onComplete={onCompleteOnboarding}
        />
      ) : null}

      {confirmationAction ? (
        <ConfirmActionModal
          action={confirmationAction}
          onClose={onCloseConfirmation}
        />
      ) : null}
    </>
  );
}
