import { type FormEvent, useEffect, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { DateText } from "@/components/common/DateTime";
import { DetailList, DetailRow } from "@/components/common/DetailList";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CompanyPicker } from "@/features/tracking/CompanyPicker";
import { DuplicateWarning } from "@/features/tracking/DuplicateWarning";
import { CompanyFields, EMPTY_COMPANY_DRAFT, type CompanyDraft } from "@/features/tracking/fields/CompanyFields";
import { HistoryPanel } from "@/features/tracking/HistoryPanel";
import { useRefreshOn } from "@/hooks/useRefreshOn";
import * as companiesApi from "@/lib/api/companies";
import type { CompanyDetail, CompanyRelationship, CompanyStackItem } from "@/lib/api/companies";
import { ApiError, errorMessage } from "@/lib/api/client";
import { asDuplicateConflict, type DuplicateConflict } from "@/lib/api/tracking";
import { canDelete, canWrite } from "@/lib/auth/scopes";
import { COMPANY_RELATIONSHIP_TYPES, STACK_ITEM_TYPES, type CompanyRelationshipType, type StackItemType } from "@/lib/config";
import { applicationStatusVariant, existingRelationshipHint, relationshipLabel } from "@/lib/tracking/labels";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";
import { safeHref } from "@/lib/tracking/links";

export function CompanyDetailView({ id }: { id: number }) {
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setCompany(await companiesApi.getCompany(id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    store.setCrumb(company ? company.name : null);
  }, [company]);

  useRefreshOn(["companies", "applications", "contacts", "events"], load);

  if (error) return <Banner kind="error">{error}</Banner>;
  if (company === null) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</p>;

  return (
    <div className="space-y-5">
      <CompanyHeader company={company} />
      <DetailsCard company={company} onSaved={load} />
      <RelationshipsCard company={company} onChanged={load} />
      <StackCard company={company} onChanged={load} />
      <ContactsCard company={company} />
      <ApplicationsCard company={company} />
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoryPanel table="companies" rowId={company.id} />
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyHeader({ company }: { company: CompanyDetail }) {
  const { user } = useStore();
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setBusy(true);
    setError(null);
    try {
      await companiesApi.deleteCompany(company.id);
      store.navigate("companies");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={company.name}
        actions={
          canDelete(user, "companies") && (
            <Button variant="destructive" onClick={() => setShowDelete(true)}>
              Delete
            </Button>
          )
        }
      />
      <AlertDialog open={showDelete} onOpenChange={(open) => !open && setShowDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{company.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Companies with applications referencing them cannot be
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Banner kind="error">{error}</Banner>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                doDelete();
              }}
            >
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DetailsCard({
  company,
  onSaved,
}: {
  company: CompanyDetail;
  onSaved: () => void;
}) {
  const { user } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CompanyDraft>(EMPTY_COMPANY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DuplicateConflict | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit() {
    setDraft({
      name: company.name,
      website: company.website ?? "",
      description: company.description ?? "",
      personal_note: company.personal_note ?? "",
    });
    setError(null);
    setConflict(null);
    setEditing(true);
  }

  async function save(force = false) {
    setBusy(true);
    setError(null);
    try {
      await companiesApi.updateCompany(company.id, {
        name: draft.name.trim(),
        website: draft.website.trim() || null,
        description: draft.description.trim() || null,
        personal_note: draft.personal_note.trim() || null,
        confirm_create_duplicate: force,
      });
      setConflict(null);
      setEditing(false);
      onSaved();
    } catch (err) {
      const dup = asDuplicateConflict(err);
      if (dup) {
        setConflict(dup);
        return;
      }
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Details</CardTitle>
        {!editing && canWrite(user, "companies") && (
          <Button size="sm" variant="outline" onClick={startEdit}>
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Banner kind="error">{error}</Banner>
        {conflict && (
          <div className="mb-4">
            <DuplicateWarning
              conflict={conflict}
              busy={busy}
              exactIsFinal
              forceLabel="Save anyway"
              onOpen={(id) => store.navigate("company", { id })}
              onForce={() => save(true)}
            />
          </div>
        )}
        {editing ? (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              save(false);
            }}
            className="space-y-4"
          >
            <CompanyFields value={draft} onChange={setDraft} disabled={busy} idPrefix="edit-company" />
            <div className="flex gap-3">
              <Button type="submit" disabled={busy || !draft.name.trim()}>
                {busy ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <DetailList>
            <DetailRow label="Website">
              {safeHref(company.website) ? (
                <a
                  href={safeHref(company.website)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary underline underline-offset-4"
                >
                  {company.website}
                </a>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label="Description" className="max-w-prose whitespace-pre-wrap">
              {company.description || "—"}
            </DetailRow>
            <DetailRow label="Personal note" className="max-w-prose whitespace-pre-wrap">
              {company.personal_note || "—"}
            </DetailRow>
          </DetailList>
        )}
      </CardContent>
    </Card>
  );
}

function RelationshipsCard({ company, onChanged }: { company: CompanyDetail; onChanged: () => void }) {
  const { user } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [toCompanyId, setToCompanyId] = useState<number | null>(null);
  const [type, setType] = useState<CompanyRelationshipType>(COMPANY_RELATIONSHIP_TYPES[0].value);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<CompanyRelationship | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function addRelationship(e: FormEvent) {
    e.preventDefault();
    if (toCompanyId === null) return;
    setBusy(true);
    setError(null);
    try {
      await companiesApi.createRelationship(company.id, { to_company_id: toCompanyId, type, note: note.trim() || null });
      setShowAdd(false);
      setToCompanyId(null);
      setNote("");
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeRelationship() {
    if (!removeTarget) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await companiesApi.deleteRelationship(removeTarget.id);
      setRemoveTarget(null);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setRemoveError(errorMessage(err));
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Relationships</CardTitle>
        {canWrite(user, "companies") && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            Add relationship
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {company.relationships.length === 0 ? (
          <EmptyState>No relationships yet.</EmptyState>
        ) : (
          <ul className="space-y-2 text-sm">
            {company.relationships.map((rel) => {
              const direction = rel.from_company_id === company.id ? "from" : "to";
              const otherName = direction === "from" ? rel.to_company_name : rel.from_company_name;
              return (
                <li key={rel.id}>
                  <Item variant="outline" size="sm">
                    <ItemContent>
                      <ItemTitle className="font-normal">
                        {relationshipLabel(rel.type, direction, otherName)}
                      </ItemTitle>
                      {rel.note && <ItemDescription>{rel.note}</ItemDescription>}
                    </ItemContent>
                    {canDelete(user, "companies") && (
                      <ItemActions>
                        <Button size="sm" variant="ghost" onClick={() => setRemoveTarget(rel)}>
                          Remove
                        </Button>
                      </ItemActions>
                    )}
                  </Item>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <Dialog open={showAdd} onOpenChange={(open) => !open && setShowAdd(false)}>
        <DialogContent>
          <form onSubmit={addRelationship} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add relationship</DialogTitle>
            </DialogHeader>
            <Banner kind="error">{error}</Banner>
            <Field>
              <FieldLabel>Company</FieldLabel>
              <CompanyPicker
                value={toCompanyId}
                onChange={(id) => setToCompanyId(id)}
                allowCreate
                modal
                excludeIds={[company.id]}
                hintFor={(c) => existingRelationshipHint(company.relationships, company.id, c.id)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="rel-type">Relationship</FieldLabel>
              <Select value={type} onValueChange={(v) => setType(v as CompanyRelationshipType)}>
                <SelectTrigger id="rel-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_RELATIONSHIP_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="rel-note">Note</FieldLabel>
              <Input id="rel-note" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || toCompanyId === null}>
                {busy ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this relationship?</AlertDialogTitle>
          </AlertDialogHeader>
          <Banner kind="error">{removeError}</Banner>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeBusy}
              onClick={(e) => {
                e.preventDefault();
                removeRelationship();
              }}
            >
              {removeBusy ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function StackCard({ company, onChanged }: { company: CompanyDetail; onChanged: () => void }) {
  const { user } = useStore();
  const writable = canWrite(user, "companies");
  const [name, setName] = useState("");
  const [type, setType] = useState<StackItemType>(STACK_ITEM_TYPES[0].value);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DuplicateConflict | null>(null);
  const [busy, setBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<CompanyStackItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<StackItemType>(STACK_ITEM_TYPES[0].value);
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompanyStackItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function addItem(force = false) {
    setBusy(true);
    setError(null);
    try {
      await companiesApi.createStackItem(company.id, {
        name: name.trim(),
        type,
        description: description.trim() || null,
        confirm_create_duplicate: force,
      });
      setConflict(null);
      setName("");
      setDescription("");
      onChanged();
    } catch (err) {
      const dup = asDuplicateConflict(err);
      if (dup) {
        setConflict(dup);
        return;
      }
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(item: CompanyStackItem) {
    setEditTarget(item);
    setEditName(item.name);
    setEditType(item.type);
    setEditDescription(item.description ?? "");
    setEditError(null);
  }

  async function saveEdit() {
    if (!editTarget) return;
    setEditBusy(true);
    setEditError(null);
    try {
      await companiesApi.updateStackItem(editTarget.id, {
        name: editName.trim(),
        type: editType,
        description: editDescription.trim() || null,
      });
      setEditTarget(null);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setEditError(errorMessage(err));
    } finally {
      setEditBusy(false);
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await companiesApi.deleteStackItem(deleteTarget.id);
      setDeleteTarget(null);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setDeleteError(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stack</CardTitle>
      </CardHeader>
      <CardContent>
        <Banner kind="error">{error}</Banner>
        {conflict && (
          <div className="mb-4">
            <DuplicateWarning
              conflict={conflict}
              busy={busy}
              exactIsFinal
              onOpen={() => {}}
              onForce={() => addItem(true)}
            />
          </div>
        )}
        {company.stack.length === 0 ? (
          <EmptyState>No stack items yet.</EmptyState>
        ) : (
          <Table className="table-reflow mb-4">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {company.stack.map((item) => (
                <TableRow key={item.id}>
                  <TableCell data-label="Name">{item.name}</TableCell>
                  <TableCell data-label="Type">
                    <Badge variant="outline">
                      {STACK_ITEM_TYPES.find((t) => t.value === item.type)?.label ?? item.type}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Description" className="whitespace-normal">
                    {item.description || "—"}
                  </TableCell>
                  <TableCell data-label="" className="space-x-2">
                    {writable && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                          Edit
                        </Button>
                        {canDelete(user, "companies") && (
                          <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(item)}>
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {writable && (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              addItem(false);
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <Field>
              <FieldLabel htmlFor="stack-name">Name</FieldLabel>
              <Input id="stack-name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="stack-type">Type</FieldLabel>
              <Select value={type} onValueChange={(v) => setType(v as StackItemType)}>
                <SelectTrigger id="stack-type" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STACK_ITEM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="min-w-40 flex-1">
              <FieldLabel htmlFor="stack-description">Description</FieldLabel>
              <Input
                id="stack-description"
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
              />
            </Field>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Adding…" : "Add"}
            </Button>
          </form>
        )}
      </CardContent>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              saveEdit();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Edit stack item</DialogTitle>
            </DialogHeader>
            <Banner kind="error">{editError}</Banner>
            <Field>
              <FieldLabel htmlFor="stack-edit-name">Name</FieldLabel>
              <Input
                id="stack-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.currentTarget.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="stack-edit-type">Type</FieldLabel>
              <Select value={editType} onValueChange={(v) => setEditType(v as StackItemType)}>
                <SelectTrigger id="stack-edit-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STACK_ITEM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="stack-edit-description">Description</FieldLabel>
              <Textarea
                id="stack-edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.currentTarget.value)}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)} disabled={editBusy}>
                Cancel
              </Button>
              <Button type="submit" disabled={editBusy || !editName.trim()}>
                {editBusy ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
          </AlertDialogHeader>
          <Banner kind="error">{deleteError}</Banner>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                doDelete();
              }}
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ContactsCard({ company }: { company: CompanyDetail }) {
  const { user } = useStore();
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Contacts</CardTitle>
        {canWrite(user, "contacts") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => store.navigate("contact-create", { companyId: company.id })}
          >
            Add contact
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {company.contacts.length === 0 ? (
          <EmptyState>No contacts yet.</EmptyState>
        ) : (
          <ul className="space-y-1 text-sm">
            {company.contacts.map((contact) => {
              const name = [contact.last_name, contact.first_name].filter(Boolean).join(", ") || contact.email || "—";
              return (
                <li key={contact.id}>
                  <Item size="sm" className="p-0">
                    <button
                      type="button"
                      className="text-primary underline underline-offset-4"
                      onClick={() => store.navigate("contact", { id: contact.id })}
                    >
                      {name}
                    </button>
                  </Item>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ApplicationsCard({ company }: { company: CompanyDetail }) {
  const { user } = useStore();
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Applications</CardTitle>
        {canWrite(user, "applications") && (
          <CardAction>
            <Button
              size="sm"
              variant="outline"
              onClick={() => store.openEventComposer({ companyId: company.id })}
            >
              New event
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {company.recent_applications.length === 0 ? (
          <EmptyState>No applications yet.</EmptyState>
        ) : (
          <ul className="space-y-1 text-sm">
            {company.recent_applications.map((app) => (
              <li key={app.id}>
                <Item size="sm" className="p-0">
                  <button
                    type="button"
                    className="text-primary underline underline-offset-4"
                    onClick={() => store.navigate("application", { id: app.id })}
                  >
                    {app.job_title || "Untitled application"}
                  </button>
                  <Badge variant={applicationStatusVariant(app.status)}>{app.status_label}</Badge>
                  {app.date_submitted && (
                    <span className="text-muted-foreground"><DateText value={app.date_submitted} /></span>
                  )}
                </Item>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
