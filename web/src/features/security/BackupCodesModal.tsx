import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { clipboardMode, copyText } from "@/lib/clipboard";

export function BackupCodesModal({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copyMode] = useState(() => clipboardMode());
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    const ok = await copyText(codes.join("\n"));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && saved && onClose()}>
      <DialogContent showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Save these backup codes</DialogTitle>
          <DialogDescription>
            Each code works once. Store them somewhere safe — this is the only time they are
            shown.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {codes.map((c) => (
            <code key={c} className="rounded bg-muted px-2 py-1 text-center font-mono text-sm">
              {c}
            </code>
          ))}
        </div>
        <div className="flex gap-3">
          {copyMode !== "none" && (
            <Button type="button" variant="outline" size="sm" onClick={copyAll}>
              {copied ? "Copied" : "Copy all"}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            Print
          </Button>
        </div>
        <Label className="font-normal">
          <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
          I have saved these codes
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
