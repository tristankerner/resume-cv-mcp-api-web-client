import { type FormEvent, useEffect, useState } from "react";

import { Banner } from "@/components/common/Banner";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CompanyPicker } from "@/features/tracking/CompanyPicker";
import { HistoryPanel } from "@/features/tracking/HistoryPanel";
import { ApiError, errorMessage } from "@/lib/api/client";
import * as contactsApi from "@/lib/api/contacts";
import type { Contact } from "@/lib/api/contacts";
import { CONTACT_RATING_OPTIONS } from "@/lib/config";
import { canDelete, canWrite } from "@/lib/auth/scopes";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";

export function ContactDetailView({ id }: { id: number }) {
  const { user } = useStore();
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rating, setRating] = useState("");
  const [description, setDescription] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      setContact(await contactsApi.getContact(id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function startEdit() {
    if (!contact) return;
    setCompanyId(contact.company_id);
    setFirstName(contact.first_name ?? "");
    setLastName(contact.last_name ?? "");
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    setRating(contact.rating != null ? String(contact.rating) : "");
    setDescription(contact.description ?? "");
    setPersonalNote(contact.personal_note ?? "");
    setSaveError(null);
    setEditing(true);
  }

  const valid = !!(firstName.trim() || lastName.trim() || email.trim());

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!contact) return;
    setBusy(true);
    setSaveError(null);
    try {
      const updated = await contactsApi.updateContact(contact.id, {
        company_id: companyId,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        rating: rating ? Number(rating) : null,
        description: description.trim() || null,
        personal_note: personalNote.trim() || null,
      });
      setContact(updated);
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setSaveError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!contact) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await contactsApi.deleteContact(contact.id);
      store.navigate("contacts");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setDeleteError(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (error) return <Banner kind="error">{error}</Banner>;
  if (contact === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const name = [contact.last_name, contact.first_name].filter(Boolean).join(", ") || contact.email || "Contact";

  return (
    <div className="space-y-5">
      <PageHeader
        title={name}
        actions={
          canDelete(user, "contacts") && (
            <Button variant="destructive" onClick={() => setShowDelete(true)}>
              Delete
            </Button>
          )
        }
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Details</CardTitle>
          {!editing && canWrite(user, "contacts") && (
            <Button size="sm" variant="outline" onClick={startEdit}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Banner kind="error">{saveError}</Banner>
          {editing ? (
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Company</Label>
                <CompanyPicker
                  value={companyId}
                  valueLabel={contact.company_name}
                  onChange={(id) => setCompanyId(id)}
                  allowCreate
                  allowNone
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-first">First name</Label>
                  <Input id="edit-first" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-last">Last name</Label>
                  <Input id="edit-last" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input id="edit-phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
                </div>
              </div>
              {!valid && (
                <p className="text-sm text-muted-foreground">
                  At least one of first name, last name or email is required.
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="edit-rating">Rating</Label>
                <Select value={rating} onValueChange={setRating}>
                  <SelectTrigger id="edit-rating" className="w-full">
                    <SelectValue placeholder="— none —" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_RATING_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={String(r.value)}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Textarea id="edit-note" value={personalNote} onChange={(e) => setPersonalNote(e.currentTarget.value)} />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={busy || !valid}>
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
                <dt className="text-muted-foreground">Company</dt>
                <dd>
                  {contact.company_id ? (
                    <button
                      type="button"
                      className="text-primary underline underline-offset-4"
                      onClick={() => store.navigate("company", { id: contact.company_id! })}
                    >
                      {contact.company_name}
                    </button>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{contact.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{contact.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Rating</dt>
                <dd>{contact.rating != null ? `${contact.rating}/10` : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Description</dt>
                <dd className="whitespace-pre-wrap">{contact.description || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Personal note</dt>
                <dd className="whitespace-pre-wrap">{contact.personal_note || "—"}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoryPanel table="contacts" rowId={contact.id} />
        </CardContent>
      </Card>

      <AlertDialog open={showDelete} onOpenChange={(open) => !open && setShowDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Any events referencing this contact will keep their history
              but lose the link to it.
            </AlertDialogDescription>
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
    </div>
  );
}
