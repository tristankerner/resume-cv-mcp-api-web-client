import { useEffect, useMemo, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as documentsApi from "@/lib/api/documents";
import type { DocumentSummary } from "@/lib/api/documents";
import { ApiError, errorMessage } from "@/lib/api/client";
import { readableTypes, writableTypes } from "@/lib/auth/scopes";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";

export function DocumentListView() {
  const { user, session } = useStore();
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const resp = await documentsApi.listDocuments();
      const sorted = [...resp.data].sort(
        (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
      );
      setDocuments(sorted);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    if (session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const readable = useMemo(() => new Set(readableTypes(user)), [user]);
  const writable = useMemo(() => writableTypes(user), [user]);

  if (!session) return null;
  if (error) return <Banner kind="error">{error}</Banner>;
  if (documents === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div>
      <PageHeader
        title="Documents"
        actions={
          writable.length > 0 && (
            <Button onClick={() => store.navigate("create")}>New document</Button>
          )
        }
      />
      {documents.length === 0 ? (
        <EmptyState>
          {readable.size === 0
            ? "You cannot read any type of document."
            : "You have no documents yet."}
        </EmptyState>
      ) : (
        <Table className="table-reflow">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Revision</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.type + "/" + doc.name}>
                <TableCell data-label="Name">{doc.name}</TableCell>
                <TableCell data-label="Type">
                  <Badge variant="outline">{doc.type}</Badge>
                </TableCell>
                <TableCell data-label="Visibility">
                  <Badge variant={doc.public ? "success" : "secondary"}>
                    {doc.public ? "public" : "private"}
                  </Badge>
                </TableCell>
                <TableCell data-label="Revision">#{doc.revision_id}</TableCell>
                <TableCell data-label="Note" className="whitespace-normal">
                  {doc.revision_note || "—"}
                </TableCell>
                <TableCell data-label="Created">{new Date(doc.created_at).toLocaleString()}</TableCell>
                <TableCell data-label="">
                  {readable.has(doc.type) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => store.navigate("edit", { type: doc.type, name: doc.name })}
                    >
                      Open
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
