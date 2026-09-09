import { type FormEvent, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { DuplicateWarning } from "@/features/tracking/DuplicateWarning";
import { CompanyFields, EMPTY_COMPANY_DRAFT, type CompanyDraft } from "@/features/tracking/fields/CompanyFields";
import * as companiesApi from "@/lib/api/companies";
import { ApiError, errorMessage } from "@/lib/api/client";
import { asDuplicateConflict, type DuplicateConflict } from "@/lib/api/tracking";
import { store } from "@/store/store";

export function CreateCompanyView() {
  const [draft, setDraft] = useState<CompanyDraft>(EMPTY_COMPANY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DuplicateConflict | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(force: boolean) {
    setError(null);
    setConflict(null);
    setBusy(true);
    try {
      const created = await companiesApi.createCompany({
        name: draft.name.trim(),
        website: draft.website.trim() || null,
        description: draft.description.trim() || null,
        personal_note: draft.personal_note.trim() || null,
        confirm_create_duplicate: force,
      });
      store.navigate("company", { id: created.id });
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
      <PageHeader title="New company" />
      <Banner kind="error">{error}</Banner>
      {conflict && (
        <div className="mb-4">
          <DuplicateWarning
            conflict={conflict}
            busy={busy}
            onOpen={(id) => store.navigate("company", { id })}
            onForce={() => submit(true)}
          />
        </div>
      )}
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submit(false);
        }}
        className="space-y-4"
      >
        <CompanyFields value={draft} onChange={setDraft} disabled={busy} />
        <div className="flex gap-3">
          <Button type="submit" disabled={busy || !draft.name.trim()}>
            {busy ? "Creating…" : "Create"}
          </Button>
          <Button type="button" variant="outline" onClick={() => store.navigate("companies")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
