import { type FormEvent, useEffect, useRef, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { DateText, DateTimeText } from "@/components/common/DateTime";
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
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ApplicationFields,
  EMPTY_APPLICATION_DRAFT,
  type ApplicationDraft,
} from "@/features/tracking/fields/ApplicationFields";
import {
  EventFields,
  NO_SELECTION,
  emptyEventDraft,
  eventDraftToStatus,
  eventDraftValid,
  type EventDraft,
} from "@/features/tracking/fields/EventFields";
import { DuplicateWarning } from "@/features/tracking/DuplicateWarning";
import { HistoryPanel } from "@/features/tracking/HistoryPanel";
import { useRefreshOn } from "@/hooks/useRefreshOn";
import * as applicationsApi from "@/lib/api/applications";
import type {
  ApplicationDetail,
  ApplicationEvent,
  AttachmentMeta,
  DocumentRef,
  EventMutationResponse,
} from "@/lib/api/applications";
import { ApiError, errorMessage } from "@/lib/api/client";
import { asDuplicateConflict, type DuplicateConflict } from "@/lib/api/tracking";
import { canDelete, canWrite } from "@/lib/auth/scopes";
import { ATTACHMENT_KINDS, type ApplicationStatus, type AttachmentKind, type DocType } from "@/lib/config";
import { applicationStatusVariant, labelFor } from "@/lib/tracking/labels";
import { downloadBase64, encodeFile, formatBytes } from "@/lib/tracking/files";
import { store } from "@/store/store";
import { useStore } from "@/store/useStore";
import { safeHref } from "@/lib/tracking/links";

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

  useEffect(() => {
    store.setCrumb(application ? application.job_title || "Untitled application" : null);
  }, [application]);

  useRefreshOn(["applications", "events", "attachments"], load);

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
  if (application === null) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</p>;

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
          <ButtonGroup>
            {!editing && canWrite(user, "applications") && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {canDelete(user, "applications") && (
              <Button variant="outline" className="text-destructive" onClick={() => setShowDelete(true)}>
                Delete
              </Button>
            )}
          </ButtonGroup>
        }
      />

      <DetailsCard application={application} editing={editing} onEditToggle={setEditing} onSaved={load} />
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
                <TableCell data-label="Submitted"><DateText value={other.date_submitted} /></TableCell>
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
  onSaved,
}: {
  application: ApplicationDetail;
  editing: boolean;
  onEditToggle: (editing: boolean) => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ApplicationDraft>(EMPTY_APPLICATION_DRAFT);
  const [resumeDocName, setResumeDocName] = useState("");
  const [resumeDocRevision, setResumeDocRevision] = useState("");
  const [metadataDocName, setMetadataDocName] = useState("");
  const [metadataDocRevision, setMetadataDocRevision] = useState("");
  const [skillDocName, setSkillDocName] = useState("");
  const [skillDocRevision, setSkillDocRevision] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DuplicateConflict | null>(null);
  const [busy, setBusy] = useState(false);

  // The parent owns the Edit button (it sits in the page header next to
  // Delete), so this seeds the draft fields whenever editing turns on rather
  // than in a click handler local to this card.
  useEffect(() => {
    if (!editing) return;
    setDraft({
      company_id: application.company_id,
      company_name: application.company_name,
      job_title: application.job_title ?? "",
      job_code: application.job_code ?? "",
      url: application.url ?? "",
      source: application.source ?? "",
      system: application.system ?? "",
      date_submitted: application.date_submitted ?? "",
      resume_label: application.resume_label ?? "",
      initial_prompt_text: application.initial_prompt_text ?? "",
      job_description: application.job_description ?? "",
      manually_modified: application.manually_modified,
      modification_note: application.modification_note ?? "",
    });
    setResumeDocName(application.resume_document?.name ?? "");
    setResumeDocRevision(application.resume_document ? String(application.resume_document.revision_id) : "");
    setMetadataDocName(application.metadata_document?.name ?? "");
    setMetadataDocRevision(application.metadata_document ? String(application.metadata_document.revision_id) : "");
    setSkillDocName(application.skill_document?.name ?? "");
    setSkillDocRevision(application.skill_document ? String(application.skill_document.revision_id) : "");
    setError(null);
    setConflict(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  async function save(force = false) {
    if (draft.company_id === null) return;
    setBusy(true);
    setError(null);
    const resumeRef = resolveDocRef(resumeDocName, resumeDocRevision, application.resume_document);
    const metadataRef = resolveDocRef(metadataDocName, metadataDocRevision, application.metadata_document);
    const skillRef = resolveDocRef(skillDocName, skillDocRevision, application.skill_document);
    try {
      await applicationsApi.updateApplication(application.id, {
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
        ...(resumeRef ? { resume_document_name: resumeRef.name, resume_revision_id: resumeRef.revision } : {}),
        ...(metadataRef
          ? { metadata_document_name: metadataRef.name, metadata_revision_id: metadataRef.revision }
          : {}),
        ...(skillRef ? { skill_document_name: skillRef.name, skill_revision_id: skillRef.revision } : {}),
        confirm_create_duplicate: force,
      });
      setConflict(null);
      onEditToggle(false);
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
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Banner kind="error">{error}</Banner>
        {conflict && (
          <div className="mb-4">
            <DuplicateWarning
              conflict={conflict}
              busy={busy}
              forceLabel="Save anyway"
              onOpen={(id) => store.navigate("application", { id })}
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
            <ApplicationFields
              value={draft}
              onChange={setDraft}
              disabled={busy}
              idPrefix="edit-app"
              hide={["prompt", "description", "manually_modified"]}
            />
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
            <ApplicationFields
              value={draft}
              onChange={setDraft}
              disabled={busy}
              idPrefix="edit-app"
              hide={["company", "job_title", "job_code", "url", "source", "system", "date_submitted", "resume_label"]}
            />
            <div className="flex gap-3">
              <Button type="submit" disabled={busy || draft.company_id === null}>
                {busy ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => onEditToggle(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <DetailList>
            <DetailRow label="Company">
              <button
                type="button"
                className="text-primary underline underline-offset-4"
                onClick={() => store.navigate("company", { id: application.company_id })}
              >
                {application.company_name}
              </button>
            </DetailRow>
            <DetailRow label="Job code">
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
            </DetailRow>
            <DetailRow label="URL">
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
            </DetailRow>
            <DetailRow label="Source">{application.source || "—"}</DetailRow>
            <DetailRow label="System">{application.system || "—"}</DetailRow>
            <DetailRow label="Date submitted"><DateText value={application.date_submitted} /></DetailRow>
            <DetailRow label="Status">
              <Badge variant={applicationStatusVariant(application.status)}>{application.status_label}</Badge>
              <span className="ml-2 text-xs text-muted-foreground">Set by the most recent event.</span>
            </DetailRow>
            <DetailRow label="Documents" className="space-y-1">
              <DocumentRefLine label="Resume" docType="resume" ref={application.resume_document} />
              <DocumentRefLine label="Metadata" docType="metadata" ref={application.metadata_document} />
              <DocumentRefLine label="Skill" docType="skill" ref={application.skill_document} />
              {application.resume_label && (
                <p className="text-muted-foreground">{application.resume_label}</p>
              )}
            </DetailRow>
            <DetailRow label="Initial prompt text" className="max-w-prose whitespace-pre-wrap">
              {application.initial_prompt_text || "—"}
            </DetailRow>
            <DetailRow label="Job description" className="max-w-prose whitespace-pre-wrap">
              {application.job_description || "—"}
            </DetailRow>
            <DetailRow label="Manually modified">{application.manually_modified ? "Yes" : "No"}</DetailRow>
            {application.manually_modified && (
              <DetailRow label="Modification note" className="max-w-prose whitespace-pre-wrap">
                {application.modification_note || "—"}
              </DetailRow>
            )}
          </DetailList>
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
  const [editTarget, setEditTarget] = useState<ApplicationEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApplicationEvent | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function applyEvent(event: ApplicationEvent, status: ApplicationStatus, statusLabel: string, statusChangedAt: string | null) {
    const events = application.events.some((e) => e.id === event.id)
      ? application.events.map((e) => (e.id === event.id ? event : e))
      : [event, ...application.events];
    onChanged({
      ...application,
      events,
      status,
      status_label: statusLabel,
      status_changed_at: statusChangedAt,
      event_count: events.length,
    });
  }

  function applyMutation(resp: EventMutationResponse, removedId?: number) {
    if (removedId !== undefined) {
      const events = application.events.filter((e) => e.id !== removedId);
      onChanged({
        ...application,
        events,
        status: resp.application_status,
        status_label: resp.application_status_label,
        status_changed_at: resp.application_status_changed_at,
        event_count: events.length,
      });
      return;
    }
    if (resp.event) applyEvent(resp.event, resp.application_status, resp.application_status_label, resp.application_status_changed_at);
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
      <CardHeader>
        <CardTitle>Events</CardTitle>
        {writable && (
          <CardAction>
            <Button
              size="sm"
              variant="outline"
              onClick={() => store.openEventComposer({ applicationId: application.id })}
            >
              Add event
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {application.events.length === 0 ? (
          <EmptyState>No events yet.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {application.events.map((event) => (
              <li key={event.id}>
                <Item variant="outline">
                  <ItemContent>
                    <ItemTitle className="font-normal">
                      {event.status && (
                        <Badge variant={applicationStatusVariant(event.status)}>{event.status_label}</Badge>
                      )}
                      <span className="text-muted-foreground"><DateTimeText value={event.occurred_at} /></span>
                      {event.rating != null && <span className="text-muted-foreground">{event.rating}/10</span>}
                      {event.contact_name && <span className="text-muted-foreground">{event.contact_name}</span>}
                    </ItemTitle>
                    {event.description && (
                      <ItemDescription className="whitespace-pre-wrap">{event.description}</ItemDescription>
                    )}
                  </ItemContent>
                  {writable && (
                    <ItemActions>
                      <ButtonGroup>
                        <Button size="sm" variant="outline" onClick={() => setEditTarget(event)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeleteTarget(event)}>
                          Delete
                        </Button>
                      </ButtonGroup>
                    </ItemActions>
                  )}
                </Item>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {editTarget && (
        <EventDialog
          applicationId={application.id}
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
  applicationId,
  initial,
  onClose,
  onSubmit,
}: {
  applicationId: number;
  initial?: ApplicationEvent;
  onClose: () => void;
  onSubmit: (body: applicationsApi.CreateEventRequest) => Promise<void>;
}) {
  const [draft, setDraft] = useState<EventDraft>(() =>
    initial
      ? {
          status: initial.status ?? NO_SELECTION,
          occurred_at: initial.occurred_at,
          contact_id: initial.contact_id,
          contact_label: initial.contact_name ?? "",
          rating: initial.rating != null ? String(initial.rating) : NO_SELECTION,
          description: initial.description ?? "",
        }
      : emptyEventDraft(),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = eventDraftValid(draft);

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
        status: eventDraftToStatus(draft.status),
        contact_id: draft.contact_id,
        description: draft.description.trim() || null,
        rating: draft.rating === NO_SELECTION ? null : Number(draft.rating),
        occurred_at: draft.occurred_at,
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
          <EventFields value={draft} onChange={setDraft} disabled={busy} applicationId={applicationId} modal />
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
                  <TableCell data-label="Uploaded"><DateTimeText value={a.created_at} /></TableCell>
                  <TableCell data-label="">
                    <ButtonGroup>
                      <Button size="sm" variant="outline" onClick={() => download(a)}>
                        Download
                      </Button>
                      {canDelete(user, "applications") && (
                        <Button size="sm" variant="outline" onClick={() => setDeleteTarget(a)}>
                          Delete
                        </Button>
                      )}
                    </ButtonGroup>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {writable && (
          <div className="flex flex-wrap items-end gap-2">
            <Field>
              <FieldLabel htmlFor="attachment-kind">Kind</FieldLabel>
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
            </Field>
            <Field>
              <FieldLabel htmlFor="attachment-file">File</FieldLabel>
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
            </Field>
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
