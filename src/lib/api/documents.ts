import { request } from "@/lib/api/client";
import type { DocType } from "@/lib/config";
import type { JsonValue } from "@/lib/documents/diff";

export interface DocumentSummary {
  name: string;
  type: DocType;
  public: boolean;
  revision_id: number;
  revision_note: string | null;
  created_at: string;
}

export interface ListDocumentsResponse {
  data: DocumentSummary[];
}

export interface DocumentRevision {
  name: string;
  revision_id: number;
  revision_note: string | null;
  type: DocType;
  public: boolean;
  created_at: string;
  data: JsonValue;
}

export interface GetDocumentRevisionsResponse {
  data: DocumentRevision[];
}

export type UpsertStatus = "created" | "unchanged";

export interface UpsertDocumentRequest {
  name: string;
  revision_note: string;
  public: boolean | null;
  data: JsonValue;
}

export interface UpsertDocumentResponse {
  name: string;
  revision_id: number;
  status: UpsertStatus;
}

export interface RenameDocumentResponse {
  old_name: string;
  name: string;
  revisions_moved: number;
}

export interface DeleteDocumentResponse {
  name: string;
  revisions_deleted: number;
}

export interface DocumentSchemas {
  schemas: Record<string, unknown>;
}

export function schemas() {
  return request<DocumentSchemas>("GET", "/documents/schemas");
}

export function listDocuments() {
  return request<ListDocumentsResponse>("GET", "/documents");
}

export function getDocument(type: DocType, name: string, revisions = 50, order = "newest_first") {
  return request<GetDocumentRevisionsResponse>(
    "GET",
    `/documents/${type}/${encodeURIComponent(name)}?revisions=${revisions}&order=${order}`,
  );
}

export function upsertDocument(type: DocType, body: UpsertDocumentRequest) {
  return request<UpsertDocumentResponse>("POST", `/documents/${type}`, { body });
}

export function renameDocument(name: string, newName: string) {
  return request<RenameDocumentResponse>("PATCH", `/documents/${encodeURIComponent(name)}`, {
    body: { name: newName },
  });
}

export function deleteDocument(name: string) {
  return request<DeleteDocumentResponse>("DELETE", `/documents/${encodeURIComponent(name)}`);
}
