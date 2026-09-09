import { useEffect, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiKeyRevealModal } from "@/features/api-keys/ApiKeyRevealModal";
import { CreateApiKeyForm } from "@/features/api-keys/CreateApiKeyForm";
import * as apiKeysApi from "@/lib/api/apiKeys";
import type { ApiKey, CreateApiKeyResponse } from "@/lib/api/apiKeys";
import { ApiError, errorMessage } from "@/lib/api/client";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";

const STATUS_VARIANT = {
  active: "success",
  expired: "secondary",
  revoked: "secondary",
} as const;

export function ApiKeysView() {
  const { user, apiKeysList } = useStore();
  const { showInactive } = apiKeysList;
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<CreateApiKeyResponse | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setKeys(await apiKeysApi.listApiKeys());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function doRevoke(key: ApiKey) {
    setRevokeBusy(true);
    setRevokeError(null);
    try {
      await apiKeysApi.revokeApiKey(key.id);
      setRevokeTarget(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setRevokeError(errorMessage(err));
    } finally {
      setRevokeBusy(false);
    }
  }

  const grantable = (user?.scopes || []).length > 0;
  if (!grantable) {
    return <EmptyState>You do not hold any scope that can be granted to a key.</EmptyState>;
  }
  if (error) return <Banner kind="error">{error}</Banner>;
  if (keys === null) return <TableSkeleton />;

  const visible = keys.filter((k) => showInactive || apiKeysApi.apiKeyStatus(k) === "active");

  return (
    <div>
      <PageHeader title="API keys" />
      <CreateApiKeyForm
        user={user!}
        onCreated={(resp) => {
          setReveal(resp);
          load();
        }}
      />

      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">Your keys</h3>
        <Label className="text-sm font-normal">
          <Switch
            checked={showInactive}
            onCheckedChange={(checked) => store.setApiKeysList({ showInactive: checked })}
          />
          Show expired and revoked
        </Label>
      </div>

      {visible.length === 0 ? (
        <EmptyState>No keys to show.</EmptyState>
      ) : (
        <Table className="table-reflow">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((key) => {
              const status = apiKeysApi.apiKeyStatus(key);
              return (
                <TableRow key={key.id}>
                  <TableCell data-label="Name">{key.name}</TableCell>
                  <TableCell data-label="Prefix">
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">{key.prefix}</code>
                  </TableCell>
                  <TableCell data-label="Scopes" className="whitespace-normal">
                    {key.scopes.join(", ")}
                  </TableCell>
                  <TableCell data-label="Status">
                    <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                  </TableCell>
                  <TableCell data-label="Created">{new Date(key.created_at).toLocaleDateString()}</TableCell>
                  <TableCell data-label="Expires">
                    {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell data-label="Last used">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "Never"}
                  </TableCell>
                  <TableCell data-label="">
                    {status !== "revoked" && (
                      <Button size="sm" variant="destructive" onClick={() => setRevokeTarget(key)}>
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {reveal && (
        <ApiKeyRevealModal apiKey={reveal.api_key} secretKey={reveal.key} onClose={() => setReveal(null)} />
      )}

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke &ldquo;{revokeTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Anything using this key will stop working immediately. The row stays so its usage
              history remains readable — this is not the same as deleting it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Banner kind="error">{revokeError}</Banner>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={revokeBusy}
              onClick={(e) => {
                e.preventDefault();
                if (revokeTarget) doRevoke(revokeTarget);
              }}
            >
              {revokeBusy ? "Revoking…" : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
