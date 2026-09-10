import { useEffect, useState, type ReactNode } from "react";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { KeepAliveDialog } from "@/components/layout/KeepAliveDialog";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { EventComposer } from "@/features/tracking/EventComposer";
import { useSessionKeepAlive } from "@/hooks/useSessionKeepAlive";
import { SIDEBAR_STATE_STORAGE_KEY } from "@/lib/config";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";

// SidebarProvider defaults to a `document.cookie` for open/closed state,
// which is unreliable on file:// (see UI_REDESIGN_PLAN.md §6.3) — driven as
// a controlled component backed by localStorage instead, same pattern the
// session cache already uses.
function loadSidebarOpen(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_STATE_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(loadSidebarOpen);
  const { composer, session } = useStore();
  const keepAlive = useSessionKeepAlive();

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STATE_STORAGE_KEY, String(open));
    } catch {
      // localStorage can throw in a locked-down file:// context; the
      // sidebar just falls back to its in-memory default next load.
    }
  }, [open]);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader onExpandSession={keepAlive.requestOpen} />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
      {/* Mounted once here rather than per-page, so the header button and
          command palette don't need to live in the same subtree as the
          pages that also open it — see store.openEventComposer. */}
      <EventComposer
        open={composer !== null}
        onOpenChange={(next) => !next && store.closeEventComposer()}
        applicationId={composer?.applicationId}
        companyId={composer?.companyId}
        contactId={composer?.contactId}
        onCreated={(result) => composer?.onCreated?.(result)}
      />
      {/* Mounted once here for the same reason as EventComposer above —
          useSessionKeepAlive owns the timer regardless of which page (or
          none) is showing when it fires. */}
      <KeepAliveDialog
        open={keepAlive.open}
        session={session}
        busy={keepAlive.busy}
        error={keepAlive.error}
        onConfirm={keepAlive.confirm}
        onSignOut={keepAlive.signOut}
      />
    </SidebarProvider>
  );
}
