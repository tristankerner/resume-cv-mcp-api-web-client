import { type FormEvent, useEffect, useRef, useState } from "react";

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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CompanyPicker } from "@/features/tracking/CompanyPicker";
import { HistoryPanel } from "@/features/tracking/HistoryPanel";
import * as applicationsApi from "@/lib/api/applications";
import type {
  ApplicationDetail,
  ApplicationEvent,
  AttachmentMeta,
  DocumentRef,
  EventMutationResponse,
} from "@/lib/api/applications";
import { ApiError, errorMessage } from "@/lib/api/client";
import * as contactsApi from "@/lib/api/contacts";
import type { Contact } from "@/lib/api/contacts";
import { canDelete, canWrite } from "@/lib/auth/scopes";
import { APPLICATION_STATUSES, ATTACHMENT_KINDS, type ApplicationStatus, type AttachmentKind, type DocType } from "@/lib/config";
import { applicationStatusVariant, labelFor } from "@/lib/tracking/labels";
import { downloadBase64, encodeFile, formatBytes } from "@/lib/tracking/files";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";
import { safeHref } from "@/lib/tracking/links";

const NO_SELECTION = "__none__";

export function ApplicationDetailView({ id }: { id: number }) {
  const { user } = useStore();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setApplication(await applicationsApi.getApplication(id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function doDelete() {
    if (!application) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await applicationsApi.deleteApplication(application.id);
      store.navigate("applications");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setDeleteError(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (error) return <Banner kind="error">{error}</Banner>;
  if (application === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {application.job_title || "Untitled application"}
            <Badge variant={applicationStatusVariant(application.status)}>{application.status_label}</Badge>
          </span>
        }
        actions={
          <div className="flex gap-2">
            {!editing && canWrite(user, "applications") && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {canDelete(user, "applications") && (
              <Button variant="destructive" onClick={() => setShowDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        }
      />

      <DetailsCard application={application} editing={editing} onEditToggle={setEditing} onChanged={setApplication} />
      <SameJobCodeCard application={application} />
      <EventsCard application={application} onChanged={setApplication} />
      <AttachmentsCard application={application} onChanged={setApplication} />

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoryPanel table="applications" rowId={application.id} />
        </CardContent>
      </Card>

      <AlertDialog open={showDelete} onOpenChange={(open) => !open && setShowDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this application?</AlertDialogTitle>
            <AlertDialogDescription>
              Its events and attachments are deleted with it. This cannot be undone.
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

function DocumentRefLine({ label, docType, ref }: { label: string; docType: DocType; ref: DocumentRef | null }) {
  if (!ref) {
    return (
      <div>
        {label}: —
      </div>
    );
  }
  return (
    <div>
      {label}:{" "}
      <button
        type="button"
        className="text-primary underline underline-offset-4"
        onClick={() => store.navigate("edit", { type: docType, name: ref.name })}
      >
        {ref.name} @ revision {ref.revision_id}
      </button>
    </div>
  );
}

function resolveDocRef(
  name: string,
  revision: string,
  original: DocumentRef | null,
): { name: string | null; revision: number | null } | null {
  const trimmed = name.trim();
  if (trimmed === "") return original ? { name: null, revision: null } : null;
  const parsed = Number(revision);
  return { name: trimmed, revision: Number.isFinite(parsed) ? parsed : (original?.revision_id ?? null) };
}

function SameJobCodeCard({ application }: { application: ApplicationDetail }) {
  // Rendered only when the code is actually shared. A card saying "no other
  // applications carry this code" on every single application would be noise
  // on the screen the user looks at most.
  if (application.related_by_job_code.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Same job code</CardTitle>
      </CardHeader>
      <CardContent>
        <Banner kind="warn">
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{application.job_code}</code> is
          on {application.related_by_job_code.length + 1} applications. The same job has reached
          you more than once — most often two recruiters putting the same requisition forward.
        </Banner>
        <Table className="table-reflow">
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Job title</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {application.related_by_job_code.map((other) => (
              <TableRow key={other.id}>
                <TableCell data-label="Company">{other.company_name}</TableCell>
                <TableCell data-label="Job title" className="whitespace-normal">
                  {other.job_title || "—"}
                </TableCell>
                <TableCell data-label="Source">{other.source || "—"}</TableCell>
                <TableCell data-label="Submitted">{other.date_submitted || "—"}</TableCell>
                <TableCell data-label="Status">
                  <Badge variant="outline">{other.status_label}</Badge>
                </TableCell>
                <TableCell data-label="">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => store.navigate("application", { id: other.id })}
                  >
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DetailsCard({
  application,
  editing,
  onEditToggle,
  onChanged,
}: {
  application: ApplicationDetail;
  editing: boolean;
  onEditToggle: (editing: boolean) => void;
  onChanged: (a: ApplicationDetail) => void;
}) {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("");
  const [system, setSystem] = useState("");
  const [dateSubmitted, setDateSubmitted] = useState("");
  const [resumeLabel, setResumeLabel] = useState("");
  const [resumeDocName, setResumeDocName] = useState("");
  const [resumeDocRevision, setResumeDocRevision] = useState("");
  const [metadataDocName, setMetadataDocName] = useState("");
  const [metadataDocRevision, setMetadataDocRevision] = useState("");
  const [skillDocName, setSkillDocName] = useState("");
  const [skillDocRevision, setSkillDocRevision] = useState("");
  const [initialPromptText, setInitialPromptText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobCode, setJobCode] = useState("");
  const [manuallyModified, setManuallyModified] = useState(false);
  const [modificationNote, setModificationNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The parent owns the Edit button (it sits in the page header next to
  // Delete), so this seeds the draft fields whenever editing turns on rather
  // than in a click handler local to this card.
  useEffect(() => {
    if (!editing) return;
    setCompanyId(application.company_id);
    setJobTitle(application.job_title ?? "");
    setJobCode(application.job_code ?? "");
    setUrl(application.url ?? "");
    setSource(application.source ?? "");
    setSystem(application.system ?? "");
    setDateSubmitted(application.date_submitted ?? "");
    setResumeLabel(application.resume_label ?? "");
    setResumeDocName(application.resume_document?.name ?? "");
    setResumeDocRevision(application.resume_document ? String(application.resume_document.revision_id) : "");
    setMetadataDocName(application.metadata_document?.name ?? "");
    setMetadataDocRevision(application.metadata_document ? String(application.metadata_document.revision_id) : "");
    setSkillDocName(application.skill_document?.name ?? "");
    setSkillDocRevision(application.skill_document ? String(application.skill_document.revision_id) : "");
    setInitialPromptText(application.initial_prompt_text ?? "");
    setJobDescription(application.job_description ?? "");
    setManuallyModified(application.manually_modified);
    setModificationNote(application.modification_note ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (companyId === null) return;
    setBusy(true);
    setError(null);
    const resumeRef = resolveDocRef(resumeDocName, resumeDocRevision, application.resume_document);
    const metadataRef = resolveDocRef(metadataDocName, metadataDocRevision, application.metadata_document);
    const skillRef = resolveDocRef(skillDocName, skillDocRevision, application.skill_document);
    try {
      const updated = await applicationsApi.updateApplication(application.id, {
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
        ...(resumeRef ? { resume_document_name: resumeRef.name, resume_revision_id: resumeRef.revision } : {}),
        ...(metadataRef
          ? { metadata_document_name: metadataRef.name, metadata_revision_id: metadataRef.revision }
          : {}),
        ...(skillRef ? { skill_document_name: skillRef.name, skill_revision_id: skillRef.revision } : {}),
      });
      onChanged(updated);
      onEditToggle(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Banner kind="error">{error}</Banner>
        {editing ? (
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <CompanyPicker
                value={companyId}
                valueLabel={application.company_name}
                onChange={(companyIdValue) => setCompanyId(companyIdValue)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-app-title">Job title</Label>
              <Input id="edit-app-title" value={jobTitle} onChange={(e) => setJobTitle(e.currentTarget.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-app-code">Job code</Label>
              <Input
                id="edit-app-code"
                value={jobCode}
                onChange={(e) => setJobCode(e.currentTarget.value)}
                placeholder="REQ-12345"
              />
              <p className="text-xs text-muted-foreground">
                The requisition code, if the posting or recruiter gives one. Matching ignores
                case and separators, so there is no need to tidy it up.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-app-url">URL</Label>
              <Input id="edit-app-url" type="url" value={url} onChange={(e) => setUrl(e.currentTarget.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-app-source">Source</Label>
                <Input id="edit-app-source" value={source} onChange={(e) => setSource(e.currentTarget.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-app-system">System</Label>
                <Input id="edit-app-system" value={system} onChange={(e) => setSystem(e.currentTarget.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-app-date">Date submitted</Label>
              <Input
                id="edit-app-date"
                type="date"
                value={dateSubmitted}
                onChange={(e) => setDateSubmitted(e.currentTarget.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-app-resume-label">Resume label</Label>
              <Input
                id="edit-app-resume-label"
                value={resumeLabel}
                onChange={(e) => setResumeLabel(e.currentTarget.value)}
              />
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Document references</p>
              <p className="text-sm text-muted-foreground">
                Usually set by the MCP tooling. Clear a name to remove the reference.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Resume document name"
                  value={resumeDocName}
                  onChange={(e) => setResumeDocName(e.currentTarget.value)}
                />
                <Input
                  placeholder="Revision #"
                  type="number"
                  value={resumeDocRevision}
                  onChange={(e) => setResumeDocRevision(e.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Metadata document name"
                  value={metadataDocName}
                  onChange={(e) => setMetadataDocName(e.currentTarget.value)}
                />
                <Input
                  placeholder="Revision #"
                  type="number"
                  value={metadataDocRevision}
                  onChange={(e) => setMetadataDocRevision(e.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Skill document name"
                  value={skillDocName}
                  onChange={(e) => setSkillDocName(e.currentTarget.value)}
                />
                <Input
                  placeholder="Revision #"
                  type="number"
                  value={skillDocRevision}
                  onChange={(e) => setSkillDocRevision(e.currentTarget.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-app-prompt">Initial prompt text</Label>
              <Textarea
                id="edit-app-prompt"
                value={initialPromptText}
                onChange={(e) => setInitialPromptText(e.currentTarget.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-app-description">Job description</Label>
              <Textarea
                id="edit-app-description"
                className="min-h-40"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.currentTarget.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-app-manual" className="mb-0">
                Manually modified
              </Label>
              <Switch id="edit-app-manual" checked={manuallyModified} onCheckedChange={setManuallyModified} />
            </div>
            {manuallyModified && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-app-mod-note">Modification note</Label>
                <Textarea
                  id="edit-app-mod-note"
                  value={modificationNote}
                  onChange={(e) => setModificationNote(e.currentTarget.value)}
                />
              </div>
            )}
            <div className="flex gap-3">
              <Button type="submit" disabled={busy || companyId === null}>
                {busy ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => onEditToggle(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Company</dt>
              <dd>
                <button
                  type="button"
                  className="text-primary underline underline-offset-4"
                  onClick={() => store.navigate("company", { id: application.company_id })}
                >
                  {application.company_name}
                </button>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Job code</dt>
              <dd>
                {application.job_code ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">
                      {application.job_code}
                    </code>
                    {application.job_code_match_count > 0 && (
                      <Badge variant="warning">
                        on {application.job_code_match_count + 1} applications
                      </Badge>
                    )}
                  </span>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">URL</dt>
              <dd>
                {safeHref(application.url) ? (
                  <a
                    href={safeHref(application.url)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary underline underline-offset-4"
                  >
                    {application.url}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Source</dt>
              <dd>{application.source || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">System</dt>
              <dd>{application.system || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Date submitted</dt>
              <dd>{application.date_submitted || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={applicationStatusVariant(application.status)}>{application.status_label}</Badge>
                <span className="ml-2 text-xs text-muted-foreground">Set by the most recent event.</span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Documents</dt>
              <dd className="space-y-1">
                <DocumentRefLine label="Resume" docType="resume" ref={application.resume_document} />
                <DocumentRefLine label="Metadata" docType="metadata" ref={application.metadata_document} />
                <DocumentRefLine label="Skill" docType="skill" ref={application.skill_document} />
                {application.resume_label && (
                  <p className="text-muted-foreground">{application.resume_label}</p>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Initial prompt text</dt>
              <dd className="whitespace-pre-wrap">{application.initial_prompt_text || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Job description</dt>
              <dd className="whitespace-pre-wrap">{application.job_description || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Manually modified</dt>
              <dd>{application.manually_modified ? "Yes" : "No"}</dd>
            </div>
            {application.manually_modified && (
              <div>
                <dt className="text-muted-foreground">Modification note</dt>
                <dd className="whitespace-pre-wrap">{application.modification_note || "—"}</dd>
              </div>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function EventsCard({
  application,
  onChanged,
}: {
  application: ApplicationDetail;
  onChanged: (a: ApplicationDetail) => void;
}) {
  const { user } = useStore();
  const writable = canWrite(user, "applications");
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<ApplicationEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApplicationEvent | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    contactsApi.listContacts({ company_id: application.company_id, limit: 200 }).then(
      (resp) => setContacts(resp.data),
      () => {},
    );
  }, [application.company_id]);

  function applyMutation(resp: EventMutationResponse, removedId?: number) {
    let events = application.events;
    if (removedId !== undefined) {
      events = events.filter((e) => e.id !== removedId);
    } else if (resp.event) {
      const exists = events.some((e) => e.id === resp.event!.id);
      events = exists ? events.map((e) => (e.id === resp.event!.id ? resp.event! : e)) : [resp.event, ...events];
    }
    onChanged({
      ...application,
      events,
      status: resp.application_status,
      status_label: resp.application_status_label,
      status_changed_at: resp.application_status_changed_at,
      event_count: events.length,
    });
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const resp = await applicationsApi.deleteEvent(deleteTarget.id);
      applyMutation(resp, deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Events</CardTitle>
        {writable && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            Add event
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {application.events.length === 0 ? (
          <EmptyState>No events yet.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {application.events.map((event) => (
              <li key={event.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {event.status && (
                    <Badge variant={applicationStatusVariant(event.status)}>{event.status_label}</Badge>
                  )}
                  <span className="text-muted-foreground">{new Date(event.occurred_at).toLocaleString()}</span>
                  {event.rating != null && <span className="text-muted-foreground">{event.rating}/10</span>}
                  {event.contact_name && <span className="text-muted-foreground">{event.contact_name}</span>}
                  {writable && (
                    <span className="ml-auto flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditTarget(event)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(event)}>
                        Delete
                      </Button>
                    </span>
                  )}
                </div>
                {event.description && <p className="mt-2 whitespace-pre-wrap">{event.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {showAdd && (
        <EventDialog
          contacts={contacts}
          onClose={() => setShowAdd(false)}
          onSubmit={async (body) => {
            const resp = await applicationsApi.createEvent(application.id, body);
            applyMutation(resp);
            setShowAdd(false);
          }}
        />
      )}
      {editTarget && (
        <EventDialog
          contacts={contacts}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={async (body) => {
            const resp = await applicationsApi.updateEvent(editTarget.id, body);
            applyMutation(resp);
            setEditTarget(null);
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
          </AlertDialogHeader>
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

function EventDialog({
  contacts,
  initial,
  onClose,
  onSubmit,
}: {
  contacts: Contact[];
  initial?: ApplicationEvent;
  onClose: () => void;
  onSubmit: (body: applicationsApi.CreateEventRequest) => Promise<void>;
}) {
  const [status, setStatus] = useState<string>(initial?.status ?? NO_SELECTION);
  const [occurredAt, setOccurredAt] = useState(
    initial ? initial.occurred_at.slice(0, 16) : new Date().toISOString().slice(0, 16),
  );
  const [contactId, setContactId] = useState(initial?.contact_id != null ? String(initial.contact_id) : NO_SELECTION);
  const [rating, setRating] = useState(initial?.rating != null ? String(initial.rating) : NO_SELECTION);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = status !== NO_SELECTION || description.trim() !== "" || rating !== NO_SELECTION;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError("Set a status, a description, or a rating.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        status: status === NO_SELECTION ? null : (status as ApplicationStatus),
        contact_id: contactId === NO_SELECTION ? null : Number(contactId),
        description: description.trim() || null,
        rating: rating === NO_SELECTION ? null : Number(rating),
        occurred_at: occurredAt.length === 16 ? `${occurredAt}:00` : occurredAt,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{initial ? "Edit event" : "Add event"}</DialogTitle>
          </DialogHeader>
          <Banner kind="error">{error}</Banner>
          <div className="space-y-1.5">
            <Label htmlFor="event-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="event-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SELECTION}>— no status change —</SelectItem>
                {APPLICATION_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-occurred">Occurred at</Label>
            <Input
              id="event-occurred"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.currentTarget.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-contact">Contact</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger id="event-contact" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SELECTION}>— none —</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {[c.last_name, c.first_name].filter(Boolean).join(", ") || c.email || `Contact #${c.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-rating">Rating</Label>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger id="event-rating" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SELECTION}>— none —</SelectItem>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : initial ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentsCard({
  application,
  onChanged,
}: {
  application: ApplicationDetail;
  onChanged: (a: ApplicationDetail) => void;
}) {
  const { user } = useStore();
  const writable = canWrite(user, "applications");
  const [kind, setKind] = useState<AttachmentKind>(ATTACHMENT_KINDS[0].value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AttachmentMeta | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const encoded = await encodeFile(file);
      const meta = await applicationsApi.uploadAttachment(application.id, {
        kind,
        filename: encoded.filename,
        content_type: encoded.contentType,
        content_base64: encoded.base64,
      });
      onChanged({
        ...application,
        attachments: [...application.attachments, meta],
        attachment_count: application.attachment_count + 1,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function download(attachment: AttachmentMeta) {
    setError(null);
    try {
      const full = await applicationsApi.getAttachment(attachment.id);
      downloadBase64(full.filename, full.content_type, full.content_base64);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await applicationsApi.deleteAttachment(deleteTarget.id);
      onChanged({
        ...application,
        attachments: application.attachments.filter((a) => a.id !== deleteTarget.id),
        attachment_count: application.attachment_count - 1,
      });
      setDeleteTarget(null);
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
        <CardTitle>Attachments</CardTitle>
      </CardHeader>
      <CardContent>
        <Banner kind="error">{error}</Banner>
        {application.attachments.length === 0 ? (
          <EmptyState>No attachments yet.</EmptyState>
        ) : (
          <Table className="table-reflow mb-4">
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Filename</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {application.attachments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell data-label="Kind">
                    <Badge variant="outline">{labelFor(ATTACHMENT_KINDS, a.kind)}</Badge>
                  </TableCell>
                  <TableCell data-label="Filename" className="whitespace-normal">
                    {a.filename}
                  </TableCell>
                  <TableCell data-label="Size">{formatBytes(a.byte_size)}</TableCell>
                  <TableCell data-label="Uploaded">{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell data-label="" className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => download(a)}>
                      Download
                    </Button>
                    {canDelete(user, "applications") && (
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(a)}>
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {writable && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="attachment-kind">Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as AttachmentKind)}>
                <SelectTrigger id="attachment-kind" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTACHMENT_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attachment-file">File</Label>
              <Input
                id="attachment-file"
                type="file"
                accept=".pdf,.docx"
                ref={fileInputRef}
                disabled={busy}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) upload(file);
                }}
              />
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.filename}&rdquo;?</AlertDialogTitle>
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
