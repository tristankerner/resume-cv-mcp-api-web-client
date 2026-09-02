import { useEffect, useState } from "react";

import type { Session } from "@/lib/auth/session";
import { SESSION_LOW_WARNING_MS } from "@/lib/config";

export function SessionCountdown({ session }: { session: Session | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);
  if (!session) return null;
  const remainingMs = session.exp * 1000 - Date.now();
  if (remainingMs > SESSION_LOW_WARNING_MS) return null;
  const minutes = Math.max(0, Math.floor(remainingMs / 60_000));
  const seconds = Math.max(0, Math.floor((remainingMs % 60_000) / 1000));
  return (
    <span className="font-semibold text-destructive">
      Session expires in {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
