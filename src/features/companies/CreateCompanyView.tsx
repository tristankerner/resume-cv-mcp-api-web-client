import { type FormEvent, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DuplicateWarning } from "@/features/tracking/DuplicateWarning";
import * as companiesApi from "@/lib/api/companies";
import { ApiError, errorMessage } from "@/lib/api/client";
import { asDuplicateConflict, type DuplicateConflict } from "@/lib/api/tracking";
import { store } from "@/store/store";

export function CreateCompanyView() {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DuplicateConflict | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(force: boolean) {
    setError(null);
    setConflict(null);
    setBusy(true);
    try {
      const created = await companiesApi.createCompany({
        name: name.trim(),
        website: website.trim() || null,
        description: description.trim() || null,
        personal_note: personalNote.trim() || null,
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
        <Field>
          <FieldLabel htmlFor="company-name">Name</FieldLabel>
          <Input id="company-name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="company-website">Website</FieldLabel>
          <Input
            id="company-website"
            type="url"
            placeholder="https://…"
            value={website}
            onChange={(e) => setWebsite(e.currentTarget.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="company-description">Description</FieldLabel>
          <Textarea
            id="company-description"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="company-note">Personal note</FieldLabel>
          <Textarea
            id="company-note"
            value={personalNote}
            onChange={(e) => setPersonalNote(e.currentTarget.value)}
          />
        </Field>
        <div className="flex gap-3">
          <Button type="submit" disabled={busy || !name.trim()}>
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
