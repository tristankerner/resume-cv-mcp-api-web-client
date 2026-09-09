import { request } from "@/lib/api/client";
import { buildQuery, type ListEnvelope } from "@/lib/api/tracking";
import type { ApplicationStatus, AttachmentKind } from "@/lib/config";

export interface DocumentRef {
  name: string;
  revision_id: number;
}

export interface ApplicationSummary {
  id: number;
  company_id: number;
  company_name: string;
  job_title: string | null;
  job_code: string | null;
  // How many *other* applications share this job code — the signal that the
  // same requisition has reached you through more than one recruiter.
  job_code_match_count: number;
  url: string | null;
  source: string | null;
  system: string | null;
  status: ApplicationStatus;
  status_label: string;
  status_changed_at: string | null;
  date_submitted: string | null;
  manually_modified: boolean;
  resume_label: string | null;
  event_count: number;
  attachment_count: number;
  created_at: string;
  updated_at: string;
}

export interface ApplicationEvent {
  id: number;
  application_id: number;
  status: ApplicationStatus | null;
  status_label: string | null;
  contact_id: number | null;
  contact_name: string | null;
  description: string | null;
  rating: number | null;
  occurred_at: string;
  created_at: string;
}

export interface AttachmentMeta {
  id: number;
  application_id: number;
  kind: AttachmentKind;
  filename: string;
  content_type: string;
  byte_size: number;
  sha256: string;
  created_at: string;
}

export interface AttachmentContent extends AttachmentMeta {
  content_base64: string;
}

export interface ApplicationDetail extends ApplicationSummary {
  job_description: string | null;
  initial_prompt_text: string | null;
  modification_note: string | null;
  resume_document: DocumentRef | null;
  metadata_document: DocumentRef | null;
  skill_document: DocumentRef | null;
  events: ApplicationEvent[];
  attachments: AttachmentMeta[];
  related_by_job_code: ApplicationSummary[];
}

export interface EventMutationResponse {
  event: ApplicationEvent | null;
  application_status: ApplicationStatus;
  application_status_label: string;
  application_status_changed_at: string;
}

export interface ListApplicationsParams {
  company_id?: number;
  status?: ApplicationStatus[];
  source?: string;
  system?: string;
  query?: string;
  job_code?: string;
  submitted_from?: string;
  submitted_to?: string;
  has_attachments?: boolean;
  limit?: number;
  offset?: number;
  sort?:
    | "date_submitted"
    | "-date_submitted"
    | "company"
    | "-company"
    | "status"
    | "created_at"
    | "-created_at";
}

export interface CreateApplicationRequest {
  company_id: number;
  url?: string | null;
  job_title?: string | null;
  job_code?: string | null;
  resume_document_name?: string | null;
  resume_revision_id?: number | null;
  metadata_document_name?: string | null;
  metadata_revision_id?: number | null;
  skill_document_name?: string | null;
  skill_revision_id?: number | null;
  resume_label?: string | null;
  initial_prompt_text?: string | null;
  job_description?: string | null;
  date_submitted?: string | null;
  manually_modified?: boolean;
  modification_note?: string | null;
  source?: string | null;
  system?: string | null;
  confirm_create_duplicate?: boolean;
}

export type UpdateApplicationRequest = Omit<CreateApplicationRequest, "company_id"> & {
  company_id?: number;
};

export interface CreateEventRequest {
  status?: ApplicationStatus | null;
  contact_id?: number | null;
  description?: string | null;
  rating?: number | null;
  occurred_at?: string;
}

export type UpdateEventRequest = CreateEventRequest;

export interface UploadAttachmentRequest {
  kind: AttachmentKind;
  filename: string;
  content_type: string;
  content_base64: string;
}

export function listApplications(params: ListApplicationsParams = {}) {
  return request<ListEnvelope<ApplicationSummary>>("GET", `/applications${buildQuery({ ...params })}`);
}

export function createApplication(body: CreateApplicationRequest) {
  return request<ApplicationDetail>("POST", "/applications", { body });
}

export function getApplication(applicationId: number) {
  return request<ApplicationDetail>("GET", `/applications/${applicationId}`);
}

export function updateApplication(applicationId: number, body: UpdateApplicationRequest) {
  return request<ApplicationDetail>("PATCH", `/applications/${applicationId}`, { body });
}

export function deleteApplication(applicationId: number) {
  return request<null>("DELETE", `/applications/${applicationId}`);
}

export function listEvents(applicationId: number) {
  return request<ListEnvelope<ApplicationEvent>>("GET", `/applications/${applicationId}/events`);
}

// A contact tagged with its distance from the application's own company —
// depth 0 is that company, 1-3 are hops through company_relationships in
// either direction, `via` names the chain. Used to offer recruiters and
// other related-company contacts as event participants, not just people at
// the company the application itself is filed under.
export interface ContactOption {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  rating: number | null;
  company_id: number;
  company_name: string;
  depth: number;
  via: string | null;
}

export interface ListContactOptionsParams {
  query?: string;
  limit?: number;
  offset?: number;
}

export function listContactOptions(applicationId: number, params: ListContactOptionsParams = {}) {
  return request<ListEnvelope<ContactOption>>(
    "GET",
    `/applications/${applicationId}/contact-options${buildQuery({ ...params })}`,
  );
}

export function createEvent(applicationId: number, body: CreateEventRequest) {
  return request<EventMutationResponse>("POST", `/applications/${applicationId}/events`, { body });
}

export function updateEvent(eventId: number, body: UpdateEventRequest) {
  return request<EventMutationResponse>("PATCH", `/application-events/${eventId}`, { body });
}

// The one delete in the feature with a body: the client needs the
// recomputed application status and a second round trip to get it would be
// silly, so the server answers 200 with an EventMutationResponse instead of
// the usual 204.
export function deleteEvent(eventId: number) {
  return request<EventMutationResponse>("DELETE", `/application-events/${eventId}`);
}

export function listAttachments(applicationId: number) {
  return request<ListEnvelope<AttachmentMeta>>("GET", `/applications/${applicationId}/attachments`);
}

export function uploadAttachment(applicationId: number, body: UploadAttachmentRequest) {
  return request<AttachmentMeta>("POST", `/applications/${applicationId}/attachments`, { body });
}

export function getAttachment(attachmentId: number) {
  return request<AttachmentContent>("GET", `/attachments/${attachmentId}`);
}

export function deleteAttachment(attachmentId: number) {
  return request<null>("DELETE", `/attachments/${attachmentId}`);
}
