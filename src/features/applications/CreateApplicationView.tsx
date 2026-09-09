import { type FormEvent, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { DuplicateWarning } from "@/features/tracking/DuplicateWarning";
import {
  ApplicationFields,
  EMPTY_APPLICATION_DRAFT,
  type ApplicationDraft,
} from "@/features/tracking/fields/ApplicationFields";
import * as applicationsApi from "@/lib/api/applications";
import { ApiError, errorMessage } from "@/lib/api/client";
import { asDuplicateConflict, type DuplicateConflict } from "@/lib/api/tracking";
import { store } from "@/store/store";

export function CreateApplicationView() {
  const [draft, setDraft] = useState<ApplicationDraft>(EMPTY_APPLICATION_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DuplicateConflict | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(force = false) {
    if (draft.company_id === null) {
      setError("Choose a company first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await applicationsApi.createApplication({
        company_id: draft.company_id,
        job_title: draft.job_title.trim() || null,
        job_code: draft.job_code.trim() || null,
        url: draft.url.trim() || null,
        source: draft.source.trim() || null,
        system: draft.system.trim() || null,
        date_submitted: draft.date_submitted || null,
        resume_label: draft.resume_label.trim() || null,
        initial_prompt_text: draft.initial_prompt_text.trim() || null,
        job_description: draft.job_description.trim() || null,
        manually_modified: draft.manually_modified,
        modification_note: draft.manually_modified ? draft.modification_note.trim() || null : null,
        confirm_create_duplicate: force,
      });
      store.navigate("application", { id: created.id });
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
      <PageHeader title="New application" />
      <Banner kind="error">{error}</Banner>
      {conflict && (
        <div className="mb-4">
          <DuplicateWarning
            conflict={conflict}
            busy={busy}
            onOpen={(id) => store.navigate("application", { id })}
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
        <ApplicationFields value={draft} onChange={setDraft} disabled={busy} allowCreateCompany />
        <div className="flex gap-3">
          <Button type="submit" disabled={busy || draft.company_id === null}>
            {busy ? "Creating…" : "Create"}
          </Button>
          <Button type="button" variant="outline" onClick={() => store.navigate("applications")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
