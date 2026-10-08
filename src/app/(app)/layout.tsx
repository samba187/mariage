"use client";

import { HouseholdProvider, useHousehold } from "@/hooks/use-household";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { usePushSync } from "@/hooks/use-push-notifications";
import { Nav } from "@/components/layout/nav";
import { Loader2, WifiOff } from "lucide-react";

function AppShell({ children }: { children: React.ReactNode }) {
  const { loading, household } = useHousehold();
  const online = useOnlineStatus();
  usePushSync(household?.id);

  if (loading || !household) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <p className="text-sm">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh">
      <Nav />
      <div className="flex flex-1 flex-col overflow-x-hidden pb-20 md:pb-0">
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-800">
            <WifiOff className="size-3.5" />
            Hors ligne — vos modifications seront synchronisées au retour du réseau.
          </div>
        )}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <HouseholdProvider>
      <AppShell>{children}</AppShell>
    </HouseholdProvider>
  );
}
