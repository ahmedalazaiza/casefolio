import type { Metadata } from "next";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import { RecoveryPortalClient } from "@/components/account/recovery-portal-client";
import { requireSession } from "@/lib/auth/session";
import { listRecoverySpacesForUser } from "@/lib/workspaces/service";

export const metadata: Metadata = {
  title: "Recovery Portal — Casefolio",
};

export default async function AccountRecoveryPage() {
  const { user } = await requireSession("/account/recovery");
  const recoverySpaces = await listRecoverySpacesForUser(user.id);

  return (
    <AccountSettingsShell activeTab="recovery">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground type-heading-m">Departed-team Recovery Portal</h2>
          <p className="text-muted-foreground type-body-s">
            Copy private case studies into your Personal Workspace or export portable JSON archives
            within 90 days of leaving a team workspace.
          </p>
        </div>

        <RecoveryPortalClient recoverySpaces={recoverySpaces} />
      </div>
    </AccountSettingsShell>
  );
}

