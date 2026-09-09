import { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { Banner } from "@/components/common/Banner";
import { Toaster } from "@/components/ui/sonner";
import { CurrentView } from "@/features/CurrentView";
import { LoginView } from "@/features/auth/LoginView";
import * as authApi from "@/lib/api/auth";
import { schemas } from "@/lib/api/documents";
import { loadSession } from "@/lib/auth/session";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";

async function boot() {
  const cached = loadSession();
  if (!cached) {
    store.set({ booting: false });
    return;
  }
  store.set({ session: cached });
  try {
    const [user, docSchemas] = await Promise.all([authApi.me(), schemas()]);
    store.set({ user, schemas: docSchemas, booting: false, view: "documents" });
  } catch {
    // A 401 already cleared the session inside request(); anything else
    // (network) just falls through to the login screen with the cached
    // apiBase pre-filled, which is the best available next step.
    store.set({ booting: false });
  }
}

export function App() {
  const { booting, session, user } = useStore();
  // Dismissible for the session only, deliberately not persisted — a nag
  // that can be silenced forever is not a warning.
  const [warningDismissed, setWarningDismissed] = useState(false);

  useEffect(() => {
    boot();
  }, []);

  if (booting) {
    return <div className="flex min-h-screen flex-1 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <>
      <AppShell>
        {user && !user.mfa_enrolled && !warningDismissed && (
          <Banner kind="warn" onDismiss={() => setWarningDismissed(true)}>
            Your account has no second factor.{" "}
            <a
              href="#"
              className="underline underline-offset-4"
              onClick={(e) => {
                e.preventDefault();
                store.navigate("security");
              }}
            >
              Set one up
            </a>
            .
          </Banner>
        )}
        <CurrentView />
      </AppShell>
      {!session && <LoginView />}
      <Toaster />
    </>
  );
}
