import { useState } from "react";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import * as documentsApi from "@/lib/api/documents";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { DeleteDocumentResponse } from "@/lib/api/documents";

export function DeleteDialog({
  name,
  onClose,
  onDeleted,
}: {
  name: string;
  onClose: () => void;
  onDeleted: (resp: DeleteDocumentResponse) => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const resp = await documentsApi.deleteDocument(name);
      onDeleted(resp);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{name}&rdquo;?</DialogTitle>
          <DialogDescription>
            This deletes the document entirely, including every revision. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <Banner kind="error">{error}</Banner>
        <Field>
          <FieldLabel htmlFor="confirm-name">Type the document name to confirm</FieldLabel>
          <Input
            id="confirm-name"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.currentTarget.value)}
            autoComplete="off"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={busy || typed !== name}>
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
