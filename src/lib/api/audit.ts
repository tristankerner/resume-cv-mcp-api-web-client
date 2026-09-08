import { request } from "@/lib/api/client";
import { buildQuery, type ListEnvelope } from "@/lib/api/tracking";

export type AuditOperation = "I" | "U" | "D";

export interface AuditEntry {
  id: number;
  table_name: string;
  row_pk: string;
  operation: AuditOperation;
  changed_at: string;
  row_user_id: number | null;
  actor_user_id: number | null;
  actor_credential: string | null;
  changed_columns: string[] | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

export interface ListAuditParams {
  table: string;
  row_id?: number;
  limit?: number;
  offset?: number;
}

export function listAudit(params: ListAuditParams) {
  return request<ListEnvelope<AuditEntry>>("GET", `/audit${buildQuery({ ...params })}`);
}
