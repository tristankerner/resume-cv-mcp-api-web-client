import { useEffect, useState } from "react";

import type { Session } from "@/lib/auth/session";
import { SESSION_LOW_WARNING_MS } from "@/lib/config";

export function formatRemaining(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const seconds = Math.max(0, Math.floor((ms % 60_000) / 1000));
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function SessionCountdown({
  session,
  onExpand,
}: {
  session: Session | null;
  onExpand?: () => void;
}) {
  const [, tick] = useState(0);
  const remainingMs = session ? session.exp * 1000 - Date.now() : null;
  const visible = remainingMs !== null && remainingMs <= SESSION_LOW_WARNING_MS;

  // Only ticks while the countdown is actually shown — no reason to wake up
  // every 15s for the entire length of an ordinary session.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, [visible]);

  // A single scheduled wake-up for the moment the countdown *becomes*
  // visible, since nothing above is polling to notice that on its own.
  useEffect(() => {
    if (visible || remainingMs === null) return;
    const id = setTimeout(() => tick((n) => n + 1), remainingMs - SESSION_LOW_WARNING_MS);
    return () => clearTimeout(id);
  }, [visible, remainingMs]);

  if (remainingMs === null || !visible) return null;
  return (
    <button
      type="button"
      onClick={onExpand}
      className="font-semibold text-destructive hover:underline"
    >
      Session expires in {formatRemaining(remainingMs)}
    </button>
  );
}
