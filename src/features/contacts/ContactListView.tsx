import { SearchIcon } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { Banner } from "@/components/common/Banner";
import { DataTableFooter } from "@/components/common/DataTableFooter";
import { EmptyState } from "@/components/common/EmptyState";
import { EditableCell } from "@/components/common/inline/EditableCell";
import { useRefreshOn } from "@/hooks/useRefreshOn";
import { CompanyEditor } from "@/components/common/inline/editors/CompanyEditor";
import { EmailEditor } from "@/components/common/inline/editors/EmailEditor";
import { PhoneEditor } from "@/components/common/inline/editors/PhoneEditor";
import { RatingEditor } from "@/components/common/inline/editors/RatingEditor";
import type { EditorProps } from "@/components/common/inline/editors/types";
import { useInlineEdit } from "@/components/common/inline/useInlineEdit";
import { PageHeader } from "@/components/common/PageHeader";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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

interface NameValue {
  first_name: string;
  last_name: string;
}

// Two TextEditors sharing one cell — Tab between them must not commit (blur
// only fires the commit when focus leaves the pair entirely), matching the
// single-input editors' Enter/Escape/blur behaviour otherwise.
function NameEditor({ value, onCommit, onCancel, autoFocus }: EditorProps<NameValue>) {
  const [first, setFirst] = useState(value.first_name);
  const [last, setLast] = useState(value.last_name);
  const cancelledRef = useRef(false);

  function commitBoth() {
    if (cancelledRef.current) return;
    onCommit({ first_name: first, last_name: last });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitBoth();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelledRef.current = true;
      onCancel();
    }
  }

  return (
    <div
      className="flex gap-1"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitBoth();
      }}
    >
      <Input
        autoFocus={autoFocus}
        placeholder="First"
        value={first}
        onChange={(e) => setFirst(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        className="h-8"
      />
      <Input
        placeholder="Last"
        value={last}
        onChange={(e) => setLast(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        className="h-8"
      />
    </div>
  );
}

export function ContactListView() {
  const { user, contactsList } = useStore();
  const { query, companyFilter, offset } = contactsList;
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [result, setResult] = useState<ListEnvelope<Contact> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { commit } = useInlineEdit<Contact>();
  const writable = canWrite(user, "contacts");

  const setRows: Dispatch<SetStateAction<Contact[]>> = (update) => {
    setResult((prev) => {
      if (!prev) return prev;
      const nextData = typeof update === "function" ? (update as (p: Contact[]) => Contact[])(prev.data) : update;
      return { ...prev, data: nextData };
    });
  };

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

  useRefreshOn(["contacts"], load);

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
          <InputGroup className="max-w-xs">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search contacts…"
              value={query}
              onChange={(e) => {
                store.setContactsList({ query: e.currentTarget.value, offset: 0 });
              }}
            />
          </InputGroup>
          <Select
            value={companyFilter}
            onValueChange={(v) => {
              store.setContactsList({ companyFilter: v, offset: 0 });
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
        <TableSkeleton />
      ) : result.data.length === 0 ? (
        <EmptyState
          action={
            canWrite(user, "contacts") && (
              <Button size="sm" onClick={() => store.navigate("contact-create")}>
                New contact
              </Button>
            )
          }
        >
          No contacts yet.
        </EmptyState>
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
                  <EditableCell<NameValue>
                    value={{ first_name: contact.first_name ?? "", last_name: contact.last_name ?? "" }}
                    editable={writable}
                    ariaLabel={`Edit name for ${contactName(contact)}`}
                    dataLabel="Name"
                    display={contactName(contact)}
                    renderEditor={(props) => <NameEditor {...props} />}
                    onCommit={(value) =>
                      commit({
                        rowId: contact.id,
                        getId: (r) => r.id,
                        setRows,
                        previousValues: { first_name: contact.first_name, last_name: contact.last_name },
                        optimisticValues: {
                          first_name: value.first_name.trim() || null,
                          last_name: value.last_name.trim() || null,
                        },
                        patch: (id, body) => contactsApi.updateContact(id, body),
                        body: {
                          first_name: value.first_name.trim() || null,
                          last_name: value.last_name.trim() || null,
                        },
                      })
                    }
                  />
                  <EditableCell<number | null>
                    value={contact.company_id}
                    editable={writable}
                    ariaLabel={`Edit company for ${contactName(contact)}`}
                    dataLabel="Company"
                    display={contact.company_name || "—"}
                    renderEditor={(props) => <CompanyEditor {...props} valueLabel={contact.company_name} allowNone />}
                    onCommit={(value) =>
                      commit({
                        rowId: contact.id,
                        getId: (r) => r.id,
                        setRows,
                        previousValues: { company_id: contact.company_id, company_name: contact.company_name },
                        optimisticValues: { company_id: value },
                        patch: (id, body) => contactsApi.updateContact(id, body),
                        body: { company_id: value },
                      })
                    }
                  />
                  <EditableCell<string>
                    value={contact.email ?? ""}
                    editable={writable}
                    ariaLabel={`Edit email for ${contactName(contact)}`}
                    dataLabel="Email"
                    display={contact.email || "—"}
                    renderEditor={(props) => <EmailEditor {...props} />}
                    onCommit={(value) =>
                      commit({
                        rowId: contact.id,
                        getId: (r) => r.id,
                        setRows,
                        previousValues: { email: contact.email },
                        optimisticValues: { email: value.trim() || null },
                        patch: (id, body) => contactsApi.updateContact(id, body),
                        body: { email: value.trim() || null },
                      })
                    }
                  />
                  <EditableCell<string>
                    value={contact.phone ?? ""}
                    editable={writable}
                    ariaLabel={`Edit phone for ${contactName(contact)}`}
                    dataLabel="Phone"
                    display={contact.phone || "—"}
                    renderEditor={(props) => <PhoneEditor {...props} />}
                    onCommit={(value) =>
                      commit({
                        rowId: contact.id,
                        getId: (r) => r.id,
                        setRows,
                        previousValues: { phone: contact.phone },
                        optimisticValues: { phone: value.trim() || null },
                        patch: (id, body) => contactsApi.updateContact(id, body),
                        body: { phone: value.trim() || null },
                      })
                    }
                  />
                  <EditableCell<string>
                    value={contact.rating != null ? String(contact.rating) : ""}
                    editable={writable}
                    ariaLabel={`Edit rating for ${contactName(contact)}`}
                    dataLabel="Rating"
                    display={contact.rating != null ? `${contact.rating}/10` : "—"}
                    renderEditor={(props) => <RatingEditor {...props} />}
                    onCommit={(value) =>
                      commit({
                        rowId: contact.id,
                        getId: (r) => r.id,
                        setRows,
                        previousValues: { rating: contact.rating },
                        optimisticValues: { rating: value ? Number(value) : null },
                        patch: (id, body) => contactsApi.updateContact(id, body),
                        body: { rating: value ? Number(value) : null },
                      })
                    }
                  />
                  <TableCell data-label="">
                    <Button size="sm" variant="outline" onClick={() => store.navigate("contact", { id: contact.id })}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataTableFooter
            total={result.total}
            limit={LIMIT}
            offset={offset}
            onOffsetChange={(next) => store.setContactsList({ offset: next })}
          />
        </>
      )}
    </div>
  );
}
