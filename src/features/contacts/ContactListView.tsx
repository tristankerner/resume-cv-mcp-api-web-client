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
import type { CompanySummary } from "@/lib/api/companies";
import { ApiError, errorMessage } from "@/lib/api/client";
import * as contactsApi from "@/lib/api/contacts";
import type { Contact } from "@/lib/api/contacts";
import type { ListEnvelope } from "@/lib/api/tracking";
import { canWrite } from "@/lib/auth/scopes";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";

const LIMIT = 50;
const ALL = "__all__";
const NONE = "__none__";

function contactName(contact: Contact): string {
  const parts = [contact.last_name, contact.first_name].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return contact.email || "—";
}

export function ContactListView() {
  const { user } = useStore();
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState(ALL);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<ListEnvelope<Contact> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    companiesApi.listCompanies({ limit: 200 }).then(
      (resp) => setCompanies(resp.data),
      () => {},
    );
  }, []);

  useEffect(() => {
    const handle = setTimeout(load, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, companyFilter, offset]);

  async function load() {
    setError(null);
    try {
      const companyId = companyFilter !== ALL && companyFilter !== NONE ? Number(companyFilter) : undefined;
      const resp = await contactsApi.listContacts({ query, company_id: companyId, limit: LIMIT, offset });
      const data = companyFilter === NONE ? resp.data.filter((c) => c.company_id === null) : resp.data;
      setResult({ ...resp, data });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        actions={
          canWrite(user, "contacts") && (
            <Button onClick={() => store.navigate("contact-create")}>New contact</Button>
          )
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-3">
          <Input
            className="max-w-xs"
            placeholder="Search contacts…"
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setOffset(0);
            }}
          />
          <Select
            value={companyFilter}
            onValueChange={(v) => {
              setCompanyFilter(v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All companies</SelectItem>
              <SelectItem value={NONE}>— no company —</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error && <Banner kind="error">{error}</Banner>}
      {result === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : result.data.length === 0 ? (
        <EmptyState>No contacts yet.</EmptyState>
      ) : (
        <>
          <Table className="table-reflow">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell data-label="Name">{contactName(contact)}</TableCell>
                  <TableCell data-label="Company">{contact.company_name || "—"}</TableCell>
                  <TableCell data-label="Email">{contact.email || "—"}</TableCell>
                  <TableCell data-label="Phone">{contact.phone || "—"}</TableCell>
                  <TableCell data-label="Rating">{contact.rating != null ? `${contact.rating}/10` : "—"}</TableCell>
                  <TableCell data-label="">
                    <Button size="sm" variant="outline" onClick={() => store.navigate("contact", { id: contact.id })}>
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
