export const DEFAULT_API_BASE = "http://localhost:8000";

// The path main.py serves this file at when CLIENT_HTML_PATH is set.
export const SERVED_BY_API_PATH = "/client";

export const API_BASE_STORAGE_KEY = "resume-api-client.api-base";
export const SESSION_STORAGE_KEY = "resume-api-client.session";

export const DOC_TYPES = ["resume", "metadata", "skill"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const SESSION_LOW_WARNING_MS = 5 * 60 * 1000;

// --- Application tracking -----------------------------------------------
// Mirrors GET /tracking/enums (Appendix A.4). The client hardcodes these for
// rendering, but must not fail on a value it does not recognize — see
// `labelFor` in lib/tracking/labels.ts.

export const APPLICATION_STATUSES = [
  { value: "submitted", label: "Submitted", terminal: false },
  { value: "no_response", label: "No Response", terminal: false },
  { value: "screening", label: "Screening", terminal: false },
  { value: "assessment", label: "Assessment / Take-home", terminal: false },
  { value: "interview_scheduled", label: "Interview Scheduled", terminal: false },
  { value: "interview_completed", label: "Interview Completed", terminal: false },
  { value: "follow_up", label: "Follow-up", terminal: false },
  { value: "job_offered", label: "Job Offered", terminal: false },
  { value: "offer_declined", label: "Offer Declined", terminal: true },
  { value: "job_accepted", label: "Job Accepted", terminal: true },
  { value: "rejected", label: "Rejected", terminal: true },
  { value: "withdrawn", label: "Withdrawn", terminal: true },
  { value: "position_closed", label: "Position Closed", terminal: true },
  { value: "ghosted", label: "Ghosted", terminal: true },
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]["value"];

export const STACK_ITEM_TYPES = [
  { value: "programming_language", label: "Programming Language" },
  { value: "framework", label: "Framework" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "data", label: "Data" },
  { value: "other", label: "Other" },
] as const;
export type StackItemType = (typeof STACK_ITEM_TYPES)[number]["value"];

export const COMPANY_RELATIONSHIP_TYPES = [
  { value: "child_of", label: "Child Of" },
  { value: "parent_of", label: "Parent Of" },
  { value: "customer_of", label: "Customer Of" },
  { value: "vendor_of", label: "Vendor Of" },
  { value: "staffing_agency_for", label: "Staffing Agency For" },
  { value: "acquired_by", label: "Acquired By" },
  { value: "partner_of", label: "Partner Of" },
] as const;
export type CompanyRelationshipType = (typeof COMPANY_RELATIONSHIP_TYPES)[number]["value"];

export const ATTACHMENT_KINDS = [
  { value: "resume", label: "Resume" },
  { value: "cover_letter", label: "Cover Letter" },
  { value: "other", label: "Other" },
] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]["value"];

// A contact's 1-10 rating has no enum on the wire — it is a plain int
// column — but the anchors at 1/5/10 are worth spelling out consistently
// wherever the client offers a rating picker.
export const CONTACT_RATING_OPTIONS = [
  { value: 1, label: "1 — Very bad" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5 — No idea" },
  { value: 6, label: "6" },
  { value: 7, label: "7" },
  { value: 8, label: "8" },
  { value: 9, label: "9" },
  { value: 10, label: "10 — Great" },
] as const;

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
