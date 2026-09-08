import { type FormEvent, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CompanyPicker } from "@/features/tracking/CompanyPicker";
import { DuplicateWarning } from "@/features/tracking/DuplicateWarning";
import * as applicationsApi from "@/lib/api/applications";
import { ApiError, errorMessage } from "@/lib/api/client";
import { asDuplicateConflict, type DuplicateConflict } from "@/lib/api/tracking";
import { store } from "@/store/store";

export function CreateApplicationView() {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [jobCode, setJobCode] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("");
  const [system, setSystem] = useState("");
  const [dateSubmitted, setDateSubmitted] = useState("");
  const [resumeLabel, setResumeLabel] = useState("");
  const [initialPromptText, setInitialPromptText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [manuallyModified, setManuallyModified] = useState(false);
  const [modificationNote, setModificationNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DuplicateConflict | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(force = false) {
    if (companyId === null) {
      setError("Choose a company first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await applicationsApi.createApplication({
        company_id: companyId,
        job_title: jobTitle.trim() || null,
        job_code: jobCode.trim() || null,
        url: url.trim() || null,
        source: source.trim() || null,
        system: system.trim() || null,
        date_submitted: dateSubmitted || null,
        resume_label: resumeLabel.trim() || null,
        initial_prompt_text: initialPromptText.trim() || null,
        job_description: jobDescription.trim() || null,
        manually_modified: manuallyModified,
        modification_note: manuallyModified ? modificationNote.trim() || null : null,
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
    <div>
      <h2 className="mb-4 text-xl font-semibold">New application</h2>
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
        <div className="space-y-1.5">
          <Label>Company</Label>
          <CompanyPicker value={companyId} onChange={(id) => setCompanyId(id)} allowCreate />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="app-title">Job title</Label>
          <Input id="app-title" value={jobTitle} onChange={(e) => setJobTitle(e.currentTarget.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="app-code">Job code</Label>
          <Input
            id="app-code"
            value={jobCode}
            onChange={(e) => setJobCode(e.currentTarget.value)}
            placeholder="REQ-12345"
          />
          <p className="text-xs text-muted-foreground">
            Optional. The requisition code from the posting or the recruiter — it is what
            identifies the same job if it reaches you again through someone else.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="app-url">URL</Label>
          <Input id="app-url" type="url" value={url} onChange={(e) => setUrl(e.currentTarget.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="app-source">Source</Label>
            <Input id="app-source" value={source} onChange={(e) => setSource(e.currentTarget.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app-system">System</Label>
            <Input id="app-system" value={system} onChange={(e) => setSystem(e.currentTarget.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="app-date">Date submitted</Label>
          <Input
            id="app-date"
            type="date"
            value={dateSubmitted}
            onChange={(e) => setDateSubmitted(e.currentTarget.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="app-resume-label">Resume label</Label>
          <Input id="app-resume-label" value={resumeLabel} onChange={(e) => setResumeLabel(e.currentTarget.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="app-prompt">Initial prompt text</Label>
          <Textarea
            id="app-prompt"
            value={initialPromptText}
            onChange={(e) => setInitialPromptText(e.currentTarget.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="app-description">Job description</Label>
          <Textarea
            id="app-description"
            className="min-h-40"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.currentTarget.value)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="app-manual" className="mb-0">
            Manually modified
          </Label>
          <Switch id="app-manual" checked={manuallyModified} onCheckedChange={setManuallyModified} />
        </div>
        {manuallyModified && (
          <div className="space-y-1.5">
            <Label htmlFor="app-mod-note">Modification note</Label>
            <Textarea
              id="app-mod-note"
              value={modificationNote}
              onChange={(e) => setModificationNote(e.currentTarget.value)}
            />
          </div>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={busy || companyId === null}>
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
