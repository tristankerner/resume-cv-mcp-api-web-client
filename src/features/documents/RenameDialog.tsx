import { type FormEvent, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import * as documentsApi from "@/lib/api/documents";
import type { RenameDocumentResponse } from "@/lib/api/documents";
import { ApiError, errorMessage } from "@/lib/api/client";
import { validateDocumentName } from "@/lib/documents/names";

export function RenameDialog({
  name,
  isPublic,
  onClose,
  onRenamed,
}: {
  name: string;
  isPublic: boolean;
  onClose: () => void;
  onRenamed: (resp: RenameDocumentResponse) => void;
}) {
  const [newName, setNewName] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const nameErr = validateDocumentName(newName);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const resp = await documentsApi.renameDocument(name, newName);
      onRenamed(resp);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Renaming changes this document&rsquo;s only handle. Anything referencing it by the
            name <strong className="text-foreground">{name}</strong> — an MCP client&rsquo;s{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">resume_id</code>,{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">resume_metadata_id</code> or{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">resume_skill_id</code> argument, or a{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">ResumeSkill.inputs[].document</code> entry
            inside another document — will stop resolving until it is updated to match.
          </p>
          {isPublic && (
            <Banner kind="warn">
              This document is public. Its URL will change to{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">/public/&hellip;/resume/{newName}</code>,
              and the site consuming the old URL will 404 until it is updated — the Cloudflare cache may
              hold the old path for up to five minutes either way.
            </Banner>
          )}
          <Banner kind="error">{error}</Banner>
          <Field>
            <FieldLabel htmlFor="new-name">New name</FieldLabel>
            <Input
              id="new-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.currentTarget.value)}
              required
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || newName === name}>
              {busy ? "Renaming…" : "Rename"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
