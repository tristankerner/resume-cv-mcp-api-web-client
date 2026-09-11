import { type FormEvent, useEffect, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { DetailList, DetailRow } from "@/components/common/DetailList";
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
import { Spinner } from "@/components/ui/spinner";
import { ContactFields, contactDraftValid, emptyContactDraft, type ContactDraft } from "@/features/tracking/fields/ContactFields";
import { HistoryPanel } from "@/features/tracking/HistoryPanel";
import { useRefreshOn } from "@/hooks/useRefreshOn";
import { ApiError, errorMessage } from "@/lib/api/client";
import * as contactsApi from "@/lib/api/contacts";
import type { Contact } from "@/lib/api/contacts";
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

  const [draft, setDraft] = useState<ContactDraft>(() => emptyContactDraft());
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

  useEffect(() => {
    if (!contact) {
      store.setCrumb(null);
      return;
    }
    store.setCrumb([contact.last_name, contact.first_name].filter(Boolean).join(", ") || contact.email || "Contact");
  }, [contact]);

  useRefreshOn(["contacts"], load);

  function startEdit() {
    if (!contact) return;
    setDraft({
      company_id: contact.company_id,
      company_name: contact.company_name ?? "",
      first_name: contact.first_name ?? "",
      last_name: contact.last_name ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      rating: contact.rating != null ? String(contact.rating) : "",
      description: contact.description ?? "",
      personal_note: contact.personal_note ?? "",
    });
    setSaveError(null);
    setEditing(true);
  }

  const valid = contactDraftValid(draft);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!contact) return;
    setBusy(true);
    setSaveError(null);
    try {
      const updated = await contactsApi.updateContact(contact.id, {
        company_id: draft.company_id,
        first_name: draft.first_name.trim() || null,
        last_name: draft.last_name.trim() || null,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        rating: draft.rating ? Number(draft.rating) : null,
        description: draft.description.trim() || null,
        personal_note: draft.personal_note.trim() || null,
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
  if (contact === null) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</p>;

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
              <ContactFields value={draft} onChange={setDraft} disabled={busy} allowCreateCompany idPrefix="edit" />
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
            <DetailList>
              <DetailRow label="Company">
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
              </DetailRow>
              <DetailRow label="Email">{contact.email || "—"}</DetailRow>
              <DetailRow label="Phone">{contact.phone || "—"}</DetailRow>
              <DetailRow label="Rating">{contact.rating != null ? `${contact.rating}/10` : "—"}</DetailRow>
              <DetailRow label="Description" className="max-w-prose whitespace-pre-wrap">
                {contact.description || "—"}
              </DetailRow>
              <DetailRow label="Personal note" className="max-w-prose whitespace-pre-wrap">
                {contact.personal_note || "—"}
              </DetailRow>
            </DetailList>
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
