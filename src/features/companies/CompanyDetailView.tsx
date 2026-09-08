import { type FormEvent, useEffect, useState } from "react";

import { Banner } from "@/components/common/Banner";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CompanyPicker } from "@/features/tracking/CompanyPicker";
import { DuplicateWarning } from "@/features/tracking/DuplicateWarning";
import { HistoryPanel } from "@/features/tracking/HistoryPanel";
import * as companiesApi from "@/lib/api/companies";
import type { CompanyDetail, CompanyRelationship, CompanyStackItem } from "@/lib/api/companies";
import { ApiError, errorMessage } from "@/lib/api/client";
import { asDuplicateConflict, type DuplicateConflict } from "@/lib/api/tracking";
import { canDelete, canWrite } from "@/lib/auth/scopes";
import { COMPANY_RELATIONSHIP_TYPES, STACK_ITEM_TYPES, type CompanyRelationshipType, type StackItemType } from "@/lib/config";
import { applicationStatusVariant, relationshipLabel } from "@/lib/tracking/labels";
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

  if (error) return <Banner kind="error">{error}</Banner>;
  if (company === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      <CompanyHeader company={company} />
      <DetailsCard company={company} onChanged={setCompany} />
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
  onChanged,
}: {
  company: CompanyDetail;
  onChanged: (c: CompanyDetail) => void;
}) {
  const { user } = useStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DuplicateConflict | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit() {
    setName(company.name);
    setWebsite(company.website ?? "");
    setDescription(company.description ?? "");
    setPersonalNote(company.personal_note ?? "");
    setError(null);
    setConflict(null);
    setEditing(true);
  }

  async function save(force = false) {
    setBusy(true);
    setError(null);
    try {
      const updated = await companiesApi.updateCompany(company.id, {
        name: name.trim(),
        website: website.trim() || null,
        description: description.trim() || null,
        personal_note: personalNote.trim() || null,
        confirm_create_duplicate: force,
      });
      onChanged(updated);
      setConflict(null);
      setEditing(false);
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
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-website">Website</Label>
              <Input
                id="edit-website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.currentTarget.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-note">Personal note</Label>
              <Textarea
                id="edit-note"
                value={personalNote}
                onChange={(e) => setPersonalNote(e.currentTarget.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Website</dt>
              <dd>
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
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Description</dt>
              <dd className="whitespace-pre-wrap">{company.description || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Personal note</dt>
              <dd className="whitespace-pre-wrap">{company.personal_note || "—"}</dd>
            </div>
          </dl>
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
                <li key={rel.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                  <div>
                    <span>{relationshipLabel(rel.type, direction, otherName)}</span>
                    {rel.note && <span className="ml-2 text-muted-foreground">{rel.note}</span>}
                  </div>
                  {canDelete(user, "companies") && (
                    <Button size="sm" variant="ghost" onClick={() => setRemoveTarget(rel)}>
                      Remove
                    </Button>
                  )}
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
            <div className="space-y-1.5">
              <Label>Company</Label>
              <CompanyPicker value={toCompanyId} onChange={(id) => setToCompanyId(id)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rel-type">Relationship</Label>
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rel-note">Note</Label>
              <Input id="rel-note" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
            </div>
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
            <DuplicateWarning conflict={conflict} busy={busy} onOpen={() => {}} onForce={() => addItem(true)} />
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
            <div className="space-y-1.5">
              <Label htmlFor="stack-name">Name</Label>
              <Input id="stack-name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stack-type">Type</Label>
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
            </div>
            <div className="min-w-40 flex-1 space-y-1.5">
              <Label htmlFor="stack-description">Description</Label>
              <Input
                id="stack-description"
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
              />
            </div>
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
            <div className="space-y-1.5">
              <Label htmlFor="stack-edit-name">Name</Label>
              <Input
                id="stack-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.currentTarget.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stack-edit-type">Type</Label>
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stack-edit-description">Description</Label>
              <Textarea
                id="stack-edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.currentTarget.value)}
              />
            </div>
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
                  <button
                    type="button"
                    className="text-primary underline underline-offset-4"
                    onClick={() => store.navigate("contact", { id: contact.id })}
                  >
                    {name}
                  </button>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Applications</CardTitle>
      </CardHeader>
      <CardContent>
        {company.recent_applications.length === 0 ? (
          <EmptyState>No applications yet.</EmptyState>
        ) : (
          <ul className="space-y-1 text-sm">
            {company.recent_applications.map((app) => (
              <li key={app.id} className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="text-primary underline underline-offset-4"
                  onClick={() => store.navigate("application", { id: app.id })}
                >
                  {app.job_title || "Untitled application"}
                </button>
                <Badge variant={applicationStatusVariant(app.status)}>{app.status_label}</Badge>
                {app.date_submitted && (
                  <span className="text-muted-foreground">{app.date_submitted}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
