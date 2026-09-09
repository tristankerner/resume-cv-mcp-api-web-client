import { type FormEvent, useMemo, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as mfaApi from "@/lib/api/mfa";
import type { EnrollTotpResponse } from "@/lib/api/mfa";
import { ApiError, errorMessage } from "@/lib/api/client";
import { clipboardMode, copyText } from "@/lib/clipboard";
import { otpauthQrDataUrl } from "@/lib/qr";

// The QR/secret reveal plus activation — modelled on ApiKeyRevealModal's
// (and now SecretReveal's) "I have saved this" gate, since it is the same
// one-time-secret problem: the seed is never shown again after this. Not
// dismissible except by Cancel (which removes the still-pending credential)
// or a successful activation.
export function ActivateTotpModal({
  enrolled,
  onCancel,
  onActivated,
}: {
  enrolled: EnrollTotpResponse;
  onCancel: () => void;
  onActivated: () => void;
}) {
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyMode] = useState(() => clipboardMode());
  const [copied, setCopied] = useState(false);
  const qrDataUrl = useMemo(() => otpauthQrDataUrl(enrolled.otpauth_uri), [enrolled.otpauth_uri]);

  async function doCopy() {
    const ok = await copyText(enrolled.secret);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function activate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await mfaApi.activateTotp(enrolled.credential_id, { code });
      onActivated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <form onSubmit={activate} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Scan this code</DialogTitle>
            <DialogDescription>
              Scan with your authenticator app, or enter the secret below by hand.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <img src={qrDataUrl} alt={`QR code encoding the ${enrolled.label} setup link`} width={200} height={200} />
          </div>
          <Field>
            <FieldLabel htmlFor="totp-secret">Secret</FieldLabel>
            <Input
              id="totp-secret"
              type="text"
              readOnly
              value={enrolled.secret}
              className="font-mono"
              onClick={(e) => e.currentTarget.select()}
            />
            {copyMode !== "none" && (
              <Button type="button" variant="outline" size="sm" onClick={doCopy}>
                {copied ? "Copied" : "Copy"}
              </Button>
            )}
            <a href={enrolled.otpauth_uri} className="block text-sm text-muted-foreground underline underline-offset-4">
              Open in an authenticator app
            </a>
          </Field>
          <Label className="font-normal">
            <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
            I have saved this
          </Label>
          <Banner kind="error">{error}</Banner>
          <Field>
            <FieldLabel htmlFor="activate-code">Code from your app</FieldLabel>
            <Input
              id="activate-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              disabled={!saved}
              required
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !saved}>
              {busy ? "Activating…" : "Activate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
