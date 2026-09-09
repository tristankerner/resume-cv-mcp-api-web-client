import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Banner } from "@/components/common/Banner";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientSecretModal } from "@/features/admin/ClientSecretModal";
import { RegisterClientDialog } from "@/features/admin/RegisterClientDialog";
import * as adminApi from "@/lib/api/admin";
import type { AdminCreateClientResponse, AdminOAuthClient } from "@/lib/api/admin";
import { ApiError, errorMessage } from "@/lib/api/client";

export function OAuthClientsView() {
  const [clients, setClients] = useState<AdminOAuthClient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [reveal, setReveal] = useState<AdminCreateClientResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminOAuthClient | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setClients((await adminApi.listOAuthClients()).data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function doDelete(client: AdminOAuthClient) {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await adminApi.deleteOAuthClient(client.client_id);
      setDeleteTarget(null);
      toast.success(`"${client.client_name}" deregistered.`);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setDeleteError(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (error) return <Banner kind="error">{error}</Banner>;
  if (clients === null) return <TableSkeleton />;

  return (
    <div>
      <PageHeader
        title="OAuth clients"
        actions={<Button onClick={() => setShowRegister(true)}>Register client</Button>}
      />

      <Table className="table-reflow">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Client ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Redirect URIs</TableHead>
            <TableHead>Created</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.client_id}>
              <TableCell data-label="Name">{client.client_name}</TableCell>
              <TableCell data-label="Client ID">
                <code className="rounded bg-muted px-1 py-0.5 text-xs">{client.client_id}</code>
              </TableCell>
              <TableCell data-label="Type">
                <Badge variant={client.confidential ? "outline" : "secondary"}>
                  {client.confidential ? "Confidential" : "Public"}
                </Badge>
              </TableCell>
              <TableCell data-label="Redirect URIs" className="whitespace-normal">
                <div className="flex flex-col gap-0.5">
                  {client.redirect_uris.map((uri) => (
                    <code key={uri} className="text-xs text-muted-foreground">
                      {uri}
                    </code>
                  ))}
                </div>
              </TableCell>
              <TableCell data-label="Created">{new Date(client.created_at).toLocaleDateString()}</TableCell>
              <TableCell data-label="">
                <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(client)}>
                  Deregister
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {showRegister && (
        <RegisterClientDialog
          onClose={() => setShowRegister(false)}
          onRegistered={(resp) => {
            setShowRegister(false);
            setReveal(resp);
            load();
          }}
        />
      )}

      {reveal && (
        <ClientSecretModal
          clientId={reveal.client.client_id}
          clientSecret={reveal.client_secret}
          onClose={() => setReveal(null)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deregister &ldquo;{deleteTarget?.client_name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Every authorization code and refresh token this client holds dies with it. Any
              connected MCP client will have to re-authorize.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Banner kind="error">{deleteError}</Banner>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) doDelete(deleteTarget);
              }}
            >
              {deleteBusy ? "Deregistering…" : "Deregister"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
