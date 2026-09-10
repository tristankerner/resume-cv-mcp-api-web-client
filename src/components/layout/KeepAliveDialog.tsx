import { useEffect, useState } from "react";

import { Banner } from "@/components/common/Banner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatRemaining } from "@/components/layout/SessionCountdown";
import type { Session } from "@/lib/auth/session";

// An AlertDialog, not a Dialog: this is an interruption that wants an
// answer. It traps focus and — since no onOpenChange is passed — does not
// close on outside click or Escape, so a stray click can't silently decline
// on the user's behalf.
export function KeepAliveDialog({
  open,
  session,
  busy,
  error,
  onConfirm,
  onSignOut,
}: {
  open: boolean;
  session: Session | null;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onSignOut: () => void;
}) {
  const [, tick] = useState(0);

  // Ticks once a second only while open, so the dialog's own countdown
  // stays live without the rest of the app paying for it while it is closed.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => tick((n) => n + 1), 1_000);
    return () => clearInterval(id);
  }, [open]);

  if (!session) return null;
  const remainingMs = session.exp * 1000 - Date.now();

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Still there?</AlertDialogTitle>
          <AlertDialogDescription>
            Your session expires in {formatRemaining(remainingMs)}. Doing nothing signs you out
            automatically when it reaches zero.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Banner kind="error">{error}</Banner>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} onClick={onSignOut}>
            Sign out
          </AlertDialogCancel>
          <AlertDialogAction
            autoFocus
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {busy ? "Staying signed in…" : "Keep me logged in"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
