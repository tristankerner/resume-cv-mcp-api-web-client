import { type FormEvent, useMemo, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as adminApi from "@/lib/api/admin";
import type { AdminUser } from "@/lib/api/admin";
import { ApiError, errorMessage } from "@/lib/api/client";
import { passwordComplexityChecks } from "@/lib/passwords";

export function ResetPasswordDialog({
  user,
  onClose,
  onReset,
}: {
  user: AdminUser;
  onClose: () => void;
  onReset: () => void;
}) {
  const [password, setPassword] = useState("");
  const [retype, setRetype] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checks = useMemo(() => passwordComplexityChecks(password), [password]);
  const allMet = checks.every((c) => c.met);
  const retypeMatches = retype.length > 0 && password === retype;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!allMet) {
      setError("The password does not meet the requirements below.");
      return;
    }
    if (!retypeMatches) {
      setError("Passwords must match.");
      return;
    }
    setBusy(true);
    try {
      await adminApi.resetPassword(user.id, {
        new_password: password,
        new_password_retype: retype,
      });
      onReset();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Reset password for &ldquo;{user.username}&rdquo;</DialogTitle>
            <DialogDescription>
              Sets a new password immediately, bypassing the current one. The account is not
              notified.
            </DialogDescription>
          </DialogHeader>
          <Banner kind="error">{error}</Banner>
          <div className="space-y-1.5">
            <Label htmlFor="reset-password-new">New password</Label>
            <Input
              id="reset-password-new"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete="new-password"
              required
            />
            <ul className="space-y-0.5 pl-4 text-sm">
              {checks.map((c) => (
                <li key={c.label} className={c.met ? "text-success" : "text-muted-foreground"}>
                  {c.met ? "✓" : "—"} {c.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-password-retype">Retype new password</Label>
            <Input
              id="reset-password-retype"
              type="password"
              value={retype}
              onChange={(e) => setRetype(e.currentTarget.value)}
              autoComplete="new-password"
              required
            />
            {retype.length > 0 && !retypeMatches && (
              <p className="text-sm text-destructive">Passwords do not match.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? "Resetting…" : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
