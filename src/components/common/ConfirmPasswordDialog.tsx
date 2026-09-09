import { type FormEvent, type ReactNode, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, errorMessage } from "@/lib/api/client";
import { useStore } from "@/store/useStore";

// Carries the current-password check that MFA enrolment, regeneration and
// removal all require server-side — one dialog rather than three
// near-identical password fields. `extra` is an optional slot for a field a
// particular use needs alongside the password (only enrolment: the label).
export function ConfirmPasswordDialog({
  title,
  description,
  confirmLabel = "Confirm",
  danger,
  extra,
  onCancel,
  onConfirm,
}: {
  title: string;
  description?: string | null;
  confirmLabel?: string;
  danger?: boolean;
  extra?: ReactNode;
  onCancel: () => void;
  onConfirm: (password: string) => Promise<void>;
}) {
  const { user } = useStore();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConfirm(password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <Banner kind="error">{error}</Banner>
          {extra}
          {/* Off-screen rather than absent: this is what lets a password
              manager associate the confirmation below with this account. */}
          <input
            type="text"
            className="visually-hidden"
            name="username"
            value={user?.username || ""}
            autoComplete="username"
            readOnly
            tabIndex={-1}
          />
          <Field>
            <FieldLabel htmlFor="confirm-current-password">Current password</FieldLabel>
            <Input
              id="confirm-current-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete="current-password"
              required
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant={danger ? "destructive" : "default"} disabled={busy}>
              {busy ? "Working…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
