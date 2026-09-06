import { useState } from "react";

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
import * as adminApi from "@/lib/api/admin";
import type { AdminUser } from "@/lib/api/admin";
import { ApiError, errorMessage } from "@/lib/api/client";

export function UnlockDialog({
  user,
  onClose,
  onUnlocked,
}: {
  user: AdminUser;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.unlockUser(user.id);
      onUnlocked();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unlock &ldquo;{user.username}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Clears the login lockout from failed password attempts. Does not touch MFA or the
            password itself.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Banner kind="error">{error}</Banner>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            {busy ? "Unlocking…" : "Unlock"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
