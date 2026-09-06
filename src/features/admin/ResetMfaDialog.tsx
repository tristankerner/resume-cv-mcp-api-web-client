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

export function ResetMfaDialog({
  user,
  onClose,
  onReset,
}: {
  user: AdminUser;
  onClose: () => void;
  onReset: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.resetMfa(user.id);
      onReset();
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
          <AlertDialogTitle>Reset MFA for &ldquo;{user.username}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes every second factor on the account, including backup codes. The next
            login will not ask for one until the user enrols again.
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
            {busy ? "Resetting…" : "Reset MFA"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
