import { request } from "@/lib/api/client";

export interface ApiKey {
  id: number;
  user_id: number;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface ListApiKeysResponse {
  data: ApiKey[];
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expires_in_days: number | null;
}

export interface CreateApiKeyResponse {
  api_key: ApiKey;
  key: string;
}

export async function listApiKeys(): Promise<ApiKey[]> {
  return (await request<ListApiKeysResponse>("GET", "/api-keys")).data;
}

export function createApiKey(body: CreateApiKeyRequest) {
  return request<CreateApiKeyResponse>("POST", "/api-keys", { body });
}

export function revokeApiKey(id: number) {
  return request<null>("DELETE", `/api-keys/${id}`);
}

export function apiKeyStatus(key: ApiKey): "revoked" | "expired" | "active" {
  if (key.revoked_at) return "revoked";
  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
}
