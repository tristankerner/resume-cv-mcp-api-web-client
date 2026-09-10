import { type FormEvent, useEffect, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { ConfirmPasswordDialog } from "@/components/common/ConfirmPasswordDialog";
import { DateTimeText } from "@/components/common/DateTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddPasskeyDialog } from "@/features/security/AddPasskeyDialog";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import * as passkeysApi from "@/lib/api/passkeys";
import type { PasskeyListResponse, PasskeyStatus } from "@/lib/api/passkeys";
import { browserCanUsePasskeys } from "@/lib/auth/webauthn";

function RenamePasskeyDialog({
  credential,
  onCancel,
  onRenamed,
}: {
  credential: PasskeyStatus;
  onCancel: () => void;
  onRenamed: (updated: PasskeyStatus) => void;
}) {
  const [label, setLabel] = useState(credential.label);
  const { run, busy, error } = useAsyncAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    await run(() => passkeysApi.renamePasskey(credential.id, { label }), { onSuccess: onRenamed });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Rename passkey</DialogTitle>
          </DialogHeader>
          <Banner kind="error">{error}</Banner>
          <Field>
            <FieldLabel htmlFor="passkey-rename">Label</FieldLabel>
            <Input
              id="passkey-rename"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              required
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Self-contained: owns its own load, table, and the add/rename/remove
// dialogs. SecurityView knows nothing else about it.
export function PasskeysPanel({ onChanged }: { onChanged: () => void }) {
  const canUse = browserCanUsePasskeys();
  const [status, setStatus] = useState<PasskeyListResponse | null>(null);
  const { run: runLoad, error: loadError } = useAsyncAction();
  const [showAdd, setShowAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<PasskeyStatus | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PasskeyStatus | null>(null);

  async function load() {
    await runLoad(() => passkeysApi.listPasskeys(), { onSuccess: setStatus });
  }

  useEffect(() => {
    if (canUse) load();
  }, [canUse]);

  // Three independent gates: browser support, and — once loaded — whether
  // the deployment has the feature on or this account holds credentials
  // from before it was turned off. Nothing else in this component decides
  // whether passkeys are offered; see lib/auth/webauthn.ts's docstring.
  if (!canUse) return null;
  if (loadError) return <Banner kind="error">{loadError}</Banner>;
  if (status === null) return null;
  if (!status.enabled && status.credentials.length === 0) return null;

  const readOnly = !status.enabled;

  return (
    <div className="mb-5">
      {readOnly && (
        <Banner kind="warn">
          Passkeys are not currently accepted on this deployment. Existing ones can still be
          removed.
        </Banner>
      )}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">Passkeys</h3>
        {!readOnly && <Button onClick={() => setShowAdd(true)}>Add a passkey</Button>}
      </div>

      <Table className="table-reflow">
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>Storage</TableHead>
            <TableHead>Added</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {status.credentials.map((cred) => (
            <TableRow key={cred.id}>
              <TableCell data-label="Label">{cred.label}</TableCell>
              <TableCell data-label="Storage">
                <Badge variant="outline">{passkeysApi.passkeyStorageLabel(cred)}</Badge>
              </TableCell>
              <TableCell data-label="Added">
                <DateTimeText value={cred.created_at} format="date" />
              </TableCell>
              <TableCell data-label="Last used">
                <DateTimeText value={cred.last_used_at} fallback="Never" />
              </TableCell>
              <TableCell data-label="">
                <div className="flex justify-end gap-2">
                  {!readOnly && (
                    <Button size="sm" variant="outline" onClick={() => setRenameTarget(cred)}>
                      Rename
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => setRemoveTarget(cred)}>
                    Remove
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {showAdd && (
        <AddPasskeyDialog
          onCancel={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            setAddError(null);
            load();
            onChanged();
          }}
          onFailed={(message) => {
            setShowAdd(false);
            setAddError(message);
          }}
        />
      )}
      {addError && <Banner kind="error" onDismiss={() => setAddError(null)}>{addError}</Banner>}

      {renameTarget && (
        <RenamePasskeyDialog
          credential={renameTarget}
          onCancel={() => setRenameTarget(null)}
          onRenamed={() => {
            setRenameTarget(null);
            load();
          }}
        />
      )}

      {removeTarget && (
        <ConfirmPasswordDialog
          title={`Remove "${removeTarget.label}"?`}
          description="Removing every passkey leaves your password login working — this is not the lockout warning the second-factor table shows."
          confirmLabel="Remove"
          danger
          onCancel={() => setRemoveTarget(null)}
          onConfirm={async (password) => {
            await passkeysApi.removePasskey(removeTarget.id, { current_password: password });
            setRemoveTarget(null);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}
