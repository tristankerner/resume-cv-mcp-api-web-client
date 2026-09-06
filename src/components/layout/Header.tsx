import { Nav } from "@/components/layout/Nav";
import { SessionCountdown } from "@/components/layout/SessionCountdown";
import { Button } from "@/components/ui/button";
import { clearSession } from "@/lib/auth/session";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";

export function Header() {
  const { session, user } = useStore();
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b bg-card px-5 py-3">
      <span className="font-bold">resume-api</span>
      {user && <Nav />}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {session && <SessionCountdown session={session} />}
        {user && <span>{user.username}</span>}
        {session && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              clearSession();
              store.set({ session: null, user: null });
            }}
          >
            Log out
          </Button>
        )}
      </div>
    </header>
  );
}
