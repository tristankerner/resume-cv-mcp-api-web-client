import { useEffect, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { ConfirmPasswordDialog } from "@/components/common/ConfirmPasswordDialog";
import { DateTimeText } from "@/components/common/DateTime";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActivateTotpModal } from "@/features/security/ActivateTotpModal";
import { BackupCodesModal } from "@/features/security/BackupCodesModal";
import * as authApi from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import * as mfaApi from "@/lib/api/mfa";
import type { BackupCodesResponse, EnrollTotpResponse, MfaCredentialStatus, MfaStatusResponse } from "@/lib/api/mfa";
import { store } from "@/store/store";

export function SecurityView() {
  const [status, setStatus] = useState<MfaStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollLabel, setEnrollLabel] = useState("Authenticator app");
  // The enrollTotp response, plus the password that produced it (reused, not
  // re-prompted, if Cancel needs to delete the still-pending row).
  const [activating, setActivating] = useState<(EnrollTotpResponse & { password: string }) | null>(null);
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);
  const [backupReveal, setBackupReveal] = useState<BackupCodesResponse | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MfaCredentialStatus | null>(null);

  async function load() {
    setError(null);
    try {
      setStatus(await mfaApi.mfaStatus());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function refreshUser() {
    // user.mfa_enrolled drives the no-second-factor warning in App(); a
    // stale copy would keep nagging right after fixing it, or vice versa.
    try {
      store.set({ user: await authApi.me() });
    } catch {
      // A 401 already handled itself inside request(). Anything else just
      // leaves the banner as it was until the next visit here.
    }
  }

  if (error) return <Banner kind="error">{error}</Banner>;
  if (status === null) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</p>;

  return (
    <div>
      <PageHeader title="Security" />
      {status.credentials.length === 0 ? (
        <div className="mb-5">
          <EmptyState>No second factor set up yet.</EmptyState>
        </div>
      ) : (
        <Table className="table-reflow mb-5">
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Added</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {status.credentials.map((cred) => (
              <TableRow key={cred.id}>
                <TableCell data-label="Label">{cred.label}</TableCell>
                <TableCell data-label="Method">
                  <Badge variant="outline">{mfaApi.mfaKindLabel(cred.kind)}</Badge>
                </TableCell>
                <TableCell data-label="Added">
                  <DateTimeText value={cred.created_at} format="date" />
                </TableCell>
                <TableCell data-label="Last used">
                  <DateTimeText value={cred.last_used_at} fallback="Never" />
                </TableCell>
                <TableCell data-label="Remaining">{cred.remaining === null ? "—" : cred.remaining}</TableCell>
                <TableCell data-label="">
                  <Button size="sm" variant="destructive" onClick={() => setRemoveTarget(cred)}>
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="mb-5 flex flex-wrap gap-3">
        <Button onClick={() => setShowEnroll(true)}>Add an authenticator app</Button>
        <Button variant="outline" onClick={() => setShowBackupConfirm(true)}>
          {status.backup_codes_remaining === null ? "Generate backup codes" : "Regenerate backup codes"}
        </Button>
      </div>

      {showEnroll && (
        <ConfirmPasswordDialog
          title="Add an authenticator app"
          confirmLabel="Continue"
          onCancel={() => setShowEnroll(false)}
          extra={
            <Field>
              <FieldLabel htmlFor="totp-label">Label</FieldLabel>
              <Input
                id="totp-label"
                type="text"
                value={enrollLabel}
                onChange={(e) => setEnrollLabel(e.currentTarget.value)}
                required
              />
              <FieldDescription>
                A name to tell this authenticator apart from any others — e.g. "Phone" or
                "Laptop".
              </FieldDescription>
            </Field>
          }
          onConfirm={async (password) => {
            const result = await mfaApi.enrollTotp({ label: enrollLabel, current_password: password });
            setShowEnroll(false);
            setActivating({ ...result, password });
          }}
        />
      )}

      {activating && (
        <ActivateTotpModal
          enrolled={activating}
          onCancel={async () => {
            // Best-effort: an unactivated credential satisfies no login on
            // its own, so leaving one behind on a failed cleanup is inert,
            // not a security problem — not worth surfacing a second error
            // over.
            try {
              await mfaApi.removeMfa(activating.credential_id, { current_password: activating.password });
            } catch {
              // best-effort cleanup, see above
            }
            setActivating(null);
            load();
          }}
          onActivated={() => {
            setActivating(null);
            load();
            refreshUser();
          }}
        />
      )}

      {showBackupConfirm && (
        <ConfirmPasswordDialog
          title={status.backup_codes_remaining === null ? "Generate backup codes" : "Regenerate backup codes"}
          description={
            status.backup_codes_remaining !== null
              ? "This replaces your existing backup codes — the old set stops working immediately."
              : null
          }
          confirmLabel="Continue"
          onCancel={() => setShowBackupConfirm(false)}
          onConfirm={async (password) => {
            const result = await mfaApi.regenerateBackupCodes({ current_password: password });
            setShowBackupConfirm(false);
            setBackupReveal(result);
            load();
            refreshUser();
          }}
        />
      )}

      {backupReveal && <BackupCodesModal codes={backupReveal.codes} onClose={() => setBackupReveal(null)} />}

      {removeTarget && (
        <ConfirmPasswordDialog
          title={`Remove "${removeTarget.label}"?`}
          description={
            status.credentials.length === 1
              ? "This is your only second factor. Removing it means your password alone will log you in."
              : "Anything using this method will stop working immediately."
          }
          confirmLabel="Remove"
          danger
          onCancel={() => setRemoveTarget(null)}
          onConfirm={async (password) => {
            await mfaApi.removeMfa(removeTarget.id, { current_password: password });
            setRemoveTarget(null);
            load();
            refreshUser();
          }}
        />
      )}
    </div>
  );
}
