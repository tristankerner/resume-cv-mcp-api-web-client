import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clipboardMode, copyText } from "@/lib/clipboard";

// Shown once after registering an OAuth client — same one-time-secret
// pattern as ApiKeyRevealModal, extended with the client_id row (not
// sensitive, but the client only gets one screen with both on it). A public
// client has no secret, so the gate and the secret row simply don't apply.
export function ClientSecretModal({
  clientId,
  clientSecret,
  onClose,
}: {
  clientId: string;
  clientSecret: string | null;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(clientSecret === null);
  const [mode] = useState(() => clipboardMode());
  const [copiedField, setCopiedField] = useState<"id" | "secret" | null>(null);

  async function doCopy(field: "id" | "secret", value: string) {
    const ok = await copyText(value);
    if (ok) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && saved && onClose()}>
      <DialogContent showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Client registered</DialogTitle>
          <DialogDescription>
            {clientSecret
              ? "This is the only time the secret is shown. It cannot be retrieved again."
              : "A public client has no secret — PKCE binds its exchange instead."}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="client-secret-id">Client ID</FieldLabel>
          <div className="flex gap-2">
            <Input id="client-secret-id" readOnly value={clientId} className="font-mono" onClick={(e) => e.currentTarget.select()} />
            {mode !== "none" && (
              <Button type="button" variant="outline" size="sm" onClick={() => doCopy("id", clientId)}>
                {copiedField === "id" ? "Copied" : "Copy"}
              </Button>
            )}
          </div>
        </Field>
        {clientSecret && (
          <Field>
            <FieldLabel htmlFor="client-secret-value">Client secret</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="client-secret-value"
                readOnly
                value={clientSecret}
                className="font-mono"
                onClick={(e) => e.currentTarget.select()}
              />
              {mode !== "none" && (
                <Button type="button" variant="outline" size="sm" onClick={() => doCopy("secret", clientSecret)}>
                  {copiedField === "secret" ? "Copied" : "Copy"}
                </Button>
              )}
            </div>
            {mode === "none" && (
              <FieldDescription>
                Your browser does not support copying here. Select the text above and copy it
                manually.
              </FieldDescription>
            )}
          </Field>
        )}
        {clientSecret && (
          <Label className="font-normal">
            <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
            I have saved this
          </Label>
        )}
        <DialogFooter>
          <Button disabled={!saved} onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
