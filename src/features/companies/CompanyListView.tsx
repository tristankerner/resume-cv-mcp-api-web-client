import { useEffect, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { DataTableFooter } from "@/components/common/DataTableFooter";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as companiesApi from "@/lib/api/companies";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { ListEnvelope } from "@/lib/api/tracking";
import type { CompanySummary } from "@/lib/api/companies";
import { canWrite } from "@/lib/auth/scopes";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";
import { safeHref } from "@/lib/tracking/links";

const LIMIT = 50;

type SortOption = "name" | "-created_at";

export function CompanyListView() {
  const { user } = useStore();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("name");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<ListEnvelope<CompanySummary> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(load, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort, offset]);

  async function load() {
    setError(null);
    try {
      setResult(await companiesApi.listCompanies({ query, sort, limit: LIMIT, offset }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        actions={
          canWrite(user, "companies") && (
            <Button onClick={() => store.navigate("company-create")}>New company</Button>
          )
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-3">
          <Input
            className="max-w-xs"
            placeholder="Search companies…"
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setOffset(0);
            }}
          />
          <Select
            value={sort}
            onValueChange={(v) => {
              setSort(v as SortOption);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="-created_at">Newest</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error && <Banner kind="error">{error}</Banner>}
      {result === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : result.data.length === 0 ? (
        <EmptyState>No companies yet.</EmptyState>
      ) : (
        <>
          <Table className="table-reflow">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Applications</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell data-label="Name">{c.name}</TableCell>
                  <TableCell data-label="Website">
                    {safeHref(c.website) ? (
                      <a
                        href={safeHref(c.website)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary underline underline-offset-4"
                      >
                        {c.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell data-label="Applications">{c.application_count}</TableCell>
                  <TableCell data-label="Contacts">{c.contact_count}</TableCell>
                  <TableCell data-label="">
                    <Button size="sm" variant="outline" onClick={() => store.navigate("company", { id: c.id })}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataTableFooter total={result.total} limit={LIMIT} offset={offset} onOffsetChange={setOffset} />
        </>
      )}
    </div>
  );
}
