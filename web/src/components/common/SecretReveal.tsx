import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clipboardMode, copyText } from "@/lib/clipboard";

// A one-time secret reveal: an API key, an OAuth client secret. Shown
// exactly once and never retrievable again, so the dialog cannot be
// dismissed except by checking "I have saved this" first — same gate
// BackupCodesModal and ActivateTotpModal use for the same reason.
export function SecretReveal({
  title,
  description,
  label,
  secretValue,
  onClose,
}: {
  title: string;
  description: string;
  label: string;
  secretValue: string;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState(() => clipboardMode());
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  async function doCopy() {
    const ok = await copyText(secretValue);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      // The capability check said this should work; a runtime failure
      // (permission denied, activation lost to this very dialog) still
      // degrades to the manual-copy presentation rather than doing nothing.
      setMode("none");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && saved && onClose()}>
      <DialogContent showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="secret-reveal-value">{label}</Label>
          <Input
            id="secret-reveal-value"
            ref={inputRef}
            type="text"
            readOnly
            value={secretValue}
            className="font-mono"
            onClick={(e) => e.currentTarget.select()}
          />
          {mode === "none" ? (
            <p className="text-sm text-muted-foreground">
              Your browser does not support copying here. Select the text above and copy it
              manually (Cmd/Ctrl-C, or a long-press "Copy" on mobile).
            </p>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={doCopy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
        </div>
        <Label className="font-normal">
          <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
          I have saved this
        </Label>
        <DialogFooter>
          <Button disabled={!saved} onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
