import { useEffect, useState } from "react";

import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DuplicateWarning } from "@/features/tracking/DuplicateWarning";
import { CompanyFields, EMPTY_COMPANY_DRAFT, type CompanyDraft } from "@/features/tracking/fields/CompanyFields";
import {
  ApplicationFields,
  EMPTY_APPLICATION_DRAFT,
  type ApplicationDraft,
} from "@/features/tracking/fields/ApplicationFields";
import {
  ContactFields,
  contactDraftValid,
  emptyContactDraft,
  type ContactDraft,
} from "@/features/tracking/fields/ContactFields";
import {
  EventFields,
  NO_SELECTION,
  emptyEventDraft,
  eventDraftToStatus,
  eventDraftValid,
  type EventDraft,
} from "@/features/tracking/fields/EventFields";
import { ApplicationPicker } from "@/features/tracking/pickers/ApplicationPicker";
import { CompanyPicker } from "@/features/tracking/pickers/CompanyPicker";
import { ContactPicker } from "@/features/tracking/pickers/ContactPicker";
import * as applicationsApi from "@/lib/api/applications";
import type { ApplicationEvent } from "@/lib/api/applications";
import { ApiError, errorMessage } from "@/lib/api/client";
import * as companiesApi from "@/lib/api/companies";
import * as contactsApi from "@/lib/api/contacts";
import { asDuplicateConflict, type DuplicateConflict } from "@/lib/api/tracking";
import type { ApplicationStatus } from "@/lib/config";
import { store } from "@/store/store";

export interface ComposerResult {
  event: ApplicationEvent;
  applicationId: number;
  applicationStatus: ApplicationStatus;
  applicationStatusLabel: string;
  applicationStatusChangedAt: string | null;
  createdCompanyId?: number;
  createdApplicationId?: number;
  createdContactId?: number;
}

export interface EventComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Pins the application and hides the whole Application section.
  applicationId?: number;
  // Seeds the company when creating a new application.
  companyId?: number;
  // Seeds the contact selection.
  contactId?: number;
  onCreated?: (result: ComposerResult) => void;
}

type Section = "company" | "application" | "contact";

interface SectionConflict {
  section: Section;
  conflict: DuplicateConflict;
}

interface CreatedIds {
  companyId: number | null;
  applicationId: number | null;
  contactId: number | null;
}

const EMPTY_CREATED: CreatedIds = { companyId: null, applicationId: null, contactId: null };

interface WasCreatedFlags {
  company: boolean;
  application: boolean;
  contact: boolean;
}

const NOTHING_CREATED: WasCreatedFlags = { company: false, application: false, contact: false };

function ModeToggle<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      disabled={disabled}
      onValueChange={(v) => v && onChange(v as T)}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function EventComposer({
  open,
  onOpenChange,
  applicationId: pinnedApplicationId,
  companyId: seedCompanyId,
  contactId: seedContactId,
  onCreated,
}: EventComposerProps) {
  const pinned = pinnedApplicationId != null;

  const [applicationMode, setApplicationMode] = useState<"existing" | "new">("existing");
  const [existingApplicationId, setExistingApplicationId] = useState<number | null>(null);
  const [existingApplicationLabel, setExistingApplicationLabel] = useState("");
  // The company_id behind whichever existing application is picked, so a
  // new contact can default to it without a second fetch.
  const [existingApplicationCompanyId, setExistingApplicationCompanyId] = useState<number | null>(null);

  const [companyMode, setCompanyMode] = useState<"existing" | "new">("existing");
  const [existingCompanyId, setExistingCompanyId] = useState<number | null>(null);
  const [existingCompanyLabel, setExistingCompanyLabel] = useState("");
  const [companyDraft, setCompanyDraft] = useState<CompanyDraft>(EMPTY_COMPANY_DRAFT);

  const [applicationDraft, setApplicationDraft] = useState<ApplicationDraft>(EMPTY_APPLICATION_DRAFT);

  const [contactMode, setContactMode] = useState<"none" | "existing" | "new">("none");
  const [existingContactId, setExistingContactId] = useState<number | null>(null);
  const [existingContactLabel, setExistingContactLabel] = useState("");
  const [contactDraft, setContactDraft] = useState<ContactDraft>(() => emptyContactDraft());

  const [eventDraft, setEventDraft] = useState<EventDraft>(() => emptyEventDraft());

  const [created, setCreated] = useState<CreatedIds>(EMPTY_CREATED);
  // Distinct from `created`: whether the id in `created` came from an actual
  // POST (a new row) versus "Use this one" adopting an existing row after a
  // duplicate conflict. Only the former should be reported as createdXId.
  const [wasCreated, setWasCreated] = useState<WasCreatedFlags>(NOTHING_CREATED);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<SectionConflict | null>(null);

  // Fresh state every time the dialog opens with a (possibly new) seed —
  // this dialog is mounted once at the app shell and reused across seeds.
  useEffect(() => {
    if (!open) return;
    setApplicationMode("existing");
    setExistingApplicationId(pinnedApplicationId ?? null);
    setExistingApplicationLabel("");
    setExistingApplicationCompanyId(null);
    setCompanyMode("existing");
    setExistingCompanyId(seedCompanyId ?? null);
    setExistingCompanyLabel("");
    setCompanyDraft(EMPTY_COMPANY_DRAFT);
    setApplicationDraft(EMPTY_APPLICATION_DRAFT);
    setContactMode(seedContactId != null ? "existing" : "none");
    setExistingContactId(seedContactId ?? null);
    setExistingContactLabel("");
    setContactDraft(emptyContactDraft());
    setEventDraft(emptyEventDraft());
    setCreated(EMPTY_CREATED);
    setWasCreated(NOTHING_CREATED);
    setBusy(false);
    setError(null);
    setConflict(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pinnedApplicationId, seedCompanyId, seedContactId]);

  // Defaults a new contact's company — in priority order, the company of the
  // existing application selected, or the existing company selected for a
  // new application. An uncreated new company has no id yet to default to.
  useEffect(() => {
    if (contactMode !== "new" || contactDraft.company_id != null) return;
    if (!pinned && applicationMode === "existing" && existingApplicationCompanyId != null) {
      setContactDraft((d) => ({ ...d, company_id: existingApplicationCompanyId }));
    } else if (!pinned && applicationMode === "new" && companyMode === "existing" && existingCompanyId != null) {
      setContactDraft((d) => ({ ...d, company_id: existingCompanyId, company_name: existingCompanyLabel }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactMode, applicationMode, companyMode, existingApplicationCompanyId, existingCompanyId]);

  // Depth-groups the contact picker by the application's own relationship
  // graph once an application is known; falls back to the flat contact list.
  const contactGraphApplicationId = pinned
    ? pinnedApplicationId
    : applicationMode === "existing"
      ? (existingApplicationId ?? undefined)
      : undefined;

  const partial = created.companyId != null || created.applicationId != null || created.contactId != null;

  async function submit(overrides: {
    forceCompany?: boolean;
    forceApplication?: boolean;
    forceContact?: boolean;
    adoptCompanyId?: number;
    adoptApplicationId?: number;
    adoptContactId?: number;
  } = {}) {
    setBusy(true);
    setError(null);
    setConflict(null);
    try {
      let companyId = created.companyId;
      let applicationId = pinned ? pinnedApplicationId! : applicationMode === "existing" ? existingApplicationId : created.applicationId;
      let contactId = created.contactId;
      let companyCreated = wasCreated.company;
      let applicationCreated = wasCreated.application;
      let contactCreated = wasCreated.contact;

      // Step 1: company (only needed to create a new application from a new company).
      if (!pinned && applicationMode === "new") {
        if (companyMode === "existing") {
          companyId = existingCompanyId;
        } else if (companyId == null) {
          if (overrides.adoptCompanyId != null) {
            companyId = overrides.adoptCompanyId;
          } else {
            try {
              const res = await companiesApi.createCompany({
                name: companyDraft.name.trim(),
                website: companyDraft.website.trim() || null,
                description: companyDraft.description.trim() || null,
                personal_note: companyDraft.personal_note.trim() || null,
                confirm_create_duplicate: !!overrides.forceCompany,
              });
              companyId = res.id;
              companyCreated = true;
              setWasCreated((w) => ({ ...w, company: true }));
            } catch (err) {
              const dup = asDuplicateConflict(err);
              if (dup) {
                setConflict({ section: "company", conflict: dup });
                return;
              }
              if (err instanceof ApiError && err.status === 401) return;
              setError(errorMessage(err));
              return;
            }
          }
          setCreated((c) => ({ ...c, companyId }));
        }
      }

      // Step 2: application.
      if (!pinned && applicationMode === "new" && applicationId == null) {
        if (companyId == null) {
          setError("Choose or create a company first.");
          return;
        }
        if (overrides.adoptApplicationId != null) {
          applicationId = overrides.adoptApplicationId;
        } else {
          try {
            const res = await applicationsApi.createApplication({
              company_id: companyId,
              job_title: applicationDraft.job_title.trim() || null,
              job_code: applicationDraft.job_code.trim() || null,
              url: applicationDraft.url.trim() || null,
              source: applicationDraft.source.trim() || null,
              system: applicationDraft.system.trim() || null,
              date_submitted: applicationDraft.date_submitted || null,
              resume_label: applicationDraft.resume_label.trim() || null,
              initial_prompt_text: applicationDraft.initial_prompt_text.trim() || null,
              job_description: applicationDraft.job_description.trim() || null,
              manually_modified: applicationDraft.manually_modified,
              modification_note: applicationDraft.manually_modified
                ? applicationDraft.modification_note.trim() || null
                : null,
              confirm_create_duplicate: !!overrides.forceApplication,
            });
            applicationId = res.id;
            applicationCreated = true;
            setWasCreated((w) => ({ ...w, application: true }));
          } catch (err) {
            const dup = asDuplicateConflict(err);
            if (dup) {
              setConflict({ section: "application", conflict: dup });
              return;
            }
            if (err instanceof ApiError && err.status === 401) return;
            setError(errorMessage(err));
            return;
          }
        }
        setCreated((c) => ({ ...c, applicationId }));
      }

      if (applicationId == null) {
        setError("Choose an application.");
        return;
      }

      // Step 3: contact.
      if (contactMode === "existing") {
        contactId = existingContactId;
      } else if (contactMode === "new" && contactId == null) {
        if (overrides.adoptContactId != null) {
          contactId = overrides.adoptContactId;
        } else {
          try {
            const res = await contactsApi.createContact({
              company_id: contactDraft.company_id,
              first_name: contactDraft.first_name.trim() || null,
              last_name: contactDraft.last_name.trim() || null,
              email: contactDraft.email.trim() || null,
              phone: contactDraft.phone.trim() || null,
              rating: contactDraft.rating ? Number(contactDraft.rating) : null,
              description: contactDraft.description.trim() || null,
              personal_note: contactDraft.personal_note.trim() || null,
              confirm_create_duplicate: !!overrides.forceContact,
            });
            contactId = res.id;
            contactCreated = true;
            setWasCreated((w) => ({ ...w, contact: true }));
          } catch (err) {
            const dup = asDuplicateConflict(err);
            if (dup) {
              setConflict({ section: "contact", conflict: dup });
              return;
            }
            if (err instanceof ApiError && err.status === 401) return;
            setError(errorMessage(err));
            return;
          }
        }
        setCreated((c) => ({ ...c, contactId }));
      }

      // Step 4: the event itself.
      try {
        const resp = await applicationsApi.createEvent(applicationId, {
          status: eventDraftToStatus(eventDraft.status),
          contact_id: contactId,
          description: eventDraft.description.trim() || null,
          rating: eventDraft.rating === NO_SELECTION ? null : Number(eventDraft.rating),
          occurred_at: eventDraft.occurred_at,
        });
        if (!resp.event) {
          setError("The event was not recorded — no event data came back.");
          return;
        }
        store.invalidate(
          "events",
          "audit",
          "applications",
          ...(companyCreated ? (["companies"] as const) : []),
          ...(contactCreated ? (["contacts"] as const) : []),
        );
        onCreated?.({
          event: resp.event,
          applicationId,
          applicationStatus: resp.application_status,
          applicationStatusLabel: resp.application_status_label,
          applicationStatusChangedAt: resp.application_status_changed_at,
          createdCompanyId: companyCreated ? (companyId ?? undefined) : undefined,
          createdApplicationId: applicationCreated ? applicationId : undefined,
          createdContactId: contactCreated ? (contactId ?? undefined) : undefined,
        });
        onOpenChange(false);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const eventValid = eventDraftValid(eventDraft);
  const applicationValid = pinned || (applicationMode === "existing" ? existingApplicationId != null : true);
  const companyValid =
    pinned || applicationMode === "existing" || companyMode === "existing" ? true : companyDraft.name.trim() !== "";
  const companyPickValid = !pinned && applicationMode === "new" && companyMode === "existing" ? existingCompanyId != null : true;
  const contactValid = contactMode !== "new" || contactDraftValid(contactDraft);
  const canSubmit = eventValid && applicationValid && companyValid && companyPickValid && contactValid && !busy;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
        </DialogHeader>
        <Banner kind="error">{error}</Banner>
        {partial && (
          <Banner kind="warn">
            Created{" "}
            {[
              created.companyId != null && (companyDraft.name.trim() || "the company"),
              created.applicationId != null && (applicationDraft.job_title.trim() || "the application"),
              created.contactId != null &&
                ([contactDraft.first_name, contactDraft.last_name].filter(Boolean).join(" ").trim() || "the contact"),
            ]
              .filter((v): v is string => typeof v === "string")
              .map((label, i, arr) => (
                <span key={label}>
                  <strong>{label}</strong>
                  {i < arr.length - 2 ? ", " : i === arr.length - 2 ? " and " : ""}
                </span>
              ))}
            . Fixing the error below and resubmitting will reuse them rather than creating duplicates.
          </Banner>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-5"
        >
          {!pinned && (
            <div className="space-y-3">
              <FieldLabel>Application</FieldLabel>
              <ModeToggle
                value={applicationMode}
                onChange={setApplicationMode}
                disabled={busy}
                options={[
                  { value: "existing", label: "Existing" },
                  { value: "new", label: "New" },
                ]}
              />
              {applicationMode === "existing" ? (
                <>
                  <ApplicationPicker
                    value={existingApplicationId}
                    valueLabel={existingApplicationLabel}
                    onChange={(id, label, item) => {
                      setExistingApplicationId(id);
                      setExistingApplicationLabel(label ?? "");
                      setExistingApplicationCompanyId(item?.company_id ?? null);
                    }}
                    modal
                  />
                  {conflict?.section === "application" && (
                    <DuplicateWarning
                      conflict={conflict.conflict}
                      busy={busy}
                      openLabel="Use this one"
                      onOpen={(id) => submit({ adoptApplicationId: id })}
                      onForce={() => submit({ forceApplication: true })}
                    />
                  )}
                </>
              ) : (
                <div className="space-y-4 rounded-md border p-3">
                  <div className="space-y-3">
                    <FieldLabel>Company</FieldLabel>
                    <ModeToggle
                      value={companyMode}
                      onChange={setCompanyMode}
                      disabled={busy}
                      options={[
                        { value: "existing", label: "Existing" },
                        { value: "new", label: "New" },
                      ]}
                    />
                    {companyMode === "existing" ? (
                      <CompanyPicker
                        value={existingCompanyId}
                        valueLabel={existingCompanyLabel}
                        onChange={(id, name) => {
                          setExistingCompanyId(id);
                          setExistingCompanyLabel(name ?? "");
                        }}
                        modal
                      />
                    ) : (
                      <CompanyFields value={companyDraft} onChange={setCompanyDraft} disabled={busy} idPrefix="composer-company" />
                    )}
                    {conflict?.section === "company" && (
                      <DuplicateWarning
                        conflict={conflict.conflict}
                        busy={busy}
                        exactIsFinal
                        openLabel="Use this one"
                        onOpen={(id) => submit({ adoptCompanyId: id })}
                        onForce={() => submit({ forceCompany: true })}
                      />
                    )}
                  </div>
                  <ApplicationFields
                    value={applicationDraft}
                    onChange={setApplicationDraft}
                    disabled={busy}
                    hide={["company"]}
                    idPrefix="composer-app"
                  />
                </div>
              )}
            </div>
          )}

          <FieldSeparator />

          <div className="space-y-3">
            <FieldLabel>Contact</FieldLabel>
            <ModeToggle
              value={contactMode}
              onChange={setContactMode}
              disabled={busy}
              options={[
                { value: "none", label: "None" },
                { value: "existing", label: "Existing" },
                { value: "new", label: "New" },
              ]}
            />
            {contactMode === "existing" && (
              <Field>
                <ContactPicker
                  value={existingContactId}
                  valueLabel={existingContactLabel}
                  onChange={(id, label) => {
                    setExistingContactId(id);
                    setExistingContactLabel(label ?? "");
                  }}
                  applicationId={contactGraphApplicationId}
                  allowNone
                  modal
                />
              </Field>
            )}
            {contactMode === "new" && (
              <>
                <ContactFields
                  value={contactDraft}
                  onChange={setContactDraft}
                  disabled={busy}
                  allowCreateCompany
                  modal
                  idPrefix="composer-contact"
                />
                {conflict?.section === "contact" && (
                  <DuplicateWarning
                    conflict={conflict.conflict}
                    busy={busy}
                    openLabel="Use this one"
                    onOpen={(id) => submit({ adoptContactId: id })}
                    onForce={() => submit({ forceContact: true })}
                  />
                )}
              </>
            )}
          </div>

          <FieldSeparator />

          <div className="space-y-3">
            <FieldLabel>Event</FieldLabel>
            <EventFields value={eventDraft} onChange={setEventDraft} disabled={busy} hide={["contact"]} idPrefix="composer-event" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {busy ? "Creating…" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
