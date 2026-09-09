import { useState } from "react";

import { Banner } from "@/components/common/Banner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { DuplicateWarning } from "@/features/tracking/DuplicateWarning";
import { ContactFields, contactDraftValid, emptyContactDraft, type ContactDraft } from "@/features/tracking/fields/ContactFields";
import { ApiError, errorMessage } from "@/lib/api/client";
import * as contactsApi from "@/lib/api/contacts";
import { asDuplicateConflict, type DuplicateConflict } from "@/lib/api/tracking";
import { store } from "@/store/store";

export function CreateContactView({ companyId }: { companyId?: number }) {
  const [draft, setDraft] = useState<ContactDraft>(() => emptyContactDraft(companyId));
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DuplicateConflict | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = contactDraftValid(draft);

  async function submit(force = false) {
    setBusy(true);
    setError(null);
    try {
      const created = await contactsApi.createContact({
        company_id: draft.company_id,
        first_name: draft.first_name.trim() || null,
        last_name: draft.last_name.trim() || null,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        rating: draft.rating ? Number(draft.rating) : null,
        description: draft.description.trim() || null,
        personal_note: draft.personal_note.trim() || null,
        confirm_create_duplicate: force,
      });
      store.navigate("contact", { id: created.id });
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
    <div className="max-w-3xl">
      <PageHeader title="New contact" />
      <Banner kind="error">{error}</Banner>
      {conflict && (
        <div className="mb-4">
          <DuplicateWarning
            conflict={conflict}
            busy={busy}
            onOpen={(id) => store.navigate("contact", { id })}
            onForce={() => submit(true)}
          />
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
        className="space-y-4"
      >
        <ContactFields value={draft} onChange={setDraft} disabled={busy} allowCreateCompany />
        <div className="flex gap-3">
          <Button type="submit" disabled={busy || !valid}>
            {busy ? "Creating…" : "Create"}
          </Button>
          <Button type="button" variant="outline" onClick={() => store.navigate("contacts")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
